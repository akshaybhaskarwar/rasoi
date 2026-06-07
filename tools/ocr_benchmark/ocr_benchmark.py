#!/usr/bin/env python3
"""
OCR backend benchmark for Indian grocery receipts.

Runs each available OCR/vision backend on every image in a folder and prints
a side-by-side scorecard so we can pick the right tool for Phase 1 of the
"update inventory from receipt" feature.

Usage:
    python ocr_benchmark.py /path/to/receipts/

Backends (each is optional — missing deps/keys just skips that backend):
    1. paddleocr      — free, self-hosted, ~75–85% Devanagari accuracy
    2. google-vision  — 1000/mo free tier, ~92–95% Devanagari accuracy
    3. claude-vision  — paid (~₹0.10/receipt), structured JSON in one call

Environment / setup:
    pip install pillow pillow-heif                       # always
    pip install paddleocr paddlepaddle                   # for PaddleOCR
    pip install google-cloud-vision                      # for Google
    pip install anthropic                                # for Claude
    export GOOGLE_APPLICATION_CREDENTIALS=...            # for Google
    export ANTHROPIC_API_KEY=...                         # for Claude

Outputs:
    <receipt>.<backend>.json  — raw output per (image, backend)
    summary.csv               — one row per (image, backend) with metrics
    stdout                    — readable scorecard
"""

from __future__ import annotations

import argparse
import base64
import csv
import json
import os
import sys
import time
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any, Optional

# --- HEIC support (Apple photos) ------------------------------------------------
try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
    HEIC_OK = True
except ImportError:
    HEIC_OK = False

try:
    from PIL import Image
except ImportError:
    print("FATAL: Pillow is required. Run: pip install pillow pillow-heif", file=sys.stderr)
    sys.exit(1)


SUPPORTED_EXTS = {".jpg", ".jpeg", ".png", ".heic", ".webp"}


@dataclass
class BackendResult:
    backend: str
    image: str
    ok: bool
    elapsed_s: float
    items_detected: int = 0
    total_reported: Optional[float] = None
    raw: Any = None
    error: Optional[str] = None


# ----------------------------------------------------------------------------- #
# Image prep — always convert to a normal JPEG before sending to any backend.   #
# ----------------------------------------------------------------------------- #
def to_jpeg(src: Path, work_dir: Path) -> Path:
    """Convert any supported image to a JPEG in work_dir. Returns the new path."""
    if src.suffix.lower() in {".jpg", ".jpeg"}:
        return src
    out = work_dir / (src.stem + ".jpg")
    if out.exists():
        return out
    img = Image.open(src).convert("RGB")
    img.save(out, "JPEG", quality=92)
    return out


# ----------------------------------------------------------------------------- #
# Backend 1 — PaddleOCR                                                         #
# ----------------------------------------------------------------------------- #
def run_paddleocr(image_path: Path) -> BackendResult:
    name = "paddleocr"
    try:
        from paddleocr import PaddleOCR
    except ImportError:
        return BackendResult(name, image_path.name, False, 0.0,
                             error="paddleocr not installed (pip install paddleocr paddlepaddle)")

    t0 = time.perf_counter()
    try:
        # 'devanagari' covers Hindi + Marathi.
        ocr = run_paddleocr._cache  # type: ignore[attr-defined]
    except AttributeError:
        ocr = PaddleOCR(use_angle_cls=True, lang="devanagari", show_log=False)
        run_paddleocr._cache = ocr  # type: ignore[attr-defined]

    try:
        result = ocr.ocr(str(image_path), cls=True)
    except Exception as e:  # noqa: BLE001
        return BackendResult(name, image_path.name, False, time.perf_counter() - t0,
                             error=f"paddle runtime error: {e}")

    # Result shape: List[List[ [bbox, (text, conf)] ]]
    lines = []
    if result and result[0]:
        for det in result[0]:
            text, conf = det[1]
            lines.append({"text": text, "conf": float(conf)})

    elapsed = time.perf_counter() - t0
    # Lines that look like "<text> ... <number>" are likely item rows.
    item_like = [l for l in lines if any(c.isdigit() for c in l["text"])]
    total = _guess_total(lines)
    return BackendResult(name, image_path.name, True, elapsed,
                         items_detected=len(item_like),
                         total_reported=total,
                         raw={"lines": lines})


# ----------------------------------------------------------------------------- #
# Backend 2 — Google Cloud Vision                                               #
# ----------------------------------------------------------------------------- #
def run_google_vision(image_path: Path) -> BackendResult:
    name = "google-vision"
    if not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        return BackendResult(name, image_path.name, False, 0.0,
                             error="GOOGLE_APPLICATION_CREDENTIALS not set")
    try:
        from google.cloud import vision
    except ImportError:
        return BackendResult(name, image_path.name, False, 0.0,
                             error="google-cloud-vision not installed (pip install google-cloud-vision)")

    t0 = time.perf_counter()
    client = vision.ImageAnnotatorClient()
    with open(image_path, "rb") as f:
        content = f.read()
    image = vision.Image(content=content)
    # document_text_detection beats text_detection for receipts (preserves layout)
    try:
        resp = client.document_text_detection(
            image=image,
            image_context={"language_hints": ["mr", "hi", "en"]},
        )
    except Exception as e:  # noqa: BLE001
        return BackendResult(name, image_path.name, False, time.perf_counter() - t0,
                             error=f"google vision error: {e}")
    elapsed = time.perf_counter() - t0

    full_text = resp.full_text_annotation.text if resp.full_text_annotation else ""
    lines = [{"text": l} for l in full_text.splitlines() if l.strip()]
    item_like = [l for l in lines if any(c.isdigit() for c in l["text"])]
    total = _guess_total(lines)
    return BackendResult(name, image_path.name, True, elapsed,
                         items_detected=len(item_like),
                         total_reported=total,
                         raw={"full_text": full_text, "lines": lines})


# ----------------------------------------------------------------------------- #
# Backend 3 — Claude Vision (structured extraction)                             #
# ----------------------------------------------------------------------------- #
CLAUDE_PROMPT = """\
You are reading a grocery receipt from an Indian shop. The item names are
in Devanagari script (Marathi or Hindi). The quantity, unit code, rate, and
amount are in Latin numerals. Common unit codes: UT = unit/packet, K = kg,
G = gram, L = litre.

Return a strict JSON object with this shape (no prose, no markdown fences):
{
  "vendor": "<shop name if visible, else null>",
  "items": [
    {
      "name_devanagari": "<as printed>",
      "qty": <number>,
      "unit": "<UT|K|G|L|other>",
      "rate": <number>,
      "amount": <number>
    }
  ],
  "total": <number>
}

If you cannot read a field, set it to null. Do not invent items.
"""


def run_claude_vision(image_path: Path) -> BackendResult:
    name = "claude-vision"
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return BackendResult(name, image_path.name, False, 0.0,
                             error="ANTHROPIC_API_KEY not set")
    try:
        import anthropic
    except ImportError:
        return BackendResult(name, image_path.name, False, 0.0,
                             error="anthropic not installed (pip install anthropic)")

    with open(image_path, "rb") as f:
        b64 = base64.standard_b64encode(f.read()).decode()

    client = anthropic.Anthropic()
    t0 = time.perf_counter()
    try:
        msg = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=4096,
            temperature=0,  # deterministic OCR — critical for noisy Devanagari
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {
                        "type": "base64",
                        "media_type": "image/jpeg",
                        "data": b64,
                    }},
                    {"type": "text", "text": CLAUDE_PROMPT},
                ],
            }],
        )
    except Exception as e:  # noqa: BLE001
        return BackendResult(name, image_path.name, False, time.perf_counter() - t0,
                             error=f"anthropic error: {e}")
    elapsed = time.perf_counter() - t0

    text = "".join(b.text for b in msg.content if hasattr(b, "text"))
    parsed: dict[str, Any] | None = None
    try:
        # Be tolerant of stray whitespace/fences
        cleaned = text.strip().lstrip("`").rstrip("`")
        if cleaned.startswith("json"):
            cleaned = cleaned[4:].strip()
        parsed = json.loads(cleaned)
    except Exception as e:  # noqa: BLE001
        return BackendResult(name, image_path.name, False, elapsed,
                             error=f"json parse failed: {e}", raw={"text": text})

    return BackendResult(name, image_path.name, True, elapsed,
                         items_detected=len(parsed.get("items", []) or []),
                         total_reported=parsed.get("total"),
                         raw=parsed)


# ----------------------------------------------------------------------------- #
# Backend 3b — Claude Vision + PANTRY catalog in prompt                         #
# ----------------------------------------------------------------------------- #
# Loads the project's PANTRY_TEMPLATE (en/mr/hi/aliases for ~900 items) and     #
# feeds it as a cached prompt block, so Claude can resolve mangled Devanagari   #
# OCR output to canonical English catalog names in the same call.              #

_CATALOG_TEXT_CACHE: Optional[str] = None


def _load_catalog_text() -> str:
    """Build a compact catalog text block from PANTRY_TEMPLATE.

    One line per item:
        Onion | mr: कांदा | hi: प्याज | aliases: Kanda, Pyaaz | category: vegetables
    """
    global _CATALOG_TEXT_CACHE
    if _CATALOG_TEXT_CACHE is not None:
        return _CATALOG_TEXT_CACHE

    # Find backend/ on disk and import PANTRY_TEMPLATE.
    here = Path(__file__).resolve().parent
    repo_root = here.parent.parent
    backend_dir = repo_root / "backend"
    if not backend_dir.is_dir():
        raise RuntimeError(f"Cannot find backend/ relative to {here}")
    sys.path.insert(0, str(backend_dir))
    try:
        from data.pantry_items import PANTRY_TEMPLATE  # type: ignore
    finally:
        try:
            sys.path.remove(str(backend_dir))
        except ValueError:
            pass

    lines: list[str] = []
    for main_data in PANTRY_TEMPLATE.values():
        for sub_data in main_data["subcategories"].values():
            category = sub_data["category"]
            for item in sub_data["items"]:
                bits = [item["en"]]
                if item.get("mr"):
                    bits.append(f"mr: {item['mr']}")
                if item.get("hi"):
                    bits.append(f"hi: {item['hi']}")
                if item.get("aliases"):
                    bits.append("aliases: " + ", ".join(item["aliases"]))
                bits.append(f"category: {category}")
                lines.append(" | ".join(bits))

    _CATALOG_TEXT_CACHE = (
        "CATALOG OF INDIAN GROCERY ITEMS\n"
        "Each line: <canonical English name> | mr: <Marathi> | hi: <Hindi> | "
        "aliases: <transliterations> | category: <kind>\n"
        "Use these as the closed set when resolving the receipt items below.\n"
        "------- BEGIN CATALOG -------\n"
        + "\n".join(lines)
        + "\n------- END CATALOG -------\n"
    )
    return _CATALOG_TEXT_CACHE


CLAUDE_CATALOG_PROMPT = """\
You are reading a grocery receipt from an Indian shop. Item names are
printed in Devanagari (Marathi or Hindi). Quantity, unit code, rate, and
amount are Latin numerals. Common unit codes: UT = unit/packet, K = kg,
G = gram, L = litre.

For EACH item row, also map the printed Devanagari name to the closest
catalog entry above. The receipt may show brand names, abbreviated forms,
or OCR-mangled characters — use your judgment plus the catalog context
(en/mr/hi/aliases) to pick the most likely canonical English name.

Return a STRICT JSON object (no prose, no markdown fences):
{
  "vendor": "<shop name if visible, else null>",
  "items": [
    {
      "name_devanagari": "<as printed on the receipt>",
      "name_canonical_en": "<exact English name from the catalog, or null if no plausible match>",
      "match_confidence": "<high|medium|low|unmatched>",
      "qty": <number>,
      "unit": "<UT|K|G|L|other>",
      "rate": <number>,
      "amount": <number>
    }
  ],
  "total": <number>
}

Confidence guide:
  high      = catalog entry is clearly the same item (e.g., printed name matches
              an alias or only has 1-2 char OCR drift in Devanagari)
  medium    = same family, but ambiguity (e.g., "Dal" without specifying which dal)
  low       = best guess, but you're <60% sure
  unmatched = no plausible catalog entry; set name_canonical_en to null

If you cannot read a field, set it to null. Do not invent items.
"""


def run_claude_vision_catalog(image_path: Path) -> BackendResult:
    name = "claude-vision+catalog"
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return BackendResult(name, image_path.name, False, 0.0,
                             error="ANTHROPIC_API_KEY not set")
    try:
        import anthropic
    except ImportError:
        return BackendResult(name, image_path.name, False, 0.0,
                             error="anthropic not installed (pip install anthropic)")

    try:
        catalog_text = _load_catalog_text()
    except Exception as e:  # noqa: BLE001
        return BackendResult(name, image_path.name, False, 0.0,
                             error=f"could not load catalog: {e}")

    with open(image_path, "rb") as f:
        b64 = base64.standard_b64encode(f.read()).decode()

    client = anthropic.Anthropic()
    t0 = time.perf_counter()
    try:
        msg = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=4096,
            temperature=0,  # deterministic OCR — critical for noisy Devanagari
            messages=[{
                "role": "user",
                "content": [
                    # Cached block — the catalog is reused across every receipt
                    # in this run, so subsequent calls pay ~10% of the input cost
                    # for this portion.
                    {"type": "text",
                     "text": catalog_text,
                     "cache_control": {"type": "ephemeral"}},
                    {"type": "image", "source": {
                        "type": "base64",
                        "media_type": "image/jpeg",
                        "data": b64,
                    }},
                    {"type": "text", "text": CLAUDE_CATALOG_PROMPT},
                ],
            }],
        )
    except Exception as e:  # noqa: BLE001
        return BackendResult(name, image_path.name, False, time.perf_counter() - t0,
                             error=f"anthropic error: {e}")
    elapsed = time.perf_counter() - t0

    text = "".join(b.text for b in msg.content if hasattr(b, "text"))
    try:
        cleaned = text.strip().lstrip("`").rstrip("`")
        if cleaned.startswith("json"):
            cleaned = cleaned[4:].strip()
        parsed = json.loads(cleaned)
    except Exception as e:  # noqa: BLE001
        return BackendResult(name, image_path.name, False, elapsed,
                             error=f"json parse failed: {e}", raw={"text": text})

    # Surface cache usage in the raw output so we can confirm caching kicked in.
    usage = getattr(msg, "usage", None)
    if usage:
        parsed["_usage"] = {
            "input_tokens": getattr(usage, "input_tokens", None),
            "output_tokens": getattr(usage, "output_tokens", None),
            "cache_creation_input_tokens": getattr(usage, "cache_creation_input_tokens", None),
            "cache_read_input_tokens": getattr(usage, "cache_read_input_tokens", None),
        }

    return BackendResult(name, image_path.name, True, elapsed,
                         items_detected=len(parsed.get("items", []) or []),
                         total_reported=parsed.get("total"),
                         raw=parsed)


# ----------------------------------------------------------------------------- #
# Backend 4 — Hybrid: Google OCR + Claude (text-only) parse with catalog        #
# ----------------------------------------------------------------------------- #
# Google has dramatically better Devanagari character accuracy on thermal-paper #
# receipts but returns flattened raw text (loses column alignment). Claude is   #
# excellent at parsing structured records from messy text AND at catalog-aware  #
# matching. This pipeline plays to both strengths: Google does OCR, Claude does #
# parsing + canonical-name mapping in a single text-only follow-up call.        #
#                                                                               #
# Cost:  Google free tier (1000/mo) + Claude text-only (~₹0.02/receipt).        #
# Speed: Google ~3s + Claude ~6s = ~10s end-to-end.                             #

CLAUDE_PARSE_PROMPT = """\
Below is OCR text extracted from an Indian grocery receipt. The OCR engine
preserved character accuracy but flattened the column layout — typically item
names appear first as a block, then quantity/unit/rate/amount as another block.

Your job:
1. Re-pair each item name with its qty/unit/rate/amount row.
2. Map each item to the closest entry from the CATALOG above (canonical
   English name). Use match_confidence as defined in the catalog instructions.

Common unit codes: UT = unit/packet, K = kg, G = gram, L = litre.

Return STRICT JSON (no prose, no markdown fences):
{
  "vendor": "<shop name if extractable, else null>",
  "items": [
    {
      "name_devanagari": "<as printed>",
      "name_canonical_en": "<catalog match, or null>",
      "match_confidence": "<high|medium|low|unmatched>",
      "qty": <number>,
      "unit": "<UT|K|G|L|other>",
      "rate": <number>,
      "amount": <number>
    }
  ],
  "total": <number — from the line with 'Total:'>
}

OCR TEXT:
"""


def run_google_plus_claude_catalog(image_path: Path) -> BackendResult:
    name = "google+claude-catalog"

    # Step 1: Google OCR
    google = run_google_vision(image_path)
    if not google.ok:
        return BackendResult(name, image_path.name, False, google.elapsed_s,
                             error=f"google step failed: {google.error}")
    full_text = (google.raw or {}).get("full_text", "")
    if not full_text:
        return BackendResult(name, image_path.name, False, google.elapsed_s,
                             error="google returned empty text")

    # Step 2: Claude text-only parse with catalog
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return BackendResult(name, image_path.name, False, google.elapsed_s,
                             error="ANTHROPIC_API_KEY not set")
    try:
        import anthropic
    except ImportError:
        return BackendResult(name, image_path.name, False, google.elapsed_s,
                             error="anthropic not installed")
    try:
        catalog_text = _load_catalog_text()
    except Exception as e:  # noqa: BLE001
        return BackendResult(name, image_path.name, False, google.elapsed_s,
                             error=f"could not load catalog: {e}")

    client = anthropic.Anthropic()
    t0 = time.perf_counter()
    try:
        msg = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=4096,
            temperature=0,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text",
                     "text": catalog_text,
                     "cache_control": {"type": "ephemeral"}},
                    {"type": "text",
                     "text": CLAUDE_PARSE_PROMPT + full_text},
                ],
            }],
        )
    except Exception as e:  # noqa: BLE001
        return BackendResult(name, image_path.name, False,
                             google.elapsed_s + (time.perf_counter() - t0),
                             error=f"anthropic error: {e}")
    claude_elapsed = time.perf_counter() - t0
    total_elapsed = google.elapsed_s + claude_elapsed

    text = "".join(b.text for b in msg.content if hasattr(b, "text"))
    try:
        cleaned = text.strip().lstrip("`").rstrip("`")
        if cleaned.startswith("json"):
            cleaned = cleaned[4:].strip()
        parsed = json.loads(cleaned)
    except Exception as e:  # noqa: BLE001
        return BackendResult(name, image_path.name, False, total_elapsed,
                             error=f"json parse failed: {e}",
                             raw={"text": text, "google_text": full_text})

    usage = getattr(msg, "usage", None)
    if usage:
        parsed["_usage"] = {
            "input_tokens": getattr(usage, "input_tokens", None),
            "output_tokens": getattr(usage, "output_tokens", None),
            "cache_creation_input_tokens": getattr(usage, "cache_creation_input_tokens", None),
            "cache_read_input_tokens": getattr(usage, "cache_read_input_tokens", None),
        }
    parsed["_timings"] = {"google_s": round(google.elapsed_s, 2),
                          "claude_s": round(claude_elapsed, 2)}

    return BackendResult(name, image_path.name, True, total_elapsed,
                         items_detected=len(parsed.get("items", []) or []),
                         total_reported=parsed.get("total"),
                         raw=parsed)


# ----------------------------------------------------------------------------- #
# Heuristics                                                                    #
# ----------------------------------------------------------------------------- #
def _guess_total(lines: list[dict]) -> Optional[float]:
    """Find the receipt grand total.

    Strategy:
    1. Look for a line with 'total' (case-insensitive) — return the number
       on that line OR the immediately preceding/following line.
    2. Fall back to the largest number, but ignore implausibly large values
       (>1e7) which are usually phone numbers or customer reference IDs.
    """
    for i, l in enumerate(lines):
        t = l["text"].lower()
        if "total" in t:
            for src in (lines[i], lines[max(0, i-1)] if i else None,
                        lines[i+1] if i + 1 < len(lines) else None):
                if src is None:
                    continue
                nums = [n for n in _extract_numbers(src["text"]) if n < 1e7]
                if nums:
                    return max(nums)
    # Fallback: largest plausible number in receipt
    all_nums: list[float] = []
    for l in lines:
        all_nums.extend(n for n in _extract_numbers(l["text"]) if n < 1e7)
    return max(all_nums) if all_nums else None


def _extract_numbers(s: str) -> list[float]:
    import re
    out = []
    for m in re.finditer(r"\d+(?:[.,]\d+)?", s):
        try:
            out.append(float(m.group(0).replace(",", "")))
        except ValueError:
            pass
    return out


# ----------------------------------------------------------------------------- #
# Driver                                                                        #
# ----------------------------------------------------------------------------- #
BACKENDS = [
    ("paddleocr", run_paddleocr),
    ("google-vision", run_google_vision),
    ("claude-vision", run_claude_vision),
    ("claude-vision+catalog", run_claude_vision_catalog),
    ("google+claude-catalog", run_google_plus_claude_catalog),
]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("folder", help="Folder containing receipt images (jpg/png/heic).")
    parser.add_argument("--only", nargs="+", choices=[b[0] for b in BACKENDS],
                        help="Run only these backends.")
    parser.add_argument("--out", default=None,
                        help="Output directory (default: <folder>/_ocr_out)")
    args = parser.parse_args()

    src = Path(args.folder).expanduser().resolve()
    if not src.is_dir():
        print(f"FATAL: {src} is not a directory", file=sys.stderr)
        return 2

    out_dir = Path(args.out) if args.out else src / "_ocr_out"
    out_dir.mkdir(exist_ok=True)
    work_dir = out_dir / "_work"
    work_dir.mkdir(exist_ok=True)

    images = sorted(p for p in src.iterdir()
                    if p.suffix.lower() in SUPPORTED_EXTS and not p.name.startswith("."))
    if not images:
        print(f"No images in {src} (supported: {sorted(SUPPORTED_EXTS)})", file=sys.stderr)
        return 1

    backends = [(n, fn) for n, fn in BACKENDS if not args.only or n in args.only]

    if not HEIC_OK and any(p.suffix.lower() == ".heic" for p in images):
        print("WARN: pillow-heif not installed; HEIC files will fail. "
              "Run: pip install pillow-heif", file=sys.stderr)

    rows: list[BackendResult] = []
    for img in images:
        print(f"\n=== {img.name} ===")
        try:
            jpeg = to_jpeg(img, work_dir)
        except Exception as e:  # noqa: BLE001
            print(f"  could not open: {e}")
            continue

        for bname, fn in backends:
            print(f"  · running {bname:14s} ... ", end="", flush=True)
            r = fn(jpeg)
            rows.append(r)
            if r.ok:
                print(f"ok  ({r.elapsed_s:5.1f}s) items={r.items_detected:>3} "
                      f"total={r.total_reported}")
            else:
                print(f"SKIP ({r.error})")

            # Persist per-image raw output for spot-check
            if r.ok:
                fn_out = out_dir / f"{img.stem}.{bname}.json"
                fn_out.write_text(json.dumps(r.raw, ensure_ascii=False, indent=2))

    # ------------------------------------------------------------------ summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"{'image':<30s} {'backend':<15s} {'ok':<4s} {'time':>6s} {'items':>6s} {'total':>10s}")
    print("-" * 80)
    for r in rows:
        ok = "✓" if r.ok else "—"
        items = r.items_detected if r.ok else "—"
        total = f"{r.total_reported:.2f}" if r.total_reported is not None else "—"
        print(f"{r.image[:29]:<30s} {r.backend:<15s} {ok:<4s} {r.elapsed_s:>5.1f}s "
              f"{str(items):>6s} {total:>10s}")

    # CSV for spreadsheet review
    csv_path = out_dir / "summary.csv"
    with csv_path.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["image", "backend", "ok", "elapsed_s",
                                          "items_detected", "total_reported", "error"])
        w.writeheader()
        for r in rows:
            w.writerow({
                "image": r.image,
                "backend": r.backend,
                "ok": r.ok,
                "elapsed_s": round(r.elapsed_s, 2),
                "items_detected": r.items_detected,
                "total_reported": r.total_reported,
                "error": r.error or "",
            })
    print(f"\nWrote {csv_path}")
    print(f"Raw outputs in {out_dir}/<image>.<backend>.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
