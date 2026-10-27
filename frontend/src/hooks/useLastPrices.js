/**
 * useLastPrices — the "last paid" map for the household's shopping list.
 *
 * One request returns every item's most recent price, keyed by lowercased
 * canonical name. A 30-item list would otherwise be 30 lookups.
 *
 * Prices come from two places and are read identically here:
 *   - receipt scans (rate parsed from the receipt, written on confirm)
 *   - manual entry after marking an item purchased
 */
import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

// A rate the household paid long ago is worse than showing nothing — it reads
// as current and quietly misleads. Produce moves week to week, so it gets a
// much shorter window than a sack of wheat.
const MAX_AGE_DAYS = { vegetables: 21, fruits: 21, dairy: 30, default: 120 };

export const priceAgeLimit = (category) =>
  MAX_AGE_DAYS[category] ?? MAX_AGE_DAYS.default;

/** Days between `iso` and now, or null if unparseable. */
export const daysSince = (iso) => {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  return Math.floor((Date.now() - then.getTime()) / 86400000);
};

/**
 * Look up an item's price history entry, stale or not.
 *
 * Returns the entry annotated with `ageDays` and `stale`. Two callers want
 * two different things from the same lookup: a list row should stay silent
 * about a four-month-old rate, while a panel the user deliberately opened is
 * better off showing it labelled "4 months ago" than pretending no price was
 * ever recorded.
 */
export const priceFor = (prices, item) => {
  if (!prices || !item?.name_en) return null;
  const entry = prices[item.name_en.trim().toLowerCase()];
  if (!entry || !entry.rate) return null;
  const age = daysSince(entry.bought_on);
  return {
    ...entry,
    ageDays: age,
    stale: age === null || age > priceAgeLimit(item.category),
  };
};

/**
 * Look up a usable price for an item, or null.
 * Returns null when there is no history OR the history is too old to trust,
 * so callers can simply render nothing.
 */
export const usablePrice = (prices, item) => {
  const entry = priceFor(prices, item);
  return entry && !entry.stale ? entry : null;
};

// Receipt rates wobble by a rupee or two on rounding alone. Below this the
// change is noise, and flagging it would train people to ignore the flag.
export const PRICE_CHANGE_NOISE_PCT = 5;

/**
 * How this item's latest rate compares with the purchase before it.
 * Returns null when there is nothing honest to compare.
 *
 * A ₹/pack price is never compared against a ₹/kg one: receipts do not record
 * pack size, so the two are different quantities wearing the same label.
 */
export const priceChange = (price) => {
  const prev = price?.previous;
  if (!price?.rate || !prev?.rate) return null;
  if (prev.unit_basis && price.unit_basis && prev.unit_basis !== price.unit_basis) return null;

  const from = Number(prev.rate);
  const to = Number(price.rate);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from <= 0) return null;

  const pct = ((to - from) / from) * 100;
  return {
    pct,
    abs: Math.abs(pct),
    direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat',
    // Callers that have room (the expanded panel) show every change; the list
    // row shows only the ones worth interrupting a scan for.
    significant: Math.abs(pct) >= PRICE_CHANGE_NOISE_PCT,
    from,
    to,
    previous: prev,
  };
};

/**
 * What refilling this item to its monthly need would cost at the last rate,
 * or null when the two cannot be multiplied honestly.
 *
 * `monthlyNeed` is in base units (g / ml / pcs); `unit_basis` is kg, L or
 * pack. An item counted in pieces but priced per kilo has no answer here —
 * the pack size is nowhere in the data — so it returns null rather than
 * inventing a number that would look authoritative on screen.
 */
export const estimatedRestockCost = (price, monthlyNeed, baseUnit) => {
  const rate = Number(price?.rate);
  const need = Number(monthlyNeed);
  if (!Number.isFinite(rate) || !Number.isFinite(need) || rate <= 0 || need <= 0) return null;

  const basis = (price.unit_basis || '').toLowerCase();
  const unit = (baseUnit || '').toLowerCase();

  let qty = null;
  if (basis === 'kg') qty = unit === 'g' ? need / 1000 : unit === 'kg' ? need : null;
  else if (basis === 'l') qty = unit === 'ml' ? need / 1000 : unit === 'l' ? need : null;
  else if (basis === 'pack') qty = unit === 'pcs' || unit === 'pack' ? need : null;

  if (qty === null) return null;
  const cost = rate * qty;
  return Number.isFinite(cost) && cost > 0 ? cost : null;
};

export const useLastPrices = () => {
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(false);

  const fetchPrices = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/shopping/last-prices`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPrices(res.data?.prices || {});
    } catch (err) {
      // Non-fatal by design: the shopping list must work identically when
      // price history is unavailable. Rows simply show no "last paid" line.
      console.error('Failed to fetch last prices:', err?.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPrices(); }, [fetchPrices]);

  return { prices, loading, refreshPrices: fetchPrices };
};

export default useLastPrices;
