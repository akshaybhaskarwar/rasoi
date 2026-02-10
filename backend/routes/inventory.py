"""
Inventory routes for Rasoi-Sync
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone

from models.inventory import InventoryItem, InventoryItemCreate, DEFAULT_MONTHLY_QUANTITIES

security = HTTPBearer(auto_error=False)
inventory_router = APIRouter(prefix="/api", tags=["Inventory"])


def create_inventory_routes(db, decode_token, translate_service, notify_inventory_change):
    """Factory function to create inventory routes with database access"""
    
    async def get_user_from_token(credentials: HTTPAuthorizationCredentials):
        if not credentials:
            raise HTTPException(status_code=401, detail="Not authenticated")
        payload = decode_token(credentials.credentials)
        user_id = payload.get("sub")
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user

    @inventory_router.post("/inventory", response_model=InventoryItem)
    async def create_inventory_item(item: InventoryItemCreate, background_tasks: BackgroundTasks):
        """Create new inventory item with auto-translation"""
        item_dict = item.model_dump()
        inventory_item = InventoryItem(**item_dict)
        
        # Translate names
        if item.name_mr:
            inventory_item.name_mr = item.name_mr
        else:
            name_mr = await translate_service.translate_text_simple(item.name_en, "mr")
            inventory_item.name_mr = name_mr
        
        name_hi = await translate_service.translate_text_simple(item.name_en, "hi")
        inventory_item.name_hi = name_hi
        
        doc = inventory_item.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        
        await db.inventory.insert_one(doc)
        return inventory_item

    @inventory_router.get("/inventory/household")
    async def get_household_inventory(
        category: Optional[str] = None,
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """Get inventory items for the user's active household"""
        user = await get_user_from_token(credentials)
        
        household_id = user.get("active_household")
        if not household_id:
            raise HTTPException(status_code=400, detail="No active household")
        
        query = {"household_id": household_id}
        if category:
            query["category"] = category
        
        items = await db.inventory.find(query, {"_id": 0}).to_list(1000)
        
        for item in items:
            if isinstance(item.get('created_at'), str):
                item['created_at'] = datetime.fromisoformat(item['created_at'])
        
        return items

    @inventory_router.post("/inventory/household")
    async def create_household_inventory_item(
        item: InventoryItemCreate,
        background_tasks: BackgroundTasks,
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """Create inventory item for the user's active household"""
        user = await get_user_from_token(credentials)
        
        household_id = user.get("active_household")
        if not household_id:
            raise HTTPException(status_code=400, detail="No active household")
        
        item_dict = item.model_dump()
        inventory_item = InventoryItem(**item_dict)
        inventory_item.household_id = household_id
        
        if item.name_mr:
            inventory_item.name_mr = item.name_mr
        else:
            name_mr = await translate_service.translate_text_simple(item.name_en, "mr")
            inventory_item.name_mr = name_mr
        
        name_hi = await translate_service.translate_text_simple(item.name_en, "hi")
        inventory_item.name_hi = name_hi
        
        doc = inventory_item.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        doc['household_id'] = household_id
        
        await db.inventory.insert_one(doc)
        
        try:
            await notify_inventory_change(household_id, "add", doc, user.get("name", "Someone"))
        except Exception as e:
            print(f"SSE notification error: {e}")
        
        return inventory_item

    @inventory_router.get("/inventory", response_model=List[InventoryItem])
    async def get_inventory(category: Optional[str] = None):
        """Get all inventory items"""
        query = {"category": category} if category else {}
        items = await db.inventory.find(query, {"_id": 0}).to_list(1000)
        
        for item in items:
            if isinstance(item.get('created_at'), str):
                item['created_at'] = datetime.fromisoformat(item['created_at'])
        
        return items

    @inventory_router.put("/inventory/{item_id}")
    async def update_inventory_item(item_id: str, updates: Dict[str, Any]):
        """Update inventory item"""
        result = await db.inventory.update_one(
            {"id": item_id},
            {"$set": updates}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Item not found")
        
        return {"message": "Updated successfully"}

    @inventory_router.delete("/inventory/{item_id}")
    async def delete_inventory_item(item_id: str):
        """Delete inventory item"""
        result = await db.inventory.delete_one({"id": item_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Item not found")
        
        return {"message": "Deleted successfully"}

    @inventory_router.get("/inventory/monthly-defaults")
    async def get_monthly_quantity_defaults():
        """Get default monthly quantities for all categories"""
        return DEFAULT_MONTHLY_QUANTITIES

    @inventory_router.put("/inventory/{item_id}/monthly-quantity")
    async def update_monthly_quantity(item_id: str, quantity: int, unit: str):
        """Update monthly quantity for an inventory item"""
        result = await db.inventory.update_one(
            {"id": item_id},
            {"$set": {"monthly_quantity": quantity, "monthly_unit": unit}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Item not found")
        
        return {"message": "Monthly quantity updated", "quantity": quantity, "unit": unit}

    @inventory_router.get("/inventory/reservations")
    async def get_inventory_with_reservations():
        """Get inventory items with their reservations"""
        items = await db.inventory.find({}, {"_id": 0}).to_list(500)
        
        for item in items:
            reservations = item.get('reserved_for', [])
            if reservations:
                total_reserved = sum(r.get('qty', 0) for r in reservations)
                item['total_reserved'] = total_reserved
                item['has_reservations'] = True
                upcoming = sorted(reservations, key=lambda x: x.get('date', ''))
                if upcoming:
                    item['next_reservation'] = upcoming[0]
            else:
                item['total_reserved'] = 0
                item['has_reservations'] = False
                item['next_reservation'] = None
        
        return items

    return inventory_router
