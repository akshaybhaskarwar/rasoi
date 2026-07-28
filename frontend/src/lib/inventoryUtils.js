/**
 * Shared inventory helpers.
 *
 * These used to live inside InventoryPage, but the list-view row and the
 * shared item-detail body both need them, and importing them back out of the
 * page component would be a circular import. Single source of truth now.
 */

// Default monthly quantities by category (display is computed dynamically via UnitContext)
export const DEFAULT_MONTHLY = {
  'grains': { quantity: 5000, unit: 'g', step: 1000 },
  'pulses': { quantity: 500, unit: 'g', step: 250 },
  'spices': { quantity: 100, unit: 'g', step: 50 },
  'dairy': { quantity: 5000, unit: 'ml', step: 500 },
  'oils': { quantity: 1000, unit: 'ml', step: 250 },
  'bakery': { quantity: 2, unit: 'pcs', step: 1 },
  'snacks': { quantity: 500, unit: 'g', step: 100 },
  'beverages': { quantity: 500, unit: 'g', step: 100 },
  'vegetables': { quantity: 2000, unit: 'g', step: 500 },
  'fruits': { quantity: 2000, unit: 'g', step: 500 },
  'fasting': { quantity: 500, unit: 'g', step: 100 },
  'household': { quantity: 1, unit: 'pcs', step: 1 },
  'cleaning': { quantity: 1, unit: 'pcs', step: 1 },
  'medicine': { quantity: 1, unit: 'pcs', step: 1 },
  'other': { quantity: 1000, unit: 'g', step: 250 }
};

// `label` keeps its leading emoji because it's rendered directly in the
// category dropdown and the group headings. `emoji` is the same glyph broken
// out for IngredientAvatar, and `tile` is a one-step-stronger tint so the
// avatar reads as a distinct shape against a white list row.
export const CATEGORIES = [
  { value: 'grains', label: '🌾 Grains & Cereals', color: 'bg-amber-50', emoji: '🌾', tile: 'bg-amber-100' },
  { value: 'pulses', label: '🫘 Pulses & Lentils', color: 'bg-yellow-50', emoji: '🫘', tile: 'bg-yellow-100' },
  { value: 'spices', label: '🌶️ Spices & Masalas', color: 'bg-red-50', emoji: '🌶️', tile: 'bg-red-100' },
  { value: 'vegetables', label: '🧅 Vegetables', color: 'bg-green-50', emoji: '🧅', tile: 'bg-green-100' },
  { value: 'fruits', label: '🍎 Fruits', color: 'bg-pink-50', emoji: '🍎', tile: 'bg-pink-100' },
  { value: 'dairy', label: '🥛 Dairy & Essentials', color: 'bg-blue-50', emoji: '🥛', tile: 'bg-blue-100' },
  { value: 'oils', label: '🧴 Oils & Condiments', color: 'bg-yellow-100', emoji: '🧴', tile: 'bg-yellow-200' },
  { value: 'bakery', label: '🍞 Bakery Items', color: 'bg-amber-100', emoji: '🍞', tile: 'bg-amber-200' },
  { value: 'fasting', label: '🔱 Upvas/Fasting', color: 'bg-purple-50', emoji: '🔱', tile: 'bg-purple-100' },
  { value: 'snacks', label: '🥣 Snacks & Ready Mix', color: 'bg-orange-100', emoji: '🥣', tile: 'bg-orange-200' },
  { value: 'beverages', label: '☕ Tea & Coffee', color: 'bg-brown-50', emoji: '☕', tile: 'bg-orange-100' },
  { value: 'medicine', label: '💊 Medicine', color: 'bg-rose-50', emoji: '💊', tile: 'bg-rose-100' },
  { value: 'household', label: '🧹 Cleaning & Household', color: 'bg-cyan-50', emoji: '🧹', tile: 'bg-cyan-100' },
  { value: 'other', label: '📦 Other', color: 'bg-gray-50', emoji: '📦', tile: 'bg-gray-100' }
];

export const STOCK_LEVELS = [
  { value: 'empty', label: 'Empty', color: 'bg-gray-200 text-gray-700', icon: '○' },
  { value: 'low', label: 'Low', color: 'bg-[#FF9933] text-white', icon: '◔' },
  { value: 'half', label: 'Half', color: 'bg-[#FFCC00] text-gray-800', icon: '◑' },
  { value: 'full', label: 'Full', color: 'bg-[#77DD77] text-white', icon: '●' }
];

export const getCategoryInfo = (categoryValue) =>
  CATEGORIES.find(c => c.value === categoryValue) || CATEGORIES[CATEGORIES.length - 1];

export const getStockLevelInfo = (level) =>
  STOCK_LEVELS.find(s => s.value === level) || STOCK_LEVELS[0];

// Per-item unit/step/monthly defaults, falling back to 'other'.
export const getItemDefaults = (item) =>
  DEFAULT_MONTHLY[item?.category] || DEFAULT_MONTHLY.other;

// Helper function to check expiry status
export const getExpiryStatus = (expiryDate) => {
  if (!expiryDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);

  const daysUntilExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

  if (daysUntilExpiry < 0) {
    return { status: 'expired', days: Math.abs(daysUntilExpiry), message: `Expired ${Math.abs(daysUntilExpiry)} days ago` };
  } else if (daysUntilExpiry === 0) {
    return { status: 'today', days: 0, message: 'Expires today!' };
  } else if (daysUntilExpiry <= 30) {
    return { status: 'soon', days: daysUntilExpiry, message: `Expires in ${daysUntilExpiry} days` };
  }
  return { status: 'ok', days: daysUntilExpiry, message: `Expires in ${daysUntilExpiry} days` };
};

// Calculate stock status based on current stock vs monthly need
export const calculateStockStatus = (currentStock, monthlyNeed) => {
  if (!monthlyNeed || monthlyNeed === 0) {
    return currentStock > 0 ? { value: 'full', label: 'Full', color: 'bg-[#77DD77] text-white', icon: '●' }
                           : { value: 'empty', label: 'Empty', color: 'bg-gray-200 text-gray-700', icon: '○' };
  }

  const percentage = (currentStock / monthlyNeed) * 100;

  if (percentage === 0) {
    return { value: 'empty', label: 'Empty', color: 'bg-gray-200 text-gray-700', icon: '○' };
  } else if (percentage <= 25) {
    return { value: 'low', label: 'Low', color: 'bg-[#FF9933] text-white', icon: '◔' };
  } else if (percentage <= 75) {
    return { value: 'half', label: 'Half', color: 'bg-[#FFCC00] text-gray-800', icon: '◑' };
  } else {
    return { value: 'full', label: 'Full', color: 'bg-[#77DD77] text-white', icon: '●' };
  }
};

// Calculated (not stored) stock level for an item — filtering and the row
// badges both key off this so a stale stored `stock_level` never shows.
export const getCalculatedStockLevel = (item) => {
  const defaults = getItemDefaults(item);
  const currentStock = item.current_stock || 0;
  const monthlyNeed = item.monthly_quantity || defaults.quantity;
  return calculateStockStatus(currentStock, monthlyNeed).value;
};
