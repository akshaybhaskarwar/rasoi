/**
 * BrowseMenuPanel — Phase 1 of the Menu Browse feature.
 *
 * Surfaces the EVERYDAY_MENU catalog (Maharashtrian vegetarian meal
 * components) plus this household's custom dishes inside the planner's
 * recipe dialog. The user picks a dish → onPick fires with the chosen
 * dish, parent uses it to populate addMealPlan.
 *
 * Mobile-first layout:
 *   - Big category pill tabs in a horizontal scroller with scroll-hint
 *     gradients so it's obvious there's more off-screen
 *   - Whole dish row is one tap target — no separate "+ Add" button
 *   - Search and "Add your own" stack vertically on narrow screens
 *   - Custom-item edit/delete tucked behind a 3-dot menu so they don't
 *     compete with the primary tap action
 *   - Error state is shown explicitly (not silently empty) so a failed
 *     /api/menu request surfaces clearly to the user
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Plus, X, Search, Sparkles, Edit2, Trash2, Loader2, Utensils,
  AlertTriangle, Check, ChevronRight, MoreVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMenu } from '@/hooks/useRasoiSync';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

// Surface order — single-dish categories first, then composed thalis.
const CATEGORY_DISPLAY = [
  { key: 'Chapati',    label: 'Roti',         icon: '🫓' },
  { key: 'Dal',        label: 'Dal',          icon: '🍲' },
  { key: 'Sabji',      label: 'Sabji',        icon: '🥬' },
  { key: 'Rice',       label: 'Rice',         icon: '🍚' },
  { key: 'Koshimbhir', label: 'Koshimbhir',   icon: '🥗' },
  { key: 'Chatni',     label: 'Chatni',       icon: '🌶️' },
  { key: 'KadhiSaar',  label: 'Kadhi',        icon: '🍵' },
  { key: 'Gole',       label: 'Gole',         icon: '🥟' },
  { key: 'Gravies',    label: 'Gravies',      icon: '🥘' },
  { key: 'Custom',     label: 'Other',        icon: '✨' },
  { key: '_Thalis',    label: 'Thalis',       icon: '🍱' },
];

export const BrowseMenuPanel = ({ onPick }) => {
  const { catalog, custom, composed, loading, error, refresh,
          addCustom, editCustom, deleteCustom } = useMenu();
  const { language } = useLanguage();

  const [activeCategory, setActiveCategory] = useState('Chapati');
  const [vegFilter, setVegFilter] = useState(null);     // for Sabji only
  const [searchQuery, setSearchQuery] = useState('');
  // null = closed; { category, mode: 'add'|'edit', initial: {...} }
  const [addOpen, setAddOpen] = useState(null);
  // Used to flash a confirmation badge on the tapped row before the parent
  // dialog closes; gives the user clear feedback that the tap registered.
  const [justTapped, setJustTapped] = useState(null);
  // Per-custom-row menu state for Edit/Delete actions (id of open menu)
  const [openMenuId, setOpenMenuId] = useState(null);

  useEffect(() => {
    setVegFilter(null);
    setSearchQuery('');
    setOpenMenuId(null);
  }, [activeCategory]);

  // Catalog + household's custom items, merged for the current category
  const currentItems = useMemo(() => {
    if (activeCategory === '_Thalis') return [];
    const cat = catalog[activeCategory] || [];
    const own = custom[activeCategory] || [];
    return [...cat, ...own];
  }, [activeCategory, catalog, custom]);

  // Vegetable tag chips for the Sabji tab
  const sabjiVeggies = useMemo(() => {
    if (activeCategory !== 'Sabji') return [];
    const tags = new Set();
    currentItems.forEach(it => {
      const tag = it.vegetable_tag || it.vegetable;
      if (tag) tags.add(tag);
    });
    return Array.from(tags).sort();
  }, [activeCategory, currentItems]);

  const visibleItems = useMemo(() => {
    let xs = currentItems;
    if (activeCategory === 'Sabji' && vegFilter) {
      xs = xs.filter(it => (it.vegetable_tag || it.vegetable) === vegFilter);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      xs = xs.filter(it =>
        (it.en || it.name_en || '').toLowerCase().includes(q) ||
        (it.mr || it.name_mr || '').includes(searchQuery.trim()) ||
        ((it.aliases || []).some(a => a.toLowerCase().includes(q)))
      );
    }
    return xs;
  }, [currentItems, activeCategory, vegFilter, searchQuery]);

  const composedItems = useMemo(() => {
    if (activeCategory !== '_Thalis') return [];
    return [
      ...(composed.PartyTime || []).map(t => ({ ...t, source: 'PartyTime' })),
      ...(composed.Combinations || []).map(t => ({ ...t, source: 'Combinations' })),
    ];
  }, [activeCategory, composed]);

  const handlePickDish = (item) => {
    const name_en = item.en || item.name_en || '';
    const name_mr = item.mr || item.name_mr || '';
    if (!name_en) {
      toast.error('This dish is missing its name — please report it.');
      return;
    }
    // Flash a check next to the tapped row so the user gets feedback
    // even if the parent dialog takes a beat to close.
    setJustTapped(`${name_en}-${item.id || ''}`);
    onPick({ name_en, name_mr });
  };

  const handlePickThali = (thali) => {
    const meal_name = `${thali.title} — ${thali.components.map(c => c.name).join(' + ')}`;
    setJustTapped(thali.title);
    onPick({ name_en: meal_name });
  };

  const handleDeleteCustom = async (id, name) => {
    if (!window.confirm(`Remove "${name}" from your menu?`)) return;
    setOpenMenuId(null);
    try {
      await deleteCustom(id);
      toast.success('Removed', { description: name });
    } catch (e) {
      toast.error('Could not remove', { description: e?.response?.data?.detail || e.message });
    }
  };

  return (
    <div className="space-y-3" data-testid="browse-menu-panel">
      {/* Category tab row — bigger, with edge-fade scroll hints on mobile */}
      <div className="relative">
        <div
          className="flex gap-1.5 overflow-x-auto pb-1 -mx-2 px-2 scroll-smooth"
          style={{ scrollbarWidth: 'none' }}
        >
          {CATEGORY_DISPLAY.map(cat => {
            const count =
              cat.key === '_Thalis'
                ? (composed.PartyTime?.length || 0) + (composed.Combinations?.length || 0)
                : (catalog[cat.key]?.length || 0) + (custom[cat.key]?.length || 0);
            const isActive = activeCategory === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`shrink-0 px-3 py-2.5 rounded-xl text-sm font-medium transition-all min-w-[64px] ${
                  isActive
                    ? 'bg-[#FF9933] text-white shadow-md scale-105'
                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 active:scale-95'
                }`}
                data-testid={`menu-cat-${cat.key}`}
              >
                <div className="flex flex-col items-center gap-0.5 leading-none">
                  <span className="text-lg">{cat.icon}</span>
                  <span className="text-[11px]">{cat.label}</span>
                  {count > 0 && (
                    <span className={`text-[9px] ${isActive ? 'opacity-90' : 'text-gray-500'}`}>
                      {count}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        {/* Edge-fade hints so it's visually clear the row is scrollable */}
        <div className="pointer-events-none absolute right-0 top-0 bottom-1 w-6 bg-gradient-to-l from-white to-transparent" />
        <div className="pointer-events-none absolute left-0 top-0 bottom-1 w-4 bg-gradient-to-r from-white to-transparent" />
      </div>

      {/* Error state */}
      {error && !loading && (
        <div className="border-2 border-red-200 bg-red-50 rounded-xl p-3 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-red-900">Could not load the menu</div>
            <div className="text-xs text-red-700 mt-0.5 break-words">{error}</div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => refresh()}
            className="h-8 text-xs flex-shrink-0"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Search + Add-your-own — stacks vertically on narrow screens */}
      {!error && activeCategory !== '_Thalis' && (
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${CATEGORY_DISPLAY.find(c => c.key === activeCategory)?.label}...`}
              className="pl-9 h-11"
              data-testid="menu-search"
            />
          </div>
          <Button
            onClick={() =>
              setAddOpen({ category: activeCategory, mode: 'add', initial: {} })
            }
            className="h-11 bg-purple-600 hover:bg-purple-700 text-white"
            data-testid="menu-add-own"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add your own
          </Button>
        </div>
      )}

      {/* Sabji vegetable filter chips */}
      {!error && activeCategory === 'Sabji' && sabjiVeggies.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          <button
            onClick={() => setVegFilter(null)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition active:scale-95 ${
              !vegFilter
                ? 'bg-green-100 border-2 border-green-400 text-green-800'
                : 'bg-white border border-gray-300 text-gray-600'
            }`}
          >
            All
          </button>
          {sabjiVeggies.map(v => (
            <button
              key={v}
              onClick={() => setVegFilter(v)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition active:scale-95 ${
                vegFilter === v
                  ? 'bg-green-100 border-2 border-green-400 text-green-800'
                  : 'bg-white border border-gray-300 text-gray-600 hover:border-gray-400'
              }`}
              data-testid={`menu-veg-${v}`}
            >
              {v}
            </button>
          ))}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="text-center py-10 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          Loading menu…
        </div>
      )}

      {/* Empty state for Custom tab */}
      {!loading && !error && activeCategory === 'Custom' && visibleItems.length === 0 && (
        <div className="text-center py-10 text-gray-500">
          <Utensils className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm">No "Other" custom dishes yet.</p>
          <p className="text-xs text-gray-400 mt-1">
            Tap "Add your own" to add an item that does not fit the other categories.
          </p>
        </div>
      )}

      {/* Dish rows — single-column, full-width tap target */}
      {!loading && !error && activeCategory !== '_Thalis' && (
        <div className="space-y-1.5">
          {visibleItems.map((item, idx) => {
            const enName = item.en || item.name_en || '';
            const mrName = item.mr || item.name_mr || '';
            const isCustom = !!item.is_custom;
            const showMr = mrName && language !== 'en';
            const tagKey = `${enName}-${item.id || ''}`;
            const wasJustTapped = justTapped === tagKey;

            return (
              <div
                key={`${enName}-${idx}-${item.id || ''}`}
                className={`relative rounded-xl border transition-all active:scale-[0.99] ${
                  isCustom
                    ? 'bg-purple-50/40 border-purple-200'
                    : 'bg-white border-gray-200'
                } ${wasJustTapped ? 'ring-2 ring-green-400 ring-offset-1' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => handlePickDish(item)}
                  className="w-full text-left p-3 flex items-center gap-3 active:bg-orange-50/40 rounded-xl"
                  data-testid={`menu-pick-${enName}`}
                >
                  {/* Leading icon — green check if just tapped, else a "+" hint */}
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      wasJustTapped
                        ? 'bg-green-500 text-white'
                        : 'bg-[#77DD77]/15 text-[#138808]'
                    }`}
                  >
                    {wasJustTapped ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                  </div>

                  {/* Dish text */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm">{enName}</span>
                      {isCustom && (
                        <Badge variant="outline" className="text-[10px] py-0 border-purple-300 text-purple-700 bg-purple-100/50">
                          yours
                        </Badge>
                      )}
                      {item.vegetable_tag && activeCategory === 'Sabji' && !vegFilter && (
                        <Badge variant="outline" className="text-[10px] py-0 border-green-300 text-green-700">
                          {item.vegetable_tag}
                        </Badge>
                      )}
                    </div>
                    {showMr && (
                      <div className="text-xs text-gray-600 mt-0.5 break-words">{mrName}</div>
                    )}
                  </div>

                  {/* Trailing chevron — only when not just-tapped */}
                  {!wasJustTapped && (
                    <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  )}
                </button>

                {/* Custom-item action menu (tucked away — doesn't steal taps) */}
                {isCustom && (
                  <div className="absolute top-2 right-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === item.id ? null : item.id);
                      }}
                      className="w-7 h-7 rounded-full bg-white/80 border border-purple-200 flex items-center justify-center text-purple-700 active:scale-95"
                      aria-label="More actions"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                    {openMenuId === item.id && (
                      <div
                        className="absolute right-0 top-9 z-10 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => {
                            setOpenMenuId(null);
                            setAddOpen({
                              category: activeCategory,
                              mode: 'edit',
                              initial: {
                                id: item.id,
                                name_en: enName,
                                name_mr: mrName,
                                vegetable_tag: item.vegetable_tag || '',
                              },
                            });
                          }}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          onClick={() => handleDeleteCustom(item.id, enName)}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 w-full border-t border-gray-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {!loading && visibleItems.length === 0 && activeCategory !== 'Custom' && (
            <div className="text-center py-8 text-gray-500 text-sm">
              No matches{searchQuery ? ` for "${searchQuery}"` : ''}. Try a different search or
              tap <span className="font-medium text-purple-700">Add your own</span>.
            </div>
          )}
        </div>
      )}

      {/* Composed thali rows */}
      {!loading && !error && activeCategory === '_Thalis' && (
        <div className="space-y-1.5">
          {composedItems.map((thali) => {
            const wasJustTapped = justTapped === thali.title;
            return (
              <button
                key={`${thali.source}-${thali.title}`}
                type="button"
                onClick={() => handlePickThali(thali)}
                className={`w-full text-left rounded-xl border-2 p-3 transition-all active:scale-[0.99] ${
                  wasJustTapped
                    ? 'ring-2 ring-green-400 ring-offset-1 bg-green-50/60 border-green-300'
                    : 'bg-gradient-to-br from-amber-50 to-orange-50 border-orange-200 active:bg-orange-100/60'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  {wasJustTapped ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-orange-600" />
                  )}
                  <span className="font-semibold text-gray-900 text-sm">{thali.title}</span>
                </div>
                <div className="text-xs text-gray-600 flex flex-wrap gap-1">
                  {thali.components.map((c, i) => (
                    <span key={i} className="bg-white/70 px-1.5 py-0.5 rounded">{c.name}</span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Inline add/edit form */}
      {addOpen && (
        <CustomMenuItemForm
          ctx={addOpen}
          onClose={() => setAddOpen(null)}
          onSave={async (data) => {
            try {
              if (addOpen.mode === 'edit') {
                await editCustom(addOpen.initial.id, data);
                toast.success('Updated');
              } else {
                await addCustom(data);
                toast.success('Added to your menu');
              }
              setAddOpen(null);
            } catch (e) {
              const detail = e?.response?.data?.detail || e.message;
              toast.error('Could not save', { description: detail });
            }
          }}
        />
      )}
    </div>
  );
};


// =============================================================================
// CustomMenuItemForm — inline form for adding/editing a user dish.
// =============================================================================
const CustomMenuItemForm = ({ ctx, onClose, onSave }) => {
  const [nameEn, setNameEn] = useState(ctx.initial.name_en || '');
  const [nameMr, setNameMr] = useState(ctx.initial.name_mr || '');
  const [vegTag, setVegTag] = useState(ctx.initial.vegetable_tag || '');
  const [category, setCategory] = useState(ctx.category);
  const [saving, setSaving] = useState(false);

  const isSabji = category === 'Sabji';

  const handleSubmit = async () => {
    if (!nameEn.trim() || saving) return;
    setSaving(true);
    await onSave({
      category,
      name_en: nameEn.trim(),
      name_mr: nameMr.trim() || null,
      vegetable_tag: isSabji && vegTag.trim() ? vegTag.trim() : null,
    });
    setSaving(false);
  };

  return (
    <div className="border-2 border-purple-300 rounded-xl bg-purple-50/40 p-3 space-y-3" data-testid="custom-menu-form">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-600" />
          <span className="font-semibold text-sm text-purple-900">
            {ctx.mode === 'edit' ? 'Edit your dish' : 'Add your own dish'}
          </span>
        </div>
        <button onClick={onClose} aria-label="Close" className="text-gray-500 hover:text-gray-800">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2">
        <div>
          <label className="text-xs font-medium text-gray-700">Name (English) *</label>
          <Input
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            placeholder="e.g. Aaji's Special Chana Dal"
            className="h-10 mt-1"
            autoFocus
            data-testid="custom-form-name-en"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700">Name (Marathi)</label>
          <Input
            value={nameMr}
            onChange={(e) => setNameMr(e.target.value)}
            placeholder="उदा. आजीची चना डाळ"
            className="h-10 mt-1"
            data-testid="custom-form-name-mr"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700">Category</label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-10 mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_DISPLAY.filter(c => c.key !== '_Thalis').map(c => (
                <SelectItem key={c.key} value={c.key}>
                  {c.icon} {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {isSabji && (
          <div>
            <label className="text-xs font-medium text-gray-700">Vegetable (optional)</label>
            <Input
              value={vegTag}
              onChange={(e) => setVegTag(e.target.value)}
              placeholder="e.g. Brinjal, Bhindi, Tomato"
              className="h-10 mt-1"
              data-testid="custom-form-veg-tag"
            />
          </div>
        )}
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <Button variant="outline" onClick={onClose} disabled={saving} className="h-10">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!nameEn.trim() || saving}
          className="h-10 bg-purple-600 hover:bg-purple-700 text-white"
          data-testid="custom-form-save"
        >
          {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
          {ctx.mode === 'edit' ? 'Save changes' : 'Add to menu'}
        </Button>
      </div>
    </div>
  );
};

export default BrowseMenuPanel;
