"""
User preferences models for Rasoi-Sync
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import List
from datetime import datetime, timezone
import uuid


class UserPreferences(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    favorite_channels: List[str] = []
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
