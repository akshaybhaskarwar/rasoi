#!/usr/bin/env python3
"""
Recompute every inventory item's `stock_level` from its actual quantity.

Why
---
The app has two answers for "is this low?".

  Inventory screen : computed live from current_stock vs monthly_quantity
  Shopping list    : reads the STORED stock_level field

The receipt path used to hardcode "stock_level": "full" on every item it
touched, whatever the quantity. So an item could sit at 3g of a 200g monthly
need — plainly "low", and displayed that way on Inventory — while carrying a
stored "full". The shopping list read the stored value, concluded there was
nothing to buy, and never offered it. The restock loop silently stopped
working for every item a receipt had ever touched.

The write sites are fixed; this repairs the rows already in that state.

Usage
-----
    cd /var/www/rasoi/backend
    venv/bin/python3 scripts/recompute_stock_levels.py --dry-run
    venv/bin/python3 scripts/recompute_stock_levels.py

Only `stock_level` is written. Quantities are never touched.
"""
import argparse
import os
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import pymongo
except ImportError:
    sys.exit("pymongo not found. Use the backend virtualenv: venv/bin/python3 scripts/...")

from models.inventory import compute_stock_level, default_monthly_base_units  # noqa: E402


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
    ap.add_argument("--limit", type=int, default=40, help="rows to print (default 40)")
    args = ap.parse_args()

    mongo_url, db_name = load_env()
    db = pymongo.MongoClient(mongo_url)[db_name]

    items = list(db.inventory.find({}, {"_id": 0}))
    changes = []
    transitions = Counter()

    for item in items:
        monthly = item.get("monthly_quantity")
        if not monthly:
            # No explicit target — fall back to the category default, in base
            # units so it is comparable with current_stock. Same helper the
            # PUT endpoint uses, so script and API always agree.
            monthly = default_monthly_base_units(item.get("category"))

        correct = compute_stock_level(item.get("current_stock"), monthly)
        stored = item.get("stock_level")
        if correct != stored:
            changes.append((item, stored, correct))
            transitions[f"{stored} -> {correct}"] += 1

    print(f"inventory items : {len(items)}")
    print(f"needing repair  : {len(changes)}")

    if not changes:
        print("\nEverything already consistent.")
        return

    print()
    for item, stored, correct in changes[:args.limit]:
        print(f"  {(item.get('name_en') or '?')[:28]:28} "
              f"{str(item.get('current_stock')):>8} / {str(item.get('monthly_quantity')):<8} "
              f"{stored!r:>9} -> {correct!r}")
    if len(changes) > args.limit:
        print(f"  ... and {len(changes) - args.limit} more")

    print("\ntransitions:")
    for k, n in transitions.most_common():
        print(f"  {n:5}  {k}")

    if args.dry_run:
        print("\nDry run — nothing written.")
        return

    for item, _stored, correct in changes:
        db.inventory.update_one({"id": item["id"]}, {"$set": {"stock_level": correct}})

    print(f"\nupdated: {len(changes)}")
    print("The shopping list's \"Update N\" button should now offer the low items.")


if __name__ == "__main__":
    main()
