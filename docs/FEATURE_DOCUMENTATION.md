# Rasoi-Sync - Complete Feature Documentation
## Intelligent Indian Kitchen Manager

**Document Version:** 1.0  
**Last Updated:** December 2025  
**Application Type:** Full-Stack Web Application (React + FastAPI + MongoDB)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Core Features](#2-core-features)
3. [User Management & Authentication](#3-user-management--authentication)
4. [Household & Kitchen Management](#4-household--kitchen-management)
5. [Inventory Management](#5-inventory-management)
6. [Shopping List Management](#6-shopping-list-management)
7. [Meal Planning](#7-meal-planning)
8. [Recipe Discovery & Management](#8-recipe-discovery--management)
9. [Digital Dadi - Festival Intelligence](#9-digital-dadi---festival-intelligence)
10. [Real-Time Synchronization](#10-real-time-synchronization)
11. [Multilingual Support](#11-multilingual-support)
12. [Barcode & OCR Scanning](#12-barcode--ocr-scanning)
13. [Admin Dashboard](#13-admin-dashboard)
14. [Technical Architecture](#14-technical-architecture)
15. [Third-Party Integrations](#15-third-party-integrations)
16. [Data Models](#16-data-models)
17. [API Endpoints Summary](#17-api-endpoints-summary)

---

## 1. Executive Summary

### 1.1 Application Purpose

**Rasoi-Sync** is a comprehensive kitchen management application designed specifically for Indian households. It combines inventory tracking, meal planning, recipe discovery, and cultural festival awareness to create an intelligent cooking companion.

### 1.2 Target Audience

- **Primary:** Indian families (nuclear and joint families)
- **Secondary:** Anyone interested in Indian cuisine and kitchen management
- **Tertiary:** Recipe content creators on YouTube

### 1.3 Key Value Propositions

| Value Proposition | Description |
|-------------------|-------------|
| **Cultural Relevance** | Built for Indian kitchens with local ingredients, festivals, and recipes |
| **Family Collaboration** | Multi-member household support with real-time sync |
| **Bilingual Support** | English, Hindi, and Marathi language support |
| **Smart Suggestions** | AI-powered recipe recommendations based on available ingredients |
| **Festival Intelligence** | Automated festival reminders with ingredient readiness checks |

---

## 2. Core Features

### 2.1 Feature Matrix

| Module | Feature | Status | Description |
|--------|---------|--------|-------------|
| **Authentication** | Email/Password Login | ✅ Active | JWT-based authentication |
| **Authentication** | Password Reset | ✅ Active | Token-based reset flow |
| **Households** | Create Kitchen | ✅ Active | 6-digit unique kitchen codes |
| **Households** | Join Kitchen | ✅ Active | Share codes with family members |
| **Households** | Switch Kitchens | ✅ Active | Users can belong to multiple households |
| **Inventory** | Stock Tracking | ✅ Active | Full/Half/Low/Empty status |
| **Inventory** | Expiry Tracking | ✅ Active | Alerts for expiring items |
| **Inventory** | Barcode Scanning | ✅ Active | Open Food Facts API integration |
| **Inventory** | OCR Product Name | ✅ Active | AI-powered text extraction |
| **Shopping** | Smart Lists | ✅ Active | Auto-generated from low stock |
| **Shopping** | WhatsApp Sharing | ✅ Active | Export list to WhatsApp |
| **Shopping** | Mark as Purchased | ✅ Active | Auto-updates inventory |
| **Meal Planner** | Weekly Calendar | ✅ Active | 7-day meal planning |
| **Meal Planner** | Recipe Search | ✅ Active | Local database + YouTube |
| **Meal Planner** | Ingredient Reservation | ✅ Active | Reserve inventory for meals |
| **Recipes** | Local Database | ✅ Active | 30+ pre-loaded Indian recipes |
| **Recipes** | YouTube Discovery | ✅ Active | Search and save YouTube recipes |
| **Recipes** | Cook with Your Stock | ✅ Active | Personalized feed from favorites |
| **Digital Dadi** | Festival Calendar | ✅ Active | Admin CSV upload |
| **Digital Dadi** | Festival Reminders | ✅ Active | Ingredient readiness checks |
| **Digital Dadi** | Cooking Tips | ✅ Active | Daily tips in selected language |
| **Real-Time** | SSE Sync | ✅ Active | Live updates across devices |
| **Translation** | Multi-language | ✅ Active | EN/HI/MR support |
| **Admin** | API Monitoring | ✅ Active | Quota tracking dashboard |

---

## 3. User Management & Authentication

### 3.1 User Registration

**Endpoint:** `POST /api/auth/signup`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Yes | Unique email address |
| password | string | Yes | Minimum 6 characters |
| name | string | Yes | Display name |
| home_language | string | No | en/hi/mr (default: en) |
| city | string | No | User's city (default: Pune) |

**Features:**
- Bcrypt password hashing
- JWT token generation (7-day expiry)
- Automatic onboarding flow for new users

### 3.2 User Login

**Endpoint:** `POST /api/auth/login`

- Email/password validation
- Returns JWT token + user profile
- Session management via tokens

### 3.3 Password Management

| Feature | Endpoint | Description |
|---------|----------|-------------|
| Forgot Password | `POST /api/auth/forgot-password` | Generates reset token (1-hour expiry) |
| Reset Password | `POST /api/auth/reset-password` | Validates token and updates password |
| Change Password | `POST /api/auth/change-password` | Requires current password verification |

### 3.4 Profile Management

**Endpoint:** `PUT /api/auth/profile`

Updatable fields:
- `name` - Display name
- `home_language` - Preferred language
- `city` - Location
- `active_household` - Currently selected kitchen

---

## 4. Household & Kitchen Management

### 4.1 Household Creation

**Endpoint:** `POST /api/households/create`

**Process:**
1. User provides kitchen name (e.g., "Sharma Family Kitchen")
2. System generates unique 6-digit alphanumeric code
3. Creator automatically becomes "owner"
4. 60+ essential pantry items auto-populated

**Auto-Loaded Essentials Pack:**
- Grains: Basmati Rice, Wheat Flour, Rava, Poha, etc.
- Pulses: Toor Dal, Moong Dal, Chana Dal, etc.
- Spices: Turmeric, Red Chili, Cumin, Garam Masala, etc.
- Oils: Sunflower Oil, Ghee, Mustard Oil
- And more across 13 categories

### 4.2 Household Joining

**Endpoint:** `POST /api/households/join`

- Users enter 6-digit kitchen code
- Maximum 4 members per household
- Onboarding marked complete upon joining

### 4.3 Member Management

| Feature | Description |
|---------|-------------|
| **Max Members** | 4 per household |
| **Roles** | Owner, Member |
| **Switch Households** | Users can belong to multiple kitchens |
| **Transfer Ownership** | Owner can transfer to another member |
| **Remove Member** | Owner can remove members |
| **Leave Kitchen** | Members (non-owners) can leave voluntarily |

### 4.4 Household Data Isolation

Each household has isolated:
- Inventory items
- Shopping lists
- Meal plans
- Preferences

---

## 5. Inventory Management

### 5.1 Inventory Item Schema

```javascript
{
  id: "uuid",
  household_id: "uuid",
  name_en: "Basmati Rice",
  name_mr: "बासमती तांदूळ",
  name_hi: "बासमती चावल",
  category: "grains",
  stock_level: "full|half|low|empty",
  current_stock: 2000,  // in grams or ml
  monthly_quantity: 5000,
  monthly_unit: "g",
  expiry_date: "2025-03-15",
  is_secret_stash: false,
  barcode: "8901030835636",
  created_at: "ISO timestamp"
}
```

### 5.2 Stock Level Calculation

Stock levels are dynamically calculated:

| Level | Percentage of Monthly Need |
|-------|---------------------------|
| **Full** | > 75% |
| **Half** | 26-75% |
| **Low** | 1-25% |
| **Empty** | 0% |

### 5.3 Category System

| Category | Icon | Example Items |
|----------|------|---------------|
| grains | 🌾 | Rice, Wheat Flour, Rava |
| pulses | 🫘 | Toor Dal, Moong Dal, Rajma |
| spices | 🌶️ | Turmeric, Cumin, Garam Masala |
| vegetables | 🧅 | Onion, Tomato, Potato |
| fruits | 🍎 | Apple, Banana, Mango |
| dairy | 🥛 | Milk, Curd, Paneer |
| oils | 🧴 | Sunflower Oil, Ghee |
| bakery | 🍞 | Bread, Pav |
| fasting | 🔱 | Sabudana, Singoda Atta |
| snacks | 🥣 | Poha Mix, Upma Mix |
| beverages | ☕ | Tea, Coffee |
| household | 🧹 | Dish Soap, Detergent |
| other | 📦 | Miscellaneous items |

### 5.4 Expiry Date Management

**Expiry Status Indicators:**
- 🔴 **Expired:** Item has passed expiry date
- 🟠 **Expiring Today:** Expires within 24 hours
- 🟡 **Expiring Soon:** Within 30 days
- ⚪ **OK:** More than 30 days until expiry

**Features:**
- Visual alerts on inventory page
- Expiry alerts card showing items needing attention
- Edit expiry dates inline
- Recipe suggestions to use expiring items

### 5.5 Indian Pantry Template

Pre-built template of 200+ common Indian kitchen items across all categories. Users can:
- Browse by category
- Add items with one click
- Items include translations in Hindi and Marathi

---

## 6. Shopping List Management

### 6.1 Shopping List Item Schema

```javascript
{
  id: "uuid",
  household_id: "uuid",
  name_en: "Onion",
  name_mr: "कांदा",
  name_hi: "प्याज",
  category: "vegetables",
  quantity: "-",
  monthly_quantity: "1 kg",
  store_type: "grocery|mandi",
  shopping_status: "pending|in_cart|bought",
  claimed_by: "user_id",
  claimed_by_name: "Rahul",
  bought_at: "ISO timestamp",
  notes: "For festival preparation",
  expiry_date: null
}
```

### 6.2 Store Types

| Type | Description | Categories |
|------|-------------|------------|
| **Grocery** | General store items | Grains, pulses, spices, dairy, etc. |
| **Mandi** | Fresh produce market | Vegetables, fruits |

### 6.3 Smart Features

1. **Auto-Sync from Inventory:**
   - Automatically adds low/empty stock items
   - One-click sync button
   - Duplicate prevention

2. **Category-Based Quantity Presets:**
   - Grains: 100g to 10kg
   - Spices: 25g to 500g
   - Dairy: 250ml to 5L
   - Custom quantity input supported

3. **WhatsApp Integration:**
   - Generate formatted shopping list
   - Share with family via WhatsApp
   - Bilingual item names included

### 6.4 Purchase Flow

1. **Add to Shopping List** → Status: `pending`
2. **Set Quantity** → Select preset or custom
3. **Add Expiry Date** (optional) → For fresh items
4. **Mark as Purchased** → Auto-creates/updates inventory item
   - Existing inventory: Adds to current stock
   - New item: Creates inventory entry with full stock

### 6.5 Real-Time Collaboration

- **Claim System:** Family members can claim items ("I'm buying this")
- **Status Sync:** Live updates when someone purchases an item
- **Toast Notifications:** "Rahul purchased Onion"

---

## 7. Meal Planning

### 7.1 Weekly Calendar View

- 7-day rolling calendar (today + 6 days)
- 4 meal slots per day:
  - 🌅 Breakfast (7:00 AM)
  - 🌞 Lunch (12:30 PM)
  - ☕ Snacks (5:00 PM)
  - 🌙 Dinner (8:00 PM)
- Auto-scroll to today's date
- Mobile-optimized compact view

### 7.2 Meal Plan Schema

```javascript
{
  id: "uuid",
  household_id: "uuid",
  date: "2025-01-15",
  meal_type: "dinner",
  meal_name: "Pav Bhaji",
  youtube_video_id: "eJlZW7keg5I",
  youtube_thumbnail: "https://...",
  youtube_channel: "MadhurasRecipe Marathi",
  ingredients_needed: ["Potato", "Cauliflower", "Peas"],
  reserved_ingredients: [
    { item_id: "uuid", item_name: "Potato", est_qty: 500, unit: "g" }
  ],
  serving_size: "family_4",
  created_at: "ISO timestamp"
}
```

### 7.3 Recipe Discovery Modes

| Mode | Source | API Cost |
|------|--------|----------|
| **Text Search** | Local database | 0 units |
| **Ingredient Search** | Local database | 0 units |
| **YouTube Discovery** | YouTube API | 100 units/search |
| **Cook with Your Stock** | Playlist cache | 1 unit/playlist |

### 7.4 Cook with Your Stock (Personalized Feed)

**How it works:**
1. User adds favorite YouTube cooking channels
2. System fetches recent videos from channel playlists
3. Video titles/descriptions matched against user's inventory
4. Results sorted by ingredient match percentage

**Caching Strategy:**
- Channel info: 7-day cache
- Playlist videos: 6-hour cache
- Prevents API quota exhaustion

### 7.5 Ingredient Reservation System

When a meal is planned:
1. User selects ingredients from their inventory
2. Quantities are estimated based on serving size
3. Reserved ingredients are tagged to the meal plan
4. Inventory shows "Reserved for [Meal]" indicators

When meal is deleted:
- Reserved quantities released back to inventory
- User notified of released items

### 7.6 Serving Size Options

| Size | Multiplier | Label |
|------|------------|-------|
| single | 0.25x | 1 person |
| couple | 0.5x | 2 people |
| family_4 | 1.0x | 4 people |
| party | 2.0x | 8+ people |

---

## 8. Recipe Discovery & Management

### 8.1 Local Recipe Database

**File:** `/app/backend/data/recipes.py`

Contains 30+ pre-loaded Indian recipes:

| Recipe | Category | Type |
|--------|----------|------|
| Vegetable Pulao | Main Course | Video |
| Dal Tadka | Main Course | Video |
| Aloo Gobi | Main Course | Video |
| Palak Paneer | Main Course | Video |
| Kanda Poha | Breakfast | Video |
| Rava Upma | Breakfast | Video |
| Masala Dosa | Breakfast | Video |
| Vada Pav | Snacks | Video |
| Pav Bhaji | Snacks | Video |
| Gajar Ka Halwa | Dessert | Video |
| ... and more | | |

### 8.2 Recipe Schema

```javascript
{
  id: "veg-pulao-1",
  title: "Vegetable Pulao",
  title_mr: "भाजी पुलाव",
  source: "Madhura's Recipe Marathi",
  type: "video",
  video_id: "4xzt4Itmp2U",
  thumbnail: "https://i.ytimg.com/vi/.../hqdefault.jpg",
  ingredients: ["Basmati Rice", "Onion", "Potato", "Peas"],
  prep_time: "15 min",
  cook_time: "25 min",
  servings: 4,
  category: "Main Course"
}
```

### 8.3 User-Generated Recipes (UGR)

Users can create their own recipes with:
- Custom ingredients with quantities
- Step-by-step instructions
- Family story/heritage notes
- Photo upload (base64)
- Tags: Quick Breakfast, Festival Special, Grandma's Recipe, etc.
- Publish to community (optional)

### 8.4 YouTube Recipe Saver

Save any YouTube cooking video to personal cookbook:
- Auto-extract video details
- AI-detected ingredients from description
- Match against user's inventory
- Personal notes

### 8.5 Favorite Channels

Users can add favorite YouTube cooking channels:
- Recipes from favorites appear first in search
- Personalized feed from channel uploads
- Popular suggestions: Ranveer Brar, Hebbars Kitchen, MadhurasRecipe

---

## 9. Digital Dadi - Festival Intelligence

### 9.1 Overview

"Digital Dadi" (Digital Grandmother) provides cultural context and cooking guidance for Indian festivals.

### 9.2 Festival Schema

```javascript
{
  id: "uuid",
  name: "Ganesh Chaturthi",
  name_mr: "गणेश चतुर्थी",
  name_hi: "गणेश चतुर्थी",
  date: "Sep 07",
  significance: "Birthday of Lord Ganesha",
  key_ingredients: ["Modak", "Coconut", "Jaggery", "Rice Flour"],
  recipes: ["Ukadiche Modak", "Puran Poli"],
  tips: ["Prepare modak filling a day before"],
  is_fasting_day: false,
  region: "Maharashtra"
}
```

### 9.3 Festival Calendar Management

**Admin Features:**
- CSV upload for bulk festival data
- Manual add/edit/delete entries
- Region-based filtering

**CSV Columns:**
- Festival Name, Name (Marathi), Name (Hindi)
- Date, Significance
- Key Ingredients (comma-separated)
- Recipes, Tips, Is Fasting Day, Region

### 9.4 Upcoming Festival Alerts

**Endpoint:** `GET /api/dadi/upcoming`

**Features:**
1. Looks ahead 14 days
2. Checks user's inventory against festival ingredients
3. Calculates "Readiness Score" (% ingredients in stock)
4. Lists missing ingredients
5. One-click "Add to Shopping List" for missing items

**Response Example:**
```json
{
  "upcoming": [
    {
      "name": "Diwali",
      "date": "2025-11-12",
      "days_until": 5,
      "readiness_score": 75,
      "missing_ingredients": ["Mawa", "Kesar"],
      "ingredient_status": [
        { "name": "Sugar", "status": "in_stock" },
        { "name": "Ghee", "status": "low" },
        { "name": "Mawa", "status": "missing" }
      ]
    }
  ]
}
```

### 9.5 Tip of the Day

**Endpoint:** `GET /api/dadi/tip-of-day?lang=mr`

- Returns random cooking tip
- Language-specific (EN/HI/MR)
- Tips from festivals + general cooking wisdom

**Example Tips:**
- "Always taste your food while cooking to adjust seasonings"
- "Use jaggery instead of sugar for authentic Maharashtrian taste"
- "Roast spices before grinding for more aromatic flavor"

---

## 10. Real-Time Synchronization

### 10.1 Server-Sent Events (SSE)

**Endpoint:** `GET /api/sse/stream?token=<jwt>`

Real-time updates for:
- Inventory changes (add/update/delete)
- Shopping list changes
- Shopping item status (pending → in_cart → bought)
- Meal plan updates
- Member join/leave notifications

### 10.2 Event Types

| Event | Trigger | Data |
|-------|---------|------|
| `inventory_add` | New item added | Item details |
| `inventory_update` | Stock level changed | Updated fields |
| `inventory_delete` | Item removed | Item ID |
| `shopping_add` | Item added to list | Item details |
| `shopping_status` | Status changed | New status, claimed_by |
| `meal_plan_update` | Meal added/removed | Meal details |
| `member_online` | Member connected | User name |

### 10.3 Keep-Alive

- 30-second ping interval
- Automatic reconnection on disconnect
- Connection count tracking per household

---

## 11. Multilingual Support

### 11.1 Supported Languages

| Code | Language | Native Name |
|------|----------|-------------|
| `en` | English | English |
| `hi` | Hindi | हिन्दी |
| `mr` | Marathi | मराठी |

### 11.2 Translation Service

**Google Cloud Translation API v3**

Features:
- On-demand translation of ingredient names
- 24-hour translation cache
- API usage tracking

### 11.3 UI Labels

All UI text is translated:
- Navigation items
- Button labels
- Placeholder text
- Status messages
- Error messages

### 11.4 Bilingual Display

Items display both English and regional language:
```
Basmati Rice
बासमती तांदूळ
```

---

## 12. Barcode & OCR Scanning

### 12.1 Barcode Lookup

**Endpoint:** `GET /api/barcode/{barcode}`

**Source:** Open Food Facts API

**Returns:**
- Product name
- Brand
- Category
- Quantity/Size
- Nutriscore
- Image URL

### 12.2 AI-Powered OCR

**Endpoint:** `POST /api/ocr/extract`

**Powered by:** OpenAI GPT-4 Vision (via Emergent LLM Key)

**OCR Types:**
1. ** Extraction**
   - Reads text from product packaging
   - Returns suggested category

2. **Expiry Date Extraction**
   - Finds "Best Before" / "Exp" dates
   - Returns standardized YYYY-MM-DD format

---

## 13. Admin Dashboard

### 13.1 API Quota Monitoring

**Endpoint:** `GET /api/admin/api-usage`

Tracks:
- YouTube API units (daily limit: 10,000)
- Translation API characters (daily limit: 500,000)
- Per-household usage breakdown
- Daily trends

### 13.2 Usage Alerts

**Endpoint:** `GET /api/admin/api-usage/alerts`

Alerts when:
- YouTube API > 80% daily quota
- Individual household > 500 units/day

### 13.3 Translation Moderation

Admins can:
- Review user-verified translations
- Approve/reject community translations
- Globalize approved translations

### 13.4 Festival Management

Full CRUD for festival calendar:
- Create single entries
- Bulk CSV upload
- Edit existing festivals
- Delete festivals

### 13.5 Dashboard Statistics

**Endpoint:** `GET /api/admin/dashboard`

- Total users / New this week
- Total households / New this week
- Total inventory items
- Translation statistics
- Upcoming festivals

---

## 14. Technical Architecture

### 14.1 Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Tailwind CSS, Shadcn/UI |
| **Backend** | FastAPI (Python 3.11) |
| **Database** | MongoDB (Motor async driver) |
| **Authentication** | JWT (PyJWT + Jose) |
| **Real-Time** | Server-Sent Events |
| **Deployment** | Docker, Kubernetes |

### 14.2 Directory Structure

```
/app/
├── backend/
│   ├── server.py           # Main entry point
│   ├── auth.py             # Authentication
│   ├── households.py       # Household management
│   ├── recipes.py          # User-generated recipes
│   ├── realtime.py         # SSE implementation
│   ├── admin.py            # Admin dashboard
│   ├── routes/
│   │   ├── inventory.py    # Inventory CRUD
│   │   ├── shopping.py     # Shopping list
│   │   ├── meal_plans.py   # Meal planning
│   │   ├── youtube.py      # YouTube integration
│   │   ├── dadi.py         # Digital Dadi
│   │   ├── barcode.py      # Barcode/OCR
│   │   ├── translation.py  # Translation
│   │   └── preferences.py  # User preferences
│   ├── services/
│   │   ├── youtube.py      # YouTube API service
│   │   └── translation.py  # Google Translate
│   ├── data/
│   │   ├── recipes.py      # Local recipe database
│   │   ├── pantry_items.py # Pantry template
│   │   ├── festivals.py    # Static festival data
│   │   └── categories.py   # Category definitions
│   └── models/             # Pydantic models
├── frontend/
│   └── src/
│       ├── pages/          # Page components
│       ├── components/     # Reusable components
│       ├── contexts/       # React contexts
│       ├── hooks/          # Custom hooks
│       └── components/ui/  # Shadcn components
```

### 14.3 Database Collections

| Collection | Purpose |
|------------|---------|
| `users` | User accounts |
| `households` | Kitchen groups |
| `inventory` | Pantry items |
| `shopping_list` | Shopping items |
| `meal_plans` | Planned meals |
| `user_recipes` | User-created recipes |
| `festivals` | Festival calendar |
| `preferences` | User/household preferences |
| `translation_cache` | Cached translations |
| `api_usage` | API quota tracking |
| `search_cache` | YouTube search cache |
| `channel_info_cache` | Channel metadata cache |
| `playlist_video_cache` | Playlist video cache |
| `password_resets` | Reset tokens |

---

## 15. Third-Party Integrations

### 15.1 YouTube Data API v3

**Purpose:** Recipe video discovery

**Endpoints Used:**
- `search.list` - Recipe search (100 units)
- `videos.list` - Video details (1 unit)
- `channels.list` - Channel info (1 unit)
- `playlistItems.list` - Playlist videos (1 unit)

**Daily Quota:** 10,000 units

### 15.2 Google Cloud Translation API v3

**Purpose:** Multilingual ingredient names

**Languages:** EN ↔ HI ↔ MR

**Caching:** 24-hour TTL

### 15.3 Open Food Facts API

**Purpose:** Barcode product lookup

**Cost:** Free, no API key required

### 15.4 OpenAI GPT-4 Vision (via Emergent LLM Key)

**Purpose:** OCR for product names and expiry dates

**Model:** gpt-4o

### 15.5 Framer Motion

**Purpose:** UI animations

---

## 16. Data Models

### 16.1 User Model

```python
class User:
    id: str
    email: str
    name: str
    hashed_password: str
    home_language: str  # en/hi/mr
    city: str
    households: List[str]  # Household IDs
    active_household: Optional[str]
    is_admin: bool
    onboarding_complete: bool
    created_at: datetime
```

### 16.2 Household Model

```python
class Household:
    id: str
    name: str
    kitchen_code: str  # 6-char code
    created_by: str  # Owner user ID
    members: List[HouseholdMember]
    settings: Dict
    created_at: datetime
```

### 16.3 Inventory Item Model

```python
class InventoryItem:
    id: str
    household_id: str
    name_en: str
    name_mr: Optional[str]
    name_hi: Optional[str]
    category: str
    stock_level: str  # full/half/low/empty
    current_stock: int  # grams or ml
    monthly_quantity: int
    monthly_unit: str
    expiry_date: Optional[str]
    is_secret_stash: bool
    barcode: Optional[str]
    reserved_for: List[Dict]
    created_at: datetime
```

### 16.4 Shopping Item Model

```python
class ShoppingItem:
    id: str
    household_id: str
    name_en: str
    name_mr: Optional[str]
    name_hi: Optional[str]
    category: str
    quantity: str
    monthly_quantity: Optional[str]
    store_type: str  # grocery/mandi
    shopping_status: str  # pending/in_cart/bought
    claimed_by: Optional[str]
    claimed_by_name: Optional[str]
    bought_at: Optional[datetime]
    notes: Optional[str]
    expiry_date: Optional[str]
    created_at: datetime
```

### 16.5 Meal Plan Model

```python
class MealPlan:
    id: str
    household_id: str
    date: str  # YYYY-MM-DD
    meal_type: str  # breakfast/lunch/snacks/dinner
    meal_name: str
    youtube_video_id: Optional[str]
    youtube_thumbnail: Optional[str]
    youtube_channel: Optional[str]
    ingredients_needed: List[str]
    reserved_ingredients: List[Dict]
    serving_size: str
    created_at: datetime
```

---

## 17. API Endpoints Summary

### 17.1 Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Register new user |
| POST | `/api/auth/login` | User login |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/forgot-password` | Request reset token |
| POST | `/api/auth/reset-password` | Reset password |
| POST | `/api/auth/change-password` | Change password |
| PUT | `/api/auth/profile` | Update profile |
| POST | `/api/auth/complete-onboarding` | Mark onboarding done |

### 17.2 Households

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/households/create` | Create new kitchen |
| POST | `/api/households/join` | Join with code |
| GET | `/api/households/my-households` | List user's kitchens |
| GET | `/api/households/{id}` | Get household details |
| POST | `/api/households/{id}/switch` | Switch active kitchen |
| POST | `/api/households/{id}/leave` | Leave kitchen |
| DELETE | `/api/households/{id}` | Delete kitchen |
| PUT | `/api/households/{id}/settings` | Update settings |
| POST | `/api/households/{id}/transfer-ownership` | Transfer owner |
| DELETE | `/api/households/{id}/member/{user_id}` | Remove member |

### 17.3 Inventory

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/inventory/household` | Get household inventory |
| POST | `/api/inventory/household` | Add item |
| PUT | `/api/inventory/{id}` | Update item |
| DELETE | `/api/inventory/{id}` | Delete item |
| GET | `/api/inventory/monthly-defaults` | Get quantity defaults |
| PUT | `/api/inventory/{id}/monthly-quantity` | Update monthly qty |
| GET | `/api/inventory/reservations` | Get with reservations |

### 17.4 Shopping

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/shopping` | Get shopping list |
| POST | `/api/shopping` | Add item |
| PUT | `/api/shopping/{id}` | Update item |
| DELETE | `/api/shopping/{id}` | Delete item |
| PUT | `/api/shopping/{id}/status` | Update status |
| POST | `/api/shopping/{id}/claim` | Claim item |
| POST | `/api/shopping/{id}/unclaim` | Release claim |
| POST | `/api/shopping/{id}/mark-bought` | Mark purchased |

### 17.5 Meal Plans

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/meal-plans` | Get meal plans |
| POST | `/api/meal-plans` | Create meal plan |
| DELETE | `/api/meal-plans/{id}` | Delete meal plan |
| POST | `/api/meal-plans/prepare` | Prepare modal data |
| GET | `/api/meal-plans/suggestions` | Get suggestions |
| GET | `/api/meal-plans/check/{video_id}` | Check if planned |
| GET | `/api/gap-analysis` | Get missing ingredients |

### 17.6 YouTube & Recipes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/youtube/search` | Search YouTube |
| GET | `/api/youtube-recipes/search` | Search local DB |
| GET | `/api/youtube/recommendations` | Dadi's picks |
| GET | `/api/youtube/video-details/{id}` | Video details |
| POST | `/api/youtube/add-video` | Save video |
| GET | `/api/youtube/user-videos` | User's saved videos |
| GET | `/api/stream/channels` | Favorite channels |
| GET | `/api/stream/feed` | Personalized feed |
| POST | `/api/stream/refresh` | Refresh cache |

### 17.7 Digital Dadi

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dadi/festivals` | List festivals |
| POST | `/api/dadi/festivals` | Add festival |
| PUT | `/api/dadi/festivals/{id}` | Update festival |
| DELETE | `/api/dadi/festivals/{id}` | Delete festival |
| POST | `/api/dadi/festivals/upload` | CSV upload |
| GET | `/api/dadi/upcoming` | Upcoming festivals |
| POST | `/api/dadi/add-missing-to-shopping` | Add missing items |
| GET | `/api/dadi/tip-of-day` | Daily tip |

### 17.8 Other

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/barcode/{code}` | Barcode lookup |
| POST | `/api/ocr/extract` | OCR extraction |
| GET | `/api/translate` | Translate text |
| GET | `/api/pantry-items/template` | Get pantry template |
| GET | `/api/preferences` | Get preferences |
| PUT | `/api/preferences` | Update preferences |
| GET | `/api/sse/stream` | SSE connection |
| GET | `/api/festival-alert` | Festival alert |

### 17.9 Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/dashboard` | Dashboard stats |
| GET | `/api/admin/api-usage` | API usage stats |
| GET | `/api/admin/api-usage/alerts` | Usage alerts |
| GET | `/api/admin/translations/pending` | Pending translations |
| POST | `/api/admin/translations/{id}/approve` | Approve translation |
| POST | `/api/admin/translations/{id}/reject` | Reject translation |
| GET | `/api/admin/festivals` | List festivals |
| POST | `/api/admin/make-admin/{user_id}` | Grant admin |

---

## Document Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Dec 2025 | Initial comprehensive documentation |

---

*This document is auto-generated and maintained as part of the Rasoi-Sync project documentation.*
