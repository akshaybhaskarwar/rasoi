# Rasoi-Sync - Indian Kitchen Manager

## Overview
A mobile-first web application for intelligent Indian kitchen management with bilingual support (English/Marathi).

## Core Features

### ✅ Implemented

#### Inventory Management
- Bilingual item display (English/Marathi)
- Card-based UI with category grouping
- Stock level filtering (Full, Half, Low, Empty)
- CRUD operations for items
- Indian Pantry Template for quick population
- **Expiry Date Tracking**
  - Optional expiry date for each item
  - "Items Expiring Soon!" alert banner (30-day threshold)
  - Visual warnings on item cards (amber for soon, red for urgent/expired)
  - Suggestion to use expiring items in recipes
- **Barcode Scanner**
  - Scan product barcodes using camera
  - Auto-lookup product details via Open Food Facts API
  - Manual entry option if barcode not found

#### Shopping List
- ✅ **Auto-sync with low-stock inventory items**
- ✅ **Stock level badges (Empty, Low) instead of quantities** - Fixed Jan 27, 2025
- Bilingual display
- Category grouping by store type (Grocery/Mandi)
- CRUD operations
- WhatsApp export feature

#### Gap Analysis Sidebar
- ✅ **Desktop: Right sidebar shows missing ingredients** - Verified Jan 27, 2025
- ✅ **Mobile: Collapsible card on Planner page** - Added Jan 27, 2025
- Missing ingredients grouped by date
- Shows which meal needs the ingredient
- "Add to Shopping List" button

#### Meal Planner
- 7-day weekly calendar view
- 4 daily sections: Breakfast, Lunch, Snacks, Dinner
- **Local Recipe Database Search** (no YouTube API dependency)
  - 25+ pre-built Indian recipes
  - Search by ingredients from pantry
  - Filter: "All" or "Videos Only"
  - Shows matching ingredients highlighted
- **Favorite YouTube Channels**
  - Inline collapsible section on Planner page
  - Recipes from favorites shown first

#### Home Page
- Digital Dadi Widget with context-aware suggestions
- Quick stats cards (Items in Stock, Low Stock, Meals Planned, Missing Items)
- Recent updates from inventory
- All links and buttons working

### 🟠 Known Issues
- **Translation API**: Currently MOCKED with static dictionary
- **YouTube API Search**: Unreliable due to quota limits (local recipe DB is workaround)

### 🔵 Backlog (P2)
- OCR for scanning expiry dates (tesseract.js installed but not implemented)
- Community Kitchen (user-submitted recipes)
- "Digital Dadi" enhanced with more dynamic suggestions
- Freshness indicators & "Mummy's Secret Stash" icons
- Expand local recipe database

## Tech Stack
- **Frontend**: React, Tailwind CSS, shadcn/ui, Lucide icons
- **Backend**: FastAPI, Pydantic
- **Database**: MongoDB
- **Barcode Scanning**: @zxing/browser
- **OCR**: Tesseract.js (installed, not implemented)
- **Product Lookup**: Open Food Facts API

## Key API Endpoints
- `/api/inventory` - Inventory CRUD (with expiry_date, barcode fields)
- `/api/shopping` - Shopping list CRUD (now with stock_level field)
- `/api/barcode/{barcode}` - Product lookup from Open Food Facts
- `/api/recipes/search` - Local recipe search by ingredients
- `/api/gap-analysis` - Compare meal plan vs inventory
- `/api/preferences/favorite-channels` - GET/POST/DELETE favorites

## Data Models

### Inventory Item
```
{id, name_en, name_mr, category, stock_level, expiry_date?, barcode?, created_at}
```

### Shopping Item
```
{id, name_en, name_mr, category, quantity, stock_level?, store_type, created_at}
```

### Meal Plan
```
{id, date, meal_type, meal_name, youtube_video_id?, youtube_thumbnail?, ingredients_needed[], created_at}
```

---
*Last updated: January 27, 2025*
