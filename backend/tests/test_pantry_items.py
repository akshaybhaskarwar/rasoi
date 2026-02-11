"""
Pantry Items API Tests
Tests the centralized pantry items data source for Rasoi-Sync.
Verifies the fix for Jaggery/Sugar categorization issue.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestPantryItemsAPI:
    """Tests for /api/pantry-items endpoints"""
    
    def test_template_endpoint_returns_data(self):
        """Test /api/pantry-items/template returns valid structure"""
        response = requests.get(f"{BASE_URL}/api/pantry-items/template")
        assert response.status_code == 200
        
        data = response.json()
        assert "template" in data
        assert "category_units" in data
        
        # Verify template has main categories
        template = data["template"]
        assert len(template) > 0
        
        # Check for expected main categories
        main_categories = list(template.keys())
        assert any("GROCERY" in cat for cat in main_categories)
    
    def test_jaggery_has_correct_category_and_unit(self):
        """CRITICAL: Jaggery must be in 'sweeteners' category with 'g' unit (not 'L')"""
        response = requests.get(f"{BASE_URL}/api/pantry-items/item/Jaggery")
        assert response.status_code == 200
        
        data = response.json()
        assert data["name_en"] == "Jaggery"
        assert data["category"] == "sweeteners", f"Expected 'sweeteners', got '{data['category']}'"
        assert data["unit"] == "g", f"Expected 'g', got '{data['unit']}' - This was the original bug!"
        assert data["name_mr"] == "गूळ"
        assert data["name_hi"] == "गुड़"
    
    def test_sugar_has_correct_category_and_unit(self):
        """Sugar must be in 'sweeteners' category with 'g' unit"""
        response = requests.get(f"{BASE_URL}/api/pantry-items/item/Sugar")
        assert response.status_code == 200
        
        data = response.json()
        assert data["name_en"] == "Sugar"
        assert data["category"] == "sweeteners"
        assert data["unit"] == "g"
        assert data["name_mr"] == "साखर"
        assert data["name_hi"] == "चीनी"
    
    def test_essentials_endpoint_returns_items(self):
        """Test /api/pantry-items/essentials returns essential items"""
        response = requests.get(f"{BASE_URL}/api/pantry-items/essentials")
        assert response.status_code == 200
        
        data = response.json()
        assert "essentials" in data
        essentials = data["essentials"]
        assert len(essentials) > 0
        
        # Verify essential items have required fields
        for item in essentials:
            assert "name_en" in item
            assert "category" in item
            assert "unit" in item
    
    def test_essentials_contains_jaggery_with_correct_unit(self):
        """Jaggery in essentials must have 'g' unit"""
        response = requests.get(f"{BASE_URL}/api/pantry-items/essentials")
        assert response.status_code == 200
        
        essentials = response.json()["essentials"]
        jaggery = next((item for item in essentials if item["name_en"] == "Jaggery"), None)
        
        assert jaggery is not None, "Jaggery should be in essentials"
        assert jaggery["category"] == "sweeteners"
        assert jaggery["unit"] == "g", f"Jaggery unit should be 'g', got '{jaggery['unit']}'"
    
    def test_essentials_contains_sugar_with_correct_unit(self):
        """Sugar in essentials must have 'g' unit"""
        response = requests.get(f"{BASE_URL}/api/pantry-items/essentials")
        assert response.status_code == 200
        
        essentials = response.json()["essentials"]
        sugar = next((item for item in essentials if item["name_en"] == "Sugar"), None)
        
        assert sugar is not None, "Sugar should be in essentials"
        assert sugar["category"] == "sweeteners"
        assert sugar["unit"] == "g"
    
    def test_categories_endpoint(self):
        """Test /api/pantry-items/categories returns category units"""
        response = requests.get(f"{BASE_URL}/api/pantry-items/categories")
        assert response.status_code == 200
        
        data = response.json()
        assert "categories" in data
        categories = data["categories"]
        
        # Verify sweeteners category has 'g' unit
        assert "sweeteners" in categories
        assert categories["sweeteners"] == "g", f"Sweeteners should use 'g', got '{categories['sweeteners']}'"
        
        # Verify oils category has 'L' unit
        assert "oils" in categories
        assert categories["oils"] == "L"
    
    def test_item_not_found(self):
        """Test /api/pantry-items/item/{name} returns error for unknown item"""
        response = requests.get(f"{BASE_URL}/api/pantry-items/item/NonExistentItem123")
        assert response.status_code == 200  # API returns 200 with error message
        
        data = response.json()
        assert "error" in data
        assert data["error"] == "Item not found"
    
    def test_template_sweeteners_subcategory(self):
        """Verify sweeteners subcategory exists in template with correct items"""
        response = requests.get(f"{BASE_URL}/api/pantry-items/template")
        assert response.status_code == 200
        
        template = response.json()["template"]
        
        # Find sweeteners subcategory
        sweeteners_found = False
        for main_cat, subcats in template.items():
            for subcat_name, subcat_data in subcats.items():
                if "Sweeteners" in subcat_name:
                    sweeteners_found = True
                    items = subcat_data.get("items", [])
                    
                    # Find Jaggery and Sugar in items
                    jaggery = next((i for i in items if i["en"] == "Jaggery"), None)
                    sugar = next((i for i in items if i["en"] == "Sugar"), None)
                    
                    assert jaggery is not None, "Jaggery should be in Sweeteners"
                    assert sugar is not None, "Sugar should be in Sweeteners"
                    
                    # Verify units
                    assert jaggery["unit"] == "g", f"Jaggery unit in template should be 'g', got '{jaggery['unit']}'"
                    assert sugar["unit"] == "g", f"Sugar unit in template should be 'g', got '{sugar['unit']}'"
                    break
        
        assert sweeteners_found, "Sweeteners subcategory should exist in template"


class TestPantryItemsDataIntegrity:
    """Tests for data integrity across pantry items"""
    
    def test_all_items_have_units(self):
        """All items in template should have unit field"""
        response = requests.get(f"{BASE_URL}/api/pantry-items/template")
        assert response.status_code == 200
        
        template = response.json()["template"]
        
        for main_cat, subcats in template.items():
            for subcat_name, subcat_data in subcats.items():
                items = subcat_data.get("items", [])
                for item in items:
                    assert "unit" in item, f"Item {item.get('en', 'unknown')} missing unit"
                    assert item["unit"] in ["g", "kg", "L", "ml", "pcs"], f"Invalid unit for {item['en']}: {item['unit']}"
    
    def test_all_items_have_category(self):
        """All items in template should have category field"""
        response = requests.get(f"{BASE_URL}/api/pantry-items/template")
        assert response.status_code == 200
        
        template = response.json()["template"]
        
        for main_cat, subcats in template.items():
            for subcat_name, subcat_data in subcats.items():
                items = subcat_data.get("items", [])
                for item in items:
                    assert "category" in item, f"Item {item.get('en', 'unknown')} missing category"
