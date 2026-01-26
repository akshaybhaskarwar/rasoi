"""
Test suite for Favorite YouTube Channels feature
Tests: GET, POST, DELETE endpoints for /api/preferences/favorite-channels
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestFavoriteChannelsAPI:
    """Test favorite channels CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data prefix for cleanup"""
        self.test_prefix = f"TEST_{uuid.uuid4().hex[:8]}"
    
    def test_health_check(self):
        """Verify API is healthy before running tests"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("SUCCESS: Health check passed")
    
    def test_get_favorite_channels(self):
        """Test GET /api/preferences/favorite-channels returns list"""
        response = requests.get(f"{BASE_URL}/api/preferences/favorite-channels")
        assert response.status_code == 200
        
        data = response.json()
        assert "favorite_channels" in data
        assert isinstance(data["favorite_channels"], list)
        print(f"SUCCESS: GET favorite channels returned {len(data['favorite_channels'])} channels")
    
    def test_add_favorite_channel(self):
        """Test POST /api/preferences/favorite-channels adds channel"""
        channel_id = f"test_channel_{uuid.uuid4().hex[:8]}"
        channel_name = f"Test Channel {uuid.uuid4().hex[:4]}"
        
        payload = {
            "channel_id": channel_id,
            "channel_name": channel_name
        }
        
        response = requests.post(
            f"{BASE_URL}/api/preferences/favorite-channels",
            json=payload
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        print(f"SUCCESS: Added channel {channel_name}")
        
        # Verify channel was added by fetching list
        get_response = requests.get(f"{BASE_URL}/api/preferences/favorite-channels")
        assert get_response.status_code == 200
        
        channels = get_response.json().get("favorite_channels", [])
        channel_ids = [ch.get("id") for ch in channels]
        assert channel_id in channel_ids, f"Channel {channel_id} not found in list"
        print(f"SUCCESS: Verified channel {channel_id} exists in list")
        
        # Cleanup - remove the test channel
        delete_response = requests.delete(f"{BASE_URL}/api/preferences/favorite-channels/{channel_id}")
        print(f"Cleanup: Removed test channel {channel_id}")
    
    def test_add_favorite_channel_missing_fields(self):
        """Test POST with missing fields returns 400"""
        # Missing channel_name
        payload = {"channel_id": "test_id"}
        response = requests.post(
            f"{BASE_URL}/api/preferences/favorite-channels",
            json=payload
        )
        assert response.status_code == 400
        print("SUCCESS: Missing channel_name returns 400")
        
        # Missing channel_id
        payload = {"channel_name": "Test Name"}
        response = requests.post(
            f"{BASE_URL}/api/preferences/favorite-channels",
            json=payload
        )
        assert response.status_code == 400
        print("SUCCESS: Missing channel_id returns 400")
    
    def test_add_duplicate_channel(self):
        """Test adding duplicate channel doesn't create duplicates"""
        channel_id = f"dup_test_{uuid.uuid4().hex[:8]}"
        channel_name = "Duplicate Test Channel"
        
        payload = {
            "channel_id": channel_id,
            "channel_name": channel_name
        }
        
        # Add first time
        response1 = requests.post(
            f"{BASE_URL}/api/preferences/favorite-channels",
            json=payload
        )
        assert response1.status_code == 200
        
        # Add second time (should not create duplicate)
        response2 = requests.post(
            f"{BASE_URL}/api/preferences/favorite-channels",
            json=payload
        )
        assert response2.status_code == 200
        
        # Verify only one entry exists
        get_response = requests.get(f"{BASE_URL}/api/preferences/favorite-channels")
        channels = get_response.json().get("favorite_channels", [])
        matching_channels = [ch for ch in channels if ch.get("id") == channel_id]
        assert len(matching_channels) == 1, f"Expected 1 channel, found {len(matching_channels)}"
        print("SUCCESS: Duplicate channel not created")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/preferences/favorite-channels/{channel_id}")
    
    def test_remove_favorite_channel(self):
        """Test DELETE /api/preferences/favorite-channels/{id} removes channel"""
        # First add a channel
        channel_id = f"del_test_{uuid.uuid4().hex[:8]}"
        channel_name = "Channel To Delete"
        
        add_response = requests.post(
            f"{BASE_URL}/api/preferences/favorite-channels",
            json={"channel_id": channel_id, "channel_name": channel_name}
        )
        assert add_response.status_code == 200
        print(f"Added channel {channel_id} for deletion test")
        
        # Now delete it
        delete_response = requests.delete(
            f"{BASE_URL}/api/preferences/favorite-channels/{channel_id}"
        )
        assert delete_response.status_code == 200
        
        data = delete_response.json()
        assert "message" in data
        print(f"SUCCESS: Deleted channel {channel_id}")
        
        # Verify channel was removed
        get_response = requests.get(f"{BASE_URL}/api/preferences/favorite-channels")
        channels = get_response.json().get("favorite_channels", [])
        channel_ids = [ch.get("id") for ch in channels]
        assert channel_id not in channel_ids, f"Channel {channel_id} still exists after deletion"
        print(f"SUCCESS: Verified channel {channel_id} no longer exists")
    
    def test_remove_nonexistent_channel(self):
        """Test DELETE for non-existent channel returns 404"""
        fake_id = f"nonexistent_{uuid.uuid4().hex[:8]}"
        response = requests.delete(
            f"{BASE_URL}/api/preferences/favorite-channels/{fake_id}"
        )
        assert response.status_code == 404
        print("SUCCESS: Deleting non-existent channel returns 404")
    
    def test_get_preferences_endpoint(self):
        """Test GET /api/preferences returns favorite_channels"""
        response = requests.get(f"{BASE_URL}/api/preferences")
        assert response.status_code == 200
        
        data = response.json()
        assert "favorite_channels" in data
        print("SUCCESS: GET /api/preferences includes favorite_channels")


class TestYouTubeSearchWithFavorites:
    """Test YouTube search with favorite channels priority"""
    
    def test_youtube_search_basic(self):
        """Test basic YouTube search endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/youtube/search",
            params={"query": "paneer recipe", "max_results": 5}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "results" in data
        print(f"SUCCESS: YouTube search returned {len(data.get('results', []))} results")
    
    def test_youtube_search_with_favorite_channels(self):
        """Test YouTube search with favorite_channels parameter"""
        response = requests.get(
            f"{BASE_URL}/api/youtube/search",
            params={
                "query": "dal recipe",
                "max_results": 5,
                "favorite_channels": "Ranveer Brar,Kabita's Kitchen"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "results" in data
        print(f"SUCCESS: YouTube search with favorites returned {len(data.get('results', []))} results")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
