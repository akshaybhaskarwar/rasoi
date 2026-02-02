import { useState } from 'react';
import { Check, ChefHat, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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
        { en: 'Gram Flour', mr: 'बेसन' },
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
        { en: 'Cowpeas Big', mr: 'चवळी मोठी' },
        { en: 'Cowpeas Small', mr: 'चवळी बारीक' }
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
        { en: 'Mace', mr: 'जावित्री' },
        { en: 'Dhana Daal', mr: 'धना डाळ' }
        
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
        { en: 'Yelakki Banana', mr: 'इलायची केळी' },
        { en: 'Apple', mr: 'सफरचंद' },
        { en: 'Mango', mr: 'आंबा' },
        { en: 'Orange', mr: 'संत्री' },
        { en: 'Pomegranate', mr: 'डाळिंब' },
        { en: 'Grapes', mr: 'द्राक्षे' },
        { en: 'Lemon', mr: 'लिंबू' },
        { en: 'Chiku (Sapota)', mr: 'चिकू' },
        { en: 'Custard Apple', mr: 'सीताफळ' },
        { en: 'Jackfruit', mr: 'फणस' },
        { en: 'Watermelon', mr: 'कलिंगड' },
        { en: 'Muskmelon', mr: 'खरबूज' },
        { en: 'Pineapple', mr: 'अननस' },
        { en: 'Strawberry', mr: 'स्ट्रॉबेरी' },
        { en: 'Jamun', mr: 'जांभूळ' },
        { en: 'Fig (Fresh)', mr: 'अंजीर' },
        { en: 'Blueberry', mr: 'ब्लूबेरी' },
        { en: 'Peach', mr: 'पीच' },
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
  },
  '🧹 CLEANING & HOUSEHOLD (सफाई)': {
    '🧼 Dish & Laundry Cleaning': {
      color: 'bg-blue-50',
      items: [
        { en: 'Dish Soap', mr: 'भांडी साबण' },
        { en: 'Dishwashing Liquid (Vim)', mr: 'विम बार / लिक्विड' },
        { en: 'Dishwashing Bar', mr: 'भांडी धुण्याची बार' },
        { en: 'Scrubber / Scotch-Brite', mr: 'स्क्रबर' },
        { en: 'Steel Wool', mr: 'लोखंडी जाळी' },
        { en: 'Cloth Soap', mr: 'कपडे धुण्याचा साबण' },
        { en: 'Detergent Powder', mr: 'डिटर्जंट पावडर' },
        { en: 'Detergent (Rin)', mr: 'रिन' },
        { en: 'Detergent (Surf Excel)', mr: 'सर्फ एक्सेल' },
        { en: 'Fabric Softener', mr: 'फॅब्रिक सॉफ्टनर' },
        { en: 'Fabric Whitener (Ujala)', mr: 'उजाला' },
        { en: 'Odopic', mr: 'ओडोपिक' }
      ]
    },
    '🚿 Personal Care & Bath': {
      color: 'bg-cyan-50',
      items: [
        { en: 'Bath Soap', mr: 'आंघोळीचा साबण' },
        { en: 'Handwash', mr: 'हँडवॉश' },
        { en: 'Shampoo', mr: 'शाम्पू' },
        { en: 'Conditioner', mr: 'कंडिशनर' },
        { en: 'Body Oil', mr: 'अंगाला लावायचे तेल' },
        { en: 'Hair Oil', mr: 'केसांचे तेल' },
        { en: 'Coconut Oil (Body)', mr: 'खोबरेल तेल' },
        { en: 'Body Lotion', mr: 'बॉडी लोशन' },
        { en: 'Face Wash', mr: 'फेस वॉश' },
        { en: 'Toothpaste', mr: 'टूथपेस्ट' },
        { en: 'Toothbrush', mr: 'टूथब्रश' }
      ]
    },
    '🚽 Bathroom & Floor Cleaning': {
      color: 'bg-teal-50',
      items: [
        { en: 'Bathroom Cleaner', mr: 'बाथरूम क्लीनर' },
        { en: 'Harpic', mr: 'हार्पिक' },
        { en: 'Floor Cleaner', mr: 'फ्लोर क्लीनर' },
        { en: 'Phenyl', mr: 'फिनाइल' },
        { en: 'Lizol', mr: 'लिझॉल' },
        { en: 'Toilet Cleaner Brush', mr: 'टॉयलेट ब्रश' },
        { en: 'Mop', mr: 'पोछा' },
        { en: 'Broom', mr: 'झाडू' },
        { en: 'Dustpan', mr: 'कचरा उचलणारे' }
      ]
    },
    '✨ Other Household Essentials': {
      color: 'bg-indigo-50',
      items: [
        { en: 'Glass Cleaner (Colin)', mr: 'कॉलिन' },
        { en: 'Surface Cleaner', mr: 'सर्फेस क्लीनर' },
        { en: 'Air Freshener', mr: 'एअर फ्रेशनर' },
        { en: 'Insect Killer Spray', mr: 'कीटकनाशक स्प्रे' },
        { en: 'Mosquito Repellent', mr: 'मच्छर अगरबत्ती' },
        { en: 'Matchsticks', mr: 'काडेपेटी' },
        { en: 'Candles', mr: 'मेणबत्ती' },
        { en: 'Garbage Bags', mr: 'कचरा पिशव्या' },
        { en: 'Aluminum Foil', mr: 'अल्युमिनियम फॉइल' },
        { en: 'Cling Wrap', mr: 'क्लिंग रॅप' },
        { en: 'Paper Napkins', mr: 'पेपर नॅपकिन' },
        { en: 'Tissues', mr: 'टिश्यू पेपर' }
      ]
    }
  }
};

export const IndianPantryTemplate = ({ isOpen, onClose, existingInventory = [] }) => {
  const [selectedItems, setSelectedItems] = useState({});
  const [expandedCategories, setExpandedCategories] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const { addItem } = useInventory();
  const [loading, setLoading] = useState(false);

  // Create a set of existing item names (normalized) for quick lookup
  const existingItemNames = new Set(
    existingInventory.map(item => item.name_en?.toLowerCase().trim())
  );

  // Check if an item already exists in inventory
  const isItemInInventory = (itemName) => {
    return existingItemNames.has(itemName.toLowerCase().trim());
  };

  const toggleItemSelection = (mainCategory, subCategory, item) => {
    // Don't allow selection if item already exists in inventory
    if (isItemInInventory(item.en)) return;
    
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

  // Count items already in inventory for a category
  const getAlreadyAddedCount = (items) => {
    return items.filter(item => isItemInInventory(item.en)).length;
  };

  const getTotalSelected = () => {
    return Object.values(selectedItems).reduce((sum, items) => sum + items.length, 0);
  };

  // Get total items already in inventory
  const getTotalAlreadyAdded = () => {
    let count = 0;
    Object.values(PANTRY_TEMPLATE).forEach(subCategories => {
      Object.values(subCategories).forEach(({ items }) => {
        count += items.filter(item => isItemInInventory(item.en)).length;
      });
    });
    return count;
  };

  // Search filter logic
  const filterItemsBySearch = (items, mainCategory, subCategory) => {
    if (!searchQuery.trim()) return items;
    
    const query = searchQuery.toLowerCase();
    
    // Check if search matches category names
    const matchesMainCategory = mainCategory.toLowerCase().includes(query);
    const matchesSubCategory = subCategory.toLowerCase().includes(query);
    
    if (matchesMainCategory || matchesSubCategory) {
      return items; // Show all items if category matches
    }
    
    // Filter items by name (English or Marathi)
    return items.filter(item => 
      item.en.toLowerCase().includes(query) || 
      item.mr.includes(query)
    );
  };

  // Check if category should be visible
  const shouldShowCategory = (mainCategory, subCategory, items) => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    const matchesMainCategory = mainCategory.toLowerCase().includes(query);
    const matchesSubCategory = subCategory.toLowerCase().includes(query);
    
    if (matchesMainCategory || matchesSubCategory) return true;
    
    // Check if any items match
    const filteredItems = filterItemsBySearch(items, mainCategory, subCategory);
    return filteredItems.length > 0;
  };

  const getSearchResultsCount = () => {
    if (!searchQuery.trim()) return null;
    
    let count = 0;
    Object.entries(PANTRY_TEMPLATE).forEach(([mainCategory, subCategories]) => {
      Object.entries(subCategories).forEach(([subCategory, { items }]) => {
        const filtered = filterItemsBySearch(items, mainCategory, subCategory);
        count += filtered.length;
      });
    });
    return count;
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

        {/* Search Bar */}
        <div className="sticky top-0 bg-white z-20 py-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search items or categories... (e.g., Bakery, Bread, Rice, बासमती)"
              className="pl-10 pr-10 h-12 text-base border-2 border-gray-300 focus:border-[#FF9933]"
              data-testid="template-search-input"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                data-testid="clear-search-btn"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          {searchQuery && (
            <div className="mt-2 text-sm text-gray-600">
              Found <span className="font-bold text-[#FF9933]">{getSearchResultsCount()}</span> items matching &quot;{searchQuery}&quot;
            </div>
          )}
        </div>

        <div className="space-y-6 mt-4">
          {Object.entries(PANTRY_TEMPLATE).map(([mainCategory, subCategories]) => {
            // Filter subcategories based on search
            const visibleSubCategories = Object.entries(subCategories).filter(([subCategory, { items }]) => 
              shouldShowCategory(mainCategory, subCategory, items)
            );
            
            if (visibleSubCategories.length === 0) return null;
            
            return (
              <div key={mainCategory} className="space-y-3">
                <h2 className="text-xl font-bold text-gray-800 sticky top-20 bg-white py-2 z-10 border-b-2 border-[#FF9933]">
                  {mainCategory}
                </h2>
                
                {visibleSubCategories.map(([subCategory, { color, items }]) => {
                  const key = `${mainCategory}::${subCategory}`;
                  const selectedCount = getSelectedCount(mainCategory, subCategory);
                  const isExpanded = expandedCategories[key] ?? true;
                  
                  // Filter items based on search
                  const filteredItems = filterItemsBySearch(items, mainCategory, subCategory);
                  const displayItems = isExpanded ? filteredItems : filteredItems.slice(0, 8);
                  const hasMore = filteredItems.length > 8;

                  if (filteredItems.length === 0) return null;

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
                            {selectedCount > 0 && (
                              <span className="text-[#FF9933] font-medium">{selectedCount} new selected</span>
                            )}
                            {getAlreadyAddedCount(items) > 0 && (
                              <span className="text-green-600 ml-2">
                                • {getAlreadyAddedCount(items)} already in inventory
                              </span>
                            )}
                            {searchQuery && filteredItems.length < items.length && (
                              <span className="text-gray-500 ml-2">
                                • {filteredItems.length} matching
                              </span>
                            )}
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
                            const alreadyInInventory = isItemInInventory(item.en);
                            
                            return (
                              <button
                                key={idx}
                                onClick={() => toggleItemSelection(mainCategory, subCategory, item)}
                                disabled={alreadyInInventory}
                                className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
                                  alreadyInInventory
                                    ? 'bg-green-100 border-2 border-green-400 text-green-700 cursor-not-allowed opacity-80'
                                    : isSelected
                                      ? 'bg-white border-2 border-[#77DD77] text-gray-800 shadow-md hover-lift'
                                      : 'bg-white border border-gray-300 text-gray-700 hover:border-gray-400 hover:shadow-sm hover-lift'
                                }`}
                                data-testid={`item-${item.en.toLowerCase().replace(/\s+/g, '-')}`}
                              >
                                <span className="flex items-center gap-2">
                                  {alreadyInInventory ? (
                                    <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                                  ) : isSelected ? (
                                    <Check className="w-4 h-4 text-[#77DD77] flex-shrink-0" />
                                  ) : null}
                                  <span className="bilingual-text">
                                    {item.en} <span className="text-[#FF9933]">/</span> <span className="font-semibold">{item.mr}</span>
                                  </span>
                                  {alreadyInInventory && (
                                    <span className="text-xs text-green-600 ml-1">(Added)</span>
                                  )}
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
                              +{filteredItems.length - 8} More
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
          
          {/* No Results Message */}
          {searchQuery && getSearchResultsCount() === 0 && (
            <div className="text-center py-12">
              <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 text-lg mb-2">No items found</p>
              <p className="text-gray-500 text-sm">Try searching with different keywords</p>
              <Button
                onClick={() => setSearchQuery('')}
                variant="outline"
                className="mt-4"
              >
                Clear Search
              </Button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-6 border-t mt-6 sticky bottom-0 bg-white">
          <div className="text-sm text-gray-600 space-y-1">
            <div>
              <span className="font-bold text-[#FF9933] text-lg">{getTotalSelected()}</span> new items selected
            </div>
            {getTotalAlreadyAdded() > 0 && (
              <div className="text-green-600 text-xs">
                ✓ {getTotalAlreadyAdded()} items already in your inventory
              </div>
            )}
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
