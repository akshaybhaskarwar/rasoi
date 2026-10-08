"""
User-Generated Recipe (UGR) Module for Rasoi-Sync
- Recipe CRUD operations
- Inventory linking
- Stock status calculation
- Auto-translation
- Real-time notifications via SSE
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, status, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import base64
import re

security = HTTPBearer()

# ============ PYDANTIC MODELS ============

class RecipeIngredient(BaseModel):
    """Individual ingredient in a recipe"""
    ingredient_name: str  # Original name as entered
    inventory_item_id: Optional[str] = None  # Link to inventory if matched
    quantity: float
    unit: str  # g, kg, cup, tsp, tbsp, piece, ml, L
    name_en: Optional[str] = None  # English name (for translation)
    name_mr: Optional[str] = None  # Marathi translation
    name_hi: Optional[str] = None  # Hindi translation

class RecipeStep(BaseModel):
    """Single instruction step"""
    step_number: int
    instruction: str
    duration_minutes: Optional[int] = None  # Optional cooking time for step

class VideoLink(BaseModel):
    """Video link (YouTube or Instagram)"""
    type: str  # "youtube" or "instagram"
    url: str
    title: Optional[str] = None

class RecipeCreate(BaseModel):
    """Model for creating a new recipe"""
    title: str
    chef_name: Optional[str] = None  # Family member who created it
    story: Optional[str] = None  # Heritage/family story
    ingredients: List[RecipeIngredient]
    instructions: List[RecipeStep]
    tags: List[str] = []  # e.g., "Quick Breakfast", "Fasting", "Festival Special"
    servings: int = 4
    prep_time_minutes: Optional[int] = None
    cook_time_minutes: Optional[int] = None
    photo_base64: Optional[str] = None  # Base64 encoded image
    video_links: Optional[List[VideoLink]] = []  # YouTube/Instagram video links
    is_published: bool = False  # Publish to community

class RecipeUpdate(BaseModel):
    """Model for updating a recipe"""
    title: Optional[str] = None
    chef_name: Optional[str] = None
    story: Optional[str] = None
    ingredients: Optional[List[RecipeIngredient]] = None
    instructions: Optional[List[RecipeStep]] = None
    tags: Optional[List[str]] = None
    servings: Optional[int] = None
    prep_time_minutes: Optional[int] = None
    cook_time_minutes: Optional[int] = None
    photo_base64: Optional[str] = None
    video_links: Optional[List[VideoLink]] = None
    is_published: Optional[bool] = None

class StockStatus(BaseModel):
    """Stock availability status for a recipe"""
    status: str  # 'green', 'yellow', 'red'
    message: str
    in_stock: List[Dict[str, Any]]
    missing: List[Dict[str, Any]]
    low_stock: List[Dict[str, Any]]

class YouTubeRecipeCreate(BaseModel):
    """Model for creating a YouTube-linked recipe"""
    youtube_video_id: str
    youtube_url: str
    title: str
    thumbnail: Optional[str] = None
    channel_name: Optional[str] = None
    channel_id: Optional[str] = None
    duration: Optional[str] = None
    description: Optional[str] = None
    detected_ingredients: List[str] = []
    matched_inventory_items: List[str] = []
    personal_note: Optional[str] = None
    categories: List[str] = []
    tags: List[str] = []

# ============ RECIPE TAGS ============

RECIPE_TAGS = [
    {"id": "quick-breakfast", "label_en": "Quick Breakfast", "label_mr": "झटपट नाश्ता", "label_hi": "जल्दी नाश्ता", "emoji": "🌅"},
    {"id": "lunch", "label_en": "Lunch", "label_mr": "दुपारचे जेवण", "label_hi": "दोपहर का खाना", "emoji": "🍱"},
    {"id": "dinner", "label_en": "Dinner", "label_mr": "रात्रीचे जेवण", "label_hi": "रात का खाना", "emoji": "🌙"},
    {"id": "snacks", "label_en": "Snacks", "label_mr": "नाश्ता", "label_hi": "नाश्ता", "emoji": "🍿"},
    {"id": "fasting", "label_en": "Fasting (Upvas)", "label_mr": "उपवास", "label_hi": "उपवास", "emoji": "🔱"},
    {"id": "festival", "label_en": "Festival Special", "label_mr": "सणाचे पदार्थ", "label_hi": "त्योहार विशेष", "emoji": "🎊"},
    {"id": "dessert", "label_en": "Dessert", "label_mr": "गोड पदार्थ", "label_hi": "मिठाई", "emoji": "🍮"},
    {"id": "healthy", "label_en": "Healthy", "label_mr": "आरोग्यदायी", "label_hi": "स्वस्थ", "emoji": "🥗"},
    {"id": "one-pot", "label_en": "One-Pot Meal", "label_mr": "एका भांड्यात", "label_hi": "एक बर्तन", "emoji": "🥘"},
    {"id": "kids-favorite", "label_en": "Kids Favorite", "label_mr": "मुलांचे आवडते", "label_hi": "बच्चों का पसंदीदा", "emoji": "👶"},
    {"id": "traditional", "label_en": "Traditional", "label_mr": "पारंपारिक", "label_hi": "पारंपरिक", "emoji": "🏺"},
    {"id": "grandmas-recipe", "label_en": "Grandma's Recipe", "label_mr": "आजीची रेसिपी", "label_hi": "दादी की रेसिपी", "emoji": "👵"},
    # Not a dish — families use recipe records to document poojas: the
    # "ingredients" are the samagri list, "instructions" are the vidhi,
    # and the stock badge + add-missing-to-shopping flow answer "what do
    # I need to buy before the pooja". Deliberately reusing the recipe
    # model instead of a new entity — one user request, zero new schema.
    {"id": "pooja-samagri", "label_en": "Pooja Samagri", "label_mr": "पूजा साहित्य", "label_hi": "पूजा सामग्री", "emoji": "🪔"},
]

UNIT_OPTIONS = [
    {"value": "g", "label": "grams (g)"},
    {"value": "kg", "label": "kilograms (kg)"},
    {"value": "ml", "label": "milliliters (ml)"},
    {"value": "L", "label": "liters (L)"},
    {"value": "cup", "label": "cup"},
    {"value": "tbsp", "label": "tablespoon (tbsp)"},
    {"value": "tsp", "label": "teaspoon (tsp)"},
    {"value": "piece", "label": "piece(s)"},
    {"value": "bunch", "label": "bunch"},
    {"value": "pinch", "label": "pinch"},
]


# ============ TEXT SEARCH ============
#
# Every $regex below is built from text a user typed. Unescaped, a stray "("
# or "*" is not a search for that character — it is an invalid regular
# expression, which Mongo rejects with an error, which surfaced as a 500 and
# a "Failed to load recipes" toast the moment anyone typed a bracket into the
# search box. re.escape() makes the input mean itself.


def contains_regex(text: str) -> Dict[str, str]:
    """Case-insensitive 'contains' match on literal user text."""
    return {"$regex": re.escape(text), "$options": "i"}


def equals_regex(text: str) -> Dict[str, str]:
    """Case-insensitive exact match on literal user text."""
    return {"$regex": f"^{re.escape(text)}$", "$options": "i"}


def recipe_search_clause(search: str) -> Dict[str, Any]:
    """Fields a recipe search looks at.

    Deliberately identical for the household list and the community feed —
    they used to differ (community ignored ingredients entirely), so the same
    query found a recipe in one tab and not the other.

    Includes name_mr/name_hi because every recipe stores its ingredients'
    Marathi and Hindi names, and households that cook in Marathi search in
    Marathi. The ingredient-suggest endpoint already searched all three
    languages; recipe search only ever looked at English.
    """
    match = contains_regex(search)
    return {"$or": [
        {"title": match},
        {"chef_name": match},
        {"story": match},
        {"ingredients.ingredient_name": match},
        {"ingredients.name_en": match},
        {"ingredients.name_mr": match},
        {"ingredients.name_hi": match},
    ]}


# ============ PHOTOS ============
#
# Photos are served as bytes from /recipes/{id}/photo, not inlined as base64
# into list responses. Two reasons:
#
#  1. base64 inside a JSON body cannot be cached by the browser. Every visit
#     to the Recipes tab re-downloaded every photo. A real image response with
#     Cache-Control is fetched once and then costs nothing.
#  2. base64 is 33% bigger than the bytes it encodes, and a list of 20 recipes
#     multiplied that waste by 20.
#
# Cache-Control is "private", never "public": this endpoint also serves a
# household's unpublished photos, and the deployment sits behind Cloudflare —
# "public" would let a shared cache hand one family's photo to a stranger.
# "private" still gets the browser cache, which is the win we are after.
#
# Paired with a ?v=<updated_at> cache buster from the client, so replacing a
# recipe's photo changes its URL instead of being masked by immutable.
PHOTO_CACHE_HEADERS = {"Cache-Control": "private, max-age=31536000, immutable"}


def decode_stored_photo(recipe: Dict[str, Any]) -> Optional[bytes]:
    """Photo bytes out of a recipe document, whichever shape it is stored in.

    Existing rows hold a base64 str in `photo_base64`. Reading both shapes
    means storage can be migrated to BSON binary (`photo`) later without
    touching this endpoint or the clients — the 33% storage saving is a
    separate migration, the wire format does not wait for it.
    """
    raw = recipe.get("photo")
    if isinstance(raw, (bytes, bytearray)):
        return bytes(raw)

    encoded = recipe.get("photo_base64")
    if isinstance(encoded, str) and encoded:
        try:
            return base64.b64decode(encoded, validate=False)
        except Exception:
            return None
    return None


# ============ FEED PAGINATION ============
#
# Keyset (cursor) pagination, not skip/limit. The community feed is ordered
# newest-first, and new recipes are published into the top of it while people
# are scrolling — with offsets, "page 2" would then re-show a recipe already
# seen on page 1 (everything shifts down by one). A cursor says "give me what
# sorts strictly after this exact row", so the page boundary stays anchored to
# a row rather than to a count, and Mongo can seek to it instead of walking
# and discarding the rows that came before.
#
# created_at alone is not a safe cursor key: two recipes published in the same
# millisecond would tie, and a tie at the page boundary silently drops rows.
# Pairing it with the recipe id gives a strict total order. created_at is
# stored as an ISO-8601 UTC string everywhere it is written, so string
# comparison is chronological comparison.
CURSOR_SORT = [("created_at", -1), ("id", -1)]


def list_pipeline(
    *stages: Dict[str, Any],
    viewer_id: Optional[str] = None
) -> List[Dict[str, Any]]:
    """A recipe-list aggregation: caller's stages, then the shared tail.

    The tail replaces two bulky fields with booleans — the photo with
    has_photo, and the liked_by user-id array with liked_by_me for this
    viewer. Both are *computed*, which is what lets existing rows work
    untouched with nothing to backfill, and keeps the response from
    publishing who liked what.

    Order matters: $match/$sort/$limit come first so the feed index still
    serves them, and the heavy fields are dropped only from the rows being
    returned.
    """
    return [
        *stages,
        # Presence test only — deliberately no $strLenCP or other string
        # operator, which would raise (and 500 the whole list) on a row whose
        # photo field is a different BSON type than expected. A row that
        # claims a photo but cannot produce one just 404s on the photo
        # endpoint, and the card falls back to its gradient hero.
        {"$addFields": {
            "has_photo": {"$or": [
                {"$ne": [{"$ifNull": ["$photo_base64", None]}, None]},
                {"$ne": [{"$ifNull": ["$photo", None]}, None]},
            ]},
            "liked_by_me": (
                {"$in": [viewer_id, {"$ifNull": ["$liked_by", []]}]}
                if viewer_id else False
            ),
        }},
        {"$project": {"_id": 0, "photo_base64": 0, "photo": 0, "liked_by": 0}},
    ]


def encode_feed_cursor(recipe: Dict[str, Any]) -> str:
    """Opaque cursor for the last row of a page."""
    raw = f"{recipe.get('created_at') or ''}|{recipe.get('id') or ''}"
    return base64.urlsafe_b64encode(raw.encode("utf-8")).decode("ascii")


def decode_feed_cursor(cursor: str) -> Dict[str, Any]:
    """Mongo filter for 'strictly after this row' in CURSOR_SORT order.

    Raises ValueError on anything malformed so the caller can answer 400
    rather than silently serving page 1 again.
    """
    try:
        raw = base64.urlsafe_b64decode(cursor.encode("ascii")).decode("utf-8")
        created_at, recipe_id = raw.split("|", 1)
    except Exception as exc:
        raise ValueError("malformed cursor") from exc

    if not created_at or not recipe_id:
        raise ValueError("incomplete cursor")

    return {"$or": [
        {"created_at": {"$lt": created_at}},
        {"created_at": created_at, "id": {"$lt": recipe_id}},
    ]}


def create_recipe_routes(db, decode_token, google_translate_api, notify_household):
    """Create recipe router with database and utility dependencies"""
    
    recipe_router = APIRouter(prefix="/recipes", tags=["recipes"])
    
    async def get_user_from_token(credentials):
        """Extract user from JWT token"""
        payload = decode_token(credentials.credentials)
        user_id = payload.get("sub")
        user = await db.users.find_one({"id": user_id})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    
    async def translate_ingredient(ingredient_name: str) -> Dict[str, str]:
        """Translate ingredient name to all supported languages"""
        translations = {"en": ingredient_name}
        
        # Translate to Hindi
        hi_translation = await google_translate_api(ingredient_name, "hi", "en")
        if hi_translation:
            translations["hi"] = hi_translation
        
        # Translate to Marathi
        mr_translation = await google_translate_api(ingredient_name, "mr", "en")
        if mr_translation:
            translations["mr"] = mr_translation
        
        return translations
    
    async def build_inventory_lookup(household_id: str) -> Dict[str, Dict[str, Any]]:
        """Case-insensitive name -> inventory item map for one household.

        Split out of calculate_stock_status so the LIST endpoints can fetch
        the household's inventory ONCE per request instead of once per
        recipe. The old shape was two queries per recipe (the recipe itself
        plus the full inventory), so a page of N recipes cost 2N round trips
        — the hidden reason the community feed's page size had to stay tiny.
        """
        inventory = await db.inventory.find(
            {"household_id": household_id},
            {"_id": 0}
        ).to_list(1000)

        inventory_lookup: Dict[str, Dict[str, Any]] = {}
        for item in inventory:
            name_lower = item.get("name_en", "").lower()
            if name_lower:
                inventory_lookup[name_lower] = item
        return inventory_lookup

    def compute_stock_status(
        recipe: Dict[str, Any],
        inventory_lookup: Dict[str, Dict[str, Any]]
    ) -> StockStatus:
        """Pure calculation over an already-fetched recipe + inventory map."""
        in_stock = []
        missing = []
        low_stock = []
        
        for ing in recipe.get("ingredients", []):
            ing_name = ing.get("ingredient_name", "").lower()
            ing_name_en = ing.get("name_en", ing.get("ingredient_name", "")).lower()
            
            # Try to find in inventory
            inv_item = inventory_lookup.get(ing_name) or inventory_lookup.get(ing_name_en)
            
            if inv_item:
                stock_level = inv_item.get("stock_level", "empty")
                ing_info = {
                    "ingredient": ing.get("ingredient_name"),
                    "required": f"{ing.get('quantity')} {ing.get('unit')}",
                    "stock_level": stock_level,
                    "inventory_item_id": inv_item.get("id")
                }
                
                if stock_level in ["full", "half"]:
                    in_stock.append(ing_info)
                elif stock_level == "low":
                    low_stock.append(ing_info)
                else:
                    missing.append(ing_info)
            else:
                missing.append({
                    "ingredient": ing.get("ingredient_name"),
                    "required": f"{ing.get('quantity')} {ing.get('unit')}",
                    "stock_level": "not_found",
                    "inventory_item_id": None
                })
        
        # Determine overall status
        total = len(recipe.get("ingredients", []))
        missing_count = len(missing)
        low_count = len(low_stock)
        
        if missing_count == 0 and low_count == 0:
            status = "green"
            message = "All ingredients in stock!"
        elif missing_count == 0 and low_count > 0:
            status = "yellow"
            message = f"{low_count} ingredient(s) running low"
        elif missing_count <= 2:
            status = "yellow"
            items = ", ".join([m["ingredient"] for m in missing[:2]])
            message = f"Missing {missing_count} item(s): {items}"
        else:
            status = "red"
            message = f"Missing {missing_count} of {total} ingredients"
        
        return StockStatus(
            status=status,
            message=message,
            in_stock=in_stock,
            missing=missing,
            low_stock=low_stock
        )

    async def calculate_stock_status(recipe_id: str, household_id: str) -> StockStatus:
        """Fetch-then-compute wrapper for single-recipe callers."""
        recipe = await db.user_recipes.find_one({"id": recipe_id})
        if not recipe:
            return StockStatus(status="red", message="Recipe not found", in_stock=[], missing=[], low_stock=[])

        inventory_lookup = await build_inventory_lookup(household_id)
        return compute_stock_status(recipe, inventory_lookup)
    
    # ============ API ENDPOINTS ============
    
    @recipe_router.get("/tags")
    async def get_recipe_tags():
        """Get all available recipe tags"""
        return {"tags": RECIPE_TAGS}
    
    @recipe_router.get("/units")
    async def get_unit_options():
        """Get all available unit options"""
        return {"units": UNIT_OPTIONS}
    
    @recipe_router.get("/suggest-ingredients")
    async def suggest_ingredients(
        query: str,
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """Auto-suggest ingredients from inventory as user types"""
        user = await get_user_from_token(credentials)
        household_id = user.get("active_household")
        
        if not household_id or len(query) < 2:
            return {"suggestions": []}
        
        # Search inventory for matching items
        search_regex = contains_regex(query)
        
        items = await db.inventory.find(
            {
                "household_id": household_id,
                "$or": [
                    {"name_en": search_regex},
                    {"name_mr": search_regex},
                    {"name_hi": search_regex}
                ]
            },
            {"_id": 0, "id": 1, "name_en": 1, "name_mr": 1, "name_hi": 1, "category": 1, "stock_level": 1}
        ).limit(10).to_list(10)
        
        suggestions = [{
            "id": item.get("id"),
            "name_en": item.get("name_en"),
            "name_mr": item.get("name_mr"),
            "name_hi": item.get("name_hi"),
            "category": item.get("category"),
            "stock_level": item.get("stock_level"),
            "in_inventory": True
        } for item in items]
        
        return {"suggestions": suggestions}
    
    @recipe_router.post("")
    async def create_recipe(
        recipe: RecipeCreate,
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """Create a new user-generated recipe"""
        user = await get_user_from_token(credentials)
        household_id = user.get("active_household")
        
        if not household_id:
            raise HTTPException(status_code=400, detail="No active household")
        
        recipe_id = str(uuid.uuid4())
        
        # Process ingredients with translations
        processed_ingredients = []
        for ing in recipe.ingredients:
            ing_dict = ing.dict()
            
            # Try to match with inventory
            if not ing.inventory_item_id:
                inv_item = await db.inventory.find_one({
                    "household_id": household_id,
                    "name_en": equals_regex(ing.ingredient_name)
                })
                if inv_item:
                    ing_dict["inventory_item_id"] = inv_item.get("id")
                    ing_dict["name_en"] = inv_item.get("name_en")
                    ing_dict["name_mr"] = inv_item.get("name_mr")
                    ing_dict["name_hi"] = inv_item.get("name_hi")
            
            # Translate if not already translated
            if not ing_dict.get("name_mr") or not ing_dict.get("name_hi"):
                translations = await translate_ingredient(ing.ingredient_name)
                ing_dict["name_en"] = ing_dict.get("name_en") or translations.get("en")
                ing_dict["name_mr"] = ing_dict.get("name_mr") or translations.get("mr")
                ing_dict["name_hi"] = ing_dict.get("name_hi") or translations.get("hi")
            
            processed_ingredients.append(ing_dict)
        
        # Process instructions
        instructions = [step.dict() for step in recipe.instructions]
        
        # Create recipe document
        video_links = []
        if recipe.video_links:
            video_links = [{"type": v.type, "url": v.url, "title": v.title} for v in recipe.video_links]

        recipe_doc = {
            "id": recipe_id,
            "household_id": household_id,
            "created_by": user.get("id"),
            "created_by_name": user.get("name"),
            "created_by_email": user.get("email"),
            "title": recipe.title,
            "chef_name": recipe.chef_name or user.get("name"),
            "story": recipe.story,
            "ingredients": processed_ingredients,
            "instructions": instructions,
            "tags": recipe.tags,
            "servings": recipe.servings,
            "prep_time_minutes": recipe.prep_time_minutes,
            "cook_time_minutes": recipe.cook_time_minutes,
            "photo_url": None,  # Will be set if photo uploaded
            "video_links": video_links,  # Store video links
            "is_published": recipe.is_published,
            "likes": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Handle photo upload (base64)
        # Earlier versions stored a TRUNCATED data URL ("data:image/jpeg;
        # base64,<first 100 chars>...") in photo_url — a broken string that
        # rendered as a missing image on the list view. Leave photo_url None
        # (the LIST endpoint now returns photo_base64 itself, so the front-
        # end card has a real source to render).
        if recipe.photo_base64:
            recipe_doc["photo_base64"] = recipe.photo_base64
        
        await db.user_recipes.insert_one(recipe_doc)
        
        # Calculate initial stock status
        stock_status = await calculate_stock_status(recipe_id, household_id)
        
        # Notify household members via SSE
        try:
            await notify_household(
                household_id,
                "new_recipe",
                {
                    "recipe_id": recipe_id,
                    "title": recipe.title,
                    "chef_name": recipe_doc["chef_name"],
                    "message": f"{recipe_doc['chef_name']} just uploaded a new recipe: {recipe.title}!"
                }
            )
        except Exception as e:
            print(f"SSE notification error: {e}")
        
        # Remove internal fields
        recipe_doc.pop("_id", None)
        recipe_doc.pop("photo_base64", None)
        
        return {
            **recipe_doc,
            "stock_status": stock_status.dict()
        }
    
    @recipe_router.post("/youtube")
    async def create_youtube_recipe(
        recipe: YouTubeRecipeCreate,
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """Create a recipe from a YouTube video link"""
        user = await get_user_from_token(credentials)
        household_id = user.get("active_household")
        
        if not household_id:
            raise HTTPException(status_code=400, detail="No active household")
        
        # Check if this video is already saved for this household
        existing = await db.user_recipes.find_one({
            "household_id": household_id,
            "youtube_video_id": recipe.youtube_video_id
        })
        
        if existing:
            raise HTTPException(status_code=400, detail="This video is already in your cookbook")
        
        recipe_id = str(uuid.uuid4())
        
        # Convert detected ingredients to recipe ingredient format
        processed_ingredients = []
        for ing_name in recipe.detected_ingredients:
            ing_dict = {
                "ingredient_name": ing_name,
                "quantity": 0,  # Unknown from video
                "unit": "as needed",
                "name_en": ing_name
            }
            
            # Try to translate
            try:
                translations = await translate_ingredient(ing_name)
                ing_dict["name_mr"] = translations.get("mr")
                ing_dict["name_hi"] = translations.get("hi")
            except:
                pass
            
            # Check if in inventory
            inv_item = await db.inventory.find_one({
                "household_id": household_id,
                "name_en": equals_regex(ing_name)
            })
            if inv_item:
                ing_dict["inventory_item_id"] = inv_item.get("id")
            
            processed_ingredients.append(ing_dict)
        
        # Create recipe document
        recipe_doc = {
            "id": recipe_id,
            "household_id": household_id,
            "created_by": user.get("id"),
            "created_by_name": user.get("name"),
            "created_by_email": user.get("email"),
            "title": recipe.title,
            "chef_name": recipe.channel_name or "YouTube",
            "story": recipe.personal_note,
            "ingredients": processed_ingredients,
            "instructions": [],  # No instructions from video
            "tags": recipe.tags or recipe.categories,
            "categories": recipe.categories,
            "servings": 4,  # Default
            "prep_time_minutes": None,
            "cook_time_minutes": None,
            "photo_url": recipe.thumbnail,
            "is_published": False,
            "likes": 0,
            # YouTube-specific fields
            "youtube_video_id": recipe.youtube_video_id,
            "youtube_url": recipe.youtube_url,
            "youtube_thumbnail": recipe.thumbnail,
            "youtube_channel": recipe.channel_name,
            "youtube_channel_id": recipe.channel_id,
            "youtube_duration": recipe.duration,
            "youtube_description": recipe.description,
            "detected_ingredients": recipe.detected_ingredients,
            "matched_inventory_items": recipe.matched_inventory_items,
            "personal_note": recipe.personal_note,
            "recipe_type": "youtube",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.user_recipes.insert_one(recipe_doc)
        
        # Calculate initial stock status
        stock_status = await calculate_stock_status(recipe_id, household_id)
        
        # Notify household members via SSE
        try:
            await notify_household(
                household_id,
                "new_recipe",
                {
                    "recipe_id": recipe_id,
                    "title": recipe.title,
                    "chef_name": recipe.channel_name,
                    "youtube": True,
                    "message": f"{user.get('name')} saved a YouTube recipe: {recipe.title}!"
                }
            )
        except Exception as e:
            print(f"SSE notification error: {e}")
        
        # Remove internal fields
        recipe_doc.pop("_id", None)
        
        return {
            **recipe_doc,
            "stock_status": stock_status.dict()
        }
    
    @recipe_router.get("")
    async def get_household_recipes(
        credentials: HTTPAuthorizationCredentials = Depends(security),
        tag: Optional[str] = None,
        search: Optional[str] = None
    ):
        """Get all recipes for the household"""
        user = await get_user_from_token(credentials)
        household_id = user.get("active_household")
        
        if not household_id:
            return {"recipes": []}
        
        # Build query
        query = {"household_id": household_id}
        
        if tag:
            query["tags"] = tag
        
        if search:
            query["$and"] = [recipe_search_clause(search)]
        
        # Photos are NOT inlined here — see the PHOTOS notes at the top of
        # this module. The list carries a has_photo flag so each card knows
        # whether to lazily request /recipes/{id}/photo, and the photo bytes
        # themselves never enter this response.
        recipes = await db.user_recipes.aggregate(
            list_pipeline(
                {"$match": query},
                {"$sort": {"created_at": -1}},
                {"$limit": 100},
                viewer_id=user.get("id"),
            )
        ).to_list(100)

        # One inventory read for the whole list instead of one per recipe.
        inventory_lookup = await build_inventory_lookup(household_id)

        # Sanitize the legacy truncated photo_url ("data:image/jpeg;base64,
        # <prefix>...") that earlier creates and edits left behind. Anything
        # containing "..." in the data: URL is not a loadable image — null it
        # out so the card uses has_photo / its gradient hero instead. Both
        # write paths have been fixed; this only cleans rows already in the
        # database, and can go once those are migrated.
        for recipe in recipes:
            url = recipe.get("photo_url")
            if isinstance(url, str) and url.startswith("data:image/") and "..." in url:
                recipe["photo_url"] = None

            recipe["stock_status"] = compute_stock_status(recipe, inventory_lookup).dict()

        return {"recipes": recipes}
    
    @recipe_router.get("/community")
    async def get_community_recipes(
        credentials: HTTPAuthorizationCredentials = Depends(security),
        tag: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 20,
        cursor: Optional[str] = None
    ):
        """Get one page of published recipes from all users, newest first.

        Newest-first, NOT likes-first. Sorting the feed by likes meant a
        freshly published recipe (likes=0) sorted below every recipe that had
        ever been liked and, once a page's worth were published, fell off the
        end of the feed entirely — so publishing reported success but the
        recipe never appeared in the Community tab.

        Paged rather than capped: the page size exists because each row still
        carries its photo as inline base64 (~100-250KB each), so an unbounded
        feed would be a multi-megabyte response on a phone. `next_cursor`
        lets the client walk the whole feed a page at a time instead of the
        feed silently ending at the cap.
        """
        user = await get_user_from_token(credentials)
        household_id = user.get("active_household")

        # Clamp rather than trust: `limit` is a query param, and the response
        # weight per row is large enough that an unbounded value is a way to
        # ask the server for a 100MB document.
        limit = max(1, min(limit, 50))

        # Collected as an $and list because both `search` and `cursor` need a
        # top-level $or — assigning query["$or"] twice would have silently
        # dropped the first one.
        filters: List[Dict[str, Any]] = [{"is_published": True}]

        if tag:
            filters.append({"tags": tag})

        if search:
            filters.append(recipe_search_clause(search))

        # The count below must describe the whole filtered feed, not the
        # remainder after the cursor, so keep the cursor clause separate.
        query = filters[0] if len(filters) == 1 else {"$and": filters}

        paged_query = query
        if cursor:
            try:
                paged_query = {"$and": filters + [decode_feed_cursor(cursor)]}
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid cursor")

        # Over-fetch by one: if the extra row exists there is another page,
        # which avoids a second count query just to answer "is there more".
        # Photos are not inlined (see the PHOTOS notes at the top of this
        # module) — each row carries has_photo and the cards fetch their own.
        page = await db.user_recipes.aggregate(
            list_pipeline(
                {"$match": paged_query},
                {"$sort": dict(CURSOR_SORT)},
                {"$limit": limit + 1},
                viewer_id=user.get("id"),
            )
        ).to_list(limit + 1)

        has_more = len(page) > limit
        recipes = page[:limit]

        # One inventory read for the whole page instead of one per recipe.
        inventory_lookup = await build_inventory_lookup(household_id) if household_id else None

        for recipe in recipes:
            url = recipe.get("photo_url")
            if isinstance(url, str) and url.startswith("data:image/") and "..." in url:
                recipe["photo_url"] = None
            if inventory_lookup is not None:
                recipe["stock_status"] = compute_stock_status(recipe, inventory_lookup).dict()

        return {
            "recipes": recipes,
            "has_more": has_more,
            "next_cursor": encode_feed_cursor(recipes[-1]) if has_more and recipes else None,
            # Only on the first page: the client needs it for the tab badge
            # ("Community 37"), and recounting on every scroll is waste.
            "total": await db.user_recipes.count_documents(query) if not cursor else None,
        }
    
    @recipe_router.get("/{recipe_id}")
    async def get_recipe(
        recipe_id: str,
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """Get a single recipe with stock status"""
        user = await get_user_from_token(credentials)
        household_id = user.get("active_household")
        
        # Same pipeline as the lists, so a card and the detail sheet agree on
        # has_photo / liked_by_me and neither leaks the photo bytes or the
        # liked_by roster.
        found = await db.user_recipes.aggregate(
            list_pipeline(
                {"$match": {"id": recipe_id}},
                {"$limit": 1},
                viewer_id=user.get("id"),
            )
        ).to_list(1)
        
        if not found:
            raise HTTPException(status_code=404, detail="Recipe not found")
        
        recipe = found[0]
        
        # Check access (own household or published)
        if recipe["household_id"] != household_id and not recipe.get("is_published"):
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Add stock status
        if household_id:
            stock_status = await calculate_stock_status(recipe_id, household_id)
            recipe["stock_status"] = stock_status.dict()
        
        return recipe
    
    @recipe_router.get("/{recipe_id}/photo")
    async def get_recipe_photo(
        recipe_id: str,
        v: Optional[str] = None,
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """Get a recipe photo as a cacheable image response.

        `v` is unused server-side: it is the client's cache buster (the
        recipe's updated_at), present so that replacing a photo produces a
        different URL rather than being hidden behind the immutable cache.
        """
        user = await get_user_from_token(credentials)
        household_id = user.get("active_household")
        
        recipe = await db.user_recipes.find_one(
            {"id": recipe_id},
            {"photo_base64": 1, "photo": 1, "household_id": 1, "is_published": 1}
        )
        
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")
        
        # Check access
        if recipe["household_id"] != household_id and not recipe.get("is_published"):
            raise HTTPException(status_code=403, detail="Access denied")
        
        photo = decode_stored_photo(recipe)
        if not photo:
            raise HTTPException(status_code=404, detail="Recipe has no photo")
        
        return Response(content=photo, media_type="image/jpeg", headers=PHOTO_CACHE_HEADERS)
    
    @recipe_router.put("/{recipe_id}")
    async def update_recipe(
        recipe_id: str,
        updates: RecipeUpdate,
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """Update a recipe"""
        user = await get_user_from_token(credentials)
        household_id = user.get("active_household")
        
        recipe = await db.user_recipes.find_one({"id": recipe_id})
        
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")
        
        # Only household members can edit
        if recipe["household_id"] != household_id:
            raise HTTPException(status_code=403, detail="Can only edit your household's recipes")
        
        # Build update document
        update_doc = {"updated_at": datetime.now(timezone.utc).isoformat()}
        
        for field, value in updates.dict(exclude_unset=True).items():
            if value is not None:
                if field == "ingredients":
                    # Re-process ingredients with translations
                    processed = []
                    for ing in value:
                        ing_dict = ing if isinstance(ing, dict) else ing.dict()
                        if not ing_dict.get("name_mr") or not ing_dict.get("name_hi"):
                            translations = await translate_ingredient(ing_dict["ingredient_name"])
                            ing_dict["name_en"] = ing_dict.get("name_en") or translations.get("en")
                            ing_dict["name_mr"] = ing_dict.get("name_mr") or translations.get("mr")
                            ing_dict["name_hi"] = ing_dict.get("name_hi") or translations.get("hi")
                        processed.append(ing_dict)
                    update_doc["ingredients"] = processed
                elif field == "instructions":
                    update_doc["instructions"] = [s if isinstance(s, dict) else s.dict() for s in value]
                elif field == "video_links":
                    # Process video links
                    processed_links = [{"type": v.type, "url": v.url, "title": v.title} if hasattr(v, 'type') else v for v in value]
                    update_doc["video_links"] = processed_links
                elif field == "photo_base64" and value:
                    # photo_url stays None. It used to be set to a TRUNCATED
                    # data URL (first 100 chars + "..."), which is not a
                    # loadable image — create was fixed to stop writing it,
                    # but this path kept re-introducing it on every edit, and
                    # the list endpoints carry sanitizing code to undo it.
                    # The photo is served from /recipes/{id}/photo instead.
                    update_doc["photo_base64"] = value
                    update_doc["photo_url"] = None
                else:
                    update_doc[field] = value
        
        await db.user_recipes.update_one({"id": recipe_id}, {"$set": update_doc})
        
        # Return updated recipe
        updated = await db.user_recipes.find_one({"id": recipe_id}, {"_id": 0, "photo_base64": 0})
        stock_status = await calculate_stock_status(recipe_id, household_id)
        updated["stock_status"] = stock_status.dict()
        
        return updated
    
    @recipe_router.delete("/{recipe_id}")
    async def delete_recipe(
        recipe_id: str,
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """Delete a recipe - only the creator can delete it"""
        user = await get_user_from_token(credentials)
        user_id = user.get("id")
        household_id = user.get("active_household")

        recipe = await db.user_recipes.find_one({"id": recipe_id})

        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")

        # Check that user is in the same household
        if recipe.get("household_id") != household_id:
            raise HTTPException(status_code=403, detail="Can only delete your household's recipes")

        # Check that user is the creator of this recipe
        if recipe.get("created_by") != user_id:
            raise HTTPException(status_code=403, detail="Only the recipe creator can delete it")

        await db.user_recipes.delete_one({"id": recipe_id})

        return {"message": f"Recipe '{recipe['title']}' deleted"}
    
    async def assert_likeable(recipe_id: str) -> Dict[str, Any]:
        """A published recipe, or the right HTTP error."""
        recipe = await db.user_recipes.find_one(
            {"id": recipe_id},
            {"_id": 0, "id": 1, "is_published": 1, "likes": 1}
        )
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")
        if not recipe.get("is_published"):
            raise HTTPException(status_code=400, detail="Can only like published recipes")
        return recipe

    async def like_count(recipe_id: str) -> int:
        """Current stored like count, floored at 0."""
        recipe = await db.user_recipes.find_one({"id": recipe_id}, {"_id": 0, "likes": 1})
        return max(0, (recipe or {}).get("likes", 0) or 0)

    # Likes are per user, tracked in a `liked_by` array of user ids.
    #
    # The counter alone could not enforce that: the old endpoint just did
    # {"$inc": {"likes": 1}} on every POST, so one person tapping the heart
    # five times added five likes. Recording WHO liked it is what makes the
    # operation idempotent.
    #
    # Both handlers do it in a single update whose FILTER carries the
    # condition ($ne / membership) — so the array change and the counter
    # change are one atomic step, and two concurrent taps cannot both pass
    # the check and double-count. matched_count tells us whether this call
    # was the one that changed anything.
    #
    # The array is never returned to clients: list_pipeline turns it into a
    # liked_by_me boolean and projects it away, so the feed does not publish
    # who liked what, or grow its payload with every like.

    @recipe_router.post("/{recipe_id}/like")
    async def like_recipe(
        recipe_id: str,
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """Like a published recipe. Idempotent — liking twice is still one like."""
        user = await get_user_from_token(credentials)
        user_id = user.get("id")

        await assert_likeable(recipe_id)

        result = await db.user_recipes.update_one(
            {"id": recipe_id, "liked_by": {"$ne": user_id}},
            {"$addToSet": {"liked_by": user_id}, "$inc": {"likes": 1}}
        )

        liked_now = result.matched_count == 1
        return {
            "message": "Recipe liked" if liked_now else "Already liked",
            "liked": True,
            "likes": await like_count(recipe_id),
        }

    @recipe_router.delete("/{recipe_id}/like")
    async def unlike_recipe(
        recipe_id: str,
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """Remove this user's like. Idempotent, and never drives likes below 0."""
        user = await get_user_from_token(credentials)
        user_id = user.get("id")

        await assert_likeable(recipe_id)

        await db.user_recipes.update_one(
            {"id": recipe_id, "liked_by": user_id, "likes": {"$gt": 0}},
            {"$pull": {"liked_by": user_id}, "$inc": {"likes": -1}}
        )
        # Separate pull for the legacy case: a recipe liked before `liked_by`
        # existed can have the user in the array but a likes count of 0, and
        # the guarded update above would leave them stuck as "liked".
        await db.user_recipes.update_one(
            {"id": recipe_id, "liked_by": user_id},
            {"$pull": {"liked_by": user_id}}
        )

        return {
            "message": "Like removed",
            "liked": False,
            "likes": await like_count(recipe_id),
        }
    
    @recipe_router.post("/{recipe_id}/add-missing-to-shopping")
    async def add_missing_to_shopping(
        recipe_id: str,
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """Add missing ingredients to shopping list"""
        user = await get_user_from_token(credentials)
        household_id = user.get("active_household")
        
        if not household_id:
            raise HTTPException(status_code=400, detail="No active household")
        
        stock_status = await calculate_stock_status(recipe_id, household_id)
        
        added_count = 0
        today_iso = datetime.now(timezone.utc).date().isoformat()
        for item in stock_status.missing + stock_status.low_stock:
            name_en = item["ingredient"]
            name_lower = name_en.lower()

            # Skip if already in shopping list (case-insensitive).
            existing = await db.shopping_list.find_one({
                "household_id": household_id,
                "name_en": equals_regex(name_en)
            })
            if existing:
                continue

            # Skip if the user has snoozed auto-suggestions for this item
            # via the "Skip this trip" delete intent. Honors the user's
            # explicit "not this trip" signal so add-missing doesn't
            # bring the item back the moment they tap it on a recipe.
            suppression = await db.shopping_suppressions.find_one({
                "household_id": household_id,
                "name_en_lower": name_lower,
                "snoozed_until": {"$gt": today_iso},
            })
            if suppression:
                continue

            await db.shopping_list.insert_one({
                "id": str(uuid.uuid4()),
                "household_id": household_id,
                "name_en": name_en,
                "category": "other",
                "monthly_quantity": item["required"],
                "quantity": "-",
                "store_type": "grocery",
                "source": "recipe",
                "source_ref": recipe_id,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            added_count += 1
        
        return {
            "message": f"Added {added_count} items to shopping list",
            "added_count": added_count
        }
    
    return recipe_router
