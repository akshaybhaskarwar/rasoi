import { useGapAnalysis, useShoppingList } from '@/hooks/useRasoiSync';
import { useLanguage } from '@/contexts/LanguageContext';
import { AlertTriangle, ChevronDown, ChevronUp, ShoppingCart, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export const GapAnalysisSidebar = ({ isMobile = false }) => {
  const { analysis, loading } = useGapAnalysis();
  const { shoppingList, addItem } = useShoppingList();
  const [isExpanded, setIsExpanded] = useState(!isMobile);
  const [adding, setAdding] = useState(false);
  const navigate = useNavigate();
  const { getLabel } = useLanguage();

  if (loading || !analysis || analysis.missing_ingredients.length === 0) {
    return null;
  }

  // Group missing ingredients by date
  const groupedByDate = analysis.missing_ingredients.reduce((acc, item) => {
    if (!acc[item.date]) acc[item.date] = [];
    acc[item.date].push(item);
    return acc;
  }, {});

  // Add all missing ingredients to shopping list
  const handleAddToShoppingList = async () => {
    setAdding(true);
    let addedCount = 0;
    
    try {
      for (const item of analysis.missing_ingredients) {
        // Check if already in shopping list
        const alreadyInList = shoppingList.some(
          shopItem => shopItem.name_en?.toLowerCase() === item.ingredient?.toLowerCase()
        );
        
        if (!alreadyInList) {
          await addItem({
            name_en: item.ingredient,
            category: 'other',
            quantity: '-',
            monthly_quantity: '1 kg',
            store_type: 'grocery',
            source: 'gap-analysis'
          });
          addedCount++;
        }
      }
      
      if (addedCount > 0) {
        toast.success(`Added ${addedCount} items to shopping list`);
      } else {
        toast.info('All items already in shopping list');
      }
      
      // Navigate to shopping page
      navigate('/shopping');
    } catch (error) {
      console.error('Error adding items:', error);
      toast.error('Failed to add some items');
    } finally {
      setAdding(false);
    }
  };

  // Mobile collapsible card
  if (isMobile) {
    return (
      <Card 
        className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 shadow-md"
        data-testid="gap-analysis-mobile"
      >
        <CardContent className="p-4">
          <div 
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setIsExpanded(!isExpanded)}
            data-testid="gap-analysis-toggle"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#FF9933] to-[#FFCC00] rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  {getLabel('gapAnalysis')}
                  <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                    {analysis.missing_ingredients.length}
                  </span>
                </h3>
                <p className="text-xs text-gray-600">{getLabel('missingIngredientsForMeals')}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm">
              {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </Button>
          </div>

          {isExpanded && (
            <div className="mt-4 pt-4 border-t border-amber-200 space-y-3" data-testid="gap-analysis-content">
              {Object.entries(groupedByDate).slice(0, 3).map(([date, items]) => (
                <div key={date} className="bg-white rounded-lg p-3 border border-amber-100">
                  <p className="text-xs font-semibold text-gray-600 mb-2">
                    {new Date(date).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {items.map((item, idx) => (
                      <span 
                        key={idx}
                        className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded-full border border-red-200"
                      >
                        {item.ingredient}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              
              <Button
                onClick={() => navigate('/shopping')}
                className="w-full bg-[#FF9933] hover:bg-[#E68A2E] text-white mt-2"
                data-testid="add-to-shopping-btn"
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                Add to Shopping List
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Desktop sidebar (existing design)
  return (
    <Card 
      className="bg-white border-l-4 border-[#FF9933] shadow-lg"
      data-testid="gap-analysis-sidebar"
    >
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-[#FF9933]" />
          <h3 className="font-bold text-lg text-gray-800">{getLabel('missingIngredients')}</h3>
        </div>

        <div className="space-y-3">
          {analysis.missing_ingredients.map((item, index) => (
            <div 
              key={index}
              className="p-3 bg-[#FFFBF0] rounded-lg border border-[#FFCC00]/30"
              data-testid={`missing-item-${index}`}
            >
              <p className="font-medium text-gray-800 text-sm mb-1">{item.ingredient}</p>
              <p className="text-xs text-gray-600">
                {getLabel('forMeal')}: <span className="font-medium">{item.meal}</span>
              </p>
              <p className="text-xs text-gray-500">
                {getLabel('onDate')}: {new Date(item.date).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}
              </p>
            </div>
          ))}
        </div>
        
        <Button
          onClick={() => navigate('/shopping')}
          className="w-full bg-[#FF9933] hover:bg-[#E68A2E] text-white mt-4"
          data-testid="desktop-add-to-shopping-btn"
        >
          <ShoppingCart className="w-4 h-4 mr-2" />
          {getLabel('addToShoppingList')}
        </Button>
      </CardContent>
    </Card>
  );
};
