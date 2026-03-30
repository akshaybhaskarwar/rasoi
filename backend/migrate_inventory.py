"""
Migration script: Add missing essential items to all existing households
and update existing items with aliases.

Usage: python migrate_inventory.py

This script:
1. Gets the expanded essentials list from pantry_items.py
2. For each household, checks which items are missing (by name_en)
3. Inserts only missing items with stock_level="empty"
4. Updates existing items to add aliases where missing
"""
import os
import uuid
from datetime import datetime, timezone
from dotenv import load_dotenv
from pymongo import MongoClient

# Import from the project
from data.pantry_items import get_essentials_pack

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL")
DB_NAME = os.getenv("DB_NAME")

client = MongoClient(MONGO_URL)
db = client[DB_NAME]


def migrate():
    # Get the full essentials pack with aliases
    essentials = get_essentials_pack()
    print(f"Essentials pack has {len(essentials)} items")

    # Build a lookup by name_en (lowercase) for alias updates
    essentials_by_name = {}
    for item in essentials:
        essentials_by_name[item["name_en"].lower()] = item

    # Get all households
    households = list(db.households.find({}))
    print(f"Found {len(households)} households\n")

    total_added = 0
    total_aliases_updated = 0

    for household in households:
        household_id = household.get("id")
        if not household_id:
            continue

        household_name = household.get("name", "Unknown")
        print(f"Processing household: {household_name} ({household_id})")

        # Get existing inventory for this household
        existing_items = list(db.inventory.find({"household_id": household_id}))
        existing_names = set()
        for item in existing_items:
            name = item.get("name_en", "").lower()
            if name:
                existing_names.add(name)

        # 1. Add missing items
        items_to_add = []
        for essential in essentials:
            if essential["name_en"].lower() not in existing_names:
                items_to_add.append({
                    "id": str(uuid.uuid4()),
                    "household_id": household_id,
                    "name_en": essential["name_en"],
                    "name_mr": essential["name_mr"],
                    "name_hi": essential["name_hi"],
                    "aliases": essential.get("aliases", []),
                    "category": essential["category"],
                    "unit": essential["unit"],
                    "stock_level": "empty",
                    "current_stock": 0,
                    "monthly_quantity": essential["monthly_quantity"],
                    "freshness": None,
                    "is_secret_stash": False,
                    "expiry_date": None,
                    "barcode": None,
                    "reserved_for": [],
                    "last_updated_by": "migration",
                    "created_at": datetime.now(timezone.utc).isoformat()
                })

        if items_to_add:
            db.inventory.insert_many(items_to_add)
            total_added += len(items_to_add)
            print(f"  Added {len(items_to_add)} new items")
        else:
            print(f"  No new items needed")

        # 2. Update existing items with aliases (if they don't have aliases yet)
        aliases_updated = 0
        for item in existing_items:
            name = item.get("name_en", "").lower()
            if name in essentials_by_name:
                essential = essentials_by_name[name]
                new_aliases = essential.get("aliases", [])
                existing_aliases = item.get("aliases", [])

                # Also update missing mr/hi translations
                update_fields = {}
                if new_aliases and not existing_aliases:
                    update_fields["aliases"] = new_aliases
                if essential.get("name_mr") and not item.get("name_mr"):
                    update_fields["name_mr"] = essential["name_mr"]
                if essential.get("name_hi") and not item.get("name_hi"):
                    update_fields["name_hi"] = essential["name_hi"]
                # Update mr/hi if they are same as English (meaning they were not translated)
                if item.get("name_mr") == item.get("name_en") and essential.get("name_mr"):
                    update_fields["name_mr"] = essential["name_mr"]
                if item.get("name_hi") == item.get("name_en") and essential.get("name_hi"):
                    update_fields["name_hi"] = essential["name_hi"]

                if update_fields:
                    db.inventory.update_one(
                        {"_id": item["_id"]},
                        {"$set": update_fields}
                    )
                    aliases_updated += 1

        if aliases_updated:
            total_aliases_updated += aliases_updated
            print(f"  Updated {aliases_updated} existing items with aliases/translations")

        print()

    print(f"\n{'='*50}")
    print(f"Migration complete!")
    print(f"Total new items added: {total_added}")
    print(f"Total existing items updated: {total_aliases_updated}")

    client.close()


if __name__ == "__main__":
    migrate()
