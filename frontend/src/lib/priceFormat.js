/**
 * Shared price formatting.
 *
 * These started inside LastPaidLine, but the inventory listing now shows the
 * same numbers in two more places (the row caption and the expanded panel).
 * Three copies of "trim the trailing zeros" is how ₹45.50 and ₹45.5 end up on
 * the same screen.
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "30 Jun", or null when the date is unusable. Year is omitted — every price
 *  the UI shows is recent enough that the year is noise. */
export const formatPriceDate = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

// Trim trailing zeros — ₹45.50 reads better as ₹45.5, ₹33.00 as ₹33.
export const formatRate = (rate) => {
  const n = Number(rate);
  if (!Number.isFinite(n)) return null;
  return n % 1 === 0 ? String(n) : String(Number(n.toFixed(2)));
};

/** Whole rupees with Indian digit grouping: 2340 -> "2,340". Estimates are
 *  never precise to the paisa, and "₹2,340.17" would claim otherwise. */
export const formatRupees = (amount) => {
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n);
};

/** "3 months ago" / "12 days ago" — only used where a price is old enough
 *  that its age is the point. Recent prices show their date instead. */
export const formatAge = (days) => {
  if (!Number.isFinite(days)) return null;
  if (days < 45) return `${days} days ago`;
  const months = Math.round(days / 30);
  return months <= 1 ? 'a month ago' : `${months} months ago`;
};
