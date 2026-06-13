/**
 * ManualItemEntryForm — the form fields for typing in an item by hand.
 *
 * Extracted from ShoppingBarcodeScanner so the receipt-scan "Add as new item"
 * flow can use the same form without duplicating ~50 lines of JSX and the
 * category/quantity-chip logic.
 *
 * The form is intentionally caller-agnostic about WHERE the resulting item
 * lands — the caller passes onSubmit, which receives a plain object the
 * caller can map into whatever API shape it needs (shopping list, inventory
 * with stock_level, custom inventory item, etc.).
 *
 * Used by:
 *   - ShoppingBarcodeScanner (manual-entry confirm panel) → shopping list
 *   - BarcodeScanner (inventory's manual-entry confirm panel) → inventory
 *   - ReceiptScanButton catalog picker "no results" CTA → custom inventory
 *   - ReceiptScanButton red-row "Add as new" fast path → custom inventory
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RotateCcw } from 'lucide-react';

export const DEFAULT_CATEGORIES = [
  'grains', 'spices', 'vegetables', 'fruits', 'dairy', 'pulses',
  'oils', 'snacks', 'bakery', 'beverages', 'household', 'medicine', 'other',
];

export const ManualItemEntryForm = ({
  initialName = '',
  initialCategory = 'other',
  initialQuantity = '',
  initialExpiryDate = '',
  categories = DEFAULT_CATEGORIES,
  getQuantityOptions,       // optional (category) => string[]
  getDefaultQuantity,       // optional (category) => string
  showExpiry = true,
  submitLabel = 'Add',
  submitIcon = null,
  submitClassName = 'bg-orange-500 hover:bg-orange-600 text-white',
  onSubmit,                 // ({name_en, category, monthly_quantity, expiry_date}) => Promise|void
  onCancel,                 // () => void  (renders the secondary "Start Over" button if provided)
  cancelLabel = 'Start Over',
  submitting = false,
}) => {
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState(initialCategory);
  const [quantity, setQuantity] = useState(
    initialQuantity ||
    (getDefaultQuantity ? getDefaultQuantity(initialCategory) : ''),
  );
  const [expiryDate, setExpiryDate] = useState(initialExpiryDate);

  const quantityOptions = getQuantityOptions ? getQuantityOptions(category) : [];

  const handleCategoryChange = (val) => {
    setCategory(val);
    // If caller provided a default-quantity-per-category function and the
    // current quantity matches the previous category's default, swap it for
    // the new category's default. Otherwise leave the user's value alone.
    if (getDefaultQuantity) {
      const prevDefault = getDefaultQuantity(category);
      if (!quantity || quantity === prevDefault) {
        setQuantity(getDefaultQuantity(val));
      }
    }
  };

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit({
      name_en: trimmed,
      category,
      monthly_quantity: quantity || (getDefaultQuantity ? getDefaultQuantity(category) : ''),
      expiry_date: expiryDate || null,
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div>
          <Label>Product Name *</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter product name"
            data-testid="product-name-input"
            autoFocus
          />
        </div>

        <div>
          <Label>Category</Label>
          <Select value={category} onValueChange={handleCategoryChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[250px] overflow-y-auto">
              {categories.map(cat => (
                <SelectItem key={cat} value={cat} className="capitalize">{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Quantity</Label>
          {quantityOptions.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {quantityOptions.map(qty => (
                <Button
                  key={qty}
                  type="button"
                  variant={quantity === qty ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setQuantity(qty)}
                  className="text-xs"
                >
                  {qty}
                </Button>
              ))}
            </div>
          )}
          <Input
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder={quantityOptions.length > 0 ? 'Or type custom quantity' : 'e.g. 500 g, 1 kg, 1 pack'}
            className={quantityOptions.length > 0 ? 'mt-2' : ''}
            data-testid="quantity-input"
          />
        </div>

        {showExpiry && (
          <div>
            <Label>Expiry Date (Optional)</Label>
            <Input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              data-testid="expiry-date-input"
            />
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-4">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} className="flex-1" disabled={submitting}>
            <RotateCcw className="w-4 h-4 mr-2" />
            {cancelLabel}
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          disabled={!name.trim() || submitting}
          className={`flex-1 ${submitClassName}`}
          data-testid="confirm-add-item"
        >
          {submitIcon}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
};

export default ManualItemEntryForm;
