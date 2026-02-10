"""
Recipe models for Rasoi-Sync
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone
import uuid


class Recipe(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    youtube_url: str
    youtube_video_id: str
    youtube_thumbnail: Optional[str] = None
    ingredients: List[str] = []
    author: str = "Anonymous"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RecipeCreate(BaseModel):
    title: str
    youtube_url: str
    ingredients: List[str] = []
    author: str = "Anonymous"
