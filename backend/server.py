from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from google.cloud import translate_v2 as translate
import google.auth
import httpx  # For Open Food Facts API
import re

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# API Keys
YOUTUBE_API_KEY = os.environ.get('YOUTUBE_API_KEY')
EMERGENT_API_KEY = os.environ.get('EMERGENT_API_KEY')
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')
GOOGLE_TRANSLATE_API_KEY = os.environ.get('GOOGLE_TRANSLATE_API_KEY', 'AIzaSyA3FWsJ4zdvXIm34KN3nWZKfDzsGnXc6FY')

# Supported languages for translation
SUPPORTED_LANGUAGES = {
    "en": {"name": "English", "native": "English"},
    "hi": {"name": "Hindi", "native": "हिन्दी"},
    "mr": {"name": "Marathi", "native": "मराठी"}
}

# Community verification threshold
COMMUNITY_VERIFY_THRESHOLD = 100

# Create the main app
app = FastAPI(title="Rasoi-Sync API")
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============ MODELS ============

class InventoryItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name_en: str
    name_hi: Optional[str] = None  # Hindi translation
    name_mr: Optional[str] = None  # Marathi translation
    category: str
    stock_level: str = "empty"  # empty, low, half, full
    freshness: Optional[int] = None  # 0-100 for perishables
    is_secret_stash: bool = False
    unit: str = "kg"
    expiry_date: Optional[str] = None  # ISO date string YYYY-MM-DD
    barcode: Optional[str] = None  # Product barcode if scanned
    monthly_quantity: Optional[int] = None  # Monthly usage quantity (numeric)
    monthly_unit: Optional[str] = None  # Unit for monthly quantity (g, kg, ml, L, pcs)
    reserved_for: List[Dict[str, Any]] = []  # [{meal_plan_id, date, meal_type, qty, unit}]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class InventoryItemCreate(BaseModel):
    name_en: str
    name_mr: Optional[str] = None  # Accept Marathi name directly
    category: str
    stock_level: str = "empty"
    freshness: Optional[int] = None
    is_secret_stash: bool = False
    unit: str = "kg"
    expiry_date: Optional[str] = None  # ISO date string YYYY-MM-DD
    barcode: Optional[str] = None  # Product barcode if scanned
    monthly_quantity: Optional[int] = None  # Monthly usage quantity (numeric)
    monthly_unit: Optional[str] = None  # Unit for monthly quantity (g, kg, ml, L, pcs)

# Default monthly quantities by category
DEFAULT_MONTHLY_QUANTITIES = {
    'grains': {'quantity': 5, 'unit': 'kg', 'step': 1000},  # 5 kg, step 1 kg
    'pulses': {'quantity': 500, 'unit': 'g', 'step': 250},  # 500 g, step 250 g
    'spices': {'quantity': 100, 'unit': 'g', 'step': 50},   # 100 g, step 50 g
    'dairy': {'quantity': 5, 'unit': 'L', 'step': 500},     # 5 L, step 500 ml
    'oils': {'quantity': 1, 'unit': 'L', 'step': 250},      # 1 L, step 250 ml
    'bakery': {'quantity': 2, 'unit': 'pcs', 'step': 1},    # 2 packs, step 1
    'snacks': {'quantity': 500, 'unit': 'g', 'step': 100},  # 500 g, step 100 g
    'beverages': {'quantity': 500, 'unit': 'g', 'step': 100}, # 500 g, step 100 g
    'vegetables': {'quantity': 2, 'unit': 'kg', 'step': 500}, # 2 kg, step 500 g
    'fruits': {'quantity': 2, 'unit': 'kg', 'step': 500},   # 2 kg, step 500 g
    'fasting': {'quantity': 500, 'unit': 'g', 'step': 100}, # 500 g, step 100 g
    'other': {'quantity': 1, 'unit': 'kg', 'step': 250}     # 1 kg, step 250 g
}

class ShoppingItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name_en: str
    name_hi: Optional[str] = None  # Hindi translation
    name_mr: Optional[str] = None  # Marathi translation
    category: str
    quantity: str
    stock_level: Optional[str] = None  # empty, low - synced from inventory
    monthly_quantity: Optional[str] = None  # e.g., "2 kg", "500 g", "1 L"
    store_type: str = "grocery"  # grocery or mandi
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ShoppingItemCreate(BaseModel):
    name_en: str
    name_mr: Optional[str] = None  # Accept Marathi name directly
    name_hi: Optional[str] = None  # Accept Hindi name directly
    category: str
    quantity: str
    stock_level: Optional[str] = None  # empty, low - synced from inventory
    monthly_quantity: Optional[str] = None  # e.g., "2 kg", "500 g", "1 L"
    store_type: str = "grocery"

class MealPlan(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str
    meal_type: str = "lunch"  # breakfast, lunch, snacks, dinner - default for legacy data
    meal_name: str
    youtube_video_id: Optional[str] = None
    youtube_thumbnail: Optional[str] = None
    youtube_title: Optional[str] = None
    youtube_channel: Optional[str] = None
    ingredients_needed: List[str] = []
    reserved_ingredients: List[Dict[str, Any]] = []  # [{item_id, item_name, est_qty, unit}]
    serving_size: Optional[str] = None  # "single", "couple", "family_4", "party"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MealPlanCreate(BaseModel):
    date: str
    meal_type: str  # breakfast, lunch, snacks, dinner
    meal_name: str
    youtube_video_id: Optional[str] = None
    youtube_thumbnail: Optional[str] = None
    youtube_channel: Optional[str] = None
    ingredients_needed: List[str] = []
    reserved_ingredients: List[Dict[str, Any]] = []  # [{item_id, item_name, est_qty, unit}]
    serving_size: Optional[str] = "family_4"

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

class UserPreferences(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    favorite_channels: List[str] = []  # List of channel names/IDs
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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
    user_verified_count: int = 0  # For community verification
    community_verified: bool = False  # True when count >= 100
    custom_labels: Dict[str, str] = {}  # user_id -> custom_label
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class FestivalAlert(BaseModel):
    date: str
    name: str
    message: str
    ingredients_needed: List[str] = []
    ingredients_in_stock: List[str] = []

# ============ GOOGLE TRANSLATION API SERVICE ============

async def google_translate_api(text: str, target_lang: str, source_lang: str = "en") -> Optional[str]:
    """
    Call Google Cloud Translation API v3 (Basic/Advanced)
    Uses REST API with API key authentication
    """
    if not GOOGLE_TRANSLATE_API_KEY:
        logger.warning("Google Translate API key not configured")
        return None
    
    # Map our language codes to Google's
    lang_map = {"hi": "hi", "mr": "mr", "en": "en"}
    google_target = lang_map.get(target_lang, target_lang)
    
    url = f"https://translation.googleapis.com/language/translate/v2"
    params = {
        "key": GOOGLE_TRANSLATE_API_KEY,
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
            
            if data.get("data", {}).get("translations"):
                return data["data"]["translations"][0]["translatedText"]
            return None
    except Exception as e:
        logger.error(f"Google Translate API error: {e}")
        return None

# ============ TRANSLATION SERVICE ============

# Static translations for common ingredients (pre-verified, community gold)
TRANSLATIONS = {
    "hi": {
        "turmeric": "हल्दी",
        "turmeric powder": "हल्दी पाउडर",
        "rice": "चावल",
        "wheat": "गेहूं",
        "dal": "दाल",
        "tuvar dal": "तुवर दाल",
        "moong dal": "मूंग दाल",
        "chana dal": "चना दाल",
        "urad dal": "उड़द दाल",
        "masoor dal": "मसूर दाल",
        "salt": "नमक",
        "sugar": "चीनी",
        "jaggery": "गुड़",
        "oil": "तेल",
        "ghee": "घी",
        "milk": "दूध",
        "curd": "दही",
        "paneer": "पनीर",
        "onion": "प्याज",
        "garlic": "लहसुन",
        "ginger": "अदरक",
        "tomato": "टमाटर",
        "potato": "आलू",
        "carrot": "गाजर",
        "cumin": "जीरा",
        "coriander": "धनिया",
        "chili": "मिर्च",
        "green chili": "हरी मिर्च",
        "red chili": "लाल मिर्च",
        "sesame": "तिल",
        "til": "तिल",
        "peanuts": "मूंगफली",
        "mustard seeds": "राई",
        "fenugreek": "मेथी",
        "asafoetida": "हींग",
        "bay leaf": "तेज पत्ता",
        "cinnamon": "दालचीनी",
        "cardamom": "इलायची",
        "cloves": "लौंग",
        "black pepper": "काली मिर्च",
        "garam masala": "गरम मसाला",
        "spinach": "पालक",
        "cauliflower": "फूलगोभी",
        "cabbage": "पत्तागोभी",
        "peas": "मटर",
        "beans": "फलियाँ",
        "brinjal": "बैंगन",
        "capsicum": "शिमला मिर्च",
        "cucumber": "खीरा",
        "bitter gourd": "करेला",
        "bottle gourd": "लौकी",
        "lady finger": "भिंडी",
        "okra": "भिंडी",
        "coconut": "नारियल",
        "lemon": "नींबू",
        "mango": "आम",
        "banana": "केला",
        "apple": "सेब",
        "flour": "आटा",
        "bread": "ब्रेड",
        "butter": "मक्खन",
        "egg": "अंडा",
        "chicken": "मुर्गी",
        "mutton": "मटन",
        "fish": "मछली"
    },
    "mr": {
        "turmeric": "हळद",
        "turmeric powder": "हळद पावडर",
        "rice": "तांदूळ",
        "wheat": "गहू",
        "dal": "डाळ",
        "tuvar dal": "तूर डाळ",
        "moong dal": "मूग डाळ",
        "chana dal": "चणा डाळ",
        "urad dal": "उडीद डाळ",
        "masoor dal": "मसूर डाळ",
        "salt": "मीठ",
        "sugar": "साखर",
        "jaggery": "गूळ",
        "oil": "तेल",
        "ghee": "तूप",
        "milk": "दूध",
        "curd": "दही",
        "paneer": "पनीर",
        "onion": "कांदा",
        "garlic": "लसूण",
        "ginger": "आले",
        "tomato": "टोमॅटो",
        "potato": "बटाटा",
        "carrot": "गाजर",
        "cumin": "जिरे",
        "coriander": "धणे",
        "chili": "मिरची",
        "green chili": "हिरवी मिरची",
        "red chili": "लाल मिरची",
        "sesame": "तीळ",
        "til": "तीळ",
        "peanuts": "शेंगदाणे",
        "mustard seeds": "मोहरी",
        "fenugreek": "मेथी",
        "asafoetida": "हिंग",
        "bay leaf": "तमालपत्र",
        "cinnamon": "दालचिनी",
        "cardamom": "वेलदोडा",
        "cloves": "लवंग",
        "black pepper": "काळी मिरी",
        "garam masala": "गरम मसाला",
        "spinach": "पालक",
        "cauliflower": "फुलकोबी",
        "cabbage": "कोबी",
        "peas": "वाटाणे",
        "beans": "शेंगा",
        "brinjal": "वांगी",
        "capsicum": "ढोबळी मिरची",
        "cucumber": "काकडी",
        "bitter gourd": "कारले",
        "bottle gourd": "दुधी भोपळा",
        "lady finger": "भेंडी",
        "okra": "भेंडी",
        "coconut": "नारळ",
        "lemon": "लिंबू",
        "mango": "आंबा",
        "banana": "केळे",
        "apple": "सफरचंद",
        "flour": "पीठ",
        "bread": "पाव",
        "butter": "लोणी",
        "egg": "अंडे",
        "chicken": "कोंबडी",
        "mutton": "मटण",
        "fish": "मासे"
    }
}

# ============ LOCAL RECIPE DATABASE ============
# Pre-built Indian recipes for ingredient-based search (no API dependency)

RECIPE_DATABASE = [
    {
        "id": "veg-pulao-1",
        "title": "Vegetable Pulao",
        "title_mr": "भाजी पुलाव",
        "source": "Madhura's Recipe Marathi",
        "type": "video",
        "video_id": "4xzt4Itmp2U",
        "thumbnail": "https://i.ytimg.com/vi/4xzt4Itmp2U/hqdefault.jpg",
        "ingredients": ["Basmati Rice", "Onion", "Potato", "Peas", "Carrot", "Garam Masala", "Ghee"],
        "prep_time": "15 min",
        "cook_time": "25 min",
        "servings": 4,
        "category": "Main Course"
    },
    {
        "id": "dal-tadka-1",
        "title": "Dal Tadka",
        "title_mr": "दाल तडका",
        "source": "Ranveer Brar",
        "type": "video",
        "video_id": "NF7Eo30RBDA",
        "thumbnail": "https://i.ytimg.com/vi/NF7Eo30RBDA/hqdefault.jpg",
        "ingredients": ["Toor Dal", "Onion", "Tomato", "Garlic", "Cumin", "Turmeric", "Red Chili", "Ghee"],
        "prep_time": "10 min",
        "cook_time": "30 min",
        "servings": 4,
        "category": "Main Course"
    },
    {
        "id": "aloo-gobi-1",
        "title": "Aloo Gobi",
        "title_mr": "आलू गोबी",
        "source": "Kabita's Kitchen",
        "type": "video",
        "video_id": "JbOymPOMFbU",
        "thumbnail": "https://i.ytimg.com/vi/JbOymPOMFbU/hqdefault.jpg",
        "ingredients": ["Potato", "Cauliflower", "Onion", "Tomato", "Turmeric", "Cumin", "Coriander"],
        "prep_time": "15 min",
        "cook_time": "20 min",
        "servings": 3,
        "category": "Main Course"
    },
    {
        "id": "palak-paneer-1",
        "title": "Palak Paneer",
        "title_mr": "पालक पनीर",
        "source": "Sanjeev Kapoor",
        "type": "video",
        "video_id": "lgjPPJfCjpo",
        "thumbnail": "https://i.ytimg.com/vi/lgjPPJfCjpo/hqdefault.jpg",
        "ingredients": ["Paneer", "Spinach", "Onion", "Tomato", "Garlic", "Ginger", "Cream", "Garam Masala"],
        "prep_time": "20 min",
        "cook_time": "25 min",
        "servings": 4,
        "category": "Main Course"
    },
    {
        "id": "chole-1",
        "title": "Punjabi Chole",
        "title_mr": "पंजाबी छोले",
        "source": "Hebbars Kitchen",
        "type": "video",
        "video_id": "7DYVHPj4AdY",
        "thumbnail": "https://i.ytimg.com/vi/7DYVHPj4AdY/hqdefault.jpg",
        "ingredients": ["Chickpeas", "Onion", "Tomato", "Ginger", "Garlic", "Chole Masala", "Tea Bags"],
        "prep_time": "8 hours",
        "cook_time": "40 min",
        "servings": 4,
        "category": "Main Course"
    },
    {
        "id": "jeera-rice-1",
        "title": "Jeera Rice",
        "title_mr": "जीरा राइस",
        "source": "Ranveer Brar",
        "type": "video",
        "video_id": "NF7Eo30RBDA",
        "thumbnail": "https://i.ytimg.com/vi/NF7Eo30RBDA/hqdefault.jpg",
        "ingredients": ["Basmati Rice", "Cumin", "Ghee", "Bay Leaf", "Salt"],
        "prep_time": "5 min",
        "cook_time": "20 min",
        "servings": 4,
        "category": "Rice"
    },
    {
        "id": "poha-1",
        "title": "Kanda Poha",
        "title_mr": "कांदा पोहा",
        "source": "Madhura's Recipe Marathi",
        "type": "video",
        "video_id": "5009BTDB4bA",
        "thumbnail": "https://i.ytimg.com/vi/5009BTDB4bA/hqdefault.jpg",
        "ingredients": ["Poha", "Onion", "Potato", "Peanuts", "Curry Leaves", "Mustard Seeds", "Turmeric"],
        "prep_time": "10 min",
        "cook_time": "15 min",
        "servings": 2,
        "category": "Breakfast"
    },
    {
        "id": "upma-1",
        "title": "Rava Upma",
        "title_mr": "रवा उपमा",
        "source": "Kabita's Kitchen",
        "type": "video",
        "video_id": "JbOymPOMFbU",
        "thumbnail": "https://i.ytimg.com/vi/JbOymPOMFbU/hqdefault.jpg",
        "ingredients": ["Semolina", "Onion", "Carrot", "Peas", "Curry Leaves", "Mustard Seeds", "Cashews"],
        "prep_time": "5 min",
        "cook_time": "15 min",
        "servings": 2,
        "category": "Breakfast"
    },
    {
        "id": "sambar-1",
        "title": "South Indian Sambar",
        "title_mr": "सांबर",
        "source": "Hebbars Kitchen",
        "type": "video",
        "video_id": "7DYVHPj4AdY",
        "thumbnail": "https://i.ytimg.com/vi/7DYVHPj4AdY/hqdefault.jpg",
        "ingredients": ["Toor Dal", "Drumstick", "Carrot", "Onion", "Tomato", "Sambar Powder", "Tamarind"],
        "prep_time": "15 min",
        "cook_time": "30 min",
        "servings": 4,
        "category": "Main Course"
    },
    {
        "id": "bhindi-1",
        "title": "Bhindi Masala",
        "title_mr": "भिंडी मसाला",
        "source": "Ranveer Brar",
        "type": "video",
        "video_id": "NF7Eo30RBDA",
        "thumbnail": "https://i.ytimg.com/vi/NF7Eo30RBDA/hqdefault.jpg",
        "ingredients": ["Okra", "Onion", "Tomato", "Turmeric", "Red Chili", "Coriander", "Cumin"],
        "prep_time": "15 min",
        "cook_time": "20 min",
        "servings": 3,
        "category": "Main Course"
    },
    {
        "id": "paneer-butter-1",
        "title": "Paneer Butter Masala",
        "title_mr": "पनीर बटर मसाला",
        "source": "Ranveer Brar",
        "type": "video",
        "video_id": "NF7Eo30RBDA",
        "thumbnail": "https://i.ytimg.com/vi/NF7Eo30RBDA/hqdefault.jpg",
        "ingredients": ["Paneer", "Tomato", "Butter", "Cream", "Cashews", "Garam Masala", "Kasuri Methi"],
        "prep_time": "15 min",
        "cook_time": "25 min",
        "servings": 4,
        "category": "Main Course"
    },
    {
        "id": "rajma-1",
        "title": "Rajma Chawal",
        "title_mr": "राजमा चावल",
        "source": "Kabita's Kitchen",
        "type": "video",
        "video_id": "JbOymPOMFbU",
        "thumbnail": "https://i.ytimg.com/vi/JbOymPOMFbU/hqdefault.jpg",
        "ingredients": ["Kidney Beans", "Basmati Rice", "Onion", "Tomato", "Ginger", "Garlic", "Garam Masala"],
        "prep_time": "8 hours",
        "cook_time": "45 min",
        "servings": 4,
        "category": "Main Course"
    },
    {
        "id": "khichdi-1",
        "title": "Moong Dal Khichdi",
        "title_mr": "मूग डाळ खिचडी",
        "source": "Madhura's Recipe Marathi",
        "type": "video",
        "video_id": "0bW-5JwHHNU",
        "thumbnail": "https://i.ytimg.com/vi/0bW-5JwHHNU/hqdefault.jpg",
        "ingredients": ["Rice", "Moong Dal", "Ghee", "Cumin", "Turmeric", "Ginger", "Salt"],
        "prep_time": "10 min",
        "cook_time": "25 min",
        "servings": 3,
        "category": "Main Course"
    },
    {
        "id": "masala-dosa-1",
        "title": "Masala Dosa",
        "title_mr": "मसाला डोसा",
        "source": "Hebbars Kitchen",
        "type": "video",
        "video_id": "J75VQSxOtdo",
        "thumbnail": "https://i.ytimg.com/vi/J75VQSxOtdo/hqdefault.jpg",
        "ingredients": ["Rice", "Urad Dal", "Potato", "Onion", "Mustard Seeds", "Curry Leaves", "Turmeric"],
        "prep_time": "8 hours",
        "cook_time": "30 min",
        "servings": 4,
        "category": "Breakfast"
    },
    {
        "id": "idli-1",
        "title": "Soft Idli",
        "title_mr": "इडली",
        "source": "Hebbars Kitchen",
        "type": "video",
        "video_id": "pbut8MlmjGk",
        "thumbnail": "https://i.ytimg.com/vi/pbut8MlmjGk/hqdefault.jpg",
        "video_id": "7DYVHPj4AdY",
        "thumbnail": "https://i.ytimg.com/vi/7DYVHPj4AdY/hqdefault.jpg",
        "ingredients": ["Rice", "Urad Dal", "Fenugreek Seeds", "Salt"],
        "prep_time": "8 hours",
        "cook_time": "15 min",
        "servings": 4,
        "category": "Breakfast"
    },
    {
        "id": "aloo-paratha-1",
        "title": "Aloo Paratha",
        "title_mr": "आलू पराठा",
        "source": "Kabita's Kitchen",
        "type": "video",
        "video_id": "JbOymPOMFbU",
        "thumbnail": "https://i.ytimg.com/vi/JbOymPOMFbU/hqdefault.jpg",
        "ingredients": ["Wheat Flour", "Potato", "Onion", "Green Chili", "Coriander", "Cumin", "Ghee"],
        "prep_time": "20 min",
        "cook_time": "20 min",
        "servings": 4,
        "category": "Breakfast"
    },
    {
        "id": "egg-curry-1",
        "title": "Egg Curry",
        "title_mr": "अंडा करी",
        "source": "Ranveer Brar",
        "type": "video",
        "video_id": "NF7Eo30RBDA",
        "thumbnail": "https://i.ytimg.com/vi/NF7Eo30RBDA/hqdefault.jpg",
        "ingredients": ["Eggs", "Onion", "Tomato", "Ginger", "Garlic", "Garam Masala", "Turmeric"],
        "prep_time": "10 min",
        "cook_time": "25 min",
        "servings": 4,
        "category": "Main Course"
    },
    {
        "id": "gajar-halwa-1",
        "title": "Gajar Ka Halwa",
        "title_mr": "गाजर हलवा",
        "source": "Sanjeev Kapoor",
        "type": "video",
        "video_id": "lgjPPJfCjpo",
        "thumbnail": "https://i.ytimg.com/vi/lgjPPJfCjpo/hqdefault.jpg",
        "ingredients": ["Carrot", "Milk", "Sugar", "Ghee", "Cardamom", "Cashews", "Raisins"],
        "prep_time": "15 min",
        "cook_time": "45 min",
        "servings": 6,
        "category": "Dessert"
    },
    {
        "id": "gulab-jamun-1",
        "title": "Gulab Jamun",
        "title_mr": "गुलाब जामुन",
        "source": "Madhura's Recipe Marathi",
        "type": "video",
        "video_id": "jmIaFy2X0Qg",
        "thumbnail": "https://i.ytimg.com/vi/jmIaFy2X0Qg/hqdefault.jpg",
        "ingredients": ["Milk Powder", "Maida", "Ghee", "Sugar", "Cardamom", "Rose Water"],
        "prep_time": "20 min",
        "cook_time": "30 min",
        "servings": 8,
        "category": "Dessert"
    },
    {
        "id": "matar-paneer-1",
        "title": "Matar Paneer",
        "title_mr": "मटर पनीर",
        "source": "Kabita's Kitchen",
        "type": "video",
        "video_id": "JbOymPOMFbU",
        "thumbnail": "https://i.ytimg.com/vi/JbOymPOMFbU/hqdefault.jpg",
        "ingredients": ["Paneer", "Peas", "Onion", "Tomato", "Ginger", "Garlic", "Garam Masala", "Cream"],
        "prep_time": "15 min",
        "cook_time": "25 min",
        "servings": 4,
        "category": "Main Course"
    },
    {
        "id": "chana-masala-1",
        "title": "Chana Masala",
        "title_mr": "चणा मसाला",
        "source": "Ranveer Brar",
        "type": "text",
        "video_id": None,
        "thumbnail": "https://i.ytimg.com/vi/NF7Eo30RBDA/hqdefault.jpg",
        "ingredients": ["Chickpeas", "Onion", "Tomato", "Ginger", "Garlic", "Chana Masala", "Coriander"],
        "prep_time": "8 hours",
        "cook_time": "35 min",
        "servings": 4,
        "category": "Main Course"
    },
    {
        "id": "baingan-bharta-1",
        "title": "Baingan Bharta",
        "title_mr": "बैंगन भर्ता",
        "source": "Sanjeev Kapoor",
        "type": "video",
        "video_id": "lgjPPJfCjpo",
        "thumbnail": "https://i.ytimg.com/vi/lgjPPJfCjpo/hqdefault.jpg",
        "ingredients": ["Eggplant", "Onion", "Tomato", "Green Chili", "Garlic", "Coriander", "Mustard Oil"],
        "prep_time": "15 min",
        "cook_time": "30 min",
        "servings": 4,
        "category": "Main Course"
    },
    {
        "id": "dal-makhani-1",
        "title": "Dal Makhani",
        "title_mr": "दाल मखनी",
        "source": "Ranveer Brar",
        "type": "video",
        "video_id": "NF7Eo30RBDA",
        "thumbnail": "https://i.ytimg.com/vi/NF7Eo30RBDA/hqdefault.jpg",
        "ingredients": ["Black Lentils", "Kidney Beans", "Butter", "Cream", "Tomato", "Ginger", "Garlic", "Garam Masala"],
        "prep_time": "8 hours",
        "cook_time": "60 min",
        "servings": 6,
        "category": "Main Course"
    },
    {
        "id": "vada-pav-1",
        "title": "Vada Pav",
        "title_mr": "वडा पाव",
        "source": "Madhura's Recipe Marathi",
        "type": "video",
        "video_id": "pnz8D_rnHUk",
        "thumbnail": "https://i.ytimg.com/vi/pnz8D_rnHUk/hqdefault.jpg",
        "ingredients": ["Potato", "Gram Flour", "Pav", "Garlic", "Green Chili", "Mustard Seeds", "Turmeric"],
        "prep_time": "20 min",
        "cook_time": "25 min",
        "servings": 4,
        "category": "Snacks"
    },
    {
        "id": "samosa-1",
        "title": "Punjabi Samosa",
        "title_mr": "समोसा",
        "source": "Hebbars Kitchen",
        "type": "video",
        "video_id": "7DYVHPj4AdY",
        "thumbnail": "https://i.ytimg.com/vi/7DYVHPj4AdY/hqdefault.jpg",
        "ingredients": ["Maida", "Potato", "Peas", "Cumin", "Coriander", "Green Chili", "Garam Masala"],
        "prep_time": "30 min",
        "cook_time": "30 min",
        "servings": 8,
        "category": "Snacks"
    },
    {
        "id": "pav-bhaji-1",
        "title": "Pav Bhaji",
        "title_mr": "पाव भाजी",
        "source": "Kabita's Kitchen",
        "type": "video",
        "video_id": "JbOymPOMFbU",
        "thumbnail": "https://i.ytimg.com/vi/JbOymPOMFbU/hqdefault.jpg",
        "ingredients": ["Potato", "Cauliflower", "Peas", "Carrot", "Tomato", "Onion", "Pav Bhaji Masala", "Butter", "Pav"],
        "prep_time": "20 min",
        "cook_time": "30 min",
        "servings": 4,
        "category": "Snacks"
    },
    {
        "id": "pav-bhaji-2",
        "title": "Pav Bhaji",
        "title_mr": "पाव भाजी",
        "source": "MadhurasRecipe Marathi",
        "type": "video",
        "video_id": "eJlZW7keg5I",
        "thumbnail": "https://i.ytimg.com/vi/eJlZW7keg5I/hqdefault.jpg",
        "ingredients": ["Potato", "Cauliflower", "Peas", "Capsicum", "Tomato", "Onion", "Beetroot", "Pav Bhaji Masala", "Butter", "Pav"],
        "prep_time": "15 min",
        "cook_time": "25 min",
        "servings": 10,
        "category": "Snacks"
    },
    {
        "id": "misal-pav-1",
        "title": "Misal Pav",
        "title_mr": "मिसळ पाव",
        "source": "Madhura's Recipe Marathi",
        "type": "video",
        "video_id": "U24aNCL0YdQ",
        "thumbnail": "https://i.ytimg.com/vi/U24aNCL0YdQ/hqdefault.jpg",
        "ingredients": ["Moth Beans", "Onion", "Tomato", "Coconut", "Pav", "Farsan", "Coriander"],
        "prep_time": "8 hours",
        "cook_time": "40 min",
        "servings": 4,
        "category": "Breakfast"
    },
    {
        "id": "biryani-1",
        "title": "Vegetable Biryani",
        "title_mr": "व्हेज बिर्याणी",
        "source": "Sanjeev Kapoor",
        "type": "video",
        "video_id": "lgjPPJfCjpo",
        "thumbnail": "https://i.ytimg.com/vi/lgjPPJfCjpo/hqdefault.jpg",
        "ingredients": ["Basmati Rice", "Onion", "Tomato", "Potato", "Carrot", "Peas", "Biryani Masala", "Ghee", "Saffron"],
        "prep_time": "30 min",
        "cook_time": "45 min",
        "servings": 6,
        "category": "Main Course"
    },
    {
        "id": "coconut-chutney-1",
        "title": "Coconut Chutney",
        "title_mr": "नारळ चटणी",
        "source": "Hebbars Kitchen",
        "type": "text",
        "video_id": None,
        "thumbnail": "https://i.ytimg.com/vi/7DYVHPj4AdY/hqdefault.jpg",
        "ingredients": ["Coconut", "Green Chili", "Ginger", "Curry Leaves", "Mustard Seeds", "Urad Dal"],
        "prep_time": "10 min",
        "cook_time": "5 min",
        "servings": 4,
        "category": "Chutney"
    }
]

def normalize_string(s: str) -> str:
    """Normalize string for flexible matching - remove special chars, lowercase"""
    import re
    return re.sub(r'[^a-z0-9]', '', s.lower())

def search_local_recipes(ingredients: List[str], videos_only: bool = False, favorite_channels: List[str] = [], text_query: str = "") -> List[Dict[str, Any]]:
    """Search local recipe database by matching ingredients or text query"""
    results = []
    ingredients_lower = [ing.lower() for ing in ingredients]
    text_query_lower = text_query.lower().strip() if text_query else ""
    
    # Normalize favorite channel names for flexible matching
    favorite_channels_normalized = [normalize_string(ch) for ch in favorite_channels]
    
    for recipe in RECIPE_DATABASE:
        # Skip non-video recipes if videos_only filter is set
        if videos_only and recipe.get('type') != 'video':
            continue
        
        # Normalize source for comparison
        source_normalized = normalize_string(recipe.get('source', ''))
        
        # Check if this recipe is from a favorite channel
        is_from_favorite = bool(favorite_channels_normalized and any(
            fav in source_normalized or source_normalized in fav 
            for fav in favorite_channels_normalized
        ))
        
        # Text query search - match against title and title_mr
        # For text search, we show ALL matches but prioritize favorites
        if text_query_lower:
            title_lower = recipe.get('title', '').lower()
            title_mr = recipe.get('title_mr', '')
            
            # Check if query matches title (full phrase match)
            if text_query_lower in title_lower:
                # Boost score for favorites
                base_score = 1.0 if text_query_lower == title_lower else 0.9
                results.append({
                    **recipe,
                    'match_count': 1,
                    'match_score': base_score + (0.5 if is_from_favorite else 0),
                    'is_favorite': is_from_favorite
                })
            # Also check if title is contained in query (for shorter titles)
            elif title_lower in text_query_lower:
                results.append({
                    **recipe,
                    'match_count': 1,
                    'match_score': 0.8 + (0.5 if is_from_favorite else 0),
                    'is_favorite': is_from_favorite
                })
            continue  # Skip ingredient matching if text query is provided
        
        # Ingredient-based search (only if no text query)
        # For ingredient search, if favorites are set, only show favorites
        if ingredients_lower:
            # If favorite channels are set for ingredient search, filter to favorites only
            if favorite_channels and not is_from_favorite:
                continue
                
            recipe_ingredients_lower = [ing.lower() for ing in recipe.get('ingredients', [])]
            matches = sum(1 for ing in ingredients_lower if any(ing in r_ing or r_ing in ing for r_ing in recipe_ingredients_lower))
            
            if matches > 0:
                # Calculate match score (percentage of selected ingredients found in recipe)
                match_score = matches / len(ingredients_lower) if ingredients_lower else 0
                
                results.append({
                    **recipe,
                    'match_count': matches,
                    'match_score': match_score,
                    'is_favorite': is_from_favorite
                })
    
    # Sort by match score (descending), then by favorite status
    results.sort(key=lambda x: (x['match_score'], x['is_favorite']), reverse=True)
    
    return results

async def translate_text(text: str, target_lang: str, user_id: str = None) -> Dict[str, Any]:
    """
    Translate text using Google Cloud Translation API with caching and verification
    Returns: {translated_text, is_ai_generated, user_verified, community_verified, custom_label}
    """
    try:
        text_normalized = text.strip()
        
        # Check for existing translation in the enhanced cache
        cached = await db.translations.find_one({
            "source_text": {"$regex": f"^{re.escape(text_normalized)}$", "$options": "i"},
            "target_language": target_lang
        })
        
        if cached:
            # Check if user has a custom label
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
        
        # Try static translations first (for common ingredients)
        text_lower = text_normalized.lower()
        static_translation = TRANSLATIONS.get(target_lang, {}).get(text_lower)
        
        if static_translation:
            # Static translations are pre-verified
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
            await db.translations.insert_one(translation_doc)
            
            return {
                "translated_text": static_translation,
                "is_ai_generated": False,
                "user_verified": True,
                "community_verified": True,
                "user_verified_count": COMMUNITY_VERIFY_THRESHOLD,
                "custom_label": None
            }
        
        # Call Google Translate API
        api_translation = await google_translate_api(text_normalized, target_lang)
        
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
            await db.translations.insert_one(translation_doc)
            
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

async def translate_text_simple(text: str, target_lang: str) -> str:
    """Simple translate that returns just the text (for backward compatibility)"""
    result = await translate_text(text, target_lang)
    return result["translated_text"]

# ============ YOUTUBE SERVICE ============

def get_youtube_service():
    return build('youtube', 'v3', developerKey=YOUTUBE_API_KEY, cache_discovery=False)

async def fetch_video_details(video_id: str) -> Dict[str, Any]:
    """Fetch YouTube video details"""
    try:
        youtube = get_youtube_service()
        request = youtube.videos().list(part="snippet", id=video_id)
        response = request.execute()
        
        if response.get('items'):
            item = response['items'][0]
            return {
                'title': item['snippet']['title'],
                'thumbnail': item['snippet']['thumbnails']['high']['url'],
                'video_id': video_id
            }
        return {}
    except HttpError as e:
        logger.error(f"YouTube API error: {e}")
        return {}

async def search_youtube_recipes(query: str, max_results: int = 10, favorite_channels: List[str] = []) -> List[Dict[str, Any]]:
    """Search YouTube for recipe videos - only from favorite channels if set"""
    try:
        youtube = get_youtube_service()
        
        all_results = []
        seen_video_ids = set()
        
        # If favorite channels exist, do a single search with all channel names
        if favorite_channels:
            # Combine all favorite channel names into one search query
            channels_query = " OR ".join([f'"{ch}"' for ch in favorite_channels[:3]])
            search_query = f"{query} recipe ({channels_query})"
            
            try:
                request = youtube.search().list(
                    part="snippet",
                    q=search_query,
                    type="video",
                    maxResults=max_results * 2,  # Get extra to filter
                    regionCode="IN"
                )
                response = request.execute()
                
                # Normalize favorite channel names for matching
                favorite_names_lower = [ch.lower() for ch in favorite_channels]
                
                for item in response.get('items', []):
                    video_id = item['id']['videoId']
                    channel_title = item['snippet']['channelTitle'].lower()
                    
                    # Check if channel matches any favorite
                    is_favorite = any(
                        fav in channel_title or channel_title in fav 
                        for fav in favorite_names_lower
                    )
                    
                    if is_favorite and video_id not in seen_video_ids:
                        seen_video_ids.add(video_id)
                        all_results.append({
                            'video_id': video_id,
                            'title': item['snippet']['title'],
                            'thumbnail': item['snippet']['thumbnails']['high']['url'],
                            'channel': item['snippet']['channelTitle'],
                            'channel_id': item['snippet']['channelId'],
                            'is_favorite': True
                        })
                        
                        if len(all_results) >= max_results:
                            break
                            
            except HttpError as e:
                if 'quotaExceeded' in str(e):
                    logger.error("YouTube API quota exceeded")
                    raise HTTPException(status_code=429, detail="YouTube API quota exceeded. Please try again later.")
                raise
            
            return all_results[:max_results]
        
        # No favorite channels set - do general search
        try:
            request = youtube.search().list(
                part="snippet",
                q=f"{query} recipe",
                type="video",
                maxResults=max_results,
                regionCode="IN"
            )
            response = request.execute()
            
            for item in response.get('items', []):
                video_id = item['id']['videoId']
                if video_id not in seen_video_ids:
                    seen_video_ids.add(video_id)
                    all_results.append({
                        'video_id': video_id,
                        'title': item['snippet']['title'],
                        'thumbnail': item['snippet']['thumbnails']['high']['url'],
                        'channel': item['snippet']['channelTitle'],
                        'channel_id': item['snippet']['channelId'],
                        'is_favorite': False
                    })
                    
        except HttpError as e:
            if 'quotaExceeded' in str(e):
                logger.error("YouTube API quota exceeded")
                raise HTTPException(status_code=429, detail="YouTube API quota exceeded. Please try again later.")
            raise
        
        return all_results[:max_results]
        
    except HttpError as e:
        logger.error(f"YouTube search error: {e}")
        if 'quotaExceeded' in str(e):
            raise HTTPException(status_code=429, detail="YouTube API quota exceeded. Please try again later.")
        return []

# ============ FESTIVAL INTELLIGENCE ============

FESTIVAL_CALENDAR = {
    "2026-01-26": {
        "name": "Republic Day Special",
        "ingredients": ["saffron", "milk", "sugar", "cardamom"],
        "message": "Republic Day! Time to prepare tricolor sweets with saffron, milk, and pistachios. Check your pantry!"
    },
    "2026-01-28": {
        "name": "Upcoming Cooking Session",
        "ingredients": ["til", "jaggery", "peanuts"],
        "message": "Planning a special cooking session! Stock up on til (sesame) and jaggery for traditional sweets."
    },
    "2026-03-14": {
        "name": "Holi",
        "ingredients": ["thandai", "gujiya", "milk", "sugar"],
        "message": "Holi is coming! Stock up for Gujiya and Thandai preparations."
    },
    "2026-08-15": {
        "name": "Independence Day",
        "ingredients": ["saffron", "milk", "sugar", "cardamom"],
        "message": "Independence Day! Try making tricolor desserts with saffron, milk, and pistachios."
    },
    "2026-10-24": {
        "name": "Diwali",
        "ingredients": ["ghee", "besan", "sugar", "dry fruits"],
        "message": "Diwali preparations! Stock up on ghee, besan, and dry fruits for sweets."
    }
}

async def get_festival_alert() -> Optional[FestivalAlert]:
    """Check for upcoming festivals and provide smart suggestions"""
    today = datetime.now(timezone.utc).date()
    
    for days_ahead in range(0, 7):
        check_date = today + timedelta(days=days_ahead)
        date_str = check_date.strftime("%Y-%m-%d")
        
        if date_str in FESTIVAL_CALENDAR:
            festival = FESTIVAL_CALENDAR[date_str]
            
            # Check which ingredients are in stock
            in_stock = []
            needed = []
            
            for ingredient in festival['ingredients']:
                item = await db.inventory.find_one({"name_en": {"$regex": ingredient, "$options": "i"}})
                if item and item.get('stock_level') in ['half', 'full']:
                    in_stock.append(ingredient)
                else:
                    needed.append(ingredient)
            
            return FestivalAlert(
                date=date_str,
                name=festival['name'],
                message=festival['message'],
                ingredients_needed=needed,
                ingredients_in_stock=in_stock
            )
    
    return None

# ============ INVENTORY ENDPOINTS ============

@api_router.post("/inventory", response_model=InventoryItem)
async def create_inventory_item(item: InventoryItemCreate, background_tasks: BackgroundTasks):
    """Create new inventory item with auto-translation"""
    item_dict = item.model_dump()
    inventory_item = InventoryItem(**item_dict)
    
    # If Marathi name provided, use it; otherwise translate
    if item.name_mr:
        inventory_item.name_mr = item.name_mr
    else:
        name_mr = await translate_text_simple(item.name_en, "mr")
        inventory_item.name_mr = name_mr
    
    # Translate to Hindi as well
    name_hi = await translate_text_simple(item.name_en, "hi")
    inventory_item.name_hi = name_hi
    
    doc = inventory_item.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.inventory.insert_one(doc)
    return inventory_item

@api_router.get("/inventory", response_model=List[InventoryItem])
async def get_inventory(category: Optional[str] = None):
    """Get all inventory items"""
    query = {"category": category} if category else {}
    items = await db.inventory.find(query, {"_id": 0}).to_list(1000)
    
    for item in items:
        if isinstance(item.get('created_at'), str):
            item['created_at'] = datetime.fromisoformat(item['created_at'])
    
    return items

@api_router.put("/inventory/{item_id}")
async def update_inventory_item(item_id: str, updates: Dict[str, Any]):
    """Update inventory item"""
    result = await db.inventory.update_one(
        {"id": item_id},
        {"$set": updates}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    
    return {"message": "Updated successfully"}

@api_router.delete("/inventory/{item_id}")
async def delete_inventory_item(item_id: str):
    """Delete inventory item"""
    result = await db.inventory.delete_one({"id": item_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    
    return {"message": "Deleted successfully"}


@api_router.get("/inventory/monthly-defaults")
async def get_monthly_quantity_defaults():
    """Get default monthly quantities for all categories"""
    return DEFAULT_MONTHLY_QUANTITIES


@api_router.put("/inventory/{item_id}/monthly-quantity")
async def update_monthly_quantity(item_id: str, quantity: int, unit: str):
    """Update monthly quantity for an inventory item"""
    result = await db.inventory.update_one(
        {"id": item_id},
        {"$set": {"monthly_quantity": quantity, "monthly_unit": unit}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    
    return {"message": "Monthly quantity updated", "quantity": quantity, "unit": unit}


# ============ SHOPPING LIST ENDPOINTS ============

@api_router.post("/shopping", response_model=ShoppingItem)
async def create_shopping_item(item: ShoppingItemCreate):
    """Create shopping list item"""
    item_dict = item.model_dump()
    shopping_item = ShoppingItem(**item_dict)
    
    # If Marathi name provided, use it; otherwise translate
    if item.name_mr:
        shopping_item.name_mr = item.name_mr
    else:
        name_mr = await translate_text_simple(item.name_en, "mr")
        shopping_item.name_mr = name_mr
    
    # Auto-translate to Hindi
    name_hi = await translate_text_simple(item.name_en, "hi")
    shopping_item.name_hi = name_hi
    
    # Set stock_level from input if provided
    if item.stock_level:
        shopping_item.stock_level = item.stock_level
    
    # Set monthly_quantity from input if provided
    if item.monthly_quantity:
        shopping_item.monthly_quantity = item.monthly_quantity
    
    doc = shopping_item.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.shopping_list.insert_one(doc)
    return shopping_item


@api_router.put("/shopping/{item_id}")
async def update_shopping_item(item_id: str, updates: Dict[str, Any]):
    """Update shopping list item"""
    result = await db.shopping_list.update_one(
        {"id": item_id},
        {"$set": updates}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    
    return {"message": "Updated successfully"}

@api_router.get("/shopping", response_model=List[ShoppingItem])
async def get_shopping_list(store_type: Optional[str] = None):
    """Get shopping list"""
    query = {"store_type": store_type} if store_type else {}
    items = await db.shopping_list.find(query, {"_id": 0}).to_list(1000)
    
    for item in items:
        if isinstance(item.get('created_at'), str):
            item['created_at'] = datetime.fromisoformat(item['created_at'])
    
    return items

@api_router.delete("/shopping/{item_id}")
async def delete_shopping_item(item_id: str):
    """Delete shopping item"""
    result = await db.shopping_list.delete_one({"id": item_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    
    return {"message": "Deleted successfully"}

@api_router.delete("/shopping")
async def clear_shopping_list():
    """Clear entire shopping list"""
    await db.shopping_list.delete_many({})
    return {"message": "Shopping list cleared"}

# ============ MEAL PLANNER ENDPOINTS ============

def estimate_ingredient_quantity(ingredient_name: str, serving_size: str = "family_4") -> Dict[str, Any]:
    """Estimate ingredient quantity based on serving size"""
    ingredient_lower = ingredient_name.lower().strip()
    
    # Find matching ingredient in defaults
    default_qty = None
    for key, value in DEFAULT_INGREDIENT_QUANTITIES.items():
        if key in ingredient_lower or ingredient_lower in key:
            default_qty = value
            break
    
    if not default_qty:
        # Default fallback
        default_qty = {"qty": 100, "unit": "g"}
    
    # Apply serving multiplier
    multiplier = SERVING_MULTIPLIERS.get(serving_size, 1.0)
    estimated_qty = int(default_qty["qty"] * multiplier)
    
    return {
        "qty": estimated_qty,
        "unit": default_qty["unit"]
    }

async def match_ingredients_to_inventory(ingredient_names: List[str]) -> List[Dict[str, Any]]:
    """Match ingredient names to inventory items"""
    inventory_items = await db.inventory.find({}, {"_id": 0}).to_list(500)
    matched = []
    
    for ing_name in ingredient_names:
        ing_lower = ing_name.lower().strip()
        best_match = None
        
        for item in inventory_items:
            item_name_lower = item.get('name_en', '').lower()
            # Flexible matching
            if ing_lower in item_name_lower or item_name_lower in ing_lower:
                best_match = item
                break
            # Also check if any word matches
            ing_words = ing_lower.split()
            item_words = item_name_lower.split()
            if any(iw in item_words or any(iw in tw for tw in item_words) for iw in ing_words):
                best_match = item
                break
        
        if best_match:
            matched.append({
                "item_id": best_match["id"],
                "item_name": best_match["name_en"],
                "category": best_match.get("category", "other"),
                "stock_level": best_match.get("stock_level", "empty"),
                "in_stock": best_match.get("stock_level") not in ["empty"]
            })
        else:
            # Not in inventory
            matched.append({
                "item_id": None,
                "item_name": ing_name,
                "category": "other",
                "stock_level": "empty",
                "in_stock": False
            })
    
    return matched

class PrepareMealPlanRequest(BaseModel):
    video_id: str
    video_title: str
    video_thumbnail: str = ""
    channel_name: str = ""
    matched_ingredients: List[str] = []

@api_router.post("/meal-plans/prepare")
async def prepare_meal_plan(request: PrepareMealPlanRequest):
    """
    Prepare meal plan data before showing the scheduling modal.
    Returns matched inventory items with estimated quantities.
    """
    # Match ingredients to inventory
    inventory_matches = await match_ingredients_to_inventory(request.matched_ingredients)
    
    # Prepare ingredient options with quantities for each serving size
    ingredient_options = []
    for i, match in enumerate(inventory_matches):
        ing_name = match["item_name"]
        options = {
            "ingredient_name": ing_name,
            "item_id": match["item_id"],
            "in_stock": match["in_stock"],
            "stock_level": match["stock_level"],
            "selected": match["in_stock"],  # Pre-select items in stock
            "quantities": {}
        }
        
        # Calculate quantities for each serving size
        for size_key in SERVING_MULTIPLIERS.keys():
            qty_info = estimate_ingredient_quantity(ing_name, size_key)
            options["quantities"][size_key] = qty_info
        
        ingredient_options.append(options)
    
    # Get week dates
    today = datetime.now(timezone.utc)
    week_dates = []
    for i in range(7):
        day = today + timedelta(days=i)
        week_dates.append({
            "date": day.strftime("%Y-%m-%d"),
            "day_name": day.strftime("%a"),
            "day_num": day.strftime("%d"),
            "is_today": i == 0
        })
    
    return {
        "video": {
            "video_id": request.video_id,
            "title": request.video_title,
            "thumbnail": request.video_thumbnail,
            "channel": request.channel_name
        },
        "ingredient_options": ingredient_options,
        "week_dates": week_dates,
        "serving_sizes": [
            {"key": "single", "label": "Single (1 person)", "multiplier": 0.25},
            {"key": "couple", "label": "Couple (2 people)", "multiplier": 0.5},
            {"key": "family_4", "label": "Family (4 people)", "multiplier": 1.0},
            {"key": "party", "label": "Party (8+ people)", "multiplier": 2.0}
        ],
        "meal_slots": [
            {"key": "breakfast", "label": "🌅 Breakfast"},
            {"key": "lunch", "label": "☀️ Lunch"},
            {"key": "snacks", "label": "🍪 Snacks"},
            {"key": "dinner", "label": "🌙 Dinner"}
        ]
    }

@api_router.post("/meal-plans", response_model=MealPlan)
async def create_meal_plan(plan: MealPlanCreate):
    """Create meal plan with ingredient reservations"""
    plan_dict = plan.model_dump()
    meal_plan = MealPlan(**plan_dict)
    
    # Set channel info
    if plan.youtube_channel:
        meal_plan.youtube_channel = plan.youtube_channel
    
    # Fetch YouTube details if video ID provided
    if plan.youtube_video_id:
        video_details = await fetch_video_details(plan.youtube_video_id)
        meal_plan.youtube_thumbnail = video_details.get('thumbnail') or plan.youtube_thumbnail
        meal_plan.youtube_title = video_details.get('title')
    
    doc = meal_plan.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.meal_plans.insert_one(doc)
    
    # Create inventory reservations
    if plan.reserved_ingredients:
        for reservation in plan.reserved_ingredients:
            item_id = reservation.get('item_id')
            if item_id:
                # Add reservation to inventory item
                reservation_record = {
                    "meal_plan_id": meal_plan.id,
                    "date": plan.date,
                    "meal_type": plan.meal_type,
                    "qty": reservation.get('est_qty'),
                    "unit": reservation.get('unit')
                }
                await db.inventory.update_one(
                    {"id": item_id},
                    {"$push": {"reserved_for": reservation_record}}
                )
    
    return meal_plan

@api_router.get("/meal-plans", response_model=List[MealPlan])
async def get_meal_plans():
    """Get all meal plans"""
    plans = await db.meal_plans.find({}, {"_id": 0}).to_list(1000)
    
    for plan in plans:
        if isinstance(plan.get('created_at'), str):
            plan['created_at'] = datetime.fromisoformat(plan['created_at'])
    
    return plans

@api_router.delete("/meal-plans/{plan_id}")
async def delete_meal_plan(plan_id: str):
    """Delete meal plan and remove reservations"""
    # First get the plan to find reserved ingredients
    plan = await db.meal_plans.find_one({"id": plan_id}, {"_id": 0})
    
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    # Remove reservations from inventory items
    reserved = plan.get('reserved_ingredients', [])
    released_items = []
    for reservation in reserved:
        item_id = reservation.get('item_id')
        if item_id:
            await db.inventory.update_one(
                {"id": item_id},
                {"$pull": {"reserved_for": {"meal_plan_id": plan_id}}}
            )
            released_items.append(reservation.get('item_name', item_id))
    
    # Delete the plan
    result = await db.meal_plans.delete_one({"id": plan_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    return {
        "message": "Deleted successfully",
        "released_ingredients": released_items,
        "plan_name": plan.get('meal_name', 'Recipe')
    }

@api_router.get("/meal-plans/suggestions")
async def get_meal_suggestions():
    """Get quick meal suggestions based on current inventory for empty slots"""
    # Get available inventory items
    inventory_items = await db.inventory.find(
        {"stock_level": {"$ne": "empty"}},
        {"name_en": 1, "_id": 0}
    ).to_list(100)
    available_items = [item["name_en"].lower() for item in inventory_items]
    
    if not available_items:
        return {"suggestions": []}
    
    # Find recipes that match available ingredients
    suggestions = []
    for recipe in RECIPE_DATABASE:
        recipe_ingredients = [ing.lower() for ing in recipe.get('ingredients', [])]
        if not recipe_ingredients:
            continue
        
        matched = sum(1 for ing in recipe_ingredients if any(avail in ing or ing in avail for avail in available_items))
        match_percent = (matched / len(recipe_ingredients)) * 100 if recipe_ingredients else 0
        
        if match_percent >= 50:  # At least 50% ingredients available
            suggestions.append({
                "title": recipe['title'],
                "video_id": recipe.get('video_id'),
                "thumbnail": recipe.get('thumbnail'),
                "source": recipe.get('source', 'Local'),
                "match_percent": round(match_percent),
                "prep_time": recipe.get('prep_time', ''),
                "category": recipe.get('category', '')
            })
    
    # Sort by match percent and take top 5
    suggestions.sort(key=lambda x: x['match_percent'], reverse=True)
    return {"suggestions": suggestions[:5]}

@api_router.get("/meal-plans/check/{video_id}")
async def check_video_planned(video_id: str):
    """Check if a video is already planned"""
    existing = await db.meal_plans.find_one(
        {"youtube_video_id": video_id},
        {"_id": 0, "id": 1, "date": 1, "meal_type": 1}
    )
    
    if existing:
        # Format the date nicely
        plan_date = datetime.strptime(existing['date'], "%Y-%m-%d")
        day_name = plan_date.strftime("%A")
        meal_type = existing.get('meal_type', 'meal')
        
        # Capitalize meal type for display
        meal_display = meal_type.capitalize()
        
        return {
            "is_planned": True,
            "plan_id": existing['id'],
            "date": existing['date'],
            "meal_type": meal_type,
            "display_text": f"{day_name}'s {meal_display}"
        }
    
    return {"is_planned": False}

@api_router.get("/inventory/reservations")
async def get_inventory_with_reservations():
    """Get inventory items with their reservations"""
    items = await db.inventory.find({}, {"_id": 0}).to_list(500)
    
    # Process reservations
    for item in items:
        reservations = item.get('reserved_for', [])
        if reservations:
            # Calculate total reserved quantity
            total_reserved = sum(r.get('qty', 0) for r in reservations)
            item['total_reserved'] = total_reserved
            item['has_reservations'] = True
            # Get next reservation date
            upcoming = sorted(reservations, key=lambda x: x.get('date', ''))
            if upcoming:
                item['next_reservation'] = upcoming[0]
        else:
            item['total_reserved'] = 0
            item['has_reservations'] = False
            item['next_reservation'] = None
    
    return items


@api_router.post("/meal-plans/refresh-videos")
async def refresh_meal_plan_videos():
    """Refresh video IDs for existing meal plans from recipe database"""
    # Create a mapping of recipe titles to video IDs
    recipe_video_map = {}
    for recipe in RECIPE_DATABASE:
        title = recipe.get('title', '').lower().strip()
        video_id = recipe.get('video_id')
        if title and video_id:
            recipe_video_map[title] = {
                'video_id': video_id,
                'thumbnail': recipe.get('thumbnail', '')
            }
    
    # Get all meal plans
    meal_plans = await db.meal_plans.find({}, {"_id": 0}).to_list(length=1000)
    updated_count = 0
    
    for plan in meal_plans:
        meal_name = plan.get('meal_name', '').lower().strip()
        if meal_name in recipe_video_map:
            new_video = recipe_video_map[meal_name]
            if plan.get('youtube_video_id') != new_video['video_id']:
                await db.meal_plans.update_one(
                    {"id": plan['id']},
                    {"$set": {
                        "youtube_video_id": new_video['video_id'],
                        "youtube_thumbnail": new_video['thumbnail']
                    }}
                )
                updated_count += 1
    
    return {"message": f"Updated {updated_count} meal plans with correct video IDs"}


# ============ RECIPE COMMUNITY ENDPOINTS ============

@api_router.post("/recipes", response_model=Recipe)
async def create_recipe(recipe: RecipeCreate):
    """Post a recipe to community"""
    # Extract video ID from URL
    video_id = recipe.youtube_url.split('v=')[-1].split('&')[0]
    
    recipe_dict = recipe.model_dump()
    recipe_obj = Recipe(**recipe_dict, youtube_video_id=video_id)
    
    # Fetch video details
    video_details = await fetch_video_details(video_id)
    recipe_obj.youtube_thumbnail = video_details.get('thumbnail')
    
    doc = recipe_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.recipes.insert_one(doc)
    return recipe_obj

@api_router.get("/recipes", response_model=List[Recipe])
async def get_recipes():
    """Get community recipes"""
    recipes = await db.recipes.find({}, {"_id": 0}).to_list(1000)
    
    for recipe in recipes:
        if isinstance(recipe.get('created_at'), str):
            recipe['created_at'] = datetime.fromisoformat(recipe['created_at'])
    
    return recipes

# ============ YOUTUBE SEARCH ENDPOINT ============

@api_router.get("/youtube/search")
async def search_recipes(query: str, max_results: int = 10, favorite_channels: str = ""):
    """Search YouTube for recipes with favorite channel priority"""
    channels_list = [ch.strip() for ch in favorite_channels.split(',') if ch.strip()] if favorite_channels else []
    results = await search_youtube_recipes(query, max_results, channels_list)
    return {"results": results}

# ============ LOCAL RECIPE SEARCH ENDPOINT ============

@api_router.get("/recipes/search")
async def search_local_recipes_endpoint(ingredients: str = "", videos_only: bool = False, favorite_channels: str = "", max_results: int = 20, query: str = ""):
    """Search local recipe database by ingredients or text query with favorite channel priority"""
    # Parse ingredients from comma-separated string
    ingredients_list = [ing.strip() for ing in ingredients.split(',') if ing.strip()] if ingredients else []
    
    # Parse favorite channels
    channels_list = [ch.strip() for ch in favorite_channels.split(',') if ch.strip()] if favorite_channels else []
    
    # Search local database
    results = search_local_recipes(ingredients_list, videos_only, channels_list, query.strip())
    
    # Limit results
    limited_results = results[:max_results]
    
    return {
        "results": limited_results,
        "total_found": len(results),
        "search_criteria": {
            "ingredients": ingredients_list,
            "videos_only": videos_only,
            "favorite_channels": channels_list
        }
    }

# ============ USER PREFERENCES ENDPOINTS ============

@api_router.get("/preferences")
async def get_preferences():
    """Get user preferences"""
    prefs = await db.preferences.find_one({}, {"_id": 0})
    if not prefs:
        # Return default preferences
        return {"favorite_channels": []}
    return prefs

@api_router.put("/preferences")
async def update_preferences(preferences: dict):
    """Update user preferences"""
    preferences['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    # Upsert preferences
    await db.preferences.update_one(
        {},
        {"$set": preferences},
        upsert=True
    )
    
    return {"message": "Preferences updated successfully"}

@api_router.get("/preferences/favorite-channels")
async def get_favorite_channels():
    """Get favorite channels"""
    prefs = await db.preferences.find_one({}, {"_id": 0})
    if not prefs:
        return {"favorite_channels": []}
    return {"favorite_channels": prefs.get('favorite_channels', [])}

@api_router.post("/preferences/favorite-channels")
async def add_favorite_channel(channel_data: dict):
    """Add a favorite channel"""
    channel_id = channel_data.get('channel_id')
    channel_name = channel_data.get('channel_name')
    
    if not channel_id or not channel_name:
        raise HTTPException(status_code=400, detail="Channel ID and name required")
    
    # Get current preferences
    prefs = await db.preferences.find_one({})
    if not prefs:
        prefs = {"favorite_channels": []}
    
    # Add channel if not already in list
    channel_entry = {"id": channel_id, "name": channel_name}
    if not any(ch.get('id') == channel_id for ch in prefs.get('favorite_channels', [])):
        prefs['favorite_channels'].append(channel_entry)
        prefs['updated_at'] = datetime.now(timezone.utc).isoformat()
        
        await db.preferences.update_one(
            {},
            {"$set": prefs},
            upsert=True
        )
    
    return {"message": "Channel added to favorites"}

@api_router.delete("/preferences/favorite-channels/{channel_id}")
async def remove_favorite_channel(channel_id: str):
    """Remove a favorite channel"""
    result = await db.preferences.update_one(
        {},
        {"$pull": {"favorite_channels": {"id": channel_id}}}
    )
    
    if result.modified_count > 0:
        return {"message": "Channel removed from favorites"}
    else:
        raise HTTPException(status_code=404, detail="Channel not found in favorites")

# ============ TRANSLATION ENDPOINT ============

@api_router.post("/translate")
async def translate(request: TranslationRequest):
    """Translate text to multiple languages with verification status"""
    translations = {}
    
    for target_lang in request.target_languages:
        result = await translate_text(request.text, target_lang)
        translations[target_lang] = result
    
    return {
        "original_text": request.text,
        "source_language": request.source_language,
        "translations": translations
    }

@api_router.post("/translate/batch")
async def translate_batch(texts: List[str], target_language: str = "hi", user_id: Optional[str] = None):
    """Batch translate multiple texts efficiently"""
    results = {}
    
    for text in texts:
        result = await translate_text(text, target_language, user_id)
        results[text] = result
    
    return {
        "target_language": target_language,
        "translations": results
    }

@api_router.post("/translate/verify")
async def verify_translation(request: TranslationVerifyRequest):
    """
    User verifies a translation as correct.
    Increments community count, marks as gold verified at threshold.
    """
    try:
        # Find the translation
        translation = await db.translations.find_one({
            "source_text": {"$regex": f"^{re.escape(request.source_text)}$", "$options": "i"},
            "target_language": request.target_language
        })
        
        if not translation:
            # Create new verified entry
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
        
        # Increment verification count
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

@api_router.post("/translate/edit")
async def edit_translation(request: TranslationEditRequest, user_id: str = "default_user"):
    """
    User provides custom "Dadi Override" translation.
    Stored per-user and never overwritten by AI.
    """
    try:
        # Find or create translation entry
        translation = await db.translations.find_one({
            "source_text": {"$regex": f"^{re.escape(request.source_text)}$", "$options": "i"},
            "target_language": request.target_language
        })
        
        if translation:
            # Update with custom label
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
            # Create new entry with custom label
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

@api_router.get("/translate/community-verified")
async def get_community_verified_translations(target_language: str = "hi"):
    """Get all community-verified (gold) translations"""
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

# ============ FESTIVAL INTELLIGENCE ENDPOINT ============

@api_router.get("/festival-alert")
async def get_festival_intelligence():
    """Get festival-based smart suggestions"""
    alert = await get_festival_alert()
    return alert

# ============ GAP ANALYSIS ENDPOINT ============

@api_router.get("/gap-analysis")
async def get_gap_analysis():
    """Analyze meal plan vs inventory to find missing ingredients"""
    # Get all meal plans
    meal_plans = await db.meal_plans.find({}, {"_id": 0}).to_list(1000)
    
    # Get all inventory
    inventory = await db.inventory.find({}, {"_id": 0}).to_list(1000)
    inventory_names = {item['name_en'].lower() for item in inventory if item.get('stock_level') in ['half', 'full']}
    
    # Find missing ingredients
    missing = []
    for plan in meal_plans:
        for ingredient in plan.get('ingredients_needed', []):
            if ingredient.lower() not in inventory_names:
                missing.append({
                    "ingredient": ingredient,
                    "meal": plan['meal_name'],
                    "date": plan['date']
                })
    
    return {"missing_ingredients": missing}

# ============ ROOT ENDPOINTS ============

# ============ BARCODE LOOKUP (Open Food Facts) ============

@api_router.get("/barcode/{barcode}")
async def lookup_barcode(barcode: str):
    """Lookup product details from barcode using Open Food Facts API"""
    try:
        async with httpx.AsyncClient() as client:
            # Open Food Facts API
            url = f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json"
            response = await client.get(url, timeout=10.0)
            data = response.json()
            
            if data.get('status') == 1 and data.get('product'):
                product = data['product']
                
                # Extract relevant info
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


# AI-Powered OCR Endpoint
class OCRRequest(BaseModel):
    image_base64: str
    ocr_type: str  # "product_name" or "expiry_date"

# Category keywords for auto-detection
CATEGORY_KEYWORDS = {
    'grains': ['rice', 'wheat', 'flour', 'atta', 'maida', 'sooji', 'rava', 'poha', 'oats', 'barley', 'millet', 'bajra', 'jowar', 'ragi', 'quinoa', 'semolina', 'besan', 'gram flour'],
    'spices': ['masala', 'spice', 'powder', 'turmeric', 'haldi', 'chili', 'mirchi', 'cumin', 'jeera', 'coriander', 'dhania', 'garam masala', 'biryani', 'curry', 'pepper', 'cardamom', 'elaichi', 'cinnamon', 'dalchini', 'clove', 'laung', 'ajwain', 'carom', 'mustard', 'rai', 'fenugreek', 'methi', 'asafoetida', 'hing', 'nutmeg', 'saffron', 'kesar', 'bay leaf', 'tej patta', 'salt', 'namak'],
    'pulses': ['dal', 'lentil', 'chana', 'chickpea', 'moong', 'toor', 'arhar', 'urad', 'masoor', 'rajma', 'kidney bean', 'black gram', 'green gram', 'split pea', 'moth', 'lobiya', 'chole'],
    'dairy': ['milk', 'doodh', 'ghee', 'butter', 'paneer', 'cheese', 'curd', 'yogurt', 'dahi', 'cream', 'khoya', 'mawa', 'condensed milk'],
    'oils': ['oil', 'tel', 'ghee', 'coconut oil', 'mustard oil', 'sunflower', 'groundnut', 'olive', 'sesame', 'til'],
    'bakery': ['bread', 'roti', 'naan', 'pav', 'bun', 'cake', 'biscuit', 'cookie', 'toast', 'croissant'],
    'snacks': ['chips', 'namkeen', 'bhujia', 'mixture', 'papad', 'crackers', 'wafers', 'popcorn', 'makhana', 'fox nuts'],
    'beverages': ['tea', 'chai', 'coffee', 'juice', 'drink', 'sharbat', 'lassi', 'buttermilk', 'chaas'],
    'vegetables': ['vegetable', 'sabzi', 'potato', 'aloo', 'onion', 'pyaaz', 'tomato', 'tamatar', 'carrot', 'gajar', 'peas', 'matar', 'beans', 'cabbage', 'cauliflower', 'gobi', 'spinach', 'palak', 'brinjal', 'baingan', 'okra', 'bhindi', 'capsicum', 'shimla mirch'],
    'fruits': ['fruit', 'apple', 'banana', 'mango', 'aam', 'orange', 'santra', 'grapes', 'angoor', 'pomegranate', 'anar', 'papaya', 'guava', 'amrood', 'watermelon', 'pineapple']
}

def guess_category(product_name: str) -> str:
    """Guess category based on product name keywords"""
    if not product_name:
        return 'other'
    
    product_lower = product_name.lower()
    
    for category, keywords in CATEGORY_KEYWORDS.items():
        for keyword in keywords:
            if keyword in product_lower:
                return category
    
    return 'other'

@api_router.post("/ocr/extract")
async def extract_text_from_image(request: OCRRequest):
    """
    Use AI vision to extract product name or expiry date from image.
    Much more accurate than traditional OCR for product packaging.
    """
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="OCR service not configured")
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        
        # Create chat instance with vision model
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"ocr-{uuid.uuid4()}",
            system_message="You are a precise OCR assistant that extracts text from product packaging images. Be concise and accurate."
        ).with_model("openai", "gpt-4o")
        
        # Prepare prompt based on OCR type
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
        else:  # expiry_date
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
        
        # Create message with image
        image_content = ImageContent(image_base64=request.image_base64)
        user_message = UserMessage(text=prompt, file_contents=[image_content])
        
        # Get response
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
        
        # For product name, also guess the category
        if request.ocr_type == "product_name":
            suggested_category = guess_category(result)
            return {
                "success": True,
                "ocr_type": request.ocr_type,
                "result": result,
                "suggested_category": suggested_category
            }
        
        # Validate expiry date format
        if request.ocr_type == "expiry_date":
            # Try to parse and validate the date
            date_match = re.search(r'(\d{4})-(\d{2})-(\d{2})', result)
            if date_match:
                result = date_match.group(0)
            else:
                # Try to extract any date-like pattern
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


# ============ YOUTUBE RECIPE DISCOVERY MODULE ============
# Cache-First Architecture for Quota-Efficient YouTube Searching

# Pydantic models for YouTube Discovery
class YouTubeSearchRequest(BaseModel):
    ingredients: List[str] = []
    text_query: str = ""
    max_results: int = 10

class YouTubeVideoSubmission(BaseModel):
    youtube_url: str

# Static recommendations - Dadi's Picks (pre-fetched, no API calls)
DADIS_RECOMMENDATIONS = [
    {
        "id": "dadi-1",
        "video_id": "eJlZW7keg5I",
        "title": "2 Kilo Pav Bhaji - Cooker Recipe",
        "channel": "MadhurasRecipe Marathi",
        "thumbnail": "https://i.ytimg.com/vi/eJlZW7keg5I/hqdefault.jpg",
        "duration": "12:45",
        "category": "festival_special",
        "tag": "🎉 Festival Special"
    },
    {
        "id": "dadi-2",
        "video_id": "4xzt4Itmp2U",
        "title": "Vegetable Pulao - One Pot Recipe",
        "channel": "Madhura's Recipe Marathi",
        "thumbnail": "https://i.ytimg.com/vi/4xzt4Itmp2U/hqdefault.jpg",
        "duration": "10:30",
        "category": "video_of_day",
        "tag": "⭐ Video of the Day"
    },
    {
        "id": "dadi-3",
        "video_id": "U24aNCL0YdQ",
        "title": "Authentic Misal Pav",
        "channel": "Madhura's Recipe Marathi",
        "thumbnail": "https://i.ytimg.com/vi/U24aNCL0YdQ/hqdefault.jpg",
        "duration": "15:20",
        "category": "trending",
        "tag": "🔥 Trending"
    },
    {
        "id": "dadi-4",
        "video_id": "NF7Eo30RBDA",
        "title": "Restaurant Style Dal Tadka",
        "channel": "Ranveer Brar",
        "thumbnail": "https://i.ytimg.com/vi/NF7Eo30RBDA/hqdefault.jpg",
        "duration": "8:45",
        "category": "quick_recipe",
        "tag": "⚡ Quick Recipe"
    },
    {
        "id": "dadi-5",
        "video_id": "ClH7QI02fNc",
        "title": "Instant Pav Bhaji in Pressure Cooker",
        "channel": "MadhurasRecipe",
        "thumbnail": "https://i.ytimg.com/vi/ClH7QI02fNc/hqdefault.jpg",
        "duration": "9:15",
        "category": "quick_recipe",
        "tag": "⚡ Quick Recipe"
    }
]

def extract_video_id(url: str) -> Optional[str]:
    """Extract YouTube video ID from various URL formats"""
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})',
        r'youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None

def calculate_inventory_match(recipe_ingredients: List[str], user_inventory: List[str]) -> dict:
    """Calculate how many recipe ingredients the user has"""
    if not recipe_ingredients:
        return {"matched": 0, "total": 0, "percentage": 0, "matched_items": [], "missing_items": []}
    
    user_inv_lower = [i.lower() for i in user_inventory]
    matched = []
    missing = []
    
    for ing in recipe_ingredients:
        ing_lower = ing.lower()
        found = any(inv in ing_lower or ing_lower in inv for inv in user_inv_lower)
        if found:
            matched.append(ing)
        else:
            missing.append(ing)
    
    total = len(recipe_ingredients)
    return {
        "matched": len(matched),
        "total": total,
        "percentage": round((len(matched) / total) * 100) if total > 0 else 0,
        "matched_items": matched,
        "missing_items": missing
    }

@api_router.get("/youtube/recommendations")
async def get_dadi_recommendations():
    """Get pre-fetched Dadi's Recommended videos - NO API calls, 0 quota cost"""
    return {
        "recommendations": DADIS_RECOMMENDATIONS,
        "source": "pre_fetched",
        "quota_cost": 0
    }

@api_router.post("/youtube/search")
async def youtube_recipe_search(request: YouTubeSearchRequest):
    """
    Cache-First YouTube Recipe Search
    - Checks MongoDB cache first (24-hour TTL)
    - Only calls YouTube API if cache miss
    - Returns inventory match percentages
    """
    # Build cache key from search params
    cache_key = f"{','.join(sorted(request.ingredients))}_{request.text_query}".lower().strip()
    if not cache_key or cache_key == "_":
        raise HTTPException(status_code=400, detail="Please provide ingredients or search text")
    
    # Check cache first
    cached = await db.search_cache.find_one({
        "cache_key": cache_key,
        "expires_at": {"$gt": datetime.now(timezone.utc)}
    })
    
    if cached:
        logger.info(f"Cache HIT for: {cache_key}")
        # Get user inventory for match calculation
        inventory_items = await db.inventory.find({}, {"name_en": 1, "_id": 0}).to_list(100)
        user_inventory = [item["name_en"] for item in inventory_items]
        
        # Add inventory match to cached results
        results_with_match = []
        for video in cached.get("results", []):
            match_info = calculate_inventory_match(video.get("ingredients", []), user_inventory)
            results_with_match.append({**video, "inventory_match": match_info})
        
        return {
            "results": results_with_match,
            "total": len(results_with_match),
            "source": "cache",
            "quota_cost": 0,
            "cache_expires": cached.get("expires_at").isoformat() if cached.get("expires_at") else None
        }
    
    # Cache MISS - call YouTube API
    logger.info(f"Cache MISS for: {cache_key}")
    
    try:
        youtube = get_youtube_service()
        
        # Build search query
        if request.ingredients:
            search_query = f"{' '.join(request.ingredients)} recipe Indian"
        else:
            search_query = f"{request.text_query} recipe Indian"
        
        # Search YouTube (costs 100 quota units)
        search_request = youtube.search().list(
            part="snippet",
            q=search_query,
            type="video",
            maxResults=request.max_results,
            regionCode="IN",
            relevanceLanguage="en"
        )
        search_response = search_request.execute()
        
        video_ids = [item['id']['videoId'] for item in search_response.get('items', [])]
        
        # Get video details including duration (costs 1 unit per batch of 50)
        videos_with_details = []
        if video_ids:
            details_request = youtube.videos().list(
                part="snippet,contentDetails",
                id=",".join(video_ids)
            )
            details_response = details_request.execute()
            
            for item in details_response.get('items', []):
                # Parse duration from ISO 8601 format
                duration_iso = item['contentDetails']['duration']
                duration_match = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', duration_iso)
                if duration_match:
                    hours = int(duration_match.group(1) or 0)
                    minutes = int(duration_match.group(2) or 0)
                    seconds = int(duration_match.group(3) or 0)
                    if hours > 0:
                        duration_str = f"{hours}:{minutes:02d}:{seconds:02d}"
                    else:
                        duration_str = f"{minutes}:{seconds:02d}"
                else:
                    duration_str = "N/A"
                
                # Try to extract ingredients from description (basic extraction)
                description = item['snippet'].get('description', '')
                ingredients = extract_ingredients_from_description(description)
                
                videos_with_details.append({
                    "video_id": item['id'],
                    "title": item['snippet']['title'],
                    "channel": item['snippet']['channelTitle'],
                    "channel_id": item['snippet']['channelId'],
                    "thumbnail": item['snippet']['thumbnails'].get('high', {}).get('url', 
                                 item['snippet']['thumbnails'].get('medium', {}).get('url', '')),
                    "duration": duration_str,
                    "description": description[:500],  # First 500 chars
                    "ingredients": ingredients,
                    "published_at": item['snippet']['publishedAt']
                })
        
        # Store in cache with 24-hour TTL
        cache_doc = {
            "cache_key": cache_key,
            "search_query": search_query,
            "results": videos_with_details,
            "created_at": datetime.now(timezone.utc),
            "expires_at": datetime.now(timezone.utc) + timedelta(hours=24)
        }
        await db.search_cache.update_one(
            {"cache_key": cache_key},
            {"$set": cache_doc},
            upsert=True
        )
        
        # Get user inventory for match calculation
        inventory_items = await db.inventory.find({}, {"name_en": 1, "_id": 0}).to_list(100)
        user_inventory = [item["name_en"] for item in inventory_items]
        
        # Add inventory match to results
        results_with_match = []
        for video in videos_with_details:
            match_info = calculate_inventory_match(video.get("ingredients", []), user_inventory)
            results_with_match.append({**video, "inventory_match": match_info})
        
        return {
            "results": results_with_match,
            "total": len(results_with_match),
            "source": "youtube_api",
            "quota_cost": 101,  # 100 for search + 1 for video details
            "cache_expires": cache_doc["expires_at"].isoformat()
        }
        
    except HttpError as e:
        if 'quotaExceeded' in str(e):
            logger.error("YouTube API quota exceeded")
            # Fall back to local recipe database
            local_results = search_local_recipes(request.ingredients, False, [], request.text_query)
            return {
                "results": local_results[:request.max_results],
                "total": len(local_results),
                "source": "local_fallback",
                "quota_cost": 0,
                "error": "YouTube quota exceeded, showing local recipes"
            }
        raise HTTPException(status_code=500, detail=f"YouTube API error: {str(e)}")

def extract_ingredients_from_description(description: str) -> List[str]:
    """Basic ingredient extraction from video description"""
    ingredients = []
    common_ingredients = [
        "onion", "tomato", "potato", "garlic", "ginger", "chili", "turmeric",
        "cumin", "coriander", "garam masala", "salt", "oil", "ghee", "butter",
        "rice", "dal", "paneer", "chicken", "mutton", "fish", "egg",
        "carrot", "peas", "cauliflower", "capsicum", "spinach", "methi",
        "milk", "cream", "curd", "yogurt", "coconut", "tamarind",
        "mustard", "curry leaves", "bay leaf", "cinnamon", "cardamom", "cloves"
    ]
    
    desc_lower = description.lower()
    for ing in common_ingredients:
        if ing in desc_lower:
            ingredients.append(ing.title())
    
    return ingredients[:10]  # Limit to 10 ingredients

@api_router.post("/youtube/add-video")
async def add_user_video(submission: YouTubeVideoSubmission):
    """
    Add user-submitted YouTube video
    Uses videos.list API (only 1 quota unit vs 100 for search)
    """
    video_id = extract_video_id(submission.youtube_url)
    if not video_id:
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")
    
    # Check if already in user's saved videos
    existing = await db.user_videos.find_one({"video_id": video_id})
    if existing:
        return {"success": True, "video": existing, "message": "Video already saved", "quota_cost": 0}
    
    try:
        youtube = get_youtube_service()
        
        # Fetch video details (costs only 1 quota unit!)
        request = youtube.videos().list(
            part="snippet,contentDetails",
            id=video_id
        )
        response = request.execute()
        
        if not response.get('items'):
            raise HTTPException(status_code=404, detail="Video not found")
        
        item = response['items'][0]
        
        # Parse duration
        duration_iso = item['contentDetails']['duration']
        duration_match = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', duration_iso)
        if duration_match:
            hours = int(duration_match.group(1) or 0)
            minutes = int(duration_match.group(2) or 0)
            seconds = int(duration_match.group(3) or 0)
            duration_str = f"{hours}:{minutes:02d}:{seconds:02d}" if hours else f"{minutes}:{seconds:02d}"
        else:
            duration_str = "N/A"
        
        # Extract ingredients from description
        description = item['snippet'].get('description', '')
        ingredients = extract_ingredients_from_description(description)
        
        video_doc = {
            "id": str(uuid.uuid4()),
            "video_id": video_id,
            "title": item['snippet']['title'],
            "channel": item['snippet']['channelTitle'],
            "channel_id": item['snippet']['channelId'],
            "thumbnail": item['snippet']['thumbnails'].get('high', {}).get('url', ''),
            "duration": duration_str,
            "description": description[:500],
            "ingredients": ingredients,
            "source": "user_submitted",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.user_videos.insert_one(video_doc)
        
        # Remove _id before returning
        video_doc.pop('_id', None)
        
        return {
            "success": True,
            "video": video_doc,
            "message": "Video added successfully",
            "quota_cost": 1
        }
        
    except HttpError as e:
        logger.error(f"YouTube API error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch video: {str(e)}")

@api_router.get("/youtube/user-videos")
async def get_user_videos():
    """Get all user-submitted videos"""
    videos = await db.user_videos.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"videos": videos, "total": len(videos)}

@api_router.delete("/youtube/user-videos/{video_id}")
async def delete_user_video(video_id: str):
    """Delete a user-submitted video"""
    result = await db.user_videos.delete_one({"video_id": video_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Video not found")
    return {"success": True, "message": "Video deleted"}

@api_router.get("/youtube/cache-stats")
async def get_cache_stats():
    """Get cache statistics for monitoring"""
    total_cached = await db.search_cache.count_documents({})
    active_cached = await db.search_cache.count_documents({
        "expires_at": {"$gt": datetime.now(timezone.utc)}
    })
    return {
        "total_cached_searches": total_cached,
        "active_cache_entries": active_cached,
        "cache_ttl_hours": 24
    }

# ============ PERSONALIZED RECIPE STREAM ============
# Fetches videos from favorite channels' upload playlists
# Matches against user inventory with regex

async def get_channel_upload_playlist(channel_name: str) -> Optional[Dict[str, Any]]:
    """
    Get channel info including upload playlist ID
    Uses channels.list with part=contentDetails (costs 1 unit)
    """
    try:
        youtube = get_youtube_service()
        
        # First search for channel by name
        search_request = youtube.search().list(
            part="snippet",
            q=channel_name,
            type="channel",
            maxResults=1
        )
        search_response = search_request.execute()
        
        if not search_response.get('items'):
            return None
        
        channel_id = search_response['items'][0]['snippet']['channelId']
        channel_title = search_response['items'][0]['snippet']['title']
        channel_thumbnail = search_response['items'][0]['snippet']['thumbnails'].get('default', {}).get('url', '')
        
        # Get channel details including upload playlist
        channel_request = youtube.channels().list(
            part="contentDetails,snippet",
            id=channel_id
        )
        channel_response = channel_request.execute()
        
        if not channel_response.get('items'):
            return None
        
        channel_data = channel_response['items'][0]
        uploads_playlist_id = channel_data['contentDetails']['relatedPlaylists']['uploads']
        
        return {
            "channel_id": channel_id,
            "channel_name": channel_title,
            "thumbnail": channel_thumbnail,
            "uploads_playlist_id": uploads_playlist_id
        }
        
    except HttpError as e:
        logger.error(f"Error fetching channel info: {e}")
        return None

async def get_playlist_videos(playlist_id: str, max_results: int = 20) -> List[Dict[str, Any]]:
    """
    Get videos from a playlist (costs 1 unit per 50 videos)
    Much cheaper than search!
    """
    try:
        youtube = get_youtube_service()
        
        request = youtube.playlistItems().list(
            part="snippet,contentDetails",
            playlistId=playlist_id,
            maxResults=max_results
        )
        response = request.execute()
        
        videos = []
        for item in response.get('items', []):
            snippet = item['snippet']
            videos.append({
                "video_id": snippet['resourceId']['videoId'],
                "title": snippet['title'],
                "description": snippet.get('description', '')[:500],
                "channel": snippet['channelTitle'],
                "channel_id": snippet['channelId'],
                "thumbnail": snippet['thumbnails'].get('high', snippet['thumbnails'].get('medium', {})).get('url', ''),
                "published_at": snippet['publishedAt']
            })
        
        return videos
        
    except HttpError as e:
        logger.error(f"Error fetching playlist videos: {e}")
        return []

def match_ingredients_in_text(text: str, inventory_items: List[str], min_matches: int = 2) -> Dict[str, Any]:
    """
    Case-insensitive regex match of inventory items against text
    Returns match info only if min_matches threshold is met
    """
    text_lower = text.lower()
    matched_items = []
    
    for item in inventory_items:
        # Create flexible regex pattern
        item_lower = item.lower()
        # Match word boundaries for better accuracy
        pattern = r'\b' + re.escape(item_lower) + r'\b'
        if re.search(pattern, text_lower):
            matched_items.append(item)
            continue
        # Also try without word boundaries for compound words
        if item_lower in text_lower:
            matched_items.append(item)
    
    match_count = len(matched_items)
    
    return {
        "matched_count": match_count,
        "matched_items": matched_items,
        "meets_threshold": match_count >= min_matches,
        "match_percentage": round((match_count / len(inventory_items)) * 100) if inventory_items else 0
    }

@api_router.get("/stream/channels")
async def get_favorite_channels_with_info():
    """
    Get favorite channels with their YouTube info (avatars, etc.)
    Caches channel info to avoid repeated API calls
    """
    # Get user's favorite channels
    prefs = await db.preferences.find_one({}, {"_id": 0})
    favorite_channels = prefs.get('favorite_channels', []) if prefs else []
    
    if not favorite_channels:
        return {"channels": [], "message": "No favorite channels set"}
    
    channels_with_info = []
    
    for channel in favorite_channels:
        channel_name = channel.get('name', '')
        
        # Check cache first
        cached = await db.channel_info_cache.find_one({
            "channel_name_lower": channel_name.lower(),
            "expires_at": {"$gt": datetime.now(timezone.utc)}
        })
        
        if cached:
            channels_with_info.append({
                "id": channel.get('id'),
                "name": channel_name,
                "channel_id": cached.get('channel_id'),
                "thumbnail": cached.get('thumbnail'),
                "uploads_playlist_id": cached.get('uploads_playlist_id')
            })
        else:
            # Fetch from YouTube API
            channel_info = await get_channel_upload_playlist(channel_name)
            if channel_info:
                # Cache for 7 days
                cache_doc = {
                    "channel_name_lower": channel_name.lower(),
                    "channel_id": channel_info['channel_id'],
                    "channel_name": channel_info['channel_name'],
                    "thumbnail": channel_info['thumbnail'],
                    "uploads_playlist_id": channel_info['uploads_playlist_id'],
                    "created_at": datetime.now(timezone.utc),
                    "expires_at": datetime.now(timezone.utc) + timedelta(days=7)
                }
                await db.channel_info_cache.update_one(
                    {"channel_name_lower": channel_name.lower()},
                    {"$set": cache_doc},
                    upsert=True
                )
                
                channels_with_info.append({
                    "id": channel.get('id'),
                    "name": channel_name,
                    "channel_id": channel_info['channel_id'],
                    "thumbnail": channel_info['thumbnail'],
                    "uploads_playlist_id": channel_info['uploads_playlist_id']
                })
            else:
                # Channel not found on YouTube, use placeholder
                channels_with_info.append({
                    "id": channel.get('id'),
                    "name": channel_name,
                    "channel_id": None,
                    "thumbnail": None,
                    "uploads_playlist_id": None
                })
    
    return {"channels": channels_with_info}

@api_router.get("/stream/feed")
async def get_personalized_recipe_stream(
    channel_filter: Optional[str] = None,
    min_matches: int = 2,
    max_videos_per_channel: int = 15
):
    """
    Get personalized recipe feed from favorite channels
    - Fetches from upload playlists (1 unit per channel vs 100 for search)
    - Matches video title/description against user inventory
    - Only returns videos with min_matches ingredients
    """
    # Get user inventory
    inventory_items = await db.inventory.find(
        {"stock_level": {"$ne": "empty"}},
        {"name_en": 1, "_id": 0}
    ).to_list(100)
    user_inventory = [item["name_en"] for item in inventory_items]
    
    if not user_inventory:
        return {
            "feed": [],
            "message": "Add items to your inventory to see personalized recipes",
            "quota_cost": 0
        }
    
    # Get favorite channels
    prefs = await db.preferences.find_one({}, {"_id": 0})
    favorite_channels = prefs.get('favorite_channels', []) if prefs else []
    
    if not favorite_channels:
        return {
            "feed": [],
            "message": "Add favorite channels to see personalized recipes",
            "quota_cost": 0
        }
    
    # Filter to specific channel if requested
    if channel_filter:
        favorite_channels = [ch for ch in favorite_channels if ch.get('id') == channel_filter or ch.get('name', '').lower() == channel_filter.lower()]
    
    matched_videos = []
    quota_used = 0
    
    for channel in favorite_channels:
        channel_name = channel.get('name', '')
        
        # Get cached channel info
        cached_info = await db.channel_info_cache.find_one({
            "channel_name_lower": channel_name.lower()
        })
        
        playlist_id = None
        channel_thumbnail = None
        
        if cached_info and cached_info.get('uploads_playlist_id'):
            playlist_id = cached_info['uploads_playlist_id']
            channel_thumbnail = cached_info.get('thumbnail')
        else:
            # Fetch channel info (costs ~2 units)
            channel_info = await get_channel_upload_playlist(channel_name)
            quota_used += 2
            if channel_info:
                playlist_id = channel_info['uploads_playlist_id']
                channel_thumbnail = channel_info['thumbnail']
                # Cache it
                await db.channel_info_cache.update_one(
                    {"channel_name_lower": channel_name.lower()},
                    {"$set": {
                        **channel_info,
                        "channel_name_lower": channel_name.lower(),
                        "created_at": datetime.now(timezone.utc),
                        "expires_at": datetime.now(timezone.utc) + timedelta(days=7)
                    }},
                    upsert=True
                )
        
        if not playlist_id:
            continue
        
        # Check video cache for this playlist
        video_cache_key = f"playlist_{playlist_id}"
        cached_videos = await db.playlist_video_cache.find_one({
            "cache_key": video_cache_key,
            "expires_at": {"$gt": datetime.now(timezone.utc)}
        })
        
        if cached_videos:
            videos = cached_videos.get('videos', [])
        else:
            # Fetch from playlist (costs 1 unit)
            videos = await get_playlist_videos(playlist_id, max_videos_per_channel)
            quota_used += 1
            
            # Cache for 6 hours
            if videos:
                await db.playlist_video_cache.update_one(
                    {"cache_key": video_cache_key},
                    {"$set": {
                        "cache_key": video_cache_key,
                        "playlist_id": playlist_id,
                        "videos": videos,
                        "created_at": datetime.now(timezone.utc),
                        "expires_at": datetime.now(timezone.utc) + timedelta(hours=6)
                    }},
                    upsert=True
                )
        
        # Match videos against inventory
        for video in videos:
            combined_text = f"{video['title']} {video.get('description', '')}"
            match_info = match_ingredients_in_text(combined_text, user_inventory, min_matches)
            
            if match_info['meets_threshold']:
                matched_videos.append({
                    **video,
                    "channel_thumbnail": channel_thumbnail,
                    "inventory_match": {
                        "matched_count": match_info['matched_count'],
                        "matched_items": match_info['matched_items'],
                        "total_inventory": len(user_inventory),
                        "percentage": match_info['match_percentage']
                    }
                })
    
    # Sort by match percentage (highest first)
    matched_videos.sort(key=lambda x: x['inventory_match']['percentage'], reverse=True)
    
    return {
        "feed": matched_videos,
        "total_matches": len(matched_videos),
        "inventory_items_used": len(user_inventory),
        "channels_checked": len(favorite_channels),
        "quota_cost": quota_used
    }

@api_router.post("/stream/refresh")
async def refresh_channel_feed(channel_name: Optional[str] = None):
    """
    Force refresh the feed cache for a channel or all channels
    """
    if channel_name:
        # Clear specific channel cache
        await db.channel_info_cache.delete_one({"channel_name_lower": channel_name.lower()})
        # Clear associated playlist cache
        cached_info = await db.channel_info_cache.find_one({"channel_name_lower": channel_name.lower()})
        if cached_info and cached_info.get('uploads_playlist_id'):
            await db.playlist_video_cache.delete_one({"playlist_id": cached_info['uploads_playlist_id']})
        return {"message": f"Cache cleared for {channel_name}"}
    else:
        # Clear all stream caches
        await db.playlist_video_cache.delete_many({})
        return {"message": "All playlist caches cleared"}

@api_router.get("/")
async def root():
    return {"message": "Rasoi-Sync API is running!"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

@app.on_event("startup")
async def startup_event():
    # Create indexes
    await db.translation_cache.create_index([("source_text", 1), ("target_language", 1)], unique=True)
    await db.translation_cache.create_index("created_at", expireAfterSeconds=86400)
    
    # YouTube search cache indexes
    await db.search_cache.create_index("cache_key", unique=True)
    await db.search_cache.create_index("expires_at", expireAfterSeconds=0)  # TTL index
    
    # User videos index
    await db.user_videos.create_index("video_id", unique=True)
    
    # Personalized stream cache indexes
    await db.channel_info_cache.create_index("channel_name_lower", unique=True)
    await db.channel_info_cache.create_index("expires_at", expireAfterSeconds=0)
    await db.playlist_video_cache.create_index("cache_key", unique=True)
    await db.playlist_video_cache.create_index("expires_at", expireAfterSeconds=0)
    
    logger.info("Rasoi-Sync backend started successfully!")
