"""
Shopping list routes for Rasoi-Sync
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta, date
import uuid

from pydantic import BaseModel

from models.shopping import (
    ShoppingItem, ShoppingItemCreate, ShoppingStatusUpdate, ShoppingSnoozeRequest,
)
from models.prices import PriceRecord, normalise_unit


class ManualPriceEntry(BaseModel):
    """Body for POST /shopping/price — the user typing what they paid.

    Keyed on `canonical_name`, NOT on a shopping list item id. Marking an item
    purchased deletes its shopping row (it moves into inventory), so anything
    scoped to that row would 404 by the time the user finishes typing a price.
    A price belongs to the item, not to the list entry that prompted it.

    Two shapes are accepted, because both are natural at the till:
      - amount + qty  -> rate is derived (paid ₹284 for 2 kg -> ₹142/kg)
      - rate only     -> taken as-is (the shelf label said ₹142/kg)
    `unit` is the receipt-style code ('K', 'L', 'UT', 'g', ...) and decides
    whether this is stored as ₹/kg, ₹/L or ₹/pack.
    """
    canonical_name: str
    amount: Optional[float] = None
    qty: Optional[float] = None
    rate: Optional[float] = None
    unit: str = "UT"
    vendor: Optional[str] = None
    store_type: Optional[str] = None

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
        # Tag how the row landed on the list. Defaults to "manual" (a
        # user typing/scanning an item), but the inventory low-stock
        # sync posts source="auto" so those rows route to the delete-
        # intent sheet instead of hard-deleting — otherwise deleting a
        # low-stock staple just re-offers it under the "Update N"
        # button on the next render. Whitelisted so a client can't
        # invent a source the delete UX doesn't understand.
        requested_source = (item_dict.get("source") or "manual").lower()
        item_dict["source"] = requested_source if requested_source in ("manual", "auto", "recipe") else "manual"
        if item_dict["source"] == "manual":
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
        
        # NOT persisted: stock_level is derived from inventory and served live
        # by GET /shopping. Storing it here is what produced rows that showed
        # "Empty" long after the item was restocked. The field stays on the
        # model because the response carries it — it is just never written.
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

        # `stock_level` is DERIVED from inventory, not owned by the shopping
        # row. It used to be stamped in at row-creation time and never touched
        # again, so a row created while an item was empty kept showing "Empty"
        # forever — including after a receipt scan restocked it. The shopping
        # list said Sabudana was empty while inventory said 2 kg / full.
        #
        # Reading it live here makes the two screens agree by construction
        # instead of by remembering to write back from every inventory path.
        inventory = await db.inventory.find(
            {"household_id": household_id},
            {"_id": 0, "name_en": 1, "stock_level": 1, "current_stock": 1, "aliases": 1},
        ).to_list(1000)

        stock_by_name = {}
        for inv in inventory:
            level = inv.get("stock_level")
            if not level:
                continue
            name = (inv.get("name_en") or "").strip().lower()
            if name:
                stock_by_name[name] = level
            # Aliases let "Besan" on the shopping list find "Gram Flour" in
            # inventory. Never overwrite a direct name match.
            for alias in (inv.get("aliases") or []):
                key = (alias or "").strip().lower()
                if key:
                    stock_by_name.setdefault(key, level)

        for item in items:
            if isinstance(item.get('created_at'), str):
                item['created_at'] = datetime.fromisoformat(item['created_at'])
            key = (item.get("name_en") or "").strip().lower()
            # Absent from inventory means the household genuinely has none of
            # it, which is what an empty shopping row is for.
            item["stock_level"] = stock_by_name.get(key)

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

    # ---- Price comparison ------------------------------------------------

    @shopping_router.get("/shopping/last-prices")
    async def get_last_prices(
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """Latest recorded price per item for the household.

        Returns one map for the whole list rather than a lookup per row — a
        shopping list of 30 items would otherwise be 30 requests.

        The client is given `bought_on` alongside the rate and decides how to
        present staleness. A rate from last year is worse than showing nothing,
        but where that line sits is a product judgement, so the API does not
        silently hide old data.
        """
        user = await get_user_from_token(credentials)
        household_id = user.get("active_household")
        if not household_id:
            return {"prices": {}}

        # Sorted oldest-first so the last write into the dict per item wins,
        # which leaves the most recent purchase. Cheaper than an aggregation
        # for the volumes involved (a household accumulates a few hundred rows
        # a year) and avoids depending on $group ordering semantics.
        cursor = db.price_history.find(
            {"household_id": household_id},
            {"_id": 0, "canonical_name": 1, "rate": 1, "unit_basis": 1,
             "vendor": 1, "bought_on": 1, "source": 1},
        ).sort("bought_on", 1)

        prices: Dict[str, Any] = {}
        async for row in cursor:
            name = row.get("canonical_name")
            if not name:
                continue
            prices[name.lower()] = {
                "rate": row.get("rate"),
                "unit_basis": row.get("unit_basis"),
                "vendor": row.get("vendor"),
                "bought_on": row.get("bought_on"),
                "source": row.get("source"),
            }
        return {"prices": prices, "count": len(prices)}

    @shopping_router.post("/shopping/price")
    async def record_manual_price(
        entry: ManualPriceEntry,
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """Record what the user says they paid for an item.

        This is the path for households that do not scan receipts. It writes
        the same price_history shape as the receipt path, tagged
        source='manual', so the shopping list reads both identically.
        """
        user = await get_user_from_token(credentials)
        household_id = user.get("active_household")
        if not household_id:
            raise HTTPException(status_code=400, detail="No active household")

        name = (entry.canonical_name or "").strip()
        if not name:
            raise HTTPException(status_code=400, detail="canonical_name is required")

        rate = entry.rate
        if rate is None:
            if entry.amount is None or not entry.qty:
                raise HTTPException(
                    status_code=400,
                    detail="Provide either rate, or amount together with qty",
                )
            try:
                rate = float(entry.amount) / float(entry.qty)
            except (TypeError, ValueError, ZeroDivisionError):
                raise HTTPException(status_code=400, detail="Could not derive a rate")

        try:
            rate = float(rate)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="Rate is not a number")
        if rate <= 0:
            raise HTTPException(status_code=400, detail="Rate must be positive")

        basis, multiplier = normalise_unit(entry.unit)
        record = PriceRecord(
            household_id=household_id,
            canonical_name=name,
            rate=round(rate * multiplier, 2),
            unit_basis=basis,
            qty=entry.qty,
            unit_raw=entry.unit,
            amount=entry.amount,
            vendor=entry.vendor or None,
            store_type=entry.store_type,
            source="manual",
        )
        await db.price_history.insert_one(record.model_dump())
        return {
            "success": True,
            "canonical_name": record.canonical_name,
            "rate": record.rate,
            "unit_basis": record.unit_basis,
        }

    return shopping_router
