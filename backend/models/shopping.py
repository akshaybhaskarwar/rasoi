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


class ShoppingStatusUpdate(BaseModel):
    status: str  # pending, in_cart, bought
    user_id: Optional[str] = None
    user_name: Optional[str] = None
