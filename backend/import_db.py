"""
Import JSON files exported by export_db.py into a new MongoDB instance.
Usage: python import_db.py "mongodb+srv://user:pass@new-cluster.mongodb.net/dbname"
"""
import os
import sys
import json
from bson import ObjectId
from datetime import datetime
from pymongo import MongoClient


INPUT_DIR = "/tmp/db_export"


def restore_types(obj):
    """Convert serialized MongoDB types back to native types."""
    if isinstance(obj, dict):
        if "$oid" in obj and len(obj) == 1:
            return ObjectId(obj["$oid"])
        if "$date" in obj and len(obj) == 1:
            return datetime.fromisoformat(obj["$date"])
        return {k: restore_types(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [restore_types(item) for item in obj]
    return obj


def import_all(mongo_uri, db_name):
    client = MongoClient(mongo_uri)
    db = client[db_name]
    print(f"Connecting to database: {db_name}")

    json_files = [f for f in os.listdir(INPUT_DIR) if f.endswith(".json")]
    print(f"Found {len(json_files)} collection files to import")

    for filename in json_files:
        col_name = filename.replace(".json", "")
        filepath = os.path.join(INPUT_DIR, filename)

        with open(filepath, "r") as f:
            docs = json.load(f)

        if not docs:
            print(f"  ⊘ {col_name}: empty, skipping")
            continue

        docs = [restore_types(doc) for doc in docs]

        # Drop existing collection to avoid duplicates
        db[col_name].drop()
        db[col_name].insert_many(docs)
        print(f"  ✓ {col_name}: {len(docs)} documents imported")

    client.close()
    print(f"\nDone! All collections imported to {db_name}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print('Usage: python import_db.py "mongodb+srv://user:pass@cluster.mongodb.net" "dbname"')
        sys.exit(1)

    import_all(sys.argv[1], sys.argv[2])
