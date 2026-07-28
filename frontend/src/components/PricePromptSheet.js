/**
 * PricePromptSheet — "what did you pay?", asked after an item is marked
 * purchased.
 *
 * Deliberately AFTER the action, never before it. Marking things bought is the
 * highest-frequency interaction on this page, and putting a price form in front
 * of it would be felt on every single tap. This sheet is skippable, and
 * skipping costs nothing but a missing data point.
 *
 * It posts to /shopping/price keyed on the item NAME rather than the shopping
 * row id, because marking an item purchased deletes that row — it has moved
 * into inventory by the time this sheet opens.
 */
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

// Receipt-style unit codes, so manual entries normalise the same way scanned
// ones do. 'UT' stays a pack because pack size is unknowable either way.
const UNITS = [
  { code: 'K', label: 'per kg' },
  { code: 'L', label: 'per litre' },
  { code: 'UT', label: 'per pack' },
];

/** Pull a leading number and a unit out of strings like "2 kg" or "500 g". */
const parseQuantity = (quantity) => {
  if (!quantity || typeof quantity !== 'string') return { qty: '', unit: 'UT' };
  const match = quantity.trim().match(/^([\d.]+)\s*([a-zA-Z]*)/);
  if (!match) return { qty: '', unit: 'UT' };
  const qty = match[1] || '';
  const raw = (match[2] || '').toLowerCase();
  if (raw === 'kg' || raw === 'k') return { qty, unit: 'K' };
  if (raw === 'g' || raw === 'gm' || raw === 'gram') return { qty, unit: 'K', grams: true };
  if (raw === 'l' || raw === 'lt' || raw === 'ltr') return { qty, unit: 'L' };
  if (raw === 'ml') return { qty, unit: 'L', millilitres: true };
  return { qty, unit: 'UT' };
};

export const PricePromptSheet = ({ item, open, onClose, onSaved }) => {
  const [amount, setAmount] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('UT');
  const [saving, setSaving] = useState(false);

  // Prefill from the quantity the user had on the list — most of the time
  // that IS what they bought, so there is nothing left to type but the amount.
  useEffect(() => {
    if (!open || !item) return;
    const parsed = parseQuantity(item.quantity || item.monthly_quantity);
    let q = parsed.qty;
    if (parsed.grams && q) q = String(Number(q) / 1000);       // 500 g -> 0.5 kg
    if (parsed.millilitres && q) q = String(Number(q) / 1000); // 500 ml -> 0.5 L
    setQty(q);
    setUnit(parsed.unit);
    setAmount('');
  }, [open, item]);

  if (!item) return null;

  const amountNum = parseFloat(amount);
  const qtyNum = parseFloat(qty);
  const canSave = Number.isFinite(amountNum) && amountNum > 0 &&
                  Number.isFinite(qtyNum) && qtyNum > 0;
  // Live preview of what will actually be stored, so nobody is surprised by
  // the number that shows up on the list next time.
  const preview = canSave
    ? `₹${Number((amountNum / qtyNum).toFixed(2))}/${unit === 'K' ? 'kg' : unit === 'L' ? 'L' : 'pack'}`
    : null;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const token = localStorage.getItem('auth_token');
      await axios.post(
        `${API}/api/shopping/price`,
        {
          canonical_name: item.name_en,
          amount: amountNum,
          qty: qtyNum,
          unit,
          store_type: item.store_type || null,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Saved ${preview} for ${item.name_en}`);
      onSaved?.();
      onClose?.();
    } catch (err) {
      console.error('Failed to save price:', err?.response?.data || err.message);
      toast.error('Could not save the price');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose?.(); }}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="text-left">
          <SheetTitle>What did you pay?</SheetTitle>
          <SheetDescription>
            Optional — this is what shows as &ldquo;last paid&rdquo; for {item.name_en} next time.
          </SheetDescription>
        </SheetHeader>

        <div className="py-4 space-y-4">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-600">Total paid (₹)</label>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="284"
                autoFocus
                className="h-11 text-lg font-semibold"
                data-testid="price-amount-input"
              />
            </div>
            <div className="w-24">
              <label className="text-xs font-medium text-gray-600">Quantity</label>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="2"
                className="h-11"
                data-testid="price-qty-input"
              />
            </div>
          </div>

          <div className="flex gap-2">
            {UNITS.map((u) => (
              <button
                key={u.code}
                onClick={() => setUnit(u.code)}
                className={`h-9 px-4 rounded-full text-sm font-medium border transition-colors ${
                  unit === u.code
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
                data-testid={`price-unit-${u.code}`}
              >
                {u.label}
              </button>
            ))}
          </div>

          <div className="h-6 text-sm text-gray-600">
            {preview && <>Will be saved as <span className="font-semibold text-gray-800">{preview}</span></>}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1 h-11" data-testid="price-skip">
              Skip
            </Button>
            <Button
              onClick={handleSave}
              disabled={!canSave || saving}
              className="flex-1 h-11 bg-green-600 hover:bg-green-700 text-white"
              data-testid="price-save"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save price
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default PricePromptSheet;
