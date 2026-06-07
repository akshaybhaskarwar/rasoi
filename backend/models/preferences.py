"""
User preferences models for Rasoi-Sync
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import List
from datetime import datetime, timezone
import uuid


class FavoriteChannel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str


class UserPreferences(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    favorite_channels: List[FavoriteChannel] = []
    defaults_seeded: bool = False
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
