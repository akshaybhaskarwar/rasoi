# Rasoi-Sync Changelog

## February 10, 2025

### Backend Refactoring
**Major code reorganization from monolithic to modular architecture**

#### Changes Made:
- **server.py**: Reduced from 3600+ lines to ~200 lines
- **models/**: Created 7 Pydantic model files
  - `inventory.py`, `shopping.py`, `meal_plans.py`, `translation.py`, `recipes.py`, `preferences.py`, `common.py`
- **data/**: Created 4 static data files  
  - `translations.py` (65+ Hindi/Marathi translations)
  - `recipes.py` (30+ local recipe database)
  - `festivals.py` (festival calendar)
  - `categories.py` (category keywords)
- **services/**: Created 2 service files
  - `translation.py` (TranslationService with Google API)
  - `youtube.py` (YouTubeService with caching)
- **routes/**: Created 7 route handler files
  - `inventory.py`, `shopping.py`, `meal_plans.py`, `translation.py`, `youtube.py`, `preferences.py`, `barcode.py`

#### Testing Results:
- 20/20 backend tests passed (100% success rate)
- All API endpoints verified working
- No breaking changes to frontend

#### Documentation:
- Created `/app/docs/CODE_ARCHITECTURE.md` with full architecture documentation
- Updated `/app/memory/PRD.md` with refactoring details

---

## Previous Changes (Before Feb 10, 2025)

### February 9, 2025
- Fixed data scoping bug - all queries now filtered by `household_id`
- Added real-time shopping list sync via SSE
- Fixed onboarding flow bugs
- Reworked Shopping List "Add Item" UI

### February 4, 2025
- Added YouTube recipe save feature
- Added recipe edit functionality
- Mobile UX improvements

### February 2, 2025
- Added user authentication (JWT)
- Added household/kitchen management
- Added onboarding flow
- Added admin dashboard

### January 30, 2025
- Added Google Cloud Translation API integration
- Added translation verification system
