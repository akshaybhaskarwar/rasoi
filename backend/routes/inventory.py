"""
Inventory routes for Rasoi-Sync
"""
import base64
import logging
import uuid
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta

from models.inventory import (
    InventoryItem, InventoryItemCreate, DEFAULT_MONTHLY_QUANTITIES,
    compute_stock_level, default_monthly_base_units,
)
from models.prices import price_from_receipt_row

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)
inventory_router = APIRouter(prefix="/api", tags=["Inventory"])


# Cap uploaded receipt images at 10 MB to keep latency / memory bounded.
_MAX_RECEIPT_IMAGE_BYTES = 10 * 1024 * 1024


class ReceiptUploadRequest(BaseModel):
    """Request body for POST /inventory/from-receipt."""
    image_base64: str


class BulkUpdateItem(BaseModel):
    """One row in the confirm-screen submission.

    The user may have edited `name_canonical_en` (picked a different catalog
    entry) or `qty` since the receipt was first parsed.

    When is_custom=True, the row represents an item the user is adding that
    is NOT in PANTRY_TEMPLATE. The catalog lookup is skipped and the
    inventory entry is created directly from the row's name/category/unit
    fields. The row is also logged to `catalog_suggestions` so an admin
    can promote popular custom items into the canonical catalog later.
    """
    name_canonical_en: Optional[str] = None
    qty: float = 1.0
    unit: str = "UT"
    action: str = "add"  # "add" or "skip"
    is_custom: bool = False
    custom_name: Optional[str] = None      # required when is_custom=True
    custom_category: Optional[str] = None  # falls back to "other"
    devanagari_hint: Optional[str] = None  # receipt's printed name, for catalog_suggestions
    # Per-line price, forwarded straight through from the receipt scan. The
    # confirm screen already has both (it renders `amount` per row) and simply
    # wasn't sending them. Passing them here rather than re-reading the receipt
    # audit doc avoids having to guess which parsed row a confirmed row came
    # from after the user has re-mapped names or edited quantities.
    # Optional: manually-added rows and older clients just omit them.
    rate: Optional[float] = None
    amount: Optional[float] = None
    # When the user adds a row "as new" but Claude+catalog had already
    # resolved it to a canonical English name (e.g., brand-name Devanagari
    # -> "Groundnut Oil"), the frontend preserves that resolution here and
    # the backend stores it as an alias on the inventory item so an English
    # search later finds the Devanagari-named row.
    original_canonical_en: Optional[str] = None


class BulkUpdateRequest(BaseModel):
    """Request body for POST /inventory/bulk-update."""
    receipt_id: Optional[str] = None
    items: List[BulkUpdateItem]
    # Phase A integration: when the receipt-scan confirm screen matched
    # one or more shopping list items to receipt rows (and the user did
    # not opt out via the per-row "don't check off" toggle), this is the
    # list of shopping list item ids to mark as 'bought' alongside the
    # inventory write. Optional — receipt scans from a user with no
    # shopping list or no matches just don't send this.
    shopping_item_ids_to_mark: List[str] = []


def _qty_to_base_units(qty: float, unit: str) -> int:
    """Convert a receipt qty into the base unit used by InventoryItem.current_stock.

    - K/kg  -> grams (qty * 1000)
    - G/g   -> grams (qty)
    - L/l   -> milliliters (qty * 1000)
    - ML/ml -> milliliters (qty)
    - UT, pcs, anything else -> raw count (qty)
    """
    u = (unit or "").strip().lower()
    q = float(qty or 0)
    if u in ("k", "kg"):
        return int(q * 1000)
    if u in ("g", "gram", "grams"):
        return int(q)
    if u in ("l", "lt", "litre", "litres", "liter", "liters"):
        return int(q * 1000)
    if u in ("ml", "milliliter", "milliliters"):
        return int(q)
    # UT/pcs/unknown — treat as count
    return max(int(q), 1)


def _collect_price(sink: List[Dict[str, Any]], canonical_name: str, row,
                   household_id: str, receipt_id: Optional[str]) -> None:
    """Queue a price_history row for a confirmed receipt line, if it has a price.

    `require_confidence=False` on purpose: the user has just seen this item and
    its amount on the confirm screen and accepted it, which is a stronger
    signal than the model's own match confidence. The arithmetic and null
    checks in price_from_receipt_row still apply.

    Never raises — a receipt with unreadable prices must still update inventory.
    """
    if row.rate is None and row.amount is None:
        return
    try:
        record, _ = price_from_receipt_row(
            {
                "name_canonical_en": canonical_name,
                "qty": row.qty,
                "unit": row.unit,
                "rate": row.rate,
                "amount": row.amount,
            },
            household_id=household_id,
            receipt_id=receipt_id,
            require_confidence=False,
        )
        if record:
            sink.append(record.model_dump())
    except Exception:
        logger.exception("Failed to build price record for %s", canonical_name)


def create_inventory_routes(db, decode_token, translate_service, notify_inventory_change,
                            receipt_service=None):
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
        item_dict = item.model_dump(exclude_none=True)
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

        item_dict = item.model_dump(exclude_none=True)
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
    async def update_inventory_item(
        item_id: str,
        updates: Dict[str, Any],
        credentials: HTTPAuthorizationCredentials = Depends(security),
    ):
        """Update inventory item.

        Scoped to the caller's active household: previously this endpoint took
        no credentials at all, so anyone holding an item id could modify any
        kitchen's inventory.

        `stock_level` is always recomputed here and any client-supplied value
        is discarded. It is derived from current_stock vs monthly_quantity, and
        letting callers set it independently is what allowed the two to drift —
        an item at 3g of a 200g need carrying a stored "full" is invisible to
        the shopping list. Recomputing server-side means no caller can create
        an inconsistent row, including the ones that forget (setMonthlyQuantity
        changes the denominator without touching the level).
        """
        user = await get_user_from_token(credentials)
        household_id = user.get("active_household")
        if not household_id:
            raise HTTPException(status_code=400, detail="No active household")

        existing = await db.inventory.find_one(
            {"id": item_id, "household_id": household_id}, {"_id": 0}
        )
        if not existing:
            raise HTTPException(status_code=404, detail="Item not found")

        updates = dict(updates or {})
        updates.pop("stock_level", None)
        # Never let a client move a row between households.
        updates.pop("household_id", None)
        updates.pop("id", None)

        stock = updates.get("current_stock", existing.get("current_stock"))
        monthly = updates.get("monthly_quantity", existing.get("monthly_quantity"))
        if not monthly:
            monthly = default_monthly_base_units(
                updates.get("category", existing.get("category"))
            )
        updates["stock_level"] = compute_stock_level(stock, monthly)
        updates["last_updated_by"] = user.get("id")

        await db.inventory.update_one({"id": item_id}, {"$set": updates})
        # Not keyed on modified_count: writing identical values is a no-op in
        # Mongo, and a no-op update is a success, not a missing item.
        return {"message": "Updated successfully", "stock_level": updates["stock_level"]}

    @inventory_router.delete("/inventory/{item_id}")
    async def delete_inventory_item(
        item_id: str,
        credentials: HTTPAuthorizationCredentials = Depends(security),
    ):
        """Delete inventory item, scoped to the caller's active household."""
        user = await get_user_from_token(credentials)
        household_id = user.get("active_household")
        if not household_id:
            raise HTTPException(status_code=400, detail="No active household")

        result = await db.inventory.delete_one(
            {"id": item_id, "household_id": household_id}
        )
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

    # ========================================================================
    # Receipt -> Inventory (Phase 1 of docs/PRDs/01-receipt-to-inventory.md)
    # ========================================================================

    @inventory_router.post("/inventory/bulk-update")
    async def bulk_update_from_receipt(
        request: BulkUpdateRequest,
        credentials: HTTPAuthorizationCredentials = Depends(security),
    ):
        """Apply the user's confirmed rows from a receipt to the inventory.

        For each item with action='add':
          - Look up existing inventory item by canonical en name + household
          - If found: bump stock_level='full' and increment current_stock by qty
          - If not found: create a new inventory item from the catalog entry,
            then apply the same update

        Skipped rows are recorded in the receipt audit log but do not touch
        inventory.
        """
        from data.pantry_items import get_item_details  # local import — avoids hot-path cost

        user = await get_user_from_token(credentials)
        household_id = user.get("active_household")
        if not household_id:
            raise HTTPException(status_code=400, detail="No active household")

        added: List[Dict[str, Any]] = []
        skipped: List[str] = []
        errors: List[Dict[str, Any]] = []
        # Price rows are collected here and written once at the end, so a
        # problem with price capture can never fail the inventory update the
        # user actually asked for.
        price_rows: List[Dict[str, Any]] = []

        import re
        import unicodedata  # local — only used here, avoids hot-path cost

        async def find_existing_inventory(
            *,
            name_en_canonical: Optional[str] = None,
            name_mr_canonical: Optional[str] = None,
            devanagari_hint: Optional[str] = None,
        ) -> Optional[Dict[str, Any]]:
            """Best-effort merge: find any existing inventory row in this
            household that's "the same item" as what the receipt is bringing
            in. Tries multiple keys in priority order so subtle drift (case,
            whitespace, Devanagari vs English storage) doesn't create
            duplicates.

            Order:
              1. Exact canonical English (existing behavior)
              2. Case-insensitive English
              3. Catalog's Marathi (covers items stored with mr-first)
              4. Receipt's Devanagari hint (covers items previously added
                 from the same brand-name receipt as is_custom — so a brand
                 like "जैमिनी शेंगदाणा तेल" merges with itself)
            """
            seen_keys = []
            def push(key):
                # de-dupe — Mongo doesn't care but the seen check keeps us cheap
                k = repr(key)
                if k in seen_keys:
                    return None
                seen_keys.append(k)
                return key

            queries = []
            if name_en_canonical:
                q = push({"name_en": name_en_canonical})
                if q: queries.append(q)
                pattern = re.compile(f"^{re.escape(name_en_canonical.strip())}$", re.IGNORECASE)
                q = push({"name_en": pattern})
                if q: queries.append(q)
            if name_mr_canonical:
                q = push({"name_mr": name_mr_canonical})
                if q: queries.append(q)
            if devanagari_hint:
                q = push({"name_mr": devanagari_hint})
                if q: queries.append(q)
                # Some users may have items where the brand-name Devanagari
                # ended up in name_en (e.g., earlier custom-add flows). Try
                # that too so we update instead of duplicate.
                q = push({"name_en": devanagari_hint})
                if q: queries.append(q)

            for q in queries:
                q["household_id"] = household_id
                doc = await db.inventory.find_one(q)
                if doc is not None:
                    return doc
            return None

        for row in request.items:
            if row.action == "skip":
                skipped.append(row.name_canonical_en or "(unmatched)")
                continue

            # ---- Custom item path (NOT in PANTRY_TEMPLATE) ----------------
            if row.is_custom:
                name = (row.custom_name or "").strip()
                if not name:
                    errors.append({"row": row.model_dump(),
                                   "error": "custom item missing name"})
                    continue

                category = (row.custom_category or "other").strip().lower()
                # Pick a sensible inventory unit from the receipt's unit code
                inv_unit = "pcs"
                u = (row.unit or "").strip().lower()
                if u in ("k", "kg"):
                    inv_unit = "kg"
                elif u in ("g", "gram", "grams"):
                    inv_unit = "g"
                elif u in ("l", "lt", "litre", "liter", "litres", "liters"):
                    inv_unit = "L"
                elif u in ("ml", "milliliter", "milliliters"):
                    inv_unit = "ml"

                # Find or create — try multiple match keys so a re-scan of
                # the same brand-name receipt finds the previously-added
                # custom item, even if its stored name differs slightly.
                inv_doc = await find_existing_inventory(
                    name_en_canonical=name,
                    devanagari_hint=row.devanagari_hint,
                )

                # Aliases that should appear on the row so English-text
                # search later finds it. Always at least include Claude's
                # original canonical English when available.
                desired_aliases = []
                if row.original_canonical_en:
                    desired_aliases.append(row.original_canonical_en.strip())
                # Receipt's Devanagari hint as a second alias when the row's
                # name_en is English (i.e., user typed an English name but
                # we still want Marathi search to find it).
                if row.devanagari_hint and row.devanagari_hint not in desired_aliases:
                    desired_aliases.append(row.devanagari_hint)

                if inv_doc is None:
                    new_item = InventoryItem(
                        household_id=household_id,
                        name_en=name,
                        name_mr=row.devanagari_hint or None,
                        name_hi=None,
                        category=category,
                        stock_level="empty",
                        current_stock=0,
                        unit=inv_unit,
                        aliases=desired_aliases,
                        is_custom=True,
                    )
                    inv_doc = new_item.model_dump()
                    inv_doc["created_at"] = inv_doc["created_at"].isoformat()
                    await db.inventory.insert_one(inv_doc)

                delta = _qty_to_base_units(row.qty, row.unit)
                new_current = (inv_doc.get("current_stock") or 0) + delta
                # Backfill aliases on existing rows so previously-saved
                # Devanagari-named items pick up English-search support
                # automatically next time the same brand-name receipt is
                # processed.
                merged_aliases = list(inv_doc.get("aliases") or [])
                for a in desired_aliases:
                    if a and a not in merged_aliases:
                        merged_aliases.append(a)

                await db.inventory.update_one(
                    {"id": inv_doc["id"]},
                    {"$set": {
                        # Derived, not hardcoded "full". Adding 3g of a 200g
                        # monthly need does not make an item full, and a
                        # wrongly-full row is invisible to the shopping list.
                        "stock_level": compute_stock_level(
                            new_current, inv_doc.get("monthly_quantity")
                        ),
                        "current_stock": new_current,
                        "last_updated_by": user.get("id"),
                        "aliases": merged_aliases,
                        # Lets the month-end reset skip a late-month shop.
                        "last_purchased_at": datetime.now(timezone.utc).isoformat(),
                    }},
                )
                added.append({
                    "id": inv_doc["id"],
                    "name_en": name,
                    "qty": row.qty,
                    "unit": row.unit,
                    "delta_base_units": delta,
                    "new_current_stock": new_current,
                    "is_custom": True,
                })
                _collect_price(price_rows, name, row, household_id, request.receipt_id)

                # Silently log to catalog_suggestions so admins can promote
                # repeatedly-suggested items into PANTRY_TEMPLATE later.
                # Keyed by NFC-normalized Devanagari text so cross-household
                # variants collapse onto the same suggestion document.
                try:
                    dev = row.devanagari_hint or name
                    dev_key = unicodedata.normalize("NFC", dev).strip().lower()
                    if dev_key:
                        await db.catalog_suggestions.update_one(
                            {"devanagari_key": dev_key},
                            {
                                "$setOnInsert": {
                                    "devanagari_key": dev_key,
                                    "devanagari_text": dev,
                                    "first_suggested_at": datetime.now(timezone.utc),
                                },
                                "$set": {
                                    "last_suggested_at": datetime.now(timezone.utc),
                                    "last_user_provided_name": name,
                                    "last_category_hint": category,
                                },
                                "$inc": {"vote_count": 1},
                                "$addToSet": {"household_ids": household_id},
                            },
                            upsert=True,
                        )
                except Exception:
                    logger.exception("Failed to log catalog_suggestion")

                continue

            # ---- Canonical (in-catalog) item path -------------------------
            canonical = row.name_canonical_en
            if not canonical:
                errors.append({"row": row.model_dump(), "error": "no canonical name"})
                continue

            details = get_item_details(canonical)
            if not details:
                errors.append({"row": row.model_dump(),
                               "error": f"'{canonical}' not in catalog"})
                continue

            # Find or create — try canonical en first, then case-insensitive,
            # then catalog mr/hi, then the receipt's Devanagari hint. This
            # makes the canonical path also find existing custom items that
            # may have been stored with a brand-name Devanagari name_en
            # (e.g., जैमिनी रिफाईंड शेंगदाणा तेल) — without this, a brand-name
            # receipt creates a fresh custom item AND a fresh canonical item
            # each scan, splitting one real product across multiple rows.
            inv_doc = await find_existing_inventory(
                name_en_canonical=details["name_en"],
                name_mr_canonical=details.get("name_mr"),
                devanagari_hint=row.devanagari_hint,
            )
            if inv_doc is None:
                new_item = InventoryItem(
                    household_id=household_id,
                    name_en=details["name_en"],
                    name_mr=details.get("name_mr") or None,
                    name_hi=details.get("name_hi") or None,
                    category=details["category"],
                    stock_level="empty",
                    current_stock=0,
                    unit=details.get("unit", "kg"),
                    aliases=details.get("aliases") or [],
                )
                inv_doc = new_item.model_dump()
                inv_doc["created_at"] = inv_doc["created_at"].isoformat()
                await db.inventory.insert_one(inv_doc)

            # Backfill aliases on the row so a brand-name Devanagari (which
            # the merge logic now finds as an existing row) becomes a
            # searchable alias on the canonical English row. After enough
            # scans, the inventory item picks up every brand variant of the
            # same product as an alias automatically.
            merged_aliases = list(inv_doc.get("aliases") or [])
            for a in (details.get("aliases") or []):
                if a and a not in merged_aliases:
                    merged_aliases.append(a)
            if row.devanagari_hint and row.devanagari_hint not in merged_aliases:
                merged_aliases.append(row.devanagari_hint)

            # Increment and bump stock_level
            delta = _qty_to_base_units(row.qty, row.unit)
            new_current = (inv_doc.get("current_stock") or 0) + delta
            await db.inventory.update_one(
                {"id": inv_doc["id"]},
                {"$set": {
                    # See the custom-item branch above: derived, never "full".
                    "stock_level": compute_stock_level(
                        new_current, inv_doc.get("monthly_quantity")
                    ),
                    "current_stock": new_current,
                    "last_updated_by": user.get("id"),
                    "aliases": merged_aliases,
                    # Lets the month-end reset skip a late-month shop.
                    "last_purchased_at": datetime.now(timezone.utc).isoformat(),
                }},
            )
            added.append({
                "id": inv_doc["id"],
                "name_en": details["name_en"],
                "qty": row.qty,
                "unit": row.unit,
                "delta_base_units": delta,
                "new_current_stock": new_current,
            })
            _collect_price(price_rows, details["name_en"], row, household_id, request.receipt_id)

        # ---- Persist prices ------------------------------------------------
        # Written after the inventory work so a failure here cannot lose the
        # user's confirmed stock update. The vendor lives on the receipt audit
        # doc rather than on each row, so stamp it on in one pass.
        if price_rows:
            try:
                vendor = None
                store_type = None
                if request.receipt_id:
                    receipt_doc = await db.receipts.find_one(
                        {"id": request.receipt_id, "household_id": household_id},
                        {"_id": 0, "vendor": 1},
                    )
                    vendor = (receipt_doc or {}).get("vendor")
                for pr in price_rows:
                    pr["vendor"] = vendor
                    pr["store_type"] = store_type
                await db.price_history.insert_many(price_rows)
            except Exception:
                logger.exception("Failed to write price history for receipt %s",
                                 request.receipt_id)

        # Update receipt audit log with what the user actually confirmed
        if request.receipt_id:
            try:
                await db.receipts.update_one(
                    {"id": request.receipt_id, "household_id": household_id},
                    {"$set": {
                        "user_corrections": {
                            "added": added,
                            "skipped": skipped,
                            "errors": errors,
                        },
                        "confirmed_at": datetime.now(timezone.utc),
                    }},
                )
            except Exception:
                logger.exception("Failed to update receipt audit log")

        # SSE: notify household
        try:
            await notify_inventory_change(
                household_id, "bulk_add_receipt",
                {"count": len(added), "skipped": len(skipped)},
                user.get("name", "Someone"),
            )
        except Exception:
            pass

        # ---- Phase A: cross off matched shopping list items ----------------
        # The frontend computed the matches and (if the user didn't toggle
        # off any rows) sent us the shopping list item ids to mark bought.
        # We re-scope the update to the user's active household so a stale
        # or maliciously-crafted id can't touch another kitchen's list.
        shopping_marked = 0
        if request.shopping_item_ids_to_mark:
            try:
                result = await db.shopping_list.update_many(
                    {
                        "id": {"$in": request.shopping_item_ids_to_mark},
                        "household_id": household_id,
                        # Only mark items currently pending or in-cart — never
                        # re-mark something the user already finished, and
                        # never touch an item from another household.
                        "shopping_status": {"$ne": "bought"},
                    },
                    {"$set": {
                        "shopping_status": "bought",
                        "bought_at": datetime.now(timezone.utc),
                        "claimed_by": None,
                        "claimed_by_name": None,
                    }},
                )
                shopping_marked = result.modified_count
            except Exception:
                logger.exception("Failed to mark shopping items as bought")

        return {
            "added_count": len(added),
            "skipped_count": len(skipped),
            "error_count": len(errors),
            "shopping_items_marked": shopping_marked,
            "added": added,
            "skipped": skipped,
            "errors": errors,
        }

    @inventory_router.post("/inventory/from-receipt")
    async def from_receipt(
        request: ReceiptUploadRequest,
        credentials: HTTPAuthorizationCredentials = Depends(security),
    ):
        """Run a receipt image through the OCR + catalog-matching pipeline.

        Returns structured items the user reviews on the confirm screen. Does
        NOT modify inventory — the actual inventory write happens via the
        separate /inventory/bulk-update endpoint after user confirmation.
        """
        if receipt_service is None:
            raise HTTPException(
                status_code=503,
                detail="Receipt ingestion is not configured on this server.",
            )

        user = await get_user_from_token(credentials)
        household_id = user.get("active_household")
        if not household_id:
            raise HTTPException(status_code=400, detail="No active household")

        # Decode
        try:
            image_bytes = base64.b64decode(request.image_base64, validate=True)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid base64 image")
        if not image_bytes:
            raise HTTPException(status_code=400, detail="Empty image payload")
        if len(image_bytes) > _MAX_RECEIPT_IMAGE_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"Image too large; max {_MAX_RECEIPT_IMAGE_BYTES // (1024*1024)} MB",
            )

        # Run the pipeline
        try:
            parsed = await receipt_service.process_receipt(image_bytes)
        except Exception as e:
            # ReceiptIngestionError is the expected failure mode; anything else
            # is a real bug. Either way we want a clean 502 with the message.
            logger.exception("Receipt processing failed")
            raise HTTPException(status_code=502, detail=f"Could not read receipt: {e}")

        # Persist audit log (30-day TTL set on the receipts collection at startup)
        receipt_id = str(uuid.uuid4())
        raw_ocr_text = parsed.pop("_raw_ocr_text", "")
        audit_doc = {
            "id": receipt_id,
            "household_id": household_id,
            "user_id": user.get("id"),
            "raw_ocr_text": raw_ocr_text,
            "parsed_items": parsed.get("items", []),
            "vendor": parsed.get("vendor"),
            "total_extracted": parsed.get("total"),
            "user_corrections": None,  # populated when bulk-update is called
            "created_at": datetime.now(timezone.utc),
        }
        try:
            await db.receipts.insert_one(audit_doc)
        except Exception:
            logger.exception("Failed to persist receipt audit log; continuing")

        return {
            "receipt_id": receipt_id,
            "vendor": parsed.get("vendor"),
            "total_extracted": parsed.get("total"),
            "items": parsed.get("items", []),
        }

    # ---- Restock planner (month-end reset) -----------------------------
    # "Plan restock" empties the selected staples in one action so they
    # flow onto the shopping list, instead of the user editing 30+ rows by
    # hand. The preview classifies every non-secret item — the planner
    # sheet groups them by frequency and lets the user tick/untick — and
    # the reset takes the ticked ids. Pre-ticks are conservative: only
    # monthly items with no skip reason, and every exclusion carries its
    # reason so the sheet can show it instead of silently skipping.

    _RECENT_PURCHASE_DAYS = 7

    async def _collect_restock_candidates(household_id: str):
        """Classify a household's inventory for the restock planner.

        Returns (candidates, summary). Each candidate carries its buying
        frequency, a skip ``reason`` (or None), and ``suggested`` — whether
        the planner pre-ticks it. Nothing is mutated. Secret-stash items
        never appear: the planner is shared household UI.
        """
        now = datetime.now(timezone.utc)
        today_iso = now.date().isoformat()
        cutoff = now - timedelta(days=_RECENT_PURCHASE_DAYS)

        def _as_aware(value):
            """Parse a stored datetime that may be str or datetime, naive or not."""
            if isinstance(value, str):
                try:
                    value = datetime.fromisoformat(value)
                except ValueError:
                    return None
            if not isinstance(value, datetime):
                return None
            return value if value.tzinfo else value.replace(tzinfo=timezone.utc)

        # Items ticked off on the shopping list only leave a trace there —
        # the receipt flow stamps inventory.last_purchased_at directly, so
        # both signals are consulted below.
        recent_names = set()
        bought_rows = await db.shopping_list.find(
            {"household_id": household_id, "bought_at": {"$ne": None}},
            {"_id": 0, "name_en": 1, "bought_at": 1},
        ).to_list(2000)
        for row in bought_rows:
            bought_at = _as_aware(row.get("bought_at"))
            if bought_at and bought_at >= cutoff and row.get("name_en"):
                recent_names.add(row["name_en"].strip().lower())

        items = await db.inventory.find({"household_id": household_id}, {"_id": 0}).to_list(2000)

        candidates = []
        summary = {
            "monthly": 0, "yearly": 0, "as_needed": 0,
            "secret": 0, "snoozed": 0, "recently_bought": 0, "already_empty": 0,
        }

        for item in items:
            if item.get("is_secret_stash"):
                summary["secret"] += 1
                continue

            # Legacy rows predate the field; monthly is the documented default.
            freq = item.get("purchase_frequency") or "monthly"

            # already_empty outranks the other reasons: marking an empty row
            # empty is a no-op whatever else is true, and the planner
            # disables its checkbox on that reason.
            reason = None
            snoozed_until = item.get("auto_suggest_snoozed_until")
            if item.get("stock_level") == "empty":
                reason = "already_empty"
            elif snoozed_until and snoozed_until > today_iso:
                reason = "snoozed"
            else:
                name_key = (item.get("name_en") or "").strip().lower()
                recently = name_key in recent_names
                if not recently:
                    last_purchased = _as_aware(item.get("last_purchased_at"))
                    recently = bool(last_purchased and last_purchased >= cutoff)
                if recently:
                    reason = "recently_bought"

            if freq == "yearly":
                summary["yearly"] += 1
            elif freq == "as_needed":
                summary["as_needed"] += 1
            elif reason is not None:
                summary[reason] += 1
            else:
                summary["monthly"] += 1

            candidates.append({
                "id": item["id"],
                "name_en": item.get("name_en"),
                "name_hi": item.get("name_hi"),
                "name_mr": item.get("name_mr"),
                "category": item.get("category"),
                "stock_level": item.get("stock_level"),
                "current_stock": item.get("current_stock", 0),
                "frequency": freq,
                "reason": reason,
                "suggested": freq == "monthly" and reason is None,
            })

        return candidates, summary

    @inventory_router.get("/inventory/month-reset/preview")
    async def preview_month_reset(
        credentials: HTTPAuthorizationCredentials = Depends(security),
    ):
        """Dry run — every plannable item with its frequency and pre-tick."""
        user = await get_user_from_token(credentials)
        household_id = user.get("active_household")
        if not household_id:
            raise HTTPException(status_code=400, detail="No active household")

        candidates, summary = await _collect_restock_candidates(household_id)
        items = [
            {k: v for k, v in c.items() if k != "current_stock"}
            for c in candidates
        ]
        return {"summary": summary, "items": items}

    class MonthResetRequest(BaseModel):
        """Optional body for POST /inventory/month-reset.

        `item_ids` is the planner's ticked selection. Omitted (legacy
        clients) means "everything the planner would pre-tick".
        """
        item_ids: Optional[List[str]] = None

    @inventory_router.post("/inventory/month-reset")
    async def start_new_month(
        payload: Optional[MonthResetRequest] = None,
        credentials: HTTPAuthorizationCredentials = Depends(security),
    ):
        """Mark the selected staples empty.

        The pre-reset stock levels are snapshotted into `month_resets` so the
        action can be undone from the toast — restoring from the client would
        mean trusting it with state it could lose on a refresh.
        """
        user = await get_user_from_token(credentials)
        household_id = user.get("active_household")
        if not household_id:
            raise HTTPException(status_code=400, detail="No active household")

        candidates, summary = await _collect_restock_candidates(household_id)
        selected_ids = payload.item_ids if payload else None
        if selected_ids is None:
            targets = [c for c in candidates if c["suggested"]]
        else:
            # Only ids the preview offered can be reset — that scopes the
            # write to the household and keeps secret-stash rows out even if
            # a client sends their ids. already_empty rows are dropped: the
            # write would be a no-op and would pad reset_count.
            wanted = set(selected_ids)
            targets = [
                c for c in candidates
                if c["id"] in wanted and c["reason"] != "already_empty"
            ]
        if not targets:
            return {"reset_count": 0, "summary": summary, "undo_token": None}

        undo_token = str(uuid.uuid4())
        await db.month_resets.insert_one({
            "id": undo_token,
            "household_id": household_id,
            "user_id": user.get("id"),
            "snapshot": [
                {
                    "id": t["id"],
                    "stock_level": t.get("stock_level"),
                    "current_stock": t.get("current_stock", 0),
                }
                for t in targets
            ],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "undone": False,
        })

        await db.inventory.update_many(
            {"id": {"$in": [t["id"] for t in targets]}},
            {"$set": {
                "stock_level": "empty",
                "current_stock": 0,
                "last_updated_by": user.get("id"),
            }},
        )

        return {
            "reset_count": len(targets),
            "summary": summary,
            "undo_token": undo_token,
        }

    @inventory_router.post("/inventory/month-reset/{undo_token}/undo")
    async def undo_month_reset(
        undo_token: str,
        credentials: HTTPAuthorizationCredentials = Depends(security),
    ):
        """Restore the stock levels captured by a month reset."""
        user = await get_user_from_token(credentials)
        household_id = user.get("active_household")

        log = await db.month_resets.find_one(
            {"id": undo_token, "household_id": household_id}, {"_id": 0},
        )
        if not log:
            raise HTTPException(status_code=404, detail="Reset not found")
        if log.get("undone"):
            return {"restored_count": 0, "message": "Already undone"}

        restored = 0
        for row in log.get("snapshot", []):
            result = await db.inventory.update_one(
                {"id": row["id"], "household_id": household_id},
                {"$set": {
                    "stock_level": row.get("stock_level") or "empty",
                    "current_stock": row.get("current_stock", 0),
                }},
            )
            restored += result.modified_count

        await db.month_resets.update_one({"id": undo_token}, {"$set": {"undone": True}})
        return {"restored_count": restored}

    return inventory_router
