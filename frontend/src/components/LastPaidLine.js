/**
 * LastPaidLine — the one-line price comparison on a shopping list row.
 *
 *   Last paid ₹149/kg · 30 Jun
 *   Last paid ₹25/pack · Sharma Kirana · 12 Jun
 *
 * Renders nothing at all when there is no usable history. That is the common
 * case for a while after launch, and an empty "—" on every row would be worse
 * than silence.
 *
 * Two things it deliberately does NOT do:
 *  - convert a per-pack price to ₹/kg. Receipts do not record pack size, so
 *    "₹25/pack" cannot honestly become "₹50/kg". Packs are only ever compared
 *    against the same item's previous pack.
 *  - hide the date. A rate without a date reads as current; the date is what
 *    lets someone judge whether it still means anything.
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatDate = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

// Trim trailing zeros — ₹45.50 reads better as ₹45.5, ₹33.00 as ₹33.
const formatRate = (rate) => {
  const n = Number(rate);
  if (!Number.isFinite(n)) return null;
  return n % 1 === 0 ? String(n) : String(Number(n.toFixed(2)));
};

export const LastPaidLine = ({ price, className = '' }) => {
  if (!price?.rate) return null;
  const rate = formatRate(price.rate);
  const when = formatDate(price.bought_on);
  if (!rate) return null;

  // One line, truncated — never wrapped. The name column on this row is
  // already narrow (the quantity selector sits beside it), and a three-line
  // price caption pushed every row taller than the item name itself.
  //
  // Order is by how much each part is worth: rate first, then the date (which
  // is what tells you whether the rate still means anything), then the vendor.
  // Truncation therefore eats the vendor first and the rate last.
  return (
    <p
      className={`text-[11px] md:text-xs text-gray-500 truncate ${className}`}
      title={`Last paid ₹${rate}/${price.unit_basis}${when ? ` on ${when}` : ''}${price.vendor ? ` at ${price.vendor}` : ''}`}
      data-testid="last-paid-line"
    >
      Last paid{' '}
      <span className="font-semibold text-gray-700">₹{rate}/{price.unit_basis}</span>
      {when && <span> · {when}</span>}
      {/* Vendor was absent on 2 of 3 sampled receipts — strictly optional. */}
      {price.vendor && <span> · {price.vendor}</span>}
    </p>
  );
};

export default LastPaidLine;
