/**
 * Price history on the inventory listing.
 *
 * The question this answers is not "what does this cost" — it is "the monthly
 * shop is coming, is anything getting more expensive". So both surfaces lead
 * with the rate and follow it with the direction of travel.
 *
 * Two pieces, deliberately different in weight:
 *
 *   PriceCaption      one glance while scrolling 40 rows: ₹149/kg ↑12%.
 *                     Renders nothing without a trustworthy price, so the
 *                     list is unchanged for households that never scan a
 *                     receipt — which is most of them for the first month.
 *
 *   PriceHistoryPanel the drill-down, inside an opened row: what, when,
 *                     where, what it was before, and what a refill costs.
 *
 * Colour follows the household's wallet, not the market: a rise is amber/red
 * because it is bad news for the person reading it, a fall is green.
 */
import { Receipt, TrendingDown, TrendingUp } from 'lucide-react';
import { priceChange, estimatedRestockCost } from '@/hooks/useLastPrices';
import { formatAge, formatPriceDate, formatRate, formatRupees } from '@/lib/priceFormat';

const UP = 'text-[#C2410C]';
const DOWN = 'text-green-700';

/** Shared wording so the caption's tooltip and the panel never drift apart. */
const changeSentence = (change) => {
  if (!change) return null;
  const was = `₹${formatRate(change.from)}/${change.previous.unit_basis}`;
  if (change.direction === 'flat') return `Same as last time (${was})`;
  const verb = change.direction === 'up' ? 'up' : 'down';
  return `${Math.round(change.abs)}% ${verb} from ${was}`;
};

/**
 * The compact caption for a list row or card.
 *
 * Sits on the existing meta line rather than adding a third line: the row's
 * height is set by its 40px stepper, and a line per price would have made
 * priced and unpriced rows different heights down the whole list.
 */
export const PriceCaption = ({ price, className = '' }) => {
  if (!price?.rate || price.stale) return null;
  const rate = formatRate(price.rate);
  if (!rate) return null;

  const change = priceChange(price);
  const when = formatPriceDate(price.bought_on);
  const sentence = changeSentence(change);

  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] md:text-xs text-gray-500 whitespace-nowrap ${className}`}
      title={`Last paid ₹${rate}/${price.unit_basis}${when ? ` on ${when}` : ''}${sentence ? ` · ${sentence}` : ''}`}
      data-testid="price-caption"
    >
      <span className="font-semibold text-gray-700">₹{rate}/{price.unit_basis}</span>
      {/* Only a change worth acting on earns the arrow. A 2% drift is receipt
          rounding, and badging it on every row would make the badge mean
          nothing by the time a real 30% jump turns up. */}
      {change?.significant && (
        <span
          className={`inline-flex items-center gap-0.5 font-semibold ${
            change.direction === 'up' ? UP : DOWN
          }`}
        >
          {change.direction === 'up'
            ? <TrendingUp className="w-3 h-3" />
            : <TrendingDown className="w-3 h-3" />}
          {Math.round(change.abs)}%
        </span>
      )}
    </span>
  );
};

/**
 * The full record, for a row the user has deliberately opened.
 *
 * Unlike the caption this does show a stale price — labelled by age. Someone
 * who opened the item is asking a direct question, and "₹149/kg, 4 months
 * ago" is a better answer than silence; silence reads as "never recorded".
 */
export const PriceHistoryPanel = ({ price, monthlyNeed, baseUnit }) => {
  // No history at all: one quiet line explaining where prices come from. This
  // is the only place the feature can be discovered by someone who has never
  // scanned a receipt, and it costs a row that is already open.
  if (!price?.rate) {
    return (
      <div className="mb-3 p-2 rounded-lg bg-gray-50 border border-gray-200">
        <p className="text-xs text-gray-500 flex items-center gap-1.5">
          <Receipt className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
          No price recorded yet — scan a receipt to start tracking it.
        </p>
      </div>
    );
  }

  const rate = formatRate(price.rate);
  const when = formatPriceDate(price.bought_on);
  const change = priceChange(price);
  const sentence = changeSentence(change);
  const estimate = estimatedRestockCost(price, monthlyNeed, baseUnit);

  return (
    <div
      className={`mb-3 p-2 rounded-lg border ${
        price.stale ? 'bg-gray-50 border-gray-200' : 'bg-[#FFFBF0] border-[#FFCC00]/40'
      }`}
      data-testid="price-history-panel"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-gray-700">Last paid</span>
        <span className={`text-sm font-bold tabular-nums ${price.stale ? 'text-gray-500' : 'text-gray-800'}`}>
          ₹{rate}<span className="text-xs font-semibold">/{price.unit_basis}</span>
        </span>
      </div>

      <div className="mt-0.5 flex items-baseline justify-between gap-2">
        <span className="text-[11px] text-gray-500 truncate">
          {when}
          {price.vendor && ` · ${price.vendor}`}
        </span>
        {/* The caption suppresses small moves; here there is room to say
            "about the same", which is itself useful when you are deciding
            whether to shop around. */}
        {sentence && (
          <span
            className={`text-[11px] font-medium whitespace-nowrap ${
              change.direction === 'flat' ? 'text-gray-500'
                : change.direction === 'up' ? UP : DOWN
            }`}
          >
            {sentence}
          </span>
        )}
      </div>

      {/* A rate per kilo is hard to budget with; a rupee figure for this
          item's own monthly need is the number that actually goes into
          "what will next month cost". Absent whenever the units cannot be
          multiplied honestly — see estimatedRestockCost. */}
      {estimate && !price.stale && (
        <p className="mt-1 pt-1 border-t border-gray-200/70 text-[11px] text-gray-600">
          About <span className="font-semibold text-gray-800">₹{formatRupees(estimate)}</span> to
          refill a month&apos;s need at this rate
        </p>
      )}

      {price.stale && (
        <p className="mt-1 pt-1 border-t border-gray-200 text-[11px] text-gray-500">
          {formatAge(price.ageDays) || 'An old price'} — too old to compare against,
          shown for reference only.
        </p>
      )}
    </div>
  );
};

export default PriceCaption;
