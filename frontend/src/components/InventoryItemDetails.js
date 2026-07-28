/**
 * InventoryItemDetails — everything below an inventory item's name.
 *
 * Expiry display/editor, calculated stock badge, the two StockQuantityEditors
 * (current stock + monthly need) and the two-tap delete.
 *
 * Lifted out of InventoryPage's card so the list view's expanded row (D2) can
 * render the identical controls instead of a second, drifting copy. The card
 * view and the expanded row are now the same component with a different
 * wrapper — if you add a control here it shows up in both.
 */
import { AlertTriangle, Calendar, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StockQuantityEditor } from '@/components/StockQuantityEditor';
import { calculateStockStatus, getExpiryStatus, getItemDefaults } from '@/lib/inventoryUtils';

export const InventoryItemDetails = ({
  item,
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
  const defaults = getItemDefaults(item);
  const baseUnit = item.monthly_unit || defaults.unit;
  const step = defaults.step;

  return (
    <>
      {/* Expiry Date Display & Editor */}
      {isEditingExpiry ? (
        <div className="mb-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
          <div className="flex flex-col gap-2">
            <Label className="text-xs font-medium text-blue-800">Update Expiry Date</Label>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={newExpiryDate}
                onChange={(e) => onNewExpiryDateChange(e.target.value)}
                className="flex-1 h-9 text-sm"
                data-testid={`edit-expiry-input-${item.id}`}
              />
              <Button
                size="sm"
                onClick={onSaveExpiry}
                className="h-9 px-3 bg-green-600 hover:bg-green-700"
                data-testid={`save-expiry-${item.id}`}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onCancelEditingExpiry}
                className="h-9 px-3"
                data-testid={`cancel-expiry-${item.id}`}
              >
                Cancel
              </Button>
            </div>
            {newExpiryDate && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onNewExpiryDateChange('')}
                className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 h-7"
              >
                Clear expiry date
              </Button>
            )}
          </div>
        </div>
      ) : item.expiry_date ? (
        (() => {
          const expStatus = getExpiryStatus(item.expiry_date);
          return (
            <div className={`mb-3 p-2 rounded-lg ${
              expStatus.status === 'expired' ? 'bg-red-100 border border-red-300' :
              expStatus.status === 'today' ? 'bg-red-50 border border-red-200' :
              expStatus.status === 'soon' ? 'bg-amber-50 border border-amber-200' :
              'bg-gray-50 border border-gray-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {(expStatus.status === 'expired' || expStatus.status === 'today' || expStatus.status === 'soon') && (
                    <AlertTriangle className={`w-4 h-4 ${
                      expStatus.status === 'expired' ? 'text-red-500' :
                      expStatus.status === 'today' ? 'text-red-400' :
                      'text-amber-500'
                    }`} />
                  )}
                  <span className={`text-xs font-medium ${
                    expStatus.status === 'expired' ? 'text-red-700' :
                    expStatus.status === 'today' ? 'text-red-600' :
                    expStatus.status === 'soon' ? 'text-amber-700' :
                    'text-gray-600'
                  }`}>
                    {expStatus.message}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onStartEditingExpiry}
                  className={`h-7 px-2 text-xs ${
                    expStatus.status === 'expired' ? 'text-red-600 hover:bg-red-200' :
                    expStatus.status === 'today' ? 'text-red-500 hover:bg-red-100' :
                    expStatus.status === 'soon' ? 'text-amber-600 hover:bg-amber-100' :
                    'text-gray-500 hover:bg-gray-100'
                  }`}
                  title="Update expiry date (bought fresh stock?)"
                  data-testid={`edit-expiry-btn-${item.id}`}
                >
                  <Edit className="w-3 h-3 mr-1" />
                  Update
                </Button>
              </div>
            </div>
          );
        })()
      ) : (
        <div className="mb-3">
          <Button
            size="sm"
            variant="outline"
            onClick={onStartEditingExpiry}
            className="w-full h-8 text-xs text-gray-500 border-dashed"
            data-testid={`add-expiry-btn-${item.id}`}
          >
            <Calendar className="w-3 h-3 mr-1" />
            Add expiry date
          </Button>
        </div>
      )}

      {/* Stock Level Display - Now Dynamic */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Stock Level</span>
          {(() => {
            const currentStock = item.current_stock || 0;
            const monthlyNeed = item.monthly_quantity || defaults.quantity;
            const calculatedStatus = calculateStockStatus(currentStock, monthlyNeed);
            return (
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${calculatedStatus.color}`}>
                {calculatedStatus.icon} {calculatedStatus.label}
              </span>
            );
          })()}
        </div>
      </div>

      {/* Current Stock — stepper + additive chips + inline numpad.
          Chips ADD to the current value (semantic: "I just bought
          another 1 kg"). Tap the bold quantity or "Set…" to type
          an exact value. */}
      <div className="mb-3">
        <StockQuantityEditor
          value={item.current_stock || 0}
          baseUnit={baseUnit}
          category={item.category}
          step={step}
          variant="additive"
          label="Current Stock"
          colors={{
            containerBorder: 'border-gray-200',
            valueBg: 'bg-[#E8F5E9] text-gray-800',
            valueBorder: 'border-[#77DD77]/30',
            plusBg: 'bg-[#77DD77] hover:bg-[#66CC66] active:bg-[#55BB55]',
            saveBg: 'bg-[#66CC66] hover:bg-[#55BB55]',
            editingBorder: 'border-[#77DD77]',
            setChipBorder: 'border-green-300 text-green-700',
          }}
          onChange={onCurrentStockChange}
          testIdPrefix={`stock-${item.id}`}
        />
      </div>

      {/* Monthly Need — same controls, but chips SET to value
          (semantic: "my monthly target is 5 kg"). No
          minBound — user is free to set any positive value
          (e.g., 250 g monthly need for a niche spice). */}
      <div className="mb-3">
        <StockQuantityEditor
          value={item.monthly_quantity || defaults.quantity}
          baseUnit={baseUnit}
          category={item.category}
          step={step}
          variant="set"
          label="Monthly Need"
          colors={{
            containerBorder: 'border-gray-200',
            valueBg: 'bg-[#FFFBF0] text-gray-800',
            valueBorder: 'border-[#FFCC00]/30',
            plusBg: 'bg-[#FF9933] hover:bg-[#E68A2E] active:bg-[#D07A20]',
            saveBg: 'bg-[#FF9933] hover:bg-[#E68A2E]',
            editingBorder: 'border-[#FF9933]',
            setChipBorder: 'border-orange-300 text-orange-700',
          }}
          onChange={onMonthlyQuantityChange}
          testIdPrefix={`monthly-${item.id}`}
        />
      </div>

      {/* Delete Button — two-tap confirm, no browser dialog.
          First tap arms; second tap within 5s removes.
          iOS PWA mode silently blocks window.confirm(), so
          the older one-tap-with-confirm flow felt broken on
          the home-screen-installed app. */}
      <Button
        variant={isPendingDelete ? 'default' : 'outline'}
        size="sm"
        onClick={onDelete}
        className={`w-full rounded-lg ${
          isPendingDelete
            ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
            : 'border-red-300 text-red-600 hover:bg-red-50'
        }`}
        data-testid={`delete-${item.id}`}
      >
        <Trash2 className="w-4 h-4 mr-2" />
        {isPendingDelete ? 'Tap to confirm Delete' : 'Delete'}
      </Button>
    </>
  );
};

export default InventoryItemDetails;
