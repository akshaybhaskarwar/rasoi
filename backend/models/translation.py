"""
Translation models for Rasoi-Sync
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Dict, Optional
from datetime import datetime, timezone
import uuid


class TranslationRequest(BaseModel):
    text: str
    source_language: str = "en"
    target_languages: List[str]


class TranslationVerifyRequest(BaseModel):
    source_text: str
    target_language: str
    translated_text: str


class TranslationEditRequest(BaseModel):
    source_text: str
    target_language: str
    custom_label: str


class TranslationEntry(BaseModel):
    """Model for translation cache entries with verification status"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    source_text: str
    source_language: str = "en"
    target_language: str
    translated_text: str
    is_ai_generated: bool = True
    user_verified: bool = False
    user_verified_count: int = 0
    community_verified: bool = False
    custom_labels: Dict[str, str] = {}
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
