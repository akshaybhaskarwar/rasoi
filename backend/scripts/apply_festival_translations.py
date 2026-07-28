#!/usr/bin/env python3
"""
Apply reviewed Marathi/Hindi festival translations to MongoDB.

Why this exists instead of the admin CSV upload
-----------------------------------------------
The admin upload handler $sets EVERY column it parses. A CSV that carries only
the translation columns would therefore blank out key_ingredients, recipes,
tips, name_mr and name_hi for every festival in the file — which would break
the readiness scores on the home page.

This script does a targeted $set of significance_mr, significance_hi, tips_mr
and tips_hi only. Nothing else in the document is read or written.

tips_mr / tips_hi are stored as LISTS, index-matched against the existing
`tips` array, because that is how routes/dadi.py reads them back. The CSV holds
them pipe-separated (|) for the multi-tip case.

Usage
-----
    cd /var/www/rasoi/backend
    venv/bin/python scripts/apply_festival_translations.py --dry-run    # show what would change
    venv/bin/python scripts/apply_festival_translations.py              # apply

    # only fill in festivals that have no translation yet, never overwrite
    venv/bin/python scripts/apply_festival_translations.py --skip-existing

Matching is by exact festival name (case-insensitive). Names in the CSV that
are not in the database are reported and skipped, never inserted.
"""
import argparse
import csv
import os
import re
import sys

try:
    import pymongo
except ImportError:
    sys.exit("pymongo not found. Use the backend virtualenv, e.g. venv/bin/python scripts/...")

DEFAULT_CSV = os.path.join(os.path.dirname(os.path.abspath(__file__)), "festival_translations.csv")


def load_env():
    """Read MONGO_URL / DB_NAME from .env without needing python-dotenv."""
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
    ap.add_argument("csv_path", nargs="?", default=DEFAULT_CSV)
    ap.add_argument("--dry-run", action="store_true", help="report changes without writing")
    ap.add_argument("--skip-existing", action="store_true",
                    help="only fill fields that are currently empty")
    ap.add_argument("--fill-empty-english", action="store_true",
                    help="also write significance / tips from the CSV, but ONLY where the "
                         "database currently has none (needed for Ram Navami). Never "
                         "overwrites existing English text.")
    args = ap.parse_args()

    mongo_url, db_name = load_env()
    db = pymongo.MongoClient(mongo_url)[db_name]

    with open(args.csv_path, encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))

    updated = skipped_blank = skipped_existing = 0
    not_found = []

    for row in rows:
        name = (row.get("name") or "").strip()
        mr = (row.get("significance_mr") or "").strip()
        hi = (row.get("significance_hi") or "").strip()
        tips_mr = [t.strip() for t in (row.get("tips_mr") or "").split("|") if t.strip()]
        tips_hi = [t.strip() for t in (row.get("tips_hi") or "").split("|") if t.strip()]

        if not name:
            continue
        if not (mr or hi or tips_mr or tips_hi):
            skipped_blank += 1
            continue

        # Escaped: names like "Holi (Shimga)" contain regex metacharacters.
        doc = db.festivals.find_one({"name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}})
        if not doc:
            not_found.append(name)
            continue

        update = {}
        if mr and not (args.skip_existing and doc.get("significance_mr")):
            update["significance_mr"] = mr
        if hi and not (args.skip_existing and doc.get("significance_hi")):
            update["significance_hi"] = hi
        if tips_mr and not (args.skip_existing and doc.get("tips_mr")):
            update["tips_mr"] = tips_mr
        if tips_hi and not (args.skip_existing and doc.get("tips_hi")):
            update["tips_hi"] = tips_hi

        # Opt-in, and strictly additive: fills a gap, never replaces authored text.
        if args.fill_empty_english:
            sig_en = (row.get("significance_en") or "").strip()
            tips_en = [t.strip() for t in (row.get("tips_en") or "").split("|") if t.strip()]
            if sig_en and not (doc.get("significance") or "").strip():
                update["significance"] = sig_en
            if tips_en and not (doc.get("tips") or []):
                update["tips"] = tips_en

        # A translated tip list shorter than the stored English list would leave
        # later tips falling back to English, which is fine — but a LONGER list
        # means the CSV and the database have drifted, so say so.
        stored_tips = len(doc.get("tips") or [])
        for field in ("tips_mr", "tips_hi"):
            if field in update and len(update[field]) > stored_tips:
                print(f"  warning: {name} has {len(update[field])} {field} "
                      f"but only {stored_tips} English tips; extras will not display")

        if not update:
            skipped_existing += 1
            continue

        if args.dry_run:
            print(f"WOULD UPDATE  {name}  ({' + '.join(update)})")
        else:
            db.festivals.update_one({"_id": doc["_id"]}, {"$set": update})
            print(f"updated  {name}")
        updated += 1

    print()
    print(f"{'would update' if args.dry_run else 'updated'}: {updated}")
    if skipped_blank:
        print(f"skipped (no translation in CSV): {skipped_blank}")
    if skipped_existing:
        print(f"skipped (already translated): {skipped_existing}")
    if not_found:
        print(f"NOT FOUND in database ({len(not_found)}): {', '.join(not_found)}")
        print("  -> check for a name mismatch; nothing was inserted for these.")


if __name__ == "__main__":
    main()
