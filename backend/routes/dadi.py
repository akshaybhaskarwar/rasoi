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
import re

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
        
        user = decode_token(credentials.credentials)
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
                    except ValueError:
                        continue
                return datetime.max
            except Exception:
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
        
        user = decode_token(credentials.credentials)
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
        
        user = decode_token(credentials.credentials)
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
        
        user = decode_token(credentials.credentials)
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
        
        token_data = decode_token(credentials.credentials)
        if not token_data:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Fetch user from database to get active_household
        user_id = token_data.get("sub")
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
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
                    except ValueError:
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
                    
                    # Check if any missing ingredients are already in shopping list
                    items_in_shopping = 0
                    if missing:
                        for ing in missing:
                            # Escape regex special characters in ingredient name
                            escaped_ing = re.escape(ing)
                            existing_in_shopping = await db.shopping_list.find_one({
                                "household_id": household_id,
                                "name_en": {"$regex": f"^{escaped_ing}$", "$options": "i"},
                                "shopping_status": {"$ne": "bought"}
                            })
                            if existing_in_shopping:
                                items_in_shopping += 1
                    
                    # Determine if all missing items are already in shopping list
                    all_missing_in_shopping = items_in_shopping == len(missing) if missing else False
                    
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
                        "items_in_shopping_list": items_in_shopping,
                        "all_missing_in_shopping": all_missing_in_shopping,
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
        
        token_data = decode_token(credentials.credentials)
        if not token_data:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Fetch user from database to get active_household
        user_id = token_data.get("sub")
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
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
                # Check if already in shopping list (escape regex special chars)
                escaped_ingredient = re.escape(ingredient)
                existing = await db.shopping_list.find_one({
                    "household_id": household_id,
                    "name_en": {"$regex": f"^{escaped_ingredient}$", "$options": "i"},
                    "shopping_status": {"$ne": "bought"}
                })
                
                if not existing:
                    # Create shopping item matching the ShoppingItem model schema
                    shopping_item = {
                        "id": str(uuid.uuid4()),
                        "household_id": household_id,
                        "name_en": ingredient,
                        "name_mr": None,
                        "name_hi": None,
                        "category": "festival",
                        "quantity": "1",  # String as per model
                        "stock_level": "empty",
                        "monthly_quantity": None,
                        "store_type": "grocery",
                        "shopping_status": "pending",
                        "claimed_by": None,
                        "claimed_by_name": None,
                        "bought_at": None,
                        "notes": f"For {festival.get('name')}",
                        "created_at": datetime.now(timezone.utc)
                    }
                    await db.shopping_list.insert_one(shopping_item)
                    added_items.append(ingredient)
        
        return {
            "success": True,
            "festival": festival.get("name"),
            "added_to_shopping": added_items,
            "count": len(added_items)
        }
    
    
    @dadi_router.get("/tip-of-day")
    async def get_tip_of_day(lang: str = "en"):
        """Get a random cooking tip from Dadi in the requested language"""
        # Get tips from festivals
        festivals_with_tips = await db.festivals.find(
            {"tips": {"$exists": True, "$ne": []}},
            {"_id": 0, "tips": 1, "name": 1, "name_mr": 1, "name_hi": 1}
        ).to_list(50)
        
        all_tips = []
        for f in festivals_with_tips:
            for tip in f.get("tips", []):
                # Get festival name in requested language
                if lang == "mr" and f.get("name_mr"):
                    context = f.get("name_mr")
                elif lang == "hi" and f.get("name_hi"):
                    context = f.get("name_hi")
                else:
                    context = f.get("name")
                all_tips.append({"tip_en": tip, "context": context})
        
        # Multilingual general tips
        general_tips = [
            {
                "tip_en": "Always taste your food while cooking to adjust seasonings",
                "tip_mr": "स्वयंपाक करताना नेहमी चव घ्या आणि मसाले समायोजित करा",
                "tip_hi": "खाना बनाते समय हमेशा स्वाद चखें और मसाले समायोजित करें",
                "context_en": "General", "context_mr": "सामान्य", "context_hi": "सामान्य"
            },
            {
                "tip_en": "Let dal rest for 5 minutes after cooking for better consistency",
                "tip_mr": "चांगल्या सुसंगततेसाठी डाळ शिजल्यानंतर 5 मिनिटे विश्रांती द्या",
                "tip_hi": "बेहतर स्थिरता के लिए दाल पकाने के बाद 5 मिनट आराम करने दें",
                "context_en": "Dal Tips", "context_mr": "डाळ टिप्स", "context_hi": "दाल टिप्स"
            },
            {
                "tip_en": "Add a pinch of sugar to balance acidity in tomato-based curries",
                "tip_mr": "टोमॅटो आधारित करीमध्ये आंबटपणा कमी करण्यासाठी चिमूटभर साखर घाला",
                "tip_hi": "टमाटर आधारित करी में खटास कम करने के लिए चुटकी भर चीनी डालें",
                "context_en": "Curry Tips", "context_mr": "करी टिप्स", "context_hi": "करी टिप्स"
            },
            {
                "tip_en": "Roast spices before grinding for more aromatic flavor",
                "tip_mr": "अधिक सुगंधित चवीसाठी मसाले वाटण्यापूर्वी भाजून घ्या",
                "tip_hi": "अधिक सुगंधित स्वाद के लिए मसालों को पीसने से पहले भून लें",
                "context_en": "Spice Tips", "context_mr": "मसाला टिप्स", "context_hi": "मसाला टिप्स"
            },
            {
                "tip_en": "Soak rice for 30 minutes before cooking for fluffy texture",
                "tip_mr": "फुलकट तांदळासाठी शिजवण्यापूर्वी 30 मिनिटे भिजवा",
                "tip_hi": "फुलके चावल के लिए पकाने से पहले 30 मिनट भिगोएं",
                "context_en": "Rice Tips", "context_mr": "भात टिप्स", "context_hi": "चावल टिप्स"
            },
            {
                "tip_en": "Add hing (asafoetida) to hot oil for the best flavor release",
                "tip_mr": "हिंगाचा उत्तम सुगंध येण्यासाठी गरम तेलात घाला",
                "tip_hi": "हींग का सबसे अच्छा स्वाद पाने के लिए गर्म तेल में डालें",
                "context_en": "Tempering Tips", "context_mr": "फोडणी टिप्स", "context_hi": "तड़का टिप्स"
            },
            {
                "tip_en": "Use jaggery instead of sugar for authentic Maharashtrian taste",
                "tip_mr": "खऱ्या महाराष्ट्रीयन चवीसाठी साखरेऐवजी गूळ वापरा",
                "tip_hi": "असली महाराष्ट्रीयन स्वाद के लिए चीनी की जगह गुड़ का उपयोग करें",
                "context_en": "Dadi's Wisdom", "context_mr": "दादीची शिकवण", "context_hi": "दादी की सीख"
            },
            {
                "tip_en": "Always add salt to bhaji after it's cooked to retain nutrients",
                "tip_mr": "पोषकद्रव्ये टिकवण्यासाठी भाजी शिजल्यावरच मीठ घाला",
                "tip_hi": "पोषक तत्व बनाए रखने के लिए सब्जी पकने के बाद ही नमक डालें",
                "context_en": "Vegetable Tips", "context_mr": "भाजी टिप्स", "context_hi": "सब्जी टिप्स"
            },
            {
                "tip_en": "Keep coriander fresh for longer by wrapping it in a paper towel before refrigerating.",
                "tip_mr": "कोथिंबीर जास्त काळ ताजी ठेवण्यासाठी ती कागदात गुंडाळून फ्रिजमध्ये ठेवा.",
                "tip_hi": "धनिया को ज्यादा समय तक ताज़ा रखने के लिए उसे कागज़ में लपेटकर फ्रिज में रखें।",
                "context_en": "Storage Tips", "context_mr": "साठवणूक टिप्स", "context_hi": "स्टोरेज टिप्स"
            },
            {
                "tip_en": "Use lukewarm water or a little milk while kneading dough for softer chapatis.",
                "tip_mr": "मऊ चपात्यांसाठी पीठ मळताना कोमट पाणी किंवा थोडे दूध वापरा.",
                "tip_hi": "नरम चपातियों के लिए आटा गूंथते समय गुनगुने पानी या थोड़े दूध का उपयोग करें।",
                "context_en": "Roti Tips", "context_mr": "पोळी टिप्स", "context_hi": "रोटी टिप्स"
            },
            {
                "tip_en": "Add a few bay leaves (Tejpatta) to your flour container to keep insects away.",
                "tip_mr": "पिठाला किड लागू नये म्हणून पिठाच्या डब्यात २-३ तमालपत्र ठेवा.",
                "tip_hi": "आटे को कीड़ों से बचाने के लिए डिब्बे में २-३ तेजपत्ता रखें।",
                "context_en": "Dadi's Wisdom", "context_mr": "दादीची शिकवण", "context_hi": "दादी की सीख"
            },
            {
                "tip_en": "If a dish is too salty, drop in a small ball of kneaded dough for 5 minutes to absorb excess salt.",
                "tip_mr": "भाजीत मीठ जास्त झाले तर पिठाचा गोळा टाका, तो जास्तीचे मीठ शोषून घेईल.",
                "tip_hi": "अगर सब्जी में नमक ज्यादा हो जाए तो आटे की एक लोई डालें, वह अतिरिक्त नमक सोख लेगी।",
                "context_en": "Troubleshooting", "context_mr": "निवारण टिप्स", "context_hi": "समाधान टिप्स"
            },
            {
                "tip_en": "Soak garlic cloves in warm water for 10 minutes to peel them effortlessly.",
                "tip_mr": "लसूण लवकर सोलण्यासाठी पाकळ्या १० मिनिटे कोमट पाण्यात भिजवून ठेवा.",
                "tip_hi": "लहसुन जल्दी छीलने के लिए कलियों को १० मिनट के लिए गुनगुने पानी में भिगो दें।",
                "context_en": "Prep Tips", "context_mr": "तयारी टिप्स", "context_hi": "तैयारी टिप्स"
            },
            {
                "tip_en": "Add a teaspoon of hot oil to pakora batter for extra crispiness.",
                "tip_mr": "भजी जास्त कुरकुरीत होण्यासाठी पिठात एक चमचा गरम तेल घाला.",
                "tip_hi": "पकौड़े ज्यादा कुरकुरे बनाने के लिए घोल में एक चम्मच गर्म तेल डालें।",
                "context_en": "Frying Tips", "context_mr": "तळणी टिप्स", "context_hi": "फ्राइंग टिप्स"
            },
            {
                "tip_en": "Store ginger-garlic paste with a pinch of salt and oil to keep it fresh for weeks.",
                "tip_mr": "आले-लसूण पेस्ट जास्त दिवस टिकवण्यासाठी त्यात थोडे मीठ आणि तेल मिसळा.",
                "tip_hi": "अदरक-लहसुन पेस्ट को ज्यादा दिनों तक चलाने के लिए उसमें थोड़ा नमक और तेल मिलाएं।",
                "context_en": "Storage Tips", "context_mr": "साठवणूक टिप्स", "context_hi": "स्टोरेज टिप्स"
            },
            # Category: Storage & Freshness (साठवणूक टिप्स / स्टोरेज टिप्स)
            {
                "tip_en": "Keep a piece of jaggery in your chili powder container to prevent it from getting lumpy.",
                "tip_mr": "लाल तिखटाला गुठळ्या होऊ नयेत म्हणून त्यात गुळाचा एक छोटा खडा ठेवा.",
                "tip_hi": "लाल मिर्च पाउडर में गांठें न बनें, इसके लिए उसमें गुड़ का एक छोटा टुकड़ा रखें।",
                "context_en": "Storage Tips", "context_mr": "साठवणूक टिप्स", "context_hi": "स्टोरेज टिप्स"
            },
            {
                "tip_en": "Store lemons in a jar filled with water in the fridge to keep them juicy for weeks.",
                "tip_mr": "लिंबू जास्त दिवस ताजे आणि रसाळ राहण्यासाठी ते एका काचेच्या बरणीत पाणी भरून त्यात ठेवा.",
                "tip_hi": "नींबू को हफ़्तों तक ताज़ा और रसीला रखने के लिए उन्हें पानी से भरे जार में रखकर फ्रिज में रखें।",
                "context_en": "Storage Tips", "context_mr": "साठवणूक टिप्स", "context_hi": "स्टोरेज टिप्स"
            },
            {
                "tip_en": "Add 2-3 cloves to your sugar jar to keep ants away.",
                "tip_mr": "साखरेच्या डब्यात मुंग्या होऊ नयेत म्हणून त्यात २-३ लवंगा टाका.",
                "tip_hi": "चीनी के डिब्बे में चींटियों को आने से रोकने के लिए उसमें २-३ लौंग डालें।",
                "context_en": "Dadi's Wisdom", "context_mr": "दादीची शिकवण", "context_hi": "दादी की सीख"
            },
            {
                "tip_en": "Wrap green chilies in paper (without stems) to keep them fresh longer.",
                "tip_mr": "मिरच्यांचे देठ काढून त्या कागदात गुंडाळून ठेवल्यास जास्त काळ टिकतात.",
                "tip_hi": "मिर्चियों की डंठल तोड़कर उन्हें कागज में लपेटकर रखने से वे ज्यादा दिन तक ताजी रहती हैं।",
                "context_en": "Storage Tips", "context_mr": "साठवणूक टिप्स", "context_hi": "स्टोरेज टिप्स"
            },
            {
                "tip_en": "Don't store onions and potatoes together; onions release gas that spoils potatoes faster.",
                "tip_mr": "कांदा आणि बटाटे एकत्र ठेवू नका; कांद्यामुळे बटाटे लवकर खराब होतात.",
                "tip_hi": "प्याज और आलू एक साथ न रखें; प्याज से निकलने वाली गैस आलू को जल्दी खराब कर देती है।",
                "context_en": "Inventory Tips", "context_mr": "इन्व्हेंटरी टिप्स", "context_hi": "इन्वेंट्री टिप्स"
            },
            {
                "tip_en": "Add a few grains of rice to your salt shaker to absorb moisture and prevent clumping.",
                "tip_mr": "मिठाला ओलावा लागू नये म्हणून मिठाच्या बाटलीत थोडे तांदळाचे दाणे टाका.",
                "tip_hi": "नमक को नमी से बचाने के लिए नमक की शीशी में थोड़े चावल के दाने डालें।",
                "context_en": "Dadi's Wisdom", "context_mr": "दादीची शिकवण", "context_hi": "दादी की सीख"
            },
            {
                "tip_en": "Rub a little oil on eggs to keep them fresh longer if not refrigerated.",
                "tip_mr": "अंडी फ्रिजबाहेर जास्त दिवस टिकवण्यासाठी त्यांना थोडे तेल लावून ठेवा.",
                "tip_hi": "अंडों को फ्रिज के बाहर ज्यादा दिन तक ताजा रखने के लिए उन पर थोड़ा तेल लगा दें।",
                "context_en": "Storage Tips", "context_mr": "साठवणूक टिप्स", "context_hi": "स्टोरेज टिप्स"
            },
            {
                "tip_en": "Microwave lemons for 10-15 seconds before squeezing to get double the juice.",
                "tip_mr": "लिंबाचा जास्त रस काढण्यासाठी पिळण्यापूर्वी ते १०-१५ सेकंद ओव्हनमध्ये गरम करा.",
                "tip_hi": "नींबू का ज्यादा रस निकालने के लिए उसे निचोड़ने से पहले १०-१५ सेकंड माइक्रोवेव में गर्म करें।",
                "context_en": "Kitchen Hacks", "context_mr": "किचन हॅक्स", "context_hi": "किचन हैक्स"
            },
            {
                "tip_en": "Keep ginger in a container of sand or wrap it in a damp cloth to keep it from drying.",
                "tip_mr": "आले सुकू नये म्हणून ते ओल्या कपड्यात गुंडाळून ठेवा.",
                "tip_hi": "अदरक को सूखने से बचाने के लिए उसे गीले कपड़े में लपेटकर रखें।",
                "context_en": "Storage Tips", "context_mr": "साठवणूक टिप्स", "context_hi": "स्टोरेज टिप्स"
            },
            {
                "tip_en": "Boil milk with a silver spoon or a clean coin to prevent it from spilling over.",
                "tip_mr": "दूध उतू जाऊ नये म्हणून उकळताना त्यात एक स्वच्छ चमचा टाका.",
                "tip_hi": "दूध उबालते समय उसमें एक साफ चम्मच डाल दें, इससे दूध पतीले से बाहर नहीं गिरेगा।",
                "context_en": "Kitchen Hacks", "context_mr": "किचन हॅक्स", "context_hi": "किचन हैक्स"
            },
            # Category: Cooking Efficiency (स्वयंपाक सुलभता / कुकिंग टिप्स)
            {
                "tip_en": "Add a teaspoon of ghee while boiling dal to prevent it from frothing and spilling.",
                "tip_mr": "डाळ शिजवताना त्यात एक चमचा तूप टाका, म्हणजे फेस येऊन कुकरच्या बाहेर येणार नाही.",
                "tip_hi": "दाल उबालते समय उसमें एक चम्मच घी डालें, इससे दाल झाग बनकर बाहर नहीं आएगी।",
                "context_en": "Dal Tips", "context_mr": "डाळ टिप्स", "context_hi": "दाल टिप्स"
            },
            {
                "tip_en": "Add a pinch of salt while frying onions to make them brown faster.",
                "tip_mr": "कांदा लवकर लाल होण्यासाठी तळताना त्यात चिमूटभर मीठ टाका.",
                "tip_hi": "प्याज को जल्दी सुनहरा करने के लिए तलते समय उसमें चुटकी भर नमक डालें।",
                "context_en": "Cooking Tips", "context_mr": "स्वयंपाक टिप्स", "context_hi": "कुकिंग टिप्स"
            },
            {
                "tip_en": "Soak almonds in hot water for 15 minutes to peel the skin instantly.",
                "tip_mr": "बदामाची साल झटपट काढण्यासाठी ते १५ मिनिटे गरम पाण्यात भिजवा.",
                "tip_hi": "बादाम का छिलका तुरंत उतारने के लिए उन्हें १५ मिनट गर्म पानी में भिगोएं।",
                "context_en": "Prep Tips", "context_mr": "तयारी टिप्स", "context_hi": "तैयारी टिप्स"
            },
            {
                "tip_en": "Add a piece of dry mango (Amchur) or tamarind to prevent ladyfinger (Bhindi) from getting sticky.",
                "tip_mr": "भेंडीची भाजी चिकट होऊ नये म्हणून त्यात थोडा आमसूल किंवा लिंबाचा रस टाका.",
                "tip_hi": "भिंडी की सब्जी को चिपचिपा होने से बचाने के लिए उसमें थोड़ा अमचूर या नींबू का रस डालें।",
                "context_en": "Vegetable Tips", "context_mr": "भाजी टिप्स", "context_hi": "सब्जी टिप्स"
            },
            {
                "tip_en": "Grate cold butter for easier mixing into dough for biscuits or parathas.",
                "tip_mr": "पिठात लोणी व्यवस्थित मिसळण्यासाठी ते किसणीने किसून घ्या.",
                "tip_hi": "आटे में मक्खन को आसानी से मिलाने के लिए उसे कद्दूकस कर लें।",
                "context_en": "Baking Tips", "context_mr": "बेकिंग टिप्स", "context_hi": "बेकिंग टिप्स"
            },
            {
                "tip_en": "Use left-over whey (paneer water) to knead dough for extra soft and nutritious rotis.",
                "tip_mr": "पनीर काढल्यानंतर उरलेले पाणी पीठ मळण्यासाठी वापरा, चपात्या मऊ आणि पौष्टिक होतील.",
                "tip_hi": "पनीर निकालने के बाद बचे हुए पानी से आटा गूंथें, रोटियां नरम और पौष्टिक बनेंगी।",
                "context_en": "Zero Waste", "context_mr": "शून्य कचरा", "context_hi": "जीरो वेस्ट"
            },
            {
                "tip_en": "Always roast rava (semolina) before storing to prevent worms.",
                "tip_mr": "रव्याला कीड लागू नये म्हणून तो नेहमी भाजून साठवून ठेवा.",
                "tip_hi": "सूजी (रवा) को कीड़ों से बचाने के लिए हमेशा भूनकर स्टोर करें।",
                "context_en": "Storage Tips", "context_mr": "साठवणूक टिप्स", "context_hi": "स्टोरेज टिप्स"
            },
            {
                "tip_en": "Add a few drops of oil to the water while boiling pasta or noodles to stop them from sticking.",
                "tip_mr": "पास्ता किंवा नूडल्स उकळताना पाण्यात थोडे तेल टाका, म्हणजे ते एकमेकांना चिकटणार नाहीत.",
                "tip_hi": "पास्ता या नूडल्स उबालते समय पानी में तेल की कुछ बूंदें डालें, इससे वे आपस में नहीं चिपकेंगे।",
                "context_en": "Pasta Tips", "context_mr": "पास्ता टिप्स", "context_hi": "पास्ता टिप्स"
            },
            {
                "tip_en": "To make perfect curd in winter, keep the container in a warm place or wrap it in a woollen cloth.",
                "tip_mr": "थंडीत दही चांगले लागण्यासाठी भांड्याला उबदार कापडात गुंडाळून ठेवा.",
                "tip_hi": "सर्दियों में गाढ़ा दही जमाने के लिए बर्तन को किसी गर्म कपड़े में लपेटकर रखें।",
                "context_en": "Dairy Tips", "context_mr": "डेअरी टिप्स", "context_hi": "डेयरी टिप्स"
            },
            {
                "tip_en": "Drop a few small pieces of hing in the container of oil to keep the oil fresh and aromatic.",
                "tip_mr": "तेलाचा वास छान राहण्यासाठी तेलाच्या डब्यात हिंगाचा एक छोटा खडा टाका.",
                "tip_hi": "तेल को ताज़ा और सुगंधित रखने के लिए तेल के डिब्बे में हींग का एक छोटा टुकड़ा डालें।",
                "context_en": "Dadi's Wisdom", "context_mr": "दादीची शिकवण", "context_hi": "दादी की सीख"
            },
            #Category: Cleaning & Maintenance (स्वच्छता टिप्स / सफाई टिप्स)
            {
                "tip_en": "To remove the smell of onion or garlic from your hands, rub them against a stainless steel spoon.",
                "tip_mr": "हाताचा कांदा-लसणाचा वास घालवण्यासाठी हात स्टीलच्या चमच्यावर घासून धुवा.",
                "tip_hi": "हाथों से प्याज या लहसुन की महक हटाने के लिए उन्हें स्टील के चम्मच पर रगड़कर धोएं।",
                "context_en": "Cleaning", "context_mr": "स्वच्छता", "context_hi": "सफाई"
            },
            {
                "tip_en": "Clean burnt vessels by boiling water with a little baking soda and vinegar in them.",
                "tip_mr": "करपलेली भांडी स्वच्छ करण्यासाठी त्यात थोडे बेकिंग सोडा आणि व्हिनेगर टाकून पाणी उकळा.",
                "tip_hi": "जले हुए बर्तनों को साफ करने के लिए उनमें थोड़ा बेकिंग सोडा और सिरका डालकर पानी उबालें।",
                "context_en": "Cleaning", "context_mr": "स्वच्छता", "context_hi": "सफाई"
            },
            {
                "tip_en": "Use used lemon halves to scrub your copper and brass vessels to make them shine.",
                "tip_mr": "तांब्या-पितळेची भांडी चमकवण्यासाठी वापरलेल्या लिंबाच्या सालीने घासून घ्या.",
                "tip_hi": "तांबे और पीतल के बर्तनों को चमकाने के लिए इस्तेमाल किए हुए नींबू के छिलकों का उपयोग करें।",
                "context_en": "Cleaning", "context_mr": "स्वच्छता", "context_hi": "सफाई"
            },
            {
                "tip_en": "Put dried orange peels in kitchen cabinets to keep them smelling fresh and drive away insects.",
                "tip_mr": "किचनच्या कपाटात वाळलेली संत्र्याची सालं ठेवा, म्हणजे कपाटात छान वास येईल.",
                "tip_hi": "किचन की अलमारी में संतरे के सूखे छिलके रखें, इससे अलमारी महकती रहेगी और कीड़े भी नहीं आएंगे।",
                "context_en": "Dadi's Wisdom", "context_mr": "दादीची शिकवण", "context_hi": "दादी की सीख"
            },
            {
                "tip_en": "Clean your mixer jar by grinding some salt in it once a month to sharpen the blades.",
                "tip_mr": "मिक्सरचे ब्लेड धारदार करण्यासाठी महिन्यातून एकदा त्यात खडे मीठ टाकून फिरवा.",
                "tip_hi": "मिक्सर के ब्लेड तेज करने के लिए महीने में एक बार उसमें थोड़ा नमक डालकर चलाएं।",
                "context_en": "Maintenance", "context_mr": "देखभाल", "context_hi": "रखरखाव"
            },
            # Category: Flavor Enhancers (चव वाढवण्यासाठी / स्वाद बढ़ाने के लिए)
            {
                "tip_en": "Add a bit of kasuri methi at the end for a restaurant-like aroma in your curries.",
                "tip_mr": "हॉटेलसारखा सुगंध येण्यासाठी भाजी तयार झाल्यावर त्यात थोडी कसुरी मेथी टाका.",
                "tip_hi": "सब्जी में रेस्टोरेंट जैसी खुशबू के लिए अंत में थोड़ी कसूरी मेथी डालें।",
                "context_en": "Curry Tips", "context_mr": "करी टिप्स", "context_hi": "करी टिप्स"
            },
            {
                "tip_en": "Grate a small piece of ginger into your tea while boiling for a refreshing flavor.",
                "tip_mr": "चहाची चव वाढवण्यासाठी त्यात थोडे आले किसून टाका.",
                "tip_hi": "चाय का स्वाद बढ़ाने के लिए उसमें थोड़ा अदरक कद्दूकस करके डालें।",
                "context_en": "Beverage Tips", "context_mr": "पेय टिप्स", "context_hi": "बेवरेज टिप्स"
            },
            {
                "tip_en": "Add a spoonful of curd to your paratha dough to keep the parathas soft for hours.",
                "tip_mr": "पराठे बराच वेळ मऊ राहण्यासाठी पिठात एक चमचा दही घाला.",
                "tip_hi": "पराठों को घंटों नरम रखने के लिए आटे में एक चम्मच दही मिलाएं।",
                "context_en": "Roti Tips", "context_mr": "पोळी टिप्स", "context_hi": "रोटी टिप्स"
            },
            {
                "tip_en": "Always grind green chilies with a little salt to keep the color bright green.",
                "tip_mr": "मिरची वाटताना त्यात थोडे मीठ टाका, म्हणजे तिचा हिरवा रंग कायम राहील.",
                "tip_hi": "मिर्च पीसते समय उसमें थोड़ा नमक डालें, इससे उसका हरा रंग बरकरार रहेगा।",
                "context_en": "Prep Tips", "context_mr": "तयारी टिप्स", "context_hi": "तैयारी टिप्स"
            },
            {
                "tip_en": "Keep potatoes in salted water after cutting to prevent them from turning brown.",
                "tip_mr": "बटाटे चिरल्यानंतर मिठाच्या पाण्यात ठेवा, म्हणजे ते काळे पडणार नाहीत.",
                "tip_hi": "आलू काटने के बाद उन्हें नमक वाले पानी में रखें, इससे वे काले नहीं पड़ेंगे।",
                "context_en": "Vegetable Tips", "context_mr": "भाजी टिप्स", "context_hi": "सब्जी टिप्स"
            },
            # Category: Health & Wellness (आरोग्य आणि आयुर्वेद)
            {
                "tip_en": "Drink a glass of warm water with lemon and honey every morning to boost immunity.",
                "tip_mr": "प्रतिकारशक्ती वाढवण्यासाठी रोज सकाळी कोमट पाण्यात लिंबू आणि मध टाकून प्या.",
                "tip_hi": "इम्युनिटी बढ़ाने के लिए हर सुबह गुनगुने पानी में नींबू और शहद डालकर पिएं।",
                "context_en": "Health Tips", "context_mr": "आरोग्य टिप्स", "context_hi": "स्वास्थ्य टिप्स"
            },
            {
                "tip_en": "Add a little turmeric and black pepper to your milk at night for better healing and sleep.",
                "tip_mr": "चांगल्या झोपेसाठी आणि शरीरातील वेदना कमी करण्यासाठी रात्री दुधात हळद आणि मिरी पूड टाकून प्या.",
                "tip_hi": "बेहतर स्वास्थ्य और नींद के लिए रात को दूध में हल्दी और काली मिर्च डालकर पिएं।",
                "context_en": "Dadi's Wisdom", "context_mr": "दादीची शिकवण", "context_hi": "दादी की सीख"
            },
            {
                "tip_en": "Chew a few fennel seeds (Saunf) after meals to improve digestion and freshen breath.",
                "tip_mr": "जेवणानंतर पचन सुधारण्यासाठी आणि मुखशुद्धीसाठी थोडी बडीशेप खा.",
                "tip_hi": "पाचन सुधारने और माउथ फ्रेशनर के लिए खाने के बाद थोड़ी सौंफ चबाएं।",
                "context_en": "Health Tips", "context_mr": "आरोग्य टिप्स", "context_hi": "स्वास्थ्य टिप्स"
            },
            {
                "tip_en": "Soak fenugreek seeds (Methi) overnight and drink the water in the morning to control blood sugar.",
                "tip_mr": "रक्तातील साखर नियंत्रित ठेवण्यासाठी रात्री मेथी दाणे भिजवून सकाळी त्याचे पाणी प्या.",
                "tip_hi": "ब्लड शुगर कंट्रोल करने के लिए रात भर मेथी दाने भिगोकर रखें और सुबह उसका पानी पिएं।",
                "context_en": "Health Tips", "context_mr": "आरोग्य टिप्स", "context_hi": "स्वास्थ्य टिप्स"
            },
            {
                "tip_en": "Eat a small piece of jaggery after lunch to aid digestion and prevent acidity.",
                "tip_mr": "पचन सुधारण्यासाठी आणि ॲसिडिटी टाळण्यासाठी दुपारच्या जेवणानंतर गुळाचा एक छोटा खडा खा.",
                "tip_hi": "पाचन में मदद और एसिडिटी से बचने के लिए दोपहर के भोजन के बाद गुड़ का एक छोटा टुकड़ा खाएं।",
                "context_en": "Dadi's Wisdom", "context_mr": "दादीची शिकवण", "context_hi": "दादी की सीख"
            },
            {
                "tip_en": "Keep water in a copper vessel overnight and drink it in the morning for better gut health.",
                "tip_mr": "पोट साफ राहण्यासाठी तांब्याच्या भांड्यात रात्रभर ठेवलेले पाणी सकाळी प्या.",
                "tip_hi": "पेट की सेहत के लिए तांबे के बर्तन में रात भर रखा हुआ पानी सुबह पिएं।",
                "context_en": "Health Tips", "context_mr": "आरोग्य टिप्स", "context_hi": "स्वास्थ्य टिप्स"
            },
            {
                "tip_en": "Add a pinch of carom seeds (Ajwain) to heavy foods like dal or potatoes to prevent bloating.",
                "tip_mr": "गॅस किंवा अपचनाचा त्रास टाळण्यासाठी बटाटा किंवा डाळीच्या पदार्थात थोडा ओवा घाला.",
                "tip_hi": "गैस या अपच से बचने के लिए दाल या आलू जैसे भारी खानों में चुटकी भर अजवाइन डालें।",
                "context_en": "Health Tips", "context_mr": "आरोग्य टिप्स", "context_hi": "स्वास्थ्य टिप्स"
            },
            {
                "tip_en": "Use rock salt (Sendha Namak) instead of regular salt to reduce water retention and bloating.",
                "tip_mr": "शरीरातील सूज कमी करण्यासाठी साध्या मिठाऐवजी सैंधव मिठाचा वापर करा.",
                "tip_hi": "शरीर की सूजन कम करने के लिए साधारण नमक की जगह सेंधा नमक का उपयोग करें।",
                "context_en": "Dadi's Wisdom", "context_mr": "दादीची शिकवण", "context_hi": "दादी की सीख"
            },
            {
                "tip_en": "Sniff fresh ginger or drink ginger tea to instantly relieve nausea and morning sickness.",
                "tip_mr": "मळमळ कमी करण्यासाठी आल्याचा छोटा तुकडा हुंगा किंवा आल्याचा चहा प्या.",
                "tip_hi": "जी मिचलाने पर ताज़ा अदरक सूंघें या अदरक वाली चाय पिएं, तुरंत आराम मिलेगा।",
                "context_en": "Health Tips", "context_mr": "आरोग्य टिप्स", "context_hi": "स्वास्थ्य टिप्स"
            },
            {
                "tip_en": "Apply a drop of ghee inside your nostrils during dry weather to prevent nosebleeds and dry skin.",
                "tip_mr": "कोरड्या हवेमुळे होणारा त्रास टाळण्यासाठी नाकाच्या आत तुपाचा एक थेंब लावा.",
                "tip_hi": "नाक के सूखेपन से बचने के लिए नथुनों के अंदर घी की एक बूंद लगाएं।",
                "context_en": "Dadi's Wisdom", "context_mr": "दादीची शिकवण", "context_hi": "दादी की सीख"
            }
        ]
        
        # Add general tips with language support
        for tip in general_tips:
            if lang == "mr":
                all_tips.append({"tip_en": tip["tip_mr"], "context": tip["context_mr"]})
            elif lang == "hi":
                all_tips.append({"tip_en": tip["tip_hi"], "context": tip["context_hi"]})
            else:
                all_tips.append({"tip_en": tip["tip_en"], "context": tip["context_en"]})
        
        if all_tips:
            import random
            selected = random.choice(all_tips)
            return {"tip": selected["tip_en"], "context": selected["context"]}
        
        # Default tip in requested language
        default_tips = {
            "en": {"tip": "Cook with love, food tastes better!", "context": "Dadi's Wisdom"},
            "mr": {"tip": "प्रेमाने स्वयंपाक करा, जेवण चविष्ट होते!", "context": "दादीची शिकवण"},
            "hi": {"tip": "प्यार से खाना बनाओ, खाना स्वादिष्ट होता है!", "context": "दादी की सीख"}
        }
        return default_tips.get(lang, default_tips["en"])
    
    
    return dadi_router
