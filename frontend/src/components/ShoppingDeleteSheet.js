/**
 * ShoppingDeleteSheet — intent picker for deleting an auto-suggested
 * or recipe-sourced shopping list item.
 *
 * Bare hard-delete from the trash icon was making low-stock auto-
 * suggestions feel sticky — users would delete, only to have the same
 * item re-appear on the next add-missing pass. This sheet asks WHY
 * the user is removing it and routes the action accordingly:
 *
 *   - "Already have it" → inventory.stock_level = full + remove row.
 *     Backend: POST /shopping/{id}/already-have-it
 *   - "Skip this trip" → 7-day snooze + remove row. Backend honors
 *     the snooze in recipes' add-missing flow and dadi festival mode.
 *     Backend: PUT /shopping/{id}/snooze {days: 7}
 *   - "Cancel" → close the sheet, no change.
 *
 * For source:'manual' rows the parent (ShoppingPage) bypasses this
 * sheet entirely and hard-deletes with an undo toast — that's the
 * existing behavior, no ambiguity to resolve. This sheet is only
 * shown for source:'auto' and source:'recipe' rows.
 */
import { useEffect } from 'react';
import {
  X, Trash2, CheckCircle2, Clock, ChevronRight, Loader2,
} from 'lucide-react';

export const ShoppingDeleteSheet = ({
  item,         // ShoppingItem | null — sheet is open when truthy
  onClose,      // () => void
  onAlreadyHave, // (item) => Promise<void>
  onSnooze,      // (item, days) => Promise<void>
  busyAction,    // null | 'already-have' | 'snooze' — disables the row
}) => {
  // Lock body scroll while the sheet is open so the dimmed shopping
  // list behind it doesn't jiggle when the user drags on the sheet.
  useEffect(() => {
    if (!item) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [item]);

  if (!item) return null;

  const isBusy = Boolean(busyAction);
  const sourceLabel = item.source === 'recipe'
    ? 'From a recipe'
    : 'Auto-suggested · pantry low';

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shopping-delete-sheet-title"
      data-testid="shopping-delete-sheet"
    >
      {/* Backdrop — tap closes (unless an action is in-flight). */}
      <button
        type="button"
        onClick={isBusy ? undefined : onClose}
        aria-label="Close"
        className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
        tabIndex={-1}
      />

      {/* Bottom sheet */}
      <div
        className="relative w-full sm:max-w-md bg-white rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle (decorative — not actually draggable). */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header — what's about to be deleted, and why we're asking. */}
        <div className="px-5 pb-3 flex items-start gap-3 border-b border-gray-100">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
            <Trash2 className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2
              id="shopping-delete-sheet-title"
              className="font-semibold text-gray-900 text-base truncate"
            >
              Remove {item.name_en}?
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">{sourceLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 flex-shrink-0 disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action rows — each a big tap target with icon + label + sub. */}
        <div className="p-4 space-y-2">
          <button
            type="button"
            onClick={() => onAlreadyHave(item)}
            disabled={isBusy}
            data-testid="shopping-delete-already-have"
            className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-green-300 hover:bg-green-50/40 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
              {busyAction === 'already-have' ? (
                <Loader2 className="w-5 h-5 text-green-700 animate-spin" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-green-700" />
              )}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="font-semibold text-sm text-gray-900">Already have it</div>
              <div className="text-xs text-gray-500 mt-0.5">
                Mark pantry stocked, remove from list
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => onSnooze(item, 7)}
            disabled={isBusy}
            data-testid="shopping-delete-snooze"
            className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-amber-300 hover:bg-amber-50/40 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
              {busyAction === 'snooze' ? (
                <Loader2 className="w-5 h-5 text-amber-700 animate-spin" />
              ) : (
                <Clock className="w-5 h-5 text-amber-700" />
              )}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="font-semibold text-sm text-gray-900">Skip this trip</div>
              <div className="text-xs text-gray-500 mt-0.5">
                Snooze auto-suggest for 7 days
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            data-testid="shopping-delete-cancel"
            className="w-full p-3 mt-1 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 active:scale-[0.99] transition-all disabled:opacity-60"
          >
            Cancel
          </button>
        </div>

        {/* Safe-area bottom padding for iPhone home indicator. */}
        <div className="h-4 sm:h-2" />
      </div>
    </div>
  );
};

export default ShoppingDeleteSheet;
