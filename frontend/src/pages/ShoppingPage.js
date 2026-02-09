import { useState, useMemo } from 'react';
import { useShoppingList, useInventory } from '@/hooks/useRasoiSync';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  Plus, Trash2, ShoppingBag, Send, RefreshCw, Sparkles, 
  Search, X, ChevronDown, ChevronUp, Package, Edit2, Check, Calendar, Edit, AlertTriangle
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import TranslatedLabel from '@/components/TranslatedLabel';
import { ShoppingBarcodeScanner } from '@/components/ShoppingBarcodeScanner';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

// Helper function to check expiry status (same as inventory)
const getExpiryStatus = (expiryDate) => {
  if (!expiryDate) return null;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  
  const daysUntilExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
  
  if (daysUntilExpiry < 0) {
    return { status: 'expired', days: Math.abs(daysUntilExpiry), message: `Expired ${Math.abs(daysUntilExpiry)} days ago` };
  } else if (daysUntilExpiry === 0) {
    return { status: 'today', days: 0, message: 'Expires today!' };
  } else if (daysUntilExpiry <= 30) {
    return { status: 'soon', days: daysUntilExpiry, message: `Expires in ${daysUntilExpiry} days` };
  }
  return { status: 'ok', days: daysUntilExpiry, message: `Expires in ${daysUntilExpiry} days` };
};

const CATEGORIES = ['grains', 'spices', 'vegetables', 'fruits', 'dairy', 'pulses', 'oils', 'snacks', 'bakery', 'household', 'other'];

// Category to unit type mapping
const CATEGORY_UNITS = {
  // Solid items - weight based
  'grains': { type: 'weight', options: ['100 g', '250 g', '500 g', '1 kg', '2 kg', '5 kg', '10 kg'], default: '1 kg' },
  'pulses': { type: 'weight', options: ['250 g', '500 g', '1 kg', '2 kg', '5 kg'], default: '1 kg' },
  'spices': { type: 'weight', options: ['25 g', '50 g', '100 g', '200 g', '250 g', '500 g'], default: '100 g' },
  'vegetables': { type: 'weight', options: ['250 g', '500 g', '1 kg', '2 kg'], default: '500 g' },
  'fruits': { type: 'weight', options: ['250 g', '500 g', '1 kg', '2 kg'], default: '1 kg' },
  'snacks': { type: 'weight', options: ['100 g', '200 g', '250 g', '500 g', '1 kg'], default: '250 g' },
  'fasting': { type: 'weight', options: ['100 g', '250 g', '500 g', '1 kg'], default: '250 g' },
  // Liquid items - volume based  
  'dairy': { type: 'volume', options: ['250 ml', '500 ml', '1 L', '2 L', '5 L'], default: '1 L' },
  'oils': { type: 'volume', options: ['200 ml', '500 ml', '1 L', '2 L', '5 L'], default: '1 L' },
  'beverages': { type: 'volume', options: ['250 ml', '500 ml', '1 L', '2 L'], default: '1 L' },
  // Count-based items
  'bakery': { type: 'count', options: ['1 pack', '2 packs', '3 packs', '6 packs', '1 dozen'], default: '1 pack' },
  'household': { type: 'count', options: ['1 unit', '2 units', '1 pack', '2 packs', '1 box'], default: '1 unit' },
  'other': { type: 'weight', options: ['100 g', '250 g', '500 g', '1 kg', '2 kg'], default: '500 g' }
};

// Get quantity options based on category
const getQuantityOptions = (category) => {
  const config = CATEGORY_UNITS[category] || CATEGORY_UNITS['other'];
  return config.options;
};

// Get default quantity based on category
const getDefaultQuantity = (category) => {
  const config = CATEGORY_UNITS[category] || CATEGORY_UNITS['other'];
  return config.default;
};

const ShoppingPage = () => {
  const { shoppingList, addItem, deleteItem, updateItem, fetchShoppingList } = useShoppingList();
  const { inventory, addItem: addInventoryItem, updateItem: updateInventoryItem, fetchInventory } = useInventory();
  const { language, getLabel } = useLanguage();
  const [activeTab, setActiveTab] = useState('grocery');
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState({});
  const [editingItemId, setEditingItemId] = useState(null);
  const [customQty, setCustomQty] = useState('');
  const [editingExpiryItemId, setEditingExpiryItemId] = useState(null); // Same as inventory
  const [newExpiryDate, setNewExpiryDate] = useState(''); // Same as inventory
  const [processingPurchase, setProcessingPurchase] = useState(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Check if item already exists in shopping list (case-insensitive)
  const isItemDuplicate = (itemName) => {
    const nameLower = itemName.toLowerCase().trim();
    return shoppingList.some(item => 
      item.name_en?.toLowerCase().trim() === nameLower
    );
  };

  // Filter items by store type and search query
  const filteredList = useMemo(() => {
    return shoppingList.filter(item => {
      const category = (item.category || '').toLowerCase();
      const isMandi = category === 'vegetables' || category === 'fruits' || category === 'mandi';
      const matchesTab = isMandi ? activeTab === 'mandi' : activeTab === 'grocery';
      
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        item.name_en?.toLowerCase().includes(searchLower) ||
        item.name_mr?.toLowerCase().includes(searchLower) ||
        item.name_hi?.toLowerCase().includes(searchLower) ||
        item.category?.toLowerCase().includes(searchLower);
      
      return matchesTab && matchesSearch;
    });
  }, [shoppingList, activeTab, searchQuery]);

  // Group by category
  const groupedByCategory = useMemo(() => {
    return filteredList.reduce((acc, item) => {
      const cat = item.category || 'other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {});
  }, [filteredList]);

  // Get counts
  const groceryCount = shoppingList.filter(item => {
    const category = (item.category || '').toLowerCase();
    return category !== 'vegetables' && category !== 'fruits' && category !== 'mandi';
  }).length;
  
  const mandiCount = shoppingList.filter(item => {
    const category = (item.category || '').toLowerCase();
    return category === 'vegetables' || category === 'fruits' || category === 'mandi';
  }).length;

  // Get low stock items
  const getLowStockItems = () => {
    return inventory.filter(item => 
      item.stock_level === 'low' || item.stock_level === 'empty'
    );
  };

  const getLowStockCount = () => {
    const lowStockItems = getLowStockItems();
    return lowStockItems.filter(item => 
      !shoppingList.some(shopItem => shopItem.name_en === item.name_en)
    ).length;
  };

  // Sync from inventory
  const syncFromInventory = async () => {
    setSyncing(true);
    try {
      const lowStockItems = getLowStockItems();
      let addedCount = 0;

      for (const item of lowStockItems) {
        // Case-insensitive duplicate check
        const alreadyInList = shoppingList.some(
          shopItem => shopItem.name_en?.toLowerCase().trim() === item.name_en?.toLowerCase().trim()
        );

        if (!alreadyInList) {
          const defaultQty = getDefaultQuantity(item.category);
          await addItem({
            name_en: item.name_en,
            name_mr: item.name_mr,
            category: item.category,
            quantity: '-',
            store_type: item.category === 'vegetables' || item.category === 'fruits' ? 'mandi' : 'grocery',
            stock_level: item.stock_level,
            monthly_quantity: defaultQty
          });
          addedCount++;
        }
      }

      if (addedCount > 0) {
        toast.success(`Added ${addedCount} low stock items`);
      } else {
        toast.info('All low stock items already in list');
      }
    } catch (error) {
      toast.error('Failed to sync items');
    } finally {
      setSyncing(false);
    }
  };

  // Handle quantity update - supports both preset and custom values
  const handleQuantityChange = async (itemId, newQty) => {
    try {
      await updateItem(itemId, { monthly_quantity: newQty });
      setEditingItemId(null);
      setCustomQty('');
      toast.success('Quantity updated');
    } catch (error) {
      toast.error('Failed to update quantity');
    }
  };

  // Start editing custom quantity
  const startCustomEdit = (itemId, currentQty) => {
    setEditingItemId(itemId);
    setCustomQty(currentQty || '');
  };

  // Save custom quantity
  const saveCustomQty = (itemId) => {
    if (customQty.trim()) {
      handleQuantityChange(itemId, customQty.trim());
    } else {
      setEditingItemId(null);
      setCustomQty('');
    }
  };

  // Handle scanned item from AI scanner
  const handleScannedItem = async (scannedItem) => {
    // Check for duplicates
    if (isItemDuplicate(scannedItem.name_en)) {
      toast.error(`"${scannedItem.name_en}" is already in your shopping list`);
      return;
    }
    
    try {
      const defaultQty = getDefaultQuantity(scannedItem.category);
      await addItem({
        name_en: scannedItem.name_en,
        category: scannedItem.category,
        quantity: '-',
        store_type: scannedItem.category === 'vegetables' || scannedItem.category === 'fruits' ? 'mandi' : 'grocery',
        monthly_quantity: scannedItem.monthly_quantity || defaultQty,
        expiry_date: scannedItem.expiry_date || null
      });
      toast.success(`Added ${scannedItem.name_en} to shopping list`);
    } catch (error) {
      console.error('Error adding scanned item:', error);
      toast.error('Failed to add item');
    }
  };

  // Handle delete
  const handleDeleteItem = async (itemId, itemName) => {
    try {
      await deleteItem(itemId);
      toast.success(`Removed ${itemName}`);
    } catch (error) {
      toast.error('Failed to remove item');
    }
  };

  // Expiry date editing functions (same as inventory)
  const startEditingExpiry = (item) => {
    setEditingExpiryItemId(item.id);
    setNewExpiryDate(item.expiry_date || '');
  };

  const cancelEditingExpiry = () => {
    setEditingExpiryItemId(null);
    setNewExpiryDate('');
  };

  const saveExpiry = async (itemId) => {
    try {
      await updateItem(itemId, { expiry_date: newExpiryDate || null });
      toast.success('Expiry date updated');
      setEditingExpiryItemId(null);
      setNewExpiryDate('');
    } catch (error) {
      console.error('Failed to save expiry date:', error);
      toast.error('Failed to update expiry date');
    }
  };

  // Handle Mark as Purchased - connects shopping list to inventory
  const handleMarkAsPurchased = async (item) => {
    setProcessingPurchase(item.id);
    
    try {
      const token = localStorage.getItem('auth_token');
      const headers = { Authorization: `Bearer ${token}` };
      // Use the expiry date from the editing state if this item is being edited
      const expiryDate = editingExpiryItemId === item.id ? newExpiryDate : (item.expiry_date || null);
      
      // Parse quantity from string (e.g., "1 kg" -> { value: 1000, unit: 'g' })
      const parseQuantity = (qtyString) => {
        if (!qtyString || qtyString === '-') return { value: 0, unit: 'g' };
        
        const match = qtyString.match(/^([\d.]+)\s*(.+)$/);
        if (!match) return { value: 0, unit: 'g' };
        
        let value = parseFloat(match[1]);
        let unit = match[2].toLowerCase().trim();
        
        // Convert to base units (grams or ml)
        if (unit === 'kg') { value *= 1000; unit = 'g'; }
        else if (unit === 'l' || unit === 'liter' || unit === 'litre') { value *= 1000; unit = 'ml'; }
        else if (unit.includes('pack') || unit.includes('unit') || unit.includes('dozen')) {
          // For count-based items, just use the number
          unit = 'units';
        }
        
        return { value, unit };
      };
      
      const parsedQty = parseQuantity(item.monthly_quantity);
      
      // Find matching inventory item by name (case-insensitive)
      const existingItem = inventory.find(inv => 
        inv.name_en?.toLowerCase() === item.name_en?.toLowerCase()
      );
      
      if (existingItem) {
        // Update existing inventory item - add to current stock
        const newCurrentStock = (existingItem.current_stock || 0) + parsedQty.value;
        
        const updateData = {
          current_stock: newCurrentStock
        };
        
        // Calculate new stock level
        const monthlyNeed = existingItem.monthly_quantity || 500;
        const percentage = (newCurrentStock / monthlyNeed) * 100;
        if (percentage === 0) updateData.stock_level = 'empty';
        else if (percentage <= 25) updateData.stock_level = 'low';
        else if (percentage <= 75) updateData.stock_level = 'half';
        else updateData.stock_level = 'full';
        
        // Update expiry if provided
        if (expiryDate) {
          updateData.expiry_date = expiryDate;
        }
        
        await axios.put(`${API}/api/inventory/${existingItem.id}`, updateData, { headers });
        
        toast.success(`Added ${item.monthly_quantity || 'items'} to ${item.name_en} stock`);
      } else {
        // Create new inventory item
        const newInventoryItem = {
          name_en: item.name_en,
          name_mr: item.name_mr || '',
          name_hi: item.name_hi || '',
          category: item.category || 'other',
          current_stock: parsedQty.value,
          stock_level: parsedQty.value > 0 ? 'full' : 'empty',
          monthly_quantity: parsedQty.value || 500,
          monthly_unit: parsedQty.unit,
          expiry_date: expiryDate || null
        };
        
        await axios.post(`${API}/api/inventory/household`, newInventoryItem, { headers });
        
        toast.success(`Added ${item.name_en} to inventory`);
      }
      
      // Remove from shopping list
      await deleteItem(item.id);
      
      // Clear the expiry date editing state
      if (editingExpiryItemId === item.id) {
        cancelEditingExpiry();
      }
      
      // Refresh inventory
      await fetchInventory();
      
    } catch (error) {
      console.error('Error marking as purchased:', error);
      toast.error('Failed to update inventory');
    } finally {
      setProcessingPurchase(null);
    }
  };

  // Toggle category expansion
  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  // Generate WhatsApp message
  const generateWhatsAppMessage = () => {
    let message = `🛒 *Rasoi-Sync - ${activeTab === 'grocery' ? 'Grocery' : 'Mandi'} List*\n\n`;
    
    Object.entries(groupedByCategory).forEach(([category, items]) => {
      message += `*${category.toUpperCase()}*\n`;
      items.forEach(item => {
        const bilingual = item.name_mr ? `${item.name_en} / ${item.name_mr}` : item.name_en;
        const qty = item.monthly_quantity || '-';
        message += `• ${bilingual} - ${qty}\n`;
      });
      message += '\n';
    });
    
    return encodeURIComponent(message);
  };

  return (
    <div className="container mx-auto px-4 py-4 pb-28 md:pb-6 space-y-4" data-testid="shopping-page">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <ShoppingBag className="w-7 h-7 text-orange-500" />
              {getLabel('shopping')}
            </h1>
            <p className="text-gray-500 text-sm">{shoppingList.length} items total</p>
          </div>
          <div className="flex gap-2">
            {getLowStockCount() > 0 && (
              <Button
                onClick={syncFromInventory}
                disabled={syncing}
                variant="outline"
                size="sm"
                className="gap-1 border-green-300 text-green-700 hover:bg-green-50"
                data-testid="sync-inventory-btn"
              >
                {syncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span className="hidden sm:inline">Sync</span> {getLowStockCount()}
              </Button>
            )}
            <Button 
              onClick={() => setIsScannerOpen(true)}
              className="bg-orange-500 hover:bg-orange-600 text-white gap-1"
              size="sm"
              data-testid="add-shopping-item-btn"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Item</span>
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search items..."
            className="pl-9 pr-9 bg-gray-50 border-gray-200"
            data-testid="shopping-search"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-12">
          <TabsTrigger 
            value="grocery" 
            data-testid="tab-grocery"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white gap-2"
          >
            🏪 Grocery
            {groceryCount > 0 && <Badge variant="secondary" className="ml-1">{groceryCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger 
            value="mandi" 
            data-testid="tab-mandi"
            className="data-[state=active]:bg-green-600 data-[state=active]:text-white gap-2"
          >
            🥬 Mandi
            {mandiCount > 0 && <Badge variant="secondary" className="ml-1">{mandiCount}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4 space-y-3">
          {/* WhatsApp Export */}
          {filteredList.length > 0 && (
            <Button
              onClick={() => window.open(`https://wa.me/?text=${generateWhatsAppMessage()}`, '_blank')}
              className={`w-full ${activeTab === 'grocery' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-600 hover:bg-green-700'}`}
              data-testid={`whatsapp-${activeTab}`}
            >
              <Send className="w-4 h-4 mr-2" />
              Share on WhatsApp
            </Button>
          )}

          {/* Empty State */}
          {filteredList.length === 0 ? (
            <Card className="p-12 text-center">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">
                {searchQuery ? 'No items match your search' : 'Your list is empty'}
              </p>
              <p className="text-sm text-gray-500">
                {searchQuery ? 'Try a different search term' : 'Add items or sync from inventory'}
              </p>
            </Card>
          ) : (
            /* Items grouped by category */
            Object.entries(groupedByCategory).map(([category, items]) => (
              <Card key={category} className="overflow-hidden">
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                  data-testid={`category-${category}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800 capitalize">{category}</span>
                    <Badge variant="outline">{items.length}</Badge>
                  </div>
                  {expandedCategories[category] === false ? (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronUp className="w-5 h-5 text-gray-500" />
                  )}
                </button>
                
                {expandedCategories[category] !== false && (
                  <CardContent className="p-0">
                    <div className="divide-y divide-gray-100">
                      {items.map((item) => (
                        <div 
                          key={item.id}
                          className="p-3 hover:bg-gray-50"
                          data-testid={`shopping-item-${item.id}`}
                        >
                          {/* Top Row - Item info, quantity, delete */}
                          <div className="flex items-center gap-3">
                            {/* Item Info */}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-800 truncate">
                                <TranslatedLabel 
                                  textEn={item.name_en}
                                  textRegional={language === 'hi' ? item.name_hi : item.name_mr}
                                  targetLanguage={language}
                                  showVerification={false}
                                  size="sm"
                                />
                              </p>
                              {item.stock_level && (
                                <span className={`text-xs ${
                                  item.stock_level === 'empty' ? 'text-gray-500' : 'text-orange-600'
                                }`}>
                                  {item.stock_level === 'empty' ? '○ Empty' : '◔ Low stock'}
                                </span>
                              )}
                            </div>

                          {/* Quick Quantity Selector with Custom Input */}
                          {editingItemId === item.id ? (
                            <div className="flex items-center gap-1">
                              <Input
                                value={customQty}
                                onChange={(e) => setCustomQty(e.target.value)}
                                placeholder="e.g., 3 kg"
                                className="w-24 h-9 text-sm"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveCustomQty(item.id);
                                  if (e.key === 'Escape') { setEditingItemId(null); setCustomQty(''); }
                                }}
                                data-testid={`custom-qty-input-${item.id}`}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => saveCustomQty(item.id)}
                                className="h-9 w-9 p-0 text-green-600"
                              >
                                ✓
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setEditingItemId(null); setCustomQty(''); }}
                                className="h-9 w-9 p-0 text-gray-500"
                              >
                                ✕
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <Select
                                value={item.monthly_quantity || ''}
                                onValueChange={(val) => {
                                  if (val === 'custom') {
                                    startCustomEdit(item.id, item.monthly_quantity);
                                  } else {
                                    handleQuantityChange(item.id, val);
                                  }
                                }}
                              >
                                <SelectTrigger 
                                  className="w-24 h-9 text-sm bg-orange-50 border-orange-200 text-orange-700 font-medium"
                                  data-testid={`qty-select-${item.id}`}
                                >
                                  <SelectValue placeholder="Qty">{item.monthly_quantity || 'Set qty'}</SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {getQuantityOptions(item.category).map(qty => (
                                    <SelectItem key={qty} value={qty}>{qty}</SelectItem>
                                  ))}
                                  <SelectItem value="custom" className="text-blue-600 font-medium">
                                    ✏️ Custom...
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => startCustomEdit(item.id, item.monthly_quantity)}
                                className="h-9 w-9 p-0 text-gray-400 hover:text-gray-600"
                                title="Edit custom quantity"
                              >
                                <Edit2 className="w-3 h-3" />
                              </Button>
                            </div>
                          )}

                          {/* Delete Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteItem(item.id, item.name_en)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 h-9 w-9 p-0"
                            data-testid={`delete-shopping-${item.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          </div>
                          
                          {/* Expiry Date Display & Editor - Exact replica from Inventory */}
                          {editingExpiryItemId === item.id ? (
                            <div className="mt-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
                              <div className="flex flex-col gap-2">
                                <Label className="text-xs font-medium text-blue-800">Update Expiry Date</Label>
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="date"
                                    value={newExpiryDate}
                                    onChange={(e) => setNewExpiryDate(e.target.value)}
                                    className="flex-1 h-9 text-sm"
                                    data-testid={`edit-expiry-input-${item.id}`}
                                  />
                                  <Button
                                    size="sm"
                                    onClick={() => saveExpiry(item.id)}
                                    className="h-9 px-3 bg-green-600 hover:bg-green-700"
                                    data-testid={`save-expiry-${item.id}`}
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={cancelEditingExpiry}
                                    className="h-9 px-3"
                                    data-testid={`cancel-expiry-${item.id}`}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                                {newExpiryDate && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setNewExpiryDate('')}
                                    className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 h-7"
                                  >
                                    Clear expiry date
                                  </Button>
                                )}
                              </div>
                            </div>
                          ) : item.expiry_date ? (
                            (() => {
                              const expStatus = getExpiryStatus(item.expiry_date);
                              return (
                                <div className={`mt-3 p-2 rounded-lg ${
                                  expStatus.status === 'expired' ? 'bg-red-100 border border-red-300' :
                                  expStatus.status === 'today' ? 'bg-red-50 border border-red-200' :
                                  expStatus.status === 'soon' ? 'bg-amber-50 border border-amber-200' :
                                  'bg-gray-50 border border-gray-200'
                                }`}>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      {(expStatus.status === 'expired' || expStatus.status === 'today' || expStatus.status === 'soon') && (
                                        <AlertTriangle className={`w-4 h-4 ${
                                          expStatus.status === 'expired' ? 'text-red-500' :
                                          expStatus.status === 'today' ? 'text-red-400' :
                                          'text-amber-500'
                                        }`} />
                                      )}
                                      <span className={`text-xs font-medium ${
                                        expStatus.status === 'expired' ? 'text-red-700' :
                                        expStatus.status === 'today' ? 'text-red-600' :
                                        expStatus.status === 'soon' ? 'text-amber-700' :
                                        'text-gray-600'
                                      }`}>
                                        {expStatus.message}
                                      </span>
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => startEditingExpiry(item)}
                                      className={`h-7 px-2 text-xs ${
                                        expStatus.status === 'expired' ? 'text-red-600 hover:bg-red-200' :
                                        expStatus.status === 'today' ? 'text-red-500 hover:bg-red-100' :
                                        expStatus.status === 'soon' ? 'text-amber-600 hover:bg-amber-100' :
                                        'text-gray-500 hover:bg-gray-100'
                                      }`}
                                      title="Update expiry date"
                                      data-testid={`edit-expiry-btn-${item.id}`}
                                    >
                                      <Edit className="w-3 h-3 mr-1" />
                                      Update
                                    </Button>
                                  </div>
                                </div>
                              );
                            })()
                          ) : (
                            <div className="mt-3">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => startEditingExpiry(item)}
                                className="w-full h-8 text-xs text-gray-500 border-dashed"
                                data-testid={`add-expiry-btn-${item.id}`}
                              >
                                <Calendar className="w-3 h-3 mr-1" />
                                Add expiry date
                              </Button>
                            </div>
                          )}
                          
                          {/* Mark as Purchased Button */}
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <Button
                              onClick={() => handleMarkAsPurchased(item)}
                              disabled={processingPurchase === item.id}
                              className="w-full h-10 bg-green-600 hover:bg-green-700 text-white font-medium"
                              data-testid={`mark-purchased-${item.id}`}
                            >
                              {processingPurchase === item.id ? (
                                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                              ) : (
                                <Check className="w-4 h-4 mr-2" />
                              )}
                              {processingPurchase === item.id ? 'Processing...' : 'Mark as Purchased'}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* WhatsApp FAB - Mobile */}
      {shoppingList.length > 0 && (
        <button
          onClick={() => window.open(`https://wa.me/?text=${generateWhatsAppMessage()}`, '_blank')}
          className="md:hidden fixed bottom-20 right-4 w-14 h-14 bg-green-500 hover:bg-green-600 rounded-full shadow-lg flex items-center justify-center z-[90]"
          data-testid="whatsapp-fab"
        >
          <Send className="w-6 h-6 text-white" />
        </button>
      )}

      {/* AI Scanner Dialog - Reuses BarcodeScanner logic for shopping */}
      <ShoppingBarcodeScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onItemScanned={handleScannedItem}
      />
    </div>
  );
};

export default ShoppingPage;
