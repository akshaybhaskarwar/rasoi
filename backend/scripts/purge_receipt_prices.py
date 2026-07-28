#!/usr/bin/env python3
"""
Delete receipt-sourced rows from `price_history`, keeping manual entries.

Why
---
The receipt parser pairs item names with the wrong number rows: the OCR
flattens the receipt's columns and the model reconstructs the pairing by
inference, which drifts. On a real receipt this stored "Groundnuts" at
190/pack (the tea line below it) when the paper said 160/K.

Those rows are indistinguishable from correct ones once written, so the only
safe move is to drop everything with source='receipt' and re-seed after the
pairing is fixed. Manually-entered prices (source='manual') are the user's own
typing and are left alone.

Usage
-----
    cd /var/www/rasoi/backend
    venv/bin/python scripts/purge_receipt_prices.py --dry-run
    venv/bin/python scripts/purge_receipt_prices.py

    # narrow to one receipt instead of all of them
    venv/bin/python scripts/purge_receipt_prices.py --receipt-id <id>
"""
import argparse
import os
import sys
from collections import Counter

try:
    import pymongo
except ImportError:
    sys.exit("pymongo not found. Use the backend virtualenv, e.g. venv/bin/python scripts/...")


def load_env():
    if "MONGO_URL" in os.environ and "DB_NAME" in os.environ:
        return os.environ["MONGO_URL"], os.environ["DB_NAME"]
    env = {}
    try:
        with open(".env", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if "=" in line and not line.startswith("#"):
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip().strip('"').strip("'")
    except FileNotFoundError:
        sys.exit("No .env found. Run this from /var/www/rasoi/backend.")
    try:
        return env["MONGO_URL"], env["DB_NAME"]
    except KeyError as exc:
        sys.exit(f"{exc.args[0]} missing from .env")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--receipt-id", help="only purge rows from this receipt")
    args = ap.parse_args()

    mongo_url, db_name = load_env()
    db = pymongo.MongoClient(mongo_url)[db_name]

    query = {"source": "receipt"}
    if args.receipt_id:
        query["receipt_id"] = args.receipt_id

    doomed = list(db.price_history.find(query, {"_id": 0}))
    kept = db.price_history.count_documents({"source": {"$ne": "receipt"}})

    print(f"price_history total : {db.price_history.count_documents({})}")
    print(f"  source=receipt    : {db.price_history.count_documents({'source': 'receipt'})}")
    print(f"  source=manual etc : {kept}  (never touched)")
    print(f"  matching this run : {len(doomed)}")

    if not doomed:
        print("\nNothing to delete.")
        return

    print()
    by_receipt = Counter(d.get("receipt_id") or "(none)" for d in doomed)
    for d in doomed[:25]:
        print(f"  {'would delete' if args.dry_run else 'deleting'}  "
              f"{d.get('canonical_name','?')[:26]:26} "
              f"Rs{d.get('rate'):>8}/{d.get('unit_basis','?'):<4} "
              f"{str(d.get('bought_on'))[:10]}")
    if len(doomed) > 25:
        print(f"  ... and {len(doomed) - 25} more")

    print("\nby receipt:")
    for rid, n in by_receipt.most_common():
        print(f"  {n:4}  {rid}")

    if args.dry_run:
        print("\nDry run — nothing deleted. Re-run without --dry-run to apply.")
        return

    result = db.price_history.delete_many(query)
    print(f"\ndeleted: {result.deleted_count}")
    print(f"remaining in price_history: {db.price_history.count_documents({})}")
    print("\nRe-seed with scripts/backfill_price_history.py once the pairing fix is deployed.")


if __name__ == "__main__":
    main()
