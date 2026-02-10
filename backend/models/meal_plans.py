"""
Meal planning models for Rasoi-Sync
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid


class MealPlan(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    household_id: Optional[str] = None
    date: str
    meal_type: str = "lunch"  # breakfast, lunch, snacks, dinner
    meal_name: str
    youtube_video_id: Optional[str] = None
    youtube_thumbnail: Optional[str] = None
    youtube_title: Optional[str] = None
    youtube_channel: Optional[str] = None
    ingredients_needed: List[str] = []
    reserved_ingredients: List[Dict[str, Any]] = []
    serving_size: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MealPlanCreate(BaseModel):
    date: str
    meal_type: str
    meal_name: str
    youtube_video_id: Optional[str] = None
    youtube_thumbnail: Optional[str] = None
    youtube_channel: Optional[str] = None
    ingredients_needed: List[str] = []
    reserved_ingredients: List[Dict[str, Any]] = []
    serving_size: Optional[str] = "family_4"


class PrepareMealPlanRequest(BaseModel):
    video_id: str
    video_title: str
    video_thumbnail: str = ""
    channel_name: str = ""
    matched_ingredients: List[str] = []


# Serving size multipliers for quantity estimation
SERVING_MULTIPLIERS = {
    "single": 0.25,
    "couple": 0.5,
    "family_4": 1.0,
    "party": 2.0
}


# Default quantities per serving (family of 4) for common ingredients
DEFAULT_INGREDIENT_QUANTITIES = {
    # Grains & Flour
    "rice": {"qty": 400, "unit": "g"},
    "atta": {"qty": 500, "unit": "g"},
    "wheat flour": {"qty": 500, "unit": "g"},
    "basmati rice": {"qty": 400, "unit": "g"},
    "rava": {"qty": 200, "unit": "g"},
    "semolina": {"qty": 200, "unit": "g"},
    "poha": {"qty": 300, "unit": "g"},
    "maida": {"qty": 250, "unit": "g"},
    "besan": {"qty": 200, "unit": "g"},
    
    # Pulses
    "dal": {"qty": 200, "unit": "g"},
    "toor dal": {"qty": 200, "unit": "g"},
    "moong dal": {"qty": 150, "unit": "g"},
    "chana dal": {"qty": 150, "unit": "g"},
    "urad dal": {"qty": 100, "unit": "g"},
    "masoor dal": {"qty": 150, "unit": "g"},
    "rajma": {"qty": 200, "unit": "g"},
    "chole": {"qty": 200, "unit": "g"},
    "chickpeas": {"qty": 200, "unit": "g"},
    
    # Vegetables
    "potato": {"qty": 500, "unit": "g"},
    "onion": {"qty": 300, "unit": "g"},
    "tomato": {"qty": 300, "unit": "g"},
    "cauliflower": {"qty": 500, "unit": "g"},
    "capsicum": {"qty": 200, "unit": "g"},
    "carrot": {"qty": 200, "unit": "g"},
    "peas": {"qty": 150, "unit": "g"},
    "spinach": {"qty": 250, "unit": "g"},
    "palak": {"qty": 250, "unit": "g"},
    "methi": {"qty": 100, "unit": "g"},
    "bhindi": {"qty": 250, "unit": "g"},
    "brinjal": {"qty": 300, "unit": "g"},
    "cabbage": {"qty": 300, "unit": "g"},
    "beans": {"qty": 200, "unit": "g"},
    "gourd": {"qty": 400, "unit": "g"},
    "pumpkin": {"qty": 400, "unit": "g"},
    "beetroot": {"qty": 200, "unit": "g"},
    "radish": {"qty": 200, "unit": "g"},
    
    # Dairy
    "milk": {"qty": 500, "unit": "ml"},
    "curd": {"qty": 200, "unit": "ml"},
    "yogurt": {"qty": 200, "unit": "ml"},
    "paneer": {"qty": 250, "unit": "g"},
    "butter": {"qty": 50, "unit": "g"},
    "ghee": {"qty": 30, "unit": "ml"},
    "cream": {"qty": 100, "unit": "ml"},
    "cheese": {"qty": 100, "unit": "g"},
    
    # Spices
    "turmeric": {"qty": 5, "unit": "g"},
    "cumin": {"qty": 5, "unit": "g"},
    "coriander": {"qty": 10, "unit": "g"},
    "red chili": {"qty": 5, "unit": "g"},
    "garam masala": {"qty": 10, "unit": "g"},
    "mustard": {"qty": 5, "unit": "g"},
    "curry leaves": {"qty": 10, "unit": "pcs"},
    
    # Oils
    "oil": {"qty": 50, "unit": "ml"},
    "coconut oil": {"qty": 30, "unit": "ml"},
    
    # Others
    "egg": {"qty": 4, "unit": "pcs"},
    "bread": {"qty": 8, "unit": "pcs"},
    "pav": {"qty": 8, "unit": "pcs"},
    "coconut": {"qty": 1, "unit": "pcs"},
    "sugar": {"qty": 50, "unit": "g"},
    "salt": {"qty": 10, "unit": "g"},
    "ginger": {"qty": 20, "unit": "g"},
    "garlic": {"qty": 20, "unit": "g"},
    "green chili": {"qty": 4, "unit": "pcs"},
}
