import { useFestivalAlert, useShoppingList } from '@/hooks/useRasoiSync';
import { Sparkles, Plus, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const DigitalDadiWidget = () => {
  const { alert, loading } = useFestivalAlert();
  const { addItem } = useShoppingList();

  if (loading || !alert) {
    return null;
  }

  const handleAddToList = async () => {
    try {
      for (const ingredient of alert.ingredients_needed) {
        await addItem({
          name_en: ingredient,
          category: 'festival',
          quantity: '1 unit',
          store_type: 'grocery'
        });
      }
      alert('Added to shopping list!');
    } catch (error) {
      console.error('Error adding to list:', error);
    }
  };

  return (
    <Card 
      className="bg-gradient-to-br from-[#FFFBF0] to-white border-[#FFCC00]/30 shadow-md hover:shadow-lg transition-all animate-slide-in"
      data-testid="digital-dadi-widget"
    >
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          {/* Dadi Avatar */}
          <div className="flex-shrink-0">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#FF9933]">
              <img 
                src="https://images.unsplash.com/photo-1590905775253-a4f0f3c426ff?crop=entropy&cs=srgb&fm=jpg&q=85"
                alt="Digital Dadi"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-[#FFCC00]" />
              <h3 className="font-bold text-lg text-gray-800">{alert.name}</h3>
            </div>

            <p className="text-gray-700 mb-4 leading-relaxed">
              {alert.message}
            </p>

            {/* Ingredients Status */}
            <div className="space-y-2 mb-4">
              {alert.ingredients_in_stock.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-sm font-medium text-[#77DD77]">✓ In Stock:</span>
                  <span className="text-sm text-gray-600">
                    {alert.ingredients_in_stock.join(', ')}
                  </span>
                </div>
              )}
              
              {alert.ingredients_needed.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-sm font-medium text-[#FF9933]">⚠ Need:</span>
                  <span className="text-sm text-gray-600">
                    {alert.ingredients_needed.join(', ')}
                  </span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              {alert.ingredients_needed.length > 0 && (
                <Button 
                  onClick={handleAddToList}
                  className="bg-[#FF9933] hover:bg-[#E68A2E] text-white rounded-full"
                  data-testid="add-to-list-btn"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add to List
                </Button>
              )}
              <Button 
                variant="outline"
                className="border-[#FF9933] text-[#FF9933] hover:bg-[#FFFBF0] rounded-full"
                data-testid="view-recipe-btn"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View Recipes
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
