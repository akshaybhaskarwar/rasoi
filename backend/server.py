"""
Rasoi-Sync API Server
An intelligent Indian Kitchen Manager

This is the main entry point that initializes all routes and services.
The codebase has been refactored into:
- /models/ - Pydantic models for data validation
- /data/ - Static data (translations, recipes, festivals)
- /services/ - Business logic services (translation, youtube)
- /routes/ - API route handlers
"""
from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path

# Import authentication and household modules
from auth import auth_router, create_auth_routes, decode_token, security
from households import household_router, create_household_routes
from realtime import sse_router, create_sse_routes, notify_inventory_change, notify_shopping_change, notify_household
from admin import admin_router, create_admin_routes, log_api_usage
from recipes import create_recipe_routes

# Import services
from services.translation import TranslationService
from services.youtube import YouTubeService

# Import routes
from routes.inventory import create_inventory_routes, inventory_router
from routes.shopping import create_shopping_routes, shopping_router
from routes.meal_plans import create_meal_plan_routes, meal_plans_router
from routes.translation import create_translation_routes, translation_router
from routes.youtube import create_youtube_routes, youtube_router
from routes.preferences import create_preferences_routes, preferences_router
from routes.barcode import create_barcode_routes, barcode_router
from routes.pantry_items import create_pantry_routes, pantry_router
from routes.dadi import create_dadi_routes, dadi_router

# Import data for festival endpoint
from data.festivals import FESTIVAL_CALENDAR
from models.common import FestivalAlert
from datetime import datetime, timezone, timedelta
from typing import Optional

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

# Create the main app
app = FastAPI(title="Rasoi-Sync API")
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize services
translate_service = TranslationService(db, GOOGLE_TRANSLATE_API_KEY, log_api_usage)
youtube_service = YouTubeService(YOUTUBE_API_KEY, db, log_api_usage)


# ============ FESTIVAL INTELLIGENCE ============

async def get_festival_alert() -> Optional[FestivalAlert]:
    """Check for upcoming festivals and provide smart suggestions"""
    today = datetime.now(timezone.utc).date()
    
    for days_ahead in range(0, 7):
        check_date = today + timedelta(days=days_ahead)
        date_str = check_date.strftime("%Y-%m-%d")
        
        if date_str in FESTIVAL_CALENDAR:
            festival = FESTIVAL_CALENDAR[date_str]
            
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


@api_router.get("/festival-alert")
async def get_festival_intelligence():
    """Get festival-based smart suggestions"""
    alert = await get_festival_alert()
    return alert


# ============ ROOT ENDPOINTS ============

@api_router.get("/")
async def root():
    return {"message": "Rasoi-Sync API is running!"}


@api_router.get("/health")
async def health():
    return {"status": "healthy"}


# ============ INITIALIZE ROUTES ============

# Initialize authentication and household routes
create_auth_routes(db)
create_household_routes(db, decode_token)
create_sse_routes(db, decode_token)
create_admin_routes(db, decode_token)

# Initialize recipe routes
recipe_router = create_recipe_routes(db, decode_token, translate_service.google_translate_api, notify_household)

# Initialize modular routes with dependencies
create_inventory_routes(db, decode_token, translate_service, notify_inventory_change)
create_shopping_routes(db, decode_token, translate_service, notify_shopping_change, notify_inventory_change)
create_meal_plan_routes(db, decode_token, youtube_service)
create_translation_routes(db, translate_service)
create_youtube_routes(db, decode_token, youtube_service, log_api_usage)
create_preferences_routes(db)
create_barcode_routes(db, EMERGENT_LLM_KEY)
create_pantry_routes(None)  # No dependencies needed
create_dadi_routes(db, decode_token)  # Digital Dadi routes

# ============ INCLUDE ROUTERS ============

app.include_router(api_router)
app.include_router(auth_router)
app.include_router(household_router)
app.include_router(sse_router)
app.include_router(admin_router)
app.include_router(recipe_router, prefix="/api")

# Include modular route routers
app.include_router(inventory_router)
app.include_router(shopping_router)
app.include_router(meal_plans_router)
app.include_router(translation_router)
app.include_router(youtube_router)
app.include_router(preferences_router)
app.include_router(barcode_router)
app.include_router(pantry_router)

# ============ CORS MIDDLEWARE ============

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============ LIFECYCLE EVENTS ============

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
    await db.search_cache.create_index("expires_at", expireAfterSeconds=0)
    
    # User videos index
    await db.user_videos.create_index("video_id", unique=True)
    
    # Personalized stream cache indexes
    await db.channel_info_cache.create_index("channel_name_lower", unique=True)
    await db.channel_info_cache.create_index("expires_at", expireAfterSeconds=0)
    await db.playlist_video_cache.create_index("cache_key", unique=True)
    await db.playlist_video_cache.create_index("expires_at", expireAfterSeconds=0)
    
    # User authentication indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.password_resets.create_index("token", unique=True)
    await db.password_resets.create_index("expires_at", expireAfterSeconds=0)
    
    # Household indexes
    await db.households.create_index("id", unique=True)
    await db.households.create_index("kitchen_code", unique=True)
    await db.households.create_index("members.user_id")
    
    # Inventory and shopping with household_id
    await db.inventory.create_index("household_id")
    await db.shopping_list.create_index("household_id")
    await db.meal_plans.create_index("household_id")
    
    # API usage tracking
    await db.api_usage.create_index("timestamp")
    await db.api_usage.create_index([("api_name", 1), ("timestamp", 1)])
    await db.api_usage.create_index("household_id")
    
    # Festivals
    await db.festivals.create_index("date")
    await db.festivals.create_index("id", unique=True)
    
    logger.info("Rasoi-Sync backend started successfully!")
