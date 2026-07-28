"""
Price history models for Rasoi-Sync.

Why a separate collection
-------------------------
Receipt OCR already extracts a per-item `rate` and `amount`, and those land in
`db.receipts.parsed_items`. But that collection carries a 30-day TTL (see
server.py) because it also holds `raw_ocr_text` — a full transcription of a
household's receipt, which is bulky and private and should not be kept forever.

So the price data was being destroyed a month after capture, purely as a side
effect of cleaning up OCR text. `price_history` holds only the thin, durable
record — item, rate, unit, date, vendor — with no TTL. The receipts collection
keeps expiring exactly as before.

Records are APPEND-ONLY: one row per item per purchase. Reading "last paid"
means taking the most recent row. Keeping the full series costs almost nothing
(~200 bytes a row) and leaves room for trend, vendor-comparison and basket-
estimate features later without a migration.
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Tuple
from datetime import datetime, timezone
import uuid


# Receipt unit codes -> (display basis, multiplier to convert rate to that basis).
#
# The receipt's `rate` is already a unit price: for a row with unit "K",
# rate is rupees per kilogram. Grams and millilitres are scaled up so every
# weight lands on ₹/kg and every volume on ₹/L, which is what makes two
# purchases actually comparable.
#
# "UT" (unit/packet) CANNOT be normalised — the pack size is nowhere on the
# receipt. A ₹25 packet of farsan and a ₹40 packet of farsan may be different
# sizes. Those stay as ₹/pack and are only ever compared against another pack
# purchase of the same item. Presenting them as ₹/kg would be a fabrication.
_UNIT_BASIS = {
    "k": ("kg", 1.0),
    "kg": ("kg", 1.0),
    "g": ("kg", 1000.0),
    "gram": ("kg", 1000.0),
    "grams": ("kg", 1000.0),
    "l": ("L", 1.0),
    "lt": ("L", 1.0),
    "litre": ("L", 1.0),
    "litres": ("L", 1.0),
    "liter": ("L", 1.0),
    "liters": ("L", 1.0),
    "ml": ("L", 1000.0),
    "milliliter": ("L", 1000.0),
    "milliliters": ("L", 1000.0),
}

# Model match levels we are willing to record a price against. A wrong item
# match writes the price of one thing onto another, and the error is permanent
# and invisible. Observed in real data: a row matched "Roasted Rava" at
# low confidence with rate 799 — obviously a mispairing, and it would have
# poisoned that item's history for good.
TRUSTED_CONFIDENCE = {"high", "medium"}

# rate * qty should reconcile with the printed amount. The OCR prompt warns
# that the engine flattens receipt columns and the model re-pairs them, so a
# rate belonging to a different line is the known failure mode. 2% absorbs
# ordinary rounding on the printed total.
AMOUNT_TOLERANCE = 0.02


class PriceRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    household_id: str
    # Canonical catalog name — the join key against inventory and shopping rows.
    canonical_name: str
    rate: float                      # price per `unit_basis`
    unit_basis: str                  # 'kg' | 'L' | 'pack'
    qty: Optional[float] = None      # how much was bought, in the receipt's own unit
    unit_raw: Optional[str] = None   # the receipt's unit code, kept for debugging
    amount: Optional[float] = None   # what was actually paid for this line
    vendor: Optional[str] = None     # often absent — 2 of 3 sampled receipts had none
    store_type: Optional[str] = None # grocery | mandi, when known
    source: str = "receipt"          # receipt | manual
    receipt_id: Optional[str] = None
    bought_on: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


def normalise_unit(unit_raw: Optional[str]) -> Tuple[str, float]:
    """Map a receipt unit code to (basis, multiplier). Unknown units are packs."""
    return _UNIT_BASIS.get((unit_raw or "").strip().lower(), ("pack", 1.0))


def price_from_receipt_row(
    row: dict,
    *,
    household_id: str,
    vendor: Optional[str] = None,
    store_type: Optional[str] = None,
    receipt_id: Optional[str] = None,
    bought_on: Optional[datetime] = None,
    require_confidence: bool = True,
) -> Tuple[Optional[PriceRecord], Optional[str]]:
    """Build a PriceRecord from one parsed receipt row.

    Returns (record, None) when the row is usable, or (None, reason) when it
    should be skipped. The reason string is for logging and the backfill
    report — a silently dropped row is impossible to debug later.

    `require_confidence` is on for the backfill (where nobody reviewed the
    rows) and off for the confirm screen (where the user has seen the item and
    its amount and accepted it).
    """
    name = (row.get("name_canonical_en") or "").strip()
    if not name:
        return None, "no canonical name"

    if require_confidence:
        conf = (row.get("match_confidence") or "").strip().lower()
        if conf not in TRUSTED_CONFIDENCE:
            return None, f"confidence '{conf or 'missing'}' not trusted"

    rate = row.get("rate")
    qty = row.get("qty")
    amount = row.get("amount")

    # Derive a missing rate when the other two are present and sane.
    if rate is None and amount is not None and qty:
        try:
            rate = float(amount) / float(qty)
        except (TypeError, ValueError, ZeroDivisionError):
            return None, "could not derive rate"

    if rate is None:
        return None, "no rate"
    try:
        rate = float(rate)
    except (TypeError, ValueError):
        return None, "rate not numeric"
    if rate <= 0:
        return None, "rate not positive"

    # Consistency check runs on the RAW values, before any unit scaling.
    if qty is not None and amount is not None:
        try:
            q, a = float(qty), float(amount)
            if a > 0 and abs(rate * q - a) / a > AMOUNT_TOLERANCE:
                return None, f"rate*qty ({rate * q:.2f}) != amount ({a:.2f})"
        except (TypeError, ValueError):
            pass  # unusable numbers here are not themselves grounds to drop

    basis, multiplier = normalise_unit(row.get("unit"))
    record = PriceRecord(
        household_id=household_id,
        canonical_name=name,
        rate=round(rate * multiplier, 2),
        unit_basis=basis,
        qty=float(qty) if qty is not None else None,
        unit_raw=row.get("unit"),
        amount=float(amount) if amount is not None else None,
        vendor=vendor or None,
        store_type=store_type,
        source="receipt",
        receipt_id=receipt_id,
        bought_on=bought_on or datetime.now(timezone.utc),
    )
    return record, None
