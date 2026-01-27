import requests
import sys
import json
from datetime import datetime, timedelta

class RasoiSyncAPITester:
    def __init__(self, base_url="https://kitchen-manager-15.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "test_name": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {name}")
        if details:
            print(f"    Details: {details}")

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}, Expected: {expected_status}"
            
            if success and response.content:
                try:
                    response_data = response.json()
                    details += f", Response: {json.dumps(response_data, indent=2)[:200]}..."
                except:
                    details += f", Response: {response.text[:100]}..."
            elif not success:
                details += f", Error: {response.text[:200]}"

            self.log_test(name, success, details)
            return success, response.json() if success and response.content else {}

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_health_endpoints(self):
        """Test basic health endpoints"""
        print("\n🔍 Testing Health Endpoints...")
        self.run_test("API Root", "GET", "", 200)
        self.run_test("Health Check", "GET", "health", 200)

    def test_inventory_endpoints(self):
        """Test inventory CRUD operations"""
        print("\n🔍 Testing Inventory Endpoints...")
        
        # Test GET empty inventory
        self.run_test("Get Empty Inventory", "GET", "inventory", 200)
        
        # Test POST new item
        test_item = {
            "name_en": "Test Turmeric",
            "category": "spices",
            "stock_level": "half",
            "freshness": 85,
            "is_secret_stash": False,
            "unit": "kg"
        }
        
        success, item_data = self.run_test("Create Inventory Item", "POST", "inventory", 200, test_item)
        
        if success and item_data.get('id'):
            item_id = item_data['id']
            
            # Test GET inventory with item
            self.run_test("Get Inventory with Item", "GET", "inventory", 200)
            
            # Test GET by category
            self.run_test("Get Inventory by Category", "GET", "inventory", 200, params={"category": "spices"})
            
            # Test PUT update item
            update_data = {"stock_level": "full"}
            self.run_test("Update Inventory Item", "PUT", f"inventory/{item_id}", 200, update_data)
            
            # Test DELETE item
            self.run_test("Delete Inventory Item", "DELETE", f"inventory/{item_id}", 200)
        
        # Test invalid operations
        self.run_test("Update Non-existent Item", "PUT", "inventory/invalid-id", 404, {"stock_level": "full"})
        self.run_test("Delete Non-existent Item", "DELETE", "inventory/invalid-id", 404)

    def test_shopping_endpoints(self):
        """Test shopping list operations"""
        print("\n🔍 Testing Shopping List Endpoints...")
        
        # Test GET empty shopping list
        self.run_test("Get Empty Shopping List", "GET", "shopping", 200)
        
        # Test POST new shopping item
        test_item = {
            "name_en": "Test Basmati Rice",
            "category": "grains",
            "quantity": "2 kg",
            "store_type": "grocery"
        }
        
        success, item_data = self.run_test("Create Shopping Item", "POST", "shopping", 200, test_item)
        
        if success and item_data.get('id'):
            item_id = item_data['id']
            
            # Test GET shopping list with item
            self.run_test("Get Shopping List with Item", "GET", "shopping", 200)
            
            # Test GET by store type
            self.run_test("Get Shopping by Store Type", "GET", "shopping", 200, params={"store_type": "grocery"})
            
            # Test DELETE item
            self.run_test("Delete Shopping Item", "DELETE", f"shopping/{item_id}", 200)
        
        # Test clear shopping list
        self.run_test("Clear Shopping List", "DELETE", "shopping", 200)

    def test_meal_planner_endpoints(self):
        """Test meal planner operations"""
        print("\n🔍 Testing Meal Planner Endpoints...")
        
        # Test GET empty meal plans
        self.run_test("Get Empty Meal Plans", "GET", "meal-plans", 200)
        
        # Test POST new meal plan
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        test_plan = {
            "date": tomorrow,
            "meal_name": "Test Dal Tadka",
            "youtube_video_id": "dQw4w9WgXcQ",  # Rick Roll video ID for testing
            "ingredients_needed": ["tuvar dal", "tomatoes", "cumin"]
        }
        
        success, plan_data = self.run_test("Create Meal Plan", "POST", "meal-plans", 200, test_plan)
        
        if success and plan_data.get('id'):
            plan_id = plan_data['id']
            
            # Test GET meal plans with item
            self.run_test("Get Meal Plans with Item", "GET", "meal-plans", 200)
            
            # Test DELETE meal plan
            self.run_test("Delete Meal Plan", "DELETE", f"meal-plans/{plan_id}", 200)

    def test_recipe_endpoints(self):
        """Test recipe community operations"""
        print("\n🔍 Testing Recipe Community Endpoints...")
        
        # Test GET empty recipes
        self.run_test("Get Empty Recipes", "GET", "recipes", 200)
        
        # Test POST new recipe
        test_recipe = {
            "title": "Test Gujarati Dal",
            "youtube_url": "https://youtube.com/watch?v=dQw4w9WgXcQ",
            "ingredients": ["tuvar dal", "tomatoes", "cumin", "mustard seeds"],
            "author": "Test Chef"
        }
        
        success, recipe_data = self.run_test("Create Recipe", "POST", "recipes", 200, test_recipe)
        
        if success:
            # Test GET recipes with item
            self.run_test("Get Recipes with Item", "GET", "recipes", 200)

    def test_youtube_search(self):
        """Test YouTube search functionality"""
        print("\n🔍 Testing YouTube Search...")
        
        # Test YouTube search
        self.run_test("Search YouTube Recipes", "GET", "youtube/search", 200, params={"query": "dal recipe", "max_results": 3})

    def test_translation_service(self):
        """Test translation functionality"""
        print("\n🔍 Testing Translation Service...")
        
        # Test translation
        translation_request = {
            "text": "turmeric powder",
            "source_language": "en",
            "target_languages": ["gu", "mr"]
        }
        
        self.run_test("Translate Text", "POST", "translate", 200, translation_request)

    def test_festival_intelligence(self):
        """Test festival alert functionality"""
        print("\n🔍 Testing Festival Intelligence...")
        
        # Test festival alert (might return null if no upcoming festivals)
        self.run_test("Get Festival Alert", "GET", "festival-alert", 200)

    def test_gap_analysis(self):
        """Test gap analysis functionality"""
        print("\n🔍 Testing Gap Analysis...")
        
        # Test gap analysis
        self.run_test("Get Gap Analysis", "GET", "gap-analysis", 200)

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Rasoi-Sync API Testing...")
        print(f"Testing against: {self.base_url}")
        
        try:
            self.test_health_endpoints()
            self.test_inventory_endpoints()
            self.test_shopping_endpoints()
            self.test_meal_planner_endpoints()
            self.test_recipe_endpoints()
            self.test_youtube_search()
            self.test_translation_service()
            self.test_festival_intelligence()
            self.test_gap_analysis()
            
        except Exception as e:
            print(f"❌ Critical error during testing: {e}")
        
        # Print summary
        print(f"\n📊 Test Summary:")
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "0%")
        
        return self.tests_passed == self.tests_run

def main():
    tester = RasoiSyncAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/test_reports/backend_test_results.json', 'w') as f:
        json.dump({
            "summary": {
                "tests_run": tester.tests_run,
                "tests_passed": tester.tests_passed,
                "success_rate": (tester.tests_passed/tester.tests_run*100) if tester.tests_run > 0 else 0
            },
            "results": tester.test_results
        }, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())