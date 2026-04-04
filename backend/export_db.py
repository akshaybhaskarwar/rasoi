"""
Export all MongoDB collections to JSON files.
Run from the backend directory: python export_db.py
"""
import os
import json
from datetime import datetime
from bson import ObjectId
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

OUTPUT_DIR = "/tmp/db_export"


class MongoEncoder(json.JSONEncoder):
    """Handle MongoDB-specific types during JSON serialization."""
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return {"$oid": str(obj)}
        if isinstance(obj, datetime):
            return {"$date": obj.isoformat()}
        return super().default(obj)


def export_all():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]

    collections = db.list_collection_names()
    print(f"Found {len(collections)} collections: {collections}")

    for col_name in collections:
        collection = db[col_name]
        docs = list(collection.find())
        count = len(docs)

        filepath = os.path.join(OUTPUT_DIR, f"{col_name}.json")
        with open(filepath, "w") as f:
            json.dump(docs, f, cls=MongoEncoder, indent=2)

        print(f"  ✓ {col_name}: {count} documents → {filepath}")

    client.close()
    print(f"\nDone! All collections exported to {OUTPUT_DIR}")


if __name__ == "__main__":
    export_all()
