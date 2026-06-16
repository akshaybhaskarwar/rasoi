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
from datetime import datetime, timezone

from models.inventory import InventoryItem, InventoryItemCreate, DEFAULT_MONTHLY_QUANTITIES

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
                        "stock_level": "full",
                        "current_stock": new_current,
                        "last_updated_by": user.get("id"),
                        "aliases": merged_aliases,
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
                    "stock_level": "full",
                    "current_stock": new_current,
                    "last_updated_by": user.get("id"),
                    "aliases": merged_aliases,
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

    return inventory_router
