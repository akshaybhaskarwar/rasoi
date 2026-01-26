import { useState } from 'react';
import { useInventory } from '@/hooks/useRasoiSync';
import { Plus, Search, Lock, Trash2, Package2, Sparkles, Edit } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { IndianPantryTemplate } from '@/components/IndianPantryTemplate';
import { Badge } from '@/components/ui/badge';

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
  { value: 'other', label: '📦 Other', color: 'bg-gray-50' }
];

const STOCK_LEVELS = [
  { value: 'empty', label: 'Empty', color: 'bg-gray-200 text-gray-700', icon: '○' },
  { value: 'low', label: 'Low', color: 'bg-[#FF9933] text-white', icon: '◔' },
  { value: 'half', label: 'Half', color: 'bg-[#FFCC00] text-gray-800', icon: '◑' },
  { value: 'full', label: 'Full', color: 'bg-[#77DD77] text-white', icon: '●' }
];

const InventoryPage = () => {
  const { inventory, loading, addItem, updateItem, deleteItem } = useInventory();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStockLevel, setSelectedStockLevel] = useState('all'); // New state for stock filtering
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isPantryTemplateOpen, setIsPantryTemplateOpen] = useState(false);
  
  const [newItem, setNewItem] = useState({
    name_en: '',
    category: 'grains',
    stock_level: 'empty',
    freshness: null,
    is_secret_stash: false,
    unit: 'kg'
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
      await addItem(newItem);
      setIsAddDialogOpen(false);
      setNewItem({
        name_en: '',
        category: 'grains',
        stock_level: 'empty',
        freshness: null,
        is_secret_stash: false,
        unit: 'kg'
      });
    } catch (error) {
      console.error('Error adding item:', error);
    }
  };

  const handleUpdateStock = async (itemId, stockLevel) => {
    try {
      await updateItem(itemId, { stock_level: stockLevel });
    } catch (error) {
      console.error('Error updating stock:', error);
    }
  };

  const handleDelete = async (itemId) => {
    if (window.confirm('Delete this item?')) {
      try {
        await deleteItem(itemId);
      } catch (error) {
        console.error('Error deleting item:', error);
      }
    }
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
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-gray-800">
            Bilingual Inventory
          </h1>
          <p className="text-gray-600 mt-1">Manage your kitchen stock in English - मराठी</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => setIsPantryTemplateOpen(true)}
            className="bg-[#77DD77] hover:bg-[#66CC66] text-gray-900 rounded-full shadow-md"
            data-testid="pantry-template-btn"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            <span className="hidden md:inline">Indian Pantry Template</span>
            <span className="md:hidden">Template</span>
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className="bg-[#FF9933] hover:bg-[#E68A2E] text-white rounded-full shadow-md"
                data-testid="add-item-btn"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add Item
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="add-item-dialog">
              <DialogHeader>
                <DialogTitle>Add New Item</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Item Name (English)</Label>
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
            placeholder="Search inventory by name..."
            className="pl-10 border-gray-300"
            data-testid="search-input"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="md:w-64 border-gray-300" data-testid="filter-category">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">📋 All Categories</SelectItem>
            {CATEGORIES.map(cat => (
              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-[#77DD77] to-[#66CC66] text-white">
          <CardContent className="p-6">
            <div className="text-3xl font-bold">
              {inventory.filter(i => i.stock_level === 'full').length}
            </div>
            <div className="text-sm opacity-90">Full Stock</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-[#FFCC00] to-[#E6B800] text-gray-800">
          <CardContent className="p-6">
            <div className="text-3xl font-bold">
              {inventory.filter(i => i.stock_level === 'half').length}
            </div>
            <div className="text-sm opacity-90">Half Stock</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-[#FF9933] to-[#E68A2E] text-white">
          <CardContent className="p-6">
            <div className="text-3xl font-bold">
              {inventory.filter(i => i.stock_level === 'low').length}
            </div>
            <div className="text-sm opacity-90">Low Stock</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-gray-400 to-gray-500 text-white">
          <CardContent className="p-6">
            <div className="text-3xl font-bold">
              {inventory.filter(i => i.stock_level === 'empty').length}
            </div>
            <div className="text-sm opacity-90">Empty</div>
          </CardContent>
        </Card>
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
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((item) => {
                    const stockInfo = getStockLevelInfo(item.stock_level);
                    
                    return (
                      <Card 
                        key={item.id}
                        className={`${categoryInfo.color} border-2 border-gray-200 hover-lift transition-all`}
                        data-testid={`inventory-item-${item.id}`}
                      >
                        <CardContent className="p-5">
                          {/* Header with Secret Stash */}
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              {/* Bilingual Item Name */}
                              <h3 className="text-xl font-bold text-gray-800 mb-1 bilingual-text">
                                {item.name_en}
                                {(item.name_gu || item.name_mr) && (
                                  <>
                                    <span className="text-[#FF9933] mx-2">/</span>
                                    <span className="text-gray-700 font-semibold">
                                      {item.name_mr || item.name_gu}
                                    </span>
                                  </>
                                )}
                              </h3>
                              
                              {/* Category Badge */}
                              <Badge variant="outline" className="text-xs border-gray-400">
                                {categoryInfo.label}
                              </Badge>
                            </div>
                            
                            {item.is_secret_stash && (
                              <div className="flex-shrink-0">
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

                          {/* Stock Level Display */}
                          <div className="mb-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-700">Stock Level</span>
                              <span className={`px-3 py-1 rounded-full text-xs font-bold ${stockInfo.color}`}>
                                {stockInfo.icon} {stockInfo.label}
                              </span>
                            </div>
                          </div>

                          {/* Stock Level Toggles */}
                          <div className="grid grid-cols-4 gap-2 mb-3">
                            {STOCK_LEVELS.map((level) => (
                              <button
                                key={level.value}
                                onClick={() => handleUpdateStock(item.id, level.value)}
                                className={`py-2 rounded-lg text-xs font-bold transition-all ${
                                  item.stock_level === level.value
                                    ? level.color + ' shadow-md'
                                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
                                }`}
                                data-testid={`stock-${level.value}-${item.id}`}
                              >
                                {level.icon}
                              </button>
                            ))}
                          </div>

                          {/* Delete Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(item.id)}
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
      />
    </div>
  );
};

export default InventoryPage;
