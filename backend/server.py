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
    meal_name: str
    youtube_video_id: Optional[str] = None
    youtube_thumbnail: Optional[str] = None
    youtube_title: Optional[str] = None
    ingredients_needed: List[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MealPlanCreate(BaseModel):
    date: str
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

async def search_youtube_recipes(query: str, max_results: int = 10) -> List[Dict[str, Any]]:
    """Search YouTube for recipe videos"""
    try:
        youtube = get_youtube_service()
        request = youtube.search().list(
            part="snippet",
            q=f"{query} recipe",
            type="video",
            maxResults=max_results,
            regionCode="IN"
        )
        response = request.execute()
        
        results = []
        for item in response.get('items', []):
            results.append({
                'video_id': item['id']['videoId'],
                'title': item['snippet']['title'],
                'thumbnail': item['snippet']['thumbnails']['high']['url'],
                'channel': item['snippet']['channelTitle']
            })
        return results
    except HttpError as e:
        logger.error(f"YouTube search error: {e}")
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
    
    # Auto-translate
    name_gu = await translate_text(item.name_en, "gu")
    name_mr = await translate_text(item.name_en, "mr")
    
    shopping_item.name_gu = name_gu
    shopping_item.name_mr = name_mr
    
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
async def search_recipes(query: str, max_results: int = 10):
    """Search YouTube for recipes"""
    results = await search_youtube_recipes(query, max_results)
    return {"results": results}

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
