import { useState, useEffect } from 'react';
import { useInventory } from '@/hooks/useRasoiSync';
import { useLanguage } from '@/contexts/LanguageContext';
import { Plus, Search, Lock, Trash2, Package2, Sparkles, Edit, Camera, AlertTriangle, Calendar, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { IndianPantryTemplate } from '@/components/IndianPantryTemplate';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { Badge } from '@/components/ui/badge';
import TranslatedLabel from '@/components/TranslatedLabel';

const API = process.env.REACT_APP_BACKEND_URL;

// Default monthly quantities by category
const DEFAULT_MONTHLY = {
  'grains': { quantity: 5000, unit: 'g', step: 1000, display: '5 kg' },
  'pulses': { quantity: 500, unit: 'g', step: 250, display: '500 g' },
  'spices': { quantity: 100, unit: 'g', step: 50, display: '100 g' },
  'dairy': { quantity: 5000, unit: 'ml', step: 500, display: '5 L' },
  'oils': { quantity: 1000, unit: 'ml', step: 250, display: '1 L' },
  'bakery': { quantity: 2, unit: 'pcs', step: 1, display: '2 pcs' },
  'snacks': { quantity: 500, unit: 'g', step: 100, display: '500 g' },
  'beverages': { quantity: 500, unit: 'g', step: 100, display: '500 g' },
  'vegetables': { quantity: 2000, unit: 'g', step: 500, display: '2 kg' },
  'fruits': { quantity: 2000, unit: 'g', step: 500, display: '2 kg' },
  'fasting': { quantity: 500, unit: 'g', step: 100, display: '500 g' },
  'other': { quantity: 1000, unit: 'g', step: 250, display: '1 kg' }
};

// Format quantity for display
const formatQuantity = (quantity, unit) => {
  if (!quantity) return null;
  if (unit === 'pcs') return `${quantity} pcs`;
  if (unit === 'ml') {
    if (quantity >= 1000) return `${(quantity / 1000).toFixed(quantity % 1000 === 0 ? 0 : 1)} L`;
    return `${quantity} ml`;
  }
  if (unit === 'g') {
    if (quantity >= 1000) return `${(quantity / 1000).toFixed(quantity % 1000 === 0 ? 0 : 1)} kg`;
    return `${quantity} g`;
  }
  return `${quantity} ${unit}`;
};

// Helper function to check expiry status
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

const CATEGORIES = [
  { value: 'grains', label: '🌾 Grains & Cereals', color: 'bg-amber-50' },
  { value: 'pulses', label: '🫘 Pulses & Lentils', color: 'bg-yellow-50' },
  { value: 'spices', label: '🌶️ Spices & Masalas', color: 'bg-red-50' },
  { value: 'vegetables', label: '🧅 Vegetables', color: 'bg-green-50' },
  { value: 'fruits', label: '🍎 Fruits', color: 'bg-pink-50' },
  { value: 'dairy', label: '🥛 Dairy & Essentials', color: 'bg-blue-50' },
  { value: 'oils', label: '🧴 Oils & Condiments', color: 'bg-yellow-100' },
  { value: 'bakery', label: '🍞 Bakery Items', color: 'bg-amber-100' },
  { value: 'fasting', label: '🔱 Upvas/Fasting', color: 'bg-purple-50' },
  { value: 'snacks', label: '🥣 Snacks & Ready Mix', color: 'bg-orange-100' },
  { value: 'beverages', label: '☕ Tea & Coffee', color: 'bg-brown-50' },
  { value: 'household', label: '🧹 Cleaning & Household', color: 'bg-cyan-50' },
  { value: 'other', label: '📦 Other', color: 'bg-gray-50' }
];

const STOCK_LEVELS = [
  { value: 'empty', label: 'Empty', color: 'bg-gray-200 text-gray-700', icon: '○' },
  { value: 'low', label: 'Low', color: 'bg-[#FF9933] text-white', icon: '◔' },
  { value: 'half', label: 'Half', color: 'bg-[#FFCC00] text-gray-800', icon: '◑' },
  { value: 'full', label: 'Full', color: 'bg-[#77DD77] text-white', icon: '●' }
];

// Calculate stock status based on current stock vs monthly need
const calculateStockStatus = (currentStock, monthlyNeed) => {
  if (!monthlyNeed || monthlyNeed === 0) {
    return currentStock > 0 ? { value: 'full', label: 'Full', color: 'bg-[#77DD77] text-white', icon: '●' } 
                           : { value: 'empty', label: 'Empty', color: 'bg-gray-200 text-gray-700', icon: '○' };
  }
  
  const percentage = (currentStock / monthlyNeed) * 100;
  
  if (percentage === 0) {
    return { value: 'empty', label: 'Empty', color: 'bg-gray-200 text-gray-700', icon: '○' };
  } else if (percentage <= 25) {
    return { value: 'low', label: 'Low', color: 'bg-[#FF9933] text-white', icon: '◔' };
  } else if (percentage <= 75) {
    return { value: 'half', label: 'Half', color: 'bg-[#FFCC00] text-gray-800', icon: '◑' };
  } else {
    return { value: 'full', label: 'Full', color: 'bg-[#77DD77] text-white', icon: '●' };
  }
};

const InventoryPage = () => {
  const { inventory, loading, updateItem, deleteItem, fetchInventory } = useInventory();
  const { language, getLabel, isEnglish } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStockLevel, setSelectedStockLevel] = useState('all'); // New state for stock filtering
  const [isPantryTemplateOpen, setIsPantryTemplateOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [editingExpiryItemId, setEditingExpiryItemId] = useState(null);
  const [newExpiryDate, setNewExpiryDate] = useState('');

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
    const matchesSearch = item.name_en.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (item.name_gu && item.name_gu.includes(searchQuery)) ||
                         (item.name_mr && item.name_mr.includes(searchQuery));
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesStockLevel = selectedStockLevel === 'all' || item.stock_level === selectedStockLevel;
    return matchesSearch && matchesCategory && matchesStockLevel;
  });

  // Group items by category
  const groupedInventory = filteredInventory.reduce((acc, item) => {
    const category = item.category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {});

  const handleAddItem = async () => {
    try {
      await addItem({
        ...newItem,
        expiry_date: newItem.expiry_date || null
      });
      setIsAddDialogOpen(false);
      setNewItem({
        name_en: '',
        category: 'grains',
        stock_level: 'empty',
        freshness: null,
        is_secret_stash: false,
        unit: 'kg',
        expiry_date: ''
      });
    } catch (error) {
      console.error('Error adding item:', error);
    }
  };

  const handleScannedItem = async (scannedItem) => {
    try {
      await addItem(scannedItem);
    } catch (error) {
      console.error('Error adding scanned item:', error);
    }
  };

  const handleUpdateStock = async (itemId, stockLevel) => {
    try {
      await updateItem(itemId, { stock_level: stockLevel });
    } catch (error) {
      console.error('Error updating stock:', error);
    }
  };

  const handleMonthlyQuantityChange = async (item, direction) => {
    const defaults = DEFAULT_MONTHLY[item.category] || DEFAULT_MONTHLY['other'];
    const currentQty = item.monthly_quantity || defaults.quantity;
    const currentUnit = item.monthly_unit || defaults.unit;
    const step = defaults.step;
    
    let newQty;
    if (direction === 'increase') {
      newQty = currentQty + step;
    } else {
      newQty = Math.max(step, currentQty - step); // Don't go below one step
    }
    
    try {
      await updateItem(item.id, { 
        monthly_quantity: newQty, 
        monthly_unit: currentUnit 
      });
    } catch (error) {
      console.error('Error updating monthly quantity:', error);
    }
  };

  // Handle current stock changes (for consumption tracking)
  const handleCurrentStockChange = async (item, direction) => {
    const defaults = DEFAULT_MONTHLY[item.category] || DEFAULT_MONTHLY['other'];
    const currentStock = item.current_stock || 0;
    const step = defaults.step;
    
    let newStock;
    if (direction === 'increase') {
      newStock = currentStock + step;
    } else {
      newStock = Math.max(0, currentStock - step); // Don't go below 0
    }
    
    try {
      // Calculate the new stock level based on current stock vs monthly need
      const monthlyNeed = item.monthly_quantity || defaults.quantity;
      const newStatus = calculateStockStatus(newStock, monthlyNeed);
      
      await updateItem(item.id, { 
        current_stock: newStock,
        stock_level: newStatus.value // Also update stock_level for backward compatibility
      });
    } catch (error) {
      console.error('Error updating current stock:', error);
    }
  };

  const handleDelete = async (itemId, itemName) => {
    if (window.confirm(`Are you sure you want to delete "${itemName}"?`)) {
      try {
        await deleteItem(itemId);
        // Force a small delay to ensure state updates
        setTimeout(() => {
          console.log('Item deleted successfully');
        }, 100);
      } catch (error) {
        console.error('Error deleting item:', error);
        alert('Failed to delete item. Please try again.');
      }
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

  const getCategoryInfo = (categoryValue) => {
    return CATEGORIES.find(c => c.value === categoryValue) || CATEGORIES[CATEGORIES.length - 1];
  };

  const getStockLevelInfo = (level) => {
    return STOCK_LEVELS.find(s => s.value === level) || STOCK_LEVELS[0];
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
        <div className="flex gap-2 flex-wrap">
          <Button 
            onClick={() => setIsPantryTemplateOpen(true)}
            className="bg-[#77DD77] hover:bg-[#66CC66] text-gray-900 rounded-full shadow-md"
            data-testid="pantry-template-btn"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            <span className="hidden md:inline">{getLabel('indianPantryTemplate')}</span>
            <span className="md:hidden">{getLabel('browseTemplate')}</span>
          </Button>
          <Button 
            onClick={() => setIsScannerOpen(true)}
            className="bg-[#138808] hover:bg-[#0d6606] text-white rounded-full shadow-md"
            data-testid="scan-item-btn"
          >
            <Camera className="w-5 h-5 mr-2" />
            {getLabel('scanProduct')}
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className="bg-[#FF9933] hover:bg-[#E68A2E] text-white rounded-full shadow-md"
                data-testid="add-item-btn"
              >
                <Plus className="w-5 h-5 mr-2" />
                {getLabel('addItem')}
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="add-item-dialog">
              <DialogHeader>
                <DialogTitle>{getLabel('addNewItem')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>{getLabel('itemName')} (English)</Label>
                  <Input
                    value={newItem.name_en}
                    onChange={(e) => setNewItem({ ...newItem, name_en: e.target.value })}
                    placeholder="e.g., Turmeric Powder"
                    data-testid="item-name-input"
                  />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={newItem.category} onValueChange={(val) => setNewItem({ ...newItem, category: val })}>
                    <SelectTrigger data-testid="category-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Initial Stock Level</Label>
                  <Select value={newItem.stock_level} onValueChange={(val) => setNewItem({ ...newItem, stock_level: val })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STOCK_LEVELS.map(level => (
                        <SelectItem key={level.value} value={level.value}>
                          {level.icon} {level.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    Expiry Date (Optional)
                  </Label>
                  <Input
                    type="date"
                    value={newItem.expiry_date}
                    onChange={(e) => setNewItem({ ...newItem, expiry_date: e.target.value })}
                    className="mt-1"
                    data-testid="expiry-date-input"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="secret-stash"
                    checked={newItem.is_secret_stash}
                    onChange={(e) => setNewItem({ ...newItem, is_secret_stash: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="secret-stash">Mark as Secret Stash 🔒</Label>
                </div>
                <Button 
                  onClick={handleAddItem}
                  className="w-full bg-[#FF9933] hover:bg-[#E68A2E] text-white rounded-full"
                  data-testid="submit-add-item"
                >
                  Add to Inventory
                </Button>
              </div>
            </DialogContent>
          </Dialog>
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
                {inventory.filter(i => i.stock_level === 'full').length}
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
                {inventory.filter(i => i.stock_level === 'half').length}
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
                {inventory.filter(i => i.stock_level === 'low').length}
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
                {inventory.filter(i => i.stock_level === 'empty').length}
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
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                  {items.map((item) => {
                    const stockInfo = getStockLevelInfo(item.stock_level);
                    
                    return (
                      <Card 
                        key={item.id}
                        className={`${categoryInfo.color} border-2 border-gray-200 hover-lift transition-all`}
                        data-testid={`inventory-item-${item.id}`}
                      >
                        <CardContent className="p-4 md:p-5">
                          {/* Header with Secret Stash */}
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1 min-w-0">
                              {/* Bilingual Item Name - Using TranslatedLabel */}
                              <h3 className="text-base md:text-xl font-bold text-gray-800 mb-1 break-words group">
                                <TranslatedLabel 
                                  textEn={item.name_en}
                                  textRegional={language === 'hi' ? item.name_hi : item.name_mr}
                                  targetLanguage={language}
                                  showVerification={true}
                                  size="md"
                                />
                              </h3>
                              
                              {/* Category Badge */}
                              <Badge variant="outline" className="text-[10px] md:text-xs border-gray-400">
                                {categoryInfo.label}
                              </Badge>
                            </div>
                            
                            {item.is_secret_stash && (
                              <div className="flex-shrink-0 ml-2">
                                <Lock className="w-5 h-5 text-[#FFCC00]" />
                              </div>
                            )}
                          </div>

                          {/* Freshness Bar (if applicable) */}
                          {item.freshness !== null && (
                            <div className="mb-4 p-3 bg-white/50 rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-gray-700">Freshness</span>
                                <span className="text-xs font-bold text-gray-800">{item.freshness}%</span>
                              </div>
                              <Progress 
                                value={item.freshness} 
                                className="h-2"
                              />
                            </div>
                          )}

                          {/* Expiry Date Display & Editor */}
                          {editingExpiryItemId === item.id ? (
                            <div className="mb-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
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
                                    onClick={() => handleUpdateExpiryDate(item.id)}
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
                                <div className={`mb-3 p-2 rounded-lg ${
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
                                      title="Update expiry date (bought fresh stock?)"
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
                            <div className="mb-3">
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

                          {/* Stock Level Display - Now Dynamic */}
                          <div className="mb-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-700">Stock Level</span>
                              {(() => {
                                const currentStock = item.current_stock || 0;
                                const monthlyNeed = item.monthly_quantity || DEFAULT_MONTHLY[item.category]?.quantity || 500;
                                const calculatedStatus = calculateStockStatus(currentStock, monthlyNeed);
                                return (
                                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${calculatedStatus.color}`}>
                                    {calculatedStatus.icon} {calculatedStatus.label}
                                  </span>
                                );
                              })()}
                            </div>
                          </div>

                          {/* Current Stock Controls - Replaces dot toggles */}
                          <div className="mb-3 p-2.5 md:p-3 bg-white/70 rounded-xl border border-gray-200">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-gray-600">Current Stock</span>
                              <div className="flex items-center gap-1.5 md:gap-2">
                                <button
                                  onClick={() => handleCurrentStockChange(item, 'decrease')}
                                  className="w-10 h-10 md:w-8 md:h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 transition-colors"
                                  data-testid={`stock-minus-${item.id}`}
                                  disabled={(item.current_stock || 0) <= 0}
                                >
                                  <Minus className="w-4 h-4" />
                                </button>
                                <span className="min-w-[60px] md:min-w-[70px] text-center text-sm font-bold text-gray-800 bg-[#E8F5E9] px-2 md:px-3 py-1.5 rounded-lg border border-[#77DD77]/30">
                                  {formatQuantity(
                                    item.current_stock || 0,
                                    item.monthly_unit || DEFAULT_MONTHLY[item.category]?.unit || 'g'
                                  )}
                                </span>
                                <button
                                  onClick={() => handleCurrentStockChange(item, 'increase')}
                                  className="w-10 h-10 md:w-8 md:h-8 flex items-center justify-center rounded-lg bg-[#77DD77] hover:bg-[#66CC66] active:bg-[#55BB55] text-white transition-colors"
                                  data-testid={`stock-plus-${item.id}`}
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Monthly Quantity Controls - Touch-friendly */}
                          <div className="mb-3 p-2.5 md:p-3 bg-white/70 rounded-xl border border-gray-200">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-gray-600">Monthly Need</span>
                              <div className="flex items-center gap-1.5 md:gap-2">
                                <button
                                  onClick={() => handleMonthlyQuantityChange(item, 'decrease')}
                                  className="w-10 h-10 md:w-8 md:h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 transition-colors"
                                  data-testid={`monthly-minus-${item.id}`}
                                >
                                  <Minus className="w-4 h-4" />
                                </button>
                                <span className="min-w-[60px] md:min-w-[70px] text-center text-sm font-bold text-gray-800 bg-[#FFFBF0] px-2 md:px-3 py-1.5 rounded-lg border border-[#FFCC00]/30">
                                  {formatQuantity(
                                    item.monthly_quantity || DEFAULT_MONTHLY[item.category]?.quantity || 500,
                                    item.monthly_unit || DEFAULT_MONTHLY[item.category]?.unit || 'g'
                                  )}
                                </span>
                                <button
                                  onClick={() => handleMonthlyQuantityChange(item, 'increase')}
                                  className="w-10 h-10 md:w-8 md:h-8 flex items-center justify-center rounded-lg bg-[#FF9933] hover:bg-[#E68A2E] active:bg-[#D07A20] text-white transition-colors"
                                  data-testid={`monthly-plus-${item.id}`}
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Delete Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(item.id, item.name_en)}
                            className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg"
                            data-testid={`delete-${item.id}`}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
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
    </div>
  );
};

export default InventoryPage;
