"""
Inventory models for Rasoi-Sync
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid


class InventoryItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    household_id: Optional[str] = None
    name_en: str
    name_hi: Optional[str] = None
    name_mr: Optional[str] = None
    category: str
    stock_level: str = "empty"  # empty, low, half, full
    current_stock: int = 0  # Actual current stock quantity in this item's `unit`
                            # (g/ml for food, pcs for household & countable items).
    is_secret_stash: bool = False
    unit: str = "kg"
    expiry_date: Optional[str] = None  # ISO date string YYYY-MM-DD
    barcode: Optional[str] = None
    monthly_quantity: Optional[int] = None
    monthly_unit: Optional[str] = None
    aliases: List[str] = []  # English transliterations of regional names (e.g., ["Besan"] for Gram Flour)
    reserved_for: List[Dict[str, Any]] = []
    last_updated_by: Optional[str] = None
    # is_custom=True marks items the user added from a receipt that didn't
    # match the canonical PANTRY_TEMPLATE catalog. Used by the inventory UI
    # to show a "custom" badge and (separately) drives the catalog_suggestions
    # admin pipeline for promoting popular custom items into the catalog.
    is_custom: bool = False
    # How often this household actually buys the item. Drives the
    # month-end reset: only `monthly` rows are emptied by
    # POST /inventory/start-new-month. `monthly` is the default because
    # it's true of the large majority of pantry staples — the UI leaves
    # monthly rows unlabelled and only badges the exceptions.
    purchase_frequency: str = "monthly"  # monthly | yearly | as_needed
    # Last time this item was restocked (receipt scan, or marked bought
    # on the shopping list). The month-end reset skips anything bought
    # in the last few days so a late-month shop isn't wiped out.
    last_purchased_at: Optional[str] = None  # ISO datetime
    # Set by the "Skip this trip" delete intent (PUT /shopping/{id}/snooze).
    # While this date is in the future the shopping UI hides this item from
    # the low-stock "Update N" suggestion. Declared here because the model
    # is `extra="ignore"` and GET /inventory serialises through it — without
    # the field the snooze never reaches the client.
    auto_suggest_snoozed_until: Optional[str] = None  # YYYY-MM-DD
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class InventoryItemCreate(BaseModel):
    name_en: str
    name_mr: Optional[str] = None
    name_hi: Optional[str] = None
    category: str
    stock_level: str = "empty"
    current_stock: int = 0
    is_secret_stash: bool = False
    unit: str = "kg"
    expiry_date: Optional[str] = None
    barcode: Optional[str] = None
    monthly_quantity: Optional[int] = None
    monthly_unit: Optional[str] = None
    aliases: Optional[List[str]] = None  # English transliterations of regional names


def compute_stock_level(current_stock, monthly_quantity) -> str:
    """Derive stock_level from how much is left against the monthly need.

    Must stay in step with calculateStockStatus() in the frontend's
    lib/inventoryUtils.js — the Inventory screen computes the label on the fly
    from these same two numbers, while the shopping list reads the stored
    `stock_level` field. When the two disagree the restock loop silently
    breaks: an item at 3g of a 200g monthly need displayed as "low" on
    Inventory but carried a stored "full", so the shopping list concluded
    there was nothing to buy and never offered it.

    The receipt path used to hardcode "full" on every item it touched,
    whatever the quantity, which is how that state arose.
    """
    try:
        current = float(current_stock or 0)
    except (TypeError, ValueError):
        current = 0.0
    try:
        monthly = float(monthly_quantity or 0)
    except (TypeError, ValueError):
        monthly = 0.0

    if monthly <= 0:
        # No target to measure against: anything on hand counts as stocked.
        return "full" if current > 0 else "empty"

    pct = (current / monthly) * 100
    if pct <= 0:
        return "empty"
    if pct <= 25:
        return "low"
    if pct <= 75:
        return "half"
    return "full"


# Default monthly quantities by category
DEFAULT_MONTHLY_QUANTITIES = {
    'grains': {'quantity': 5, 'unit': 'kg', 'step': 1000},
    'pulses': {'quantity': 500, 'unit': 'g', 'step': 250},
    'spices': {'quantity': 100, 'unit': 'g', 'step': 50},
    'dairy': {'quantity': 5, 'unit': 'L', 'step': 500},
    'oils': {'quantity': 1, 'unit': 'L', 'step': 250},
    'bakery': {'quantity': 2, 'unit': 'pcs', 'step': 1},
    'snacks': {'quantity': 500, 'unit': 'g', 'step': 100},
    'beverages': {'quantity': 500, 'unit': 'g', 'step': 100},
    'vegetables': {'quantity': 2, 'unit': 'kg', 'step': 500},
    'fruits': {'quantity': 2, 'unit': 'kg', 'step': 500},
    'fasting': {'quantity': 500, 'unit': 'g', 'step': 100},
    'household': {'quantity': 1, 'unit': 'pcs', 'step': 1},
    'cleaning': {'quantity': 1, 'unit': 'pcs', 'step': 1},
    # Present in the frontend's table but missing here, so medicine had no
    # default to fall back on when an item had no monthly_quantity set.
    'medicine': {'quantity': 1, 'unit': 'pcs', 'step': 1},
    'other': {'quantity': 1, 'unit': 'kg', 'step': 250}
}


def default_monthly_base_units(category: str):
    """Category default monthly quantity, converted to BASE units (g/ml/pcs).

    DEFAULT_MONTHLY_QUANTITIES is expressed in display units and mixes them:
    grains is 5 kg while pulses is 500 g. `current_stock` is always in base
    units, so comparing it against the raw `quantity` would read grains as
    5 grams and call a nearly-empty sack "full".

    The dict itself is left alone because GET /inventory/monthly-defaults
    serves it verbatim; the conversion lives here instead.
    """
    entry = DEFAULT_MONTHLY_QUANTITIES.get((category or "other").lower())
    if not entry:
        return None
    qty = entry.get("quantity")
    if qty is None:
        return None
    unit = (entry.get("unit") or "").lower()
    if unit in ("kg", "l"):
        return qty * 1000
    return qty
