import { useState, useEffect } from 'react';
import { useShoppingList, useInventory } from '@/hooks/useRasoiSync';
import { Plus, Trash2, ShoppingBag, Send, RefreshCw, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const CATEGORIES = ['grains', 'spices', 'vegetables', 'fruits', 'dairy', 'pulses', 'oils', 'snacks'];

// Map inventory categories to store types
const CATEGORY_TO_STORE = {
  'grains': 'grocery',
  'pulses': 'grocery',
  'spices': 'grocery',
  'dairy': 'grocery',
  'oils': 'grocery',
  'bakery': 'grocery',
  'fasting': 'grocery',
  'snacks': 'grocery',
  'beverages': 'grocery',
  'vegetables': 'mandi',
  'fruits': 'mandi',
  'other': 'grocery'
};

const ShoppingPage = () => {
  const { shoppingList, addItem, deleteItem, clearList } = useShoppingList();
  const { inventory } = useInventory();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('grocery');
  const [syncing, setSyncing] = useState(false);
  const [newItem, setNewItem] = useState({
    name_en: '',
    category: 'grains',
    quantity: '1 kg',
    store_type: 'grocery'
  });

  const filteredList = shoppingList.filter(item => item.store_type === activeTab);
  
  const groupedByCategory = filteredList.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  // Get low stock and empty items from inventory
  const getLowStockItems = () => {
    return inventory.filter(item => 
      item.stock_level === 'low' || item.stock_level === 'empty'
    );
  };

  // Sync low stock items to shopping list
  const syncFromInventory = async () => {
    setSyncing(true);
    try {
      const lowStockItems = getLowStockItems();
      let addedCount = 0;

      for (const item of lowStockItems) {
        // Check if item already in shopping list
        const alreadyInList = shoppingList.some(
          shopItem => shopItem.name_en === item.name_en
        );

        if (!alreadyInList) {
          const storeType = CATEGORY_TO_STORE[item.category] || 'grocery';
          
          await addItem({
            name_en: item.name_en,
            name_mr: item.name_mr,
            category: item.category,
            quantity: '-',  // Placeholder since we use stock_level for display
            store_type: storeType,
            stock_level: item.stock_level  // This is now saved by backend
          });
          addedCount++;
        }
      }

      if (addedCount > 0) {
        alert(`Added ${addedCount} low/empty stock items to shopping list!`);
      } else {
        alert('All low stock items are already in shopping list.');
      }
    } catch (error) {
      console.error('Error syncing from inventory:', error);
      alert('Failed to sync items from inventory');
    } finally {
      setSyncing(false);
    }
  };

  // Count low stock items not in shopping list
  const getLowStockCount = () => {
    const lowStockItems = getLowStockItems();
    const notInList = lowStockItems.filter(item => 
      !shoppingList.some(shopItem => shopItem.name_en === item.name_en)
    );
    return notInList.length;
  };

  // Auto-sync on mount if there are low stock items
  useEffect(() => {
    const lowStockCount = getLowStockCount();
    if (lowStockCount > 0 && shoppingList.length === 0) {
      // Auto-sync only if shopping list is empty
      syncFromInventory();
    }
  }, []); // Only run on mount

  const handleAddItem = async () => {
    try {
      await addItem({ ...newItem, store_type: activeTab });
      setIsAddDialogOpen(false);
      setNewItem({ name_en: '', category: 'grains', quantity: '1 kg', store_type: 'grocery' });
    } catch (error) {
      console.error('Error adding item:', error);
    }
  };

  const generateWhatsAppMessage = () => {
    let message = `🛒 *Shopping List - ${activeTab === 'grocery' ? 'Grocery Store' : 'Local Mandi'}*\n\n`;
    
    Object.entries(groupedByCategory).forEach(([category, items]) => {
      message += `*${category.toUpperCase()}*\n`;
      items.forEach(item => {
        const bilingual = item.name_mr ? `${item.name_en} / ${item.name_mr}` : item.name_en;
        message += `• ${bilingual} - ${item.quantity}\n`;
      });
      message += '\n';
    });
    
    return encodeURIComponent(message);
  };

  const handleWhatsAppExport = () => {
    const message = generateWhatsAppMessage();
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  const handleCopyToClipboard = () => {
    const message = decodeURIComponent(generateWhatsAppMessage());
    navigator.clipboard.writeText(message);
    alert('Copied to clipboard! You can now paste it in WhatsApp.');
  };

  const handleDeleteItem = async (itemId, itemName) => {
    try {
      await deleteItem(itemId);
      console.log(`Successfully deleted: ${itemName}`);
    } catch (error) {
      console.error('Error deleting shopping item:', error);
      alert(`Failed to delete "${itemName}". Please try again.`);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 pb-24 md:pb-6 space-y-6" data-testid="shopping-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Kirana-Connect</h1>
          <p className="text-gray-600 text-sm mt-1">Your smart shopping assistant</p>
        </div>
        <div className="flex gap-2">
          {getLowStockCount() > 0 && (
            <Button
              onClick={syncFromInventory}
              disabled={syncing}
              className="bg-[#77DD77] hover:bg-[#66CC66] text-gray-900 rounded-full shadow-md"
              data-testid="sync-inventory-btn"
            >
              {syncing ? (
                <>
                  <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Sync {getLowStockCount()} Low Stock Items
                </>
              )}
            </Button>
          )}
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className="bg-[#FF9933] hover:bg-[#E68A2E] text-white rounded-full shadow-md"
                data-testid="add-shopping-item-btn"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add Item
              </Button>
            </DialogTrigger>
          <DialogContent data-testid="add-shopping-dialog">
            <DialogHeader>
              <DialogTitle>Add Shopping Item</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Item Name</Label>
                <Input
                  value={newItem.name_en}
                  onChange={(e) => setNewItem({ ...newItem, name_en: e.target.value })}
                  placeholder="e.g., Basmati Rice"
                  data-testid="shopping-item-name"
                />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={newItem.category} onValueChange={(val) => setNewItem({ ...newItem, category: val })}>
                  <SelectTrigger>
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
                <Label>Quantity</Label>
                <Input
                  value={newItem.quantity}
                  onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                  placeholder="e.g., 2 kg"
                />
              </div>
              <Button 
                onClick={handleAddItem}
                className="w-full bg-[#FF9933] hover:bg-[#E68A2E] text-white rounded-full"
              >
                Add to Shopping List
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="grocery" data-testid="tab-grocery">Grocery Store</TabsTrigger>
          <TabsTrigger value="mandi" data-testid="tab-mandi">Local Mandi</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4 mt-6">
          {Object.keys(groupedByCategory).length === 0 ? (
            <Card className="p-12 text-center">
              <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">Your shopping list is empty</p>
              <p className="text-sm text-gray-500">Add items to get started</p>
            </Card>
          ) : (
            <>
              {Object.entries(groupedByCategory).map(([category, items]) => (
                <Card key={category} className="shadow-sm">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 capitalize">
                      {category} <span className="text-sm text-gray-500">({items.length})</span>
                    </h3>
                    <div className="space-y-2">
                      {items.map((item) => (
                        <div 
                          key={item.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                          data-testid={`shopping-item-${item.id}`}
                        >
                          <div className="flex-1">
                            <p className="font-medium text-gray-800 bilingual-text">
                              {item.name_en}
                              {item.name_mr && <span className="text-gray-600"> <span className="text-[#FF9933]">/</span> <span className="font-semibold">{item.name_mr}</span></span>}
                            </p>
                            {/* Display stock level badge */}
                            <span className={`inline-block mt-1 text-xs px-2 py-1 rounded-full font-medium ${
                              item.stock_level === 'empty'
                                ? 'bg-gray-200 text-gray-700'
                                : item.stock_level === 'low'
                                  ? 'bg-[#FF9933]/20 text-[#FF9933]'
                                  : 'bg-gray-100 text-gray-600'
                            }`}>
                              {item.stock_level === 'empty' ? '○ Empty' : 
                               item.stock_level === 'low' ? '◔ Low' : 
                               item.quantity}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteItem(item.id, item.name_en)}
                            className="text-red-600 hover:text-red-700"
                            data-testid={`delete-shopping-${item.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}

              <div className="fixed bottom-20 md:bottom-6 right-6 flex flex-col gap-2 z-50">
                <Button
                  onClick={handleCopyToClipboard}
                  className="bg-[#77DD77] hover:bg-[#66CC66] text-gray-900 rounded-full shadow-lg"
                  data-testid="copy-whatsapp-btn"
                >
                  <Send className="w-5 h-5 mr-2" />
                  Copy for WhatsApp
                </Button>
                <Button
                  onClick={handleWhatsAppExport}
                  className="bg-[#25D366] hover:bg-[#20BD5A] text-white rounded-full shadow-lg"
                  data-testid="send-whatsapp-btn"
                >
                  <Send className="w-5 h-5 mr-2" />
                  Send to WhatsApp
                </Button>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ShoppingPage;
