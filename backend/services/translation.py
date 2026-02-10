"""
Translation Service for Rasoi-Sync
Handles Google Translate API calls with caching and verification
"""
import logging
import re
import uuid
import httpx
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from data.translations import TRANSLATIONS

logger = logging.getLogger(__name__)

# Community verification threshold
COMMUNITY_VERIFY_THRESHOLD = 100


class TranslationService:
    """Service for handling translations with caching and verification"""
    
    def __init__(self, db, google_translate_api_key: str, log_api_usage_func=None):
        self.db = db
        self.api_key = google_translate_api_key
        self.log_api_usage = log_api_usage_func
    
    async def google_translate_api(
        self,
        text: str,
        target_lang: str,
        source_lang: str = "en",
        household_id: str = None,
        user_id: str = None
    ) -> Optional[str]:
        """Call Google Cloud Translation API v3"""
        if not self.api_key:
            logger.warning("Google Translate API key not configured")
            return None
        
        lang_map = {"hi": "hi", "mr": "mr", "en": "en"}
        google_target = lang_map.get(target_lang, target_lang)
        
        url = "https://translation.googleapis.com/language/translate/v2"
        params = {
            "key": self.api_key,
            "q": text,
            "target": google_target,
            "source": source_lang,
            "format": "text"
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, params=params, timeout=10.0)
                response.raise_for_status()
                data = response.json()
                
                # Log API usage
                if self.log_api_usage:
                    char_count = len(text)
                    await self.log_api_usage(
                        self.db, "translation", "translate",
                        char_count, household_id, user_id
                    )
                
                if data.get("data", {}).get("translations"):
                    return data["data"]["translations"][0]["translatedText"]
                return None
        except Exception as e:
            logger.error(f"Google Translate API error: {e}")
            return None
    
    async def translate_text(
        self,
        text: str,
        target_lang: str,
        user_id: str = None,
        household_id: str = None
    ) -> Dict[str, Any]:
        """
        Translate text with caching and verification
        Returns: {translated_text, is_ai_generated, user_verified, community_verified, custom_label}
        """
        try:
            text_normalized = text.strip()
            
            # Check for existing translation in cache
            cached = await self.db.translations.find_one({
                "source_text": {"$regex": f"^{re.escape(text_normalized)}$", "$options": "i"},
                "target_language": target_lang
            })
            
            if cached:
                custom_label = None
                if user_id and cached.get("custom_labels", {}).get(user_id):
                    custom_label = cached["custom_labels"][user_id]
                
                return {
                    "translated_text": custom_label or cached["translated_text"],
                    "is_ai_generated": cached.get("is_ai_generated", True),
                    "user_verified": cached.get("user_verified", False),
                    "community_verified": cached.get("community_verified", False),
                    "user_verified_count": cached.get("user_verified_count", 0),
                    "custom_label": custom_label
                }
            
            # Try static translations first (pre-verified)
            text_lower = text_normalized.lower()
            static_translation = TRANSLATIONS.get(target_lang, {}).get(text_lower)
            
            if static_translation:
                translation_doc = {
                    "id": str(uuid.uuid4()),
                    "source_text": text_normalized,
                    "source_language": "en",
                    "target_language": target_lang,
                    "translated_text": static_translation,
                    "is_ai_generated": False,
                    "user_verified": True,
                    "community_verified": True,
                    "user_verified_count": COMMUNITY_VERIFY_THRESHOLD,
                    "custom_labels": {},
                    "created_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc)
                }
                await self.db.translations.insert_one(translation_doc)
                
                return {
                    "translated_text": static_translation,
                    "is_ai_generated": False,
                    "user_verified": True,
                    "community_verified": True,
                    "user_verified_count": COMMUNITY_VERIFY_THRESHOLD,
                    "custom_label": None
                }
            
            # Call Google Translate API
            api_translation = await self.google_translate_api(
                text_normalized, target_lang,
                household_id=household_id, user_id=user_id
            )
            
            if api_translation:
                translation_doc = {
                    "id": str(uuid.uuid4()),
                    "source_text": text_normalized,
                    "source_language": "en",
                    "target_language": target_lang,
                    "translated_text": api_translation,
                    "is_ai_generated": True,
                    "user_verified": False,
                    "community_verified": False,
                    "user_verified_count": 0,
                    "custom_labels": {},
                    "created_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc)
                }
                await self.db.translations.insert_one(translation_doc)
                
                return {
                    "translated_text": api_translation,
                    "is_ai_generated": True,
                    "user_verified": False,
                    "community_verified": False,
                    "user_verified_count": 0,
                    "custom_label": None
                }
            
            # Fallback: return original text
            return {
                "translated_text": text_normalized,
                "is_ai_generated": False,
                "user_verified": False,
                "community_verified": False,
                "user_verified_count": 0,
                "custom_label": None
            }
                
        except Exception as e:
            logger.error(f"Translation error: {e}")
            return {
                "translated_text": text,
                "is_ai_generated": False,
                "user_verified": False,
                "community_verified": False,
                "user_verified_count": 0,
                "custom_label": None
            }
    
    async def translate_text_simple(self, text: str, target_lang: str) -> str:
        """Simple translate that returns just the text"""
        result = await self.translate_text(text, target_lang)
        return result["translated_text"]
