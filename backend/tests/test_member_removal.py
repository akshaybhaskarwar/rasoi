"""
Test suite for Member Removal Feature
Tests:
1. DELETE /api/households/{household_id}/member/{member_user_id} - Owner can remove non-owner members
2. DELETE endpoint returns 403 if non-owner tries to remove member
3. DELETE endpoint returns 400 if trying to remove owner
"""
import pytest
import requests
import os
import uuid
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMemberRemoval:
    """Test member removal functionality"""
    
    @pytest.fixture(scope="class")
    def owner_user(self):
        """Create owner user and return credentials"""
        unique_id = str(uuid.uuid4())[:8]
        email = f"TEST_owner_{unique_id}@test.com"
        password = "TestPass123!"
        name = f"Test Owner {unique_id}"
        
        # Signup owner
        response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "email": email,
            "password": password,
            "name": name,
            "home_language": "en",
            "city": "Pune"
        })
        
        if response.status_code == 200:
            data = response.json()
            return {
                "email": email,
                "password": password,
                "name": name,
                "token": data.get("access_token"),
                "user_id": data.get("user", {}).get("id")
            }
        else:
            pytest.skip(f"Failed to create owner user: {response.text}")
    
    @pytest.fixture(scope="class")
    def member_user(self):
        """Create member user and return credentials"""
        unique_id = str(uuid.uuid4())[:8]
        email = f"TEST_member_{unique_id}@test.com"
        password = "TestPass123!"
        name = f"Test Member {unique_id}"
        
        # Signup member
        response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "email": email,
            "password": password,
            "name": name,
            "home_language": "en",
            "city": "Pune"
        })
        
        if response.status_code == 200:
            data = response.json()
            return {
                "email": email,
                "password": password,
                "name": name,
                "token": data.get("access_token"),
                "user_id": data.get("user", {}).get("id")
            }
        else:
            pytest.skip(f"Failed to create member user: {response.text}")
    
    @pytest.fixture(scope="class")
    def household_with_member(self, owner_user, member_user):
        """Create household with owner and add member"""
        # Create household as owner
        headers = {"Authorization": f"Bearer {owner_user['token']}"}
        unique_id = str(uuid.uuid4())[:8]
        
        response = requests.post(
            f"{BASE_URL}/api/households/create",
            json={"name": f"TEST Kitchen {unique_id}"},
            headers=headers
        )
        
        if response.status_code != 200:
            pytest.skip(f"Failed to create household: {response.text}")
        
        household_data = response.json()
        household_id = household_data["id"]
        kitchen_code = household_data["kitchen_code"]
        
        # Join household as member
        member_headers = {"Authorization": f"Bearer {member_user['token']}"}
        join_response = requests.post(
            f"{BASE_URL}/api/households/join",
            json={"kitchen_code": kitchen_code},
            headers=member_headers
        )
        
        if join_response.status_code != 200:
            pytest.skip(f"Failed to join household: {join_response.text}")
        
        return {
            "household_id": household_id,
            "kitchen_code": kitchen_code,
            "owner_id": owner_user["user_id"],
            "member_id": member_user["user_id"]
        }
    
    def test_owner_can_remove_member(self, owner_user, member_user, household_with_member):
        """Test that owner can successfully remove a non-owner member"""
        headers = {"Authorization": f"Bearer {owner_user['token']}"}
        household_id = household_with_member["household_id"]
        member_id = household_with_member["member_id"]
        
        # Remove member
        response = requests.delete(
            f"{BASE_URL}/api/households/{household_id}/member/{member_id}",
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data
        assert "removed" in data["message"].lower() or member_user["name"] in data["message"]
        
        # Verify member is no longer in household
        get_response = requests.get(
            f"{BASE_URL}/api/households/{household_id}",
            headers=headers
        )
        
        if get_response.status_code == 200:
            household_data = get_response.json()
            member_ids = [m["user_id"] for m in household_data.get("members", [])]
            assert member_id not in member_ids, "Member should be removed from household"
        
        print(f"✓ Owner successfully removed member: {data['message']}")
    
    def test_non_owner_cannot_remove_member(self, owner_user, member_user):
        """Test that non-owner gets 403 when trying to remove a member"""
        # Create a new household and member for this test
        unique_id = str(uuid.uuid4())[:8]
        
        # Create household as owner
        owner_headers = {"Authorization": f"Bearer {owner_user['token']}"}
        create_response = requests.post(
            f"{BASE_URL}/api/households/create",
            json={"name": f"TEST Kitchen NonOwner {unique_id}"},
            headers=owner_headers
        )
        
        if create_response.status_code != 200:
            pytest.skip(f"Failed to create household: {create_response.text}")
        
        household_data = create_response.json()
        household_id = household_data["id"]
        kitchen_code = household_data["kitchen_code"]
        
        # Join as member
        member_headers = {"Authorization": f"Bearer {member_user['token']}"}
        join_response = requests.post(
            f"{BASE_URL}/api/households/join",
            json={"kitchen_code": kitchen_code},
            headers=member_headers
        )
        
        if join_response.status_code != 200:
            pytest.skip(f"Failed to join household: {join_response.text}")
        
        # Try to remove owner as member (should fail with 403)
        response = requests.delete(
            f"{BASE_URL}/api/households/{household_id}/member/{owner_user['user_id']}",
            headers=member_headers
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "detail" in data
        assert "owner" in data["detail"].lower()
        
        print(f"✓ Non-owner correctly denied: {data['detail']}")
    
    def test_cannot_remove_owner(self, owner_user, member_user):
        """Test that owner cannot be removed via this endpoint (returns 400)"""
        unique_id = str(uuid.uuid4())[:8]
        
        # Create household as owner
        owner_headers = {"Authorization": f"Bearer {owner_user['token']}"}
        create_response = requests.post(
            f"{BASE_URL}/api/households/create",
            json={"name": f"TEST Kitchen OwnerRemove {unique_id}"},
            headers=owner_headers
        )
        
        if create_response.status_code != 200:
            pytest.skip(f"Failed to create household: {create_response.text}")
        
        household_data = create_response.json()
        household_id = household_data["id"]
        
        # Try to remove owner (should fail with 400)
        response = requests.delete(
            f"{BASE_URL}/api/households/{household_id}/member/{owner_user['user_id']}",
            headers=owner_headers
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "detail" in data
        assert "owner" in data["detail"].lower()
        
        print(f"✓ Owner removal correctly denied: {data['detail']}")
    
    def test_remove_nonexistent_member(self, owner_user):
        """Test removing a member that doesn't exist in household returns 404"""
        unique_id = str(uuid.uuid4())[:8]
        
        # Create household
        owner_headers = {"Authorization": f"Bearer {owner_user['token']}"}
        create_response = requests.post(
            f"{BASE_URL}/api/households/create",
            json={"name": f"TEST Kitchen NonExist {unique_id}"},
            headers=owner_headers
        )
        
        if create_response.status_code != 200:
            pytest.skip(f"Failed to create household: {create_response.text}")
        
        household_data = create_response.json()
        household_id = household_data["id"]
        
        # Try to remove non-existent member
        fake_member_id = str(uuid.uuid4())
        response = requests.delete(
            f"{BASE_URL}/api/households/{household_id}/member/{fake_member_id}",
            headers=owner_headers
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "detail" in data
        
        print(f"✓ Non-existent member correctly returns 404: {data['detail']}")


class TestMemberRemovalEdgeCases:
    """Edge case tests for member removal"""
    
    @pytest.fixture
    def test_user(self):
        """Create a test user"""
        unique_id = str(uuid.uuid4())[:8]
        email = f"TEST_edge_{unique_id}@test.com"
        password = "TestPass123!"
        name = f"Test Edge {unique_id}"
        
        response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "email": email,
            "password": password,
            "name": name,
            "home_language": "en",
            "city": "Pune"
        })
        
        if response.status_code == 200:
            data = response.json()
            return {
                "email": email,
                "password": password,
                "name": name,
                "token": data.get("access_token"),
                "user_id": data.get("user", {}).get("id")
            }
        else:
            pytest.skip(f"Failed to create test user: {response.text}")
    
    def test_remove_from_nonexistent_household(self, test_user):
        """Test removing member from non-existent household returns 404"""
        headers = {"Authorization": f"Bearer {test_user['token']}"}
        fake_household_id = str(uuid.uuid4())
        fake_member_id = str(uuid.uuid4())
        
        response = requests.delete(
            f"{BASE_URL}/api/households/{fake_household_id}/member/{fake_member_id}",
            headers=headers
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print("✓ Non-existent household correctly returns 404")
    
    def test_unauthenticated_remove_request(self):
        """Test that unauthenticated request returns 401"""
        fake_household_id = str(uuid.uuid4())
        fake_member_id = str(uuid.uuid4())
        
        response = requests.delete(
            f"{BASE_URL}/api/households/{fake_household_id}/member/{fake_member_id}"
        )
        
        # Should return 401 or 403 for unauthenticated request
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Unauthenticated request correctly denied")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
