#!/usr/bin/env python3
"""
Export the festival collection to the same CSV format the admin panel uploads.

Purpose
-------
The festival calendar lives only in MongoDB. To add Marathi/Hindi translations
to festivals that are already in the database, you need the current rows out
in an editable form, fill in the translation columns, and upload the file back
through Admin -> Festivals -> Upload CSV (which upserts by festival name).

Usage
-----
    cd /var/www/rasoi/backend
    python scripts/export_festivals.py                    # writes festivals_export.csv
    python scripts/export_festivals.py -o /tmp/fest.csv   # custom path
    python scripts/export_festivals.py --stdout           # print instead of writing
    python scripts/export_festivals.py --missing-only     # only rows lacking a translation

IMPORTANT
---------
The upload handler $sets every column in the file, so this exporter writes ALL
of them, including the ones you are not editing. Do not delete columns from the
exported file before re-uploading — a missing column will overwrite the stored
value with an empty one.

Reads MONGO_URL and DB_NAME from the backend .env, exactly like server.py.
"""
import argparse
import csv
import os
import sys

try:
    import pymongo
    from dotenv import load_dotenv
except ImportError as exc:  # pragma: no cover - operator-facing message
    sys.exit(
        f"Missing dependency: {exc.name}.\n"
        "Run this with the backend's virtualenv python, e.g.\n"
        "    venv/bin/python scripts/export_festivals.py"
    )

# Column order matches the admin CSV template and the upload parser's
# expected headers. Each entry is (csv header, mongo field, kind).
COLUMNS = [
    ("Festival Name",           "name",             "str"),
    ("Name (Marathi)",          "name_mr",          "str"),
    ("Name (Hindi)",            "name_hi",          "str"),
    ("Date",                    "date",             "str"),
    ("Significance",            "significance",     "str"),
    ("Significance (Marathi)",  "significance_mr",  "str"),
    ("Significance (Hindi)",    "significance_hi",  "str"),
    ("Key Ingredients",         "key_ingredients",  "comma_list"),
    ("Recipes",                 "recipes",          "pipe_list"),
    ("Tips",                    "tips",             "pipe_list"),
    ("Tips (Marathi)",          "tips_mr",          "pipe_list"),
    ("Tips (Hindi)",            "tips_hi",          "pipe_list"),
    ("Is Fasting Day",          "is_fasting_day",   "yesno"),
    ("Region",                  "region",           "str"),
]

TRANSLATION_FIELDS = ("significance_mr", "significance_hi", "tips_mr", "tips_hi")


def render(value, kind):
    """Turn a Mongo value into the string form the upload parser expects."""
    if value is None:
        return ""
    if kind == "comma_list":
        # csv.writer adds the quoting the parser needs around embedded commas.
        return ", ".join(str(v) for v in value)
    if kind == "pipe_list":
        return "|".join(str(v) for v in value)
    if kind == "yesno":
        return "Yes" if value else "No"
    return str(value)


def needs_translation(doc):
    return not all(doc.get(f) for f in TRANSLATION_FIELDS)


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("-o", "--out", default="festivals_export.csv")
    ap.add_argument("--stdout", action="store_true", help="print the CSV instead of writing a file")
    ap.add_argument("--missing-only", action="store_true",
                    help="export only festivals with at least one empty translation field")
    args = ap.parse_args()

    load_dotenv()
    try:
        mongo_url = os.environ["MONGO_URL"]
        db_name = os.environ["DB_NAME"]
    except KeyError as exc:
        sys.exit(f"{exc.args[0]} is not set. Run this from the backend directory so .env is found.")

    db = pymongo.MongoClient(mongo_url)[db_name]
    docs = list(db.festivals.find({}, {"_id": 0}).sort("date", 1))

    total = len(docs)
    if args.missing_only:
        docs = [d for d in docs if needs_translation(d)]

    out = sys.stdout if args.stdout else open(args.out, "w", newline="", encoding="utf-8")
    try:
        writer = csv.writer(out)
        writer.writerow([header for header, _, _ in COLUMNS])
        for doc in docs:
            writer.writerow([render(doc.get(field), kind) for _, field, kind in COLUMNS])
    finally:
        if out is not sys.stdout:
            out.close()

    if not args.stdout:
        missing = sum(1 for d in docs if needs_translation(d))
        print(f"Wrote {len(docs)} of {total} festivals to {args.out}")
        print(f"{missing} still need at least one translation field filled in.")


if __name__ == "__main__":
    main()
