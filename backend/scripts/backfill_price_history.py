#!/usr/bin/env python3
"""
Seed `price_history` from the receipts still present in `db.receipts`.

Why this is time-sensitive
--------------------------
`db.receipts` carries a 30-day TTL index. Every receipt older than that has
already been deleted by MongoDB, along with the per-item prices inside it.
Whatever is left in the collection right now is the only recoverable price
history that exists — run this before those documents age out too.

Rows are filtered exactly as the live receipt path filters them: trusted match
confidence only, a usable rate, and rate*qty reconciling with the printed
amount. See models/prices.py for why each of those matters.

Usage
-----
    cd /var/www/rasoi/backend
    venv/bin/python scripts/backfill_price_history.py --dry-run
    venv/bin/python scripts/backfill_price_history.py

Safe to re-run: rows are keyed on (household, item, receipt) so a second run
skips what it already wrote rather than duplicating it.
"""
import argparse
import os
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import pymongo
except ImportError:
    sys.exit("pymongo not found. Use the backend virtualenv, e.g. venv/bin/python scripts/...")

from models.prices import price_from_receipt_row  # noqa: E402


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
    ap.add_argument("--verbose", action="store_true", help="print every skipped row and why")
    args = ap.parse_args()

    mongo_url, db_name = load_env()
    db = pymongo.MongoClient(mongo_url)[db_name]

    receipts = list(db.receipts.find({}, {"raw_ocr_text": 0}).sort("created_at", 1))
    print(f"receipts available: {len(receipts)}")
    if not receipts:
        print("Nothing to backfill — the TTL has already removed everything.")
        return

    written = skipped = duplicate = 0
    reasons = Counter()

    for r in receipts:
        household_id = r.get("household_id")
        if not household_id:
            continue
        bought_on = r.get("created_at")
        for row in (r.get("parsed_items") or []):
            record, why = price_from_receipt_row(
                row,
                household_id=household_id,
                vendor=r.get("vendor"),
                receipt_id=r.get("id"),
                bought_on=bought_on,
            )
            if not record:
                skipped += 1
                reasons[why] += 1
                if args.verbose:
                    print(f"  skip {row.get('name_canonical_en') or '?':24} {why}")
                continue

            # Idempotency: same item from the same receipt is the same purchase.
            exists = db.price_history.find_one({
                "household_id": household_id,
                "canonical_name": record.canonical_name,
                "receipt_id": record.receipt_id,
            })
            if exists:
                duplicate += 1
                continue

            if args.dry_run:
                print(f"  WOULD WRITE  {record.canonical_name:24} "
                      f"₹{record.rate:g}/{record.unit_basis}  {str(bought_on)[:10]}")
            else:
                db.price_history.insert_one(record.model_dump())
            written += 1

    print()
    print(f"{'would write' if args.dry_run else 'written'}: {written}")
    if duplicate:
        print(f"already present (skipped): {duplicate}")
    if skipped:
        print(f"skipped: {skipped}")
        for why, n in reasons.most_common():
            print(f"   {n:4}  {why}")


if __name__ == "__main__":
    main()
