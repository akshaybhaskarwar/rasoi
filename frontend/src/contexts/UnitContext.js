/**
 * UnitContext - Metric/US unit system preference
 * Follows the same pattern as LanguageContext.
 * All internal storage remains in metric (g, ml).
 * This context only affects display formatting.
 */
import { createContext, useContext, useState } from 'react';

// ============ CONVERSION CONSTANTS ============
const OZ_IN_GRAMS = 28.3495;
const LB_IN_GRAMS = 453.592;
const FL_OZ_IN_ML = 29.5735;
const CUP_IN_ML = 236.588;
const QUART_IN_ML = 946.353;
const GAL_IN_ML = 3785.41;

// ============ SUPPORTED UNIT SYSTEMS ============
const UNIT_SYSTEMS = {
  metric: { label: 'Metric (kg/L)', short: 'kg/L', flag: '⚖️' },
  us: { label: 'US (lb/oz)', short: 'lb/oz', flag: '🇺🇸' }
};

// ============ SHOPPING OPTIONS BY SYSTEM ============
const SHOPPING_OPTIONS_METRIC = {
  'grains': { type: 'weight', options: ['100 g', '250 g', '500 g', '1 kg', '2 kg', '5 kg', '10 kg'], default: '1 kg' },
  'pulses': { type: 'weight', options: ['250 g', '500 g', '1 kg', '2 kg', '5 kg'], default: '1 kg' },
  'spices': { type: 'weight', options: ['25 g', '50 g', '100 g', '200 g', '250 g', '500 g'], default: '100 g' },
  'vegetables': { type: 'weight', options: ['250 g', '500 g', '1 kg', '2 kg'], default: '500 g' },
  'fruits': { type: 'weight', options: ['250 g', '500 g', '1 kg', '2 kg'], default: '1 kg' },
  'snacks': { type: 'weight', options: ['100 g', '200 g', '250 g', '500 g', '1 kg'], default: '250 g' },
  'fasting': { type: 'weight', options: ['100 g', '250 g', '500 g', '1 kg'], default: '250 g' },
  'sweeteners': { type: 'weight', options: ['250 g', '500 g', '1 kg', '2 kg'], default: '500 g' },
  'dairy': { type: 'volume', options: ['250 ml', '500 ml', '1 L', '2 L', '5 L'], default: '1 L' },
  'oils': { type: 'volume', options: ['200 ml', '500 ml', '1 L', '2 L', '5 L'], default: '1 L' },
  'beverages': { type: 'volume', options: ['250 ml', '500 ml', '1 L', '2 L'], default: '1 L' },
  'bakery': { type: 'count', options: ['1 pack', '2 packs', '3 packs', '6 packs', '1 dozen'], default: '1 pack' },
  'household': { type: 'count', options: ['1 unit', '2 units', '1 pack', '2 packs', '1 box'], default: '1 unit' },
  'cleaning': { type: 'count', options: ['1 unit', '2 units', '1 pack', '2 packs', '1 box'], default: '1 unit' },
  'medicine': { type: 'count', options: ['1 strip', '2 strips', '1 bottle', '1 box', '1 pack'], default: '1 strip' },
  'other': { type: 'weight', options: ['100 g', '250 g', '500 g', '1 kg', '2 kg'], default: '500 g' }
};

const SHOPPING_OPTIONS_US = {
  'grains': { type: 'weight', options: ['4 oz', '8 oz', '1 lb', '2 lb', '5 lb', '10 lb', '20 lb'], default: '2 lb' },
  'pulses': { type: 'weight', options: ['8 oz', '1 lb', '2 lb', '5 lb'], default: '2 lb' },
  'spices': { type: 'weight', options: ['1 oz', '2 oz', '4 oz', '8 oz', '1 lb'], default: '4 oz' },
  'vegetables': { type: 'weight', options: ['8 oz', '1 lb', '2 lb', '5 lb'], default: '1 lb' },
  'fruits': { type: 'weight', options: ['8 oz', '1 lb', '2 lb', '5 lb'], default: '2 lb' },
  'snacks': { type: 'weight', options: ['4 oz', '8 oz', '1 lb', '2 lb'], default: '8 oz' },
  'fasting': { type: 'weight', options: ['4 oz', '8 oz', '1 lb', '2 lb'], default: '8 oz' },
  'sweeteners': { type: 'weight', options: ['8 oz', '1 lb', '2 lb', '5 lb'], default: '1 lb' },
  'dairy': { type: 'volume', options: ['1 cup', '2 cups', '1 quart', '0.5 gal', '1 gal'], default: '1 quart' },
  'oils': { type: 'volume', options: ['1 cup', '2 cups', '1 quart', '0.5 gal', '1 gal'], default: '1 quart' },
  'beverages': { type: 'volume', options: ['1 cup', '2 cups', '1 quart', '0.5 gal'], default: '1 quart' },
  // Count-based categories stay the same
  'bakery': { type: 'count', options: ['1 pack', '2 packs', '3 packs', '6 packs', '1 dozen'], default: '1 pack' },
  'household': { type: 'count', options: ['1 unit', '2 units', '1 pack', '2 packs', '1 box'], default: '1 unit' },
  'cleaning': { type: 'count', options: ['1 unit', '2 units', '1 pack', '2 packs', '1 box'], default: '1 unit' },
  'medicine': { type: 'count', options: ['1 strip', '2 strips', '1 bottle', '1 box', '1 pack'], default: '1 strip' },
  'other': { type: 'weight', options: ['4 oz', '8 oz', '1 lb', '2 lb', '5 lb'], default: '1 lb' }
};

// ============ FORMATTING HELPERS ============

/** Round to at most 1 decimal, drop trailing .0 */
const smartRound = (num) => {
  const rounded = Math.round(num * 10) / 10;
  return rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
};

/** Format a weight value (stored in grams) */
const formatWeight = (grams, system) => {
  if (!grams && grams !== 0) return null;
  if (system === 'us') {
    if (grams >= LB_IN_GRAMS) {
      return `${smartRound(grams / LB_IN_GRAMS)} lb`;
    }
    return `${smartRound(grams / OZ_IN_GRAMS)} oz`;
  }
  // Metric
  if (grams >= 1000) {
    return `${smartRound(grams / 1000)} kg`;
  }
  return `${smartRound(grams)} g`;
};

/** Format a volume value (stored in ml) */
const formatVolume = (ml, system) => {
  if (!ml && ml !== 0) return null;
  if (system === 'us') {
    if (ml >= GAL_IN_ML) {
      return `${smartRound(ml / GAL_IN_ML)} gal`;
    }
    if (ml >= QUART_IN_ML) {
      return `${smartRound(ml / QUART_IN_ML)} quart`;
    }
    if (ml >= CUP_IN_ML) {
      return `${smartRound(ml / CUP_IN_ML)} cups`;
    }
    return `${smartRound(ml / FL_OZ_IN_ML)} fl oz`;
  }
  // Metric
  if (ml >= 1000) {
    return `${smartRound(ml / 1000)} L`;
  }
  return `${smartRound(ml)} ml`;
};

/** Parse a display string (metric or US) back to metric base units { value, unit } */
const parseDisplayToMetricBase = (displayString) => {
  if (!displayString || displayString === '-') return { value: 0, unit: 'g' };

  const match = displayString.match(/^([\d.]+)\s*(.+)$/);
  if (!match) return { value: 0, unit: 'g' };

  let value = parseFloat(match[1]);
  let rawUnit = match[2].toLowerCase().trim();

  // Metric conversions
  if (rawUnit === 'kg') return { value: value * 1000, unit: 'g' };
  if (rawUnit === 'g') return { value, unit: 'g' };
  if (rawUnit === 'l' || rawUnit === 'liter' || rawUnit === 'litre') return { value: value * 1000, unit: 'ml' };
  if (rawUnit === 'ml') return { value, unit: 'ml' };

  // US weight conversions → grams
  if (rawUnit === 'lb' || rawUnit === 'lbs') return { value: value * LB_IN_GRAMS, unit: 'g' };
  if (rawUnit === 'oz') return { value: value * OZ_IN_GRAMS, unit: 'g' };

  // US volume conversions → ml
  if (rawUnit === 'gal' || rawUnit === 'gallon' || rawUnit === 'gallons') return { value: value * GAL_IN_ML, unit: 'ml' };
  if (rawUnit === 'quart' || rawUnit === 'quarts' || rawUnit === 'qt') return { value: value * QUART_IN_ML, unit: 'ml' };
  if (rawUnit === 'cup' || rawUnit === 'cups') return { value: value * CUP_IN_ML, unit: 'ml' };
  if (rawUnit.includes('fl oz') || rawUnit === 'fl') return { value: value * FL_OZ_IN_ML, unit: 'ml' };

  // Count-based
  if (rawUnit.includes('pack') || rawUnit.includes('unit') || rawUnit.includes('dozen') ||
      rawUnit.includes('strip') || rawUnit.includes('bottle') || rawUnit.includes('box')) {
    return { value, unit: 'units' };
  }

  if (rawUnit === 'pcs') return { value, unit: 'pcs' };

  return { value, unit: 'g' };
};

// ============ CONTEXT ============
const UnitContext = createContext(null);

export const UnitProvider = ({ children }) => {
  const [unitSystem, setUnitSystem] = useState(() => {
    return localStorage.getItem('rasoi_unit_system') || 'metric';
  });

  const changeUnitSystem = (system) => {
    if (UNIT_SYSTEMS[system]) {
      setUnitSystem(system);
      localStorage.setItem('rasoi_unit_system', system);
    }
  };

  /** Format a quantity for display based on current unit system */
  const formatQuantity = (quantity, unit) => {
    if (!quantity && quantity !== 0) return null;
    if (unit === 'pcs') return `${quantity} pcs`;

    // Volume units
    if (unit === 'ml') return formatVolume(quantity, unitSystem);
    if (unit === 'L' || unit === 'l') return formatVolume(quantity * 1000, unitSystem);

    // Weight units
    if (unit === 'g') return formatWeight(quantity, unitSystem);
    if (unit === 'kg') return formatWeight(quantity * 1000, unitSystem);

    return `${quantity} ${unit}`;
  };

  /** Get shopping dropdown options for a category */
  const getShoppingOptions = (category) => {
    const options = unitSystem === 'us' ? SHOPPING_OPTIONS_US : SHOPPING_OPTIONS_METRIC;
    return options[category] || options['other'];
  };

  /** Parse any display string (metric or US) to metric base units */
  const parseDisplayToMetric = (displayString) => {
    return parseDisplayToMetricBase(displayString);
  };

  /** Get a default display quantity for a category */
  const getDefaultQuantity = (category) => {
    const options = getShoppingOptions(category);
    return options.default;
  };

  const value = {
    unitSystem,
    changeUnitSystem,
    isMetric: unitSystem === 'metric',
    isUS: unitSystem === 'us',
    formatQuantity,
    formatWeight: (g) => formatWeight(g, unitSystem),
    formatVolume: (ml) => formatVolume(ml, unitSystem),
    getShoppingOptions,
    getDefaultQuantity,
    parseDisplayToMetric,
    unitSystemInfo: UNIT_SYSTEMS[unitSystem],
    UNIT_SYSTEMS,
  };

  return (
    <UnitContext.Provider value={value}>
      {children}
    </UnitContext.Provider>
  );
};

export const useUnits = () => {
  const context = useContext(UnitContext);
  if (!context) {
    throw new Error('useUnits must be used within a UnitProvider');
  }
  return context;
};
