import { useState, useEffect } from 'react';
import { X, Calendar, Clock, Users, Check, ChefHat, Loader2, Youtube, Package, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AddToPlannerModal = ({ 
  isOpen, 
  onClose, 
  video, 
  matchedIngredients = [],
  onSuccess 
}) => {
  // State
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [prepData, setPrepData] = useState(null);
  
  // Selection state
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedMealSlot, setSelectedMealSlot] = useState('dinner');
  const [selectedServingSize, setSelectedServingSize] = useState('family_4');
  const [selectedIngredients, setSelectedIngredients] = useState({});

  // Fetch preparation data when modal opens
  useEffect(() => {
    if (isOpen && video) {
      fetchPrepData();
    }
  }, [isOpen, video]);

  const fetchPrepData = async () => {
    setIsLoading(true);
    try {
      const response = await axios.post(`${API}/meal-plans/prepare`, {
        video_id: video.video_id,
        video_title: video.title,
        video_thumbnail: video.thumbnail,
        channel_name: video.channel || video.channel_name || '',
        matched_ingredients: matchedIngredients,
        is_user_recipe: video.is_user_recipe || false
      });
      
      setPrepData(response.data);
      
      // Set initial selections
      const today = response.data.week_dates?.find(d => d.is_today);
      if (today) setSelectedDate(today.date);
      
      // Pre-select in-stock ingredients
      const initialSelection = {};
      response.data.ingredient_options?.forEach(ing => {
        initialSelection[ing.ingredient_name] = ing.selected;
      });
      setSelectedIngredients(initialSelection);
      
    } catch (error) {
      console.error('Failed to prepare meal plan:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleIngredient = (ingredientName) => {
    setSelectedIngredients(prev => ({
      ...prev,
      [ingredientName]: !prev[ingredientName]
    }));
  };

  const handleSubmit = async () => {
    if (!selectedDate || !selectedMealSlot) return;
    
    setIsSubmitting(true);
    try {
      // Build reserved ingredients list
      const reservedIngredients = [];
      prepData?.ingredient_options?.forEach(ing => {
        if (selectedIngredients[ing.ingredient_name] && ing.item_id) {
          const qty = ing.quantities[selectedServingSize];
          reservedIngredients.push({
            item_id: ing.item_id,
            item_name: ing.ingredient_name,
            est_qty: qty.qty,
            unit: qty.unit
          });
        }
      });
      
      // Build the meal plan data
      const mealPlanData = {
        date: selectedDate,
        meal_type: selectedMealSlot,
        meal_name: video.title,
        ingredients_needed: matchedIngredients,
        reserved_ingredients: reservedIngredients,
        serving_size: selectedServingSize
      };
      
      // Add YouTube or user recipe specific fields
      if (video.is_user_recipe) {
        mealPlanData.user_recipe_id = video.video_id;
        mealPlanData.recipe_source = 'user_recipe';
        mealPlanData.recipe_thumbnail = video.thumbnail;
        mealPlanData.recipe_chef = video.channel;
      } else {
        mealPlanData.youtube_video_id = video.video_id;
        mealPlanData.youtube_thumbnail = video.thumbnail;
        mealPlanData.youtube_channel = video.channel || video.channel_name;
        mealPlanData.recipe_source = 'youtube';
      }
      
      await axios.post(`${API}/meal-plans`, mealPlanData);
      
      // Find day name for success message
      const dayInfo = prepData?.week_dates?.find(d => d.date === selectedDate);
      const dayName = dayInfo?.day_name || 'Selected Day';
      
      onSuccess?.({ date: selectedDate, dayName, mealSlot: selectedMealSlot });
      onClose();
      
    } catch (error) {
      console.error('Failed to add to planner:', error);
      alert('Failed to add to planner. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal - Bottom sheet on mobile, centered modal on desktop */}
      <div className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[85vh] sm:max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom duration-300 mb-0 sm:mb-0">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-[#FF9933] to-[#138808] rounded-xl flex items-center justify-center">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-sm sm:text-base">Add to Meal Plan</h2>
              <p className="text-[10px] sm:text-xs text-gray-500">Schedule this recipe</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        
        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)] p-6 space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-[#FF9933] animate-spin mb-3" />
              <p className="text-sm text-gray-500">Preparing your meal plan...</p>
            </div>
          ) : (
            <>
              {/* Video Preview */}
              <div className="flex gap-4 p-4 bg-gray-50 rounded-xl">
                <img 
                  src={video.thumbnail} 
                  alt={video.title}
                  className="w-24 h-16 object-cover rounded-lg"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-sm line-clamp-2">
                    {video.title}
                  </h3>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                    {video.is_user_recipe ? (
                      <>
                        <ChefHat className="w-3 h-3 text-orange-500" />
                        {video.channel || 'Family Recipe'}
                      </>
                    ) : (
                      <>
                        <Youtube className="w-3 h-3 text-red-500" />
                        {video.channel || video.channel_name || 'YouTube'}
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Day Picker - Week View */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#FF9933]" />
                  Select Day
                </label>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {prepData?.week_dates?.map((day) => (
                    <button
                      key={day.date}
                      onClick={() => setSelectedDate(day.date)}
                      className={`flex-shrink-0 w-14 h-16 rounded-xl flex flex-col items-center justify-center transition-all ${
                        selectedDate === day.date
                          ? 'bg-[#138808] text-white shadow-lg scale-105'
                          : day.is_today
                          ? 'bg-orange-50 border-2 border-orange-300 text-orange-700'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <span className="text-xs font-medium">{day.day_name}</span>
                      <span className="text-lg font-bold">{day.day_num}</span>
                      {day.is_today && (
                        <span className="text-[10px] font-medium">Today</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Meal Slot Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#FF9933]" />
                  Meal Slot
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {prepData?.meal_slots?.map((slot) => (
                    <button
                      key={slot.key}
                      onClick={() => setSelectedMealSlot(slot.key)}
                      className={`py-3 px-2 rounded-xl text-sm font-medium transition-all ${
                        selectedMealSlot === slot.key
                          ? 'bg-[#FF9933] text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {slot.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Serving Size */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#FF9933]" />
                  Serving Size
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {prepData?.serving_sizes?.map((size) => (
                    <button
                      key={size.key}
                      onClick={() => setSelectedServingSize(size.key)}
                      className={`py-3 px-4 rounded-xl text-sm font-medium transition-all text-left ${
                        selectedServingSize === size.key
                          ? 'bg-purple-500 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {size.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ingredient Confirmation */}
              {prepData?.ingredient_options?.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Package className="w-4 h-4 text-[#FF9933]" />
                    Reserve Ingredients
                    <span className="text-xs font-normal text-gray-400 ml-1">
                      (uncheck what you won't use)
                    </span>
                  </label>
                  <div className="space-y-2 max-h-48 overflow-y-auto p-3 bg-gray-50 rounded-xl">
                    {prepData.ingredient_options.map((ing) => {
                      const qty = ing.quantities[selectedServingSize];
                      const isSelected = selectedIngredients[ing.ingredient_name];
                      
                      return (
                        <div 
                          key={ing.ingredient_name}
                          className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                            isSelected ? 'bg-white border border-green-200' : 'bg-gray-100'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleIngredient(ing.ingredient_name)}
                              className="data-[state=checked]:bg-[#138808] data-[state=checked]:border-[#138808]"
                            />
                            <div>
                              <span className={`font-medium text-sm ${isSelected ? 'text-gray-900' : 'text-gray-500'}`}>
                                {ing.ingredient_name}
                              </span>
                              {!ing.in_stock && (
                                <Badge variant="outline" className="ml-2 text-[10px] py-0 text-orange-600 border-orange-300">
                                  <AlertCircle className="w-2.5 h-2.5 mr-1" />
                                  Not in stock
                                </Badge>
                              )}
                            </div>
                          </div>
                          <span className={`text-sm font-medium ${isSelected ? 'text-[#138808]' : 'text-gray-400'}`}>
                            {qty?.qty}{qty?.unit}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Selected items will be marked as "Reserved" in your inventory
                  </p>
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Footer */}
        {!isLoading && (
          <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4">
            <Button
              onClick={handleSubmit}
              disabled={!selectedDate || !selectedMealSlot || isSubmitting}
              className="w-full py-6 bg-gradient-to-r from-[#FF9933] to-[#138808] hover:from-[#E68A2E] hover:to-[#0d6606] text-white font-semibold rounded-xl shadow-lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Adding to Plan...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5 mr-2" />
                  Add to {selectedMealSlot.charAt(0).toUpperCase() + selectedMealSlot.slice(1)} Plan
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddToPlannerModal;
