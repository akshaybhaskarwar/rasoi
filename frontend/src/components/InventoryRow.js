/**
 * InventoryRow — the compact list-view row for an inventory item.
 *
 * The card grid is fine for a 10-item pantry but a real one runs 40+ items,
 * and each card is tall (expiry + two editors + delete), so
 * finding "did I run out of haldi?" meant a lot of scrolling. This row trades
 * always-visible controls for scannability:
 *
 *   collapsed — avatar, name at 17px, regional name, stock badge, and a
 *               ±step stepper. The stepper covers the everyday edit ("used
 *               some", "bought a kg") without leaving the list.
 *   expanded  — the full InventoryItemDetails block, identical to the card:
 *               quick chips, exact-value numpad, monthly need, expiry, delete.
 *
 * Everything the card can do is one tap away rather than always on screen.
 *
 * Touch targets: the stepper buttons are 40px on mobile (w-10) and shrink to
 * 32px on desktop, matching StockQuantityEditor. That's what sets the row's
 * mobile height at ~56px rather than the 44px a text-only row would allow —
 * a deliberate trade for making the common edit zero-navigation.
 */
import { ChevronDown, ChevronUp, Lock, Minus, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useUnits } from '@/contexts/UnitContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { IngredientAvatar } from '@/components/IngredientAvatar';
import { InventoryItemDetails } from '@/components/InventoryItemDetails';
import { calculateStockStatus, getItemDefaults } from '@/lib/inventoryUtils';

export const InventoryRow = ({
  item,
  categoryInfo,
  isExpanded,
  onToggleExpanded,
  isEditingExpiry,
  newExpiryDate,
  onNewExpiryDateChange,
  onStartEditingExpiry,
  onCancelEditingExpiry,
  onSaveExpiry,
  onCurrentStockChange,
  onMonthlyQuantityChange,
  isPendingDelete,
  onDelete,
}) => {
  const { formatQuantity } = useUnits();
  const { language } = useLanguage();

  const defaults = getItemDefaults(item);
  const baseUnit = item.monthly_unit || defaults.unit;
  const step = defaults.step;
  const currentStock = item.current_stock || 0;
  const monthlyNeed = item.monthly_quantity || defaults.quantity;
  const status = calculateStockStatus(currentStock, monthlyNeed);

  const regionalName = language === 'hi' ? item.name_hi
    : language === 'mr' ? item.name_mr
    : null;

  return (
    <div
      className={`border-b border-gray-100 last:border-b-0 transition-colors ${
        isExpanded ? 'bg-[#FFFBF0]' : 'bg-white hover:bg-gray-50'
      }`}
      data-testid={`inventory-row-${item.id}`}
    >
      {/* ---- Collapsed row (always rendered; it's the expand handle too) ---- */}
      <div className="flex items-center gap-2 md:gap-3 px-3 py-2">
        {/* Name area doubles as the expand toggle. Kept as its own button
            rather than making the whole row clickable so taps on the stepper
            never need to stop propagation. */}
        <button
          onClick={onToggleExpanded}
          className="flex items-center gap-2.5 md:gap-3 flex-1 min-w-0 text-left py-1 rounded-lg"
          aria-expanded={isExpanded}
          data-testid={`inventory-row-toggle-${item.id}`}
        >
          <IngredientAvatar item={item} categoryInfo={categoryInfo} size="sm" />
          <span className="flex-1 min-w-0">
            {/* The name gets up to two lines rather than a single truncated
                one. On a 375px screen the stepper leaves ~140px here, and
                truncating to one line turned "Garam Masala Powder Special"
                into "G…" — which defeats the point of the redesign. Short
                names still occupy one line, so the row stays compact.
                NB: no `block` here — Tailwind's display utility would win
                over line-clamp's `display:-webkit-box` and silently kill the
                clamp. Expanding the row drops the clamp so a long name is
                always readable in full somewhere. */}
            <span className={`text-[15px] md:text-[17px] font-bold text-gray-800 leading-tight break-words ${
              isExpanded ? 'block' : 'line-clamp-2'
            }`}>
              {item.name_en}
            </span>
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="text-[13px] text-gray-500 truncate">
                {regionalName ? `${regionalName} · ` : ''}
                <span className={
                  status.value === 'empty' ? 'text-gray-500 font-medium'
                  : status.value === 'low' ? 'text-[#E68A2E] font-medium'
                  : status.value === 'half' ? 'text-[#B8860B] font-medium'
                  : 'text-green-700 font-medium'
                }>
                  {status.label.toLowerCase()}
                </span>
              </span>
              {/* Lock and the custom badge sit on the meta line, not beside
                  the name — on mobile they were stealing the name's width. */}
              {item.is_secret_stash && (
                <Lock className="w-3.5 h-3.5 text-[#FFCC00] flex-shrink-0" />
              )}
              {item.is_custom && (
                <Badge
                  variant="outline"
                  className="h-4 px-1 py-0 text-[9px] border-purple-300 text-purple-700 bg-purple-50 flex-shrink-0"
                >
                  custom
                </Badge>
              )}
            </span>
          </span>
        </button>

        {/* ---- D1: inline stepper. One tap = ±one category step. ---- */}
        <div className="flex items-center gap-1 md:gap-1.5 flex-shrink-0">
          <button
            onClick={() => onCurrentStockChange(Math.max(0, currentStock - step))}
            disabled={currentStock <= 0}
            className="w-10 h-10 md:w-8 md:h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 transition-colors disabled:opacity-40"
            aria-label={`Decrease ${item.name_en}`}
            data-testid={`row-minus-${item.id}`}
          >
            <Minus className="w-4 h-4" />
          </button>
          <span
            className="min-w-[44px] md:min-w-[64px] text-center text-[13px] md:text-sm font-bold text-gray-800 tabular-nums"
            data-testid={`row-value-${item.id}`}
          >
            {formatQuantity(currentStock, baseUnit) || `0 ${baseUnit}`}
          </span>
          <button
            onClick={() => onCurrentStockChange(currentStock + step)}
            className="w-10 h-10 md:w-8 md:h-8 flex items-center justify-center rounded-lg text-white bg-[#77DD77] hover:bg-[#66CC66] active:bg-[#55BB55] transition-colors"
            aria-label={`Increase ${item.name_en}`}
            data-testid={`row-plus-${item.id}`}
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={onToggleExpanded}
            className="w-6 md:w-8 h-10 md:h-8 flex items-center justify-center text-gray-400 hover:text-gray-700"
            aria-label={isExpanded ? `Collapse ${item.name_en}` : `More options for ${item.name_en}`}
            data-testid={`row-expand-${item.id}`}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ---- D2: the full card body, unchanged, unfolded in place ---- */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-1" data-testid={`inventory-row-details-${item.id}`}>
          <InventoryItemDetails
            item={item}
            isEditingExpiry={isEditingExpiry}
            newExpiryDate={newExpiryDate}
            onNewExpiryDateChange={onNewExpiryDateChange}
            onStartEditingExpiry={onStartEditingExpiry}
            onCancelEditingExpiry={onCancelEditingExpiry}
            onSaveExpiry={onSaveExpiry}
            onCurrentStockChange={onCurrentStockChange}
            onMonthlyQuantityChange={onMonthlyQuantityChange}
            isPendingDelete={isPendingDelete}
            onDelete={onDelete}
          />
        </div>
      )}
    </div>
  );
};

export default InventoryRow;
