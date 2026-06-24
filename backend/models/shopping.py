"""
Shopping list models for Rasoi-Sync
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, timezone
import uuid


class ShoppingItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    household_id: Optional[str] = None
    name_en: str
    name_hi: Optional[str] = None
    name_mr: Optional[str] = None
    category: str
    quantity: str
    stock_level: Optional[str] = None  # empty, low - synced from inventory
    monthly_quantity: Optional[str] = None  # e.g., "2 kg", "500 g", "1 L"
    store_type: str = "grocery"  # grocery or mandi
    shopping_status: str = "pending"  # pending, in_cart, bought
    claimed_by: Optional[str] = None
    claimed_by_name: Optional[str] = None
    expiry_date: Optional[str] = None  # ISO date string YYYY-MM-DD
    bought_at: Optional[datetime] = None
    # How this row landed on the shopping list. Drives the delete UX:
    # `manual` rows hard-delete with undo; `auto` (low/empty stock auto-
    # suggest) and `recipe` (add-missing-from-recipe) rows trigger the
    # intent sheet so users can mark as already-stocked or snooze the
    # auto-suggest. Legacy rows without this field render as `manual`.
    source: Optional[str] = "manual"  # manual | auto | recipe
    # Optional opaque reference for the source — e.g. recipe id for
    # `recipe`, festival key for `auto` festival-mode rows. Free-form.
    source_ref: Optional[str] = None
    # If set, the auto-suggest job will not re-add an identical item
    # (by name_en + household_id) until this date passes. Used by the
    # "Skip this trip" delete intent.
    auto_suggest_snoozed_until: Optional[str] = None  # YYYY-MM-DD
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ShoppingItemCreate(BaseModel):
    name_en: str
    name_mr: Optional[str] = None
    name_hi: Optional[str] = None
    category: str
    quantity: str
    stock_level: Optional[str] = None
    monthly_quantity: Optional[str] = None
    expiry_date: Optional[str] = None  # ISO date string YYYY-MM-DD
    store_type: str = "grocery"
    # Optional override for non-manual create paths (recipe/dadi).
    # The POST /shopping endpoint forces this to "manual" regardless of
    # what the client sends — only server-side callers writing directly
    # to the collection (e.g. dadi auto-add) get to set "auto"/"recipe".
    source: Optional[str] = None
    source_ref: Optional[str] = None


class ShoppingStatusUpdate(BaseModel):
    status: str  # pending, in_cart, bought
    user_id: Optional[str] = None
    user_name: Optional[str] = None


class ShoppingSnoozeRequest(BaseModel):
    # Body for PUT /shopping/{id}/snooze. Days is the number of days
    # forward from today before auto-suggest may re-add this item; the
    # endpoint computes the absolute date so clients don't have to.
    days: int = 7
