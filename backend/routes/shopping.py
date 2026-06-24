"""
Shopping list routes for Rasoi-Sync
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta, date
import uuid

from models.shopping import (
    ShoppingItem, ShoppingItemCreate, ShoppingStatusUpdate, ShoppingSnoozeRequest,
)

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
        # Manual POST endpoint always tags the row as user-typed.
        # Server-side auto-add callers write directly to the collection
        # and set their own source — they never come through here.
        item_dict["source"] = "manual"
        item_dict["source_ref"] = None
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

    @shopping_router.put("/shopping/{item_id}/snooze")
    async def snooze_shopping_item(
        item_id: str,
        body: ShoppingSnoozeRequest,
        credentials: HTTPAuthorizationCredentials = Depends(security),
    ):
        """Skip-this-trip delete intent.

        Sets a `auto_suggest_snoozed_until` date `body.days` ahead on
        the inventory item that originally triggered this auto-suggest,
        then removes the shopping row. The next inventory-low scan will
        respect the snooze window and not re-add the row.

        The snooze is keyed on case-insensitive name_en within the
        household, so even if the source inventory id can't be matched
        (legacy rows without a strong link), a same-name re-add is
        still blocked. Both inventory.auto_suggest_snoozed_until AND a
        household-scoped "suppression" doc are written for that
        belt-and-braces reason.
        """
        item = await db.shopping_list.find_one({"id": item_id}, {"_id": 0})
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")

        user = await get_user_from_token(credentials)
        household_id = item.get("household_id") or user.get("active_household")

        days = max(1, min(int(body.days or 7), 90))
        snooze_until = (datetime.now(timezone.utc).date() + timedelta(days=days)).isoformat()

        # 1) Update the linked inventory row if we can find one.
        name_en = (item.get("name_en") or "").strip()
        if household_id and name_en:
            await db.inventory.update_one(
                {
                    "household_id": household_id,
                    "name_en": {"$regex": f"^{name_en}$", "$options": "i"},
                },
                {"$set": {"auto_suggest_snoozed_until": snooze_until}},
            )

            # 2) Belt-and-braces suppression doc. Upsert keyed on the
            # canonical name; the auto-add job consults this collection
            # to suppress re-adds even when the inventory row doesn't
            # exist (e.g. recipe-sourced items).
            await db.shopping_suppressions.update_one(
                {"household_id": household_id, "name_en_lower": name_en.lower()},
                {"$set": {
                    "household_id": household_id,
                    "name_en_lower": name_en.lower(),
                    "name_en": name_en,
                    "snoozed_until": snooze_until,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }},
                upsert=True,
            )

        # 3) Remove the shopping row.
        await db.shopping_list.delete_one({"id": item_id})

        if household_id:
            await notify_shopping_change(
                household_id,
                "delete",
                {"id": item_id, "name_en": item.get("name_en")},
                user.get("name") if user else None,
            )

        return {
            "message": "Snoozed",
            "snoozed_until": snooze_until,
            "name_en": item.get("name_en"),
        }

    @shopping_router.post("/shopping/{item_id}/already-have-it")
    async def already_have_shopping_item(
        item_id: str,
        credentials: HTTPAuthorizationCredentials = Depends(security),
    ):
        """Already-have-it delete intent.

        Atomically: (1) flip the matching inventory item's stock_level
        from `empty`/`low` to `full` so the auto-suggest job won't
        re-add it next pass, and (2) remove the shopping row. Used by
        the delete-intent sheet when the user says they already have
        the item at home.

        If no matching inventory row exists (orphan shopping entry),
        the inventory step is silently skipped and only the shopping
        row is removed — the user's intent (don't keep nagging me) is
        still honored.
        """
        item = await db.shopping_list.find_one({"id": item_id}, {"_id": 0})
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")

        user = await get_user_from_token(credentials)
        household_id = item.get("household_id") or user.get("active_household")

        inventory_action = "none"
        name_en = (item.get("name_en") or "").strip()
        if household_id and name_en:
            inv = await db.inventory.find_one(
                {
                    "household_id": household_id,
                    "name_en": {"$regex": f"^{name_en}$", "$options": "i"},
                },
                {"_id": 0},
            )
            if inv:
                await db.inventory.update_one(
                    {"id": inv["id"]},
                    {"$set": {
                        "stock_level": "full",
                        "last_updated_by": user.get("id") if user else None,
                        # Clear any prior snooze — the user explicitly
                        # said they have it now.
                        "auto_suggest_snoozed_until": None,
                    }},
                )
                inventory_action = "updated_existing"
                if user:
                    try:
                        await notify_inventory_change(
                            household_id, "update", {**inv, "stock_level": "full"}, user.get("name"),
                        )
                    except Exception:
                        # Inventory broadcast is best-effort; don't fail
                        # the shopping-side action if a listener errors.
                        pass

        await db.shopping_list.delete_one({"id": item_id})

        if household_id:
            await notify_shopping_change(
                household_id,
                "delete",
                {"id": item_id, "name_en": item.get("name_en")},
                user.get("name") if user else None,
            )

        return {
            "message": "Marked as stocked",
            "inventory_action": inventory_action,
            "name_en": item.get("name_en"),
        }

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
