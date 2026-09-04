/**
 * RestockPlannerSheet — successor to MonthResetSheet ("Start new month").
 *
 * The old sheet was all-or-nothing: confirm, and every eligible monthly
 * staple went empty; yearly and as-needed items could never be reset at
 * all. This sheet makes the selection explicit:
 *
 *   - three tabs, one per buying frequency, so the yearly bulk-buy and the
 *     as-needed odds-and-ends are reachable, not just monthly staples;
 *   - a checkbox per item. Monthly items arrive pre-ticked (except the
 *     skip cases), yearly / as-needed arrive unticked — opt-in by nature;
 *   - the skip cases (bought recently, snoozed) show up unticked with a
 *     reason tag instead of being silently dropped, so the rule is visible
 *     and overridable. Already-empty rows are disabled — ticking them
 *     would be a no-op and would pad the count on the button.
 *
 * Confirm sends exactly the ticked ids; the server snapshots the previous
 * stock levels so the toast's Undo works after a refresh. Secret-stash
 * items never appear here — this is shared household UI.
 */
import { useEffect, useMemo, useState } from 'react';
import { X, ListChecks, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { FrequencyStrip } from '@/components/FrequencyPicker';

const TABS = [
  { value: 'monthly', labelKey: 'freqMonthly' },
  { value: 'yearly', labelKey: 'freqYearly' },
  { value: 'as_needed', labelKey: 'freqAsNeeded' },
];

const REASON_KEYS = {
  recently_bought: 'boughtRecently',
  snoozed: 'snoozedTag',
  already_empty: 'alreadyEmptyTag',
};

export const RestockPlannerSheet = ({
  open,
  preview,          // { summary, items } | null — null while loading
  onConfirm,        // (selectedIds: string[]) => void
  onClose,
  busy = false,
  frequencyBusyId = null,
  onItemFrequencyChange,
}) => {
  const { getLabel, language } = useLanguage();
  const [activeTab, setActiveTab] = useState('monthly');
  // null = "not initialised yet" — the first preview seeds the ticks from
  // the server's suggestions; later preview refreshes (after a frequency
  // change) must NOT re-seed, or they'd wipe the user's choices.
  const [selectedIds, setSelectedIds] = useState(null);
  const [freqOpenId, setFreqOpenId] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Fresh state every time the sheet opens.
  useEffect(() => {
    if (!open) {
      setActiveTab('monthly');
      setSelectedIds(null);
      setFreqOpenId(null);
    }
  }, [open]);

  useEffect(() => {
    if (open && preview && selectedIds === null) {
      setSelectedIds(new Set(preview.items.filter((i) => i.suggested).map((i) => i.id)));
    }
  }, [open, preview, selectedIds]);

  const items = useMemo(() => preview?.items || [], [preview]);
  const selected = useMemo(() => selectedIds || new Set(), [selectedIds]);

  // already_empty ids can linger in `selected` (e.g. after a frequency
  // change ticks an item optimistically) — they're excluded here so the
  // button count and the request only ever carry real changes.
  const selectableIds = useMemo(
    () => new Set(items.filter((i) => i.reason !== 'already_empty').map((i) => i.id)),
    [items],
  );
  const effectiveSelected = useMemo(
    () => [...selected].filter((id) => selectableIds.has(id)),
    [selected, selectableIds],
  );

  if (!open) return null;

  const tabItems = items.filter((i) => i.frequency === activeTab);
  const tabSelectable = tabItems.filter((i) => i.reason !== 'already_empty');
  const tabSelectedCount = tabSelectable.filter((i) => selected.has(i.id)).length;
  const allTabSelected = tabSelectable.length > 0 && tabSelectedCount === tabSelectable.length;

  const toggleItem = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAllInTab = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      tabSelectable.forEach((i) => (allTabSelected ? next.delete(i.id) : next.add(i.id)));
      return next;
    });
  };

  const handleFrequencySelect = (item, frequency) => {
    setFreqOpenId(null);
    if (frequency === item.frequency) return;
    // Moving an item to monthly mid-planning almost always means "and buy
    // it this cycle" — tick it up front (untickable if wrong; already-empty
    // rows are filtered out at confirm anyway).
    if (frequency === 'monthly') {
      setSelectedIds((prev) => new Set(prev).add(item.id));
    }
    onItemFrequencyChange(item, frequency);
  };

  const regionalName = (item) =>
    (language === 'hi' ? item.name_hi : language === 'mr' ? item.name_mr : null);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="restock-planner-title"
      data-testid="month-reset-sheet"
    >
      <button
        type="button"
        onClick={busy ? undefined : onClose}
        aria-label="Close"
        className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
        tabIndex={-1}
      />

      {/* Bottom sheet on phones, centred dialog on desktop — a full-height
          bottom-anchored panel on a wide screen pushes its own footer past
          the fold. */}
      <div className="sheet-viewport relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl animate-in slide-in-from-bottom duration-200 flex flex-col overflow-hidden">
        <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        <div className="px-5 pb-3 flex items-start gap-3 flex-shrink-0">
          <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
            <ListChecks className="w-5 h-5 text-orange-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 id="restock-planner-title" className="font-semibold text-gray-900 text-base">
              {getLabel('planRestock')}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {preview ? getLabel('restockHint') : getLabel('checkingPantry')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 flex-shrink-0 disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Frequency tabs */}
        <div className="px-4 pb-2 flex gap-1.5 flex-shrink-0 border-b border-gray-100">
          {TABS.map((tab) => {
            const count = items.filter((i) => i.frequency === tab.value).length;
            const isActive = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => { setActiveTab(tab.value); setFreqOpenId(null); }}
                aria-pressed={isActive}
                data-testid={`restock-tab-${tab.value}`}
                className={`flex-1 min-h-[40px] px-1 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-orange-50 text-orange-700 border border-orange-300'
                    : 'text-gray-500 border border-transparent hover:bg-gray-50'
                }`}
              >
                {getLabel(tab.labelKey)}
                <span className={`ml-1 tabular-nums ${isActive ? 'text-orange-500' : 'text-gray-400'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto">
          {!preview ? (
            <div className="flex items-center justify-center py-10 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : tabItems.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-10">{getLabel('nothingHere')}</p>
          ) : (
            <div className="pb-2">
              <div className="flex items-center justify-between px-4 py-2">
                <span className="text-xs text-gray-400 tabular-nums">
                  {tabSelectedCount}/{tabSelectable.length}
                </span>
                {tabSelectable.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleAllInTab}
                    data-testid="restock-select-all"
                    className="text-xs font-medium text-orange-600 hover:text-orange-700 py-1 px-2 -mr-2 rounded"
                  >
                    {allTabSelected ? getLabel('clearAll') : getLabel('selectAll')}
                  </button>
                )}
              </div>

              {tabItems.map((item) => {
                const disabled = item.reason === 'already_empty';
                const regional = regionalName(item);
                return (
                  <div key={item.id} className="border-t border-gray-100 last:border-b">
                    <div className="flex items-center gap-2.5 px-4 py-1">
                      <input
                        type="checkbox"
                        checked={!disabled && selected.has(item.id)}
                        disabled={disabled || busy}
                        onChange={() => toggleItem(item.id)}
                        aria-label={item.name_en}
                        data-testid={`restock-check-${item.id}`}
                        className="w-5 h-5 accent-orange-500 flex-shrink-0 disabled:opacity-40"
                      />
                      {/* The name is a second toggle target — a 20px checkbox
                          alone is a miss-tap on a phone. */}
                      <button
                        type="button"
                        onClick={() => { if (!disabled) toggleItem(item.id); }}
                        className="flex-1 min-w-0 text-left py-1.5"
                      >
                        <span className={`block text-sm font-medium truncate ${disabled ? 'text-gray-400' : 'text-gray-800'}`}>
                          {item.name_en}
                          {regional && (
                            <span className="text-xs text-gray-400 font-normal ml-1.5">{regional}</span>
                          )}
                        </span>
                        <span className="flex items-center gap-1.5 mt-0.5">
                          {item.stock_level && (
                            <span className="text-[11px] text-gray-400">
                              {getLabel(item.stock_level).toLowerCase()}
                            </span>
                          )}
                          {item.reason && (
                            <span className={`text-[10px] px-1.5 py-px rounded-full ${
                              item.reason === 'recently_bought'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}>
                              {getLabel(REASON_KEYS[item.reason])}
                            </span>
                          )}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFreqOpenId((cur) => (cur === item.id ? null : item.id))}
                        data-testid={`restock-freq-${item.id}`}
                        className="text-[11px] text-gray-400 hover:text-gray-600 py-2 px-1.5 flex-shrink-0"
                      >
                        {getLabel('changeLabel')}
                      </button>
                    </div>
                    {freqOpenId === item.id && (
                      <FrequencyStrip
                        value={item.frequency}
                        busy={frequencyBusyId === item.id}
                        onSelect={(freq) => handleFrequencySelect(item, freq)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="sheet-safe-bottom p-4 pt-3 border-t border-gray-100 flex-shrink-0 space-y-2">
          <button
            type="button"
            onClick={() => onConfirm(effectiveSelected)}
            disabled={busy || !preview || effectiveSelected.length === 0}
            data-testid="month-reset-confirm"
            className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {effectiveSelected.length === 0
              ? getLabel('nothingSelected')
              : getLabel('markEmptyCount', { n: effectiveSelected.length })}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="w-full py-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            {getLabel('cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RestockPlannerSheet;
