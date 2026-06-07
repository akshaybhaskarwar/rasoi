# PRD: Receipt → Inventory

| | |
|---|---|
| **Status** | Draft — pending approval |
| **Owner** | Akshay (PM + Eng) |
| **Engineering estimate** | Phase 1: ~1.5–2 weeks. Phase 2: ~1 week. |
| **Last updated** | 2026-06-04 |

---

## 1. Problem

After a grocery trip, a Rasoi-Sync user manually re-keys every purchased item into the inventory — typically 20–35 items per shop, ~6 minutes of tedious typing per receipt. This is the single biggest reason users abandon the app between shops: the cost of keeping inventory current is higher than the value of having it current.

Indian grocery receipts are:
- Mostly in Devanagari (Marathi/Hindi)
- Printed on thermal paper (faded, low contrast, often curled)
- Use vendor-specific abbreviations and unit codes
- Bundle food and non-food items in a single transaction

A working "scan receipt → inventory updates" flow makes the app *stickier* by removing the 6-minute tax on every shop.

## 2. Goals

### Primary
- Reduce inventory-update time from ~6 minutes to **under 90 seconds** for a 30-item receipt.
- Auto-match **≥80%** of items to the catalog (high or medium confidence) on first try.
- Total amount on the confirm screen matches the printed receipt total **to the rupee** on ≥95% of receipts (sanity check for the user).

### Secondary
- Make this work for both food and household items (Indian groceries are bundled).
- Establish vendor-mapping foundation for Phase 2 (per-shop learning).

### Non-goals (Phase 1)
- Per-gram tracking of food items (we stay categorical: Full/Half/Low/Empty).
- Parsing embedded sizes out of item names (`फरसान ५०० गु` → 500g). Deferred to Phase 2.
- Voice-driven entry, WhatsApp ingestion, shopping-list auto-generation — all Phase 3.
- Editing the catalog itself from the user side. Admin-only (handled separately).

## 3. User flow

### Happy path
1. User opens **Inventory** → taps **Scan Receipt** (new button).
2. Camera/photo-picker opens → user picks/takes a photo of the paper receipt.
3. App shows a progress spinner: "Reading your receipt…" (~10 s).
4. Confirm screen appears with the extracted items. Each row shows:
   - Localized item name (en/mr/hi based on user's locale setting)
   - The Devanagari text as printed on the receipt (small, secondary)
   - Quantity + unit
   - Amount (₹) — for visual cross-reference with the paper receipt
   - Color-coded match confidence (see UX below)
5. Top of the screen shows: **₹3,872** extracted total (matching printed total).
6. User scans the rows. Green rows are pre-checked. Yellow rows need a 1-tap confirm or pick from a dropdown. Red rows need manual catalog search.
7. User taps **Add 28 items to inventory**. Backend bulk-updates. Confirm screen closes. Inventory page reflects new stock levels.

### Edge paths
- **Photo unreadable:** "We couldn't read this receipt clearly. Try again with better lighting, or [enter items manually]."
- **Non-food + non-household items:** rows marked as "uncategorized — skip?". User dismisses with one tap.
- **Total mismatch (extracted vs printed):** banner at top: "We extracted ₹X but the printed total is ₹Y. You may want to add a missing item before saving."
- **User backs out without saving:** items discarded; no partial saves.

## 4. Architecture

### Pipeline (Pipeline B from benchmark)

```
[receipt image]
      │
      ▼
┌───────────────────────────────────┐
│ Google Cloud Vision               │  ← 1000/mo free; ~3 s; ~95% Devanagari char accuracy
│ document_text_detection           │
└─────────────┬─────────────────────┘
              │ raw OCR text (flattened columns)
              ▼
┌───────────────────────────────────┐
│ Claude Haiku (text only)          │  ← ~5 s; ~₹0.02/receipt; cached PANTRY_TEMPLATE
│ + PANTRY_TEMPLATE in cached       │
│   prompt (en/mr/hi/aliases)       │
└─────────────┬─────────────────────┘
              │ structured JSON {items[], total}
              ▼
┌───────────────────────────────────┐
│ Fuzzy fallback (rapidfuzz)        │  ← catches 1–2 char OCR drift Claude misses
│ on items where match=unmatched    │     e.g., भुग डाळ → मूग डाळ → Moong Dal
└─────────────┬─────────────────────┘
              │
              ▼
   POST /api/inventory/from-receipt
              │
              ▼
   confirm screen → bulk inventory update
```

### Why this architecture (benchmark evidence)

Tested on 3 real Marathi grocery receipts, totalling 89 items:

| Pipeline | Char accuracy | Auto-match | Speed | Cost/receipt |
|---|---|---|---|---|
| Claude vision only | ~50% | 0% (no catalog) | ~17 s | ~₹0.10 |
| Claude vision + catalog | ~50% | ~50% | ~21 s | ~₹0.15 |
| **Google + Claude text + catalog** | **~95%** | **82%** | **~15 s** | **~₹0.02** |

Decisive on every axis. The benchmark code and raw outputs are in `tools/ocr_benchmark/`.

## 5. Data model

### API contract: `POST /api/inventory/from-receipt`

Request:
```json
{
  "image_base64": "<jpeg data>",
  "household_id": "<from JWT>"
}
```

Response:
```json
{
  "receipt_id": "<uuid>",
  "vendor": "<shop name or null>",
  "total_extracted": 3872.00,
  "items": [
    {
      "row_id": "<uuid>",
      "name_devanagari": "बासमती तुकडा दुबार जुना",
      "name_canonical_en": "Basmati Rice",
      "match_confidence": "high",
      "qty": 5.0,
      "unit": "K",
      "amount": 375.00
    }
  ]
}
```

### API contract: `POST /api/inventory/bulk-update`

Sent by the confirm screen after user review:
```json
{
  "receipt_id": "<from previous response>",
  "items": [
    {
      "name_canonical_en": "Basmati Rice",     // user may have edited this
      "qty": 5.0,
      "unit": "K",
      "action": "add"                          // or "skip"
    }
  ]
}
```

Backend translates each item into a stock-level update or count update based on the inventory item's category.

### Inventory model extension

```python
class InventoryItem:
    # ... existing fields unchanged ...
    stock_level: Optional[Literal["full", "half", "low", "empty"]] = None  # food (existing)
    current_count: Optional[int] = None                                     # household (new)
    category: str                                                           # drives which the UI shows
```

No migration needed for existing food items.

### Receipt audit collection (new)

```python
class ReceiptLog:
    id: str
    household_id: str
    image_path: str                # S3/local; deleted after 30 days
    raw_ocr_text: str
    parsed_items: List[dict]
    user_corrections: List[dict]   # diff between AI extraction and what user saved
    created_at: datetime
    deleted_at: Optional[datetime]
```

The `user_corrections` field feeds Phase 2 vendor learning.

## 6. UX outline

### Confirm screen layout (per row)

```
┌─────────────────────────────────────────────────────┐
│ ✓ Basmati Rice                              ₹375    │  ← green (high)
│   बासमती तुकडा दुबार जुना · 5.00 kg                 │
├─────────────────────────────────────────────────────┤
│ ⚠ Almond Drops [▾ change]                  ₹80     │  ← yellow (medium)
│   एलमंड ड्रॉप्स १००मि. · 1 packet                   │
├─────────────────────────────────────────────────────┤
│ ⨯ [Pick from catalog…]                     ₹60     │  ← red (unmatched)
│   डांबर गोळी पॅक · 1 packet                         │
└─────────────────────────────────────────────────────┘
```

### Color semantics
- **Green:** high confidence — pre-checked. User scans for sanity only.
- **Yellow:** medium confidence — pre-filled with best guess + dropdown to change.
- **Red:** low / unmatched — user must pick from catalog OR skip.

### Bulk actions
- **Top bar:** "₹3,872 extracted | Printed total: ₹3,872 ✓" (or "⚠️ ₹49 difference" if mismatch)
- **Top right:** "Add 28 items" (count auto-updates as user checks/unchecks rows)
- **Footer:** "[Skip all uncategorized] [Save & close]"

### Search/pick experience for red rows
Tap "Pick from catalog…" → bottom sheet with search field that filters the 271-item catalog. Two characters of Marathi or English narrows to <5 options. Tap to select; row turns green.

## 7. Engineering breakdown

| Sub-task | Effort | Notes |
|---|---|---|
| `POST /api/inventory/from-receipt` (image → structured items) | 1 day | Reuses `tools/ocr_benchmark` pipeline |
| Fuzzy fallback layer (rapidfuzz) | 0.5 day | Extends `to_canonical_en` from prior work |
| `POST /api/inventory/bulk-update` + stock-level translation | 1 day | Maps unit codes → categorical stock changes |
| Receipt audit logging | 0.5 day | `ReceiptLog` collection + 30-day TTL |
| Catalog expansion (HOUSEHOLD category + missing food items) | 0.5 day | ~30 household items + 3 food gaps from benchmark |
| Frontend: Scan Receipt button + camera/picker | 0.5 day | Inventory page |
| Frontend: confirm screen (rows + colors + dropdowns) | 2 days | Most of the UX surface |
| Frontend: catalog-pick bottom sheet | 1 day | Search across 300+ items |
| QA, beta gating, error UX | 2 days | |
| **Total Phase 1** | **~9 working days (~1.5 weeks)** | |

### Phase 2 scope (deferred — separate PRD)
- Monthly-review screen for household items
- Vendor-mapping table — per-shop learning from user corrections
- Embedded-size parsing (`५०० गु` → 500g)
- Auto-flow depleted household items into next month's shopping list

## 8. Success metrics

| Metric | Phase 1 target | Source |
|---|---|---|
| Median time to update inventory from a 30-item receipt | ≤ 90 s | client-side telemetry |
| Auto-match rate (high+medium) | ≥ 80% | server-side log |
| Total amount matches printed total | ≥ 95% of receipts | server-side log |
| Monthly active users using the feature | ≥ 35% of MAU within 90 days | analytics |
| Average corrections per receipt | ≤ 3 | telemetry |

If the first three hold for 4+ weeks on the beta cohort, expand. If auto-match drops below 70%, treat as a regression and root-cause (likely catalog drift or new vendor formats).

## 9. Beta rollout

- **Week 1:** enabled for owner account only (Akshay). Manual review of every receipt and user-correction.
- **Week 2:** enabled for ~5 trusted household IDs (friends/family). Daily check on telemetry.
- **Week 3+:** broad rollout if metrics hold.

Feature flag: `RECEIPT_INGEST_ENABLED` per household.

## 10. Risks and mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Google Vision goes paid (drop free tier) | Low | At our volume (~₹1.50/1000 receipts) the cost is trivial. Budget cap of ₹500/month. |
| Anthropic API outage / rate-limit | Med | Catch + show "OCR temporarily unavailable, please add items manually" message. |
| Devanagari accuracy degrades on a different receipt format | Med | Telemetry on auto-match rate per vendor; alert if it drops below 60% for any single vendor. |
| User uploads non-receipt photos (groceries, kids, etc.) | Low | Claude prompt detects "this doesn't look like a receipt" and returns empty items + a flag. |
| Stock-level math gets confusing (5kg dal on top of existing half-full) | Med | UX: receipt-driven add always bumps to "full." Manual stock-level editing remains the source of truth for in-between states. |
| User correction data not useful for Phase 2 learning | Low | Capture liberally; cheap to store. We'll know if it's useful when Phase 2 begins. |

## 11. Open questions (locked or deferred)

| Question | Decision |
|---|---|
| Show ₹ amount on confirm screen? | Yes (display-only; not persisted) |
| Track household items? | Yes — new HOUSEHOLD catalog category |
| Stock-level model for household | Integer count, separate from food's categorical stock_level |
| Embedded size parsing | Phase 2 |
| Vendor mapping | Phase 2 |
| Monthly-review UX | Phase 2 |
| Image retention | 30 days, auto-delete unless user pins (out of scope for Phase 1 UX — implemented as background job) |
| Beta cohort | Owner only → trusted ~5 → broad |
| What if user buys an item not in catalog AND not household? | Row is "uncategorized"; user can either skip or "add to catalog" (admin only — for Phase 1, just skip) |
| Multi-receipt batch upload (e.g., 3 receipts from same day) | Out of scope. One receipt at a time. |

## 12. Out of scope for Phase 1 (explicitly)

- Editing extracted items in place beyond catalog re-pick and qty edit.
- Splitting a receipt across multiple households.
- Re-running OCR on the same receipt after the user has saved it.
- Backporting Phase 1 to old receipts the user has photos of.
- Integration with shopping list (Phase 2: depleted household → shopping list auto-add).
- Receipts from non-Indian shops (English-only receipts will likely work but aren't tested).

## 13. Sign-off

Reviewer approves by replying "PRD approved" in conversation. Once approved:

1. Catalog expansion task starts (~0.5 day).
2. Backend endpoint built in parallel (~1 day).
3. Frontend confirm screen built (~3 days).
4. Beta rollout to owner account on day 8.
5. Trusted cohort on day 12.
6. Phase 1 GA decision on day 28 based on metrics.
