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
- YouTube recipe search based on pantry ingredients
- Video preview/playback within app
- **Favorite YouTube Channels** (Completed Jan 26, 2025)
  - Inline collapsible section on Planner page
  - Add/Remove favorite channels
  - Popular channel suggestions
  - Prioritizes search results from favorite channels
  - Visual indicators (⭐ badge, amber highlight) for favorite channel results

### 🟠 In Progress / Issues
- **Translation API**: Currently MOCKED with static dictionary. Needs live Google Translate integration.

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
- **Integrations**: YouTube Data API v3

## Key API Endpoints
- `/api/inventory` - Inventory CRUD
- `/api/shopping-list` - Shopping list CRUD
- `/api/meal-plans` - Meal plan CRUD
- `/api/youtube/search` - Recipe search with favorite channel priority
- `/api/preferences/favorite-channels` - GET/POST/DELETE favorites
- `/api/translate` - Translation (MOCKED)

## Database Collections
- `inventory`: Kitchen items with bilingual names
- `shopping_list`: Shopping items
- `meal_plans`: Weekly meal assignments
- `preferences`: User preferences including favorite_channels

---
*Last updated: January 26, 2025*
