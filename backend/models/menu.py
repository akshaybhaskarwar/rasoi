"""
Menu models for Rasoi-Sync — Phase 1 of the Browse-Menu feature.

The static EVERYDAY_MENU catalog in data/everyday_menu.py is the seed for
every household. UserMenuItem is the additive layer: rows users add for
their own family dishes that aren't in the catalog. Catalog stays
read-only; user items are CRUD-able by the household that created them.
"""
from datetime import datetime, timezone
from typing import List, Optional
import uuid

from pydantic import BaseModel, ConfigDict, Field


# Categories that the UI surfaces in the menu browse tab. Must match the
# keys in data/everyday_menu.EVERYDAY_MENU plus data/breakfast_snacks_menu
# .BREAKFAST_SNACKS_MENU plus "Custom" for items the user wants to add
# but couldn't pin to any of the canonical categories.
ALLOWED_MENU_CATEGORIES = {
    # Lunch / Dinner — EVERYDAY_MENU
    "Chapati", "Dal", "Sabji", "Rice", "Koshimbhir",
    "Chatni", "KadhiSaar", "Gole", "Gravies",
    # Breakfast / Snacks — BREAKFAST_SNACKS_MENU
    "SouthIndian", "Gujarati", "PavBread", "Upvas", "Chaat",
    "PohaMurmure", "FriedItems", "Paneer", "Maharashtrian",
    "FastFood", "Parathe", "Rajasthani",
    # Catch-all for both contexts
    "Custom",
}


class UserMenuItem(BaseModel):
    """A household-scoped custom menu item.

    Sits alongside the global EVERYDAY_MENU catalog in the merged response
    from GET /api/menu. Catalog items have no `id` and `is_custom: false`;
    UserMenuItem entries always have an id and `is_custom: true`.
    """
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    household_id: str
    category: str  # one of ALLOWED_MENU_CATEGORIES
    name_en: str
    name_mr: Optional[str] = None
    # Optional vegetable tag — only meaningful for Sabji items; lets the UI
    # group user-added sabjis by vegetable just like catalog ones.
    vegetable_tag: Optional[str] = None
    aliases: List[str] = []
    created_by: Optional[str] = None
    last_updated_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserMenuItemCreate(BaseModel):
    """Request body for POST /api/menu/custom."""
    model_config = ConfigDict(extra="ignore")

    category: str
    name_en: str
    name_mr: Optional[str] = None
    vegetable_tag: Optional[str] = None
    aliases: List[str] = []


class UserMenuItemUpdate(BaseModel):
    """Request body for PUT /api/menu/custom/{id}. All fields optional."""
    model_config = ConfigDict(extra="ignore")

    category: Optional[str] = None
    name_en: Optional[str] = None
    name_mr: Optional[str] = None
    vegetable_tag: Optional[str] = None
    aliases: Optional[List[str]] = None
