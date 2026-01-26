import { useState } from 'react';
import { useInventory } from '@/hooks/useRasoiSync';
import { Plus, Search, Lock, Trash2, Package2, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { IndianPantryTemplate } from '@/components/IndianPantryTemplate';

const CATEGORIES = ['grains', 'spices', 'vegetables', 'fruits', 'dairy', 'pulses', 'oils', 'snacks'];
const STOCK_LEVELS = ['empty', 'low', 'half', 'full'];

const InventoryPage = () => {
  const { inventory, loading, addItem, updateItem, deleteItem } = useInventory();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  
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
    return matchesSearch && matchesCategory;
  });

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

  return (
    <div className="container mx-auto px-4 py-6 pb-24 md:pb-6 space-y-6" data-testid="inventory-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-800">Bilingual Inventory</h1>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className="bg-[#FF9933] hover:bg-[#E68A2E] text-white rounded-full"
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
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
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
                      <SelectItem key={level} value={level}>{level}</SelectItem>
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
                <Label htmlFor="secret-stash">Mark as Secret Stash</Label>
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

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search inventory..."
            className="pl-10"
            data-testid="search-input"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="md:w-48" data-testid="filter-category">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Inventory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredInventory.map((item) => (
          <Card 
            key={item.id}
            className="hover-lift relative"
            data-testid={`inventory-item-${item.id}`}
          >
            <CardContent className="p-6">
              {/* Secret Stash Indicator */}
              {item.is_secret_stash && (
                <div className="absolute top-3 right-3">
                  <Lock className="w-4 h-4 text-[#FFCC00]" />
                </div>
              )}

              {/* Item Name - Bilingual */}
              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-800">{item.name_en}</h3>
                {item.name_gu && (
                  <p className="text-sm text-gray-600 bilingual-text mt-1">{item.name_gu}</p>
                )}
                {item.name_mr && (
                  <p className="text-xs text-gray-500 bilingual-text">{item.name_mr}</p>
                )}
              </div>

              {/* Category Badge */}
              <div className="mb-3">
                <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                  {item.category}
                </span>
              </div>

              {/* Freshness Bar (if applicable) */}
              {item.freshness !== null && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-600">Freshness</span>
                    <span className="text-xs font-medium text-gray-800">{item.freshness}%</span>
                  </div>
                  <Progress value={item.freshness} className="h-2" />
                </div>
              )}

              {/* Stock Level Toggles */}
              <div className="space-y-2">
                <p className="text-xs text-gray-600 font-medium">Stock Level:</p>
                <div className="flex gap-2">
                  {STOCK_LEVELS.map((level) => (
                    <button
                      key={level}
                      onClick={() => handleUpdateStock(item.id, level)}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                        item.stock_level === level
                          ? level === 'full' ? 'bg-[#77DD77] text-white' :
                            level === 'half' ? 'bg-[#FFCC00] text-gray-800' :
                            level === 'low' ? 'bg-[#FF9933] text-white' :
                            'bg-gray-300 text-gray-700'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      data-testid={`stock-${level}-${item.id}`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              {/* Delete Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(item.id)}
                className="w-full mt-3 text-red-600 hover:text-red-700 hover:bg-red-50"
                data-testid={`delete-${item.id}`}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredInventory.length === 0 && (
        <div className="text-center py-12">
          <Package2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">No items found in inventory</p>
        </div>
      )}
    </div>
  );
};

export default InventoryPage;
