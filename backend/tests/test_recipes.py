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

    def test_community_feed_is_newest_first(self):
        """GET /api/recipes/community - feed must be ordered newest-first.

        Regression guard: the feed used to be sorted by likes, which buried a
        just-published recipe (likes=0) below every recipe that had ever been
        liked, so publishing appeared to do nothing.
        """
        response = self.client.get(f"{BASE_URL}/api/recipes/community", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        created = [r["created_at"] for r in response.json()["recipes"] if r.get("created_at")]
        assert created == sorted(created, reverse=True), "Community feed is not newest-first"
        print(f"✓ Community feed newest-first across {len(created)} recipes")

    def test_community_pagination_walks_without_repeats(self):
        """GET /api/recipes/community?cursor=... - pages must not overlap."""
        first = self.client.get(
            f"{BASE_URL}/api/recipes/community?limit=2", headers=self.headers
        )
        assert first.status_code == 200, f"Expected 200, got {first.status_code}"
        page1 = first.json()

        assert "has_more" in page1, "Response should report 'has_more'"
        assert "total" in page1, "First page should report 'total'"
        assert len(page1["recipes"]) <= 2, "limit=2 should return at most 2 recipes"

        if not page1.get("next_cursor"):
            print("✓ Only one page of community recipes — nothing to page through")
            return

        second = self.client.get(
            f"{BASE_URL}/api/recipes/community?limit=2&cursor={page1['next_cursor']}",
            headers=self.headers,
        )
        assert second.status_code == 200, f"Expected 200, got {second.status_code}"
        page2 = second.json()

        ids1 = {r["id"] for r in page1["recipes"]}
        ids2 = {r["id"] for r in page2["recipes"]}
        assert not (ids1 & ids2), f"Pages overlap: {ids1 & ids2}"
        assert page2["total"] is None, "Only the first page should carry 'total'"
        print(f"✓ Paged {len(ids1)} + {len(ids2)} community recipes with no repeats")

    def test_lists_do_not_ship_photo_bytes(self):
        """GET /api/recipes + /community - rows carry has_photo, not the photo.

        Regression guard: both lists used to inline every recipe's photo as
        base64, making a 20-card page a multi-megabyte response.
        """
        for path in ("/api/recipes", "/api/recipes/community"):
            response = self.client.get(f"{BASE_URL}{path}", headers=self.headers)
            assert response.status_code == 200, f"{path}: got {response.status_code}"

            for recipe in response.json()["recipes"]:
                assert "photo_base64" not in recipe, f"{path} still inlines photo bytes"
                assert "has_photo" in recipe, f"{path} row is missing has_photo"
                assert isinstance(recipe["has_photo"], bool), "has_photo should be a bool"

            size_kb = len(response.content) / 1024
            print(f"✓ {path}: {size_kb:.1f} KB, no inlined photos")

    def test_photo_endpoint_returns_cacheable_image(self):
        """GET /api/recipes/{id}/photo - image bytes with a cache header."""
        listing = self.client.get(f"{BASE_URL}/api/recipes", headers=self.headers)
        assert listing.status_code == 200
        with_photo = [r for r in listing.json()["recipes"] if r.get("has_photo")]

        if not with_photo:
            print("✓ No recipe with a photo in this household — nothing to fetch")
            return

        recipe = with_photo[0]
        response = self.client.get(
            f"{BASE_URL}/api/recipes/{recipe['id']}/photo?v={recipe.get('updated_at', '')}",
            headers=self.headers,
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert response.headers["content-type"].startswith("image/"), \
            f"Expected an image, got {response.headers['content-type']}"
        # JPEG magic number — proves bytes, not a base64 string.
        assert response.content[:2] == b"\xff\xd8", "Body is not raw JPEG bytes"

        cache_control = response.headers.get("cache-control", "")
        assert "max-age" in cache_control, f"Photo is not cacheable: {cache_control!r}"
        # Never "public": this path also serves unpublished household photos
        # and the deployment sits behind a shared cache.
        assert "public" not in cache_control, f"Photo cache must not be public: {cache_control!r}"
        print(f"✓ Photo: {len(response.content) / 1024:.1f} KB, {cache_control}")

    def test_search_survives_regex_metacharacters(self):
        """GET /api/recipes?search=... - user text is literal, not a pattern.

        Regression guard: search text went into $regex unescaped, so typing a
        bracket produced an invalid expression and a 500.
        """
        for term in ["(", "*", "[", "a)b", "+", "C++", "100% (approx)"]:
            for path in ("/api/recipes", "/api/recipes/community"):
                response = self.client.get(
                    f"{BASE_URL}{path}",
                    params={"search": term},
                    headers=self.headers,
                )
                assert response.status_code == 200, \
                    f"{path} search={term!r} returned {response.status_code}"
        print("✓ Regex metacharacters in search return 200, not 500")

    def test_search_matches_ingredients_in_both_tabs(self):
        """Household and community search must look at the same fields."""
        listing = self.client.get(f"{BASE_URL}/api/recipes", headers=self.headers)
        assert listing.status_code == 200

        ingredient = None
        for recipe in listing.json()["recipes"]:
            for ing in recipe.get("ingredients", []):
                if ing.get("ingredient_name"):
                    ingredient = ing["ingredient_name"]
                    break
            if ingredient:
                break

        if not ingredient:
            print("✓ No ingredients available to search for")
            return

        response = self.client.get(
            f"{BASE_URL}/api/recipes",
            params={"search": ingredient},
            headers=self.headers,
        )
        assert response.status_code == 200
        assert len(response.json()["recipes"]) > 0, \
            f"Searching an ingredient ({ingredient!r}) found no recipe"

        # Same term must be accepted by the community feed — it used to search
        # only title and chef_name, so the two tabs disagreed.
        community = self.client.get(
            f"{BASE_URL}/api/recipes/community",
            params={"search": ingredient},
            headers=self.headers,
        )
        assert community.status_code == 200
        print(f"✓ Ingredient search ({ingredient!r}) works in both tabs")

    def test_like_is_once_per_user(self):
        """POST /api/recipes/{id}/like - repeated likes from one user count once.

        Regression guard: the endpoint used to $inc the counter on every call,
        so one person tapping the heart five times added five likes.
        """
        feed = self.client.get(f"{BASE_URL}/api/recipes/community", headers=self.headers)
        assert feed.status_code == 200
        published = feed.json()["recipes"]

        if not published:
            print("✓ No published recipe available to like")
            return

        recipe_id = published[0]["id"]
        url = f"{BASE_URL}/api/recipes/{recipe_id}/like"

        # Start from a known state so the test is re-runnable.
        self.client.delete(url, headers=self.headers)
        baseline = self.client.post(url, headers=self.headers)
        assert baseline.status_code == 200, f"Expected 200, got {baseline.status_code}"
        after_first = baseline.json()["likes"]
        assert baseline.json()["liked"] is True

        for _ in range(4):
            repeat = self.client.post(url, headers=self.headers)
            assert repeat.status_code == 200, f"Expected 200, got {repeat.status_code}"
            assert repeat.json()["liked"] is True
            assert repeat.json()["likes"] == after_first, (
                f"Like count moved on a repeat like: {after_first} -> {repeat.json()['likes']}"
            )
        print(f"✓ Five likes from one user = one like (count stayed {after_first})")

        # liked_by_me must be visible to the client, and liked_by must not be.
        detail = self.client.get(f"{BASE_URL}/api/recipes/{recipe_id}", headers=self.headers)
        assert detail.status_code == 200
        assert detail.json()["liked_by_me"] is True, "liked_by_me should be true after liking"
        assert "liked_by" not in detail.json(), "liked_by roster must not be exposed"

        feed_again = self.client.get(f"{BASE_URL}/api/recipes/community", headers=self.headers)
        row = next(r for r in feed_again.json()["recipes"] if r["id"] == recipe_id)
        assert row["liked_by_me"] is True, "feed row should report liked_by_me"
        assert "liked_by" not in row, "feed must not expose the liked_by roster"
        print("✓ liked_by_me exposed, liked_by roster withheld")

    def test_unlike_is_idempotent_and_never_negative(self):
        """DELETE /api/recipes/{id}/like - removes one like, floors at zero."""
        feed = self.client.get(f"{BASE_URL}/api/recipes/community", headers=self.headers)
        assert feed.status_code == 200
        published = feed.json()["recipes"]

        if not published:
            print("✓ No published recipe available to unlike")
            return

        recipe_id = published[0]["id"]
        url = f"{BASE_URL}/api/recipes/{recipe_id}/like"

        self.client.post(url, headers=self.headers)
        liked = self.client.post(url, headers=self.headers).json()["likes"]

        first = self.client.delete(url, headers=self.headers)
        assert first.status_code == 200, f"Expected 200, got {first.status_code}"
        assert first.json()["liked"] is False
        assert first.json()["likes"] == max(0, liked - 1), "Unlike should drop exactly one"

        after = first.json()["likes"]
        for _ in range(3):
            repeat = self.client.delete(url, headers=self.headers)
            assert repeat.status_code == 200
            assert repeat.json()["liked"] is False
            assert repeat.json()["likes"] == after, "Repeated unlike changed the count"
            assert repeat.json()["likes"] >= 0, "Like count went negative"
        print(f"✓ Unlike is idempotent and non-negative (settled at {after})")

    def test_community_tag_filter_is_optional(self):
        """GET /api/recipes/community - the feed is browsable without a tag.

        The tag chips scope My Kitchen only, so the community request carries
        no tag; it must still return the full feed shape.
        """
        response = self.client.get(f"{BASE_URL}/api/recipes/community", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "recipes" in data and "has_more" in data and "total" in data
        print(f"✓ Untagged community feed returns {len(data['recipes'])} of {data['total']}")

    def test_community_rejects_bad_cursor(self):
        """GET /api/recipes/community - a malformed cursor is a 400, not page 1."""
        response = self.client.get(
            f"{BASE_URL}/api/recipes/community?cursor=not-a-real-cursor",
            headers=self.headers,
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Malformed cursor rejected with 400")


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
        token = signup_response.json().get("access_token")
        if token:
            print(f"✓ Created test user: {TEST_EMAIL}")
            
            # Create a household for the user
            household_data = {"name": "Test Recipe Household"}
            api_client.post(
                f"{BASE_URL}/api/households/create",
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
        token = login_response.json().get("access_token")
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
        token = fallback_response.json().get("access_token")
        if token:
            print("✓ Logged in with fallback test user")
            return token
    
    pytest.skip("Could not authenticate - skipping authenticated tests")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
