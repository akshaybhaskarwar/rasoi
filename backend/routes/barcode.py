"""
Barcode and OCR routes for Rasoi-Sync

The /ocr/extract endpoint uses a Google Vision + Claude text-only hybrid:
  1. Google Vision document_text_detection runs on the raw image bytes.
     1000 calls/month free; reuses GOOGLE_APPLICATION_CREDENTIALS already
     set up for receipt scanning.
  2. For product_name, the OCR text (a wall of product packaging text) is
     sent to Claude Haiku (TEXT ONLY — no vision tokens) with a tiny prompt
     that picks out the actual product name. Costs ~Rs 0.05 per call.
  3. For expiry_date, a regex finds the date pattern directly in the OCR
     text. Free.

Earlier this endpoint used emergentintegrations.llm.chat (Emergent platform's
GPT-4o wrapper). Removed when the project moved off Emergent; the import
became dead code and every /ocr/extract call returned 500.
"""
import asyncio
import logging
import os
import re

import httpx
from fastapi import APIRouter, HTTPException

from data.categories import guess_category
from models.common import OCRRequest

logger = logging.getLogger(__name__)

barcode_router = APIRouter(prefix="/api", tags=["Barcode"])


# Cached client instances — lazily initialized on first call so the module
# imports cleanly even if credentials are misconfigured.
_anthropic_client = None
_google_vision_client = None


def _get_google_vision_client():
    global _google_vision_client
    if _google_vision_client is None:
        if not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
            raise HTTPException(
                status_code=500,
                detail="OCR unavailable: GOOGLE_APPLICATION_CREDENTIALS env var not set",
            )
        try:
            from google.cloud import vision  # type: ignore
        except ImportError as e:
            raise HTTPException(
                status_code=500,
                detail="OCR unavailable: google-cloud-vision not installed",
            ) from e
        _google_vision_client = vision.ImageAnnotatorClient()
    return _google_vision_client


def _get_anthropic_client():
    global _anthropic_client
    if _anthropic_client is None:
        if not os.environ.get("ANTHROPIC_API_KEY"):
            raise HTTPException(
                status_code=500,
                detail="OCR unavailable: ANTHROPIC_API_KEY env var not set",
            )
        try:
            import anthropic  # type: ignore
        except ImportError as e:
            raise HTTPException(
                status_code=500,
                detail="OCR unavailable: anthropic SDK not installed",
            ) from e
        _anthropic_client = anthropic.Anthropic()
    return _anthropic_client


# Keyword group that prefixes an expiry/best-before date on Indian packaging.
# Notably DOES NOT include "Mfg" — that means manufactured, not expiry.
_EXPIRY_KEYWORD = r"(?:exp(?:iry)?|best\s*before|use\s*by|bb)"

# Date-shaped patterns, searched in this order; first match wins.
#   1. "Exp 31/12/2025"     — keyword + DD/MM/YY(YY)
#   2. "Exp 12/2025"        — keyword + MM/YYYY (no day → last day of month)
#   3. "BB Dec 2025"        — keyword + month-name + year
#   4. "31/12/2025"         — bare DD/MM/YY(YY) anywhere (last-resort fallback)
_EXPIRY_DDMMYY = rf"{_EXPIRY_KEYWORD}\s*[:\.\-]?\s*(\d{{1,2}})[/\-\.](\d{{1,2}})[/\-\.](\d{{2,4}})"
_EXPIRY_MMYY = rf"{_EXPIRY_KEYWORD}\s*[:\.\-]?\s*(\d{{1,2}})[/\-\.](\d{{4}})"
_EXPIRY_MONYY = rf"{_EXPIRY_KEYWORD}\s*[:\.\-]?\s*([A-Za-z]{{3,9}})\s*[,\-\.]?\s*(\d{{2,4}})"
_BARE_DDMMYY = r"(\d{1,2})[/\-\.](\d{1,2})[/\-\.](\d{2,4})"

_MONTH_TO_NUM = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
    "january": 1, "february": 2, "march": 3, "april": 4, "june": 6,
    "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
}


def _parse_expiry_from_ocr_text(text: str) -> str | None:
    """Find an expiry-like date in OCR text. Returns 'YYYY-MM-DD' or None."""
    if not text:
        return None
    text_lower = text.lower()

    # 1. Exp DD/MM/YY(YY)
    m = re.search(_EXPIRY_DDMMYY, text_lower)
    if m:
        try:
            d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
            if y < 100:
                y += 2000
            if 1 <= mo <= 12 and 1 <= d <= 31 and 2000 <= y <= 2099:
                return f"{y:04d}-{mo:02d}-{d:02d}"
        except (ValueError, IndexError):
            pass

    # 2. Exp MM/YYYY  → last-day-of-month (28 is always safe)
    m = re.search(_EXPIRY_MMYY, text_lower)
    if m:
        try:
            mo, y = int(m.group(1)), int(m.group(2))
            if 1 <= mo <= 12 and 2000 <= y <= 2099:
                return f"{y:04d}-{mo:02d}-28"
        except (ValueError, IndexError):
            pass

    # 3. Exp Dec 2025  / BB January, 2026
    m = re.search(_EXPIRY_MONYY, text_lower)
    if m:
        try:
            mon_str = m.group(1).lower()
            yr = int(m.group(2))
            if yr < 100:
                yr += 2000
            mon_num = _MONTH_TO_NUM.get(mon_str)
            if mon_num and 2000 <= yr <= 2099:
                return f"{yr:04d}-{mon_num:02d}-28"
        except (ValueError, IndexError):
            pass

    # 4. Last-resort: bare DD/MM/YYYY anywhere in the text.
    m = re.search(_BARE_DDMMYY, text_lower)
    if m:
        try:
            d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
            if y < 100:
                y += 2000
            if 1 <= mo <= 12 and 1 <= d <= 31 and 2000 <= y <= 2099:
                return f"{y:04d}-{mo:02d}-{d:02d}"
        except (ValueError, IndexError):
            pass

    return None


PRODUCT_NAME_PROMPT = """\
Below is the raw OCR text extracted from a photo of a product package
in an Indian grocery shop. Your job: pick the single line that is the
PRODUCT NAME — the main product, like "Basmati Rice", "Turmeric Powder",
"Tata Salt", "MTR Sambar Masala", etc.

Rules:
  - Return only the product name, nothing else. No explanation, no
    bullet points, no JSON, no quotes.
  - Include the brand if visible (e.g., "Tata Salt", "MTR Rava Idli Mix")
  - Do NOT include weights, dates, ingredient lists, batch numbers, or
    "Net Wt" / "Mfg" / "Exp" lines.
  - If the OCR text genuinely doesn't contain a product name (it's a
    receipt, blank page, blurry, etc.), respond with exactly: NOT_FOUND

OCR text:
"""


def create_barcode_routes(db, emergent_llm_key: str = None):
    """Factory function to create barcode routes.

    The emergent_llm_key parameter is kept for backward compatibility but
    no longer used — OCR now runs through Google Vision + Anthropic Claude.
    """

    @barcode_router.get("/barcode/{barcode}")
    async def lookup_barcode(barcode: str):
        """Lookup product details from barcode using Open Food Facts API"""
        try:
            async with httpx.AsyncClient() as client:
                url = f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json"
                response = await client.get(url, timeout=10.0)
                data = response.json()
                
                if data.get('status') == 1 and data.get('product'):
                    product = data['product']
                    
                    return {
                        "found": True,
                        "barcode": barcode,
                        "name": product.get('product_name', product.get('product_name_en', '')),
                        "brand": product.get('brands', ''),
                        "category": product.get('categories', '').split(',')[0].strip() if product.get('categories') else 'other',
                        "quantity": product.get('quantity', ''),
                        "image_url": product.get('image_url', ''),
                        "ingredients": product.get('ingredients_text', ''),
                        "nutriscore": product.get('nutriscore_grade', ''),
                        "raw_data": {
                            "categories_tags": product.get('categories_tags', [])[:5],
                            "labels": product.get('labels', '')
                        }
                    }
                else:
                    return {
                        "found": False,
                        "barcode": barcode,
                        "message": "Product not found in database"
                    }
                    
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="Request to Open Food Facts timed out")
        except Exception as e:
            logger.error(f"Barcode lookup error: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @barcode_router.post("/ocr/extract")
    async def extract_text_from_image(request: OCRRequest):
        """Extract product name or expiry date from a packaging photo.

        Pipeline:
          - Google Vision document_text_detection (cheap; 1000/mo free)
          - For product_name: Claude Haiku text-only picks the product name
            from the raw OCR (~Rs 0.05/call)
          - For expiry_date: regex on the OCR text (free)
        """
        if not request.image_base64:
            raise HTTPException(status_code=400, detail="image_base64 is required")

        # --- 1. Google Vision OCR -----------------------------------------
        try:
            import base64
            image_bytes = base64.b64decode(request.image_base64)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid base64 image: {e}")

        def _run_google_ocr() -> str:
            from google.cloud import vision  # type: ignore
            client = _get_google_vision_client()
            image = vision.Image(content=image_bytes)
            resp = client.document_text_detection(
                image=image,
                image_context={"language_hints": ["en", "mr", "hi"]},
            )
            if resp.error and resp.error.message:
                raise HTTPException(status_code=502,
                                    detail=f"Google Vision: {resp.error.message}")
            return resp.full_text_annotation.text if resp.full_text_annotation else ""

        try:
            ocr_text = await asyncio.to_thread(_run_google_ocr)
        except HTTPException:
            raise
        except Exception as e:
            logger.exception("Google Vision OCR failed")
            raise HTTPException(status_code=502, detail=f"OCR failed: {e}")

        if not ocr_text.strip():
            return {
                "success": False,
                "ocr_type": request.ocr_type,
                "result": None,
                "message": "Could not read any text from the image",
            }

        # --- 2a. Expiry date — regex on OCR text --------------------------
        if request.ocr_type == "expiry_date":
            iso_date = _parse_expiry_from_ocr_text(ocr_text)
            if iso_date:
                return {
                    "success": True,
                    "ocr_type": "expiry_date",
                    "result": iso_date,
                }
            return {
                "success": False,
                "ocr_type": "expiry_date",
                "result": None,
                "message": "Could not find an expiry/best-before date in the image",
            }

        # --- 2b. Product name — Claude Haiku text-only --------------------
        def _run_claude_pick_name() -> str:
            client = _get_anthropic_client()
            msg = client.messages.create(
                model="claude-haiku-4-5",
                max_tokens=64,
                temperature=0,
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": PRODUCT_NAME_PROMPT + ocr_text},
                    ],
                }],
            )
            text = "".join(b.text for b in msg.content if hasattr(b, "text"))
            return text.strip().strip('"').strip("'").strip()

        try:
            product_name = await asyncio.to_thread(_run_claude_pick_name)
        except HTTPException:
            raise
        except Exception as e:
            logger.exception("Claude product-name disambiguation failed")
            # Fall back to "longest line in OCR text" as best-effort. Less
            # accurate but better than 500-erroring the user.
            candidates = [ln.strip() for ln in ocr_text.splitlines() if ln.strip()]
            product_name = max(candidates, key=len) if candidates else "NOT_FOUND"

        if not product_name or product_name == "NOT_FOUND":
            return {
                "success": False,
                "ocr_type": "product_name",
                "result": None,
                "message": "Could not identify a product name in the image",
            }

        logger.info(f"OCR Result (product_name): {product_name}")
        return {
            "success": True,
            "ocr_type": "product_name",
            "result": product_name,
            "suggested_category": guess_category(product_name),
        }

    return barcode_router
