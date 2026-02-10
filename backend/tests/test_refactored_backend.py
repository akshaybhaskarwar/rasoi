"""
Test suite for Rasoi-Sync refactored backend
Tests all API endpoints after refactoring from monolithic server.py to modular architecture
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER_EMAIL = "recipe_tester@test.com"
TEST_USER_PASSWORD = "TestPass123!"
TEST_USER_NO_HOUSEHOLD_EMAIL = "test@test.com"
TEST_USER_NO_HOUSEHOLD_PASSWORD = "test123"


class TestHealthEndpoint:
    """Test health check endpoint"""
    
    def test_health_returns_healthy(self):
        """Health endpoint should return healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"


class TestInventoryEndpoints:
    """Test inventory-related endpoints"""
    
    def test_monthly_defaults_returns_category_defaults(self):
        """Monthly defaults endpoint should return category defaults"""
        response = requests.get(f"{BASE_URL}/api/inventory/monthly-defaults")
        assert response.status_code == 200
        data = response.json()
        
        # Verify expected categories exist
        expected_categories = ["grains", "pulses", "spices", "dairy", "oils", "vegetables", "fruits"]
        for category in expected_categories:
            assert category in data, f"Missing category: {category}"
            assert "quantity" in data[category]
            assert "unit" in data[category]
            assert "step" in data[category]
    
    def test_inventory_household_requires_auth(self):
        """Inventory household endpoint should require authentication"""
        response = requests.get(f"{BASE_URL}/api/inventory/household")
        assert response.status_code == 401 or response.status_code == 403
    
    def test_inventory_household_with_auth(self, authenticated_client):
        """Inventory household endpoint should return items for authenticated user"""
        response = authenticated_client.get(f"{BASE_URL}/api/inventory/household")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Verify item structure if items exist
        if len(data) > 0:
            item = data[0]
            assert "id" in item
            assert "name_en" in item
            assert "category" in item


class TestYouTubeEndpoints:
    """Test YouTube-related endpoints"""
    
    def test_recommendations_returns_prefetched_videos(self):
        """YouTube recommendations should return pre-fetched videos"""
        response = requests.get(f"{BASE_URL}/api/youtube/recommendations")
        assert response.status_code == 200
        data = response.json()
        
        assert "recommendations" in data
        assert "source" in data
        assert data["source"] == "pre_fetched"
        assert data["quota_cost"] == 0
        
        # Verify recommendations structure
        recommendations = data["recommendations"]
        assert isinstance(recommendations, list)
        assert len(recommendations) > 0
        
        # Verify video structure
        video = recommendations[0]
        assert "video_id" in video
        assert "title" in video
        assert "channel" in video
        assert "thumbnail" in video


class TestPreferencesEndpoint:
    """Test preferences endpoint"""
    
    def test_preferences_returns_user_preferences(self):
        """Preferences endpoint should return user preferences"""
        response = requests.get(f"{BASE_URL}/api/preferences")
        assert response.status_code == 200
        data = response.json()
        
        # Verify preferences structure
        assert "favorite_channels" in data
        assert isinstance(data["favorite_channels"], list)


class TestAuthenticationFlow:
    """Test authentication endpoints"""
    
    def test_login_with_valid_credentials(self):
        """Login should succeed with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "access_token" in data
        assert "token_type" in data
        assert data["token_type"] == "bearer"
        assert "user" in data
        assert data["user"]["email"] == TEST_USER_EMAIL
    
    def test_login_with_invalid_credentials(self):
        """Login should fail with invalid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "invalid@test.com", "password": "wrongpassword"}
        )
        assert response.status_code == 401 or response.status_code == 400
    
    def test_login_test_user_no_household(self):
        """Login with test@test.com/test123 should succeed"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_NO_HOUSEHOLD_EMAIL, "password": TEST_USER_NO_HOUSEHOLD_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "access_token" in data
        assert data["user"]["email"] == TEST_USER_NO_HOUSEHOLD_EMAIL


class TestShoppingEndpoints:
    """Test shopping list endpoints"""
    
    def test_shopping_list_requires_auth(self):
        """Shopping list endpoint should require authentication"""
        response = requests.get(f"{BASE_URL}/api/shopping")
        assert response.status_code == 401 or response.status_code == 403
    
    def test_shopping_list_with_auth(self, authenticated_client):
        """Shopping list endpoint should return items for authenticated user"""
        response = authenticated_client.get(f"{BASE_URL}/api/shopping")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Verify item structure if items exist
        if len(data) > 0:
            item = data[0]
            assert "id" in item
            assert "name_en" in item


class TestMealPlansEndpoints:
    """Test meal plans endpoints"""
    
    def test_meal_plans_requires_auth(self):
        """Meal plans endpoint should require authentication"""
        response = requests.get(f"{BASE_URL}/api/meal-plans")
        assert response.status_code == 401 or response.status_code == 403
    
    def test_meal_plans_with_auth(self, authenticated_client):
        """Meal plans endpoint should return plans for authenticated user"""
        response = authenticated_client.get(f"{BASE_URL}/api/meal-plans")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestTranslationEndpoints:
    """Test translation endpoints"""
    
    def test_translate_text_to_hindi(self):
        """Translation endpoint should translate text to Hindi"""
        response = requests.post(
            f"{BASE_URL}/api/translate",
            json={
                "text": "Hello",
                "source_language": "en",
                "target_languages": ["hi"]
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "original_text" in data
        assert data["original_text"] == "Hello"
        assert "translations" in data
        assert "hi" in data["translations"]
        
        # Verify Hindi translation structure
        hi_translation = data["translations"]["hi"]
        assert "translated_text" in hi_translation
        assert len(hi_translation["translated_text"]) > 0
    
    def test_translate_text_to_marathi(self):
        """Translation endpoint should translate text to Marathi"""
        response = requests.post(
            f"{BASE_URL}/api/translate",
            json={
                "text": "Rice",
                "source_language": "en",
                "target_languages": ["mr"]
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "translations" in data
        assert "mr" in data["translations"]


class TestBarcodeEndpoints:
    """Test barcode lookup endpoints"""
    
    def test_barcode_lookup_queries_open_food_facts(self):
        """Barcode lookup should query Open Food Facts API"""
        # Using a known barcode that may or may not be in the database
        response = requests.get(f"{BASE_URL}/api/barcode/8901030865251")
        assert response.status_code == 200
        data = response.json()
        
        # Response should have either found=True with product data or found=False
        assert "barcode" in data
        assert data["barcode"] == "8901030865251"
        
        if data.get("found"):
            assert "name" in data
            assert "category" in data
        else:
            assert "message" in data
    
    def test_barcode_lookup_with_known_product(self):
        """Barcode lookup with a known product barcode"""
        # Coca-Cola barcode (commonly in Open Food Facts)
        response = requests.get(f"{BASE_URL}/api/barcode/5449000000996")
        assert response.status_code == 200
        data = response.json()
        
        assert "barcode" in data


class TestFestivalAlertEndpoint:
    """Test festival alert endpoint"""
    
    def test_festival_alert_returns_response(self):
        """Festival alert endpoint should return a response (null or festival data)"""
        response = requests.get(f"{BASE_URL}/api/festival-alert")
        assert response.status_code == 200
        
        # Response can be null (no upcoming festival) or festival data
        data = response.json()
        if data is not None:
            assert "name" in data
            assert "date" in data
            assert "message" in data


class TestInventoryHouseholdNoActiveHousehold:
    """Test inventory household endpoint for user without active household"""
    
    def test_inventory_household_returns_error_for_no_household(self):
        """Inventory household should return error for user without active household"""
        # Login as test@test.com who has no active household
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_NO_HOUSEHOLD_EMAIL, "password": TEST_USER_NO_HOUSEHOLD_PASSWORD}
        )
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]
        
        # Try to access inventory household
        response = requests.get(
            f"{BASE_URL}/api/inventory/household",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        # Should return 400 with "No active household" message
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "household" in data["detail"].lower()


class TestYouTubeSearchEndpoints:
    """Test YouTube search endpoints"""
    
    def test_youtube_search_local_recipes(self):
        """YouTube local recipe search should return results"""
        response = requests.get(
            f"{BASE_URL}/api/youtube-recipes/search",
            params={"ingredients": "rice,dal", "max_results": 5}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "results" in data
        assert "total_found" in data
        assert "search_criteria" in data


# Fixtures
@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture
def auth_token(api_client):
    """Get authentication token for user with active household"""
    response = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Authentication failed - skipping authenticated tests")


@pytest.fixture
def authenticated_client(api_client, auth_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client
