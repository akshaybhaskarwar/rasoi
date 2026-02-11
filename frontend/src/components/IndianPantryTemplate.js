import { useState, useEffect } from 'react';
import { Check, ChefHat, Search, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useInventory } from '@/hooks/useRasoiSync';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const IndianPantryTemplate = ({ isOpen, onClose, existingInventory = [], onItemsAdded }) => {
  const [selectedItems, setSelectedItems] = useState({});
  const [expandedCategories, setExpandedCategories] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const { addItem } = useInventory();
  const [loading, setLoading] = useState(false);
  
  // Fetch template from API
  const [pantryTemplate, setPantryTemplate] = useState({});
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(true);
  const [templateError, setTemplateError] = useState(null);

  // Fetch pantry template from backend on mount
  useEffect(() => {
    const fetchTemplate = async () => {
      setIsLoadingTemplate(true);
      setTemplateError(null);
      try {
        const response = await fetch(`${API}/pantry-items/template`);
        if (!response.ok) throw new Error('Failed to fetch template');
        const data = await response.json();
        setPantryTemplate(data.template || {});
      } catch (error) {
        console.error('Error fetching pantry template:', error);
        setTemplateError('Failed to load pantry template. Please try again.');
      } finally {
        setIsLoadingTemplate(false);
      }
    };
    
    if (isOpen) {
      fetchTemplate();
    }
  }, [isOpen]);

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
    Object.values(pantryTemplate).forEach(subCategories => {
      Object.values(subCategories).forEach(({ items }) => {
        if (items) {
          count += items.filter(item => isItemInInventory(item.en)).length;
        }
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
    
    // Filter items by name (English, Marathi, or Hindi)
    return items.filter(item => 
      item.en.toLowerCase().includes(query) || 
      (item.mr && item.mr.includes(query)) ||
      (item.hi && item.hi.includes(query))
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
    Object.entries(pantryTemplate).forEach(([mainCategory, subCategories]) => {
      Object.entries(subCategories).forEach(([subCategory, { items }]) => {
        if (items) {
          const filtered = filterItemsBySearch(items, mainCategory, subCategory);
          count += filtered.length;
        }
      });
    });
    return count;
  };

  const handleAddToInventory = async () => {
    setLoading(true);
    try {
      const allSelectedItems = [];
      
      Object.entries(selectedItems).forEach(([key, items]) => {
        items.forEach(item => {
          // Use category and unit from API response
          allSelectedItems.push({
            name_en: item.en,
            name_mr: item.mr || '',
            name_hi: item.hi || '',
            category: item.category || 'other',
            stock_level: 'empty',
            unit: item.unit || 'kg'
          });
        });
      });

      // Add all items
      for (const item of allSelectedItems) {
        await addItem(item);
      }

      alert(`Successfully added ${allSelectedItems.length} items to your inventory with translations!`);
      setSelectedItems({});
      
      // Notify parent to refresh inventory
      if (onItemsAdded) {
        onItemsAdded();
      }
      
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
            Indian Pantry Template (English - मराठी - हिन्दी)
          </DialogTitle>
          <p className="text-gray-600 text-sm mt-2">
            Select items from grocery, mandi, and bakery categories to quickly setup your bilingual inventory
          </p>
        </DialogHeader>

        {/* Loading State */}
        {isLoadingTemplate ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-10 h-10 text-[#FF9933] animate-spin mb-4" />
            <p className="text-gray-600">Loading pantry items...</p>
          </div>
        ) : templateError ? (
          <div className="text-center py-12">
            <p className="text-red-600 mb-4">{templateError}</p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </div>
        ) : (
          <>
            {/* Search Bar */}
            <div className="sticky top-0 bg-white z-20 py-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search items or categories... (e.g., Bakery, Bread, Rice, बासमती, गुड़)"
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
              {Object.entries(pantryTemplate).map(([mainCategory, subCategories]) => {
                // Filter subcategories based on search
                const visibleSubCategories = Object.entries(subCategories).filter(([subCategory, data]) => {
                  const items = data?.items || [];
                  return shouldShowCategory(mainCategory, subCategory, items);
                });
                
                if (visibleSubCategories.length === 0) return null;
                
                return (
                  <div key={mainCategory} className="space-y-3">
                    <h2 className="text-xl font-bold text-gray-800 sticky top-20 bg-white py-2 z-10 border-b-2 border-[#FF9933]">
                      {mainCategory}
                    </h2>
                    
                    {visibleSubCategories.map(([subCategory, data]) => {
                      const { color, items: rawItems } = data || {};
                      const items = rawItems || [];
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
                          className={`${color || 'bg-gray-50'} rounded-2xl p-5 border border-gray-200 transition-all`}
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
                                        {item.en} <span className="text-[#FF9933]">/</span> <span className="font-semibold">{item.mr || item.hi}</span>
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
