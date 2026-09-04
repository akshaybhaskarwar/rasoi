/**
 * FrequencyPicker — how often the household buys an item.
 *
 * Two pieces, deliberately kept apart from InventoryItemDetails:
 *
 *   FrequencyPill  — the collapsed indicator. All three frequencies render
 *                    as small text chips in the UI language: an abstract
 *                    repeat glyph tested as unreadable (users couldn't say
 *                    what it meant, and at outline-gray it vanished next to
 *                    the disabled stepper button). Monthly — the default
 *                    for most of the pantry — stays visually quiet (gray,
 *                    outline-only) so the coloured yearly / as-needed
 *                    chips still read as the exceptions.
 *   FrequencyStrip — the three-way picker revealed under the row (list) or
 *                    inside the card (grid) when the pill is tapped.
 *
 * Both are mounted by InventoryRow and the grid card separately rather than
 * living inside InventoryItemDetails — that component is shared by the
 * expanded list row AND the grid card, so putting the picker in it would
 * show the control twice to list users.
 */
import { useLanguage } from '@/contexts/LanguageContext';

export const FREQUENCY_OPTIONS = [
  { value: 'monthly', labelKey: 'freqMonthly', hint: 'Pre-ticked in Plan restock' },
  { value: 'yearly', labelKey: 'freqYearly', hint: 'Bought once a year, in bulk' },
  { value: 'as_needed', labelKey: 'freqAsNeeded', hint: 'Never pre-ticked' },
];

/** Normalise legacy rows, which predate the field. */
export const getFrequency = (item) => item?.purchase_frequency || 'monthly';

const PILL_TONES = {
  monthly: 'border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50',
  yearly: 'bg-amber-50 text-amber-700 hover:bg-amber-100',
  as_needed: 'bg-gray-100 text-gray-600 hover:bg-gray-200',
};

/**
 * Collapsed indicator. Tap target is a full 44px-tall pill — the visual
 * chip is smaller, but anything less than 44 is a miss-tap on a phone.
 */
export const FrequencyPill = ({ value, onClick, itemName }) => {
  const { getLabel } = useLanguage();
  const frequency = value || 'monthly';
  const option = FREQUENCY_OPTIONS.find((o) => o.value === frequency) || FREQUENCY_OPTIONS[0];
  const label = getLabel(option.labelKey);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Buying frequency for ${itemName}: ${label}. Change`}
      data-testid="frequency-pill"
      className="h-11 flex items-center flex-shrink-0"
    >
      {/* The 44px hit area is the button; the visible chip stays small so
          the row doesn't grow a tall box between name and stepper. */}
      <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-medium whitespace-nowrap transition-colors ${PILL_TONES[frequency]}`}>
        {label}
      </span>
    </button>
  );
};

/** The three-way picker. Selecting closes it via the parent's onSelect. */
export const FrequencyStrip = ({ value, onSelect, busy = false }) => {
  const { getLabel } = useLanguage();
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
            {getLabel(option.labelKey)}
          </button>
        );
      })}
    </div>
  );
};
