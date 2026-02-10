"""
Common/shared models for Rasoi-Sync
"""
from pydantic import BaseModel
from typing import List


class FestivalAlert(BaseModel):
    date: str
    name: str
    message: str
    ingredients_needed: List[str] = []
    ingredients_in_stock: List[str] = []


class OCRRequest(BaseModel):
    image_base64: str
    ocr_type: str  # "product_name" or "expiry_date"


class YouTubeSearchRequest(BaseModel):
    ingredients: List[str] = []
    text_query: str = ""
    max_results: int = 10


class YouTubeVideoSubmission(BaseModel):
    youtube_url: str
