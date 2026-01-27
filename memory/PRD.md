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
- **NEW: Expiry Date Tracking**
  - Optional expiry date for each item
  - "Items Expiring Soon!" alert banner (30-day threshold)
  - Visual warnings on item cards (amber for soon, red for urgent/expired)
  - Suggestion to use expiring items in recipes
- **NEW: Barcode Scanner**
  - Scan product barcodes using camera
  - Auto-lookup product details via Open Food Facts API
  - OCR for reading expiry dates (Tesseract.js)
  - Manual entry option if barcode not found

#### Shopping List
- Auto-sync with low-stock inventory items
- Bilingual display
- Category-appropriate quantities
- CRUD operations

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
- **Barcode Scanning**: @zxing/browser
- **OCR**: Tesseract.js
- **Product Lookup**: Open Food Facts API

## Key API Endpoints
- `/api/inventory` - Inventory CRUD (now with expiry_date, barcode fields)
- `/api/barcode/{barcode}` - Product lookup from Open Food Facts
- `/api/recipes/search` - Local recipe search by ingredients
- `/api/preferences/favorite-channels` - GET/POST/DELETE favorites

---
*Last updated: January 27, 2025*
