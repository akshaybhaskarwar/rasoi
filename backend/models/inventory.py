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
    current_stock: int = 0  # Actual current stock quantity (in base units: g or ml)
    freshness: Optional[int] = None  # 0-100 for perishables
    is_secret_stash: bool = False
    unit: str = "kg"
    expiry_date: Optional[str] = None  # ISO date string YYYY-MM-DD
    barcode: Optional[str] = None
    monthly_quantity: Optional[int] = None
    monthly_unit: Optional[str] = None
    aliases: List[str] = []  # English transliterations of regional names (e.g., ["Besan"] for Gram Flour)
    reserved_for: List[Dict[str, Any]] = []
    last_updated_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class InventoryItemCreate(BaseModel):
    name_en: str
    name_mr: Optional[str] = None
    name_hi: Optional[str] = None
    category: str
    stock_level: str = "empty"
    current_stock: int = 0
    freshness: Optional[int] = None
    is_secret_stash: bool = False
    unit: str = "kg"
    expiry_date: Optional[str] = None
    barcode: Optional[str] = None
    monthly_quantity: Optional[int] = None
    monthly_unit: Optional[str] = None
    aliases: Optional[List[str]] = None  # English transliterations of regional names


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
    'other': {'quantity': 1, 'unit': 'kg', 'step': 250}
}
