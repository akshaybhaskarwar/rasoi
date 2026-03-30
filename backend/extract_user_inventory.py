"""
Extract inventory items from a specific user's household.
Usage: python extract_user_inventory.py
"""
import os
import json
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL")
DB_NAME = os.getenv("DB_NAME")

client = MongoClient(MONGO_URL)
db = client[DB_NAME]

# Find user by email
user = db.users.find_one({"email": "bhaskarwar.tejasvi@gmail.com"})
if not user:
    print("User not found!")
    exit(1)

print(f"Found user: {user.get('name', 'Unknown')} ({user['email']})")
print(f"Active household: {user.get('active_household')}")

household_id = user.get("active_household")
if not household_id:
    # Try to find from households collection
    households = list(db.households.find({"members": {"$elemMatch": {"user_id": str(user["_id"])}}}))
    if households:
        household_id = households[0]["id"]
        print(f"Found household from members: {household_id}")
    else:
        print("No household found for user!")
        exit(1)

# Fetch all inventory items for this household
items = list(db.inventory.find({"household_id": household_id}))
print(f"\nFound {len(items)} inventory items:\n")

# Extract relevant fields
extracted = []
for item in items:
    extracted.append({
        "name_en": item.get("name_en", ""),
        "name_mr": item.get("name_mr", ""),
        "name_hi": item.get("name_hi", ""),
        "category": item.get("category", ""),
        "unit": item.get("unit", ""),
        "monthly_quantity": item.get("monthly_quantity", 0),
        "stock_level": item.get("stock_level", "empty"),
        "current_stock": item.get("current_stock", 0)
    })

# Sort by category then name
extracted.sort(key=lambda x: (x["category"], x["name_en"]))

# Print summary
for item in extracted:
    print(f"  [{item['category']:12s}] {item['name_en']:30s} | mr: {item['name_mr']:20s} | hi: {item['name_hi']:20s} | {item['unit']} | monthly: {item['monthly_quantity']}")

# Save to JSON
output_path = "/tmp/tejasvi_inventory.json"
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(extracted, f, ensure_ascii=False, indent=2)

print(f"\nSaved to {output_path}")
client.close()
