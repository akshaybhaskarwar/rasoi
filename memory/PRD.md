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

#### Shopping List
- Auto-sync with low-stock inventory items
- Bilingual display
- Category-appropriate quantities
- CRUD operations

#### Meal Planner
- 7-day weekly calendar view
- 4 daily sections: Breakfast, Lunch, Snacks, Dinner
- **NEW: Local Recipe Database Search** (no YouTube API dependency!)
  - 25+ pre-built Indian recipes
  - Search by ingredients from pantry
  - Filter: "All" or "Videos Only"
  - Shows matching ingredients highlighted
  - Prep/cook time display
  - Match score ranking
- **Favorite YouTube Channels**
  - Inline collapsible section on Planner page
  - Add/Remove favorite channels
  - Recipes from favorites shown first
  - Visual indicators (⭐ Favorite Channel badge)

### 🟠 Known Issues
- **Translation API**: Currently MOCKED with static dictionary

### 🔵 Backlog (P2)
- Gap Analysis Sidebar (missing ingredients vs meal plan)
- Community Kitchen (user-submitted recipes)
- "Digital Dadi" intelligence widget
- WhatsApp export for shopping list
- Freshness indicators & "Mummy's Secret Stash" icons

## Tech Stack
- **Frontend**: React, Tailwind CSS, shadcn/ui, Lucide icons
- **Backend**: FastAPI, Pydantic
- **Database**: MongoDB
- **Recipe Search**: Local database (no external API dependency)
- **Optional**: YouTube Data API v3 for video details

## Key API Endpoints
- `/api/inventory` - Inventory CRUD
- `/api/shopping-list` - Shopping list CRUD
- `/api/meal-plans` - Meal plan CRUD
- `/api/recipes/search` - **NEW: Local recipe search by ingredients**
- `/api/youtube/search` - YouTube recipe search (quota limited)
- `/api/preferences/favorite-channels` - GET/POST/DELETE favorites
- `/api/translate` - Translation (MOCKED)

## Database Collections
- `inventory`: Kitchen items with bilingual names
- `shopping_list`: Shopping items
- `meal_plans`: Weekly meal assignments
- `preferences`: User preferences including favorite_channels

## Local Recipe Database
25+ Indian recipes including:
- Main courses: Dal Tadka, Palak Paneer, Chole, Rajma, Biryani
- Breakfast: Poha, Upma, Idli, Dosa, Aloo Paratha
- Snacks: Samosa, Vada Pav, Pav Bhaji
- Desserts: Gajar Halwa, Gulab Jamun

Sources: Ranveer Brar, Kabita's Kitchen, Hebbars Kitchen, Madhura's Recipe Marathi, Sanjeev Kapoor

---
*Last updated: January 26, 2025*
