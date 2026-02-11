"""
Digital Dadi Feature Tests
Tests for festival calendar management, CSV upload, upcoming festivals, and tip of day APIs.
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "recipe_tester@test.com"
TEST_PASSWORD = "TestPass123!"


class TestDigitalDadiPublicEndpoints:
    """Test public endpoints that don't require authentication"""
    
    def test_list_festivals_returns_data(self):
        """Test GET /api/dadi/festivals returns festival list"""
        response = requests.get(f"{BASE_URL}/api/dadi/festivals")
        assert response.status_code == 200
        
        data = response.json()
        assert "festivals" in data
        assert "total" in data
        assert isinstance(data["festivals"], list)
        
        # Verify festivals were uploaded (from main agent's curl test)
        assert data["total"] >= 5, f"Expected at least 5 festivals, got {data['total']}"
        print(f"✓ Found {data['total']} festivals")
    
    def test_festivals_have_required_fields(self):
        """Test that festivals have all required fields"""
        response = requests.get(f"{BASE_URL}/api/dadi/festivals")
        assert response.status_code == 200
        
        data = response.json()
        festivals = data["festivals"]
        
        required_fields = ["id", "name", "date", "significance", "key_ingredients"]
        
        for festival in festivals[:3]:  # Check first 3
            for field in required_fields:
                assert field in festival, f"Missing field '{field}' in festival {festival.get('name')}"
            
            # Verify key_ingredients is a list
            assert isinstance(festival["key_ingredients"], list), "key_ingredients should be a list"
        
        print("✓ All festivals have required fields")
    
    def test_tip_of_day_returns_tip(self):
        """Test GET /api/dadi/tip-of-day returns a tip"""
        response = requests.get(f"{BASE_URL}/api/dadi/tip-of-day")
        assert response.status_code == 200
        
        data = response.json()
        assert "tip" in data
        assert "context" in data
        assert isinstance(data["tip"], str)
        assert len(data["tip"]) > 0
        
        print(f"✓ Tip of day: '{data['tip'][:50]}...' (context: {data['context']})")
    
    def test_festivals_filter_by_region(self):
        """Test filtering festivals by region"""
        response = requests.get(f"{BASE_URL}/api/dadi/festivals?region=Maharashtra")
        assert response.status_code == 200
        
        data = response.json()
        # All uploaded festivals are from Maharashtra
        for festival in data["festivals"]:
            assert festival.get("region", "").lower() == "maharashtra" or festival.get("region") == "Maharashtra"
        
        print(f"✓ Region filter works, found {data['total']} Maharashtra festivals")


class TestDigitalDadiAuthenticatedEndpoints:
    """Test endpoints that require authentication"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if response.status_code != 200:
            pytest.skip(f"Login failed: {response.status_code} - {response.text}")
        
        # Token is returned as 'access_token' not 'token'
        self.token = response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        print(f"✓ Logged in as {TEST_EMAIL}")
    
    def test_upcoming_festivals_requires_auth(self):
        """Test that /api/dadi/upcoming requires authentication"""
        response = requests.get(f"{BASE_URL}/api/dadi/upcoming")
        assert response.status_code == 401
        print("✓ Upcoming festivals endpoint requires auth")
    
    def test_upcoming_festivals_with_auth(self):
        """Test GET /api/dadi/upcoming with authentication"""
        response = requests.get(
            f"{BASE_URL}/api/dadi/upcoming?days_ahead=365",  # Look ahead 365 days to find festivals
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "upcoming" in data
        
        # May return empty if no active household or no festivals in range
        if data.get("message") == "No active household":
            print("✓ Upcoming festivals returns 'No active household' message (expected for test user)")
        else:
            print(f"✓ Found {len(data['upcoming'])} upcoming festivals")
            
            # If there are upcoming festivals, verify structure
            if data["upcoming"]:
                festival = data["upcoming"][0]
                assert "id" in festival
                assert "name" in festival
                assert "days_until" in festival
                assert "readiness_score" in festival
                assert "missing_ingredients" in festival
                print(f"  First upcoming: {festival['name']} in {festival['days_until']} days")
    
    def test_add_missing_to_shopping_requires_auth(self):
        """Test that add-missing-to-shopping requires authentication"""
        response = requests.post(f"{BASE_URL}/api/dadi/add-missing-to-shopping?festival_id=test")
        assert response.status_code == 401
        print("✓ Add to shopping endpoint requires auth")
    
    def test_add_missing_to_shopping_with_invalid_festival(self):
        """Test add-missing-to-shopping with invalid festival ID"""
        response = requests.post(
            f"{BASE_URL}/api/dadi/add-missing-to-shopping?festival_id=invalid-id",
            headers=self.headers
        )
        # Should return 404 or 400 for invalid festival
        assert response.status_code in [400, 404]
        print("✓ Add to shopping returns error for invalid festival ID")
    
    def test_add_missing_to_shopping_with_valid_festival(self):
        """Test add-missing-to-shopping with a valid festival"""
        # First get a valid festival ID
        festivals_response = requests.get(f"{BASE_URL}/api/dadi/festivals")
        festivals = festivals_response.json().get("festivals", [])
        
        if not festivals:
            pytest.skip("No festivals available to test")
        
        festival_id = festivals[0]["id"]
        festival_name = festivals[0]["name"]
        
        response = requests.post(
            f"{BASE_URL}/api/dadi/add-missing-to-shopping?festival_id={festival_id}",
            headers=self.headers
        )
        
        # May return 400 if no active household
        if response.status_code == 400:
            data = response.json()
            if "No active household" in str(data):
                print("✓ Add to shopping returns 'No active household' (expected for test user)")
                return
        
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        assert data["success"] == True
        assert "festival" in data
        assert "added_to_shopping" in data
        assert "count" in data
        
        print(f"✓ Added {data['count']} items to shopping for {data['festival']}")


class TestFestivalCRUDOperations:
    """Test festival CRUD operations (admin functions)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if response.status_code != 200:
            pytest.skip(f"Login failed: {response.status_code}")
        
        self.token = response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_create_festival(self):
        """Test POST /api/dadi/festivals to create a new festival"""
        test_festival = {
            "name": "TEST_Diwali",
            "date": "Nov 12",
            "significance": "Festival of Lights",
            "key_ingredients": ["Ghee", "Sugar", "Maida", "Dry Fruits"],
            "is_fasting_day": False,
            "region": "Maharashtra"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/dadi/festivals",
            json=test_festival,
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "festival" in data
        assert data["festival"]["name"] == "TEST_Diwali"
        
        # Store ID for cleanup
        self.created_festival_id = data["festival"]["id"]
        print(f"✓ Created festival: {data['festival']['name']} (ID: {self.created_festival_id})")
        
        # Cleanup - delete the test festival
        delete_response = requests.delete(
            f"{BASE_URL}/api/dadi/festivals/{self.created_festival_id}",
            headers=self.headers
        )
        assert delete_response.status_code == 200
        print("✓ Cleaned up test festival")
    
    def test_update_festival(self):
        """Test PUT /api/dadi/festivals/{id} to update a festival"""
        # First create a test festival
        test_festival = {
            "name": "TEST_UpdateFestival",
            "date": "Dec 25",
            "significance": "Test significance",
            "key_ingredients": ["Item1", "Item2"],
            "region": "Maharashtra"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/dadi/festivals",
            json=test_festival,
            headers=self.headers
        )
        assert create_response.status_code == 200
        festival_id = create_response.json()["festival"]["id"]
        
        # Update the festival
        update_data = {
            "significance": "Updated significance",
            "key_ingredients": ["Item1", "Item2", "Item3"]
        }
        
        update_response = requests.put(
            f"{BASE_URL}/api/dadi/festivals/{festival_id}",
            json=update_data,
            headers=self.headers
        )
        
        assert update_response.status_code == 200
        data = update_response.json()
        assert data["success"] == True
        assert data["festival"]["significance"] == "Updated significance"
        assert len(data["festival"]["key_ingredients"]) == 3
        
        print(f"✓ Updated festival significance and ingredients")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/dadi/festivals/{festival_id}", headers=self.headers)
        print("✓ Cleaned up test festival")
    
    def test_delete_festival(self):
        """Test DELETE /api/dadi/festivals/{id}"""
        # First create a test festival
        test_festival = {
            "name": "TEST_DeleteFestival",
            "date": "Jan 1",
            "significance": "To be deleted",
            "key_ingredients": [],
            "region": "Maharashtra"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/dadi/festivals",
            json=test_festival,
            headers=self.headers
        )
        assert create_response.status_code == 200
        festival_id = create_response.json()["festival"]["id"]
        
        # Delete the festival
        delete_response = requests.delete(
            f"{BASE_URL}/api/dadi/festivals/{festival_id}",
            headers=self.headers
        )
        
        assert delete_response.status_code == 200
        data = delete_response.json()
        assert data["success"] == True
        
        # Verify deletion - try to get festivals and check it's not there
        festivals_response = requests.get(f"{BASE_URL}/api/dadi/festivals")
        festivals = festivals_response.json()["festivals"]
        festival_ids = [f["id"] for f in festivals]
        assert festival_id not in festival_ids
        
        print("✓ Festival deleted successfully")
    
    def test_delete_nonexistent_festival(self):
        """Test DELETE with non-existent festival ID"""
        response = requests.delete(
            f"{BASE_URL}/api/dadi/festivals/nonexistent-id-12345",
            headers=self.headers
        )
        assert response.status_code == 404
        print("✓ Delete returns 404 for non-existent festival")


class TestCSVUpload:
    """Test CSV upload functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if response.status_code != 200:
            pytest.skip(f"Login failed: {response.status_code}")
        
        self.token = response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_csv_upload_requires_auth(self):
        """Test that CSV upload requires authentication"""
        csv_content = "Festival Name,Date,Significance,Key Ingredients\nTest,Jan 1,Test,Item1"
        files = {"file": ("test.csv", csv_content, "text/csv")}
        
        response = requests.post(f"{BASE_URL}/api/dadi/festivals/upload", files=files)
        assert response.status_code == 401
        print("✓ CSV upload requires authentication")
    
    def test_csv_upload_rejects_non_csv(self):
        """Test that upload rejects non-CSV files"""
        txt_content = "This is not a CSV file"
        files = {"file": ("test.txt", txt_content, "text/plain")}
        
        response = requests.post(
            f"{BASE_URL}/api/dadi/festivals/upload",
            files=files,
            headers=self.headers
        )
        assert response.status_code == 400
        print("✓ Upload rejects non-CSV files")
    
    def test_csv_upload_valid_file(self):
        """Test uploading a valid CSV file"""
        csv_content = """Festival Name,Date,Significance,Key Ingredients
TEST_CSVFestival1,Jan 1,Test Festival 1,"Item1, Item2, Item3"
TEST_CSVFestival2,Feb 1,Test Festival 2,"ItemA, ItemB"
"""
        files = {"file": ("test_festivals.csv", csv_content, "text/csv")}
        
        response = requests.post(
            f"{BASE_URL}/api/dadi/festivals/upload",
            files=files,
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "inserted" in data or "updated" in data
        
        total_processed = data.get("inserted", 0) + data.get("updated", 0)
        print(f"✓ CSV upload successful: {data.get('inserted', 0)} inserted, {data.get('updated', 0)} updated")
        
        # Cleanup - delete test festivals
        festivals_response = requests.get(f"{BASE_URL}/api/dadi/festivals")
        for festival in festivals_response.json()["festivals"]:
            if festival["name"].startswith("TEST_CSV"):
                requests.delete(
                    f"{BASE_URL}/api/dadi/festivals/{festival['id']}",
                    headers=self.headers
                )
        print("✓ Cleaned up test CSV festivals")


class TestFestivalDataIntegrity:
    """Test data integrity of uploaded festivals"""
    
    def test_makar_sankranti_exists(self):
        """Verify Makar Sankranti festival exists with correct data"""
        response = requests.get(f"{BASE_URL}/api/dadi/festivals")
        festivals = response.json()["festivals"]
        
        makar_sankranti = next((f for f in festivals if "Makar Sankranti" in f["name"]), None)
        assert makar_sankranti is not None, "Makar Sankranti not found"
        
        assert makar_sankranti["date"] == "Jan 14"
        assert "Til" in str(makar_sankranti["key_ingredients"]) or "Sesame" in str(makar_sankranti["key_ingredients"])
        
        print(f"✓ Makar Sankranti verified: {makar_sankranti['date']}, ingredients: {makar_sankranti['key_ingredients'][:3]}...")
    
    def test_mahashivratri_is_fasting_day(self):
        """Verify Mahashivratri is marked as fasting day"""
        response = requests.get(f"{BASE_URL}/api/dadi/festivals")
        festivals = response.json()["festivals"]
        
        mahashivratri = next((f for f in festivals if "Mahashivratri" in f["name"]), None)
        assert mahashivratri is not None, "Mahashivratri not found"
        
        assert mahashivratri["is_fasting_day"] == True, "Mahashivratri should be a fasting day"
        
        print(f"✓ Mahashivratri verified as fasting day")
    
    def test_ganesh_chaturthi_exists(self):
        """Verify Ganesh Chaturthi festival exists"""
        response = requests.get(f"{BASE_URL}/api/dadi/festivals")
        festivals = response.json()["festivals"]
        
        ganesh = next((f for f in festivals if "Ganesh" in f["name"]), None)
        assert ganesh is not None, "Ganesh Chaturthi not found"
        
        # Should have modak-related ingredients
        ingredients_str = str(ganesh["key_ingredients"]).lower()
        assert "modak" in ingredients_str or "coconut" in ingredients_str or "rice flour" in ingredients_str
        
        print(f"✓ Ganesh Chaturthi verified with ingredients: {ganesh['key_ingredients'][:3]}...")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
