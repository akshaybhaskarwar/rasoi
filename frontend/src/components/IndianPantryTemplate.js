import { useState } from 'react';
import { Check, ChefHat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useInventory } from '@/hooks/useRasoiSync';

const PANTRY_TEMPLATE = {
  'Spices & Masalas': {
    icon: '🌶️',
    color: 'bg-red-50',
    items: [
      'Turmeric', 'Red Chili Powder', 'Cumin Seeds', 'Coriander Powder',
      'Garam Masala', 'Mustard Seeds', 'Curry Leaves', 'Bay Leaves',
      'Cinnamon', 'Cardamom', 'Cloves', 'Black Pepper',
      'Fenugreek Seeds', 'Asafoetida', 'Fennel Seeds', 'Carom Seeds',
      'Dried Red Chilies', 'Kashmiri Red Chili', 'Black Cardamom', 'Star Anise'
    ]
  },
  'Vegetables & Greens': {
    icon: '🥬',
    color: 'bg-green-50',
    items: [
      'Onion', 'Tomato', 'Potato', 'Garlic', 'Ginger', 'Green Chili',
      'Coriander Leaves', 'Mint Leaves', 'Spinach', 'Fenugreek Leaves',
      'Cauliflower', 'Cabbage', 'Carrot', 'Beans', 'Peas', 'Bell Pepper',
      'Eggplant', 'Okra', 'Bottle Gourd', 'Ridge Gourd', 'Bitter Gourd',
      'Drumstick', 'Radish', 'Beetroot', 'Pumpkin', 'Cucumber', 'Capsicum'
    ]
  },
  'Grains & Cereals': {
    icon: '🌾',
    color: 'bg-amber-50',
    items: [
      'Wheat Flour', 'Rice', 'Basmati Rice', 'Sona Masoori Rice',
      'Jowar', 'Bajra', 'Ragi', 'Poha', 'Upma Rava', 'Suji',
      'Maida', 'Besan', 'Rice Flour', 'Corn Flour'
    ]
  },
  'Pulses & Lentils': {
    icon: '🫘',
    color: 'bg-yellow-50',
    items: [
      'Tuvar Dal', 'Moong Dal', 'Chana Dal', 'Masoor Dal',
      'Urad Dal', 'Kabuli Chana', 'Kala Chana', 'Rajma',
      'Lobia', 'Green Gram', 'Whole Moong', 'Whole Urad'
    ]
  },
  'Dairy & Essentials': {
    icon: '🥛',
    color: 'bg-blue-50',
    items: [
      'Milk', 'Curd', 'Paneer', 'Ghee', 'Butter', 'Cream',
      'Salt', 'Sugar', 'Jaggery', 'Oil', 'Mustard Oil',
      'Coconut Oil', 'Sesame Oil', 'Tea', 'Coffee'
    ]
  },
  'Dry Fruits & Nuts': {
    icon: '🥜',
    color: 'bg-orange-50',
    items: [
      'Almonds', 'Cashews', 'Pistachios', 'Walnuts', 'Peanuts',
      'Raisins', 'Dates', 'Figs', 'Dried Coconut', 'Sesame Seeds',
      'Sunflower Seeds', 'Pumpkin Seeds', 'Chia Seeds', 'Flax Seeds'
    ]
  }
};

export const IndianPantryTemplate = ({ isOpen, onClose }) => {
  const [selectedItems, setSelectedItems] = useState({});
  const [expandedCategories, setExpandedCategories] = useState(
    Object.keys(PANTRY_TEMPLATE).reduce((acc, cat) => ({ ...acc, [cat]: true }), {})
  );
  const { addItem } = useInventory();
  const [loading, setLoading] = useState(false);

  const toggleItemSelection = (category, item) => {
    setSelectedItems(prev => {
      const categoryItems = prev[category] || [];
      const isSelected = categoryItems.includes(item);
      
      return {
        ...prev,
        [category]: isSelected
          ? categoryItems.filter(i => i !== item)
          : [...categoryItems, item]
      };
    });
  };

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const getSelectedCount = (category) => {
    return (selectedItems[category] || []).length;
  };

  const getTotalSelected = () => {
    return Object.values(selectedItems).reduce((sum, items) => sum + items.length, 0);
  };

  const handleAddToInventory = async () => {
    setLoading(true);
    try {
      const allSelectedItems = [];
      
      Object.entries(selectedItems).forEach(([category, items]) => {
        items.forEach(item => {
          allSelectedItems.push({
            name_en: item,
            category: category.toLowerCase().split(' ')[0], // Use first word as category
            stock_level: 'empty',
            unit: 'kg'
          });
        });
      });

      // Add all items
      for (const item of allSelectedItems) {
        await addItem(item);
      }

      alert(`Successfully added ${allSelectedItems.length} items to your inventory!`);
      setSelectedItems({});
      onClose();
    } catch (error) {
      console.error('Error adding items:', error);
      alert('Error adding items to inventory');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto custom-scrollbar" data-testid="pantry-template-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl">
            <ChefHat className="w-8 h-8 text-[#FF9933]" />
            Indian Pantry Template
          </DialogTitle>
          <p className="text-gray-600 text-sm mt-2">
            Select items from common Indian pantry categories to quickly setup your inventory
          </p>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {Object.entries(PANTRY_TEMPLATE).map(([category, { icon, color, items }]) => {
            const selectedCount = getSelectedCount(category);
            const isExpanded = expandedCategories[category];
            const displayItems = isExpanded ? items : items.slice(0, 8);
            const hasMore = items.length > 8;

            return (
              <div 
                key={category}
                className={`${color} rounded-2xl p-6 border border-gray-200`}
                data-testid={`category-${category}`}
              >
                {/* Category Header */}
                <div 
                  className="flex items-center justify-between mb-4 cursor-pointer"
                  onClick={() => toggleCategory(category)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{icon}</span>
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">{category}</h3>
                      <p className="text-sm text-gray-600">
                        {selectedCount}/{items.length} Selected
                      </p>
                    </div>
                  </div>
                  <button className="text-gray-600 hover:text-gray-800 transition-transform duration-200">
                    <span className={`text-xl transform ${isExpanded ? 'rotate-180' : ''} inline-block transition-transform`}>
                      ∨
                    </span>
                  </button>
                </div>

                {/* Items Grid */}
                {isExpanded && (
                  <div className="flex flex-wrap gap-2">
                    {displayItems.map((item) => {
                      const isSelected = (selectedItems[category] || []).includes(item);
                      
                      return (
                        <button
                          key={item}
                          onClick={() => toggleItemSelection(category, item)}
                          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                            isSelected
                              ? 'bg-white border-2 border-[#77DD77] text-gray-800 shadow-sm'
                              : 'bg-white border border-gray-300 text-gray-700 hover:border-gray-400'
                          }`}
                          data-testid={`item-${item.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          <span className="flex items-center gap-2">
                            {isSelected && <Check className="w-4 h-4 text-[#77DD77]" />}
                            {item}
                          </span>
                        </button>
                      );
                    })}
                    
                    {hasMore && !isExpanded && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCategory(category);
                        }}
                        className="px-4 py-2 rounded-full text-sm font-medium bg-white border border-gray-300 text-gray-700 hover:border-gray-400"
                      >
                        +{items.length - 8} More
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-6 border-t mt-6">
          <div className="text-sm text-gray-600">
            <span className="font-medium text-[#FF9933]">{getTotalSelected()}</span> items selected
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="rounded-full"
              data-testid="cancel-template-btn"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddToInventory}
              disabled={getTotalSelected() === 0 || loading}
              className="bg-[#FF9933] hover:bg-[#E68A2E] text-white rounded-full"
              data-testid="add-to-inventory-btn"
            >
              {loading ? 'Adding...' : `Add ${getTotalSelected()} Items to Inventory`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
