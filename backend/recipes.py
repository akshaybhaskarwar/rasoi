"""
User-Generated Recipe (UGR) Module for Rasoi-Sync
- Recipe CRUD operations
- Inventory linking
- Stock status calculation
- Auto-translation
- Real-time notifications via SSE
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import base64

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
    is_published: Optional[bool] = None

class StockStatus(BaseModel):
    """Stock availability status for a recipe"""
    status: str  # 'green', 'yellow', 'red'
    message: str
    in_stock: List[Dict[str, Any]]
    missing: List[Dict[str, Any]]
    low_stock: List[Dict[str, Any]]

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
    
    async def calculate_stock_status(recipe_id: str, household_id: str) -> StockStatus:
        """Calculate stock availability for a recipe"""
        recipe = await db.user_recipes.find_one({"id": recipe_id})
        if not recipe:
            return StockStatus(status="red", message="Recipe not found", in_stock=[], missing=[], low_stock=[])
        
        # Get household inventory
        inventory = await db.inventory.find(
            {"household_id": household_id},
            {"_id": 0}
        ).to_list(1000)
        
        # Create lookup by name (case-insensitive)
        inventory_lookup = {}
        for item in inventory:
            name_lower = item.get("name_en", "").lower()
            if name_lower:
                inventory_lookup[name_lower] = item
        
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
        search_regex = {"$regex": query, "$options": "i"}
        
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
                    "name_en": {"$regex": f"^{ing.ingredient_name}$", "$options": "i"}
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
            "is_published": recipe.is_published,
            "likes": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Handle photo upload (base64)
        if recipe.photo_base64:
            # Store base64 directly for now (in production, upload to cloud storage)
            recipe_doc["photo_url"] = f"data:image/jpeg;base64,{recipe.photo_base64[:100]}..."
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
            query["$or"] = [
                {"title": {"$regex": search, "$options": "i"}},
                {"chef_name": {"$regex": search, "$options": "i"}},
                {"ingredients.ingredient_name": {"$regex": search, "$options": "i"}}
            ]
        
        recipes = await db.user_recipes.find(query, {"_id": 0, "photo_base64": 0}).sort("created_at", -1).to_list(100)
        
        # Add stock status to each recipe
        for recipe in recipes:
            stock_status = await calculate_stock_status(recipe["id"], household_id)
            recipe["stock_status"] = stock_status.dict()
        
        return {"recipes": recipes}
    
    @recipe_router.get("/community")
    async def get_community_recipes(
        credentials: HTTPAuthorizationCredentials = Depends(security),
        tag: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 20
    ):
        """Get published recipes from all users"""
        user = await get_user_from_token(credentials)
        household_id = user.get("active_household")
        
        # Build query for published recipes
        query = {"is_published": True}
        
        if tag:
            query["tags"] = tag
        
        if search:
            query["$or"] = [
                {"title": {"$regex": search, "$options": "i"}},
                {"chef_name": {"$regex": search, "$options": "i"}}
            ]
        
        recipes = await db.user_recipes.find(
            query, 
            {"_id": 0, "photo_base64": 0}
        ).sort("likes", -1).limit(limit).to_list(limit)
        
        # Add stock status for current user's household
        if household_id:
            for recipe in recipes:
                stock_status = await calculate_stock_status(recipe["id"], household_id)
                recipe["stock_status"] = stock_status.dict()
        
        return {"recipes": recipes}
    
    @recipe_router.get("/{recipe_id}")
    async def get_recipe(
        recipe_id: str,
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """Get a single recipe with stock status"""
        user = await get_user_from_token(credentials)
        household_id = user.get("active_household")
        
        recipe = await db.user_recipes.find_one({"id": recipe_id}, {"_id": 0, "photo_base64": 0})
        
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")
        
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
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """Get recipe photo (base64)"""
        user = await get_user_from_token(credentials)
        household_id = user.get("active_household")
        
        recipe = await db.user_recipes.find_one({"id": recipe_id}, {"photo_base64": 1, "household_id": 1, "is_published": 1})
        
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")
        
        # Check access
        if recipe["household_id"] != household_id and not recipe.get("is_published"):
            raise HTTPException(status_code=403, detail="Access denied")
        
        return {"photo_base64": recipe.get("photo_base64")}
    
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
                elif field == "photo_base64" and value:
                    update_doc["photo_base64"] = value
                    update_doc["photo_url"] = f"data:image/jpeg;base64,{value[:100]}..."
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
        """Delete a recipe"""
        user = await get_user_from_token(credentials)
        household_id = user.get("active_household")
        
        recipe = await db.user_recipes.find_one({"id": recipe_id})
        
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")
        
        if recipe["household_id"] != household_id:
            raise HTTPException(status_code=403, detail="Can only delete your household's recipes")
        
        await db.user_recipes.delete_one({"id": recipe_id})
        
        return {"message": f"Recipe '{recipe['title']}' deleted"}
    
    @recipe_router.post("/{recipe_id}/like")
    async def like_recipe(
        recipe_id: str,
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """Like a published recipe"""
        user = await get_user_from_token(credentials)
        
        recipe = await db.user_recipes.find_one({"id": recipe_id})
        
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")
        
        if not recipe.get("is_published"):
            raise HTTPException(status_code=400, detail="Can only like published recipes")
        
        # Increment likes
        await db.user_recipes.update_one(
            {"id": recipe_id},
            {"$inc": {"likes": 1}}
        )
        
        return {"message": "Recipe liked", "likes": recipe.get("likes", 0) + 1}
    
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
        for item in stock_status.missing + stock_status.low_stock:
            # Check if already in shopping list
            existing = await db.shopping_list.find_one({
                "household_id": household_id,
                "name_en": {"$regex": f"^{item['ingredient']}$", "$options": "i"}
            })
            
            if not existing:
                await db.shopping_list.insert_one({
                    "id": str(uuid.uuid4()),
                    "household_id": household_id,
                    "name_en": item["ingredient"],
                    "category": "other",
                    "monthly_quantity": item["required"],
                    "quantity": "-",
                    "store_type": "grocery",
                    "source": f"recipe:{recipe_id}",
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
                added_count += 1
        
        return {
            "message": f"Added {added_count} items to shopping list",
            "added_count": added_count
        }
    
    return recipe_router
