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
- **Product Scanner (AI-Powered OCR)** - Jan 27, 2025
  - **📸 AI Photo Scan** (Primary - recommended):
    - Step 1: Take photo of product → AI extracts product name
    - Step 2: Take photo of expiry area → AI extracts date
    - Uses OpenAI GPT-4o Vision for accurate text recognition
    - Works with curved text, textured backgrounds, printed stamps
  - **Barcode Method** (Secondary): Scan barcode to lookup product
  - **Manual Entry**: Direct data entry option
  - Successfully tested with real product packaging images

#### Shopping List
- ✅ **Auto-sync with low-stock inventory items**
- ✅ **Stock level badges (Empty, Low) instead of quantities** - Fixed Jan 27, 2025
- ✅ **Monthly Quantity parameter** - Added Jan 27, 2025
  - Each item shows expected monthly quantity (e.g., "5 kg", "2 L")
  - Default quantities based on category
  - Inline editing - click to modify quantity
  - WhatsApp export includes monthly quantities
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
- **Recipe Finder Dialog** with 3 search modes:
  1. **Local Search** - Search local database by recipe name
  2. **By Ingredients** - Select from pantry items
  3. **YouTube Videos** - Cache-first YouTube API search

#### Today-First Context-Aware Calendar - Added Jan 29, 2025
- **Auto-Scroll to Today**: Page loads with today's card scrolled into view
- **Visual Highlighting**: 
  - Orange ring/border around today's card
  - Pulsing calendar icon with gradient
  - "TODAY" badge with bounce animation
  - "X meals planned" summary count
- **Localized Date Display**: "Thursday, 29 Jan" format using date-fns
- **Meal Time Labels**: Each slot shows time (7:00 AM, 12:30 PM, 5:00 PM, 8:00 PM)

#### Full CRUD Meal Plan Operations - Added Jan 29, 2025
- **Create**: Add to Planner modal with scheduling
- **Read**: Calendar view with meal cards, video thumbnails, ingredient badges
- **Update**: Reserved ingredients indicator "📦 X items reserved"
- **Delete**: 
  - "Remove" button with loading state
  - Inventory release: Reserved ingredients return to "Available"
  - Toast: "Recipe removed! X ingredients released"
  - **Dadi's Tip**: After removal, suggests alternative: "Since you have the ingredients, how about 'Pav Bhaji'?"

#### Empty Slot Suggestions - Added Jan 29, 2025
- For today's empty meal slots:
  - Shows "✨ No meal planned"
  - "Quick picks available!" button with suggestion preview
  - Dashed border to indicate action needed

#### Add to Planner Modal - Added Jan 29, 2025
- **Scheduling Bottom Sheet**: Opens when clicking "Add" on any video card
- **Week View Day Picker**: Horizontal scroll (Mon-Sun) with "Today" highlight
- **Meal Slot Selection**: Breakfast, Lunch, Snacks, Dinner buttons
- **Serving Size Options**: Single (1), Couple (2), Family (4), Party (8+)
- **Ingredient Reservation System**:
  - Pre-populated list from video title/description match
  - Checkbox to include/exclude ingredients
  - Quantity auto-estimated based on serving size
  - Items marked as "Reserved" in inventory
- **Visual Feedback After Adding**:
  - Button changes from "Add" to "✓ Planned for [Day]" (green)
  - "Planned" badge appears on video thumbnail
  - Video card gets green border highlight

#### Personalized Recipe Stream - "Cook with Your Stock" - Added Jan 28, 2025
- **Channel Avatar Bar**: Horizontal scroll of favorite channel avatars with YouTube profile pictures
- **Channel Filtering**: Tap any channel to filter feed to that creator only
- **Inventory-Match Badge**: Each video shows "X% in Stock" with matched ingredient count
- **Matched Ingredients Tags**: Green pills showing which pantry items match the recipe
- **Minimum Match Threshold**: Filter to show only recipes with 1+, 2+, or 3+ ingredient matches
- **Quota-Efficient Playlist API**:
  - Uses `playlistItems.list` (1 unit) instead of `search` (100 units)
  - Channel info cached for 7 days
  - Playlist videos cached for 6 hours
  - Regex matching against video title + description

#### YouTube Recipe Discovery Module - Added Jan 28, 2025
- **Cache-First Architecture** - Minimizes API quota usage
  - LocalStorage cache (24-hour TTL) - instant repeat searches
  - MongoDB server cache - shared across sessions
  - Quota indicator shows API units used per search
- **"Dadi's Recommended" Carousel**
  - Pre-fetched videos (0 API quota)
  - Festival Specials, Video of the Day, Trending, Quick Recipes
- **Ingredient-Based Video Search**
  - Multi-select 2-5 ingredients from inventory
  - Shows "You have X/Y ingredients" match percentage
  - Missing ingredients displayed
- **User-Submitted Videos**
  - Paste any YouTube URL to save
  - Uses `videos.list` API (1 unit vs 100 for search)
  - Builds personal recipe collection

#### Favorite YouTube Channels
- Inline collapsible section on Planner page
- For text search: All recipes shown, favorites prioritized (higher score)
- For ingredient search: Filter to favorites only when set

#### Home Page
- Digital Dadi Widget with context-aware suggestions
- Quick stats cards (Items in Stock, Low Stock, Meals Planned, Missing Items)
- Recent updates from inventory
- All links and buttons working

### 🟠 Known Issues
- **Translation API**: Currently MOCKED with static dictionary

### 🔵 Backlog (P2)
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
{id, name_en, name_mr, category, quantity, stock_level?, monthly_quantity?, store_type, created_at}
```

### Meal Plan
```
{id, date, meal_type, meal_name, youtube_video_id?, youtube_thumbnail?, ingredients_needed[], created_at}
```

---
*Last updated: January 28, 2025*
