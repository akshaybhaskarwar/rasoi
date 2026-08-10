/**
 * MonthResetSheet — confirmation for "Start new month".
 *
 * The action empties every monthly staple in one go, so it never fires on a
 * bare tap. Beyond guarding a destructive change, the counts are the only
 * place the frequency model is explained in situ: seeing "12 yearly · 6 as
 * needed left alone" teaches what the pills on each row mean far better
 * than a settings screen would, and "3 bought recently" makes the
 * skip-recent-purchases rule visible rather than mysterious.
 *
 * Review lists the affected rows so a wrong frequency can be spotted
 * before anything is emptied — the change there is permanent, not just for
 * this month.
 */
import { useEffect } from 'react';
import { X, CalendarClock, Loader2, ChevronRight, ChevronLeft } from 'lucide-react';
import { FrequencyStrip, getFrequency } from '@/components/FrequencyPicker';

export const MonthResetSheet = ({
  open,
  preview,          // { summary, items } | null — null while loading
  isReviewing,
  onToggleReview,
  onConfirm,
  onClose,
  busy = false,
  frequencyBusyId = null,
  onItemFrequencyChange,
}) => {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  const summary = preview?.summary;
  const items = preview?.items || [];
  const resetCount = summary?.monthly ?? 0;
  const leftAlone = (summary?.yearly ?? 0) + (summary?.as_needed ?? 0);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="month-reset-title"
      data-testid="month-reset-sheet"
    >
      <button
        type="button"
        onClick={busy ? undefined : onClose}
        aria-label="Close"
        className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
        tabIndex={-1}
      />

      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom duration-200 max-h-[88vh] flex flex-col">
        <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        <div className="px-5 pb-3 flex items-start gap-3 border-b border-gray-100 flex-shrink-0">
          <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
            <CalendarClock className="w-5 h-5 text-orange-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 id="month-reset-title" className="font-semibold text-gray-900 text-base">
              {isReviewing ? `Review ${resetCount} items` : 'Start a new month?'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {isReviewing
                ? 'Change anything that isn’t a monthly buy.'
                : preview
                  ? `${resetCount} monthly staples will be marked empty.`
                  : 'Checking your pantry…'}
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

        <div className="flex-1 overflow-y-auto">
          {!preview ? (
            <div className="flex items-center justify-center py-10 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : isReviewing ? (
            <div className="p-4 space-y-1">
              {items.map((item) => (
                <div key={item.id} className="rounded-xl border border-gray-200">
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <span className="flex-1 min-w-0 text-sm font-medium text-gray-800 truncate">
                      {item.name_en}
                      {item.name_mr && (
                        <span className="text-xs text-gray-400 ml-1.5">{item.name_mr}</span>
                      )}
                    </span>
                    <span className="text-xs text-gray-400 flex-shrink-0">{item.stock_level}</span>
                  </div>
                  <FrequencyStrip
                    value={getFrequency(item)}
                    busy={frequencyBusyId === item.id}
                    onSelect={(freq) => onItemFrequencyChange(item, freq)}
                  />
                </div>
              ))}
              {items.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-8">
                  Nothing to reset right now.
                </p>
              )}
            </div>
          ) : (
            <div className="p-4">
              <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Marked empty</span>
                  <span className="font-medium text-gray-800">{resetCount} monthly</span>
                </div>
                {leftAlone > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Left alone</span>
                    <span className="font-medium text-gray-800">
                      {summary.yearly > 0 && `${summary.yearly} yearly`}
                      {summary.yearly > 0 && summary.as_needed > 0 && ' · '}
                      {summary.as_needed > 0 && `${summary.as_needed} as needed`}
                    </span>
                  </div>
                )}
                {summary.recently_bought > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Skipped</span>
                    <span className="font-medium text-gray-800">
                      {summary.recently_bought} bought recently
                    </span>
                  </div>
                )}
                {summary.snoozed > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Snoozed</span>
                    <span className="font-medium text-gray-800">{summary.snoozed} items</span>
                  </div>
                )}
                {summary.already_empty > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Already empty</span>
                    <span className="font-medium text-gray-800">{summary.already_empty} items</span>
                  </div>
                )}
              </div>

              {resetCount > 0 && (
                <button
                  type="button"
                  onClick={onToggleReview}
                  data-testid="month-reset-review"
                  className="w-full mt-3 flex items-center justify-between px-3 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm text-gray-600">Review the {resetCount} items</span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="p-4 pt-2 border-t border-gray-100 flex-shrink-0 space-y-2">
          {isReviewing ? (
            <button
              type="button"
              onClick={onToggleReview}
              className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          ) : (
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy || !preview || resetCount === 0}
              data-testid="month-reset-confirm"
              className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {resetCount === 0 ? 'Nothing to reset' : 'Start new month'}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="w-full py-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            Cancel
          </button>
        </div>

        <div className="h-2" />
      </div>
    </div>
  );
};

export default MonthResetSheet;
