#!/usr/bin/env python3
"""
Audit and correct festival `date` values.

Why
---
routes/dadi.py accepts several date formats, and for a year-less value like
"Feb 15" it substitutes the current year. Then, for ANY festival whose date has
already passed, it rolls the date forward by one year KEEPING THE SAME MONTH AND
DAY:

    if festival_date < today:
        festival_date = festival_date.replace(year=current_year + 1)

That is correct for solar festivals (Makar Sankranti is always ~14 January) and
WRONG for every lunar one. Ganesh Chaturthi 2026-09-14 does not recur on
2027-09-14; it moves with the Hindu lunar calendar. So a past festival silently
reappears on a plausible-looking but incorrect date.

This script does not fix that logic — it only lets you audit the stored values
and write verified replacements.

Usage
-----
    cd /var/www/rasoi/backend

    # 1. See which dates are year-less or already in the past
    venv/bin/python scripts/fix_festival_dates.py --audit

    # 2. Write verified dates (get them from a panchang — do NOT guess)
    venv/bin/python scripts/fix_festival_dates.py --set "Makar Sankranti=2027-01-14" \
        --set "Mahashivratri=2027-02-15" --dry-run

Only the `date` field is written. Nothing else in the document is touched.
"""
import argparse
import os
import re
import sys
from datetime import datetime

try:
    import pymongo
except ImportError:
    sys.exit("pymongo not found. Use the backend virtualenv, e.g. venv/bin/python scripts/...")

ACCEPTED = ['%b %d', '%B %d', '%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y']


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


def classify(date_str, today):
    """Return (kind, note) describing how the app will interpret this value."""
    for fmt in ACCEPTED:
        try:
            parsed = datetime.strptime(date_str, fmt)
        except ValueError:
            continue
        yearless = parsed.year == 1900
        if yearless:
            parsed = parsed.replace(year=today.year)
        rolled = parsed < today
        shown = parsed.replace(year=today.year + 1) if rolled else parsed
        if yearless and rolled:
            return "yearless+rolled", f"no year; will display as {shown.date()}"
        if yearless:
            return "yearless", f"no year; assumed {shown.date()}"
        if rolled:
            return "past+rolled", f"passed; will display as {shown.date()} (same month/day)"
        return "ok", f"upcoming on {shown.date()}"
    return "unparseable", "no accepted format matched; festival is skipped entirely"


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--audit", action="store_true", help="report how each stored date is interpreted")
    ap.add_argument("--set", action="append", default=[], metavar="NAME=YYYY-MM-DD",
                    help="set one festival's date; repeatable")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if not args.audit and not args.set:
        ap.error("nothing to do: pass --audit or at least one --set")

    mongo_url, db_name = load_env()
    db = pymongo.MongoClient(mongo_url)[db_name]
    today = datetime.now()

    if args.audit:
        docs = list(db.festivals.find({}, {"_id": 0, "name": 1, "date": 1}))
        buckets = {}
        for d in docs:
            kind, note = classify(d.get("date", ""), today)
            buckets.setdefault(kind, []).append((d.get("name"), d.get("date"), note))
        for kind in ("unparseable", "yearless+rolled", "yearless", "past+rolled", "ok"):
            rows = buckets.get(kind, [])
            if not rows:
                continue
            print(f"\n[{kind}]  {len(rows)}")
            for name, raw, note in sorted(rows, key=lambda r: r[0] or ""):
                print(f"   {name:32} {raw:12} {note}")
        print(f"\ntotal: {len(docs)} festivals")
        if not args.set:
            return

    for pair in args.set:
        if "=" not in pair:
            print(f"skipping malformed --set {pair!r} (expected NAME=YYYY-MM-DD)")
            continue
        name, new_date = (p.strip() for p in pair.split("=", 1))
        try:
            datetime.strptime(new_date, "%Y-%m-%d")
        except ValueError:
            print(f"skipping {name}: {new_date!r} is not YYYY-MM-DD")
            continue

        doc = db.festivals.find_one({"name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}})
        if not doc:
            print(f"NOT FOUND: {name}")
            continue
        if args.dry_run:
            print(f"WOULD SET  {doc['name']}: {doc.get('date')!r} -> {new_date}")
        else:
            db.festivals.update_one({"_id": doc["_id"]}, {"$set": {"date": new_date}})
            print(f"set  {doc['name']}: {doc.get('date')!r} -> {new_date}")


if __name__ == "__main__":
    main()
