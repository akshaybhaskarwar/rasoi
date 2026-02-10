"""
Barcode and OCR routes for Rasoi-Sync
"""
from fastapi import APIRouter, HTTPException
import httpx
import re
import uuid
import os
import logging

from models.common import OCRRequest
from data.categories import guess_category

logger = logging.getLogger(__name__)

barcode_router = APIRouter(prefix="/api", tags=["Barcode"])


def create_barcode_routes(db, emergent_llm_key: str = None):
    """Factory function to create barcode routes"""
    
    llm_key = emergent_llm_key or os.environ.get('EMERGENT_LLM_KEY')

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
        """Use AI vision to extract product name or expiry date from image"""
        if not llm_key:
            raise HTTPException(status_code=500, detail="OCR service not configured")
        
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
            
            chat = LlmChat(
                api_key=llm_key,
                session_id=f"ocr-{uuid.uuid4()}",
                system_message="You are a precise OCR assistant that extracts text from product packaging images. Be concise and accurate."
            ).with_model("openai", "gpt-4o")
            
            if request.ocr_type == "product_name":
                prompt = """Look at this product packaging image and extract the PRODUCT NAME only.
                
                Rules:
                - Extract the main product name (e.g., "Ajwain", "Basmati Rice", "Turmeric Powder")
                - Include brand name if visible (e.g., "Diamond Ajwain", "Tata Salt")
                - Do NOT include descriptions, weights, or other details
                - If you see text like "Carom Seeds" or "Jeera" etc., include that as it helps identify the product
                - Respond with ONLY the product name, nothing else
                - If you cannot identify a product name, respond with "NOT_FOUND"
                """
            else:
                prompt = """Look at this product packaging image and extract the EXPIRY DATE or BEST BEFORE date.
                
                Rules:
                - Look for dates labeled as "Expiry", "Exp", "Best Before", "Use By", "BB"
                - Also look for any date stamps printed on the packaging
                - Common formats: DD-MMM-YY, DD/MM/YYYY, MMM YYYY
                - Respond in format: YYYY-MM-DD
                - If only month and year visible, use the last day of that month
                - If you cannot find an expiry date, respond with "NOT_FOUND"
                - Respond with ONLY the date in YYYY-MM-DD format, nothing else
                """
            
            image_content = ImageContent(image_base64=request.image_base64)
            user_message = UserMessage(text=prompt, file_contents=[image_content])
            
            response = await chat.send_message(user_message)
            result = response.strip()
            
            logger.info(f"OCR Result ({request.ocr_type}): {result}")
            
            if result == "NOT_FOUND":
                return {
                    "success": False,
                    "ocr_type": request.ocr_type,
                    "result": None,
                    "message": f"Could not extract {request.ocr_type.replace('_', ' ')} from image"
                }
            
            if request.ocr_type == "product_name":
                suggested_category = guess_category(result)
                return {
                    "success": True,
                    "ocr_type": request.ocr_type,
                    "result": result,
                    "suggested_category": suggested_category
                }
            
            if request.ocr_type == "expiry_date":
                date_match = re.search(r'(\d{4})-(\d{2})-(\d{2})', result)
                if date_match:
                    result = date_match.group(0)
                else:
                    return {
                        "success": False,
                        "ocr_type": request.ocr_type,
                        "result": result,
                        "message": "Date format not recognized"
                    }
            
            return {
                "success": True,
                "ocr_type": request.ocr_type,
                "result": result
            }
            
        except Exception as e:
            logger.error(f"OCR extraction error: {e}")
            raise HTTPException(status_code=500, detail=f"OCR failed: {str(e)}")

    return barcode_router
