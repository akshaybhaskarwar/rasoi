"""
Shopping list routes for Rasoi-Sync
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid

from models.shopping import ShoppingItem, ShoppingItemCreate, ShoppingStatusUpdate

security = HTTPBearer(auto_error=False)
shopping_router = APIRouter(prefix="/api", tags=["Shopping"])


def create_shopping_routes(db, decode_token, translate_service, notify_shopping_change, notify_inventory_change):
    """Factory function to create shopping routes with database access"""
    
    async def get_user_from_token(credentials: HTTPAuthorizationCredentials):
        if not credentials:
            raise HTTPException(status_code=401, detail="Not authenticated")
        payload = decode_token(credentials.credentials)
        user_id = payload.get("sub")
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user

    @shopping_router.post("/shopping", response_model=ShoppingItem)
    async def create_shopping_item(
        item: ShoppingItemCreate,
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """Create shopping list item for user's active household"""
        user = await get_user_from_token(credentials)
        
        household_id = user.get("active_household")
        if not household_id:
            raise HTTPException(status_code=400, detail="No active household. Please create or join a kitchen first.")
        
        item_dict = item.model_dump()
        shopping_item = ShoppingItem(**item_dict)
        shopping_item.household_id = household_id
        
        if item.name_mr:
            shopping_item.name_mr = item.name_mr
        else:
            name_mr = await translate_service.translate_text_simple(item.name_en, "mr")
            shopping_item.name_mr = name_mr
        
        name_hi = await translate_service.translate_text_simple(item.name_en, "hi")
        shopping_item.name_hi = name_hi
        
        if item.stock_level:
            shopping_item.stock_level = item.stock_level
        if item.monthly_quantity:
            shopping_item.monthly_quantity = item.monthly_quantity
        
        doc = shopping_item.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        doc['household_id'] = household_id
        
        await db.shopping_list.insert_one(doc)
        await notify_shopping_change(household_id, "add", doc, user.get("name"))
        
        return shopping_item

    @shopping_router.put("/shopping/{item_id}")
    async def update_shopping_item(
        item_id: str, 
        updates: Dict[str, Any],
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """Update shopping list item"""
        user = await get_user_from_token(credentials)
        household_id = user.get("active_household") if user else None
        
        result = await db.shopping_list.update_one(
            {"id": item_id},
            {"$set": updates}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Item not found")
        
        if household_id:
            updated_item = await db.shopping_list.find_one({"id": item_id}, {"_id": 0})
            if updated_item:
                await notify_shopping_change(household_id, "update", updated_item, user.get("name") if user else None)
        
        return {"message": "Updated successfully"}

    @shopping_router.get("/shopping", response_model=List[ShoppingItem])
    async def get_shopping_list(
        store_type: Optional[str] = None,
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """Get shopping list for user's active household"""
        user = await get_user_from_token(credentials)
        
        household_id = user.get("active_household")
        if not household_id:
            return []
        
        query = {"household_id": household_id}
        if store_type:
            query["store_type"] = store_type
        
        items = await db.shopping_list.find(query, {"_id": 0}).to_list(1000)
        
        for item in items:
            if isinstance(item.get('created_at'), str):
                item['created_at'] = datetime.fromisoformat(item['created_at'])
        
        return items

    @shopping_router.delete("/shopping/{item_id}")
    async def delete_shopping_item(
        item_id: str,
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """Delete shopping item"""
        item = await db.shopping_list.find_one({"id": item_id}, {"_id": 0})
        user = await get_user_from_token(credentials)
        
        result = await db.shopping_list.delete_one({"id": item_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Item not found")
        
        if item and item.get("household_id"):
            await notify_shopping_change(
                item["household_id"], 
                "delete", 
                {"id": item_id, "name_en": item.get("name_en")},
                user.get("name") if user else None
            )
        
        return {"message": "Deleted successfully"}

    @shopping_router.delete("/shopping")
    async def clear_shopping_list():
        """Clear entire shopping list"""
        await db.shopping_list.delete_many({})
        return {"message": "Shopping list cleared"}

    @shopping_router.put("/shopping/{item_id}/status")
    async def update_shopping_status(item_id: str, status_update: ShoppingStatusUpdate):
        """Update shopping item status for real-time sync"""
        item = await db.shopping_list.find_one({"id": item_id})
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
        
        valid_statuses = ["pending", "in_cart", "bought"]
        if status_update.status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
        
        update_data = {"shopping_status": status_update.status}
        
        if status_update.status == "in_cart":
            update_data["claimed_by"] = status_update.user_id
            update_data["claimed_by_name"] = status_update.user_name
        elif status_update.status == "bought":
            update_data["bought_at"] = datetime.now(timezone.utc)
        elif status_update.status == "pending":
            update_data["claimed_by"] = None
            update_data["claimed_by_name"] = None
            update_data["bought_at"] = None
        
        result = await db.shopping_list.update_one(
            {"id": item_id},
            {"$set": update_data}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Item not found")
        
        updated_item = await db.shopping_list.find_one({"id": item_id}, {"_id": 0})
        
        if item.get("household_id"):
            await notify_shopping_change(
                item["household_id"], 
                "status", 
                updated_item, 
                status_update.user_name
            )
        
        return updated_item

    @shopping_router.post("/shopping/{item_id}/claim")
    async def claim_shopping_item(item_id: str, user_id: str, user_name: str):
        """Claim an item (mark as 'I'm buying this')"""
        item = await db.shopping_list.find_one({"id": item_id})
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
        
        if item.get("shopping_status") == "in_cart" and item.get("claimed_by") != user_id:
            raise HTTPException(
                status_code=400, 
                detail=f"Already being bought by {item.get('claimed_by_name', 'someone')}"
            )
        
        await db.shopping_list.update_one(
            {"id": item_id},
            {"$set": {
                "shopping_status": "in_cart",
                "claimed_by": user_id,
                "claimed_by_name": user_name
            }}
        )
        
        updated_item = await db.shopping_list.find_one({"id": item_id}, {"_id": 0})
        
        if item.get("household_id"):
            await notify_shopping_change(item["household_id"], "status", updated_item, user_name)
        
        return {"message": f"{user_name} is buying this", "item": updated_item}

    @shopping_router.post("/shopping/{item_id}/unclaim")
    async def unclaim_shopping_item(item_id: str, user_id: str):
        """Release claim on an item"""
        item = await db.shopping_list.find_one({"id": item_id})
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
        
        if item.get("claimed_by") and item.get("claimed_by") != user_id:
            raise HTTPException(status_code=403, detail="You didn't claim this item")
        
        await db.shopping_list.update_one(
            {"id": item_id},
            {"$set": {
                "shopping_status": "pending",
                "claimed_by": None,
                "claimed_by_name": None
            }}
        )
        
        updated_item = await db.shopping_list.find_one({"id": item_id}, {"_id": 0})
        
        if item.get("household_id"):
            await notify_shopping_change(item["household_id"], "status", updated_item)
        
        return {"message": "Item released", "item": updated_item}

    @shopping_router.post("/shopping/{item_id}/mark-bought")
    async def mark_item_bought(item_id: str, user_id: str, user_name: str, move_to_inventory: bool = True):
        """Mark item as bought and optionally move to inventory"""
        item = await db.shopping_list.find_one({"id": item_id})
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
        
        await db.shopping_list.update_one(
            {"id": item_id},
            {"$set": {
                "shopping_status": "bought",
                "bought_at": datetime.now(timezone.utc),
                "claimed_by": user_id,
                "claimed_by_name": user_name
            }}
        )
        
        result = {"message": f"Marked as bought by {user_name}"}
        
        if move_to_inventory:
            existing = await db.inventory.find_one({
                "name_en": item["name_en"],
                "household_id": item.get("household_id")
            })
            
            if existing:
                await db.inventory.update_one(
                    {"id": existing["id"]},
                    {"$set": {"stock_level": "full", "last_updated_by": user_id}}
                )
                result["inventory_action"] = "updated_existing"
            else:
                new_item = {
                    "id": str(uuid.uuid4()),
                    "household_id": item.get("household_id"),
                    "name_en": item["name_en"],
                    "name_hi": item.get("name_hi"),
                    "name_mr": item.get("name_mr"),
                    "category": item.get("category", "other"),
                    "stock_level": "full",
                    "unit": "kg",
                    "last_updated_by": user_id,
                    "created_at": datetime.now(timezone.utc)
                }
                await db.inventory.insert_one(new_item)
                result["inventory_action"] = "created_new"
                
                if item.get("household_id"):
                    await notify_inventory_change(item["household_id"], "add", new_item, user_name)
            
            await db.shopping_list.delete_one({"id": item_id})
            result["removed_from_shopping"] = True
        
        if item.get("household_id"):
            await notify_shopping_change(item["household_id"], "status", {**item, "shopping_status": "bought"}, user_name)
        
        return result

    return shopping_router
