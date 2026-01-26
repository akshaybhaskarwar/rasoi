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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# API Keys
YOUTUBE_API_KEY = os.environ.get('YOUTUBE_API_KEY')
EMERGENT_API_KEY = os.environ.get('EMERGENT_API_KEY')

# Initialize translation client using Emergent API key
# Create credentials from API key for Google Cloud Translate
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = ''  # Not needed with API key
translation_client = None  # We'll use direct API calls with the key

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
    name_gu: Optional[str] = None
    name_mr: Optional[str] = None
    category: str
    stock_level: str = "empty"  # empty, low, half, full
    freshness: Optional[int] = None  # 0-100 for perishables
    is_secret_stash: bool = False
    unit: str = "kg"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class InventoryItemCreate(BaseModel):
    name_en: str
    name_mr: Optional[str] = None  # Accept Marathi name directly
    category: str
    stock_level: str = "empty"
    freshness: Optional[int] = None
    is_secret_stash: bool = False
    unit: str = "kg"

class ShoppingItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name_en: str
    name_gu: Optional[str] = None
    name_mr: Optional[str] = None
    category: str
    quantity: str
    store_type: str = "grocery"  # grocery or mandi
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ShoppingItemCreate(BaseModel):
    name_en: str
    name_mr: Optional[str] = None  # Accept Marathi name directly
    category: str
    quantity: str
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
    ingredients_needed: List[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MealPlanCreate(BaseModel):
    date: str
    meal_type: str  # breakfast, lunch, snacks, dinner
    meal_name: str
    youtube_video_id: Optional[str] = None
    ingredients_needed: List[str] = []

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

class FestivalAlert(BaseModel):
    date: str
    name: str
    message: str
    ingredients_needed: List[str] = []
    ingredients_in_stock: List[str] = []

# ============ TRANSLATION SERVICE ============

# Static translations for common ingredients (for demo purposes)
TRANSLATIONS = {
    "gu": {
        "turmeric": "હળદી",
        "turmeric powder": "હળદી પાવડર",
        "rice": "ચોખા",
        "wheat": "ઘઉં",
        "dal": "દાળ",
        "tuvar dal": "તુવેર દાળ",
        "moong dal": "મગ દાળ",
        "chana dal": "ચણા દાળ",
        "salt": "મીઠું",
        "sugar": "સાકર",
        "jaggery": "ગોળ",
        "oil": "તેલ",
        "ghee": "ઘી",
        "milk": "દૂધ",
        "curd": "દહીં",
        "paneer": "પનીર",
        "onion": "ડુંગળી",
        "garlic": "લસણ",
        "ginger": "આદુ",
        "tomato": "ટામેટા",
        "potato": "બટાટા",
        "carrot": "ગાજર",
        "cumin": "જીરું",
        "coriander": "ધાણા",
        "chili": "મરચું",
        "sesame": "તલ",
        "til": "તલ",
        "peanuts": "મગફળી"
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
        "sesame": "तीळ",
        "til": "तीळ",
        "peanuts": "शेंगदाणे"
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
        "video_id": "1IszT_guI08",
        "thumbnail": "https://i.ytimg.com/vi/1IszT_guI08/hqdefault.jpg",
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
        "video_id": "jkl345",
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
        "video_id": "mno678",
        "thumbnail": "https://i.ytimg.com/vi/NF7Eo30RBDA/hqdefault.jpg",
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
        "video_id": "pqr901",
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
        "video_id": "stu234",
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
        "video_id": "vwx567",
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
        "video_id": "yza890",
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
        "video_id": "bcd123",
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
        "video_id": "efg456",
        "thumbnail": "https://i.ytimg.com/vi/1IszT_guI08/hqdefault.jpg",
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
        "video_id": "hij789",
        "thumbnail": "https://i.ytimg.com/vi/7DYVHPj4AdY/hqdefault.jpg",
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
        "video_id": "klm012",
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
        "video_id": "nop345",
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
        "video_id": "qrs678",
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
        "video_id": "tuv901",
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
        "video_id": "wxy234",
        "thumbnail": "https://i.ytimg.com/vi/1IszT_guI08/hqdefault.jpg",
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
        "video_id": "zab567",
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
        "video_id": "cde890",
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
        "video_id": "fgh123",
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
        "video_id": "ijk456",
        "thumbnail": "https://i.ytimg.com/vi/1IszT_guI08/hqdefault.jpg",
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
        "video_id": "lmn789",
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
        "video_id": "opq012",
        "thumbnail": "https://i.ytimg.com/vi/JbOymPOMFbU/hqdefault.jpg",
        "ingredients": ["Potato", "Cauliflower", "Peas", "Carrot", "Tomato", "Onion", "Pav Bhaji Masala", "Butter", "Pav"],
        "prep_time": "20 min",
        "cook_time": "30 min",
        "servings": 4,
        "category": "Snacks"
    },
    {
        "id": "misal-pav-1",
        "title": "Misal Pav",
        "title_mr": "मिसळ पाव",
        "source": "Madhura's Recipe Marathi",
        "type": "video",
        "video_id": "rst345",
        "thumbnail": "https://i.ytimg.com/vi/1IszT_guI08/hqdefault.jpg",
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
        "video_id": "uvw678",
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

def search_local_recipes(ingredients: List[str], videos_only: bool = False, favorite_channels: List[str] = []) -> List[Dict[str, Any]]:
    """Search local recipe database by matching ingredients"""
    results = []
    ingredients_lower = [ing.lower() for ing in ingredients]
    favorite_channels_lower = [ch.lower() for ch in favorite_channels]
    
    for recipe in RECIPE_DATABASE:
        # Skip non-video recipes if videos_only filter is set
        if videos_only and recipe.get('type') != 'video':
            continue
            
        # If favorite channels are set, only include recipes from those channels
        if favorite_channels:
            source_lower = recipe.get('source', '').lower()
            if not any(fav in source_lower or source_lower in fav for fav in favorite_channels_lower):
                continue
        
        # Count matching ingredients
        recipe_ingredients_lower = [ing.lower() for ing in recipe.get('ingredients', [])]
        matches = sum(1 for ing in ingredients_lower if any(ing in r_ing or r_ing in ing for r_ing in recipe_ingredients_lower))
        
        if matches > 0:
            # Calculate match score (percentage of selected ingredients found in recipe)
            match_score = matches / len(ingredients_lower) if ingredients_lower else 0
            
            results.append({
                **recipe,
                'match_count': matches,
                'match_score': match_score,
                'is_favorite': bool(favorite_channels and any(
                    fav in recipe.get('source', '').lower() or recipe.get('source', '').lower() in fav 
                    for fav in favorite_channels_lower
                ))
            })
    
    # Sort by match score (descending), then by favorite status
    results.sort(key=lambda x: (x['match_score'], x['is_favorite']), reverse=True)
    
    return results

async def translate_text(text: str, target_lang: str) -> str:
    """Translate text using static dictionary"""
    try:
        # Check cache first
        cached = await db.translation_cache.find_one({
            "source_text": text,
            "target_language": target_lang
        })
        
        if cached:
            return cached['translated_text']
        
        # Use static translations
        text_lower = text.lower().strip()
        translated = TRANSLATIONS.get(target_lang, {}).get(text_lower, text)
        
        # Cache the translation
        await db.translation_cache.insert_one({
            "source_text": text,
            "target_language": target_lang,
            "translated_text": translated,
            "created_at": datetime.now(timezone.utc)
        })
        
        return translated
            
    except Exception as e:
        logger.error(f"Translation error: {e}")
        return text

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
        name_mr = await translate_text(item.name_en, "mr")
        inventory_item.name_mr = name_mr
    
    # Translate to Gujarati
    name_gu = await translate_text(item.name_en, "gu")
    inventory_item.name_gu = name_gu
    
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
        name_mr = await translate_text(item.name_en, "mr")
        shopping_item.name_mr = name_mr
    
    # Auto-translate to Gujarati
    name_gu = await translate_text(item.name_en, "gu")
    shopping_item.name_gu = name_gu
    
    doc = shopping_item.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.shopping_list.insert_one(doc)
    return shopping_item

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

@api_router.post("/meal-plans", response_model=MealPlan)
async def create_meal_plan(plan: MealPlanCreate):
    """Create meal plan"""
    plan_dict = plan.model_dump()
    meal_plan = MealPlan(**plan_dict)
    
    # Fetch YouTube details if video ID provided
    if plan.youtube_video_id:
        video_details = await fetch_video_details(plan.youtube_video_id)
        meal_plan.youtube_thumbnail = video_details.get('thumbnail')
        meal_plan.youtube_title = video_details.get('title')
    
    doc = meal_plan.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.meal_plans.insert_one(doc)
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
    """Delete meal plan"""
    result = await db.meal_plans.delete_one({"id": plan_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    return {"message": "Deleted successfully"}

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
async def search_local_recipes_endpoint(ingredients: str = "", videos_only: bool = False, favorite_channels: str = "", max_results: int = 20):
    """Search local recipe database by ingredients with favorite channel priority"""
    # Parse ingredients from comma-separated string
    ingredients_list = [ing.strip() for ing in ingredients.split(',') if ing.strip()] if ingredients else []
    
    # Parse favorite channels
    channels_list = [ch.strip() for ch in favorite_channels.split(',') if ch.strip()] if favorite_channels else []
    
    # Search local database
    results = search_local_recipes(ingredients_list, videos_only, channels_list)
    
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
    """Translate text to multiple languages"""
    translations = {}
    
    for target_lang in request.target_languages:
        translated = await translate_text(request.text, target_lang)
        translations[target_lang] = translated
    
    return {
        "original_text": request.text,
        "source_language": request.source_language,
        "translations": translations
    }

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
    logger.info("Rasoi-Sync backend started successfully!")
