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
from typing import Any, Dict

from data.pantry_items import PANTRY_TEMPLATE, to_canonical_en_fuzzy

logger = logging.getLogger(__name__)


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

    async def _google_ocr(self, image_bytes: bytes) -> str:
        """Run Google Vision document_text_detection on raw image bytes."""
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
            return resp.full_text_annotation.text if resp.full_text_annotation else ""
        return await asyncio.to_thread(_sync)

    async def _claude_parse(self, ocr_text: str) -> Dict[str, Any]:
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
                         "text": CLAUDE_PARSE_PROMPT + ocr_text},
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

        ocr_text = await self._google_ocr(image_bytes)
        if not ocr_text.strip():
            raise ReceiptIngestionError(
                "OCR returned no text. The image may be too blurry or low-contrast."
            )

        parsed = await self._claude_parse(ocr_text)
        if not isinstance(parsed, dict) or "items" not in parsed:
            raise ReceiptIngestionError("Claude did not return the expected JSON shape")

        parsed = self._apply_fuzzy_fallback(parsed)
        parsed["_raw_ocr_text"] = ocr_text
        return parsed
