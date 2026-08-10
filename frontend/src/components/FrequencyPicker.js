/**
 * FrequencyPicker — how often the household buys an item.
 *
 * Two pieces, deliberately kept apart from InventoryItemDetails:
 *
 *   FrequencyPill  — the collapsed indicator. `monthly` is the default for
 *                    the large majority of pantry rows, so it renders as a
 *                    near-silent outline icon; only `yearly` and
 *                    `as_needed` get a coloured badge. Decorating every
 *                    monthly row would mean 60 rows of noise to say
 *                    "normal" and would bury the handful that differ.
 *   FrequencyStrip — the three-way picker revealed under the row (list) or
 *                    inside the card (grid) when the pill is tapped.
 *
 * Both are mounted by InventoryRow and the grid card separately rather than
 * living inside InventoryItemDetails — that component is shared by the
 * expanded list row AND the grid card, so putting the picker in it would
 * show the control twice to list users.
 */
import { Repeat } from 'lucide-react';

export const FREQUENCY_OPTIONS = [
  { value: 'monthly', label: 'Monthly', hint: 'Refilled by "Start new month"' },
  { value: 'yearly', label: 'Yearly', hint: 'Bought once a year, in bulk' },
  { value: 'as_needed', label: 'As needed', hint: 'Never auto-refilled' },
];

/** Normalise legacy rows, which predate the field. */
export const getFrequency = (item) => item?.purchase_frequency || 'monthly';

/**
 * Collapsed indicator. Tap target is a full 44px square/pill — the visual
 * glyph is smaller, but anything less than 44 is a miss-tap on a phone.
 */
export const FrequencyPill = ({ value, onClick, itemName }) => {
  const frequency = value || 'monthly';
  const label = frequency === 'yearly' ? 'once a year'
    : frequency === 'as_needed' ? 'as needed'
    : 'every month';

  if (frequency === 'monthly') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={`Buying frequency for ${itemName}: ${label}. Change`}
        data-testid="frequency-pill"
        className="w-8 h-11 flex items-center justify-center rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-50 transition-colors flex-shrink-0"
      >
        <Repeat className="w-4 h-4" />
      </button>
    );
  }

  const tone = frequency === 'yearly'
    ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
    : 'bg-gray-100 text-gray-600 hover:bg-gray-200';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Buying frequency for ${itemName}: ${label}. Change`}
      data-testid="frequency-pill"
      className={`h-11 px-2 flex items-center rounded-full text-[11px] font-medium whitespace-nowrap transition-colors flex-shrink-0 ${tone}`}
    >
      {frequency === 'yearly' ? '1 / yr' : 'as needed'}
    </button>
  );
};

/** The three-way picker. Selecting closes it via the parent's onSelect. */
export const FrequencyStrip = ({ value, onSelect, busy = false }) => {
  const current = value || 'monthly';
  return (
    <div
      className="flex gap-1.5 px-3 pb-2.5"
      role="radiogroup"
      aria-label="How often do you buy this?"
      data-testid="frequency-strip"
    >
      {FREQUENCY_OPTIONS.map((option) => {
        const isActive = current === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={busy}
            title={option.hint}
            onClick={() => onSelect(option.value)}
            data-testid={`frequency-option-${option.value}`}
            className={`flex-1 min-h-[44px] px-1 rounded-lg text-xs font-medium border transition-colors disabled:opacity-60 ${
              isActive
                ? option.value === 'yearly'
                  ? 'border-amber-400 bg-amber-50 text-amber-700'
                  : option.value === 'as_needed'
                    ? 'border-gray-400 bg-gray-100 text-gray-700'
                    : 'border-orange-400 bg-orange-50 text-orange-700'
                : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};
