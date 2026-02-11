"""
Digital Dadi - Festival Calendar Management
Handles festival data storage, CSV uploads, and inventory-aware reminders.
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import uuid
import csv
import io

# Security
security = HTTPBearer(auto_error=False)

# Router
dadi_router = APIRouter(prefix="/api/dadi", tags=["Digital Dadi"])


# Pydantic Models
class FestivalBase(BaseModel):
    name: str = Field(..., description="Festival name")
    name_mr: Optional[str] = Field(None, description="Festival name in Marathi")
    name_hi: Optional[str] = Field(None, description="Festival name in Hindi")
    date: str = Field(..., description="Festival date (YYYY-MM-DD or Month Day format)")
    significance: str = Field(..., description="Cultural significance")
    key_ingredients: List[str] = Field(default=[], description="List of key ingredients")
    recipes: Optional[List[str]] = Field(default=[], description="Associated recipes")
    tips: Optional[List[str]] = Field(default=[], description="Dadi's tips for this festival")
    is_fasting_day: bool = Field(default=False, description="Whether it's a fasting day")
    region: str = Field(default="Maharashtra", description="Primary region")


class FestivalCreate(FestivalBase):
    pass


class FestivalUpdate(BaseModel):
    name: Optional[str] = None
    name_mr: Optional[str] = None
    name_hi: Optional[str] = None
    date: Optional[str] = None
    significance: Optional[str] = None
    key_ingredients: Optional[List[str]] = None
    recipes: Optional[List[str]] = None
    tips: Optional[List[str]] = None
    is_fasting_day: Optional[bool] = None
    region: Optional[str] = None


class FestivalResponse(FestivalBase):
    id: str
    created_at: str
    updated_at: Optional[str] = None


class UpcomingFestival(BaseModel):
    id: str
    name: str
    name_mr: Optional[str]
    name_hi: Optional[str]
    date: str
    days_until: int
    significance: str
    key_ingredients: List[str]
    ingredient_status: List[dict]  # {name, status: 'in_stock'|'low'|'missing', current_stock, unit}
    readiness_score: int  # Percentage of ingredients in stock
    missing_ingredients: List[str]
    is_fasting_day: bool
    tips: List[str]


def create_dadi_routes(db, decode_token):
    """Factory function to create Digital Dadi routes with dependencies"""
    
    # ============ ADMIN ENDPOINTS ============
    
    @dadi_router.post("/festivals/upload")
    async def upload_festival_csv(
        file: UploadFile = File(...),
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """
        Upload CSV/Excel file with festival data.
        Expected columns: Festival Name, Name (Marathi), Name (Hindi), Date, Significance, 
                         Key Ingredients, Recipes, Tips, Is Fasting Day, Region
        Key Ingredients should be comma-separated within the cell.
        """
        if not credentials:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        user = await decode_token(credentials.credentials)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Check file type
        if not file.filename.endswith(('.csv', '.CSV')):
            raise HTTPException(status_code=400, detail="Only CSV files are supported")
        
        try:
            # Read file content
            content = await file.read()
            decoded_content = content.decode('utf-8-sig')  # Handle BOM
            
            # Parse CSV
            csv_reader = csv.DictReader(io.StringIO(decoded_content))
            
            festivals_to_insert = []
            errors = []
            row_num = 1
            
            for row in csv_reader:
                row_num += 1
                try:
                    # Normalize column names (handle different capitalizations)
                    normalized_row = {k.strip().lower(): v.strip() if v else '' for k, v in row.items()}
                    
                    # Extract data with flexible column matching
                    name = (normalized_row.get('festival name') or 
                           normalized_row.get('festival') or 
                           normalized_row.get('name') or '').strip()
                    
                    if not name:
                        errors.append(f"Row {row_num}: Missing festival name")
                        continue
                    
                    # Parse date
                    date_str = (normalized_row.get('date') or '').strip()
                    if not date_str:
                        errors.append(f"Row {row_num}: Missing date for {name}")
                        continue
                    
                    # Parse key ingredients (comma-separated)
                    ingredients_str = (normalized_row.get('key ingredients') or 
                                      normalized_row.get('key ingredients to prompt (inventory check)') or
                                      normalized_row.get('ingredients') or '')
                    key_ingredients = [ing.strip() for ing in ingredients_str.split(',') if ing.strip()]
                    
                    # Parse other fields
                    significance = (normalized_row.get('significance') or '').strip()
                    name_mr = (normalized_row.get('name (marathi)') or normalized_row.get('name_mr') or '').strip()
                    name_hi = (normalized_row.get('name (hindi)') or normalized_row.get('name_hi') or '').strip()
                    recipes_str = (normalized_row.get('recipes') or '')
                    recipes = [r.strip() for r in recipes_str.split(',') if r.strip()]
                    tips_str = (normalized_row.get('tips') or normalized_row.get("dadi's tips") or '')
                    tips = [t.strip() for t in tips_str.split('|') if t.strip()]  # Use | as separator for tips
                    is_fasting = (normalized_row.get('is fasting day') or normalized_row.get('fasting') or '').lower() in ['yes', 'true', '1', 'y']
                    region = (normalized_row.get('region') or 'Maharashtra').strip()
                    
                    festival_doc = {
                        "id": str(uuid.uuid4()),
                        "name": name,
                        "name_mr": name_mr or None,
                        "name_hi": name_hi or None,
                        "date": date_str,
                        "significance": significance,
                        "key_ingredients": key_ingredients,
                        "recipes": recipes,
                        "tips": tips,
                        "is_fasting_day": is_fasting,
                        "region": region,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "updated_at": None
                    }
                    
                    festivals_to_insert.append(festival_doc)
                    
                except Exception as e:
                    errors.append(f"Row {row_num}: Error parsing - {str(e)}")
            
            # Insert into database
            inserted_count = 0
            updated_count = 0
            
            for festival in festivals_to_insert:
                # Check if festival with same name and date exists (upsert)
                existing = await db.festivals.find_one({
                    "name": {"$regex": f"^{festival['name']}$", "$options": "i"}
                })
                
                if existing:
                    # Update existing
                    festival["updated_at"] = datetime.now(timezone.utc).isoformat()
                    await db.festivals.update_one(
                        {"_id": existing["_id"]},
                        {"$set": {k: v for k, v in festival.items() if k != "id" and k != "created_at"}}
                    )
                    updated_count += 1
                else:
                    # Insert new
                    await db.festivals.insert_one(festival)
                    inserted_count += 1
            
            return {
                "success": True,
                "message": f"Processed {len(festivals_to_insert)} festivals",
                "inserted": inserted_count,
                "updated": updated_count,
                "errors": errors if errors else None
            }
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")
    
    
    @dadi_router.get("/festivals")
    async def list_festivals(
        year: Optional[int] = Query(None, description="Filter by year"),
        region: Optional[str] = Query(None, description="Filter by region")
    ):
        """List all festivals, optionally filtered by year or region"""
        query = {}
        
        if region:
            query["region"] = {"$regex": region, "$options": "i"}
        
        festivals = await db.festivals.find(query, {"_id": 0}).to_list(100)
        
        # Sort by date
        def parse_date_for_sort(f):
            try:
                # Try parsing various date formats
                date_str = f.get('date', '')
                # Handle "Month Day" format
                for fmt in ['%b %d', '%B %d', '%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y']:
                    try:
                        parsed = datetime.strptime(date_str, fmt)
                        if parsed.year == 1900:  # Default year when not specified
                            parsed = parsed.replace(year=datetime.now().year)
                        return parsed
                    except:
                        continue
                return datetime.max
            except:
                return datetime.max
        
        festivals.sort(key=parse_date_for_sort)
        
        return {"festivals": festivals, "total": len(festivals)}
    
    
    @dadi_router.post("/festivals")
    async def create_festival(
        festival: FestivalCreate,
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """Create a new festival entry"""
        if not credentials:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        user = await decode_token(credentials.credentials)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        festival_doc = {
            "id": str(uuid.uuid4()),
            **festival.model_dump(),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": None
        }
        
        await db.festivals.insert_one(festival_doc)
        
        return {"success": True, "festival": {k: v for k, v in festival_doc.items() if k != "_id"}}
    
    
    @dadi_router.put("/festivals/{festival_id}")
    async def update_festival(
        festival_id: str,
        update: FestivalUpdate,
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """Update an existing festival"""
        if not credentials:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        user = await decode_token(credentials.credentials)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        existing = await db.festivals.find_one({"id": festival_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Festival not found")
        
        update_data = {k: v for k, v in update.model_dump().items() if v is not None}
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        await db.festivals.update_one({"id": festival_id}, {"$set": update_data})
        
        updated = await db.festivals.find_one({"id": festival_id}, {"_id": 0})
        return {"success": True, "festival": updated}
    
    
    @dadi_router.delete("/festivals/{festival_id}")
    async def delete_festival(
        festival_id: str,
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """Delete a festival"""
        if not credentials:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        user = await decode_token(credentials.credentials)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        result = await db.festivals.delete_one({"id": festival_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Festival not found")
        
        return {"success": True, "message": "Festival deleted"}
    
    
    # ============ USER ENDPOINTS ============
    
    @dadi_router.get("/upcoming")
    async def get_upcoming_festivals(
        days_ahead: int = Query(14, description="Number of days to look ahead"),
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """
        Get upcoming festivals with ingredient status based on user's inventory.
        Returns readiness score and missing ingredients.
        """
        if not credentials:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        user = await decode_token(credentials.credentials)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        household_id = user.get("active_household")
        if not household_id:
            return {"upcoming": [], "message": "No active household"}
        
        # Get all festivals
        all_festivals = await db.festivals.find({}, {"_id": 0}).to_list(100)
        
        # Get user's inventory
        inventory = await db.inventory.find(
            {"household_id": household_id},
            {"_id": 0, "name_en": 1, "stock_level": 1, "current_stock": 1, "unit": 1}
        ).to_list(500)
        
        # Create inventory lookup (normalize names)
        inventory_lookup = {}
        for item in inventory:
            name = item.get("name_en", "").lower().strip()
            inventory_lookup[name] = {
                "stock_level": item.get("stock_level", "empty"),
                "current_stock": item.get("current_stock", 0),
                "unit": item.get("unit", "")
            }
        
        # Calculate upcoming festivals
        today = datetime.now()
        current_year = today.year
        upcoming = []
        
        for festival in all_festivals:
            try:
                date_str = festival.get("date", "")
                festival_date = None
                
                # Parse various date formats
                for fmt in ['%b %d', '%B %d', '%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y']:
                    try:
                        parsed = datetime.strptime(date_str, fmt)
                        if parsed.year == 1900:
                            parsed = parsed.replace(year=current_year)
                        festival_date = parsed
                        break
                    except:
                        continue
                
                if not festival_date:
                    continue
                
                # If festival date has passed this year, check next year
                if festival_date < today:
                    festival_date = festival_date.replace(year=current_year + 1)
                
                days_until = (festival_date - today).days
                
                if 0 <= days_until <= days_ahead:
                    # Check ingredient status
                    ingredient_status = []
                    missing = []
                    in_stock_count = 0
                    
                    for ingredient in festival.get("key_ingredients", []):
                        ing_lower = ingredient.lower().strip()
                        # Remove parenthetical info for matching
                        ing_base = ing_lower.split('(')[0].strip()
                        
                        # Try to find in inventory
                        found = False
                        for inv_name, inv_data in inventory_lookup.items():
                            if ing_base in inv_name or inv_name in ing_base:
                                stock_level = inv_data["stock_level"]
                                status = "in_stock" if stock_level in ["full", "half"] else "low" if stock_level == "low" else "missing"
                                ingredient_status.append({
                                    "name": ingredient,
                                    "status": status,
                                    "current_stock": inv_data["current_stock"],
                                    "unit": inv_data["unit"]
                                })
                                if status == "in_stock":
                                    in_stock_count += 1
                                elif status == "missing":
                                    missing.append(ingredient)
                                found = True
                                break
                        
                        if not found:
                            ingredient_status.append({
                                "name": ingredient,
                                "status": "missing",
                                "current_stock": 0,
                                "unit": ""
                            })
                            missing.append(ingredient)
                    
                    # Calculate readiness score
                    total_ingredients = len(festival.get("key_ingredients", []))
                    readiness_score = int((in_stock_count / total_ingredients * 100)) if total_ingredients > 0 else 100
                    
                    upcoming.append({
                        "id": festival.get("id"),
                        "name": festival.get("name"),
                        "name_mr": festival.get("name_mr"),
                        "name_hi": festival.get("name_hi"),
                        "date": festival_date.strftime("%Y-%m-%d"),
                        "date_display": festival_date.strftime("%b %d"),
                        "days_until": days_until,
                        "significance": festival.get("significance"),
                        "key_ingredients": festival.get("key_ingredients", []),
                        "ingredient_status": ingredient_status,
                        "readiness_score": readiness_score,
                        "missing_ingredients": missing,
                        "is_fasting_day": festival.get("is_fasting_day", False),
                        "tips": festival.get("tips", []),
                        "recipes": festival.get("recipes", [])
                    })
                    
            except Exception as e:
                print(f"Error processing festival {festival.get('name')}: {e}")
                continue
        
        # Sort by days_until
        upcoming.sort(key=lambda x: x["days_until"])
        
        return {
            "upcoming": upcoming,
            "total": len(upcoming),
            "checked_inventory_items": len(inventory)
        }
    
    
    @dadi_router.post("/add-missing-to-shopping")
    async def add_missing_to_shopping(
        festival_id: str,
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """Add missing ingredients for a festival to the shopping list"""
        if not credentials:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        user = await decode_token(credentials.credentials)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        household_id = user.get("active_household")
        if not household_id:
            raise HTTPException(status_code=400, detail="No active household")
        
        # Get festival
        festival = await db.festivals.find_one({"id": festival_id})
        if not festival:
            raise HTTPException(status_code=404, detail="Festival not found")
        
        # Get inventory to find missing items
        inventory = await db.inventory.find(
            {"household_id": household_id},
            {"_id": 0, "name_en": 1, "stock_level": 1}
        ).to_list(500)
        
        inventory_names = {item.get("name_en", "").lower().strip() for item in inventory 
                         if item.get("stock_level") in ["full", "half"]}
        
        # Find missing ingredients
        added_items = []
        for ingredient in festival.get("key_ingredients", []):
            ing_base = ingredient.split('(')[0].strip().lower()
            
            # Check if already in stock
            is_in_stock = any(ing_base in inv_name or inv_name in ing_base for inv_name in inventory_names)
            
            if not is_in_stock:
                # Check if already in shopping list
                existing = await db.shopping.find_one({
                    "household_id": household_id,
                    "name": {"$regex": f"^{ingredient}$", "$options": "i"},
                    "is_purchased": False
                })
                
                if not existing:
                    shopping_item = {
                        "id": str(uuid.uuid4()),
                        "household_id": household_id,
                        "name": ingredient,
                        "quantity": 1,
                        "unit": "",
                        "category": "festival",
                        "is_purchased": False,
                        "added_by": user.get("user_id"),
                        "notes": f"For {festival.get('name')}",
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                    await db.shopping.insert_one(shopping_item)
                    added_items.append(ingredient)
        
        return {
            "success": True,
            "festival": festival.get("name"),
            "added_to_shopping": added_items,
            "count": len(added_items)
        }
    
    
    @dadi_router.get("/tip-of-day")
    async def get_tip_of_day():
        """Get a random cooking tip from Dadi"""
        # Get tips from festivals
        festivals_with_tips = await db.festivals.find(
            {"tips": {"$exists": True, "$ne": []}},
            {"_id": 0, "tips": 1, "name": 1}
        ).to_list(50)
        
        all_tips = []
        for f in festivals_with_tips:
            for tip in f.get("tips", []):
                all_tips.append({"tip": tip, "context": f.get("name")})
        
        # Add some general tips if no festival tips
        general_tips = [
            {"tip": "Always taste your food while cooking to adjust seasonings", "context": "General"},
            {"tip": "Let dal rest for 5 minutes after cooking for better consistency", "context": "Dal Tips"},
            {"tip": "Add a pinch of sugar to balance acidity in tomato-based curries", "context": "Curry Tips"},
            {"tip": "Roast spices before grinding for more aromatic flavor", "context": "Spice Tips"},
            {"tip": "Soak rice for 30 minutes before cooking for fluffy texture", "context": "Rice Tips"},
        ]
        
        all_tips.extend(general_tips)
        
        if all_tips:
            import random
            selected = random.choice(all_tips)
            return {"tip": selected["tip"], "context": selected["context"]}
        
        return {"tip": "Cook with love, food tastes better!", "context": "Dadi's Wisdom"}
    
    
    return dadi_router
