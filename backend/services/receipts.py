"""
Receipt Ingestion Service for Rasoi-Sync

Pipeline:
  image bytes -> Google Vision OCR (Devanagari-strong character recognition)
              -> Claude Haiku (text-only) with cached PANTRY_TEMPLATE catalog
              -> Fuzzy fallback (rapidfuzz) for items Claude leaves `unmatched`
              -> Structured items ready for user confirmation

Architecture chosen after benchmarking 3 Marathi grocery receipts (89 items
total). See tools/ocr_benchmark/ and docs/PRDs/01-receipt-to-inventory.md.

Cost & latency:
  Google free tier covers 1000 receipts/month; ~3s per call.
  Claude Haiku text-only with cached catalog: ~₹0.02 per receipt; ~5-10s.
  Total wall time: ~10-15s end-to-end.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any, Dict, List, Tuple

from data.pantry_items import PANTRY_TEMPLATE, to_canonical_en_fuzzy

logger = logging.getLogger(__name__)


def group_words_into_rows(words: List[Dict[str, Any]]) -> List[str]:
    """Rebuild receipt lines from OCR word boxes, grouping by vertical position.

    Each returned string is one physical row of the receipt with its name and
    its numbers together, in left-to-right order — which is the pairing the
    flattened OCR text destroys.

    Two words share a row when their vertical spans overlap by more than half
    the shorter word's height. Overlap is used rather than a fixed pixel
    tolerance because receipts are photographed at arbitrary distances, and it
    tolerates the slight baseline drift of a hand-held photo without merging
    genuinely separate lines.
    """
    if not words:
        return []

    rows: List[List[Dict[str, Any]]] = []
    for word in sorted(words, key=lambda w: (w["y_mid"], w["x"])):
        placed = False
        for row in rows:
            ref = row[-1]
            overlap = min(word["y_bottom"], ref["y_bottom"]) - max(word["y_top"], ref["y_top"])
            shorter = min(word["y_bottom"] - word["y_top"], ref["y_bottom"] - ref["y_top"])
            if shorter > 0 and overlap > shorter * 0.5:
                row.append(word)
                placed = True
                break
        if not placed:
            rows.append([word])

    lines = []
    for row in rows:
        row.sort(key=lambda w: w["x"])
        line = " ".join(w["text"] for w in row).strip()
        if line:
            lines.append(line)
    return lines


# ----------------------------------------------------------------------------- #
# Catalog text built once at import — fed to Claude via cached prompt block.    #
# ----------------------------------------------------------------------------- #
def _build_catalog_text() -> str:
    """Compact catalog representation (one item per line) for Claude prompt."""
    lines = []
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
    return (
        "CATALOG OF INDIAN GROCERY ITEMS\n"
        "Each line: <canonical English name> | mr: <Marathi> | hi: <Hindi> | "
        "aliases: <transliterations> | category: <kind>\n"
        "Use these as the closed set when resolving the receipt items below.\n"
        "------- BEGIN CATALOG -------\n"
        + "\n".join(lines)
        + "\n------- END CATALOG -------\n"
    )


_CATALOG_TEXT = _build_catalog_text()


ROW_ALIGNED_PARSE_PROMPT = """\
Below are the rows of an Indian grocery receipt. Each line has ALREADY been
reconstructed from the OCR word positions, so the name and its numbers on a
given line belong together. Do NOT re-associate values across lines — the
pairing is authoritative.

Your job:
1. For each line that is a purchased item, read off its qty/unit/rate/amount
   as printed on that line.
2. Map each item to the closest entry from the CATALOG above (canonical
   English name).

Skip header lines, totals, shop details and any line that is not a purchase.
"""

# Retained for the fallback path: if row reconstruction produced too little to
# be trustworthy, we send the flattened text with the old instructions rather
# than feeding the model rows we do not believe in.
CLAUDE_PARSE_PROMPT = """\
Below is OCR text extracted from an Indian grocery receipt. The OCR engine
preserved character accuracy but flattened the column layout — typically item
names appear first as a block, then quantity/unit/rate/amount as another block.

Your job:
1. Re-pair each item name with its qty/unit/rate/amount row.
2. Map each item to the closest entry from the CATALOG above (canonical
   English name).

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

Confidence guide:
  high      = catalog entry is clearly the same item (printed name matches
              an alias or only has 1-2 char OCR drift in Devanagari)
  medium    = same family, but some ambiguity
  low       = best guess, <60% sure
  unmatched = no plausible catalog entry; set name_canonical_en to null

If you cannot read a field, set it to null. Do not invent items.

OCR TEXT:
"""


class ReceiptIngestionError(Exception):
    """Raised when the pipeline cannot process a receipt."""


class ReceiptIngestionService:
    """Image -> structured grocery items.

    Lazily initializes Google Vision and Anthropic clients on first use so the
    service can be constructed at server startup even if credentials are
    misconfigured (will fail at call time with a clear error instead).
    """

    def __init__(self, anthropic_model: str = "claude-haiku-4-5"):
        self._anthropic_model = anthropic_model
        self._google_client = None
        self._anthropic_client = None

    # ---------------------------- client init --------------------------------

    def _get_google_client(self):
        if self._google_client is None:
            try:
                from google.cloud import vision  # type: ignore
            except ImportError as e:
                raise ReceiptIngestionError(
                    "google-cloud-vision not installed; cannot run OCR"
                ) from e
            if not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
                raise ReceiptIngestionError(
                    "GOOGLE_APPLICATION_CREDENTIALS env var not set"
                )
            self._google_client = vision.ImageAnnotatorClient()
        return self._google_client

    def _get_anthropic_client(self):
        if self._anthropic_client is None:
            try:
                import anthropic  # type: ignore
            except ImportError as e:
                raise ReceiptIngestionError(
                    "anthropic SDK not installed; cannot parse receipt"
                ) from e
            if not os.environ.get("ANTHROPIC_API_KEY"):
                raise ReceiptIngestionError(
                    "ANTHROPIC_API_KEY env var not set"
                )
            self._anthropic_client = anthropic.Anthropic()
        return self._anthropic_client

    # ---------------------------- pipeline steps -----------------------------

    async def _google_ocr(self, image_bytes: bytes) -> Tuple[str, List[str]]:
        """Run Google Vision document_text_detection on raw image bytes.

        Returns (flattened_text, rows).

        `rows` are reconstructed from the word bounding boxes rather than from
        the flattened text. This is the fix for the pairing bug: reading
        `full_text_annotation.text` collapses the receipt's columns into
        reading order, which typically emits every item NAME as one block and
        every qty/rate/amount as another. Re-associating them is then pure
        inference, and it drifts — on a real receipt it attached the tea row's
        "1 UT 190.00" to the groundnuts above it.

        The geometry that encodes the true pairing is already in the response.
        Grouping words by vertical position recovers it deterministically, so
        the model never has to guess which numbers belong to which name.
        """
        def _sync():
            from google.cloud import vision  # type: ignore
            client = self._get_google_client()
            image = vision.Image(content=image_bytes)
            resp = client.document_text_detection(
                image=image,
                image_context={"language_hints": ["mr", "hi", "en"]},
            )
            if resp.error and resp.error.message:
                raise ReceiptIngestionError(f"Google Vision: {resp.error.message}")

            text = resp.full_text_annotation.text if resp.full_text_annotation else ""

            # text_annotations[0] is the whole block; [1:] are individual words
            # with bounding boxes.
            words = []
            for ann in list(resp.text_annotations or [])[1:]:
                verts = [(v.x, v.y) for v in ann.bounding_poly.vertices]
                if not verts:
                    continue
                ys = [v[1] for v in verts]
                xs = [v[0] for v in verts]
                words.append({
                    "text": ann.description,
                    "x": min(xs),
                    "y_top": min(ys),
                    "y_bottom": max(ys),
                    "y_mid": (min(ys) + max(ys)) / 2.0,
                })
            return text, group_words_into_rows(words)

        return await asyncio.to_thread(_sync)

    async def _claude_parse(self, ocr_text: str, prompt: str = None) -> Dict[str, Any]:
        """Pass OCR text + cached catalog to Claude; return structured JSON."""
        def _sync():
            client = self._get_anthropic_client()
            msg = client.messages.create(
                model=self._anthropic_model,
                max_tokens=4096,
                temperature=0,
                messages=[{
                    "role": "user",
                    "content": [
                        # Cached block — catalog is reused across receipts in the
                        # same window, so subsequent calls pay only ~10% of the
                        # catalog token cost.
                        {"type": "text",
                         "text": _CATALOG_TEXT,
                         "cache_control": {"type": "ephemeral"}},
                        {"type": "text",
                         "text": (prompt or CLAUDE_PARSE_PROMPT) + ocr_text},
                    ],
                }],
            )
            text = "".join(b.text for b in msg.content if hasattr(b, "text"))
            cleaned = text.strip().lstrip("`").rstrip("`")
            if cleaned.startswith("json"):
                cleaned = cleaned[4:].strip()
            return json.loads(cleaned)
        try:
            return await asyncio.to_thread(_sync)
        except json.JSONDecodeError as e:
            raise ReceiptIngestionError(f"Claude returned non-JSON: {e}") from e

    def _apply_fuzzy_fallback(self, parsed: Dict[str, Any]) -> Dict[str, Any]:
        """Salvage items Claude marked `unmatched` via rapidfuzz on aliases."""
        for item in parsed.get("items", []) or []:
            if item.get("match_confidence") != "unmatched":
                continue
            name = item.get("name_devanagari") or ""
            canonical, score = to_canonical_en_fuzzy(name, min_score=80)
            if canonical:
                item["name_canonical_en"] = canonical
                item["match_confidence"] = "low"  # always low — user must confirm
                item["_fuzzy_score"] = score
        return parsed

    # ------------------------------- public ----------------------------------

    async def process_receipt(self, image_bytes: bytes) -> Dict[str, Any]:
        """End-to-end pipeline. Returns the structured items + raw OCR text.

        The `_raw_ocr_text` key in the response is for the audit log; callers
        should pop it before returning to the client.

        Raises ReceiptIngestionError on any pipeline failure with a
        user-presentable message.
        """
        if not image_bytes:
            raise ReceiptIngestionError("Empty image payload")

        ocr_text, rows = await self._google_ocr(image_bytes)
        if not ocr_text.strip():
            raise ReceiptIngestionError(
                "OCR returned no text. The image may be too blurry or low-contrast."
            )

        # Prefer the geometry-aligned rows. Fall back to the flattened text
        # when reconstruction produced implausibly few lines — a receipt has
        # far more rows than this, so a small count means the word boxes were
        # unusable (odd angle, heavy skew) and the rows would be worse than
        # the flattened text rather than better.
        if len(rows) >= 5:
            payload = "\n".join(rows)
            prompt = ROW_ALIGNED_PARSE_PROMPT
            logger.info("Receipt parsed from %d geometry-aligned rows", len(rows))
        else:
            payload = ocr_text
            prompt = CLAUDE_PARSE_PROMPT
            logger.warning(
                "Row reconstruction yielded only %d rows; falling back to flattened OCR text",
                len(rows),
            )

        parsed = await self._claude_parse(payload, prompt)
        if not isinstance(parsed, dict) or "items" not in parsed:
            raise ReceiptIngestionError("Claude did not return the expected JSON shape")

        parsed = self._apply_fuzzy_fallback(parsed)
        parsed["_raw_ocr_text"] = ocr_text
        return parsed
