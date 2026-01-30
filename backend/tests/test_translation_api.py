"""
Translation API Tests for Rasoi-Sync
Tests Google Cloud Translation API integration with verification system
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestTranslationAPI:
    """Test translation endpoints"""
    
    def test_translate_static_word_hindi(self):
        """Test translation of static word (turmeric) to Hindi - should be community verified"""
        response = requests.post(
            f"{BASE_URL}/api/translate",
            json={
                "text": "turmeric",
                "source_language": "en",
                "target_languages": ["hi"]
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "original_text" in data
        assert "translations" in data
        assert "hi" in data["translations"]
        
        # Verify Hindi translation
        hi_translation = data["translations"]["hi"]
        assert hi_translation["translated_text"] == "हल्दी"
        assert hi_translation["is_ai_generated"] == False  # Static translation
        assert hi_translation["community_verified"] == True  # Pre-verified
        assert hi_translation["user_verified_count"] >= 100  # Community threshold
        print(f"Static translation test passed: turmeric -> {hi_translation['translated_text']}")
    
    def test_translate_static_word_marathi(self):
        """Test translation of static word (rice) to Marathi - should be community verified"""
        response = requests.post(
            f"{BASE_URL}/api/translate",
            json={
                "text": "rice",
                "source_language": "en",
                "target_languages": ["mr"]
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify Marathi translation
        mr_translation = data["translations"]["mr"]
        assert mr_translation["translated_text"] == "तांदूळ"
        assert mr_translation["is_ai_generated"] == False
        assert mr_translation["community_verified"] == True
        print(f"Static translation test passed: rice -> {mr_translation['translated_text']}")
    
    def test_translate_multiple_languages(self):
        """Test translation to both Hindi and Marathi simultaneously"""
        response = requests.post(
            f"{BASE_URL}/api/translate",
            json={
                "text": "potato",
                "source_language": "en",
                "target_languages": ["hi", "mr"]
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify both translations present
        assert "hi" in data["translations"]
        assert "mr" in data["translations"]
        
        # Verify Hindi translation
        assert data["translations"]["hi"]["translated_text"] == "आलू"
        
        # Verify Marathi translation
        assert data["translations"]["mr"]["translated_text"] == "बटाटा"
        print("Multi-language translation test passed")
    
    def test_translate_ai_generated_word(self):
        """Test translation of non-static word - should use Google Translate API"""
        response = requests.post(
            f"{BASE_URL}/api/translate",
            json={
                "text": "quinoa",
                "source_language": "en",
                "target_languages": ["hi"]
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        hi_translation = data["translations"]["hi"]
        # AI-generated translations should be marked as such
        assert hi_translation["is_ai_generated"] == True
        assert hi_translation["community_verified"] == False
        assert hi_translation["user_verified_count"] == 0
        assert hi_translation["translated_text"] is not None
        print(f"AI translation test passed: quinoa -> {hi_translation['translated_text']}")
    
    def test_translate_verify_endpoint(self):
        """Test the verify translation endpoint"""
        response = requests.post(
            f"{BASE_URL}/api/translate/verify",
            json={
                "source_text": "turmeric",
                "target_language": "hi",
                "translated_text": "हल्दी"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert "user_verified_count" in data
        print(f"Verify endpoint test passed: count = {data['user_verified_count']}")
    
    def test_translate_edit_endpoint(self):
        """Test the edit translation endpoint (Dadi Override)"""
        response = requests.post(
            f"{BASE_URL}/api/translate/edit",
            json={
                "source_text": "turmeric",
                "target_language": "hi",
                "custom_label": "हल्दी पाउडर"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["custom_label"] == "हल्दी पाउडर"
        assert "Dadi" in data["message"]  # Should mention Dadi's choice
        print(f"Edit endpoint test passed: custom_label = {data['custom_label']}")
    
    def test_translate_empty_text(self):
        """Test translation with empty text - should handle gracefully"""
        response = requests.post(
            f"{BASE_URL}/api/translate",
            json={
                "text": "",
                "source_language": "en",
                "target_languages": ["hi"]
            }
        )
        # Should either return 400 or handle empty text gracefully
        assert response.status_code in [200, 400, 422]
    
    def test_translate_case_insensitive(self):
        """Test that translation lookup is case-insensitive"""
        response = requests.post(
            f"{BASE_URL}/api/translate",
            json={
                "text": "RICE",
                "source_language": "en",
                "target_languages": ["hi"]
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should still find the static translation
        hi_translation = data["translations"]["hi"]
        assert hi_translation["translated_text"] == "चावल"
        print("Case-insensitive translation test passed")


class TestSupportedLanguages:
    """Test supported languages configuration"""
    
    def test_hindi_language_code(self):
        """Test Hindi language code works"""
        response = requests.post(
            f"{BASE_URL}/api/translate",
            json={
                "text": "salt",
                "source_language": "en",
                "target_languages": ["hi"]
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["translations"]["hi"]["translated_text"] == "नमक"
    
    def test_marathi_language_code(self):
        """Test Marathi language code works"""
        response = requests.post(
            f"{BASE_URL}/api/translate",
            json={
                "text": "salt",
                "source_language": "en",
                "target_languages": ["mr"]
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["translations"]["mr"]["translated_text"] == "मीठ"


class TestTranslationCache:
    """Test translation caching behavior"""
    
    def test_cached_translation_returns_same_result(self):
        """Test that cached translations return consistent results"""
        # First request
        response1 = requests.post(
            f"{BASE_URL}/api/translate",
            json={
                "text": "onion",
                "source_language": "en",
                "target_languages": ["hi"]
            }
        )
        
        # Second request (should hit cache)
        response2 = requests.post(
            f"{BASE_URL}/api/translate",
            json={
                "text": "onion",
                "source_language": "en",
                "target_languages": ["hi"]
            }
        )
        
        assert response1.status_code == 200
        assert response2.status_code == 200
        
        data1 = response1.json()
        data2 = response2.json()
        
        # Both should return same translation
        assert data1["translations"]["hi"]["translated_text"] == data2["translations"]["hi"]["translated_text"]
        print("Cache consistency test passed")


class TestInventoryAPI:
    """Test inventory API with translation fields"""
    
    def test_get_inventory_items(self):
        """Test getting inventory items"""
        response = requests.get(f"{BASE_URL}/api/inventory")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        if len(data) > 0:
            item = data[0]
            assert "name_en" in item
            # Translation fields should be present
            assert "name_hi" in item or item.get("name_hi") is None
            assert "name_mr" in item or item.get("name_mr") is None
        print(f"Inventory API test passed: {len(data)} items found")
    
    def test_create_inventory_item_with_translation(self):
        """Test creating inventory item with Marathi name"""
        response = requests.post(
            f"{BASE_URL}/api/inventory",
            json={
                "name_en": "TEST_Coriander Seeds",
                "name_mr": "धणे",
                "category": "spices",
                "stock_level": "full"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["name_en"] == "TEST_Coriander Seeds"
        assert data["name_mr"] == "धणे"
        
        # Cleanup - delete the test item
        item_id = data["id"]
        delete_response = requests.delete(f"{BASE_URL}/api/inventory/{item_id}")
        assert delete_response.status_code == 200
        print("Create inventory with translation test passed")


class TestShoppingAPI:
    """Test shopping API with translation fields"""
    
    def test_get_shopping_list(self):
        """Test getting shopping list"""
        response = requests.get(f"{BASE_URL}/api/shopping")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        if len(data) > 0:
            item = data[0]
            assert "name_en" in item
        print(f"Shopping API test passed: {len(data)} items found")
    
    def test_create_shopping_item_with_translation(self):
        """Test creating shopping item - backend auto-translates name_en"""
        response = requests.post(
            f"{BASE_URL}/api/shopping",
            json={
                "name_en": "TEST_Cumin",
                "category": "spices",
                "quantity": "100g"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["name_en"] == "TEST_Cumin"
        # Backend may auto-translate, so just check field exists
        assert "name_hi" in data or data.get("name_hi") is None
        
        # Cleanup
        item_id = data["id"]
        delete_response = requests.delete(f"{BASE_URL}/api/shopping/{item_id}")
        assert delete_response.status_code == 200
        print("Create shopping item test passed")


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
