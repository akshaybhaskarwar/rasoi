/**
 * BrowseMenuPanel — Phase 1 of the Menu Browse feature.
 *
 * Surfaces the EVERYDAY_MENU catalog (Maharashtrian vegetarian meal
 * components) plus this household's custom dishes inside the planner's
 * recipe dialog. The user picks a dish → onPick fires with the chosen
 * dish, parent uses it to populate addMealPlan.
 *
 * Each category has a "+ Add your own ..." button (Option B from the PM
 * brief) that opens an inline form pre-filled with the category. The
 * household's own custom items show a small "yours" badge with edit/
 * delete affordances.
 *
 * Sabji additionally shows a horizontal row of vegetable-filter chips
 * so 100+ sabji rows are scannable in one tap.
 */
import { useEffect, useMemo, useState } from 'react';
import { Plus, X, Search, Sparkles, Edit2, Trash2, Loader2, Utensils } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMenu } from '@/hooks/useRasoiSync';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

// Surface order — single-dish categories first, then composed thalis.
const CATEGORY_DISPLAY = [
  { key: 'Chapati',    label: 'Chapati / Roti',   icon: '🫓' },
  { key: 'Dal',        label: 'Dal',              icon: '🍲' },
  { key: 'Sabji',      label: 'Sabji',            icon: '🥬' },
  { key: 'Rice',       label: 'Rice',             icon: '🍚' },
  { key: 'Koshimbhir', label: 'Koshimbhir',       icon: '🥗' },
  { key: 'Chatni',     label: 'Chatni',           icon: '🌶️' },
  { key: 'KadhiSaar',  label: 'Kadhi / Saar',     icon: '🍵' },
  { key: 'Gole',       label: 'Gole',             icon: '🥟' },
  { key: 'Gravies',    label: 'Gravies',          icon: '🥘' },
  { key: 'Custom',     label: 'Other (Custom)',   icon: '✨' },
  { key: '_Thalis',    label: 'Whole Thalis',     icon: '🍱' }, // composed meals
];

export const BrowseMenuPanel = ({ onPick }) => {
  const { catalog, custom, composed, loading, addCustom, editCustom, deleteCustom } = useMenu();
  const { language } = useLanguage();

  const [activeCategory, setActiveCategory] = useState('Chapati');
  const [vegFilter, setVegFilter] = useState(null);   // for Sabji tab only
  const [searchQuery, setSearchQuery] = useState('');

  // Inline form for adding/editing a custom dish.
  // null = closed; otherwise { category, mode: 'add'|'edit', initial: {id?,name_en,name_mr,vegetable_tag} }
  const [addOpen, setAddOpen] = useState(null);

  // Reset filter + search when switching tabs
  useEffect(() => {
    setVegFilter(null);
    setSearchQuery('');
  }, [activeCategory]);

  // Merged items for the current category (catalog + this household's custom)
  const currentItems = useMemo(() => {
    if (activeCategory === '_Thalis') return [];
    const cat = catalog[activeCategory] || [];
    const own = custom[activeCategory] || [];
    return [...cat, ...own];
  }, [activeCategory, catalog, custom]);

  // Unique vegetable tags for the Sabji chip row
  const sabjiVeggies = useMemo(() => {
    if (activeCategory !== 'Sabji') return [];
    const tags = new Set();
    currentItems.forEach(it => it.vegetable_tag || it.vegetable ? tags.add(it.vegetable_tag || it.vegetable) : null);
    return Array.from(tags).sort();
  }, [activeCategory, currentItems]);

  // Filter pass for the visible card grid
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
    // Normalize to {name_en, name_mr} regardless of source (catalog uses en/mr,
    // custom uses name_en/name_mr).
    const name_en = item.en || item.name_en || '';
    const name_mr = item.mr || item.name_mr || '';
    if (!name_en) return;
    onPick({ name_en, name_mr });
  };

  const handlePickThali = (thali) => {
    const meal_name = `${thali.title} — ${thali.components.map(c => c.name).join(' + ')}`;
    onPick({ name_en: meal_name });
  };

  const handleDeleteCustom = async (id, name) => {
    if (!window.confirm(`Remove "${name}" from your menu?`)) return;
    try {
      await deleteCustom(id);
      toast.success('Removed', { description: name });
    } catch (e) {
      toast.error('Could not remove', { description: e.message });
    }
  };

  return (
    <div className="space-y-3" data-testid="browse-menu-panel">
      {/* Category tab row — horizontally scrollable on mobile */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
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
              className={`shrink-0 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                isActive
                  ? 'bg-[#FF9933] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              data-testid={`menu-cat-${cat.key}`}
            >
              <span className="mr-1">{cat.icon}</span>
              {cat.label}
              {count > 0 && (
                <span className={`ml-1.5 text-[10px] opacity-80`}>({count})</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search + Add-your-own row */}
      {activeCategory !== '_Thalis' && (
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${CATEGORY_DISPLAY.find(c => c.key === activeCategory)?.label}...`}
              className="pl-9 h-10"
              data-testid="menu-search"
            />
          </div>
          <Button
            onClick={() =>
              setAddOpen({ category: activeCategory, mode: 'add', initial: {} })
            }
            className="h-10 bg-purple-600 hover:bg-purple-700 text-white shrink-0"
            data-testid="menu-add-own"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add your own
          </Button>
        </div>
      )}

      {/* Sabji vegetable filter chips */}
      {activeCategory === 'Sabji' && sabjiVeggies.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          <button
            onClick={() => setVegFilter(null)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${
              !vegFilter ? 'bg-green-100 border-2 border-green-400 text-green-800' : 'bg-white border border-gray-300 text-gray-600'
            }`}
          >
            All
          </button>
          {sabjiVeggies.map(v => (
            <button
              key={v}
              onClick={() => setVegFilter(v)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${
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
      {!loading && activeCategory === 'Custom' && visibleItems.length === 0 && (
        <div className="text-center py-10 text-gray-500">
          <Utensils className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm">No "Other" custom dishes yet.</p>
          <p className="text-xs text-gray-400 mt-1">Tap "Add your own" to add an item that does not fit the other categories.</p>
        </div>
      )}

      {/* Dish cards — category view */}
      {!loading && activeCategory !== '_Thalis' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {visibleItems.map((item, idx) => {
            const enName = item.en || item.name_en || '';
            const mrName = item.mr || item.name_mr || '';
            const isCustom = item.is_custom;
            const showMr = mrName && language !== 'en';
            return (
              <div
                key={`${enName}-${idx}-${item.id || ''}`}
                className={`border rounded-xl p-3 hover:border-[#FF9933] hover:shadow-sm transition-all ${
                  isCustom ? 'bg-purple-50/30 border-purple-200' : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    onClick={() => handlePickDish(item)}
                    className="flex-1 text-left min-w-0"
                    data-testid={`menu-pick-${enName}`}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
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
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    {isCustom && (
                      <>
                        <button
                          onClick={() =>
                            setAddOpen({
                              category: activeCategory,
                              mode: 'edit',
                              initial: {
                                id: item.id,
                                name_en: enName,
                                name_mr: mrName,
                                vegetable_tag: item.vegetable_tag || '',
                              },
                            })
                          }
                          className="p-1.5 text-gray-500 hover:text-blue-600"
                          aria-label="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteCustom(item.id, enName)}
                          className="p-1.5 text-gray-500 hover:text-red-600"
                          aria-label="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    <Button
                      size="sm"
                      onClick={() => handlePickDish(item)}
                      className="h-7 px-2 bg-[#77DD77] hover:bg-[#66CC66] text-white text-[11px]"
                      data-testid={`menu-add-${enName}`}
                    >
                      <Plus className="w-3 h-3 mr-0.5" /> Add
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
          {!loading && visibleItems.length === 0 && activeCategory !== 'Custom' && (
            <div className="col-span-full text-center py-8 text-gray-500 text-sm">
              No matches{searchQuery ? ` for "${searchQuery}"` : ''}. Try a different search or
              tap <span className="font-medium text-purple-700">Add your own</span>.
            </div>
          )}
        </div>
      )}

      {/* Composed thali cards */}
      {!loading && activeCategory === '_Thalis' && (
        <div className="grid grid-cols-1 gap-2">
          {composedItems.map((thali) => (
            <div
              key={`${thali.source}-${thali.title}`}
              className="border rounded-xl p-3 bg-gradient-to-br from-amber-50 to-orange-50 border-orange-200"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-orange-600" />
                    <span className="font-semibold text-gray-900 text-sm">{thali.title}</span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1 flex flex-wrap gap-1">
                    {thali.components.map((c, i) => (
                      <span key={i} className="bg-white/70 px-1.5 py-0.5 rounded">{c.name}</span>
                    ))}
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handlePickThali(thali)}
                  className="h-8 px-3 bg-[#FF9933] hover:bg-[#E68A2E] text-white text-xs shrink-0"
                >
                  <Plus className="w-3 h-3 mr-1" /> Use thali
                </Button>
              </div>
            </div>
          ))}
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
// CustomMenuItemForm — small inline form for adding/editing a user dish.
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium text-gray-700">Name (English) *</label>
          <Input
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            placeholder="e.g. Aaji's Special Chana Dal"
            className="h-9 mt-1"
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
            className="h-9 mt-1"
            data-testid="custom-form-name-mr"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700">Category</label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-9 mt-1">
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
            <label className="text-xs font-medium text-gray-700">Vegetable tag (optional)</label>
            <Input
              value={vegTag}
              onChange={(e) => setVegTag(e.target.value)}
              placeholder="e.g. Brinjal, Bhindi, Tomato"
              className="h-9 mt-1"
              data-testid="custom-form-veg-tag"
            />
          </div>
        )}
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <Button variant="outline" onClick={onClose} disabled={saving} className="h-9">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!nameEn.trim() || saving}
          className="h-9 bg-purple-600 hover:bg-purple-700 text-white"
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
