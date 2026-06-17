"""
Menu routes for Rasoi-Sync.

Phase 1 of the Browse-Menu feature. Exposes the static EVERYDAY_MENU
catalog (Maharashtrian vegetarian meal-component library) plus a
household-scoped collection of user-added custom dishes.

  GET    /api/menu                  catalog + this household's custom items
  POST   /api/menu/custom           add a custom dish to this household
  PUT    /api/menu/custom/{id}      edit one of this household's custom dishes
  DELETE /api/menu/custom/{id}      remove a custom dish

Catalog dishes are read-only; user items are CRUD-able by the household
that created them. The frontend merges the two lists for display, marking
user items with an "is_custom: true" flag.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from data.everyday_menu import EVERYDAY_MENU, COMPOSED_MEALS
from data.breakfast_snacks_menu import BREAKFAST_SNACKS_MENU
from models.menu import (
    ALLOWED_MENU_CATEGORIES,
    UserMenuItem,
    UserMenuItemCreate,
    UserMenuItemUpdate,
)

security = HTTPBearer(auto_error=False)
menu_router = APIRouter(prefix="/api", tags=["Menu"])


def create_menu_routes(db, decode_token):
    """Factory function — wires the menu routes against the DB + auth."""

    async def get_user_from_token(credentials: HTTPAuthorizationCredentials):
        if not credentials:
            raise HTTPException(status_code=401, detail="Not authenticated")
        payload = decode_token(credentials.credentials)
        user_id = payload.get("sub")
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user

    def _validate_category(category: str):
        if category not in ALLOWED_MENU_CATEGORIES:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Unknown category '{category}'. "
                    f"Allowed: {sorted(ALLOWED_MENU_CATEGORIES)}"
                ),
            )

    @menu_router.get("/menu")
    async def get_menu(credentials: HTTPAuthorizationCredentials = Depends(security)):
        """Return the merged menu catalog: global EVERYDAY_MENU + this
        household's custom items, grouped by category. Composed meals
        (PartyTime, Combinations) are returned alongside.
        """
        user = await get_user_from_token(credentials)
        household_id = user.get("active_household")

        # Catalog (read-only, same for every household)
        catalog = {
            category: [
                {**item, "is_custom": False}
                for item in items
            ]
            for category, items in EVERYDAY_MENU.items()
        }

        # Household custom items
        custom_by_category = {}
        if household_id:
            cursor = db.user_menu_items.find(
                {"household_id": household_id},
                {"_id": 0},
            )
            async for doc in cursor:
                # Normalize datetimes for JSON serialization
                for k in ("created_at", "updated_at"):
                    if isinstance(doc.get(k), datetime):
                        doc[k] = doc[k].isoformat()
                doc["is_custom"] = True
                custom_by_category.setdefault(doc["category"], []).append(doc)

        breakfast_catalog = {
            category: [
                {**item, "is_custom": False}
                for item in items
            ]
            for category, items in BREAKFAST_SNACKS_MENU.items()
        }

        return {
            "catalog": catalog,                    # for lunch/dinner planning
            "breakfast_catalog": breakfast_catalog,  # for breakfast/snacks planning
            "custom": custom_by_category,
            "composed": COMPOSED_MEALS,
        }

    @menu_router.post("/menu/custom", response_model=UserMenuItem)
    async def add_custom_menu_item(
        item: UserMenuItemCreate,
        credentials: HTTPAuthorizationCredentials = Depends(security),
    ):
        """Add a household-scoped custom dish."""
        user = await get_user_from_token(credentials)
        household_id = user.get("active_household")
        if not household_id:
            raise HTTPException(
                status_code=400,
                detail="No active household — create or join a kitchen first.",
            )

        _validate_category(item.category)

        name_en = (item.name_en or "").strip()
        if not name_en:
            raise HTTPException(status_code=400, detail="name_en is required")

        # Reject duplicates within the household (case-insensitive)
        existing = await db.user_menu_items.find_one({
            "household_id": household_id,
            "name_en_lower": name_en.lower(),
        })
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"'{name_en}' is already in this household's menu",
            )

        record = UserMenuItem(
            household_id=household_id,
            category=item.category,
            name_en=name_en,
            name_mr=(item.name_mr or None),
            vegetable_tag=(item.vegetable_tag or None),
            aliases=item.aliases or [],
            created_by=user.get("id"),
            last_updated_by=user.get("id"),
        )
        doc = record.model_dump()
        doc["created_at"] = doc["created_at"].isoformat()
        doc["updated_at"] = doc["updated_at"].isoformat()
        # Lowercased copy used by the unique index for case-insensitive dedup
        doc["name_en_lower"] = name_en.lower()
        await db.user_menu_items.insert_one(doc)

        # Echo back the canonical record (without the internal lower-cased copy)
        doc.pop("name_en_lower", None)
        return doc

    @menu_router.put("/menu/custom/{item_id}", response_model=UserMenuItem)
    async def update_custom_menu_item(
        item_id: str,
        patch: UserMenuItemUpdate,
        credentials: HTTPAuthorizationCredentials = Depends(security),
    ):
        """Edit a household's custom dish. Only the owning household can edit."""
        user = await get_user_from_token(credentials)
        household_id = user.get("active_household")
        if not household_id:
            raise HTTPException(status_code=400, detail="No active household")

        existing = await db.user_menu_items.find_one(
            {"id": item_id, "household_id": household_id},
        )
        if not existing:
            raise HTTPException(status_code=404, detail="Custom menu item not found")

        update = {k: v for k, v in patch.model_dump(exclude_none=True).items()}
        if "category" in update:
            _validate_category(update["category"])
        if "name_en" in update:
            update["name_en"] = update["name_en"].strip()
            if not update["name_en"]:
                raise HTTPException(status_code=400, detail="name_en cannot be empty")
            update["name_en_lower"] = update["name_en"].lower()
            # Guard against renaming into an existing custom dish
            dup = await db.user_menu_items.find_one({
                "household_id": household_id,
                "name_en_lower": update["name_en_lower"],
                "id": {"$ne": item_id},
            })
            if dup:
                raise HTTPException(
                    status_code=409,
                    detail=f"'{update['name_en']}' already exists in this menu",
                )

        update["updated_at"] = datetime.now(timezone.utc).isoformat()
        update["last_updated_by"] = user.get("id")

        await db.user_menu_items.update_one(
            {"id": item_id, "household_id": household_id},
            {"$set": update},
        )

        fresh = await db.user_menu_items.find_one(
            {"id": item_id}, {"_id": 0, "name_en_lower": 0},
        )
        return fresh

    @menu_router.delete("/menu/custom/{item_id}")
    async def delete_custom_menu_item(
        item_id: str,
        credentials: HTTPAuthorizationCredentials = Depends(security),
    ):
        """Remove a household's custom dish."""
        user = await get_user_from_token(credentials)
        household_id = user.get("active_household")
        if not household_id:
            raise HTTPException(status_code=400, detail="No active household")

        result = await db.user_menu_items.delete_one(
            {"id": item_id, "household_id": household_id},
        )
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Custom menu item not found")
        return {"deleted": item_id}

    return menu_router
