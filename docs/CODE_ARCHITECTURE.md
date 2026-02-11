# Rasoi-Sync Code Architecture Documentation

## Overview

Rasoi-Sync is a full-stack Indian Kitchen Manager application built with:
- **Frontend**: React.js with Tailwind CSS and Shadcn UI components
- **Backend**: FastAPI (Python) with Motor (async MongoDB driver)
- **Database**: MongoDB

## High-Level Flow

```
┌─────────────┐     HTTPS      ┌─────────────────┐     MongoDB     ┌──────────┐
│   React     │ ────────────▶  │    FastAPI      │ ──────────────▶ │  MongoDB │
│   Frontend  │ ◀────────────  │    Backend      │ ◀────────────── │   Atlas  │
└─────────────┘    JSON API    └─────────────────┘    Motor Async  └──────────┘
      │                              │
      │                              │
      ▼                              ▼
┌─────────────┐              ┌─────────────────┐
│  Context    │              │  External APIs  │
│  Providers  │              │  - YouTube      │
│  - Auth     │              │  - Translation  │
│  - Language │              │  - Open Food    │
└─────────────┘              └─────────────────┘
```

## Backend Architecture (Post-Refactoring)

### Directory Structure

```
/app/backend/
├── server.py            # Main FastAPI app entry point (~200 lines)
├── auth.py              # Authentication module (JWT, signup, login)
├── households.py        # Household/kitchen management
├── realtime.py          # Server-Sent Events (SSE) for real-time sync
├── admin.py             # Admin features and API usage tracking
├── recipes.py           # Community recipe features
├── requirements.txt     # Python dependencies
├── .env                 # Environment variables (MONGO_URL, API keys)
│
├── models/              # Pydantic data models
│   ├── __init__.py      # Re-exports all models
│   ├── inventory.py     # InventoryItem, InventoryItemCreate
│   ├── shopping.py      # ShoppingItem, ShoppingItemCreate
│   ├── meal_plans.py    # MealPlan, MealPlanCreate
│   ├── translation.py   # TranslationRequest, TranslationEntry
│   ├── recipes.py       # Recipe, RecipeCreate
│   ├── preferences.py   # UserPreferences
│   └── common.py        # FestivalAlert, OCRRequest
│
├── data/                # Static data (no DB dependency)
│   ├── __init__.py      # Re-exports all data
│   ├── translations.py  # 65+ pre-verified Hindi/Marathi translations
│   ├── recipes.py       # 30+ local recipe database
│   ├── festivals.py     # Festival calendar with ingredient suggestions
│   └── categories.py    # Category keywords for auto-categorization
│
├── services/            # Business logic services
│   ├── __init__.py
│   ├── translation.py   # TranslationService (Google API + caching)
│   └── youtube.py       # YouTubeService (search, playlist, caching)
│
├── routes/              # API route handlers
│   ├── __init__.py      # Re-exports all routers
│   ├── inventory.py     # /api/inventory/* endpoints
│   ├── shopping.py      # /api/shopping/* endpoints
│   ├── meal_plans.py    # /api/meal-plans/* endpoints
│   ├── translation.py   # /api/translate/* endpoints
│   ├── youtube.py       # /api/youtube/* endpoints
│   ├── preferences.py   # /api/preferences/* endpoints
│   ├── barcode.py       # /api/barcode/*, /api/ocr/* endpoints
│   └── pantry_items.py  # /api/pantry-items/* endpoints (centralized data)
│
├── data/                # Static data files
│   ├── __init__.py      # Re-exports all data
│   ├── categories.py    # Category detection keywords
│   ├── festivals.py     # Festival calendar data
│   ├── recipes.py       # Recipe suggestions
│   ├── translations.py  # UI translations
│   └── pantry_items.py  # *** SINGLE SOURCE OF TRUTH for all pantry items ***
│
└── tests/               # Pytest test files
```

### Key Modules

#### 1. `server.py` - Entry Point
The main server file that:
- Initializes MongoDB connection
- Creates service instances (TranslationService, YouTubeService)
- Registers all routers from `/routes/`
- Configures CORS middleware
- Sets up database indexes on startup

#### 2. `auth.py` - Authentication
- JWT-based authentication with bcrypt password hashing
- Routes: `/api/auth/signup`, `/api/auth/login`, `/api/auth/me`
- Creates access tokens valid for 7 days
- `decode_token()` function used across all authenticated routes

#### 3. `households.py` - Kitchen Management
- Multi-user kitchen support with 6-digit kitchen codes
- Max 4 members per household
- Routes: `/api/households/create`, `/api/households/join`, `/api/households/switch`
- Uses `get_essentials_pack()` from `/data/pantry_items.py` to pre-populate new kitchens

#### 4. `realtime.py` - Real-time Sync
- Server-Sent Events (SSE) for live updates
- `notify_inventory_change()`, `notify_shopping_change()` functions
- Route: `/api/sse/stream` - clients connect to receive updates

#### 5. `data/pantry_items.py` - Centralized Pantry Data (NEW)
**SINGLE SOURCE OF TRUTH** for all pantry item definitions. Used by:
- Essentials Pack (households.py) - pre-populates new kitchens
- Indian Pantry Template (frontend) - fetches from `/api/pantry-items/template`
- Category auto-detection - consistent unit assignment

Key exports:
- `PANTRY_TEMPLATE`: Complete Indian pantry hierarchy
- `CATEGORY_UNITS`: Maps categories to correct units (e.g., "sweeteners" → "g")
- `get_essentials_pack()`: Returns essential items for new kitchen setup
- `get_pantry_template_for_frontend()`: Returns formatted data for frontend

### Route Module Pattern

Each route module follows this pattern:

```python
# routes/inventory.py
from fastapi import APIRouter

inventory_router = APIRouter(prefix="/api", tags=["Inventory"])

def create_inventory_routes(db, decode_token, translate_service, notify_func):
    """Factory function to inject dependencies"""
    
    @inventory_router.get("/inventory/household")
    async def get_household_inventory(...):
        # Implementation
        pass
    
    return inventory_router
```

## Frontend Architecture

### Directory Structure

```
/app/frontend/src/
├── App.js               # Main app with routing and auth flow
├── App.css              # Global styles
├── index.js             # React entry point
├── index.css            # Tailwind CSS imports
│
├── contexts/            # React Context providers
│   ├── AuthContext.js   # User auth state, login/logout, household
│   └── LanguageContext.js # Language selection (en/hi/mr)
│
├── hooks/               # Custom React hooks
│   ├── useRasoiSync.js  # Data fetching for inventory, shopping, meals
│   └── useRealtimeSync.js # SSE connection hook for real-time updates
│
├── pages/               # Page components (routes)
│   ├── AuthPage.js      # Login/Signup
│   ├── HomePage.js      # Dashboard with widgets
│   ├── InventoryPage.js # Pantry management
│   ├── ShoppingPage.js  # Shopping list
│   ├── PlannerPage.js   # Weekly meal planner
│   ├── RecipesPage.js   # Recipe discovery
│   ├── CommunityPage.js # Community features
│   └── AdminPage.js     # Admin dashboard
│
├── components/          # Reusable components
│   ├── OnboardingFlow.js      # New user setup wizard
│   ├── BarcodeScanner.js      # Camera barcode scanning
│   ├── IndianPantryTemplate.js # Quick pantry setup
│   ├── DigitalDadiWidget.js   # AI assistant widget
│   ├── TranslatedLabel.js     # Multi-language labels
│   └── ui/              # Shadcn UI components
│
└── lib/
    └── utils.js         # Utility functions (cn for classNames)
```

### Key Components

#### 1. `AuthContext.js` - Authentication State
```javascript
// Provides:
const { user, token, login, logout, household } = useAuth();

// Key state:
- user: Current user object
- token: JWT token
- household: Active household (kitchen)
- needsOnboarding: Boolean for new user flow
```

#### 2. `useRasoiSync.js` - Data Hook
```javascript
// Returns:
const { 
  inventory, shopping, mealPlans,
  addInventoryItem, addShoppingItem, addMealPlan,
  refetchInventory, refetchShopping, refetchMealPlans
} = useRasoiSync();

// CRITICAL: All fetches are scoped by household_id
// API calls include Authorization header with token
```

#### 3. `useRealtimeSync.js` - SSE Hook
```javascript
// Usage:
useRealtimeSync(householdId, (event) => {
  if (event.type === 'shopping_update') refetchShopping();
  if (event.type === 'inventory_update') refetchInventory();
});
```

## Data Flow Example: Adding a Shopping Item

### 1. User Action
User taps "Add Item" on ShoppingPage.js

### 2. Frontend
```javascript
// ShoppingPage.js
const handleAddItem = async (item) => {
  await fetch(`${API_URL}/api/shopping`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(item)
  });
};
```

### 3. Backend Route
```python
# routes/shopping.py
@shopping_router.post("/shopping")
async def create_shopping_item(item: ShoppingItemCreate, credentials):
    user = await get_user_from_token(credentials)
    household_id = user.get("active_household")
    
    # Create item with household_id
    shopping_item.household_id = household_id
    await db.shopping_list.insert_one(doc)
    
    # Notify other users via SSE
    await notify_shopping_change(household_id, "add", doc, user.name)
    
    return shopping_item
```

### 4. Real-time Update
```python
# realtime.py
async def notify_shopping_change(household_id, action, data, user_name):
    await broadcast_to_household(household_id, "shopping_update", {
        "action": action,
        "item": data,
        "by": user_name
    })
```

### 5. Other Users Receive Update
```javascript
// useRealtimeSync.js subscribes to /api/sse/stream
// On receiving 'shopping_update' event:
onEvent({ type: 'shopping_update', data: {...} });
// Parent component refetches shopping list
```

## Database Schema

### Collections

#### `users`
```javascript
{
  id: "uuid",
  email: "user@example.com",
  name: "User Name",
  hashed_password: "bcrypt_hash",
  home_language: "en", // "en", "hi", "mr"
  city: "Pune",
  households: ["household_id1", "household_id2"],
  active_household: "household_id1",
  onboarding_complete: true
}
```

#### `households`
```javascript
{
  id: "uuid",
  name: "My Kitchen",
  kitchen_code: "ABC123", // 6-digit code for joining
  created_by: "user_id",
  members: [
    { user_id: "...", name: "...", role: "owner", joined_at: Date }
  ]
}
```

#### `inventory`
```javascript
{
  id: "uuid",
  household_id: "household_uuid", // CRITICAL: Always filter by this
  name_en: "Rice",
  name_hi: "चावल",
  name_mr: "तांदूळ",
  category: "grains",
  stock_level: "full", // empty, low, half, full
  unit: "kg",
  expiry_date: "2026-03-15"
}
```

#### `shopping_list`
```javascript
{
  id: "uuid",
  household_id: "household_uuid",
  name_en: "Onion",
  category: "vegetables",
  quantity: "2 kg",
  shopping_status: "pending", // pending, in_cart, bought
  claimed_by: "user_id",
  claimed_by_name: "User Name"
}
```

#### `meal_plans`
```javascript
{
  id: "uuid",
  household_id: "household_uuid",
  date: "2026-02-10",
  meal_type: "lunch", // breakfast, lunch, snacks, dinner
  meal_name: "Dal Tadka",
  youtube_video_id: "NF7Eo30RBDA",
  ingredients_needed: ["Toor Dal", "Onion", "Tomato"]
}
```

## Critical Implementation Notes

### 1. Data Scoping (MUST DO)
**Every query involving user data MUST filter by `household_id`:**

```python
# CORRECT
items = await db.inventory.find({"household_id": household_id}, {"_id": 0}).to_list(1000)

# WRONG - Data leak vulnerability!
items = await db.inventory.find({}, {"_id": 0}).to_list(1000)
```

### 2. MongoDB ObjectId Serialization
Never return raw MongoDB documents with `_id`:

```python
# CORRECT
items = await db.inventory.find(query, {"_id": 0}).to_list(1000)

# WRONG - Will cause serialization error
items = await db.inventory.find(query).to_list(1000)
```

### 3. Authentication Flow
```
1. User logs in → receives JWT token
2. Token stored in localStorage
3. Every API call includes: Authorization: Bearer <token>
4. Backend decodes token to get user_id
5. User document contains active_household
6. All queries filtered by active_household
```

### 4. Real-time Updates Pattern
```
1. User A performs action (add/update/delete)
2. Backend broadcasts SSE event to household
3. User B's frontend receives event via useRealtimeSync
4. User B's component refetches data
5. UI updates automatically
```

## API Endpoints Summary

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/auth/signup` | POST | No | Create new user |
| `/api/auth/login` | POST | No | Get JWT token |
| `/api/households/create` | POST | Yes | Create kitchen |
| `/api/households/join` | POST | Yes | Join with code |
| `/api/inventory/household` | GET | Yes | Get pantry items |
| `/api/shopping` | GET/POST | Yes | Shopping list |
| `/api/meal-plans` | GET/POST | Yes | Meal planner |
| `/api/youtube/recommendations` | GET | No | Dadi's picks |
| `/api/stream/feed` | GET | Yes | Personalized recipes |
| `/api/translate` | POST | No | Translate text |
| `/api/barcode/{code}` | GET | No | Lookup product |
| `/api/sse/stream` | GET | Yes | SSE connection |

## Environment Variables

### Backend (`/app/backend/.env`)
```
MONGO_URL=mongodb://...
DB_NAME=rasoi_sync
YOUTUBE_API_KEY=...
GOOGLE_TRANSLATE_API_KEY=...
EMERGENT_LLM_KEY=...
JWT_SECRET_KEY=...
```

### Frontend (`/app/frontend/.env`)
```
REACT_APP_BACKEND_URL=https://...
```

## Testing

### Running Backend Tests
```bash
cd /app/backend
pytest tests/ -v
```

### Key Test Files
- `tests/test_inventory_stock_tracking.py`
- `tests/test_shopping_stock_level.py`
- `tests/test_recipes.py`
- `tests/test_translation_api.py`

## Common Issues & Solutions

### 1. "No active household" error
- User hasn't created or joined a kitchen
- Solution: Complete onboarding flow

### 2. Data not syncing between users
- Check SSE connection in browser DevTools
- Verify `notify_*_change()` is called in backend

### 3. Translation not working
- Check Google Translate API key
- Verify API quota hasn't exceeded

### 4. YouTube quota exceeded (429)
- App falls back to local recipe database
- Quota resets daily

## Future Enhancements (from PRD)

1. **Community Kitchen** - Publish recipes publicly
2. **Freshness Bar** - Visual indicator on inventory
3. **Mark Meal Complete** - Auto-deduct ingredients
4. **Voice Input** - Add items by voice
5. **Smart Notifications** - Low stock alerts
