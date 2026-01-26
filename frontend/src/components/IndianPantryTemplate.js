import { useState } from 'react';
import { Check, ChefHat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useInventory } from '@/hooks/useRasoiSync';

const PANTRY_TEMPLATE = {
  '🛒 GROCERY (किराणा)': {
    '🌾 Grains, Rice, Rava & Cereals': {
      color: 'bg-amber-50',
      items: [
        { en: 'Rice', mr: 'तांदूळ' },
        { en: 'Basmati Rice', mr: 'बासमती तांदूळ' },
        { en: 'Indrayani Rice', mr: 'इंद्रायणी तांदूळ' },
        { en: 'Broken Rice', mr: 'तुटलेला तांदूळ' },
        { en: 'Wheat', mr: 'गहू' },
        { en: 'Wheat Flour', mr: 'गव्हाचे पीठ' },
        { en: 'Rice Flour', mr: 'तांदळाचे पीठ' },
        { en: 'Maida', mr: 'मैदा' },
        { en: 'Jowar Flour', mr: 'ज्वारीचे पीठ' },
        { en: 'Bajra Flour', mr: 'बाजरीचे पीठ' },
        { en: 'Ragi Flour', mr: 'नाचणी पीठ' },
        { en: 'Dalia (Broken Wheat)', mr: 'दलिया / फुटलेला गहू' },
        { en: 'Dalwa', mr: 'डाळवा' },
        { en: 'Rava', mr: 'रवा' },
        { en: 'Barik Rava', mr: 'बारीक रवा' },
        { en: 'Jada Rava', mr: 'जाड रवा' },
        { en: 'Upma Rava', mr: 'उपमा रवा' },
        { en: 'Idli Rava', mr: 'इडली रवा' }
      ]
    },
    '🫘 Pulses, Beans & Chana': {
      color: 'bg-yellow-50',
      items: [
        { en: 'Toor Dal', mr: 'तूर डाळ' },
        { en: 'Moong Dal', mr: 'मूग डाळ' },
        { en: 'Masoor Dal', mr: 'मसूर डाळ' },
        { en: 'Chana Dal', mr: 'हरभरा डाळ' },
        { en: 'Urad Dal', mr: 'उडीद डाळ' },
        { en: 'Whole Green Gram', mr: 'हिरवा मूग' },
        { en: 'Whole Black Gram', mr: 'काळा उडीद' },
        { en: 'Sadha Chana (Desi Chana)', mr: 'साधा चणा' },
        { en: 'Kabuli Chana', mr: 'काबुली चणे' },
        { en: 'Matki', mr: 'मटकी' },
        { en: 'Vatana', mr: 'वाटाणा' },
        { en: 'Rajma', mr: 'राजमा' },
        { en: 'Cowpeas', mr: 'चवळी' }
      ]
    },
    '🥣 Poha, Puffed & Light Items': {
      color: 'bg-orange-50',
      items: [
        { en: 'Thick Poha', mr: 'जाड पोहे' },
        { en: 'Thin Poha', mr: 'पातळ पोहे' },
        { en: 'Medium Poha', mr: 'मध्यम पोहे' },
        { en: 'White Poha', mr: 'पांढरे पोहे' },
        { en: 'Red Poha', mr: 'लाल पोहे' },
        { en: 'Nylon Poha', mr: 'नायलॉन पोहे' },
        { en: 'Chivda Poha', mr: 'चिवड्याचे पोहे' },
        { en: 'Murmura (Puffed Rice)', mr: 'मुरमुरे' }
      ]
    },
    '🔱 Upvas / Fasting Items': {
      color: 'bg-purple-50',
      items: [
        { en: 'Bhagar / Sama Rice', mr: 'भगर / सामा तांदूळ' },
        { en: 'Vari Rice', mr: 'वरी तांदूळ' },
        { en: 'Rajgira Seeds', mr: 'राजगिरा' },
        { en: 'Rajgira Flour', mr: 'राजगिरा पीठ' },
        { en: 'Sabudana', mr: 'साबुदाणा' },
        { en: 'Sabudana Flour', mr: 'साबुदाणा पीठ' },
        { en: 'Singhada Flour', mr: 'शिंगाड्याचे पीठ' },
        { en: 'Groundnuts', mr: 'शेंगदाणे' },
        { en: 'Potato', mr: 'बटाटा' },
        { en: 'Sweet Potato', mr: 'रताळे' },
        { en: 'Rock Salt', mr: 'सैंधव मीठ' }
      ]
    },
    '🌶️ Spices (Whole & Powdered)': {
      color: 'bg-red-50',
      items: [
        { en: 'Salt', mr: 'मीठ' },
        { en: 'Turmeric', mr: 'हळद' },
        { en: 'Red Chilli Powder', mr: 'तिखट' },
        { en: 'Coriander Seeds', mr: 'धणे' },
        { en: 'Cumin Seeds', mr: 'जिरे' },
        { en: 'Mustard Seeds', mr: 'मोहरी' },
        { en: 'Black Pepper', mr: 'काळी मिरी' },
        { en: 'Cloves', mr: 'लवंग' },
        { en: 'Cinnamon', mr: 'दालचिनी' },
        { en: 'Green Cardamom', mr: 'हिरवी वेलची' },
        { en: 'Black Cardamom', mr: 'काळी वेलची' },
        { en: 'Bay Leaf', mr: 'तमालपत्र' },
        { en: 'Asafoetida (Hing)', mr: 'हिंग' },
        { en: 'Dry Ginger', mr: 'सुंठ' },
        { en: 'Fennel Seeds', mr: 'बडीशेप' },
        { en: 'Sesame Seeds', mr: 'तीळ' },
        { en: 'Poppy Seeds', mr: 'खसखस' },
        { en: 'Nutmeg', mr: 'जायफळ' },
        { en: 'Mace', mr: 'जावित्री' }
      ]
    },
    '🌶️ Ready Masalas': {
      color: 'bg-red-100',
      items: [
        { en: 'Garam Masala', mr: 'गरम मसाला' },
        { en: 'Goda Masala', mr: 'गोडा मसाला' },
        { en: 'Misal Masala', mr: 'मिसळ मसाला' },
        { en: 'Kolhapuri Masala', mr: 'कोल्हापुरी मसाला' },
        { en: 'Malvani Masala', mr: 'मालवणी मसाला' },
        { en: 'Pav Bhaji Masala', mr: 'पावभाजी मसाला' },
        { en: 'Chaat Masala', mr: 'चाट मसाला' },
        { en: 'Pani Puri Masala', mr: 'पाणीपुरी मसाला' },
        { en: 'Biryani Masala', mr: 'बिर्याणी मसाला' },
        { en: 'Pulav Masala', mr: 'पुलाव मसाला' },
        { en: 'Sambhar Masala', mr: 'सांबार मसाला' }
      ]
    },
    '🥣 Instant Mixes': {
      color: 'bg-orange-100',
      items: [
        { en: 'Upma Mix', mr: 'उपमा मिक्स' },
        { en: 'Poha Mix', mr: 'पोहे मिक्स' },
        { en: 'Idli Mix', mr: 'इडली मिक्स' },
        { en: 'Dosa Mix', mr: 'डोसा मिक्स' },
        { en: 'Medu Vada Mix', mr: 'मेदू वडा मिक्स' },
        { en: 'Dhokla Mix', mr: 'ढोकळा मिक्स' },
        { en: 'Gulab Jamun Mix', mr: 'गुलाबजाम मिक्स' },
        { en: 'Missal Ready Mix', mr: 'मिसळ रेडी मिक्स' }
      ]
    },
    '🧴 Oils, Sweeteners & Condiments': {
      color: 'bg-yellow-100',
      items: [
        { en: 'Groundnut Oil', mr: 'शेंगदाणा तेल' },
        { en: 'Coconut Oil', mr: 'नारळ तेल' },
        { en: 'Mustard Oil', mr: 'मोहरी तेल' },
        { en: 'Ghee', mr: 'तूप' },
        { en: 'Sugar', mr: 'साखर' },
        { en: 'Jaggery', mr: 'गूळ' },
        { en: 'Mishri', mr: 'खडीसाखर' },
        { en: 'Honey', mr: 'मध' },
        { en: 'Tamarind', mr: 'चिंच' },
        { en: 'Kokum', mr: 'कोकम' },
        { en: 'Tomato Ketchup', mr: 'टोमॅटो केचप' }
      ]
    },
    '☕ Tea, Coffee & Packaged': {
      color: 'bg-brown-50',
      items: [
        { en: 'Tea Powder', mr: 'चहा पावडर' },
        { en: 'Coffee Powder', mr: 'कॉफी पावडर' },
        { en: 'Green Tea', mr: 'ग्रीन टी' },
        { en: 'Biscuits', mr: 'बिस्किटे' },
        { en: 'Rusk', mr: 'टोस्ट बिस्किटे' }
      ]
    }
  },
  '🥕 MANDI (भाजी मंडई)': {
    '🧅 Vegetables': {
      color: 'bg-green-50',
      items: [
        { en: 'Onion', mr: 'कांदा' },
        { en: 'Potato', mr: 'बटाटा' },
        { en: 'Tomato', mr: 'टोमॅटो' },
        { en: 'Brinjal', mr: 'वांगी' },
        { en: 'Okra', mr: 'भेंडी' },
        { en: 'Tondle', mr: 'तोंडले' },
        { en: 'Kachchi Keli', mr: 'कच्ची केळी' },
        { en: 'Dhobli Mirchi', mr: 'ढोबळी मिरची' },
        { en: 'Gajar', mr: 'गाजर' },
        { en: 'Mula', mr: 'मुळा' },
        { en: 'Beetroot', mr: 'बीट' },
        { en: 'Pumpkin', mr: 'भोपळा' },
        { en: 'Sweet Corn', mr: 'मका' },
        { en: 'Green Peas', mr: 'हिरवे वाटाणे' }
      ]
    },
    '🌿 Leafy Vegetables': {
      color: 'bg-green-100',
      items: [
        { en: 'Kothimbir', mr: 'कोथिंबीर' },
        { en: 'Methi', mr: 'मेथी' },
        { en: 'Palak', mr: 'पालक' },
        { en: 'Shepu', mr: 'शेपू' },
        { en: 'Ambadi', mr: 'आंबाडी' },
        { en: 'Lal Bhaji', mr: 'लाल भाजी' }
      ]
    },
    '🍄 Mushrooms': {
      color: 'bg-gray-50',
      items: [
        { en: 'Button Mushroom', mr: 'मशरूम' },
        { en: 'Oyster Mushroom', mr: 'ऑइस्टर मशरूम' }
      ]
    },
    '🥦 Exotic Vegetables': {
      color: 'bg-lime-50',
      items: [
        { en: 'Broccoli', mr: 'ब्रोकोली' },
        { en: 'Zucchini', mr: 'झुकिनी' },
        { en: 'Baby Corn', mr: 'बेबी कॉर्न' },
        { en: 'Lettuce', mr: 'लेट्यूस' },
        { en: 'Cherry Tomatoes', mr: 'चेरी टोमॅटो' }
      ]
    },
    '🍎 Fruits': {
      color: 'bg-pink-50',
      items: [
        { en: 'Banana', mr: 'केळी' },
        { en: 'Apple', mr: 'सफरचंद' },
        { en: 'Mango', mr: 'आंबा' },
        { en: 'Orange', mr: 'संत्री' },
        { en: 'Pomegranate', mr: 'डाळिंब' },
        { en: 'Grapes', mr: 'द्राक्षे' },
        { en: 'Lemon', mr: 'लिंबू' },
        { en: 'Coconut', mr: 'नारळ' }
      ]
    }
  },
  '🍞 BAKERY & READY COOK': {
    '🍞 Bakery Items': {
      color: 'bg-amber-100',
      items: [
        { en: 'Bread', mr: 'ब्रेड' },
        { en: 'Brown Bread', mr: 'ब्राउन ब्रेड' },
        { en: 'Pav', mr: 'पाव' },
        { en: 'Bun', mr: 'बन' },
        { en: 'Pizza Base', mr: 'पिझ्झा बेस' },
        { en: 'Pasta', mr: 'पास्ता' },
        { en: 'Macaroni', mr: 'मॅकरोनी' },
        { en: 'Spaghetti', mr: 'स्पॅघेटी' },
        { en: 'Pizza Sauce', mr: 'पिझ्झा सॉस' },
        { en: 'Oregano', mr: 'ओरेगॅनो' },
        { en: 'Chilli Flakes', mr: 'चिली फ्लेक्स' },
        { en: 'Baking Soda', mr: 'खाण्याचा सोडा' },
        { en: 'Baking Powder', mr: 'बेकिंग पावडर' }
      ]
    }
  }
};

export const IndianPantryTemplate = ({ isOpen, onClose }) => {
  const [selectedItems, setSelectedItems] = useState({});
  const [expandedCategories, setExpandedCategories] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const { addItem } = useInventory();
  const [loading, setLoading] = useState(false);

  const toggleItemSelection = (mainCategory, subCategory, item) => {
    const key = `${mainCategory}::${subCategory}`;
    setSelectedItems(prev => {
      const categoryItems = prev[key] || [];
      const isSelected = categoryItems.some(i => i.en === item.en);
      
      return {
        ...prev,
        [key]: isSelected
          ? categoryItems.filter(i => i.en !== item.en)
          : [...categoryItems, item]
      };
    });
  };

  const toggleCategory = (mainCategory, subCategory) => {
    const key = `${mainCategory}::${subCategory}`;
    setExpandedCategories(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const getSelectedCount = (mainCategory, subCategory) => {
    const key = `${mainCategory}::${subCategory}`;
    return (selectedItems[key] || []).length;
  };

  const getTotalSelected = () => {
    return Object.values(selectedItems).reduce((sum, items) => sum + items.length, 0);
  };

  const handleAddToInventory = async () => {
    setLoading(true);
    try {
      const allSelectedItems = [];
      
      Object.entries(selectedItems).forEach(([key, items]) => {
        const [mainCategory] = key.split('::');
        items.forEach(item => {
          allSelectedItems.push({
            name_en: item.en,
            name_mr: item.mr,  // Include Marathi translation
            category: mainCategory.includes('GROCERY') ? 'grocery' : 
                     mainCategory.includes('MANDI') ? 'mandi' : 'bakery',
            stock_level: 'empty',
            unit: 'kg'
          });
        });
      });

      // Add all items
      for (const item of allSelectedItems) {
        await addItem(item);
      }

      alert(`Successfully added ${allSelectedItems.length} items to your inventory with Marathi translations!`);
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
      <DialogContent className="max-w-6xl max-h-[85vh] overflow-y-auto custom-scrollbar" data-testid="pantry-template-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl">
            <ChefHat className="w-8 h-8 text-[#FF9933]" />
            Indian Pantry Template (English - मराठी)
          </DialogTitle>
          <p className="text-gray-600 text-sm mt-2">
            Select items from grocery, mandi, and bakery categories to quickly setup your bilingual inventory
          </p>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {Object.entries(PANTRY_TEMPLATE).map(([mainCategory, subCategories]) => (
            <div key={mainCategory} className="space-y-3">
              <h2 className="text-xl font-bold text-gray-800 sticky top-0 bg-white py-2 z-10 border-b-2 border-[#FF9933]">
                {mainCategory}
              </h2>
              
              {Object.entries(subCategories).map(([subCategory, { color, items }]) => {
                const key = `${mainCategory}::${subCategory}`;
                const selectedCount = getSelectedCount(mainCategory, subCategory);
                const isExpanded = expandedCategories[key] ?? true;
                const displayItems = isExpanded ? items : items.slice(0, 8);
                const hasMore = items.length > 8;

                return (
                  <div 
                    key={subCategory}
                    className={`${color} rounded-2xl p-5 border border-gray-200 transition-all`}
                    data-testid={`category-${subCategory.replace(/\s+/g, '-')}`}
                  >
                    {/* Subcategory Header */}
                    <div 
                      className="flex items-center justify-between mb-4 cursor-pointer"
                      onClick={() => toggleCategory(mainCategory, subCategory)}
                    >
                      <div>
                        <h3 className="text-lg font-bold text-gray-800">{subCategory}</h3>
                        <p className="text-sm text-gray-600">
                          {selectedCount}/{items.length} Selected
                        </p>
                      </div>
                      <button className="text-gray-600 hover:text-gray-800">
                        <span className={`text-xl transform ${isExpanded ? 'rotate-180' : ''} inline-block transition-transform`}>
                          ∨
                        </span>
                      </button>
                    </div>

                    {/* Items Grid - Bilingual Display */}
                    {isExpanded && (
                      <div className="flex flex-wrap gap-2">
                        {displayItems.map((item, idx) => {
                          const isSelected = (selectedItems[key] || []).some(i => i.en === item.en);
                          
                          return (
                            <button
                              key={idx}
                              onClick={() => toggleItemSelection(mainCategory, subCategory, item)}
                              className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all hover-lift ${
                                isSelected
                                  ? 'bg-white border-2 border-[#77DD77] text-gray-800 shadow-md'
                                  : 'bg-white border border-gray-300 text-gray-700 hover:border-gray-400 hover:shadow-sm'
                              }`}
                              data-testid={`item-${item.en.toLowerCase().replace(/\s+/g, '-')}`}
                            >
                              <span className="flex items-center gap-2">
                                {isSelected && <Check className="w-4 h-4 text-[#77DD77] flex-shrink-0" />}
                                <span className="bilingual-text">
                                  {item.en} <span className="text-[#FF9933]">/</span> <span className="font-semibold">{item.mr}</span>
                                </span>
                              </span>
                            </button>
                          );
                        })}
                        
                        {hasMore && !isExpanded && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCategory(mainCategory, subCategory);
                            }}
                            className="px-4 py-2.5 rounded-full text-sm font-medium bg-white border border-gray-400 text-gray-700 hover:border-gray-500 hover:shadow-sm"
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
          ))}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-6 border-t mt-6 sticky bottom-0 bg-white">
          <div className="text-sm text-gray-600">
            <span className="font-bold text-[#FF9933] text-lg">{getTotalSelected()}</span> items selected
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="rounded-full border-2"
              data-testid="cancel-template-btn"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddToInventory}
              disabled={getTotalSelected() === 0 || loading}
              className="bg-[#FF9933] hover:bg-[#E68A2E] text-white rounded-full px-6 shadow-lg"
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
