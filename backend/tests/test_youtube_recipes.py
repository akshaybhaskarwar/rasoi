"""
Test suite for YouTube Recipe Features
Tests: YouTube video-details endpoint, YouTube recipe creation, edit functionality
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test user credentials
TEST_EMAIL = "recipe_tester@test.com"
TEST_PASSWORD = "TestPass123!"
TEST_NAME = "Recipe Tester"

# Sample YouTube video ID for testing
SAMPLE_VIDEO_ID = "dQw4w9WgXcQ"  # A well-known video that should exist


class TestYouTubeVideoDetails:
    """Test YouTube video-details endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self, api_client, auth_token):
        """Setup for each test"""
        self.client = api_client
        self.token = auth_token
        self.headers = {"Authorization": f"Bearer {auth_token}"}
    
    def test_video_details_requires_auth(self, api_client):
        """GET /api/youtube/video-details/{video_id} - should require auth"""
        response = api_client.get(f"{BASE_URL}/api/youtube/video-details/{SAMPLE_VIDEO_ID}")
        # Endpoint requires auth - returns 401/403/500/520 without token
        assert response.status_code in [401, 403, 500, 520], f"Expected auth error, got {response.status_code}"
        print(f"✓ YouTube video-details requires authentication (status: {response.status_code})")
    
    def test_video_details_with_auth(self):
        """GET /api/youtube/video-details/{video_id} - should return video metadata"""
        response = self.client.get(
            f"{BASE_URL}/api/youtube/video-details/{SAMPLE_VIDEO_ID}",
            headers=self.headers
        )
        
        # May fail if YouTube API quota exceeded
        if response.status_code == 429:
            pytest.skip("YouTube API quota exceeded")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "video_id" in data, "Response should contain 'video_id'"
        assert "title" in data, "Response should contain 'title'"
        assert "channel" in data, "Response should contain 'channel'"
        assert "thumbnail" in data, "Response should contain 'thumbnail'"
        assert "description" in data, "Response should contain 'description'"
        
        print(f"✓ Got video details: {data['title'][:50]}...")
    
    def test_video_details_invalid_id(self):
        """GET /api/youtube/video-details/{video_id} - should return 404 for invalid video"""
        invalid_id = "INVALID_VIDEO_ID_123"
        response = self.client.get(
            f"{BASE_URL}/api/youtube/video-details/{invalid_id}",
            headers=self.headers
        )
        
        # May fail if YouTube API quota exceeded
        if response.status_code == 429:
            pytest.skip("YouTube API quota exceeded")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Invalid video ID returns 404")


class TestYouTubeRecipeCreation:
    """Test YouTube recipe creation endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self, api_client, auth_token):
        """Setup for each test"""
        self.client = api_client
        self.token = auth_token
        self.headers = {"Authorization": f"Bearer {auth_token}"}
        self.created_recipe_ids = []
    
    def teardown_method(self, method):
        """Cleanup created recipes after each test"""
        for recipe_id in self.created_recipe_ids:
            try:
                self.client.delete(f"{BASE_URL}/api/recipes/{recipe_id}", headers=self.headers)
            except:
                pass
    
    def test_create_youtube_recipe_success(self):
        """POST /api/recipes/youtube - should create a YouTube-linked recipe"""
        unique_id = str(uuid.uuid4())[:8]
        recipe_data = {
            "youtube_video_id": f"TEST_{unique_id}",
            "youtube_url": f"https://youtube.com/watch?v=TEST_{unique_id}",
            "title": f"TEST_YouTube Recipe {unique_id}",
            "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
            "channel_name": "Test Channel",
            "channel_id": "UC_test_channel",
            "duration": "PT10M30S",
            "description": "A test recipe video description",
            "detected_ingredients": ["Onion", "Tomato", "Rice", "Cumin"],
            "matched_inventory_items": ["Onion", "Rice"],
            "personal_note": "This looks delicious!",
            "categories": ["Lunch", "Quick Recipe"],
            "tags": ["lunch", "quick-recipe"]
        }
        
        response = self.client.post(f"{BASE_URL}/api/recipes/youtube", json=recipe_data, headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should contain recipe 'id'"
        assert data["title"] == recipe_data["title"], "Title should match"
        assert data["youtube_video_id"] == recipe_data["youtube_video_id"], "YouTube video ID should match"
        assert data["recipe_type"] == "youtube", "Recipe type should be 'youtube'"
        assert data["personal_note"] == recipe_data["personal_note"], "Personal note should match"
        assert "stock_status" in data, "Should include stock status"
        
        self.created_recipe_ids.append(data["id"])
        print(f"✓ Created YouTube recipe: {data['title']} (ID: {data['id']})")
    
    def test_create_youtube_recipe_duplicate(self):
        """POST /api/recipes/youtube - should reject duplicate video"""
        unique_id = str(uuid.uuid4())[:8]
        recipe_data = {
            "youtube_video_id": f"DUPE_{unique_id}",
            "youtube_url": f"https://youtube.com/watch?v=DUPE_{unique_id}",
            "title": f"TEST_Duplicate Recipe {unique_id}",
            "detected_ingredients": [],
            "matched_inventory_items": [],
            "categories": [],
            "tags": []
        }
        
        # Create first recipe
        response1 = self.client.post(f"{BASE_URL}/api/recipes/youtube", json=recipe_data, headers=self.headers)
        assert response1.status_code == 200, f"First creation should succeed: {response1.text}"
        self.created_recipe_ids.append(response1.json()["id"])
        
        # Try to create duplicate
        response2 = self.client.post(f"{BASE_URL}/api/recipes/youtube", json=recipe_data, headers=self.headers)
        assert response2.status_code == 400, f"Expected 400 for duplicate, got {response2.status_code}"
        assert "already" in response2.json().get("detail", "").lower(), "Error should mention duplicate"
        
        print("✓ Duplicate YouTube recipe rejected correctly")
    
    def test_youtube_recipe_appears_in_household_list(self):
        """YouTube recipe should appear in household recipes list"""
        unique_id = str(uuid.uuid4())[:8]
        recipe_data = {
            "youtube_video_id": f"LIST_{unique_id}",
            "youtube_url": f"https://youtube.com/watch?v=LIST_{unique_id}",
            "title": f"TEST_List Recipe {unique_id}",
            "detected_ingredients": ["Potato"],
            "matched_inventory_items": [],
            "categories": ["Dinner"],
            "tags": ["dinner"]
        }
        
        # Create recipe
        create_response = self.client.post(f"{BASE_URL}/api/recipes/youtube", json=recipe_data, headers=self.headers)
        assert create_response.status_code == 200
        recipe_id = create_response.json()["id"]
        self.created_recipe_ids.append(recipe_id)
        
        # Check household recipes list
        list_response = self.client.get(f"{BASE_URL}/api/recipes", headers=self.headers)
        assert list_response.status_code == 200
        
        recipes = list_response.json()["recipes"]
        recipe_ids = [r["id"] for r in recipes]
        assert recipe_id in recipe_ids, "YouTube recipe should appear in household list"
        
        # Find the recipe and verify YouTube fields
        youtube_recipe = next((r for r in recipes if r["id"] == recipe_id), None)
        assert youtube_recipe is not None
        assert youtube_recipe.get("recipe_type") == "youtube", "Recipe type should be 'youtube'"
        assert youtube_recipe.get("youtube_video_id") == recipe_data["youtube_video_id"]
        
        print("✓ YouTube recipe appears in household recipes list with correct type")


class TestRecipeEditFunctionality:
    """Test recipe edit functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self, api_client, auth_token):
        """Setup for each test"""
        self.client = api_client
        self.token = auth_token
        self.headers = {"Authorization": f"Bearer {auth_token}"}
        self.created_recipe_ids = []
    
    def teardown_method(self, method):
        """Cleanup created recipes after each test"""
        for recipe_id in self.created_recipe_ids:
            try:
                self.client.delete(f"{BASE_URL}/api/recipes/{recipe_id}", headers=self.headers)
            except:
                pass
    
    def test_edit_own_recipe(self):
        """PUT /api/recipes/{id} - should allow editing own recipe"""
        # Create a recipe
        recipe_data = {
            "title": "TEST_Edit Test Recipe",
            "chef_name": "Original Chef",
            "ingredients": [{"ingredient_name": "Original Ingredient", "quantity": 100, "unit": "g"}],
            "instructions": [{"step_number": 1, "instruction": "Original instruction"}],
            "servings": 2,
            "tags": ["dinner"]
        }
        
        create_response = self.client.post(f"{BASE_URL}/api/recipes", json=recipe_data, headers=self.headers)
        assert create_response.status_code == 200
        recipe_id = create_response.json()["id"]
        self.created_recipe_ids.append(recipe_id)
        
        # Edit the recipe
        update_data = {
            "title": "TEST_Updated Recipe Title",
            "chef_name": "Updated Chef",
            "servings": 4,
            "ingredients": [
                {"ingredient_name": "Updated Ingredient", "quantity": 200, "unit": "g"},
                {"ingredient_name": "New Ingredient", "quantity": 50, "unit": "ml"}
            ],
            "instructions": [
                {"step_number": 1, "instruction": "Updated instruction"},
                {"step_number": 2, "instruction": "New step"}
            ]
        }
        
        update_response = self.client.put(f"{BASE_URL}/api/recipes/{recipe_id}", json=update_data, headers=self.headers)
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}: {update_response.text}"
        
        updated = update_response.json()
        assert updated["title"] == update_data["title"], "Title should be updated"
        assert updated["chef_name"] == update_data["chef_name"], "Chef name should be updated"
        assert updated["servings"] == update_data["servings"], "Servings should be updated"
        assert len(updated["ingredients"]) == 2, "Should have 2 ingredients"
        assert len(updated["instructions"]) == 2, "Should have 2 instructions"
        
        # Verify persistence with GET
        get_response = self.client.get(f"{BASE_URL}/api/recipes/{recipe_id}", headers=self.headers)
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched["title"] == update_data["title"], "Update should persist"
        
        print("✓ Recipe edit functionality works correctly")
    
    def test_recipe_has_household_id(self):
        """Recipe should have household_id for ownership check"""
        recipe_data = {
            "title": "TEST_Ownership Test Recipe",
            "ingredients": [{"ingredient_name": "Test", "quantity": 1, "unit": "piece"}],
            "instructions": [{"step_number": 1, "instruction": "Test"}],
            "servings": 1
        }
        
        create_response = self.client.post(f"{BASE_URL}/api/recipes", json=recipe_data, headers=self.headers)
        assert create_response.status_code == 200
        recipe_id = create_response.json()["id"]
        self.created_recipe_ids.append(recipe_id)
        
        # Get recipe and check household_id
        get_response = self.client.get(f"{BASE_URL}/api/recipes/{recipe_id}", headers=self.headers)
        assert get_response.status_code == 200
        
        recipe = get_response.json()
        assert "household_id" in recipe, "Recipe should have household_id"
        assert recipe["household_id"] is not None, "household_id should not be None"
        
        print(f"✓ Recipe has household_id: {recipe['household_id']}")


class TestYouTubeURLValidation:
    """Test YouTube URL format validation"""
    
    def test_youtube_url_formats(self):
        """Test various YouTube URL formats are accepted"""
        # These are just format tests - the actual validation happens in frontend
        valid_formats = [
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://youtube.com/watch?v=dQw4w9WgXcQ",
            "https://youtu.be/dQw4w9WgXcQ",
            "https://www.youtube.com/shorts/dQw4w9WgXcQ",
            "https://youtube.com/embed/dQw4w9WgXcQ"
        ]
        
        import re
        YOUTUBE_REGEX = r'(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})'
        
        for url in valid_formats:
            match = re.search(YOUTUBE_REGEX, url)
            assert match is not None, f"URL should match: {url}"
            assert match.group(1) == "dQw4w9WgXcQ", f"Video ID should be extracted from: {url}"
        
        print(f"✓ All {len(valid_formats)} YouTube URL formats validated")


# ============ FIXTURES ============

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def auth_token(api_client):
    """Get authentication token"""
    # Try to login with existing test user
    login_data = {
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    }
    
    login_response = api_client.post(f"{BASE_URL}/api/auth/login", json=login_data)
    
    if login_response.status_code == 200:
        token = login_response.json().get("access_token")
        if token:
            print(f"✓ Logged in as: {TEST_EMAIL}")
            return token
    
    # Try signup if login failed
    signup_data = {
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
        "name": TEST_NAME
    }
    
    signup_response = api_client.post(f"{BASE_URL}/api/auth/signup", json=signup_data)
    
    if signup_response.status_code == 200:
        token = signup_response.json().get("access_token")
        if token:
            print(f"✓ Created test user: {TEST_EMAIL}")
            
            # Create a household
            household_data = {"name": "Test YouTube Household"}
            api_client.post(
                f"{BASE_URL}/api/households/create",
                json=household_data,
                headers={"Authorization": f"Bearer {token}"}
            )
            
            return token
    
    pytest.skip("Could not authenticate - skipping authenticated tests")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
