import { useState } from 'react';
import { toast } from 'sonner';
import { useInventory } from '@/hooks/useRasoiSync';
import { useLanguage } from '@/contexts/LanguageContext';
// useUnits no longer called directly on InventoryPage (the editor uses it internally).
import { Search, Lock, Package2, Sparkles, AlertTriangle, LayoutGrid, List, ListChecks, CalendarClock, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IndianPantryTemplate } from '@/components/IndianPantryTemplate';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { Badge } from '@/components/ui/badge';
import TranslatedLabel from '@/components/TranslatedLabel';
import { IngredientAvatar } from '@/components/IngredientAvatar';
import { InventoryItemDetails } from '@/components/InventoryItemDetails';
import { InventoryRow } from '@/components/InventoryRow';
import { FrequencyPill, FrequencyStrip, getFrequency } from '@/components/FrequencyPicker';
import { RestockPlannerSheet } from '@/components/RestockPlannerSheet';
import {
  CATEGORIES,
  DEFAULT_MONTHLY,
  calculateStockStatus,
  getCalculatedStockLevel,
  getCategoryInfo,
  getExpiryStatus,
} from '@/lib/inventoryUtils';

const API = process.env.REACT_APP_BACKEND_URL;


// The month-end prompt is seasonal, not a permanent control — it surfaces in
// the last stretch of the month and stays dismissed for the rest of that
// cycle. Keyed by year-month so the next month re-arms it on its own.
const MONTH_END_WINDOW_DAYS = 5;

const currentCycleKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}`;
};

const isMonthEndWindow = () => {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return daysInMonth - now.getDate() < MONTH_END_WINDOW_DAYS;
};

const InventoryPage = () => {
  const {
    inventory, loading, addItem, updateItem, deleteItem, fetchInventory,
    previewMonthReset, startNewMonth, undoMonthReset,
  } = useInventory();
  const { language, getLabel } = useLanguage();
  // formatQuantity/Minus/Plus moved into StockQuantityEditor.
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStockLevel, setSelectedStockLevel] = useState('all'); // New state for stock filtering
  const [isPantryTemplateOpen, setIsPantryTemplateOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [editingExpiryItemId, setEditingExpiryItemId] = useState(null);
  const [newExpiryDate, setNewExpiryDate] = useState('');
  // 'list' = compact rows with an inline stepper, 'grid' = the original card
  // grid. Persisted because it's a standing preference, not a per-visit
  // choice — a 40-item pantry wants the same view every time.
  //
  // List is the default: a real pantry runs 60+ items and the card grid turns
  // "did I run out of haldi?" into a scrolling exercise. Only an explicit
  // 'grid' in storage opts back out, so a user who has actually tapped Cards
  // keeps Cards; everyone else — including existing users who never touched
  // the toggle — gets list.
  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem('rasoi.inventoryViewMode') === 'grid' ? 'grid' : 'list';
    } catch {
      return 'list'; // Safari private mode throws on localStorage access
    }
  });
  // Only one list row is expanded at a time — otherwise the list balloons
  // back into the card grid it's meant to replace. A row has two possible
  // panels (the full detail block, and the lighter frequency picker), so
  // the mode says which one is showing; they're never open together.
  const [expandedRowId, setExpandedRowId] = useState(null);
  const [expandedMode, setExpandedMode] = useState(null); // 'details' | 'frequency' | null
  const [frequencyBusyId, setFrequencyBusyId] = useState(null);

  // Restock planner. The banner is the seasonal prompt; the sheet is also
  // reachable year-round from the entry card, since the reset is manual.
  const [monthResetOpen, setMonthResetOpen] = useState(false);
  const [monthResetPreview, setMonthResetPreview] = useState(null);
  const [monthResetBusy, setMonthResetBusy] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    try {
      // Dismissal lasts the rest of the cycle, not forever.
      return localStorage.getItem('rasoi.monthResetDismissed') === currentCycleKey();
    } catch {
      return false;
    }
  });

  const changeViewMode = (mode) => {
    setViewMode(mode);
    setExpandedRowId(null);
    setExpandedMode(null);
    try {
      localStorage.setItem('rasoi.inventoryViewMode', mode);
    } catch {
      /* preference just won't persist */
    }
  };

  const toggleExpandedRow = (itemId) => {
    setExpandedRowId((current) =>
      (current === itemId && expandedMode === 'details' ? null : itemId));
    setExpandedMode((current) =>
      (expandedRowId === itemId && current === 'details' ? null : 'details'));
    // Leaving an open expiry editor behind on a collapsed row would strand
    // the draft date with no visible Save button.
    setEditingExpiryItemId(null);
    setNewExpiryDate('');
  };

  const toggleFrequencyRow = (itemId) => {
    setExpandedRowId((current) =>
      (current === itemId && expandedMode === 'frequency' ? null : itemId));
    setExpandedMode((current) =>
      (expandedRowId === itemId && current === 'frequency' ? null : 'frequency'));
    setEditingExpiryItemId(null);
    setNewExpiryDate('');
  };

  // Persist a frequency change, then close the picker. The optimistic
  // refetch keeps the "Start new month" counts honest — they're derived
  // from purchase_frequency, so a stale list would understate the reset.
  const handleFrequencyChange = async (item, frequency) => {
    if (frequency === (item.purchase_frequency || 'monthly')) {
      setExpandedRowId(null);
      setExpandedMode(null);
      return;
    }
    setFrequencyBusyId(item.id);
    try {
      await updateItem(item.id, { purchase_frequency: frequency });
      await fetchInventory();
      setExpandedRowId(null);
      setExpandedMode(null);
    } catch (error) {
      toast.error('Could not change frequency');
    } finally {
      setFrequencyBusyId(null);
    }
  };

  const openMonthReset = async () => {
    setMonthResetOpen(true);
    setMonthResetPreview(null);
    try {
      setMonthResetPreview(await previewMonthReset());
    } catch (error) {
      toast.error('Could not check your pantry');
      setMonthResetOpen(false);
    }
  };

  // Changing a frequency from inside the planner is permanent, not just for
  // this reset — so the preview is refetched to keep the tabs honest. The
  // sheet keeps the user's ticks across the refresh.
  const handleResetReviewFrequencyChange = async (item, frequency) => {
    setFrequencyBusyId(item.id);
    try {
      await updateItem(item.id, { purchase_frequency: frequency });
      const [refreshed] = await Promise.all([previewMonthReset(), fetchInventory()]);
      setMonthResetPreview(refreshed);
    } catch (error) {
      toast.error('Could not change frequency');
    } finally {
      setFrequencyBusyId(null);
    }
  };

  const confirmMonthReset = async (selectedIds) => {
    setMonthResetBusy(true);
    try {
      const result = await startNewMonth(selectedIds);
      setMonthResetOpen(false);
      dismissBanner();
      toast.success(getLabel('markedEmptyToast', { n: result.reset_count }), {
        description: getLabel('goesToShoppingList'),
        action: result.undo_token ? {
          label: getLabel('undoLabel'),
          onClick: async () => {
            try {
              await undoMonthReset(result.undo_token);
              toast.success(getLabel('stockRestored'));
            } catch {
              toast.error('Could not undo');
            }
          },
        } : undefined,
        duration: 8000,
      });
    } catch (error) {
      toast.error('Could not mark items empty', {
        description: error?.response?.data?.detail || error.message,
      });
    } finally {
      setMonthResetBusy(false);
    }
  };

  const dismissBanner = () => {
    setBannerDismissed(true);
    try {
      localStorage.setItem('rasoi.monthResetDismissed', currentCycleKey());
    } catch {
      /* dismissal just won't persist */
    }
  };

  const showMonthEndBanner = isMonthEndWindow() && !bannerDismissed;

  // Get items expiring soon (within 30 days)
  const expiringItems = inventory.filter(item => {
    const status = getExpiryStatus(item.expiry_date);
    return status && (status.status === 'expired' || status.status === 'today' || status.status === 'soon');
  }).sort((a, b) => {
    const statusA = getExpiryStatus(a.expiry_date);
    const statusB = getExpiryStatus(b.expiry_date);
    return statusA.days - statusB.days;
  });

  const filteredInventory = inventory.filter(item => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = item.name_en.toLowerCase().includes(query) ||
                         (item.name_hi && item.name_hi.includes(searchQuery)) ||
                         (item.name_mr && item.name_mr.includes(searchQuery)) ||
                         (item.name_gu && item.name_gu.includes(searchQuery)) ||
                         (item.aliases && item.aliases.some(alias => alias.toLowerCase().includes(query)));
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    // Use calculated stock level for filtering (not the stored one)
    const calculatedStockLevel = getCalculatedStockLevel(item);
    const matchesStockLevel = selectedStockLevel === 'all' || calculatedStockLevel === selectedStockLevel;
    return matchesSearch && matchesCategory && matchesStockLevel;
  });

  // Group items by category
  const groupedInventory = filteredInventory.reduce((acc, item) => {
    const category = item.category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {});

  // Handle item scanned from BarcodeScanner
  const handleScannedItem = async (scannedItem) => {
    try {
      await addItem(scannedItem);
    } catch (error) {
      console.error('Error adding scanned item:', error);
    }
  };

  // Set current_stock to an exact value. Used by StockQuantityEditor's chips
  // (additive — pre-computed at the chip click site) and inline numpad (set).
  const setCurrentStock = async (item, newStock) => {
    const defaults = DEFAULT_MONTHLY[item.category] || DEFAULT_MONTHLY['other'];
    const monthlyNeed = item.monthly_quantity || defaults.quantity;
    try {
      const newStatus = calculateStockStatus(newStock, monthlyNeed);
      await updateItem(item.id, {
        current_stock: newStock,
        stock_level: newStatus.value, // keep stock_level in lockstep
      });
    } catch (error) {
      console.error('Error setting current stock:', error);
    }
  };

  // Set monthly_quantity to an exact value. Used by StockQuantityEditor.
  const setMonthlyQuantity = async (item, newQty) => {
    const defaults = DEFAULT_MONTHLY[item.category] || DEFAULT_MONTHLY['other'];
    const currentUnit = item.monthly_unit || defaults.unit;
    try {
      await updateItem(item.id, {
        monthly_quantity: newQty,
        monthly_unit: currentUnit,
      });
    } catch (error) {
      console.error('Error setting monthly quantity:', error);
    }
  };

  // Track which item is currently in the "tap again to confirm" state.
  // A 5-second window where the Delete button morphs into "Tap to confirm —
  // X cancel". After 5s without confirmation it resets. Way more reliable
  // than window.confirm() which iOS PWA mode often blocks silently.
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  const handleDelete = async (itemId, itemName) => {
    if (pendingDeleteId !== itemId) {
      // First tap — arm the confirmation.
      setPendingDeleteId(itemId);
      // Auto-reset after 5s if user doesn't follow through
      setTimeout(() => {
        setPendingDeleteId((current) => (current === itemId ? null : current));
      }, 5000);
      toast.warning(`Tap Delete again to remove "${itemName}"`, {
        description: 'This cannot be undone.',
        duration: 5000,
      });
      return;
    }
    // Second tap — actually delete.
    setPendingDeleteId(null);
    try {
      await deleteItem(itemId);
      toast.success(`Removed ${itemName}`, { duration: 3000 });
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error('Could not delete', {
        description: error?.response?.data?.detail || error.message,
        duration: 4000,
      });
    }
  };

  const handleUpdateExpiryDate = async (itemId) => {
    try {
      await updateItem(itemId, { expiry_date: newExpiryDate || null });
      setEditingExpiryItemId(null);
      setNewExpiryDate('');
    } catch (error) {
      console.error('Error updating expiry date:', error);
      alert('Failed to update expiry date. Please try again.');
    }
  };

  const startEditingExpiry = (item) => {
    setEditingExpiryItemId(item.id);
    setNewExpiryDate(item.expiry_date || '');
  };

  const cancelEditingExpiry = () => {
    setEditingExpiryItemId(null);
    setNewExpiryDate('');
  };

  const handleStockFilterClick = (stockLevel) => {
    if (selectedStockLevel === stockLevel) {
      setSelectedStockLevel('all'); // Clear filter if clicking same level
    } else {
      setSelectedStockLevel(stockLevel); // Set new filter
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 pb-24 md:pb-6 space-y-6" data-testid="inventory-page">
      {/* Expiring Soon Alert */}
      {expiringItems.length > 0 && (
        <Card className="border-2 border-amber-400 bg-gradient-to-r from-amber-50 to-orange-50" data-testid="expiry-alert">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-bold text-amber-800 mb-2">Items Expiring Soon!</h3>
                <div className="flex flex-wrap gap-2">
                  {expiringItems.slice(0, 5).map(item => {
                    const status = getExpiryStatus(item.expiry_date);
                    return (
                      <Badge 
                        key={item.id}
                        className={`${
                          status.status === 'expired' ? 'bg-red-500 text-white' :
                          status.status === 'today' ? 'bg-red-400 text-white' :
                          'bg-amber-400 text-white'
                        }`}
                      >
                        {item.name_en}: {status.message}
                      </Badge>
                    );
                  })}
                  {expiringItems.length > 5 && (
                    <Badge className="bg-gray-200 text-gray-700">
                      +{expiringItems.length - 5} more
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-amber-700 mt-2">
                  Use these items in your next meal! Search for recipes with these ingredients.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Month-end prompt. Sits below the expiry alert on purpose — spoiling
          food outranks restocking — and uses blue so the two banners don't
          read as equally urgent (expiry owns amber/red). */}
      {showMonthEndBanner && (
        <Card className="border-2 border-blue-200 bg-blue-50" data-testid="month-reset-banner">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <CalendarClock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-blue-900 text-sm">{getLabel('monthEndTitle')}</p>
                <p className="text-xs text-blue-800 mt-0.5">
                  {getLabel('monthEndHint')}
                </p>
                <div className="flex gap-2 mt-3">
                  <Button
                    onClick={openMonthReset}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    data-testid="month-reset-banner-start"
                  >
                    {getLabel('planRestock')}
                  </Button>
                  <Button
                    onClick={dismissBanner}
                    size="sm"
                    variant="outline"
                    className="border-blue-300 text-blue-700 hover:bg-blue-100"
                  >
                    {getLabel('notNow')}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-gray-800">
            {getLabel('inventory')}
          </h1>
          <p className="text-gray-600 mt-1">
            {getLabel('manageYourKitchen')}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {/* Grid ⇄ list density toggle. Grid stays the default for small
              pantries; list is for the 40-item case where card height turns
              "did I run out of haldi?" into a scrolling exercise. */}
          <div className="flex items-center bg-gray-100 rounded-full p-1" data-testid="view-mode-toggle">
            <button
              onClick={() => changeViewMode('grid')}
              className={`flex items-center gap-1.5 h-9 px-3 rounded-full text-sm font-medium transition-colors ${
                viewMode === 'grid' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
              aria-pressed={viewMode === 'grid'}
              data-testid="view-mode-grid"
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Cards</span>
            </button>
            <button
              onClick={() => changeViewMode('list')}
              className={`flex items-center gap-1.5 h-9 px-3 rounded-full text-sm font-medium transition-colors ${
                viewMode === 'list' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
              aria-pressed={viewMode === 'list'}
              data-testid="view-mode-list"
            >
              <List className="w-4 h-4" />
              <span>List</span>
            </button>
          </div>
          {/* Receipt scanning lives on the Shopping List page only.
              It was dual-placed here for a while, but users found two
              entry points confusing — and the "just back from shopping"
              moment naturally happens on the Shopping List anyway. */}
          <Button
            onClick={() => setIsPantryTemplateOpen(true)}
            className="bg-[#77DD77] hover:bg-[#66CC66] text-gray-900 rounded-full shadow-md"
            data-testid="pantry-template-btn"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            <span className="hidden md:inline">{getLabel('indianPantryTemplate')}</span>
            <span className="md:hidden">{getLabel('browseTemplate')}</span>
          </Button>
          {/* <Button
            onClick={() => setIsScannerOpen(true)}
            className="bg-[#138808] hover:bg-[#0d6606] text-white rounded-full shadow-md"
            data-testid="scan-item-btn"
          >
            <Camera className="w-5 h-5 mr-2" />
            {getLabel('scanProduct')}
          </Button> */}
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`${getLabel('search')}...`}
            className="pl-10 border-gray-300"
            data-testid="search-input"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="md:w-64 border-gray-300" data-testid="filter-category">
            <SelectValue placeholder={getLabel('allCategories')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">📋 {getLabel('allCategories')}</SelectItem>
            {CATEGORIES.map(cat => (
              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Year-round entry point for the planner. The banner only appears
          near month end, but the action is manual — someone who dismissed
          it, or who shops mid-month, still needs a way in. Kept deliberately
          quiet so it doesn't compete with the daily controls above. */}
      <button
        type="button"
        onClick={openMonthReset}
        data-testid="month-reset-entry"
        className="w-full flex items-center gap-2 px-4 py-3 bg-white rounded-2xl border border-gray-100 shadow-sm text-left hover:bg-gray-50 transition-colors"
      >
        <ListChecks className="w-4 h-4 text-gray-500 flex-shrink-0" />
        <span className="flex-1 text-sm text-gray-600">{getLabel('planRestock')}</span>
        <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </button>

      {/* Stats Summary */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card 
            className={`cursor-pointer transition-all hover:scale-105 ${
              selectedStockLevel === 'full' 
                ? 'bg-gradient-to-br from-[#77DD77] to-[#66CC66] text-white ring-4 ring-[#77DD77]/50' 
                : 'bg-gradient-to-br from-[#77DD77] to-[#66CC66] text-white hover:shadow-lg'
            }`}
            onClick={() => handleStockFilterClick('full')}
            data-testid="stat-full-stock"
          >
            <CardContent className="p-6">
              <div className="text-3xl font-bold">
                {inventory.filter(i => getCalculatedStockLevel(i) === 'full').length}
              </div>
              <div className="text-sm opacity-90">{getLabel('fullStock')}</div>
              {selectedStockLevel === 'full' && (
                <div className="text-xs mt-2 font-medium">✓ {getLabel('filter')}</div>
              )}
            </CardContent>
          </Card>
          <Card 
            className={`cursor-pointer transition-all hover:scale-105 ${
              selectedStockLevel === 'half' 
                ? 'bg-gradient-to-br from-[#FFCC00] to-[#E6B800] text-gray-800 ring-4 ring-[#FFCC00]/50' 
                : 'bg-gradient-to-br from-[#FFCC00] to-[#E6B800] text-gray-800 hover:shadow-lg'
            }`}
            onClick={() => handleStockFilterClick('half')}
            data-testid="stat-half-stock"
          >
            <CardContent className="p-6">
              <div className="text-3xl font-bold">
                {inventory.filter(i => getCalculatedStockLevel(i) === 'half').length}
              </div>
              <div className="text-sm opacity-90">{getLabel('halfStock')}</div>
              {selectedStockLevel === 'half' && (
                <div className="text-xs mt-2 font-medium">✓ {getLabel('filter')}</div>
              )}
            </CardContent>
          </Card>
          <Card 
            className={`cursor-pointer transition-all hover:scale-105 ${
              selectedStockLevel === 'low' 
                ? 'bg-gradient-to-br from-[#FF9933] to-[#E68A2E] text-white ring-4 ring-[#FF9933]/50' 
                : 'bg-gradient-to-br from-[#FF9933] to-[#E68A2E] text-white hover:shadow-lg'
            }`}
            onClick={() => handleStockFilterClick('low')}
            data-testid="stat-low-stock"
          >
            <CardContent className="p-6">
              <div className="text-3xl font-bold">
                {inventory.filter(i => getCalculatedStockLevel(i) === 'low').length}
              </div>
              <div className="text-sm opacity-90">{getLabel('lowStock')}</div>
              {selectedStockLevel === 'low' && (
                <div className="text-xs mt-2 font-medium">✓ {getLabel('filter')}</div>
              )}
            </CardContent>
          </Card>
          <Card 
            className={`cursor-pointer transition-all hover:scale-105 ${
              selectedStockLevel === 'empty' 
                ? 'bg-gradient-to-br from-gray-400 to-gray-500 text-white ring-4 ring-gray-400/50' 
                : 'bg-gradient-to-br from-gray-400 to-gray-500 text-white hover:shadow-lg'
            }`}
            onClick={() => handleStockFilterClick('empty')}
            data-testid="stat-empty-stock"
          >
            <CardContent className="p-6">
              <div className="text-3xl font-bold">
                {inventory.filter(i => getCalculatedStockLevel(i) === 'empty').length}
              </div>
              <div className="text-sm opacity-90">{getLabel('emptyStock')}</div>
              {selectedStockLevel === 'empty' && (
                <div className="text-xs mt-2 font-medium">✓ {getLabel('filter')}</div>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Active Filter Indicator */}
        {selectedStockLevel !== 'all' && (
          <div className="flex items-center justify-between bg-[#FFFBF0] border border-[#FFCC00] rounded-xl p-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">
                {getLabel('filter')}: <span className="font-bold text-[#FF9933]">
                  {getLabel(selectedStockLevel + 'Stock')}
                </span> items ({filteredInventory.length} items)
              </span>
            </div>
            <Button
              onClick={() => setSelectedStockLevel('all')}
              variant="outline"
              size="sm"
              className="border-[#FF9933] text-[#FF9933] hover:bg-[#FF9933] hover:text-white"
              data-testid="clear-stock-filter-btn"
            >
              Clear Filter
            </Button>
          </div>
        )}
      </div>

      {/* Grouped Inventory Display */}
      {Object.keys(groupedInventory).length === 0 ? (
        <Card className="p-12 text-center">
          <Package2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 text-lg mb-2">No items found in inventory</p>
          <p className="text-gray-500 text-sm mb-4">Start by adding items manually or use the Indian Pantry Template</p>
          <Button
            onClick={() => setIsPantryTemplateOpen(true)}
            className="bg-[#77DD77] hover:bg-[#66CC66] text-gray-900 rounded-full"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            Browse Template
          </Button>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedInventory).map(([category, items]) => {
            const categoryInfo = getCategoryInfo(category);
            
            return (
              <div key={category} className="space-y-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-gray-800">{categoryInfo.label}</h2>
                  <Badge variant="secondary" className="text-sm">
                    {items.length} items
                  </Badge>
                </div>
                
                {viewMode === 'list' ? (
                  /* ---- List view (D1 + D2) ----
                     Compact rows with an always-visible ±step stepper, each
                     expandable in place into the same detail block the card
                     renders. One card-height surface for the whole category
                     instead of one per item. */
                  <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                    {items.map((item) => (
                      <InventoryRow
                        key={item.id}
                        item={item}
                        categoryInfo={categoryInfo}
                        isExpanded={expandedRowId === item.id && expandedMode === 'details'}
                        onToggleExpanded={() => toggleExpandedRow(item.id)}
                        isFrequencyOpen={expandedRowId === item.id && expandedMode === 'frequency'}
                        onToggleFrequency={() => toggleFrequencyRow(item.id)}
                        onFrequencyChange={(freq) => handleFrequencyChange(item, freq)}
                        isFrequencyBusy={frequencyBusyId === item.id}
                        isEditingExpiry={editingExpiryItemId === item.id}
                        newExpiryDate={newExpiryDate}
                        onNewExpiryDateChange={setNewExpiryDate}
                        onStartEditingExpiry={() => startEditingExpiry(item)}
                        onCancelEditingExpiry={cancelEditingExpiry}
                        onSaveExpiry={() => handleUpdateExpiryDate(item.id)}
                        onCurrentStockChange={(newStock) => setCurrentStock(item, newStock)}
                        onMonthlyQuantityChange={(newQty) => setMonthlyQuantity(item, newQty)}
                        isPendingDelete={pendingDeleteId === item.id}
                        onDelete={() => handleDelete(item.id, item.name_en)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                    {items.map((item) => (
                      <Card
                        key={item.id}
                        className={`${categoryInfo.color} border-2 border-gray-200 hover-lift transition-all`}
                        data-testid={`inventory-item-${item.id}`}
                      >
                        <CardContent className="p-4 md:p-5">
                          {/* Header — avatar, bilingual name, badges, stash lock */}
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <IngredientAvatar item={item} categoryInfo={categoryInfo} size="md" />
                              <div className="flex-1 min-w-0">
                                {/* sizeClass/stacked are load-bearing: TranslatedLabel
                                    sets the font-size on its own wrapper span, so a
                                    text-xl on this <h3> would be silently overridden. */}
                                <h3 className="mb-1 break-words group">
                                  <TranslatedLabel
                                    textEn={item.name_en}
                                    textRegional={language === 'hi' ? item.name_hi : item.name_mr}
                                    targetLanguage={language}
                                    showVerification={true}
                                    sizeClass="text-lg md:text-xl"
                                    stacked
                                    primaryClassName="font-bold text-gray-800"
                                  />
                                </h3>

                                {/* Category + Custom-source Badges */}
                                <div className="flex flex-wrap items-center gap-1">
                                  <Badge variant="outline" className="text-[10px] md:text-xs border-gray-400">
                                    {categoryInfo.label}
                                  </Badge>
                                  {item.is_custom && (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] md:text-xs border-purple-300 text-purple-700 bg-purple-50"
                                      title="Added from a receipt — not yet in the catalog"
                                    >
                                      custom
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center flex-shrink-0 ml-2">
                              {item.is_secret_stash && (
                                <Lock className="w-5 h-5 text-[#FFCC00]" />
                              )}
                              {/* Same pill as the list row — the card would
                                  otherwise render a yearly item identically
                                  to a monthly one. */}
                              <FrequencyPill
                                value={getFrequency(item)}
                                itemName={item.name_en}
                                onClick={() => toggleFrequencyRow(item.id)}
                              />
                            </div>
                          </div>

                          {expandedRowId === item.id && expandedMode === 'frequency' && (
                            <div className="-mx-3 mb-2">
                              <FrequencyStrip
                                value={getFrequency(item)}
                                busy={frequencyBusyId === item.id}
                                onSelect={(freq) => handleFrequencyChange(item, freq)}
                              />
                            </div>
                          )}

                          <InventoryItemDetails
                            item={item}
                            isEditingExpiry={editingExpiryItemId === item.id}
                            newExpiryDate={newExpiryDate}
                            onNewExpiryDateChange={setNewExpiryDate}
                            onStartEditingExpiry={() => startEditingExpiry(item)}
                            onCancelEditingExpiry={cancelEditingExpiry}
                            onSaveExpiry={() => handleUpdateExpiryDate(item.id)}
                            onCurrentStockChange={(newStock) => setCurrentStock(item, newStock)}
                            onMonthlyQuantityChange={(newQty) => setMonthlyQuantity(item, newQty)}
                            isPendingDelete={pendingDeleteId === item.id}
                            onDelete={() => handleDelete(item.id, item.name_en)}
                          />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Indian Pantry Template Dialog */}
      <IndianPantryTemplate 
        isOpen={isPantryTemplateOpen}
        onClose={() => setIsPantryTemplateOpen(false)}
        existingInventory={inventory}
        onItemsAdded={fetchInventory}
      />

      {/* Barcode Scanner Dialog */}
      <BarcodeScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onItemScanned={handleScannedItem}
      />

      <RestockPlannerSheet
        open={monthResetOpen}
        preview={monthResetPreview}
        onConfirm={confirmMonthReset}
        onClose={() => {
          if (monthResetBusy) return;
          setMonthResetOpen(false);
        }}
        busy={monthResetBusy}
        frequencyBusyId={frequencyBusyId}
        onItemFrequencyChange={handleResetReviewFrequencyChange}
      />
    </div>
  );
};

export default InventoryPage;
