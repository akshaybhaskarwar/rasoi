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
 * Look up a usable price for an item, or null.
 * Returns null when there is no history OR the history is too old to trust,
 * so callers can simply render nothing.
 */
export const usablePrice = (prices, item) => {
  if (!prices || !item?.name_en) return null;
  const entry = prices[item.name_en.trim().toLowerCase()];
  if (!entry || !entry.rate) return null;
  const age = daysSince(entry.bought_on);
  if (age === null) return null;
  if (age > priceAgeLimit(item.category)) return null;
  return { ...entry, ageDays: age };
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
