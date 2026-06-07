# OCR Benchmark

Throwaway tool to decide which OCR / vision backend to use for the
"update inventory from receipt" feature.

## Quick start

```bash
cd tools/ocr_benchmark
python3 -m venv .venv && source .venv/bin/activate
pip install pillow pillow-heif

# Add any backends you want to compare (each is optional):
pip install paddleocr paddlepaddle             # self-hosted, free
pip install google-cloud-vision                # cloud, 1000/mo free tier
pip install anthropic                          # cloud, ~₹0.10/receipt

# Credentials for cloud backends (only set the ones you'll run):
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/gcp-key.json
export ANTHROPIC_API_KEY=sk-ant-...

# Drop 5–10 receipt photos into a folder and run:
python ocr_benchmark.py ~/Downloads/receipts/
```

## What it does

For every image in the folder, runs each available backend, captures:

- whether the call succeeded
- elapsed seconds
- number of item-like rows detected
- the receipt total (heuristic)
- the raw output (saved as `<image>.<backend>.json`)

Prints a scorecard to stdout and writes `summary.csv` for spreadsheet analysis.

## Notes on each backend

| Backend | Pros | Cons |
|---|---|---|
| **paddleocr** | Free, runs on your VPS, OK Devanagari support | ~500 MB models, slow on CPU (~5 s/receipt), gives you raw text only — you still need to parse columns |
| **google-vision** | Best general-purpose OCR accuracy on Devanagari, 1000/mo free | Pay-per-call after free tier, gives you raw text only |
| **claude-vision** | Returns **structured JSON in one call** (no separate parser needed), strong Devanagari, cheap at low volume | Per-call cost (~₹0.10 / receipt), needs internet |
| **claude-vision+catalog** | Same as above, *plus* injects the project's PANTRY_TEMPLATE (271 Indian grocery items, en/mr/hi/aliases) so Claude can map mangled Devanagari OCR (`अडीस देवळ`) to canonical English (`Urad Dal`) in the same call. Output includes `name_canonical_en` + `match_confidence`. Uses prompt caching so the catalog cost is paid once per run. | Slightly higher first-receipt cost (~₹0.15); subsequent receipts in the same run are about the same as plain claude-vision |
| **google+claude-catalog** | **The winner for Phase 1.** Two-step pipeline: Google reads the image (much better Devanagari character accuracy on thermal-paper Marathi receipts), then Claude (text-only) parses the flattened raw text into structured items AND maps each to the catalog. Cheapest, fastest, most accurate. Output identical to claude-vision+catalog. | Requires both `GOOGLE_APPLICATION_CREDENTIALS` AND `ANTHROPIC_API_KEY` to be set. |

## Side-by-side comparison

```bash
# Run both Claude modes on the same receipts so you can compare item-by-item.
python ocr_benchmark.py ~/Downloads/receipts/ --only claude-vision claude-vision+catalog
```

For each image, check the `_ocr_out/<image>.claude-vision+catalog.json` output and look at:

- The `name_canonical_en` field — does it correctly map the mangled Devanagari to the right catalog entry?
- The `match_confidence` distribution — how many are `high` vs `low` vs `unmatched`?
- The `_usage.cache_read_input_tokens` field — confirms caching is reducing token spend on receipts 2+.

## Picking a winner

After running on ~10 receipts, eyeball the `.json` outputs for the 3 backends
on the same image. The right tradeoff usually falls out immediately:

- If PaddleOCR gets <60% of items, drop it — the parser engineering on top of
  bad OCR isn't worth it.
- If Claude-Vision gets ≥85% with structured output, it almost certainly wins
  on dev-time even if Google has slightly higher raw accuracy.
- If Google-Vision is much better than Claude AND you're cost-sensitive, build
  a parser on top of Google.

## Scope

This is a *prototype*. It is not wired into the backend, it is not deployed,
and the code has rough edges (e.g. the "items detected" count is heuristic —
any line with a digit). The whole point is to make the OCR-quality call
*before* committing to a roadmap, not to ship anything from this folder.
