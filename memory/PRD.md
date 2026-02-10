# Rasoi-Sync - Indian Kitchen Manager

## Overview
A mobile-first web application for intelligent Indian kitchen management with bilingual support (English/Hindi/Marathi) and **multi-user household synchronization**.

## Core Features

### ✅ Implemented

#### 👤 User Authentication & Household System - Added Feb 2, 2025
- **Email/Password Authentication**:
  - Sign up with email, password, name, home language, and city
  - Login with email/password
  - Password visibility toggle (show/hide)
  - Forgot password flow (reset via token)
  - JWT-based session tokens (7-day expiry)
  - Protected routes - redirects to /auth if not logged in

- **Household ("Kitchen") Management**:
  - Create a new kitchen → get unique 6-digit Kitchen Code
  - Join existing kitchen using shared code
  - Max 4 members per household
  - Users can belong to multiple households (home, hostel, etc.)
  - Switch between households via dropdown in header
  - Owner/Member roles with transfer ownership option
  - "Invite Family Member" dialog with copy-to-clipboard code
  - **Remove Family Member** - Added Feb 2, 2025
    - Owner can remove non-owner members from the household
    - Trash icon button next to each non-owner member
    - Confirmation dialog before removal
    - Removed member loses access to household data
  - **Delete Kitchen** - Added Feb 2, 2025
    - Owner can permanently delete kitchen after removing all other members
    - Deletes all associated data (inventory, shopping list, meal plans)
    - "Danger Zone" section in members dialog shows delete option
    - Blocked if other members exist (shows count of members to remove first)
  
- **Multi-Step Interactive Onboarding Flow** - Added Feb 2, 2025
  - **Guided Overlay (Spotlight)**: Dimmed background with focused modal
  - **4 Steps**: Welcome → Your Kitchen → Stock Pantry → Quick Tour
  - **Progress Indicator**: "Step 1 of 4" bar with step icons
  - **Culturally Warm Tone**: "Hello! 🙏", Dadi's Tips
  - **Language Selection**: English, Hindi, Marathi with flags
  - **City Selection**: For regional market/translation logic
  - **Household Setup**: Create new kitchen (get 6-digit code) or join existing
  - **Quick Pantry Setup**: Pre-selected common Indian items (Rice, Dal, Spices, Oils)
  - **Feature Tour**: Highlights Inventory, Shopping, Meal Planner, Digital Dadi
  - **Skip Option**: Users can skip and set up later
  - **Mobile-First**: Fully responsive design

- **Real-time Shopping Sync (SSE)**:
  - Shopping item status flow: **Pending → In-Cart → Bought**
  - "Claimed by" indicator prevents double-buying
  - SSE endpoint for live updates across devices
  - Mark as bought moves item to inventory automatically

- **Data Isolation**:
  - All inventory, shopping, and meal plan items linked to `household_id`
  - Users only see data for their active household
  - Switching households loads appropriate data

- **Basic Admin Dashboard**:
  - API quota monitoring (YouTube, Translation)
  - Translation moderation (approve/reject community suggestions)
  - Festival management for Digital Dadi alerts
  - Usage statistics dashboard

#### Google Cloud Translation API Integration - Added Jan 30, 2025
- **Live Translation**: Real-time translation using Google Cloud Translation API v3
- **Bilingual Display**: All items show "English / [Translation]" format
- **Language Selection**: Hindi (हिन्दी), Marathi (मराठी), English options
- **Full UI Translation**: App name, headers, buttons, labels, navigation - all translated
  - Header: App name "रसोई-सिंक", tagline, "Indian Kitchen" → "भारतीय रसोई/भारतीय स्वयंपाकघर"
  - Navigation: Home, Inventory, Planner, Shopping - all translated
  - Buttons: Add Item, Search, Filter, Save, Cancel, etc.
  - Labels: Stock levels, categories, empty states
- **Verification System**:
  - **AI Translated (Pending)**: Sparkle ✨ icon for new translations
  - **Looks Right Button**: Checkmark to verify translation is correct
  - **Community Verified (Gold)**: Badge when 100+ users verify a translation
  - **Dadi's Override**: Tap translation to edit with custom family term
- **Smart Caching**: Translations cached in MongoDB to reduce API calls
- **LanguageContext**: App-wide language state management with localStorage persistence

#### Inventory Management
- Bilingual item display (English/Hindi/Marathi)
- Card-based UI with category grouping
- Stock level filtering (Full, Half, Low, Empty)
- CRUD operations for items
- **Indian Pantry Template** for quick population - Enhanced Jan 31, 2025
  - 🛒 Grocery (किराणा): Grains, Pulses, Spices, Masalas, Oils, Fasting items
  - 🥕 Mandi (भाजी मंडई): Vegetables, Leafy veggies, Fruits
  - 🍞 Bakery & Ready Cook: Bread, Pasta, Pizza items
  - 🧹 **Cleaning & Household (सफाई)** - NEW
    - 🧼 Dish & Laundry Cleaning: Vim, Rin, Surf Excel, Ujala, Odopic, etc.
    - 🚿 Personal Care & Bath: Shampoo, Bath Soap, Hair Oil, Body Oil, etc.
    - 🚽 Bathroom & Floor Cleaning: Harpic, Phenyl, Lizol, Floor Cleaner
    - ✨ Other Essentials: Colin, Matchsticks, Garbage Bags, Foil, **Naphthalene Balls**, **Camphor (Kapoor)**
  - **Extended Grains & Millets** - Added Feb 2, 2025
    - Jowar (Sorghum), Bajra (Pearl Millet), Ragi (Finger Millet)
    - Barley, Oats, Quinoa, Buckwheat
    - Millets: Foxtail (Kangni), Little (Kutki), Kodo, Barnyard, Proso
    - Corn Flour (Makai Atta), Amaranth (Rajgira)
- **Expiry Date Tracking**
  - Optional expiry date for each item
  - "Items Expiring Soon!" alert banner (30-day threshold)
  - Visual warnings on item cards (amber for soon, red for urgent/expired)
  - Suggestion to use expiring items in recipes
  - **Update Expiry Date** - Added Feb 2, 2025
    - "Update" button on items with expiry dates (inline editing)
    - "Add expiry date" button for items without expiry dates
    - Useful when buying fresh stock to replace expired items
    - Clear expiry option to remove date entirely
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
- ✅ **Enhanced Add Shopping Item Dialog** - Added Feb 8, 2025
  - Two entry methods:
    1. **AI Scanning** (AI Powered) - Opens ShoppingBarcodeScanner with:
       - 📸 Take Photos: AI-powered product name & expiry date OCR (2-step flow)
       - Scan Barcode: Product lookup via Open Food Facts
       - Enter Manually: Direct data entry within scanner
    2. **Enter Manually** - Traditional form with item name, category, quantity
  - Back to options navigation within manual entry
  - Duplicate item detection with warning message
  - Category-based default quantities

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

#### Mobile-First Responsive UI - Enhanced Jan 29, 2025

##### Planner Calendar Redesign (Mobile 2x2 Grid)
- **Compact 2x2 Grid Layout**: All 4 meal slots (Breakfast, Lunch, Snacks, Dinner) visible at once
- **Color-Coded Slots**: Each meal type has distinct accent color (yellow, orange, pink, indigo)
- **Condensed Headers**: Short labels (Bfast, Lunch, Snack, Dinner) with time shown below
- **Meal Count Indicators**: Green badge showing number of planned meals
- **Thumbnail Previews**: First recipe thumbnail visible in collapsed state
- **Accordion Expansion**: Tap any slot to expand it to full width (col-span-2)
- **Add Recipe Button**: Appears in expanded state
- **Responsive Breakpoints**: Mobile (2x2 grid) at default, Desktop (4-column) at md: breakpoint

##### App Layout Fixes
- **min-w-0 on main element**: Prevents flex item from expanding beyond viewport width
- **overflow-x-hidden on App container**: Ensures no horizontal scrolling
- **flex-shrink-0 on sidebar**: Prevents sidebar from collapsing on desktop

##### Other Mobile Optimizations
- Bottom navigation bar with proper spacing
- Adaptive headers with mobile-first typography
- Single-column layouts for inventory and shopping pages
- FAB (Floating Action Button) for WhatsApp share on shopping page
- Mobile-friendly modals as bottom sheets

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
- **User-Submitted Videos** - Enhanced Jan 31, 2025
  - Paste any YouTube URL to save
  - Uses `videos.list` API (1 unit vs 100 for search)
  - Builds personal recipe collection
  - ✅ **Remove Video Feature**: Delete button (trash icon) to remove saved videos
    - Red circular delete button in top-right corner of video card
    - **Mobile**: Always visible (no hover needed)
    - **Desktop**: Shows on hover for cleaner UI
    - Calls `DELETE /api/youtube/user-videos/{video_id}`
    - Shows success toast notification
    - Instantly removes video from UI

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
- **YouTube API Quota**: Daily quota limits apply. Mitigated via cache-first architecture.

#### 👩‍🍳 User-Generated Recipe (UGR) Module - Added Feb 4, 2025
- **Smart Recipe Creator Form**:
  - Mobile-first recipe creation with title, chef name, story fields
  - Intelligent ingredient input with auto-suggestions from household inventory
  - Quantity and unit selection (g, kg, ml, L, cup, tbsp, tsp, piece, bunch, pinch)
  - Step-by-step instruction editor with numbered steps
  - Photo upload with preview
  - Tags selection (Quick Breakfast, Festival Special, Fasting, Grandma's Recipe, etc.)
  - "Publish to Community" option for sharing with all users
  
- **Inventory & Translation Bridge**:
  - Auto-translate recipe ingredients to Hindi and Marathi
  - Stock status badge shows "All ingredients in stock" / "Missing X items" / "X items running low"
  - Ingredient auto-complete from household inventory items
  - Links ingredients to inventory for real-time stock checking
  
- **Recipe-to-Stock Linking**:
  - Calculates ingredient availability from household inventory
  - Color-coded status: Green (all in stock), Yellow (low/missing few), Red (many missing)
  - "Add Missing to Shopping List" button adds unavailable ingredients
  
- **Household Recipe Feed**:
  - `/recipes` route shows household-specific recipe collection
  - Search and filter by tags
  - Recipe cards with stock status, metadata, ingredient preview
  - Tabs: "My Kitchen" (household recipes) and "Community" (published recipes)
  
- **Community Kitchen**:
  - Published recipes visible to all users
  - Like/favorite functionality
  - Recipe discovery across households
  
- **Real-Time Sharing (SSE)**:
  - Notify household members when new recipe is created
  - Instant updates across devices

#### 📺 Save YouTube Recipe Feature - Added Feb 4, 2025
- **Quick-Paste Input UI**:
  - Simple input field for YouTube URLs
  - Validates youtube.com, youtu.be, and Shorts links
  - Auto-fetches video metadata (thumbnail, title, channel, duration) using videos.list API (1 quota unit)
  
- **Ingredient Extractor (Local Logic)**:
  - Scans video title and description for Indian ingredient keywords
  - Cross-references with household inventory
  - Shows "Matches Your Pantry" preview before saving
  - Displays matched and missing ingredients
  
- **Household Sharing & Organization**:
  - Personal notes field (e.g., "Aai, this is exactly like the Dal you make!")
  - Auto-category detection from title (Breakfast, Maharashtrian, Quick Recipe, etc.)
  - Manual category/tag selection
  - Real-time sync via SSE to all household members
  
- **Add to Planner Bridge**:
  - Every YouTube recipe card has "Plan" button
  - Triggers standard add-to-planner flow with date picker
  - Marks detected ingredients as reserved

#### 🔧 Recipe Edit Functionality - Added Feb 4, 2025
- Edit button (pencil icon) appears on user's own recipes in detail view
- Opens RecipeCreator form with all fields pre-filled
- PUT /api/recipes/{id} updates recipe in database
- Stock status recalculated after update

#### 📱 Mobile UX Improvements - Added Feb 4, 2025
- Recipe form submit buttons fixed at bottom with z-index: 110
- Always visible and clickable on mobile devices
- Proper spacing to avoid overlap with content
- Spacer div added to prevent content hiding behind fixed buttons

### 🟠 Known Issues
- **YouTube API Quota**: Daily quota limits apply. Mitigated via cache-first architecture.

### 🟡 Pending Tasks (P1)
- ~~Translate "Minimum ingredients match:" text in PersonalizedRecipeStream.js~~ ✓ Fixed Feb 4, 2025
- Translate meal type labels (Breakfast, Lunch, Dinner, Snacks) in planner cards
- Voice input for adding inventory items

### 🔵 Backlog (P2)
- ~~Community Kitchen (user-submitted recipes)~~ ✓ Implemented Feb 4, 2025
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
- **Translation**: Google Cloud Translation API v3

## Admin Features
- **Admin Dashboard UI** - Added Feb 2, 2025
  - Route: `/admin` (accessible via purple "Admin" button in header)
  - Platform Statistics: Users, Households, Inventory Items, Translations
  - API Quota Monitoring: YouTube & Translation API usage with progress bars
  - Translation Moderation: Approve/reject pending community translations
  - Festival Calendar management
  - Admin Management section
  - Collapsible sections for clean UI
  - Refresh button to reload stats
  - Redirects non-admin users to homepage

## Key API Endpoints
- `/api/inventory` - Inventory CRUD (with expiry_date, barcode fields)
- `/api/shopping` - Shopping list CRUD (now with stock_level field)
- `/api/barcode/{barcode}` - Product lookup from Open Food Facts
- `/api/youtube-recipes/search` - Local recipe search by ingredients (renamed from /api/recipes)
- `/api/gap-analysis` - Compare meal plan vs inventory
- `/api/preferences/favorite-channels` - GET/POST/DELETE favorites
- `/api/translate` - Translate text to multiple languages (POST)
- `/api/translate/batch` - Batch translate multiple texts (POST)
- `/api/translate/verify` - User verifies a translation (POST)
- `/api/translate/edit` - User provides custom "Dadi Override" (POST)
- `/api/translate/community-verified` - Get all Gold translations (GET)
- `/api/households/create` - Create new household (POST)
- `/api/households/join` - Join household with kitchen code (POST)
- `/api/households/{id}/member/{member_id}` - Remove member from household (DELETE) - Added Feb 2, 2025
- **User-Generated Recipes (UGR)** - Added Feb 4, 2025:
  - `/api/recipes` - GET (list household recipes), POST (create recipe)
  - `/api/recipes/tags` - GET (list available recipe tags)
  - `/api/recipes/units` - GET (list available unit options)
  - `/api/recipes/suggest-ingredients` - GET (auto-suggest from inventory)
  - `/api/recipes/community` - GET (list published community recipes)
  - `/api/recipes/{id}` - GET (recipe details), PUT (update), DELETE (delete)
  - `/api/recipes/{id}/photo` - GET (recipe photo base64)
  - `/api/recipes/{id}/like` - POST (like a published recipe)
  - `/api/recipes/{id}/add-missing-to-shopping` - POST (add missing ingredients to shopping)
  - `/api/recipes/youtube` - POST (create YouTube-linked recipe) - Added Feb 4, 2025
- **YouTube Video Details** - Added Feb 4, 2025:
  - `/api/youtube/video-details/{video_id}` - GET (fetch video metadata using 1 quota unit)

## Data Models

### Inventory Item
```
{id, name_en, name_hi?, name_mr?, category, stock_level, expiry_date?, barcode?, created_at}
```

### Shopping Item
```
{id, name_en, name_hi?, name_mr?, category, quantity, stock_level?, monthly_quantity?, store_type, created_at}
```

### Translation Entry
```
{id, source_text, target_language, translated_text, is_ai_generated, user_verified, community_verified, user_verified_count, custom_labels: {user_id: custom_label}, created_at, updated_at}
```

### Meal Plan
```
{id, date, meal_type, meal_name, youtube_video_id?, youtube_thumbnail?, ingredients_needed[], created_at}
```

### YouTube Recipe (New - Feb 4, 2025)
```
{id, household_id, created_by, title, chef_name, story, ingredients[], instructions[], tags[], categories[], 
 recipe_type: 'youtube', youtube_video_id, youtube_url, youtube_thumbnail, youtube_channel, youtube_channel_id,
 youtube_duration, youtube_description, detected_ingredients[], matched_inventory_items[], personal_note,
 is_published, likes, created_at, updated_at}
```

## February 10, 2025 - Onboarding Flow Revamp

### New Streamlined Onboarding
**Problem Solved:** Previously, new users had to manually select items and then load templates. Now essentials are pre-loaded automatically.

**New Flow:**
1. User signs up → Welcome step (language/city selection)
2. Kitchen step → Create or Join kitchen
3. **Kitchen auto-populated with 22 essential items**
4. Ready step → "You're All Set!" with link to Inventory

**Backend Changes (`households.py`):**
- Added `ESSENTIALS_PACK` - 22 essential Indian kitchen items
- Added `populate_essentials()` function - auto-adds items when kitchen is created
- Updated `create_household` endpoint to:
  - Auto-populate inventory with essentials
  - Set `show_essentials_banner: True` flag on user
  - Return items_added count in response

**Essentials Pack (22 items):**
- **Grains (6):** Rice, Wheat Flour, Rava, Poha, Sugar, Jaggery
- **Spices (7):** Turmeric, Chili, Cumin, Coriander, Garam Masala, Mustard, Salt
- **Pulses (4):** Toor Dal, Moong Dal, Chana Dal, Masoor Dal
- **Oils (2):** Cooking Oil, Ghee
- **Dairy (2):** Milk, Curd
- **Beverages (1):** Tea Leaves

**Frontend Changes:**
- `OnboardingFlow.js` - Simplified to 3 steps (Welcome → Kitchen → Ready)
- `HomePage.js` - Added essentials banner for new users with "Go to Inventory" CTA

## February 10, 2025 - Bug Fixes

### Unit Display Fix for Oils Category
- Fixed: Items in "Oils & Condiments" category now correctly display **"L" (Liters)** instead of "kg"
- Updated `IndianPantryTemplate.js` to assign appropriate units based on category:
  - `oils` and `dairy` → `L` (Liters)
  - `household` and `bakery` → `pcs` (pieces)
  - All other categories → `kg` (kilograms)
- Added `household` and `cleaning` categories to `DEFAULT_MONTHLY` config in `InventoryPage.js`

### Verified Working Features
- **Delete button**: Working correctly - deletes items from inventory
- **Stock level filter**: Working correctly - clicking Full/Half/Low/Empty filters items

## Backend Refactoring - Added Feb 10, 2025

The backend `server.py` was refactored from 3600+ lines into a modular architecture:

### New Directory Structure
```
/app/backend/
├── server.py            # Main entry point (~200 lines)
├── models/              # Pydantic data models
│   ├── inventory.py     # InventoryItem, InventoryItemCreate
│   ├── shopping.py      # ShoppingItem, ShoppingItemCreate
│   ├── meal_plans.py    # MealPlan, MealPlanCreate
│   ├── translation.py   # TranslationRequest, TranslationEntry
│   ├── recipes.py       # Recipe, RecipeCreate
│   ├── preferences.py   # UserPreferences
│   └── common.py        # FestivalAlert, OCRRequest
│
├── data/                # Static data (no DB dependency)
│   ├── translations.py  # 65+ pre-verified Hindi/Marathi translations
│   ├── recipes.py       # 30+ local recipe database
│   ├── festivals.py     # Festival calendar
│   └── categories.py    # Category keywords for auto-categorization
│
├── services/            # Business logic services
│   ├── translation.py   # TranslationService (Google API + caching)
│   └── youtube.py       # YouTubeService (search, playlist, caching)
│
└── routes/              # API route handlers
    ├── inventory.py     # /api/inventory/* endpoints
    ├── shopping.py      # /api/shopping/* endpoints
    ├── meal_plans.py    # /api/meal-plans/* endpoints
    ├── translation.py   # /api/translate/* endpoints
    ├── youtube.py       # /api/youtube/* endpoints
    ├── preferences.py   # /api/preferences/* endpoints
    └── barcode.py       # /api/barcode/*, /api/ocr/* endpoints
```

### Benefits
- **Maintainability**: Each module has single responsibility
- **Testability**: Services and routes can be unit tested independently
- **Readability**: ~200 line entry point vs 3600+ lines
- **Reusability**: Models and services can be imported where needed

### Documentation
Full code architecture documentation available at `/app/docs/CODE_ARCHITECTURE.md`

## February 10, 2025 (Session 2) - Meal Planner Bug Fix

### Issue Fixed: Meal Planner Not Updating Immediately
**Problem:** When adding a recipe from "Cook with Your Stock" section (PersonalizedRecipeStream component), the meal planner did not update immediately - required a page refresh to see the newly added recipe.

**Root Cause:** `AddToPlannerModal.js` was being rendered in `PersonalizedRecipeStream.js` without passing the `addMealPlan` function from the `useMealPlanner` hook. This caused the modal to fall back to a direct `axios.post` call, which didn't update the shared React state.

**Fix Applied:**
1. Imported `useMealPlanner` hook in `PersonalizedRecipeStream.js`
2. Destructured `addMealPlan` from the hook
3. Passed `addMealPlan` as a prop to `AddToPlannerModal`

**Files Modified:**
- `/app/frontend/src/components/PersonalizedRecipeStream.js` (lines 8, 210, 350)

**Verification:** Testing agent confirmed 100% success rate - recipes now show "Planned" badge immediately and appear in calendar without page refresh.

---
*Last updated: February 10, 2025*
