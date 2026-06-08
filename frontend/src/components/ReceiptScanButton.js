/**
 * ReceiptScanButton — Phase 1 of PRD-01 (receipt -> inventory).
 *
 * Flow:
 *   1. User taps the button -> hidden file input opens (camera on mobile).
 *   2. Image is base64-encoded and POSTed to /api/inventory/from-receipt.
 *   3. Confirm dialog renders the extracted items with confidence colors.
 *   4. User edits/skips/confirms, taps "Add N items".
 *   5. POST /api/inventory/bulk-update writes to inventory; onSuccess fires.
 *
 * The component owns the file input, dialog, and catalog-pick sheet so the
 * parent only needs to render <ReceiptScanButton onSuccess={fetchInventory}/>.
 */
import { useEffect, useRef, useState } from 'react';
import {
  Receipt, Camera, Loader2, CheckCircle2, AlertCircle, XCircle, Search, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useReceiptIngestion } from '@/hooks/useRasoiSync';
import { useLanguage } from '@/contexts/LanguageContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Confidence -> visual treatment + default action
const CONFIDENCE_STYLES = {
  high:      { color: 'bg-green-50 border-green-200',   icon: CheckCircle2, iconClass: 'text-green-600',  label: 'High' },
  medium:    { color: 'bg-yellow-50 border-yellow-200', icon: AlertCircle,  iconClass: 'text-yellow-600', label: 'Check' },
  low:       { color: 'bg-orange-50 border-orange-200', icon: AlertCircle,  iconClass: 'text-orange-600', label: 'Low' },
  unmatched: { color: 'bg-red-50 border-red-200',       icon: XCircle,      iconClass: 'text-red-600',    label: 'Pick' },
};

// Resize an image file to a max dimension and re-encode as JPEG. Modern phone
// cameras produce 4-8 MB images; we drop to ~500 KB while keeping enough
// resolution that the OCR is unaffected. Critical for mobile networks and
// to stay well under any reverse-proxy upload caps.
const MAX_DIM = 1800;       // pixels — receipt text remains crisp at this width
const JPEG_QUALITY = 0.85;  // ~5x smaller than full-quality, no OCR loss

const fileToResizedBase64 = (file) =>
  new Promise((resolve, reject) => {
    const fileReader = new FileReader();
    fileReader.onerror = () => reject(fileReader.error);
    fileReader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const longest = Math.max(img.width, img.height);
        const scale = longest > MAX_DIM ? MAX_DIM / longest : 1;
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas not supported on this device'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);

        // toDataURL gives base64; strip the "data:image/jpeg;base64," prefix
        const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        const comma = dataUrl.indexOf(',');
        resolve(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl);
      };
      img.onerror = () => reject(new Error('Could not load image — file may be corrupt'));
      img.src = fileReader.result;
    };
    fileReader.readAsDataURL(file);
  });

const formatINR = (n) =>
  typeof n === 'number' ? `₹${n.toFixed(2)}` : '';

const ReceiptScanButton = ({ onSuccess }) => {
  const { parseReceipt, saveConfirmedItems, parsing, saving } = useReceiptIngestion();
  const { getLabel } = useLanguage();
  const fileInputRef = useRef(null);

  const [stage, setStage] = useState('idle'); // idle | confirming
  const [receipt, setReceipt] = useState(null); // server response
  const [rows, setRows] = useState([]);         // editable copy of items
  const [catalogOpen, setCatalogOpen] = useState(null); // index of row being edited

  const handlePickFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;

    // 25 MB guard. We resize to ~500 KB before upload, so the backend's 10 MB
    // limit is irrelevant — but reading a giant file into FileReader can OOM a
    // low-end phone before we get the chance.
    if (file.size > 25 * 1024 * 1024) {
      toast.error('Image too large', { description: 'Please pick an image under 25 MB.' });
      return;
    }

    try {
      const b64 = await fileToResizedBase64(file);
      const data = await parseReceipt(b64);
      setReceipt(data);
      // Initialize editable rows with default action ('add' unless unmatched)
      setRows(
        (data.items || []).map((it, idx) => ({
          ...it,
          _row_id: idx,
          action: it.match_confidence === 'unmatched' ? 'skip' : 'add',
        }))
      );
      setStage('confirming');
    } catch (err) {
      toast.error('Could not read receipt', {
        description: err.message || 'Try a clearer photo.',
        duration: 5000,
      });
    }
  };

  const handleClose = () => {
    setStage('idle');
    setReceipt(null);
    setRows([]);
    setCatalogOpen(null);
  };

  const handleSave = async () => {
    const payload = rows.map(r => ({
      name_canonical_en: r.name_canonical_en,
      qty: r.qty ?? 1,
      unit: r.unit || 'UT',
      action: r.action,
    }));
    try {
      const result = await saveConfirmedItems(receipt.receipt_id, payload);
      toast.success(`Added ${result.added_count} items to inventory`, {
        description: result.skipped_count > 0
          ? `${result.skipped_count} skipped`
          : 'Your kitchen is up to date.',
        duration: 4000,
      });
      handleClose();
      onSuccess?.();
    } catch (err) {
      toast.error('Failed to save', { description: err.message });
    }
  };

  // Toggle a row between "add" and "skip"
  const toggleRowAction = (rowId) => {
    setRows(rs => rs.map(r =>
      r._row_id === rowId
        ? { ...r, action: r.action === 'add' ? 'skip' : 'add' }
        : r
    ));
  };

  // User edited the qty inline
  const updateRowQty = (rowId, newQty) => {
    setRows(rs => rs.map(r =>
      r._row_id === rowId
        ? { ...r, qty: Number(newQty) || 0 }
        : r
    ));
  };

  // User picked a different catalog item from the search sheet
  const updateRowCanonical = (rowId, canonicalEn) => {
    setRows(rs => rs.map(r =>
      r._row_id === rowId
        ? { ...r, name_canonical_en: canonicalEn, match_confidence: 'high', action: 'add' }
        : r
    ));
    setCatalogOpen(null);
  };

  // Stats for the header
  const stats = rows.reduce(
    (acc, r) => {
      if (r.action === 'add') acc.add++;
      else acc.skip++;
      return acc;
    },
    { add: 0, skip: 0 }
  );

  return (
    <>
      <Button
        onClick={handlePickFile}
        disabled={parsing}
        className="bg-[#FF9933] hover:bg-[#FF8800] text-white rounded-full shadow-md"
        data-testid="scan-receipt-btn"
      >
        {parsing ? (
          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
        ) : (
          <Receipt className="w-5 h-5 mr-2" />
        )}
        <span>{getLabel('scanReceipt')}</span>
      </Button>

      {/* Hidden input — opens device camera on mobile, file picker on desktop */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        data-testid="receipt-file-input"
      />

      <Dialog
        open={stage === 'confirming'}
        onOpenChange={(o) => { if (!o) handleClose(); }}
      >
        <DialogContent
          className="max-w-3xl max-h-[90vh] overflow-y-auto custom-scrollbar p-0 relative"
          // Prevent the parent dialog from closing if the user taps inside the
          // inline catalog overlay (which is rendered within this content area).
          onInteractOutside={(e) => { if (catalogOpen !== null) e.preventDefault(); }}
          onEscapeKeyDown={(e) => { if (catalogOpen !== null) { e.preventDefault(); setCatalogOpen(null); } }}
        >
          <DialogHeader className="p-6 pb-3 border-b sticky top-0 bg-white z-10">
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-6 h-6 text-[#FF9933]" />
              Confirm Receipt Items
            </DialogTitle>
            <div className="text-sm text-gray-600 flex flex-wrap gap-x-4 gap-y-1 mt-2">
              <span>
                Total on receipt:&nbsp;
                <strong className="text-gray-900">{formatINR(receipt?.total_extracted)}</strong>
              </span>
              <span>
                {stats.add} to add &middot; {stats.skip} skipped
              </span>
              {receipt?.vendor && (
                <span>From: <strong>{receipt.vendor}</strong></span>
              )}
            </div>
          </DialogHeader>

          {/* Rows */}
          <div className="p-4 space-y-2">
            {rows.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                No items detected. The image may be too blurry — try again with better lighting.
              </div>
            )}
            {rows.map((row) => {
              const style = CONFIDENCE_STYLES[row.match_confidence] || CONFIDENCE_STYLES.unmatched;
              const IconComp = style.icon;
              const isAdded = row.action === 'add';
              return (
                <div
                  key={row._row_id}
                  className={`border-2 rounded-lg p-3 transition-all ${
                    isAdded ? style.color : 'bg-gray-50 border-gray-200 opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <IconComp className={`w-5 h-5 mt-1 flex-shrink-0 ${style.iconClass}`} />
                    <div className="flex-1 min-w-0">
                      {/* Canonical English name (the inventory write target) */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="font-semibold text-gray-900">
                          {row.name_canonical_en || (
                            <button
                              onClick={() => setCatalogOpen(row._row_id)}
                              className="text-blue-600 underline text-sm"
                              data-testid={`pick-catalog-${row._row_id}`}
                            >
                              Pick from catalog…
                            </button>
                          )}
                          {row.name_canonical_en && (
                            <button
                              onClick={() => setCatalogOpen(row._row_id)}
                              className="ml-2 text-xs text-blue-600 underline"
                            >
                              change
                            </button>
                          )}
                        </div>
                        <span className="font-semibold text-gray-900">{formatINR(row.amount)}</span>
                      </div>

                      {/* Devanagari (as printed) + qty/unit editable */}
                      <div className="text-xs text-gray-600 mt-1 flex items-center gap-2 flex-wrap">
                        <span className="break-all">{row.name_devanagari}</span>
                        <span className="text-gray-400">·</span>
                        <Input
                          type="number"
                          step="0.01"
                          value={row.qty ?? 0}
                          onChange={(e) => updateRowQty(row._row_id, e.target.value)}
                          disabled={!isAdded}
                          className="h-7 w-20 text-xs"
                        />
                        <span className="text-gray-500">{row.unit}</span>
                        <Badge variant="outline" className="text-[10px] py-0">
                          {style.label}
                        </Badge>
                      </div>
                    </div>

                    <Button
                      variant={isAdded ? 'outline' : 'default'}
                      size="sm"
                      className={isAdded ? 'text-red-600 hover:text-red-700' : 'bg-[#77DD77] hover:bg-[#66CC66]'}
                      onClick={() => toggleRowAction(row._row_id)}
                      data-testid={`toggle-${row._row_id}`}
                    >
                      {isAdded ? 'Skip' : 'Add'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer — extra bottom padding on mobile clears the app's bottom
              nav bar (~64-80px tall) that otherwise hides the buttons. */}
          <div className="p-4 pb-24 md:pb-4 border-t bg-white sticky bottom-0 flex flex-col-reverse md:flex-row gap-2 md:justify-end">
            <Button variant="outline" onClick={handleClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || stats.add === 0}
              className="bg-[#138808] hover:bg-[#0d6606] text-white"
              data-testid="save-receipt-btn"
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Add {stats.add} item{stats.add !== 1 ? 's' : ''} to inventory
            </Button>
          </div>

          {/* Inline catalog-pick overlay — rendered INSIDE the parent dialog
              (not as a nested Radix Dialog) so closing it never bubbles up to
              close the confirm dialog. */}
          {catalogOpen !== null && (
            <CatalogPickOverlay
              onClose={() => setCatalogOpen(null)}
              onPick={(canonicalEn) => updateRowCanonical(catalogOpen, canonicalEn)}
              currentValue={rows.find(r => r._row_id === catalogOpen)?.name_canonical_en}
              devanagariHint={rows.find(r => r._row_id === catalogOpen)?.name_devanagari}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

// =============================================================================
// Catalog-pick OVERLAY — renders absolute-positioned INSIDE the parent dialog
// (not as a separate Radix Dialog) so closing it never bubbles up to close
// the confirm dialog. Earlier nested-Dialog implementation was navigating the
// user out of the receipt flow on close.
//
// The API returns the pantry template as:
//   { template: { "<main display>": { "<sub display>": { items: [...] } } } }
// — note there's NO `.subcategories` wrapper between main and sub.
// =============================================================================
const CatalogPickOverlay = ({ onClose, onPick, currentValue, devanagariHint }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/pantry-items/template`);
        const data = await res.json();
        if (cancelled) return;
        const flat = [];
        // API shape: template -> {mainDisplay: {subDisplay: {items: [...]}}}
        Object.values(data.template || {}).forEach((mainCat) => {
          Object.values(mainCat || {}).forEach((sub) => {
            (sub?.items || []).forEach((item) => {
              flat.push({
                en: item.en,
                mr: item.mr || '',
                hi: item.hi || '',
                aliases: (item.aliases || []).join(' '),
                category: sub.category,
              });
            });
          });
        });
        setItems(flat);
      } catch (e) {
        // keep silent — user can still cancel
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const q = query.trim().toLowerCase();
  const trimmed = query.trim();
  const filtered = q
    ? items.filter(it =>
        it.en.toLowerCase().includes(q) ||
        (it.mr && it.mr.includes(trimmed)) ||
        (it.hi && it.hi.includes(trimmed)) ||
        it.aliases.toLowerCase().includes(q))
    : items.slice(0, 50);

  return (
    // Absolute overlay covering only the parent DialogContent — NOT a separate
    // Radix Dialog. Closing this just unmounts the overlay.
    <div
      className="absolute inset-0 bg-white z-20 flex flex-col"
      data-testid="catalog-pick-overlay"
    >
      <div className="p-5 pb-3 border-b flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 font-semibold text-lg">
            <Search className="w-5 h-5" />
            Pick the catalog match
          </div>
          {devanagariHint && (
            <p className="text-xs text-gray-600 mt-1">
              On the receipt: <strong className="text-gray-800">{devanagariHint}</strong>
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-900 p-1 -m-1"
          aria-label="Close catalog picker"
          data-testid="catalog-pick-close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 border-b">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search English, मराठी, हिन्दी…"
          autoFocus
          className="w-full"
        />
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pb-24 md:pb-4">
        {loading && (
          <div className="p-6 text-center text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading catalog…
          </div>
        )}
        {!loading && items.length === 0 && (
          <div className="p-6 text-center text-gray-500">
            Could not load the catalog. Tap Close and try again.
          </div>
        )}
        {!loading && items.length > 0 && filtered.length === 0 && (
          <div className="p-6 text-center text-gray-500">No catalog entries match "{query}".</div>
        )}
        {!loading && filtered.map((it) => (
          <button
            key={it.en}
            onClick={() => onPick(it.en)}
            className={`block w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 ${
              it.en === currentValue ? 'bg-blue-50' : ''
            }`}
          >
            <div className="font-medium text-gray-900">{it.en}</div>
            <div className="text-xs text-gray-600 mt-0.5">
              {it.mr && <span className="mr-2">मराठी: {it.mr}</span>}
              {it.hi && <span>हिन्दी: {it.hi}</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ReceiptScanButton;
