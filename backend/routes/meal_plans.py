"""
Meal planning routes for Rasoi-Sync
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta

from models.meal_plans import (
    MealPlan, MealPlanCreate, PrepareMealPlanRequest,
    SERVING_MULTIPLIERS, DEFAULT_INGREDIENT_QUANTITIES
)
from data.recipes import RECIPE_DATABASE

security = HTTPBearer(auto_error=False)
meal_plans_router = APIRouter(prefix="/api", tags=["Meal Plans"])


def create_meal_plan_routes(db, decode_token, youtube_service):
    """Factory function to create meal plan routes with database access"""
    
    async def get_user_from_token(credentials: HTTPAuthorizationCredentials):
        if not credentials:
            raise HTTPException(status_code=401, detail="Not authenticated")
        payload = decode_token(credentials.credentials)
        user_id = payload.get("sub")
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user

    def estimate_ingredient_quantity(ingredient_name: str, serving_size: str = "family_4") -> Dict[str, Any]:
        """Estimate ingredient quantity based on serving size"""
        ingredient_lower = ingredient_name.lower().strip()
        
        default_qty = None
        for key, value in DEFAULT_INGREDIENT_QUANTITIES.items():
            if key in ingredient_lower or ingredient_lower in key:
                default_qty = value
                break
        
        if not default_qty:
            default_qty = {"qty": 100, "unit": "g"}
        
        multiplier = SERVING_MULTIPLIERS.get(serving_size, 1.0)
        estimated_qty = int(default_qty["qty"] * multiplier)
        
        return {"qty": estimated_qty, "unit": default_qty["unit"]}

    async def match_ingredients_to_inventory(ingredient_names: List[str]) -> List[Dict[str, Any]]:
        """Match ingredient names to inventory items"""
        inventory_items = await db.inventory.find({}, {"_id": 0}).to_list(500)
        matched = []
        
        for ing_name in ingredient_names:
            ing_lower = ing_name.lower().strip()
            best_match = None
            
            for item in inventory_items:
                item_name_lower = item.get('name_en', '').lower()
                if ing_lower in item_name_lower or item_name_lower in ing_lower:
                    best_match = item
                    break
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
                matched.append({
                    "item_id": None,
                    "item_name": ing_name,
                    "category": "other",
                    "stock_level": "empty",
                    "in_stock": False
                })
        
        return matched

    @meal_plans_router.post("/meal-plans/prepare")
    async def prepare_meal_plan(request: PrepareMealPlanRequest):
        """Prepare meal plan data before showing the scheduling modal"""
        inventory_matches = await match_ingredients_to_inventory(request.matched_ingredients)
        
        ingredient_options = []
        for match in inventory_matches:
            ing_name = match["item_name"]
            options = {
                "ingredient_name": ing_name,
                "item_id": match["item_id"],
                "in_stock": match["in_stock"],
                "stock_level": match["stock_level"],
                "selected": match["in_stock"],
                "quantities": {}
            }
            
            for size_key in SERVING_MULTIPLIERS.keys():
                qty_info = estimate_ingredient_quantity(ing_name, size_key)
                options["quantities"][size_key] = qty_info
            
            ingredient_options.append(options)
        
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
                {"key": "breakfast", "label": "Breakfast"},
                {"key": "lunch", "label": "Lunch"},
                {"key": "snacks", "label": "Snacks"},
                {"key": "dinner", "label": "Dinner"}
            ]
        }

    @meal_plans_router.post("/meal-plans", response_model=MealPlan)
    async def create_meal_plan(
        plan: MealPlanCreate,
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """Create meal plan with ingredient reservations"""
        user = await get_user_from_token(credentials)
        
        household_id = user.get("active_household")
        if not household_id:
            raise HTTPException(status_code=400, detail="No active household. Please create or join a kitchen first.")
        
        plan_dict = plan.model_dump()
        meal_plan = MealPlan(**plan_dict)
        meal_plan.household_id = household_id
        
        if plan.youtube_channel:
            meal_plan.youtube_channel = plan.youtube_channel
        
        if plan.youtube_video_id:
            video_details = await youtube_service.fetch_video_details(plan.youtube_video_id)
            meal_plan.youtube_thumbnail = video_details.get('thumbnail') or plan.youtube_thumbnail
            meal_plan.youtube_title = video_details.get('title')
        
        doc = meal_plan.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        doc['household_id'] = household_id
        
        await db.meal_plans.insert_one(doc)
        
        if plan.reserved_ingredients:
            for reservation in plan.reserved_ingredients:
                item_id = reservation.get('item_id')
                if item_id:
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

    @meal_plans_router.get("/meal-plans", response_model=List[MealPlan])
    async def get_meal_plans(
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """Get meal plans for user's active household"""
        user = await get_user_from_token(credentials)
        
        household_id = user.get("active_household")
        if not household_id:
            return []
        
        plans = await db.meal_plans.find({"household_id": household_id}, {"_id": 0}).to_list(1000)
        
        for plan in plans:
            if isinstance(plan.get('created_at'), str):
                plan['created_at'] = datetime.fromisoformat(plan['created_at'])
        
        return plans

    @meal_plans_router.delete("/meal-plans/{plan_id}")
    async def delete_meal_plan(plan_id: str):
        """Delete meal plan and remove reservations"""
        plan = await db.meal_plans.find_one({"id": plan_id}, {"_id": 0})
        
        if not plan:
            raise HTTPException(status_code=404, detail="Plan not found")
        
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
        
        result = await db.meal_plans.delete_one({"id": plan_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Plan not found")
        
        return {
            "message": "Deleted successfully",
            "released_ingredients": released_items,
            "plan_name": plan.get('meal_name', 'Recipe')
        }

    @meal_plans_router.get("/meal-plans/suggestions")
    async def get_meal_suggestions():
        """Get quick meal suggestions based on current inventory"""
        inventory_items = await db.inventory.find(
            {"stock_level": {"$ne": "empty"}},
            {"name_en": 1, "_id": 0}
        ).to_list(100)
        available_items = [item["name_en"].lower() for item in inventory_items]
        
        if not available_items:
            return {"suggestions": []}
        
        suggestions = []
        for recipe in RECIPE_DATABASE:
            recipe_ingredients = [ing.lower() for ing in recipe.get('ingredients', [])]
            if not recipe_ingredients:
                continue
            
            matched = sum(1 for ing in recipe_ingredients if any(avail in ing or ing in avail for avail in available_items))
            match_percent = (matched / len(recipe_ingredients)) * 100 if recipe_ingredients else 0
            
            if match_percent >= 50:
                suggestions.append({
                    "title": recipe['title'],
                    "video_id": recipe.get('video_id'),
                    "thumbnail": recipe.get('thumbnail'),
                    "source": recipe.get('source', 'Local'),
                    "match_percent": round(match_percent),
                    "prep_time": recipe.get('prep_time', ''),
                    "category": recipe.get('category', '')
                })
        
        suggestions.sort(key=lambda x: x['match_percent'], reverse=True)
        return {"suggestions": suggestions[:5]}

    @meal_plans_router.get("/meal-plans/check/{video_id}")
    async def check_video_planned(
        video_id: str,
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """Check if a video is already planned for the current user's household"""
        # Get user's active household to filter correctly
        household_id = None
        if credentials:
            try:
                user = await get_user_from_token(credentials)
                household_id = user.get("active_household")
            except:
                pass
        
        # Build query - only match this household's meal plans
        query = {"youtube_video_id": video_id}
        if household_id:
            query["household_id"] = household_id
        else:
            # If no household context, don't show as planned to prevent cross-user leakage
            return {"is_planned": False}
        
        existing = await db.meal_plans.find_one(
            query,
            {"_id": 0, "id": 1, "date": 1, "meal_type": 1}
        )
        
        if existing:
            plan_date = datetime.strptime(existing['date'], "%Y-%m-%d")
            day_name = plan_date.strftime("%A")
            meal_type = existing.get('meal_type', 'meal')
            meal_display = meal_type.capitalize()
            
            return {
                "is_planned": True,
                "plan_id": existing['id'],
                "date": existing['date'],
                "meal_type": meal_type,
                "display_text": f"{day_name}'s {meal_display}"
            }
        
        return {"is_planned": False}

    @meal_plans_router.post("/meal-plans/refresh-videos")
    async def refresh_meal_plan_videos():
        """Refresh video IDs for existing meal plans from recipe database"""
        recipe_video_map = {}
        for recipe in RECIPE_DATABASE:
            title = recipe.get('title', '').lower().strip()
            video_id = recipe.get('video_id')
            if title and video_id:
                recipe_video_map[title] = {
                    'video_id': video_id,
                    'thumbnail': recipe.get('thumbnail', '')
                }
        
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

    @meal_plans_router.get("/gap-analysis")
    async def get_gap_analysis(
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """Analyze meal plan vs inventory to find missing ingredients"""
        user = await get_user_from_token(credentials)
        
        if not user:
            return {"missing_ingredients": []}
        
        household_id = user.get("active_household")
        if not household_id:
            return {"missing_ingredients": []}
        
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
        meal_plans = await db.meal_plans.find(
            {
                "household_id": household_id,
                "date": {"$gte": today}
            },
            {"_id": 0}
        ).to_list(1000)
        
        inventory = await db.inventory.find(
            {"household_id": household_id},
            {"_id": 0}
        ).to_list(1000)
        inventory_names = {
            item['name_en'].lower() 
            for item in inventory 
            if item.get('stock_level') in ['half', 'full']
        }
        
        missing = []
        seen_ingredients = set()
        
        for plan in sorted(meal_plans, key=lambda x: x.get('date', '')):
            for ingredient in plan.get('ingredients_needed', []):
                ingredient_lower = ingredient.lower()
                if ingredient_lower not in inventory_names and ingredient_lower not in seen_ingredients:
                    seen_ingredients.add(ingredient_lower)
                    missing.append({
                        "ingredient": ingredient,
                        "meal": plan['meal_name'],
                        "date": plan['date']
                    })
        
        return {"missing_ingredients": missing}

    return meal_plans_router
