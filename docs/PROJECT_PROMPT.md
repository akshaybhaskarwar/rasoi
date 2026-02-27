# Rasoi-Sync - Detailed Project Prompt

## Project Overview

**Name:** Rasoi-Sync (रसोई-सिंक)  
**Tagline:** Intelligent Indian Kitchen Manager  
**Type:** Full-Stack Web Application (PWA-ready)

---

## Problem Statement

Indian households face unique challenges in kitchen management:

1. **Inventory Chaos:** Families struggle to track 50+ pantry items across grains, spices, pulses, oils, and more
2. **Festival Preparation:** Forgetting key ingredients before festivals (Diwali sweets need mawa, Ganesh Chaturthi needs modak ingredients)
3. **Recipe Discovery:** Finding recipes that match available ingredients without YouTube searches
4. **Family Coordination:** Multiple family members shopping without knowing what's already bought
5. **Language Barriers:** Older family members prefer regional languages (Hindi/Marathi) over English
6. **Expiry Tracking:** Spices and packaged items expiring without notice
7. **Monthly Planning:** Not knowing how much rice, dal, or oil is needed per month

---

## Solution

Rasoi-Sync is an intelligent kitchen management app built specifically for Indian households that:

- Tracks inventory with culturally-relevant categories (Upvas/Fasting items, Indian spices, dals)
- Provides festival-aware reminders ("Diwali in 5 days - you're missing Mawa and Kesar")
- Suggests recipes based on what's in your kitchen
- Enables real-time family collaboration on shopping lists
- Supports bilingual interface (English + Hindi/Marathi)
- Integrates YouTube Indian cooking channels for video recipes

---

## Target Users

### Primary Persona: The Family Kitchen Manager
- **Age:** 30-55 years
- **Role:** Primary person responsible for household cooking/groceries
- **Pain Points:** Forgetting items, over-buying, festival prep stress
- **Tech Comfort:** Moderate (uses WhatsApp, basic apps)

### Secondary Persona: Young Professional
- **Age:** 25-35 years
- **Role:** Living alone or with roommates, learning to cook
- **Pain Points:** Not knowing what to cook, wasting ingredients, need protein rich diet
- **Tech Comfort:** High

### Tertiary Persona: Joint Family Member
- **Age:** 50+ years
- **Role:** Senior member who cooks traditional recipes
- **Pain Points:** Language barriers, complex apps
- **Tech Comfort:** Low (prefers regional language)

---

## Core Features Specification

### 1. User Authentication & Onboarding

**Requirements:**
- Email/password registration and login
- JWT-based session management (7-day token expiry)
- Password reset via email token
- Profile management (name, language preference, city)
- Guided onboarding flow for new users

**User Data:**
```
- Email (unique)
- Name
- Home Language (en/hi/mr)
- City
- Households[] (can belong to multiple)
- Active Household (currently selected)
- Is Admin flag
- Onboarding Complete flag
```

---

### 2. Household (Kitchen) Management

**Concept:** A "Household" represents a shared kitchen that family members collaborate on.

**Requirements:**
- Create new household with custom name ("Sharma Family Kitchen")
- Generate unique 6-character alphanumeric kitchen code
- Join existing household using code
- Maximum 4 members per household
- Owner/Member role system
- Switch between multiple households
- Transfer ownership capability
- Leave or delete household

**Auto-Population:**
When a new household is created, automatically populate with 60+ essential Indian pantry items:
- Basmati Rice, Wheat Flour (Atta), Rava, Poha
- Toor Dal, Moong Dal, Chana Dal, Masoor Dal
- Turmeric, Red Chili, Cumin, Coriander, Garam Masala
- Sunflower Oil, Ghee, Mustard Oil
- Salt, Sugar, Jaggery
- Tea, Coffee
- And more across 13 categories

---

### 3. Inventory Management

**Categories (13 total):**
| Category | Icon | Examples |
|----------|------|----------|
| Grains & Cereals | 🌾 | Rice, Flour, Rava, Poha |
| Pulses & Lentils | 🫘 | Toor Dal, Moong, Rajma |
| Spices & Masalas | 🌶️ | Turmeric, Cumin, Garam Masala |
| Vegetables | 🧅 | Onion, Tomato, Potato |
| Fruits | 🍎 | Apple, Banana, Mango |
| Dairy & Essentials | 🥛 | Milk, Ghee, Paneer |
| Oils & Condiments | 🧴 | Sunflower Oil, Mustard Oil |
| Bakery Items | 🍞 | Bread, Pav |
| Upvas/Fasting | 🔱 | Sabudana, Singoda Atta |
| Snacks & Ready Mix | 🥣 | Poha Mix, Upma Mix |
| Tea & Coffee | ☕ | Tea Leaves, Coffee Powder |
| Cleaning & Household | 🧹 | Dish Soap, Detergent |
| Medicine | 💊 | Tablets, Syrups, First Aid |
| Other | 📦 | Miscellaneous |

**Stock Level System:**
- **Full (●):** >75% of monthly need
- **Half (◑):** 26-75% of monthly need
- **Low (◔):** 1-25% of monthly need
- **Empty (○):** 0%

**Inventory Item Fields:**
```
- Name (English)
- Name (Hindi)
- Name (Marathi)
- Category
- Current Stock (in grams/ml)
- Monthly Quantity (household's typical monthly usage)
- Stock Level (calculated dynamically)
- Expiry Date (optional)
- AI powered OCR (for scanning)
- Reserved For (meal plan reservations)
```

**Features:**
- Increment/decrement current stock with category-appropriate steps
- Adjust monthly quantity per household needs
- Expiry date tracking with alerts (expired, expiring today, expiring soon)
- Filter by stock level (show only low stock items)
- Search across English and regional names
- Add items using AI-powered OCR to read product name and expiry date from photos

---

### 4. Shopping List Management

**Store Types:**
- **Grocery Store:** Grains, spices, dairy, packaged items
- **Mandi (Vegetable Market):** Fresh vegetables and fruits

**Shopping Item Fields:**
```
- Name (multilingual)
- Category
- Quantity (with presets based on category)
- Store Type
- Shopping Status (pending/in_cart/bought)
- Claimed By (user who's buying)
- Expiry Date (to set when purchasing)
- Notes
```

**Features:**
- Auto-sync low/empty stock items from inventory
- Category-specific quantity presets:
  - Grains: 100g, 250g, 500g, 1kg, 2kg, 5kg, 10kg
  - Spices: 25g, 50g, 100g, 200g, 250g, 500g
  - Dairy: 250ml, 500ml, 1L, 2L, 5L
  - Medicine: 1 strip, 2 strips, 1 bottle, 1 box
- Custom quantity input
- WhatsApp sharing (formatted bilingual list)
- Real-time status updates ("Rahul is buying Onions")
- Claim/unclaim items for coordination
- Mark as Purchased → Auto-update inventory
- Set expiry date while marking purchased

---

### 5. Meal Planning

**Calendar View:**
- 7-day rolling calendar (today + 6 days)
- 4 meal slots per day:
  - 🌅 Breakfast (7:00 AM)
  - 🌞 Lunch (12:30 PM)
  - ☕ Snacks (5:00 PM)
  - 🌙 Dinner (8:00 PM)
- Auto-scroll to today
- Mobile-optimized compact view

**Meal Plan Fields:**
```
- Date
- Meal Type
- Meal Name
- YouTube Video ID (optional)
- YouTube Thumbnail
- YouTube Channel
- Ingredients Needed
- Reserved Ingredients (with quantities)
- Serving Size
```

**Serving Sizes:**
- Single (1 person) - 0.25x
- Couple (2 people) - 0.5x
- Family (4 people) - 1.0x
- Party (8+ people) - 2.0x

**Ingredient Reservation:**
When a meal is planned, users can reserve ingredients from inventory:
- Select which ingredients to use
- System estimates quantities based on serving size
- Reserved amounts shown in inventory
- When meal is deleted, reservations are released

---

### 6. Recipe Discovery

**Sources:**
1. **Local Database:** 100+ pre-loaded Indian recipes with YouTube video IDs
2. **YouTube Search:** Real-time search (API quota managed)
3. **Favorite Channels Feed:** Personalized feed from user's favorite cooking channels

**Local Recipe Database Entries:**
```
- Vegetable Pulao, Dal Tadka, Aloo Gobi
- Palak Paneer, Chole Bhature, Rajma Chawal
- Kanda Poha, Rava Upma, Masala Dosa
- Vada Pav, Pav Bhaji, Samosa
- Gajar Ka Halwa, Gulab Jamun
- And more...
```

**"Cook with Your Stock" Feature:**
1. User adds favorite YouTube cooking channels
2. System fetches recent videos from channel upload playlists
3. Video titles matched against user's inventory
4. Results sorted by ingredient match percentage
5. Shows "80% ingredients available" type indicators

**Caching Strategy:**
- Channel info: 7-day cache
- Playlist videos: 6-hour cache
- Search results: 24-hour cache
- Prevents YouTube API quota exhaustion

---

### 7. Digital Dadi (Festival Intelligence)

**Concept:** "Dadi" (grandmother) provides cultural context, festival reminders, and cooking wisdom.

**Festival Calendar:**
Admin can upload CSV with:
```
- Festival Name (EN/HI/MR)
- Date
- Significance
- Key Ingredients (comma-separated)
- Associated Recipes
- Dadi's Tips
- Is Fasting Day
- Region
```

**Example Festivals:**
| Festival | Key Ingredients |
|----------|-----------------|
| Ganesh Chaturthi | Modak, Coconut, Jaggery, Rice Flour |
| Diwali | Mawa, Kesar, Sugar, Ghee, Dry Fruits |
| Holi | Mawa, Gulal, Thandai ingredients |
| Navratri | Sabudana, Kuttu Atta, Sendha Namak |
| Makar Sankranti | Til, Jaggery, Peanuts |

**Upcoming Festival Alert:**
- Looks 14 days ahead
- Checks user's inventory against festival ingredients
- Calculates "Readiness Score" (% ingredients in stock)
- One-click "Add Missing to Shopping List"
- Shows festival significance and Dadi's tips

**Tip of the Day:**
Random cooking tips in user's preferred language:
- "Always taste your food while cooking to adjust seasonings"
- "Use jaggery instead of sugar for authentic Maharashtrian taste"
- "Roast spices before grinding for more aromatic flavor"

---

### 8. Real-Time Synchronization

**Technology:** Server-Sent Events (SSE)

**Events Broadcast:**
- Inventory add/update/delete
- Shopping list add/update/delete
- Shopping status changes (pending → in_cart → bought)
- Meal plan updates
- Member online/offline status

**Use Case:**
- Wife adds "Onion" to shopping list at home
- Husband at grocery store instantly sees it appear
- Husband marks "Onion" as "In Cart"
- Wife sees "Husband is buying Onion"
- Husband marks purchased → Inventory auto-updates

---

### 9. Multilingual Support

**Languages:**
- English (en) - Primary
- Hindi (hi) - हिन्दी
- Marathi (mr) - मराठी

**Translation Approach:**
- Pre-translated pantry item names stored in database
- Google Cloud Translation API for on-demand translations
- 24-hour translation cache
- User-verified translations get priority
- Community-verified (100+ verifications) become gold standard

**UI Translation:**
All labels, buttons, and messages available in all 3 languages.

---

### 10. OCR Scanning


**AI-Powered OCR:**
- Uses OpenAI GPT-4 Vision
- Two modes:
  1. **Product Name:** Reads text from product packaging
  2. **Expiry Date:** Finds and parses expiry/best-before dates
- Returns standardized data for easy input

---

### 11. Admin Dashboard

**Features:**
- API quota monitoring (YouTube, Translation)
- Per-household usage breakdown
- Translation moderation (approve/reject community submissions)
- Festival calendar management
- User statistics
- Admin role assignment

**Quota Alerts:**
- Warning when YouTube API > 80% daily quota
- Alert for heavy-usage households

---

## Technical Architecture

### Frontend
- **Framework:** React 18
- **Styling:** Tailwind CSS
- **Components:** Shadcn/UI
- **State Management:** React Context + Custom Hooks
- **Routing:** React Router v6
- **Animations:** Framer Motion
- **Date Handling:** date-fns

### Backend
- **Framework:** FastAPI (Python 3.11)
- **Database:** MongoDB (Motor async driver)
- **Authentication:** JWT (PyJWT)
- **Real-Time:** Server-Sent Events
- **Validation:** Pydantic

### Third-Party APIs
- YouTube Data API v3 (recipe videos)
- Google Cloud Translation API v3 (multilingual)
- Open Food Facts API (barcode lookup)
- OpenAI GPT-4 Vision (OCR)

### Infrastructure
- Docker containerized
- Kubernetes deployment
- MongoDB Atlas (database)
- Hot reload enabled for development

---

## Database Schema

### Collections

**users**
```javascript
{
  id: "uuid",
  email: "user@example.com",
  name: "Priya Sharma",
  hashed_password: "bcrypt_hash",
  home_language: "mr",
  city: "Pune",
  households: ["household_id_1", "household_id_2"],
  active_household: "household_id_1",
  is_admin: false,
  onboarding_complete: true,
  created_at: ISODate
}
```

**households**
```javascript
{
  id: "uuid",
  name: "Sharma Family Kitchen",
  kitchen_code: "ABC123",
  created_by: "user_id",
  members: [
    { user_id, name, email, role: "owner|member", joined_at }
  ],
  settings: { language, city },
  created_at: ISODate
}
```

**inventory**
```javascript
{
  id: "uuid",
  household_id: "uuid",
  name_en: "Basmati Rice",
  name_mr: "बासमती तांदूळ",
  name_hi: "बासमती चावल",
  category: "grains",
  stock_level: "half",
  current_stock: 2500,
  monthly_quantity: 5000,
  monthly_unit: "g",
  expiry_date: "2025-06-15",
  is_secret_stash: false,
  barcode: null,
  reserved_for: [{ meal_plan_id, date, qty, unit }],
  created_at: ISODate
}
```

**shopping_list**
```javascript
{
  id: "uuid",
  household_id: "uuid",
  name_en: "Onion",
  name_mr: "कांदा",
  name_hi: "प्याज",
  category: "vegetables",
  quantity: "-",
  monthly_quantity: "2 kg",
  store_type: "mandi",
  shopping_status: "pending",
  claimed_by: null,
  claimed_by_name: null,
  bought_at: null,
  notes: null,
  expiry_date: null,
  created_at: ISODate
}
```

**meal_plans**
```javascript
{
  id: "uuid",
  household_id: "uuid",
  date: "2025-01-20",
  meal_type: "dinner",
  meal_name: "Pav Bhaji",
  youtube_video_id: "xyz123",
  youtube_thumbnail: "https://...",
  youtube_channel: "MadhurasRecipe",
  ingredients_needed: ["Potato", "Cauliflower", "Peas", "Pav"],
  reserved_ingredients: [
    { item_id, item_name, est_qty: 500, unit: "g" }
  ],
  serving_size: "family_4",
  created_at: ISODate
}
```

**festivals**
```javascript
{
  id: "uuid",
  name: "Ganesh Chaturthi",
  name_mr: "गणेश चतुर्थी",
  name_hi: "गणेश चतुर्थी",
  date: "Sep 07",
  significance: "Birthday of Lord Ganesha",
  key_ingredients: ["Modak", "Coconut", "Jaggery"],
  recipes: ["Ukadiche Modak"],
  tips: ["Prepare filling day before"],
  is_fasting_day: false,
  region: "Maharashtra",
  created_at: ISODate
}
```

---

## API Endpoints Summary

### Authentication (8 endpoints)
- POST /api/auth/signup
- POST /api/auth/login
- GET /api/auth/me
- POST /api/auth/forgot-password
- POST /api/auth/reset-password
- POST /api/auth/change-password
- PUT /api/auth/profile
- POST /api/auth/complete-onboarding

### Households (10 endpoints)
- POST /api/households/create
- POST /api/households/join
- GET /api/households/my-households
- GET /api/households/{id}
- POST /api/households/{id}/switch
- POST /api/households/{id}/leave
- DELETE /api/households/{id}
- PUT /api/households/{id}/settings
- POST /api/households/{id}/transfer-ownership
- DELETE /api/households/{id}/member/{user_id}

### Inventory (7 endpoints)
- GET /api/inventory/household
- POST /api/inventory/household
- PUT /api/inventory/{id}
- DELETE /api/inventory/{id}
- GET /api/inventory/monthly-defaults
- PUT /api/inventory/{id}/monthly-quantity
- GET /api/inventory/reservations

### Shopping (9 endpoints)
- GET /api/shopping
- POST /api/shopping
- PUT /api/shopping/{id}
- DELETE /api/shopping/{id}
- PUT /api/shopping/{id}/status
- POST /api/shopping/{id}/claim
- POST /api/shopping/{id}/unclaim
- POST /api/shopping/{id}/mark-bought
- DELETE /api/shopping (clear all)

### Meal Plans (7 endpoints)
- GET /api/meal-plans
- POST /api/meal-plans
- DELETE /api/meal-plans/{id}
- POST /api/meal-plans/prepare
- GET /api/meal-plans/suggestions
- GET /api/meal-plans/check/{video_id}
- GET /api/gap-analysis

### YouTube & Recipes (8 endpoints)
- GET /api/youtube/search
- GET /api/youtube-recipes/search
- GET /api/youtube/recommendations
- GET /api/youtube/video-details/{id}
- POST /api/youtube/add-video
- GET /api/youtube/user-videos
- GET /api/stream/channels
- GET /api/stream/feed

### Digital Dadi (7 endpoints)
- GET /api/dadi/festivals
- POST /api/dadi/festivals
- PUT /api/dadi/festivals/{id}
- DELETE /api/dadi/festivals/{id}
- POST /api/dadi/festivals/upload
- GET /api/dadi/upcoming
- POST /api/dadi/add-missing-to-shopping
- GET /api/dadi/tip-of-day

### Other (6 endpoints)
- GET /api/barcode/{code}
- POST /api/ocr/extract
- GET /api/translate
- GET /api/pantry-items/template
- GET /api/sse/stream
- GET /api/festival-alert

### Admin (10 endpoints)
- GET /api/admin/dashboard
- GET /api/admin/api-usage
- GET /api/admin/api-usage/alerts
- GET /api/admin/translations/pending
- POST /api/admin/translations/{id}/approve
- POST /api/admin/translations/{id}/reject
- GET /api/admin/festivals
- POST /api/admin/make-admin/{user_id}

---

## UI/UX Guidelines

### Color Palette
- **Primary Orange:** #FF9933 (Indian flag saffron)
- **Secondary Green:** #138808 (Indian flag green)
- **Accent Yellow:** #FFCC00
- **Success Green:** #77DD77
- **Background:** White with warm gray accents

### Typography
- **Headings:** Bold, clear hierarchy
- **Body:** Readable at small sizes for mobile
- **Regional Text:** Proper font support for Devanagari script

### Mobile-First Design
- Touch-friendly targets (min 44px)
- Bottom navigation for thumb reach
- Compact cards with expandable details
- Swipe gestures where appropriate

### Bilingual Display
```
Basmati Rice
बासमती तांदूळ
```
English name prominent, regional name below in smaller text.

---

## Success Metrics

1. **User Engagement**
   - Daily active users
   - Items added per household per week
   - Meal plans created per week

2. **Feature Adoption**
   - % users using real-time sync
   - % users with favorite channels
   - Festival readiness checks performed

3. **Efficiency Gains**
   - Reduction in "forgot item" shopping trips
   - Time saved in recipe discovery
   - Food waste reduction (expiry tracking)

4. **Cultural Relevance**
   - Regional language usage rate
   - Festival feature engagement
   - Traditional recipe saves

---

## Future Roadmap

### Phase 2 (Planned)
- Push notifications for festivals and expiry
- Regional festival calendars (state-specific)
- Voice-enabled Dadi assistant
- "Mark meal as cooked" → Auto-deduct ingredients
- Community recipe sharing

### Phase 3 (Vision)
- Smart shopping suggestions based on meal history
- Price tracking and budget management
- Integration with local grocery delivery apps
- Family nutrition insights
- Recipe scaling calculator

---

## Development Notes

### Environment Variables Required
```
# Backend
MONGO_URL=mongodb://...
DB_NAME=rasoi_sync
JWT_SECRET_KEY=...
YOUTUBE_API_KEY=...
GOOGLE_TRANSLATE_API_KEY=...
EMERGENT_LLM_KEY=... (for OCR)

# Frontend
REACT_APP_BACKEND_URL=https://...
```

### Running Locally
```bash
# Backend
cd /app/backend
pip install -r requirements.txt
uvicorn server:app --reload --port 8001

# Frontend
cd /app/frontend
yarn install
yarn start
```

### Testing
- Backend: pytest for API testing
- Frontend: React Testing Library
- E2E: Playwright

---

*This prompt document serves as the complete specification for Rasoi-Sync. It can be used to onboard new developers, explain the product to stakeholders, or guide future development decisions.*
