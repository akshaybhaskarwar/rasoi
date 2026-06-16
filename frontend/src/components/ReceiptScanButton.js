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
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Receipt, Camera, Loader2, CheckCircle2, AlertCircle, XCircle, Search, X, Plus, Sparkles,
  ShoppingCart,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useReceiptIngestion, useShoppingList } from '@/hooks/useRasoiSync';
import { useLanguage } from '@/contexts/LanguageContext';
import { ManualItemEntryForm } from '@/components/ManualItemEntryForm';

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

// Normalize a name for matching: NFC + trim + lowercase. Devanagari survives
// untouched; Latin gets case-folded.
const _normalizeForMatch = (s) =>
  (s || '').normalize('NFC').trim().toLowerCase();

// Try to find one unpurchased shopping-list item that "is" this receipt row.
// Match priority: canonical-en exact -> Devanagari hint -> Marathi/Hindi
// names contains -> aliases. Returns the matched item or null.
const findShoppingMatch = (row, shoppingList) => {
  const candidates = (shoppingList || []).filter(
    s => s && s.shopping_status !== 'bought'
  );
  if (candidates.length === 0) return null;

  const en = _normalizeForMatch(row.name_canonical_en);
  const mr = (row.name_devanagari || '').normalize('NFC').trim();

  // Pass 1: exact canonical English (most reliable)
  if (en) {
    const hit = candidates.find(s => _normalizeForMatch(s.name_en) === en);
    if (hit) return hit;
  }
  // Pass 2: receipt's Devanagari hint matches the shopping item's Marathi/Hindi
  if (mr) {
    const hit = candidates.find(
      s => (s.name_mr && s.name_mr.normalize('NFC').includes(mr)) ||
           (s.name_hi && s.name_hi.normalize('NFC').includes(mr)),
    );
    if (hit) return hit;
  }
  // Pass 3: substring on en (catches "Atta" vs "Wheat Atta" etc.)
  if (en && en.length >= 3) {
    const hit = candidates.find(s => {
      const sName = _normalizeForMatch(s.name_en);
      return sName && (sName.includes(en) || en.includes(sName));
    });
    if (hit) return hit;
  }
  // Pass 4: aliases
  if (en) {
    const hit = candidates.find(s =>
      (s.aliases || []).some(a => _normalizeForMatch(a) === en),
    );
    if (hit) return hit;
  }
  return null;
};


const ReceiptScanButton = ({ onSuccess }) => {
  const { parseReceipt, saveConfirmedItems, parsing, saving } = useReceiptIngestion();
  const { shoppingList, fetchShoppingList } = useShoppingList();
  const { getLabel } = useLanguage();
  const fileInputRef = useRef(null);

  const [stage, setStage] = useState('idle'); // idle | confirming
  const [receipt, setReceipt] = useState(null); // server response
  const [rows, setRows] = useState([]);         // editable copy of items
  const [catalogOpen, setCatalogOpen] = useState(null); // row_id of row being matched
  // customAddOpen: when set, the inline "Add as new item" form overlays the
  // confirm dialog (for items that aren't in PANTRY_TEMPLATE). null = closed.
  const [customAddOpen, setCustomAddOpen] = useState(null);
  // Set of shopping-list item ids the user has opted OUT of cross-off for
  // (toggled the per-row "don't check off" affordance). Default is opt-in.
  const [optedOutShoppingIds, setOptedOutShoppingIds] = useState(new Set());

  // Refresh the shopping list every time the confirm dialog opens so the
  // matches reflect the latest state (other family members may have edited
  // the list between scans).
  useEffect(() => {
    if (stage === 'confirming') {
      fetchShoppingList?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

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
    setCustomAddOpen(null);
    setOptedOutShoppingIds(new Set());
  };

  // Pair each row to its shopping-list match (if any). Recomputed when the
  // rows change (qty edits don't move matches; catalog re-picks do) or the
  // shopping list refreshes.
  const matchedPairs = useMemo(() => {
    const usedIds = new Set();
    return rows.map(row => {
      // Skip rows the user explicitly skipped — no point matching them.
      if (row.action !== 'add') return { row, match: null };
      const candidate = findShoppingMatch(row, shoppingList);
      // De-dupe: don't match the same shopping item to two receipt rows.
      if (candidate && !usedIds.has(candidate.id)) {
        usedIds.add(candidate.id);
        return { row, match: candidate };
      }
      return { row, match: null };
    });
  }, [rows, shoppingList]);

  // Just the matches, for the "X items from your shopping list" summary.
  const shoppingMatches = useMemo(
    () => matchedPairs.filter(p => p.match).map(p => ({
      row: p.row,
      shoppingItem: p.match,
      optedOut: optedOutShoppingIds.has(p.match.id),
    })),
    [matchedPairs, optedOutShoppingIds],
  );

  const toggleShoppingMatchOptOut = (shoppingId) => {
    setOptedOutShoppingIds(prev => {
      const next = new Set(prev);
      if (next.has(shoppingId)) next.delete(shoppingId);
      else next.add(shoppingId);
      return next;
    });
  };

  const handleSave = async () => {
    const payload = rows.map(r => ({
      name_canonical_en: r.is_custom ? null : r.name_canonical_en,
      qty: r.qty ?? 1,
      unit: r.unit || 'UT',
      action: r.action,
      is_custom: !!r.is_custom,
      custom_name: r.is_custom ? r.custom_name : null,
      custom_category: r.is_custom ? r.custom_category : null,
      devanagari_hint: r.name_devanagari || null,
      // Claude's original catalog resolution (if any). Backend uses it as
      // an English alias on the inventory item so future English-text
      // searches find brand-name-Devanagari custom items.
      original_canonical_en: r.is_custom ? (r.original_canonical_en || null) : null,
    }));

    // Phase A — collect the shopping list ids the user is OK marking bought
    // (everything matched, minus anything the user opted out of, minus rows
    // the user chose to Skip).
    const shoppingIdsToMark = matchedPairs
      .filter(p => p.match && p.row.action === 'add' && !optedOutShoppingIds.has(p.match.id))
      .map(p => p.match.id);

    try {
      const result = await saveConfirmedItems(receipt.receipt_id, payload, shoppingIdsToMark);
      const crossedOff = result.shopping_items_marked || 0;
      toast.success(
        `Added ${result.added_count} items to inventory` +
        (crossedOff > 0 ? ` · ${crossedOff} checked off shopping list` : ''),
        {
          description: result.skipped_count > 0
            ? `${result.skipped_count} skipped`
            : 'Your kitchen is up to date.',
          duration: 4500,
        },
      );
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
        ? { ...r, name_canonical_en: canonicalEn, match_confidence: 'high', action: 'add', is_custom: false, custom_name: null, custom_category: null }
        : r
    ));
    setCatalogOpen(null);
  };

  // User confirmed adding a row as a brand-new (non-catalog) inventory item
  const applyCustomItem = (rowId, { name_en, category }) => {
    setRows(rs => rs.map(r =>
      r._row_id === rowId
        ? {
            ...r,
            is_custom: true,
            custom_name: name_en,
            custom_category: category || 'other',
            // Preserve Claude's original canonical English resolution (if any)
            // so the backend can save it as an alias on the inventory item.
            // Without this, the resulting inventory row's name_en is the user's
            // typed text (often Devanagari brand name) and an English-only
            // inventory search later won't find it.
            original_canonical_en: r.original_canonical_en || r.name_canonical_en || null,
            name_canonical_en: name_en,       // for confirm-screen display only
            match_confidence: 'high',
            action: 'add',
          }
        : r
    ));
    setCustomAddOpen(null);
    setCatalogOpen(null);
  };

  // Open the "Add as new item" form for a row, pre-filled with that row's
  // Devanagari text (default name) + qty/unit (default quantity). Closes the
  // catalog picker if it was open.
  const openCustomAddForRow = (rowId, { prefillName } = {}) => {
    const row = rows.find(r => r._row_id === rowId);
    if (!row) return;
    setCatalogOpen(null);
    setCustomAddOpen({
      rowId,
      prefillName: prefillName || row.name_canonical_en || row.name_devanagari || '',
      devanagariHint: row.name_devanagari || '',
      qty: row.qty,
      unit: row.unit,
    });
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
          // NOTE: Do NOT add `relative` here — it would override Radix's
          // `position: fixed` and break the centered modal layout. The inline
          // catalog overlay below uses `absolute inset-0` and is correctly
          // contained by the fixed-positioned DialogContent (position:fixed
          // creates a containing block for absolute descendants).
          className="max-w-3xl max-h-[90vh] overflow-y-auto custom-scrollbar p-0"
          // Prevent the parent dialog from closing if the user taps inside the
          // inline catalog overlay (which is rendered within this content area).
          onInteractOutside={(e) => {
            if (catalogOpen !== null || customAddOpen !== null) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (customAddOpen !== null) { e.preventDefault(); setCustomAddOpen(null); return; }
            if (catalogOpen !== null) { e.preventDefault(); setCatalogOpen(null); }
          }}
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

          {/* Phase A — Shopping list cross-off summary. Only shown when the
              receipt matches one or more unpurchased items on the household's
              shopping list. Tap "Don't check off" on any row to skip that one. */}
          {shoppingMatches.length > 0 && (
            <div className="mx-4 mt-4 p-3 rounded-xl border-2 border-emerald-200 bg-emerald-50/60">
              <div className="flex items-center gap-2 mb-2">
                <ShoppingCart className="w-4 h-4 text-emerald-700" />
                <span className="text-sm font-semibold text-emerald-900">
                  {shoppingMatches.length} item{shoppingMatches.length !== 1 ? 's' : ''} from your shopping list
                </span>
              </div>
              <div className="space-y-1.5">
                {shoppingMatches.map(({ shoppingItem, optedOut }) => (
                  <div
                    key={shoppingItem.id}
                    className={`flex items-center justify-between gap-2 text-sm rounded-lg px-2 py-1.5 ${
                      optedOut ? 'bg-white/60' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {optedOut ? (
                        <XCircle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      )}
                      <span className={`truncate ${optedOut ? 'text-gray-500 line-through' : 'text-gray-900 font-medium'}`}>
                        {shoppingItem.name_en}
                      </span>
                      {shoppingItem.quantity && shoppingItem.quantity !== '-' && (
                        <span className="text-xs text-gray-500 flex-shrink-0">
                          ({shoppingItem.quantity})
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => toggleShoppingMatchOptOut(shoppingItem.id)}
                      className={`text-xs font-medium px-2 py-1 rounded-md flex-shrink-0 ${
                        optedOut
                          ? 'text-emerald-700 bg-emerald-100 hover:bg-emerald-200'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                      data-testid={`shopping-toggle-${shoppingItem.id}`}
                    >
                      {optedOut ? 'Will check off' : "Don't check off"}
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-emerald-700/80 mt-2">
                These will be marked bought on your shopping list when you tap Add.
              </p>
            </div>
          )}

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
                        <div className="font-semibold text-gray-900 flex items-center flex-wrap gap-x-2 gap-y-1">
                          {row.name_canonical_en ? (
                            <>
                              <span>{row.name_canonical_en}</span>
                              {row.is_custom && (
                                <Badge variant="outline" className="text-[10px] py-0 border-purple-300 text-purple-700 bg-purple-50">
                                  custom
                                </Badge>
                              )}
                              <button
                                onClick={() => setCatalogOpen(row._row_id)}
                                className="text-xs text-blue-600 underline"
                              >
                                change
                              </button>
                            </>
                          ) : (
                            <span className="flex flex-wrap gap-2">
                              <button
                                onClick={() => setCatalogOpen(row._row_id)}
                                className="text-blue-600 underline text-sm"
                                data-testid={`pick-catalog-${row._row_id}`}
                              >
                                Pick from catalog…
                              </button>
                              <button
                                onClick={() => openCustomAddForRow(row._row_id)}
                                className="text-purple-700 underline text-sm flex items-center gap-1"
                                data-testid={`add-as-new-${row._row_id}`}
                              >
                                <Plus className="w-3 h-3" /> Add as new
                              </button>
                            </span>
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
              onAddAsNew={(prefillName) => openCustomAddForRow(catalogOpen, { prefillName })}
              currentValue={rows.find(r => r._row_id === catalogOpen)?.name_canonical_en}
              devanagariHint={rows.find(r => r._row_id === catalogOpen)?.name_devanagari}
            />
          )}

          {/* Inline "Add as new item" overlay — same rendering technique as the
              catalog picker. Closing it just unmounts the div; parent dialog
              state is untouched. */}
          {customAddOpen !== null && (
            <CustomAddOverlay
              ctx={customAddOpen}
              onClose={() => setCustomAddOpen(null)}
              onSubmit={(data) => applyCustomItem(customAddOpen.rowId, data)}
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
const CatalogPickOverlay = ({ onClose, onPick, onAddAsNew, currentValue, devanagariHint }) => {
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
          <div className="p-6 text-center space-y-4">
            <p className="text-sm text-gray-500">
              No catalog entries match "{query}".
            </p>
            {onAddAsNew && (
              <button
                onClick={() => onAddAsNew(query.trim() || devanagariHint || '')}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-lg bg-purple-50 border-2 border-purple-200 text-purple-700 font-medium hover:bg-purple-100 transition-colors"
                data-testid="catalog-pick-add-as-new"
              >
                <Sparkles className="w-4 h-4" />
                Add "{query.trim() || devanagariHint || 'this item'}" as a new item
              </button>
            )}
          </div>
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

        {/* Always-available footer CTA for users who searched but couldn't
            find the right entry — covers the case where they DID get some
            results but none are the actual item they bought. */}
        {!loading && onAddAsNew && items.length > 0 && filtered.length > 0 && (
          <button
            onClick={() => onAddAsNew(query.trim() || devanagariHint || '')}
            className="flex items-center gap-2 w-full px-4 py-3 text-purple-700 text-sm font-medium hover:bg-purple-50 border-t-2 border-purple-100"
            data-testid="catalog-pick-add-as-new-footer"
          >
            <Plus className="w-4 h-4" />
            None of these — add "{query.trim() || devanagariHint || 'this item'}" as a new item
          </button>
        )}
      </div>
    </div>
  );
};


// =============================================================================
// CustomAddOverlay — wraps ManualItemEntryForm in the same inline-absolute
// pattern as CatalogPickOverlay so it overlays the confirm dialog without
// nesting Radix Dialogs.
// =============================================================================
const CustomAddOverlay = ({ ctx, onClose, onSubmit }) => (
  <div
    className="absolute inset-0 bg-white z-20 flex flex-col overflow-y-auto"
    data-testid="custom-add-overlay"
  >
    <div className="p-5 pb-3 border-b flex items-start justify-between">
      <div>
        <div className="flex items-center gap-2 font-semibold text-lg">
          <Plus className="w-5 h-5 text-purple-600" />
          Add as a new item
        </div>
        {ctx.devanagariHint && (
          <p className="text-xs text-gray-600 mt-1">
            On the receipt: <strong className="text-gray-800">{ctx.devanagariHint}</strong>
          </p>
        )}
        <p className="text-xs text-gray-500 mt-1">
          We will add this to your inventory now and remember it for next time.
        </p>
      </div>
      <button
        onClick={onClose}
        className="text-gray-500 hover:text-gray-900 p-1 -m-1"
        aria-label="Close add-as-new form"
        data-testid="custom-add-close"
      >
        <X className="w-5 h-5" />
      </button>
    </div>

    <div className="p-4 pb-24 md:pb-4">
      <ManualItemEntryForm
        initialName={ctx.prefillName}
        initialCategory="other"
        initialQuantity={ctx.qty != null ? `${ctx.qty} ${ctx.unit || 'pcs'}` : ''}
        showExpiry={false}
        submitLabel="Add to inventory"
        submitIcon={<Plus className="w-5 h-5 mr-2" />}
        submitClassName="bg-purple-600 hover:bg-purple-700 text-white"
        onSubmit={({ name_en, category }) => onSubmit({ name_en, category })}
        onCancel={onClose}
        cancelLabel="Back"
      />
    </div>
  </div>
);

export default ReceiptScanButton;
