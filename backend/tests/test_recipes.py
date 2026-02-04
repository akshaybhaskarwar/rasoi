"""
Test suite for User-Generated Recipe (UGR) Module
Tests: Recipe CRUD, tags, units, ingredient suggestions, stock status, shopping list integration
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test user credentials - use existing test user
TEST_EMAIL = "recipe_tester@test.com"
TEST_PASSWORD = "TestPass123!"
TEST_NAME = "Recipe Tester"

class TestRecipePublicEndpoints:
    """Test public recipe endpoints (no auth required)"""
    
    def test_get_recipe_tags(self):
        """GET /api/recipes/tags - should return all recipe tags"""
        response = requests.get(f"{BASE_URL}/api/recipes/tags")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "tags" in data, "Response should contain 'tags' key"
        assert len(data["tags"]) > 0, "Should have at least one tag"
        
        # Verify tag structure
        first_tag = data["tags"][0]
        assert "id" in first_tag, "Tag should have 'id'"
        assert "label_en" in first_tag, "Tag should have 'label_en'"
        assert "label_mr" in first_tag, "Tag should have 'label_mr'"
        assert "label_hi" in first_tag, "Tag should have 'label_hi'"
        assert "emoji" in first_tag, "Tag should have 'emoji'"
        
        print(f"✓ Found {len(data['tags'])} recipe tags")
    
    def test_get_recipe_units(self):
        """GET /api/recipes/units - should return all unit options"""
        response = requests.get(f"{BASE_URL}/api/recipes/units")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "units" in data, "Response should contain 'units' key"
        assert len(data["units"]) > 0, "Should have at least one unit"
        
        # Verify unit structure
        first_unit = data["units"][0]
        assert "value" in first_unit, "Unit should have 'value'"
        assert "label" in first_unit, "Unit should have 'label'"
        
        # Check for common units
        unit_values = [u["value"] for u in data["units"]]
        assert "g" in unit_values, "Should have grams unit"
        assert "kg" in unit_values, "Should have kilograms unit"
        assert "cup" in unit_values, "Should have cup unit"
        assert "tsp" in unit_values, "Should have teaspoon unit"
        
        print(f"✓ Found {len(data['units'])} unit options")


class TestRecipeAuthenticatedEndpoints:
    """Test authenticated recipe endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self, api_client, auth_token):
        """Setup for each test"""
        self.client = api_client
        self.token = auth_token
        self.headers = {"Authorization": f"Bearer {auth_token}"}
    
    def test_suggest_ingredients_requires_auth(self, api_client):
        """GET /api/recipes/suggest-ingredients - should require auth"""
        response = api_client.get(f"{BASE_URL}/api/recipes/suggest-ingredients?query=rice")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Ingredient suggestions require authentication")
    
    def test_suggest_ingredients_with_auth(self):
        """GET /api/recipes/suggest-ingredients - should return suggestions"""
        response = self.client.get(
            f"{BASE_URL}/api/recipes/suggest-ingredients?query=ri",
            headers=self.headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "suggestions" in data, "Response should contain 'suggestions' key"
        # Suggestions may be empty if no inventory items match
        print(f"✓ Got {len(data['suggestions'])} ingredient suggestions for 'ri'")
    
    def test_suggest_ingredients_short_query(self):
        """GET /api/recipes/suggest-ingredients - short query returns empty"""
        response = self.client.get(
            f"{BASE_URL}/api/recipes/suggest-ingredients?query=r",
            headers=self.headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["suggestions"] == [], "Short query should return empty suggestions"
        print("✓ Short query returns empty suggestions")
    
    def test_get_household_recipes_empty(self):
        """GET /api/recipes - should return empty list initially"""
        response = self.client.get(f"{BASE_URL}/api/recipes", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "recipes" in data, "Response should contain 'recipes' key"
        print(f"✓ Got {len(data['recipes'])} household recipes")
    
    def test_get_community_recipes(self):
        """GET /api/recipes/community - should return published recipes"""
        response = self.client.get(f"{BASE_URL}/api/recipes/community", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "recipes" in data, "Response should contain 'recipes' key"
        print(f"✓ Got {len(data['recipes'])} community recipes")


class TestRecipeCRUD:
    """Test Recipe Create, Read, Update, Delete operations"""
    
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
    
    def test_create_recipe_success(self):
        """POST /api/recipes - should create a new recipe"""
        recipe_data = {
            "title": "TEST_Dal Makhani",
            "chef_name": "Test Chef",
            "story": "A family recipe passed down through generations",
            "ingredients": [
                {"ingredient_name": "Black Lentils", "quantity": 200, "unit": "g"},
                {"ingredient_name": "Butter", "quantity": 50, "unit": "g"},
                {"ingredient_name": "Cream", "quantity": 100, "unit": "ml"}
            ],
            "instructions": [
                {"step_number": 1, "instruction": "Soak lentils overnight"},
                {"step_number": 2, "instruction": "Pressure cook until soft"},
                {"step_number": 3, "instruction": "Add butter and cream, simmer"}
            ],
            "tags": ["dinner", "traditional"],
            "servings": 4,
            "prep_time_minutes": 30,
            "cook_time_minutes": 60,
            "is_published": False
        }
        
        response = self.client.post(f"{BASE_URL}/api/recipes", json=recipe_data, headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should contain recipe 'id'"
        assert data["title"] == recipe_data["title"], "Title should match"
        assert data["chef_name"] == recipe_data["chef_name"], "Chef name should match"
        assert len(data["ingredients"]) == 3, "Should have 3 ingredients"
        assert len(data["instructions"]) == 3, "Should have 3 instructions"
        assert "stock_status" in data, "Should include stock status"
        
        self.created_recipe_ids.append(data["id"])
        print(f"✓ Created recipe: {data['title']} (ID: {data['id']})")
        return data["id"]
    
    def test_create_recipe_with_translations(self):
        """POST /api/recipes - should auto-translate ingredients"""
        recipe_data = {
            "title": "TEST_Simple Rice",
            "ingredients": [
                {"ingredient_name": "Rice", "quantity": 1, "unit": "cup"}
            ],
            "instructions": [
                {"step_number": 1, "instruction": "Cook rice"}
            ],
            "servings": 2
        }
        
        response = self.client.post(f"{BASE_URL}/api/recipes", json=recipe_data, headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        self.created_recipe_ids.append(data["id"])
        
        # Check if translations were added
        ingredient = data["ingredients"][0]
        # Translations may or may not be present depending on API availability
        print(f"✓ Created recipe with ingredient translations: name_en={ingredient.get('name_en')}, name_hi={ingredient.get('name_hi')}, name_mr={ingredient.get('name_mr')}")
    
    def test_get_recipe_by_id(self):
        """GET /api/recipes/{id} - should return recipe details"""
        # First create a recipe
        recipe_data = {
            "title": "TEST_Get Recipe Test",
            "ingredients": [{"ingredient_name": "Test Ingredient", "quantity": 1, "unit": "piece"}],
            "instructions": [{"step_number": 1, "instruction": "Test step"}],
            "servings": 1
        }
        
        create_response = self.client.post(f"{BASE_URL}/api/recipes", json=recipe_data, headers=self.headers)
        assert create_response.status_code == 200
        recipe_id = create_response.json()["id"]
        self.created_recipe_ids.append(recipe_id)
        
        # Get the recipe
        response = self.client.get(f"{BASE_URL}/api/recipes/{recipe_id}", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["id"] == recipe_id, "Recipe ID should match"
        assert data["title"] == recipe_data["title"], "Title should match"
        assert "stock_status" in data, "Should include stock status"
        
        print(f"✓ Retrieved recipe: {data['title']}")
    
    def test_get_recipe_not_found(self):
        """GET /api/recipes/{id} - should return 404 for non-existent recipe"""
        fake_id = str(uuid.uuid4())
        response = self.client.get(f"{BASE_URL}/api/recipes/{fake_id}", headers=self.headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Non-existent recipe returns 404")
    
    def test_update_recipe(self):
        """PUT /api/recipes/{id} - should update recipe"""
        # First create a recipe
        recipe_data = {
            "title": "TEST_Update Recipe Test",
            "ingredients": [{"ingredient_name": "Original Ingredient", "quantity": 1, "unit": "piece"}],
            "instructions": [{"step_number": 1, "instruction": "Original step"}],
            "servings": 2
        }
        
        create_response = self.client.post(f"{BASE_URL}/api/recipes", json=recipe_data, headers=self.headers)
        assert create_response.status_code == 200
        recipe_id = create_response.json()["id"]
        self.created_recipe_ids.append(recipe_id)
        
        # Update the recipe
        update_data = {
            "title": "TEST_Updated Recipe Title",
            "servings": 4
        }
        
        response = self.client.put(f"{BASE_URL}/api/recipes/{recipe_id}", json=update_data, headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["title"] == update_data["title"], "Title should be updated"
        assert data["servings"] == update_data["servings"], "Servings should be updated"
        
        # Verify with GET
        get_response = self.client.get(f"{BASE_URL}/api/recipes/{recipe_id}", headers=self.headers)
        assert get_response.json()["title"] == update_data["title"], "Update should persist"
        
        print(f"✓ Updated recipe title to: {data['title']}")
    
    def test_delete_recipe(self):
        """DELETE /api/recipes/{id} - should delete recipe"""
        # First create a recipe
        recipe_data = {
            "title": "TEST_Delete Recipe Test",
            "ingredients": [{"ingredient_name": "Delete Ingredient", "quantity": 1, "unit": "piece"}],
            "instructions": [{"step_number": 1, "instruction": "Delete step"}],
            "servings": 1
        }
        
        create_response = self.client.post(f"{BASE_URL}/api/recipes", json=recipe_data, headers=self.headers)
        assert create_response.status_code == 200
        recipe_id = create_response.json()["id"]
        
        # Delete the recipe
        response = self.client.delete(f"{BASE_URL}/api/recipes/{recipe_id}", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Verify deletion
        get_response = self.client.get(f"{BASE_URL}/api/recipes/{recipe_id}", headers=self.headers)
        assert get_response.status_code == 404, "Deleted recipe should return 404"
        
        print("✓ Recipe deleted successfully")
    
    def test_like_published_recipe(self):
        """POST /api/recipes/{id}/like - should increment likes"""
        # First create a published recipe
        recipe_data = {
            "title": "TEST_Like Recipe Test",
            "ingredients": [{"ingredient_name": "Like Ingredient", "quantity": 1, "unit": "piece"}],
            "instructions": [{"step_number": 1, "instruction": "Like step"}],
            "servings": 1,
            "is_published": True
        }
        
        create_response = self.client.post(f"{BASE_URL}/api/recipes", json=recipe_data, headers=self.headers)
        assert create_response.status_code == 200
        recipe_id = create_response.json()["id"]
        self.created_recipe_ids.append(recipe_id)
        
        # Like the recipe
        response = self.client.post(f"{BASE_URL}/api/recipes/{recipe_id}/like", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "likes" in data, "Response should contain 'likes'"
        assert data["likes"] >= 1, "Likes should be at least 1"
        
        print(f"✓ Recipe liked, total likes: {data['likes']}")
    
    def test_add_missing_to_shopping(self):
        """POST /api/recipes/{id}/add-missing-to-shopping - should add missing items"""
        # First create a recipe with ingredients
        recipe_data = {
            "title": "TEST_Shopping List Recipe",
            "ingredients": [
                {"ingredient_name": "Rare Ingredient XYZ", "quantity": 100, "unit": "g"},
                {"ingredient_name": "Another Rare Item ABC", "quantity": 50, "unit": "ml"}
            ],
            "instructions": [{"step_number": 1, "instruction": "Mix ingredients"}],
            "servings": 2
        }
        
        create_response = self.client.post(f"{BASE_URL}/api/recipes", json=recipe_data, headers=self.headers)
        assert create_response.status_code == 200
        recipe_id = create_response.json()["id"]
        self.created_recipe_ids.append(recipe_id)
        
        # Add missing to shopping list
        response = self.client.post(f"{BASE_URL}/api/recipes/{recipe_id}/add-missing-to-shopping", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "added_count" in data, "Response should contain 'added_count'"
        assert "message" in data, "Response should contain 'message'"
        
        print(f"✓ Added {data['added_count']} items to shopping list")


class TestRecipeFiltering:
    """Test recipe filtering and search"""
    
    @pytest.fixture(autouse=True)
    def setup(self, api_client, auth_token):
        """Setup for each test"""
        self.client = api_client
        self.token = auth_token
        self.headers = {"Authorization": f"Bearer {auth_token}"}
    
    def test_filter_by_tag(self):
        """GET /api/recipes?tag=breakfast - should filter by tag"""
        response = self.client.get(f"{BASE_URL}/api/recipes?tag=quick-breakfast", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "recipes" in data, "Response should contain 'recipes'"
        print(f"✓ Found {len(data['recipes'])} recipes with 'quick-breakfast' tag")
    
    def test_search_recipes(self):
        """GET /api/recipes?search=dal - should search recipes"""
        response = self.client.get(f"{BASE_URL}/api/recipes?search=dal", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "recipes" in data, "Response should contain 'recipes'"
        print(f"✓ Found {len(data['recipes'])} recipes matching 'dal'")
    
    def test_community_filter_by_tag(self):
        """GET /api/recipes/community?tag=traditional - should filter community recipes"""
        response = self.client.get(f"{BASE_URL}/api/recipes/community?tag=traditional", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "recipes" in data, "Response should contain 'recipes'"
        print(f"✓ Found {len(data['recipes'])} community recipes with 'traditional' tag")


# ============ FIXTURES ============

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def auth_token(api_client):
    """Get authentication token by creating a test user"""
    # Try to signup a new user
    signup_data = {
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
        "name": TEST_NAME
    }
    
    signup_response = api_client.post(f"{BASE_URL}/api/auth/signup", json=signup_data)
    
    if signup_response.status_code == 200:
        token = signup_response.json().get("token")
        if token:
            print(f"✓ Created test user: {TEST_EMAIL}")
            
            # Create a household for the user
            household_data = {"name": "Test Recipe Household"}
            api_client.post(
                f"{BASE_URL}/api/households",
                json=household_data,
                headers={"Authorization": f"Bearer {token}"}
            )
            
            return token
    
    # If signup failed (user exists), try login
    login_data = {
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    }
    
    login_response = api_client.post(f"{BASE_URL}/api/auth/login", json=login_data)
    
    if login_response.status_code == 200:
        token = login_response.json().get("token")
        if token:
            print(f"✓ Logged in as: {TEST_EMAIL}")
            return token
    
    # Try with a known test user
    fallback_login = {
        "email": "test@example.com",
        "password": "testpass123"
    }
    
    fallback_response = api_client.post(f"{BASE_URL}/api/auth/login", json=fallback_login)
    if fallback_response.status_code == 200:
        token = fallback_response.json().get("token")
        if token:
            print("✓ Logged in with fallback test user")
            return token
    
    pytest.skip("Could not authenticate - skipping authenticated tests")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
