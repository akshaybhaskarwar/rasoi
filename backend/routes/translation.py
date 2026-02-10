"""
Translation routes for Rasoi-Sync
"""
from fastapi import APIRouter, HTTPException
from typing import List, Optional
from datetime import datetime, timezone
import re
import uuid
import logging

from models.translation import TranslationRequest, TranslationVerifyRequest, TranslationEditRequest

logger = logging.getLogger(__name__)

COMMUNITY_VERIFY_THRESHOLD = 100

translation_router = APIRouter(prefix="/api", tags=["Translation"])


def create_translation_routes(db, translate_service):
    """Factory function to create translation routes with database access"""

    @translation_router.post("/translate")
    async def translate(request: TranslationRequest):
        """Translate text to multiple languages with verification status"""
        translations = {}
        
        for target_lang in request.target_languages:
            result = await translate_service.translate_text(request.text, target_lang)
            translations[target_lang] = result
        
        return {
            "original_text": request.text,
            "source_language": request.source_language,
            "translations": translations
        }

    @translation_router.post("/translate/batch")
    async def translate_batch(texts: List[str], target_language: str = "hi", user_id: Optional[str] = None):
        """Batch translate multiple texts efficiently"""
        results = {}
        
        for text in texts:
            result = await translate_service.translate_text(text, target_language, user_id)
            results[text] = result
        
        return {
            "target_language": target_language,
            "translations": results
        }

    @translation_router.post("/translate/verify")
    async def verify_translation(request: TranslationVerifyRequest):
        """User verifies a translation as correct"""
        try:
            translation = await db.translations.find_one({
                "source_text": {"$regex": f"^{re.escape(request.source_text)}$", "$options": "i"},
                "target_language": request.target_language
            })
            
            if not translation:
                translation_doc = {
                    "id": str(uuid.uuid4()),
                    "source_text": request.source_text,
                    "source_language": "en",
                    "target_language": request.target_language,
                    "translated_text": request.translated_text,
                    "is_ai_generated": True,
                    "user_verified": True,
                    "community_verified": False,
                    "user_verified_count": 1,
                    "custom_labels": {},
                    "created_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc)
                }
                await db.translations.insert_one(translation_doc)
                return {"success": True, "message": "Translation verified", "community_verified": False}
            
            new_count = translation.get("user_verified_count", 0) + 1
            community_verified = new_count >= COMMUNITY_VERIFY_THRESHOLD
            
            await db.translations.update_one(
                {"_id": translation["_id"]},
                {
                    "$set": {
                        "user_verified": True,
                        "user_verified_count": new_count,
                        "community_verified": community_verified,
                        "updated_at": datetime.now(timezone.utc)
                    }
                }
            )
            
            return {
                "success": True,
                "message": "Translation verified" + (" (Community Gold!)" if community_verified else ""),
                "user_verified_count": new_count,
                "community_verified": community_verified
            }
            
        except Exception as e:
            logger.error(f"Verify translation error: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @translation_router.post("/translate/edit")
    async def edit_translation(request: TranslationEditRequest, user_id: str = "default_user"):
        """User provides custom translation"""
        try:
            translation = await db.translations.find_one({
                "source_text": {"$regex": f"^{re.escape(request.source_text)}$", "$options": "i"},
                "target_language": request.target_language
            })
            
            if translation:
                await db.translations.update_one(
                    {"_id": translation["_id"]},
                    {
                        "$set": {
                            f"custom_labels.{user_id}": request.custom_label,
                            "updated_at": datetime.now(timezone.utc)
                        }
                    }
                )
            else:
                translation_doc = {
                    "id": str(uuid.uuid4()),
                    "source_text": request.source_text,
                    "source_language": "en",
                    "target_language": request.target_language,
                    "translated_text": request.custom_label,
                    "is_ai_generated": False,
                    "user_verified": True,
                    "community_verified": False,
                    "user_verified_count": 1,
                    "custom_labels": {user_id: request.custom_label},
                    "created_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc)
                }
                await db.translations.insert_one(translation_doc)
            
            return {
                "success": True,
                "message": "Custom translation saved (Dadi's choice!)",
                "custom_label": request.custom_label
            }
            
        except Exception as e:
            logger.error(f"Edit translation error: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @translation_router.get("/translate/community-verified")
    async def get_community_verified_translations(target_language: str = "hi"):
        """Get all community-verified translations"""
        try:
            translations = await db.translations.find(
                {
                    "target_language": target_language,
                    "community_verified": True
                },
                {"_id": 0}
            ).to_list(1000)
            
            return {
                "language": target_language,
                "count": len(translations),
                "translations": translations
            }
        except Exception as e:
            logger.error(f"Get community translations error: {e}")
            return {"language": target_language, "count": 0, "translations": []}

    return translation_router
