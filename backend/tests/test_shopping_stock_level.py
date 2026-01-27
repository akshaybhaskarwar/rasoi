"""
Test suite for Shopping List stock_level feature
Tests: Shopping list displays stock levels (Empty, Low) instead of quantities
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestShoppingStockLevel:
    """Test shopping list stock_level functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data prefix for cleanup"""
        self.test_prefix = f"TEST_{uuid.uuid4().hex[:8]}"
    
    def test_health_check(self):
        """Verify API is healthy before running tests"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        print("SUCCESS: Health check passed")
    
    def test_create_shopping_item_with_stock_level(self):
        """Test POST /api/shopping saves stock_level field"""
        item_name = f"TEST_Item_{uuid.uuid4().hex[:6]}"
        
        payload = {
            "name_en": item_name,
            "category": "grocery",
            "quantity": "1 kg",
            "stock_level": "low",
            "store_type": "grocery"
        }
        
        response = requests.post(f"{BASE_URL}/api/shopping", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("name_en") == item_name
        assert data.get("stock_level") == "low"
        print(f"SUCCESS: Created shopping item with stock_level=low")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/shopping/{data['id']}")
    
    def test_create_shopping_item_with_empty_stock_level(self):
        """Test POST /api/shopping with empty stock_level"""
        item_name = f"TEST_Empty_{uuid.uuid4().hex[:6]}"
        
        payload = {
            "name_en": item_name,
            "category": "grocery",
            "quantity": "-",
            "stock_level": "empty",
            "store_type": "grocery"
        }
        
        response = requests.post(f"{BASE_URL}/api/shopping", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("stock_level") == "empty"
        print(f"SUCCESS: Created shopping item with stock_level=empty")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/shopping/{data['id']}")
    
    def test_get_shopping_list_returns_stock_level(self):
        """Test GET /api/shopping returns stock_level field"""
        # Create test item
        item_name = f"TEST_Get_{uuid.uuid4().hex[:6]}"
        create_response = requests.post(
            f"{BASE_URL}/api/shopping",
            json={
                "name_en": item_name,
                "category": "grocery",
                "quantity": "2 kg",
                "stock_level": "low",
                "store_type": "grocery"
            }
        )
        item_id = create_response.json()["id"]
        
        # Get shopping list
        response = requests.get(f"{BASE_URL}/api/shopping")
        assert response.status_code == 200
        
        data = response.json()
        test_item = next((item for item in data if item["id"] == item_id), None)
        
        assert test_item is not None
        assert "stock_level" in test_item
        assert test_item["stock_level"] == "low"
        print(f"SUCCESS: GET /api/shopping returns stock_level field")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/shopping/{item_id}")
    
    def test_shopping_item_without_stock_level(self):
        """Test creating shopping item without stock_level (should be None)"""
        item_name = f"TEST_NoLevel_{uuid.uuid4().hex[:6]}"
        
        payload = {
            "name_en": item_name,
            "category": "grocery",
            "quantity": "500g",
            "store_type": "grocery"
        }
        
        response = requests.post(f"{BASE_URL}/api/shopping", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        # stock_level should be None when not provided
        assert data.get("stock_level") is None or data.get("stock_level") == ""
        print(f"SUCCESS: Shopping item without stock_level created correctly")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/shopping/{data['id']}")


class TestGapAnalysis:
    """Test Gap Analysis endpoint"""
    
    def test_gap_analysis_endpoint(self):
        """Test GET /api/gap-analysis returns missing ingredients"""
        response = requests.get(f"{BASE_URL}/api/gap-analysis")
        assert response.status_code == 200
        
        data = response.json()
        assert "missing_ingredients" in data
        assert isinstance(data["missing_ingredients"], list)
        print(f"SUCCESS: Gap analysis returned {len(data['missing_ingredients'])} missing ingredients")
    
    def test_gap_analysis_structure(self):
        """Test gap analysis response structure"""
        response = requests.get(f"{BASE_URL}/api/gap-analysis")
        assert response.status_code == 200
        
        data = response.json()
        if len(data["missing_ingredients"]) > 0:
            item = data["missing_ingredients"][0]
            assert "ingredient" in item
            assert "meal" in item
            assert "date" in item
            print(f"SUCCESS: Gap analysis item has correct structure")
        else:
            print("INFO: No missing ingredients to verify structure")


class TestInventoryStockLevel:
    """Test inventory stock_level for sync functionality"""
    
    def test_inventory_returns_stock_level(self):
        """Test GET /api/inventory returns stock_level field"""
        response = requests.get(f"{BASE_URL}/api/inventory")
        assert response.status_code == 200
        
        data = response.json()
        if len(data) > 0:
            item = data[0]
            assert "stock_level" in item
            assert item["stock_level"] in ["empty", "low", "half", "full"]
            print(f"SUCCESS: Inventory items have stock_level field")
        else:
            print("INFO: No inventory items to verify")
    
    def test_create_inventory_with_low_stock(self):
        """Test creating inventory item with low stock level"""
        item_name = f"TEST_Inv_{uuid.uuid4().hex[:6]}"
        
        payload = {
            "name_en": item_name,
            "category": "grocery",
            "stock_level": "low",
            "unit": "kg"
        }
        
        response = requests.post(f"{BASE_URL}/api/inventory", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("stock_level") == "low"
        print(f"SUCCESS: Created inventory item with stock_level=low")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/inventory/{data['id']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
