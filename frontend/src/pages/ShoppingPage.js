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
        const bilingual = item.name_gu ? `${item.name_en} / ${item.name_gu}` : item.name_en;
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

  return (
    <div className="container mx-auto px-4 py-6 pb-24 md:pb-6 space-y-6" data-testid="shopping-page">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-800">Kirana-Connect</h1>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className="bg-[#FF9933] hover:bg-[#E68A2E] text-white rounded-full"
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
                            <p className="font-medium text-gray-800">
                              {item.name_en}
                              {item.name_gu && <span className="text-gray-600"> / {item.name_gu}</span>}
                            </p>
                            <p className="text-sm text-gray-600">{item.quantity}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteItem(item.id)}
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
