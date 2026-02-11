"""
Household Management Module for Rasoi-Sync
- Create/Join households with 6-digit kitchen codes
- Member management (max 4 members)
- Users can belong to multiple households
"""
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
import uuid
import random
import string

# Import centralized pantry data
from data.pantry_items import get_essentials_pack

# Security
security = HTTPBearer(auto_error=False)

# Router
household_router = APIRouter(prefix="/api/households", tags=["Households"])

# Constants
MAX_MEMBERS_PER_HOUSEHOLD = 4

# ============ MODELS ============

class HouseholdCreate(BaseModel):
    name: str  # e.g., "Sharma Family Kitchen", "My Home"

class HouseholdJoin(BaseModel):
    kitchen_code: str  # 6-digit code

class Household(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    kitchen_code: str  # Unique 6-digit code
    created_by: str  # User ID of creator
    members: List[Dict[str, Any]] = []  # [{user_id, name, role, joined_at}]
    settings: Dict[str, Any] = {}  # Household preferences
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class HouseholdMember(BaseModel):
    user_id: str
    name: str
    email: str
    role: str = "member"  # "owner" or "member"
    joined_at: datetime

class HouseholdResponse(BaseModel):
    id: str
    name: str
    kitchen_code: str
    members: List[Dict[str, Any]]
    member_count: int
    is_owner: bool
    created_at: datetime

# ============ HELPER FUNCTIONS ============

def generate_kitchen_code() -> str:
    """Generate a unique 6-digit alphanumeric code"""
    # Use uppercase letters and digits, excluding confusing characters (0, O, I, 1)
    chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    return ''.join(random.choices(chars, k=6))


# Essential items to pre-load for new kitchens
ESSENTIALS_PACK = [
    # Grains & Cereals
    {"name_en": "Rice", "name_mr": "तांदूळ", "name_hi": "चावल", "category": "grains", "unit": "kg", "monthly_quantity": 5000, "current_stock": 0},
    {"name_en": "Wheat Flour", "name_mr": "गव्हाचे पीठ", "name_hi": "गेहूं का आटा", "category": "grains", "unit": "kg", "monthly_quantity": 5000, "current_stock": 0},
    {"name_en": "Rava", "name_mr": "रवा", "name_hi": "रवा", "category": "grains", "unit": "g", "monthly_quantity": 1000, "current_stock": 0},
    {"name_en": "Poha", "name_mr": "पोहे", "name_hi": "पोहा", "category": "grains", "unit": "g", "monthly_quantity": 500, "current_stock": 0},
    # Pulses
    {"name_en": "Toor Dal", "name_mr": "तूर डाळ", "name_hi": "तूर दाल", "category": "pulses", "unit": "g", "monthly_quantity": 1000, "current_stock": 0},
    {"name_en": "Moong Dal", "name_mr": "मूग डाळ", "name_hi": "मूंग दाल", "category": "pulses", "unit": "g", "monthly_quantity": 500, "current_stock": 0},
    {"name_en": "Chana Dal", "name_mr": "हरभरा डाळ", "name_hi": "चना दाल", "category": "pulses", "unit": "g", "monthly_quantity": 500, "current_stock": 0},
    {"name_en": "Masoor Dal", "name_mr": "मसूर डाळ", "name_hi": "मसूर दाल", "category": "pulses", "unit": "g", "monthly_quantity": 500, "current_stock": 0},
    # Spices
    {"name_en": "Turmeric Powder", "name_mr": "हळद पावडर", "name_hi": "हल्दी पाउडर", "category": "spices", "unit": "g", "monthly_quantity": 100, "current_stock": 0},
    {"name_en": "Red Chili Powder", "name_mr": "लाल मिरची पूड", "name_hi": "लाल मिर्च पाउडर", "category": "spices", "unit": "g", "monthly_quantity": 100, "current_stock": 0},
    {"name_en": "Cumin Seeds", "name_mr": "जिरे", "name_hi": "जीरा", "category": "spices", "unit": "g", "monthly_quantity": 100, "current_stock": 0},
    {"name_en": "Coriander Powder", "name_mr": "धणे पूड", "name_hi": "धनिया पाउडर", "category": "spices", "unit": "g", "monthly_quantity": 100, "current_stock": 0},
    {"name_en": "Garam Masala", "name_mr": "गरम मसाला", "name_hi": "गरम मसाला", "category": "spices", "unit": "g", "monthly_quantity": 50, "current_stock": 0},
    {"name_en": "Mustard Seeds", "name_mr": "मोहरी", "name_hi": "राई", "category": "spices", "unit": "g", "monthly_quantity": 50, "current_stock": 0},
    {"name_en": "Salt", "name_mr": "मीठ", "name_hi": "नमक", "category": "spices", "unit": "g", "monthly_quantity": 500, "current_stock": 0},
    # Oils & Dairy
    {"name_en": "Cooking Oil", "name_mr": "तेल", "name_hi": "तेल", "category": "oils", "unit": "L", "monthly_quantity": 2000, "current_stock": 0},
    {"name_en": "Ghee", "name_mr": "तूप", "name_hi": "घी", "category": "oils", "unit": "ml", "monthly_quantity": 500, "current_stock": 0},
    {"name_en": "Milk", "name_mr": "दूध", "name_hi": "दूध", "category": "dairy", "unit": "L", "monthly_quantity": 15000, "current_stock": 0},
    {"name_en": "Curd", "name_mr": "दही", "name_hi": "दही", "category": "dairy", "unit": "ml", "monthly_quantity": 2000, "current_stock": 0},
    # Sugar & Sweeteners
    {"name_en": "Sugar", "name_mr": "साखर", "name_hi": "चीनी", "category": "grains", "unit": "kg", "monthly_quantity": 2000, "current_stock": 0},
    {"name_en": "Jaggery", "name_mr": "गूळ", "name_hi": "गुड़", "category": "grains", "unit": "g", "monthly_quantity": 500, "current_stock": 0},
    # Beverages
    {"name_en": "Tea Leaves", "name_mr": "चहा पावडर", "name_hi": "चाय पत्ती", "category": "beverages", "unit": "g", "monthly_quantity": 250, "current_stock": 0},
]


async def populate_essentials(db, household_id: str, user_id: str):
    """Populate a new kitchen with essential items"""
    items_to_insert = []
    for item in ESSENTIALS_PACK:
        items_to_insert.append({
            "id": str(uuid.uuid4()),
            "household_id": household_id,
            "name_en": item["name_en"],
            "name_mr": item["name_mr"],
            "name_hi": item["name_hi"],
            "category": item["category"],
            "unit": item["unit"],
            "stock_level": "empty",
            "current_stock": 0,
            "monthly_quantity": item["monthly_quantity"],
            "freshness": None,
            "is_secret_stash": False,
            "expiry_date": None,
            "barcode": None,
            "reserved_for": [],
            "last_updated_by": user_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    if items_to_insert:
        await db.inventory.insert_many(items_to_insert)
    
    return len(items_to_insert)

# ============ ROUTES ============

def create_household_routes(db, decode_token_func):
    """Factory function to create household routes with database access"""
    
    async def get_user_from_token(credentials: HTTPAuthorizationCredentials):
        if not credentials:
            raise HTTPException(status_code=401, detail="Not authenticated")
        payload = decode_token_func(credentials.credentials)
        user_id = payload.get("sub")
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user
    
    @household_router.post("/create")
    async def create_household(
        data: HouseholdCreate,
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        user = await get_user_from_token(credentials)
        
        # Generate unique kitchen code
        kitchen_code = generate_kitchen_code()
        while await db.households.find_one({"kitchen_code": kitchen_code}):
            kitchen_code = generate_kitchen_code()
        
        household_id = str(uuid.uuid4())
        
        # Create household
        household = {
            "id": household_id,
            "name": data.name,
            "kitchen_code": kitchen_code,
            "created_by": user["id"],
            "members": [{
                "user_id": user["id"],
                "name": user["name"],
                "email": user["email"],
                "role": "owner",
                "joined_at": datetime.now(timezone.utc)
            }],
            "settings": {
                "language": user.get("home_language", "en"),
                "city": user.get("city", "Pune"),
                "essentials_loaded": True  # Flag to show welcome banner
            },
            "created_at": datetime.now(timezone.utc)
        }
        
        await db.households.insert_one(household)
        
        # Auto-populate with essentials pack
        items_added = await populate_essentials(db, household_id, user["id"])
        
        # Add household to user's list, set as active, and mark essentials loaded
        await db.users.update_one(
            {"id": user["id"]},
            {
                "$addToSet": {"households": household["id"]},
                "$set": {
                    "active_household": household["id"],
                    "essentials_loaded": True,
                    "show_essentials_banner": True
                }
            }
        )
        
        return {
            "id": household["id"],
            "name": household["name"],
            "kitchen_code": kitchen_code,
            "members": household["members"],
            "member_count": 1,
            "is_owner": True,
            "essentials_loaded": True,
            "items_added": items_added,
            "message": f"Kitchen created with {items_added} essential items! Share code '{kitchen_code}' with family."
        }
    
    @household_router.post("/join")
    async def join_household(
        data: HouseholdJoin,
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        user = await get_user_from_token(credentials)
        
        # Find household by code (case insensitive)
        household = await db.households.find_one(
            {"kitchen_code": data.kitchen_code.upper()}
        )
        
        if not household:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invalid kitchen code. Please check and try again."
            )
        
        # Check if already a member
        if any(m["user_id"] == user["id"] for m in household["members"]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You are already a member of this kitchen"
            )
        
        # Check member limit
        if len(household["members"]) >= MAX_MEMBERS_PER_HOUSEHOLD:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"This kitchen is full (max {MAX_MEMBERS_PER_HOUSEHOLD} members)"
            )
        
        # Add member
        new_member = {
            "user_id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "role": "member",
            "joined_at": datetime.now(timezone.utc)
        }
        
        await db.households.update_one(
            {"id": household["id"]},
            {"$push": {"members": new_member}}
        )
        
        # Add household to user's list, set as active, and mark onboarding complete
        await db.users.update_one(
            {"id": user["id"]},
            {
                "$addToSet": {"households": household["id"]},
                "$set": {
                    "active_household": household["id"],
                    "onboarding_complete": True
                }
            }
        )
        
        # Get updated household
        updated = await db.households.find_one({"id": household["id"]}, {"_id": 0})
        
        return {
            "id": updated["id"],
            "name": updated["name"],
            "kitchen_code": updated["kitchen_code"],
            "members": updated["members"],
            "member_count": len(updated["members"]),
            "is_owner": False,
            "message": f"You've joined '{updated['name']}'!"
        }
    
    @household_router.get("/my-households")
    async def get_my_households(
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        user = await get_user_from_token(credentials)
        
        household_ids = user.get("households", [])
        if not household_ids:
            return {"households": [], "active_household": None}
        
        households = await db.households.find(
            {"id": {"$in": household_ids}},
            {"_id": 0}
        ).to_list(10)
        
        # Format response
        result = []
        for h in households:
            is_owner = h["created_by"] == user["id"]
            result.append({
                "id": h["id"],
                "name": h["name"],
                "kitchen_code": h["kitchen_code"],
                "member_count": len(h["members"]),
                "members": h["members"],
                "is_owner": is_owner,
                "created_at": h["created_at"].isoformat() if isinstance(h["created_at"], datetime) else h["created_at"]
            })
        
        return {
            "households": result,
            "active_household": user.get("active_household")
        }
    
    @household_router.get("/{household_id}")
    async def get_household(
        household_id: str,
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        user = await get_user_from_token(credentials)
        
        household = await db.households.find_one({"id": household_id}, {"_id": 0})
        if not household:
            raise HTTPException(status_code=404, detail="Household not found")
        
        # Check if user is a member
        if not any(m["user_id"] == user["id"] for m in household["members"]):
            raise HTTPException(status_code=403, detail="You are not a member of this household")
        
        is_owner = household["created_by"] == user["id"]
        
        return {
            "id": household["id"],
            "name": household["name"],
            "kitchen_code": household["kitchen_code"],
            "members": household["members"],
            "member_count": len(household["members"]),
            "is_owner": is_owner,
            "settings": household.get("settings", {}),
            "created_at": household["created_at"].isoformat() if isinstance(household["created_at"], datetime) else household["created_at"]
        }
    
    @household_router.post("/{household_id}/switch")
    async def switch_household(
        household_id: str,
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        user = await get_user_from_token(credentials)
        
        # Verify user is a member
        if household_id not in user.get("households", []):
            raise HTTPException(status_code=403, detail="You are not a member of this household")
        
        # Update active household
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"active_household": household_id}}
        )
        
        household = await db.households.find_one({"id": household_id}, {"_id": 0})
        
        return {
            "message": f"Switched to '{household['name']}'",
            "active_household": household_id,
            "household_name": household["name"]
        }
    
    @household_router.post("/{household_id}/leave")
    async def leave_household(
        household_id: str,
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        user = await get_user_from_token(credentials)
        
        household = await db.households.find_one({"id": household_id})
        if not household:
            raise HTTPException(status_code=404, detail="Household not found")
        
        # Check if user is the owner
        if household["created_by"] == user["id"]:
            # Owner can't leave, must transfer or delete
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Owner cannot leave. Transfer ownership first or delete the kitchen."
            )
        
        # Remove from household members
        await db.households.update_one(
            {"id": household_id},
            {"$pull": {"members": {"user_id": user["id"]}}}
        )
        
        # Remove from user's households list
        remaining_households = [h for h in user.get("households", []) if h != household_id]
        new_active = remaining_households[0] if remaining_households else None
        
        await db.users.update_one(
            {"id": user["id"]},
            {
                "$pull": {"households": household_id},
                "$set": {"active_household": new_active}
            }
        )
        
        return {"message": f"You've left '{household['name']}'"}
    
    @household_router.delete("/{household_id}")
    async def delete_household(
        household_id: str,
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        user = await get_user_from_token(credentials)
        
        household = await db.households.find_one({"id": household_id})
        if not household:
            raise HTTPException(status_code=404, detail="Household not found")
        
        # Only owner can delete
        if household["created_by"] != user["id"]:
            raise HTTPException(status_code=403, detail="Only the owner can delete this kitchen")
        
        # Check if there are other members - must remove them first
        other_members = [m for m in household["members"] if m["user_id"] != user["id"]]
        if len(other_members) > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Please remove all {len(other_members)} member(s) before deleting the kitchen"
            )
        
        # Remove household from owner
        await db.users.update_one(
            {"id": user["id"]},
            {"$pull": {"households": household_id}}
        )
        
        # Reset active_household if this was active
        await db.users.update_one(
            {"id": user["id"], "active_household": household_id},
            {"$set": {"active_household": None}}
        )
        
        # Delete associated data
        await db.inventory.delete_many({"household_id": household_id})
        await db.shopping_list.delete_many({"household_id": household_id})
        await db.meal_plans.delete_many({"household_id": household_id})
        
        # Delete household
        await db.households.delete_one({"id": household_id})
        
        return {"message": f"Kitchen '{household['name']}' has been deleted"}
    
    @household_router.put("/{household_id}/settings")
    async def update_household_settings(
        household_id: str,
        settings: dict,
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        user = await get_user_from_token(credentials)
        
        household = await db.households.find_one({"id": household_id})
        if not household:
            raise HTTPException(status_code=404, detail="Household not found")
        
        # Only owner can update settings
        if household["created_by"] != user["id"]:
            raise HTTPException(status_code=403, detail="Only the owner can update settings")
        
        # Merge settings
        current_settings = household.get("settings", {})
        current_settings.update(settings)
        
        await db.households.update_one(
            {"id": household_id},
            {"$set": {"settings": current_settings}}
        )
        
        return {"message": "Settings updated", "settings": current_settings}
    
    @household_router.post("/{household_id}/transfer-ownership")
    async def transfer_ownership(
        household_id: str,
        new_owner_id: str,
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        user = await get_user_from_token(credentials)
        
        household = await db.households.find_one({"id": household_id})
        if not household:
            raise HTTPException(status_code=404, detail="Household not found")
        
        # Only owner can transfer
        if household["created_by"] != user["id"]:
            raise HTTPException(status_code=403, detail="Only the owner can transfer ownership")
        
        # Verify new owner is a member
        if not any(m["user_id"] == new_owner_id for m in household["members"]):
            raise HTTPException(status_code=400, detail="New owner must be an existing member")
        
        # Update ownership
        await db.households.update_one(
            {"id": household_id},
            {"$set": {"created_by": new_owner_id}}
        )
        
        # Update member roles
        members = household["members"]
        for m in members:
            if m["user_id"] == user["id"]:
                m["role"] = "member"
            elif m["user_id"] == new_owner_id:
                m["role"] = "owner"
        
        await db.households.update_one(
            {"id": household_id},
            {"$set": {"members": members}}
        )
        
        return {"message": "Ownership transferred successfully"}
    
    @household_router.delete("/{household_id}/member/{member_user_id}")
    async def remove_member(
        household_id: str,
        member_user_id: str,
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """Remove a member from the household. Only the owner can remove members."""
        user = await get_user_from_token(credentials)
        
        household = await db.households.find_one({"id": household_id})
        if not household:
            raise HTTPException(status_code=404, detail="Household not found")
        
        # Only owner can remove members
        if household["created_by"] != user["id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail="Only the owner can remove members"
            )
        
        # Can't remove the owner themselves via this endpoint
        if member_user_id == household["created_by"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Owner cannot be removed. Transfer ownership first or delete the kitchen."
            )
        
        # Check if member exists in household
        member_exists = any(m["user_id"] == member_user_id for m in household["members"])
        if not member_exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Member not found in this household"
            )
        
        # Get member name for response
        member_name = next((m["name"] for m in household["members"] if m["user_id"] == member_user_id), "Member")
        
        # Remove from household members
        await db.households.update_one(
            {"id": household_id},
            {"$pull": {"members": {"user_id": member_user_id}}}
        )
        
        # Remove from user's households list
        member_user = await db.users.find_one({"id": member_user_id})
        if member_user:
            remaining_households = [h for h in member_user.get("households", []) if h != household_id]
            new_active = remaining_households[0] if remaining_households else None
            
            await db.users.update_one(
                {"id": member_user_id},
                {
                    "$pull": {"households": household_id},
                    "$set": {"active_household": new_active}
                }
            )
        
        return {"message": f"{member_name} has been removed from the kitchen"}
    
    return household_router
