/**
 * StockQuantityEditor — three-layer quantity input for inventory rows.
 *
 * Replaces the bare +/- stepper with:
 *   1. The stepper (kept for small consumption-style adjustments)
 *   2. Category-aware quick-pick chips (one tap = common restock or target)
 *   3. An inline numpad editor (tap the bold quantity or "Set..." to type
 *      an exact value with a one-tap unit toggle)
 *
 * Used twice per inventory row: once for current_stock (additive chips —
 * "I just bought 1 kg more") and once for monthly_quantity (set chips —
 * "my monthly need is 5 kg").
 */
import { useEffect, useRef, useState } from 'react';
import { Minus, Plus, Check, X } from 'lucide-react';
import { useUnits } from '@/contexts/UnitContext';

// Quick-pick presets per category, in base units (g, ml, or pcs).
// Chosen to cover the most common amounts a user actually buys/needs;
// the inline numpad covers everything else.
const QUICK_CHIP_PRESETS = {
  grains:     [1000, 5000, 10000],
  pulses:     [250, 1000, 5000],
  spices:     [50, 100, 250],
  dairy:      [500, 1000, 2000],
  oils:       [250, 500, 1000],
  vegetables: [500, 1000, 2000],
  fruits:     [500, 1000, 2000],
  snacks:     [100, 250, 500],
  beverages:  [100, 250, 500],
  bakery:     [1, 2, 5],
  fasting:    [100, 250, 500],
  household:  [1, 2, 5],
  cleaning:   [1, 2, 5],
  medicine:   [1, 2, 5],
  other:      [250, 500, 1000],
};

const formatPreset = (value, baseUnit) => {
  if (baseUnit === 'pcs') return `${value} pc${value > 1 ? 's' : ''}`;
  if (value >= 1000) {
    const big = value / 1000;
    const str = big % 1 === 0 ? String(big) : big.toFixed(1);
    return baseUnit === 'ml' ? `${str}L` : `${str}kg`;
  }
  return baseUnit === 'ml' ? `${value}ml` : `${value}g`;
};

const getQuickChips = (category, baseUnit, variant) => {
  const values = QUICK_CHIP_PRESETS[category] || QUICK_CHIP_PRESETS.other;
  const prefix = variant === 'additive' ? '+' : '';
  return values.map(v => ({
    delta: v,
    label: prefix + formatPreset(v, baseUnit),
  }));
};

// What unit should we default the numpad to, given a current value?
// Bias toward kg/L if the value is large, otherwise the base unit.
const pickInitialDisplayUnit = (value, baseUnit) => {
  if (baseUnit === 'g' && value >= 1000) return 'kg';
  if (baseUnit === 'ml' && value >= 1000) return 'L';
  return baseUnit;
};

const toBaseUnits = (n, displayUnit) => {
  if (displayUnit === 'kg' || displayUnit === 'L') return Math.round(n * 1000);
  return Math.round(n);
};

const fromBaseUnits = (baseValue, displayUnit) => {
  if (displayUnit === 'kg' || displayUnit === 'L') {
    const n = baseValue / 1000;
    return n % 1 === 0 ? String(n) : String(n);
  }
  return String(baseValue);
};

export const StockQuantityEditor = ({
  value,                  // current numeric value in base units
  baseUnit,               // 'g' | 'ml' | 'pcs'
  category,
  step,                   // step size for +/- buttons
  variant,                // 'additive' (chips add) | 'set' (chips replace)
  label,
  colors = {},
  onChange,               // (newBaseValue: number) => Promise|void
  testIdPrefix = 'stock',
  minBound = 0,           // can't go below this (0 for stock, step for monthly)
}) => {
  const { formatQuantity } = useUnits();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [draftUnit, setDraftUnit] = useState(baseUnit);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) {
      // Defer focus so the input is in the DOM
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [editing]);

  const chips = getQuickChips(category, baseUnit, variant);
  const altUnit = baseUnit === 'g' ? 'kg' : baseUnit === 'ml' ? 'L' : null;

  const safeValue = Number.isFinite(value) ? value : 0;

  const stepBy = (delta) => {
    const next = Math.max(minBound, safeValue + delta);
    onChange(next);
  };

  const handleChip = (chip) => {
    if (variant === 'additive') {
      onChange(Math.max(minBound, safeValue + chip.delta));
    } else {
      onChange(Math.max(minBound, chip.delta));
    }
  };

  const startEdit = () => {
    const unit = pickInitialDisplayUnit(safeValue, baseUnit);
    setDraftUnit(unit);
    setDraft(safeValue > 0 ? fromBaseUnits(safeValue, unit) : '');
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft('');
  };

  const saveEdit = () => {
    const n = parseFloat(draft);
    if (!Number.isFinite(n) || n < 0) {
      cancelEdit();
      return;
    }
    onChange(Math.max(minBound, toBaseUnits(n, draftUnit)));
    setEditing(false);
    setDraft('');
  };

  // -------- editing UI --------
  if (editing) {
    return (
      <div className={`p-2.5 md:p-3 rounded-xl border bg-white ${colors.editingBorder || 'border-blue-300'}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-600">{label}</span>
          <span className="text-[10px] text-gray-400">type the exact amount</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEdit();
              else if (e.key === 'Escape') cancelEdit();
            }}
            className="flex-1 h-11 px-3 rounded-lg border-2 border-gray-300 text-lg font-bold focus:outline-none focus:border-blue-500"
            placeholder="0"
            data-testid={`${testIdPrefix}-edit-input`}
          />
          {altUnit ? (
            <button
              onClick={() => setDraftUnit(draftUnit === baseUnit ? altUnit : baseUnit)}
              className="h-11 min-w-[44px] px-3 rounded-lg border-2 border-gray-300 text-sm font-bold bg-white"
              title="Toggle unit"
              data-testid={`${testIdPrefix}-edit-unit`}
            >
              {draftUnit}
            </button>
          ) : (
            <span className="h-11 min-w-[44px] px-3 flex items-center justify-center text-sm font-bold text-gray-600">
              {baseUnit}
            </span>
          )}
          <button
            onClick={saveEdit}
            className={`h-11 w-11 flex items-center justify-center rounded-lg text-white ${colors.saveBg || 'bg-green-600 hover:bg-green-700'}`}
            data-testid={`${testIdPrefix}-edit-save`}
            aria-label="Save"
          >
            <Check className="w-5 h-5" />
          </button>
          <button
            onClick={cancelEdit}
            className="h-11 w-11 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
            data-testid={`${testIdPrefix}-edit-cancel`}
            aria-label="Cancel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  // -------- normal UI --------
  return (
    <div className={`p-2.5 md:p-3 rounded-xl border bg-white/70 ${colors.containerBorder || 'border-gray-200'}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-600">{label}</span>
        <div className="flex items-center gap-1.5 md:gap-2">
          <button
            onClick={() => stepBy(-step)}
            disabled={safeValue <= minBound}
            className="w-10 h-10 md:w-8 md:h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 transition-colors disabled:opacity-40"
            data-testid={`${testIdPrefix}-minus`}
            aria-label="Decrease"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={startEdit}
            className={`min-w-[60px] md:min-w-[70px] h-10 md:h-9 px-2 md:px-3 text-center text-sm font-bold rounded-lg border ${colors.valueBg || 'bg-gray-50'} ${colors.valueBorder || 'border-gray-200'} hover:ring-2 hover:ring-blue-400 active:ring-2 active:ring-blue-500 transition-all`}
            data-testid={`${testIdPrefix}-value`}
            title="Tap to type an exact amount"
          >
            {formatQuantity(safeValue, baseUnit) || `0 ${baseUnit}`}
          </button>
          <button
            onClick={() => stepBy(step)}
            className={`w-10 h-10 md:w-8 md:h-8 flex items-center justify-center rounded-lg text-white transition-colors ${colors.plusBg || 'bg-green-600 hover:bg-green-700 active:bg-green-800'}`}
            data-testid={`${testIdPrefix}-plus`}
            aria-label="Increase"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick-pick chips — one tap to common amounts.
          Horizontally scrollable on very small phones via flex-wrap fallback. */}
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        {chips.map((chip) => (
          <button
            key={chip.label}
            onClick={() => handleChip(chip)}
            className={`h-7 px-2.5 rounded-full bg-white border text-xs font-medium transition-colors ${colors.chipBorder || 'border-gray-300 text-gray-700'} hover:bg-gray-50 active:bg-gray-100`}
            data-testid={`${testIdPrefix}-chip-${chip.delta}`}
          >
            {chip.label}
          </button>
        ))}
        <button
          onClick={startEdit}
          className={`h-7 px-3 rounded-full bg-white border-2 text-xs font-bold transition-colors ${colors.setChipBorder || 'border-blue-300 text-blue-700'} hover:bg-blue-50`}
          data-testid={`${testIdPrefix}-set`}
        >
          Set…
        </button>
      </div>
    </div>
  );
};

export default StockQuantityEditor;
