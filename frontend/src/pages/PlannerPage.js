import { useState, useEffect } from 'react';
import { useMealPlanner, useRecipes, useInventory, useFavoriteChannels } from '@/hooks/useRasoiSync';
import { Plus, Calendar as CalendarIcon, Trash2, Search, ChefHat, X, Play, ExternalLink, Star, ChevronDown, ChevronUp, Youtube } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

const MEAL_TYPES = [
  { value: 'breakfast', label: '🌅 Breakfast', color: 'bg-yellow-50 border-yellow-200' },
  { value: 'lunch', label: '🌞 Lunch', color: 'bg-orange-50 border-orange-200' },
  { value: 'snacks', label: '☕ Evening Snacks', color: 'bg-pink-50 border-pink-200' },
  { value: 'dinner', label: '🌙 Dinner', color: 'bg-indigo-50 border-indigo-200' }
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const PlannerPage = () => {
  const { mealPlans, addMealPlan, deleteMealPlan } = useMealPlanner();
  const { searchYouTube } = useRecipes();
  const { inventory } = useInventory();
  const { favoriteChannels, addFavoriteChannel, removeFavoriteChannel } = useFavoriteChannels();
  
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedMealType, setSelectedMealType] = useState('');
  const [selectedIngredients, setSelectedIngredients] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [isRecipeDialogOpen, setIsRecipeDialogOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [previewVideo, setPreviewVideo] = useState(null);
  
  // Favorite channels state
  const [isFavoritesExpanded, setIsFavoritesExpanded] = useState(false);
  const [newChannelInput, setNewChannelInput] = useState('');

  // Get dates for next 7 days
  const getWeekDates = () => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      dates.push({
        dateStr: date.toISOString().split('T')[0],
        day: DAYS[date.getDay()],
        displayDate: date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
      });
    }
    return dates;
  };

  const weekDates = getWeekDates();

  // Get meals for specific date and type
  const getMealsForSlot = (date, mealType) => {
    return mealPlans.filter(plan => plan.date === date && plan.meal_type === mealType);
  };

  // Toggle ingredient selection
  const toggleIngredient = (ingredientName) => {
    setSelectedIngredients(prev => 
      prev.includes(ingredientName)
        ? prev.filter(i => i !== ingredientName)
        : [...prev, ingredientName]
    );
  };

  // Search recipes based on selected ingredients
  const handleSearchRecipes = async () => {
    if (selectedIngredients.length === 0) {
      alert('Please select at least one ingredient');
      return;
    }

    setSearching(true);
    try {
      const query = selectedIngredients.join(' ');
      const results = await searchYouTube(query, 8);
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      alert('Failed to search recipes');
    } finally {
      setSearching(false);
    }
  };

  // Add recipe to meal plan
  const handleAddRecipe = async (video) => {
    if (!selectedDate || !selectedMealType) {
      alert('Please select date and meal type first');
      return;
    }

    try {
      await addMealPlan({
        date: selectedDate,
        meal_type: selectedMealType,
        meal_name: video.title,
        youtube_video_id: video.video_id,
        ingredients_needed: selectedIngredients
      });

      // Reset selections
      setSelectedIngredients([]);
      setSearchResults([]);
      setIsRecipeDialogOpen(false);
      setSelectedDate('');
      setSelectedMealType('');
    } catch (error) {
      console.error('Error adding recipe:', error);
      alert('Failed to add recipe to meal plan');
    }
  };

  // Open recipe finder
  const openRecipeFinder = (date, mealType) => {
    setSelectedDate(date);
    setSelectedMealType(mealType);
    setIsRecipeDialogOpen(true);
  };

  return (
    <div className="container mx-auto px-4 py-6 pb-24 md:pb-6 space-y-6" data-testid="planner-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Meal Planner</h1>
          <p className="text-gray-600 text-sm mt-1">Plan your weekly meals with recipes</p>
        </div>
      </div>

      {/* Weekly Calendar Grid */}
      <div className="space-y-4">
        {weekDates.map((dateInfo) => (
          <Card key={dateInfo.dateStr} className="shadow-sm" data-testid={`date-card-${dateInfo.dateStr}`}>
            <CardContent className="p-6">
              {/* Date Header */}
              <div className="mb-4 pb-3 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">{dateInfo.day}</h3>
                    <p className="text-sm text-gray-600">{dateInfo.displayDate}</p>
                  </div>
                </div>
              </div>

              {/* 4 Meal Sections */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {MEAL_TYPES.map((mealType) => {
                  const meals = getMealsForSlot(dateInfo.dateStr, mealType.value);
                  
                  return (
                    <div 
                      key={mealType.value}
                      className={`${mealType.color} rounded-xl p-4 border-2 min-h-[200px]`}
                      data-testid={`meal-slot-${dateInfo.dateStr}-${mealType.value}`}
                    >
                      {/* Meal Type Header */}
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-bold text-sm text-gray-800">{mealType.label}</h4>
                        <Button
                          size="sm"
                          onClick={() => openRecipeFinder(dateInfo.dateStr, mealType.value)}
                          className="h-7 px-2 bg-[#FF9933] hover:bg-[#E68A2E] text-white text-xs"
                          data-testid={`find-recipe-${dateInfo.dateStr}-${mealType.value}`}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add
                        </Button>
                      </div>

                      {/* Meal Cards */}
                      <div className="space-y-2">
                        {meals.length === 0 ? (
                          <div className="text-center py-6 text-gray-400">
                            <ChefHat className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-xs">No meal planned</p>
                          </div>
                        ) : (
                          meals.map((meal) => (
                            <div 
                              key={meal.id}
                              className="bg-white rounded-lg p-3 shadow-sm"
                              data-testid={`meal-${meal.id}`}
                            >
                              {meal.youtube_thumbnail && (
                                <div className="relative mb-2">
                                  <img 
                                    src={meal.youtube_thumbnail}
                                    alt={meal.meal_name}
                                    className="w-full h-24 object-cover rounded"
                                  />
                                  {meal.youtube_video_id && (
                                    <button
                                      onClick={() => window.open(`https://www.youtube.com/watch?v=${meal.youtube_video_id}`, '_blank')}
                                      className="absolute inset-0 bg-black/40 hover:bg-black/60 transition-all flex items-center justify-center group"
                                      data-testid={`play-meal-${meal.id}`}
                                    >
                                      <div className="w-12 h-12 bg-[#FF9933] rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <Play className="w-6 h-6 text-white ml-0.5" fill="white" />
                                      </div>
                                    </button>
                                  )}
                                </div>
                              )}
                              <p className="font-medium text-xs text-gray-800 mb-2 line-clamp-2">
                                {meal.meal_name}
                              </p>
                              {meal.ingredients_needed.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-2">
                                  {meal.ingredients_needed.slice(0, 3).map((ing, idx) => (
                                    <Badge key={idx} variant="secondary" className="text-[10px] px-1 py-0">
                                      {ing}
                                    </Badge>
                                  ))}
                                  {meal.ingredients_needed.length > 3 && (
                                    <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                      +{meal.ingredients_needed.length - 3}
                                    </Badge>
                                  )}
                                </div>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteMealPlan(meal.id)}
                                className="w-full text-red-600 hover:text-red-700 text-xs h-6"
                                data-testid={`delete-meal-${meal.id}`}
                              >
                                <Trash2 className="w-3 h-3 mr-1" />
                                Remove
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recipe Finder Dialog */}
      <Dialog open={isRecipeDialogOpen} onOpenChange={setIsRecipeDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto" data-testid="recipe-finder-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ChefHat className="w-6 h-6 text-[#FF9933]" />
              Find Recipe for {MEAL_TYPES.find(m => m.value === selectedMealType)?.label}
            </DialogTitle>
            <p className="text-sm text-gray-600">
              Select ingredients from your pantry and search for recipes
            </p>
          </DialogHeader>

          <div className="space-y-6">
            {/* Ingredient Selection */}
            <div>
              <Label className="text-base font-bold mb-3 block">Select Ingredients from Your Pantry</Label>
              <div className="max-h-48 overflow-y-auto custom-scrollbar border rounded-lg p-3 bg-gray-50">
                <div className="flex flex-wrap gap-2">
                  {inventory.filter(item => item.stock_level !== 'empty').map((item) => {
                    const isSelected = selectedIngredients.includes(item.name_en);
                    return (
                      <button
                        key={item.id}
                        onClick={() => toggleIngredient(item.name_en)}
                        className={`px-3 py-2 rounded-full text-sm font-medium transition-all ${
                          isSelected
                            ? 'bg-[#77DD77] text-white border-2 border-[#66CC66]'
                            : 'bg-white text-gray-700 border border-gray-300 hover:border-gray-400'
                        }`}
                        data-testid={`ingredient-${item.id}`}
                      >
                        {item.name_en}
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {selectedIngredients.length > 0 && (
                <div className="mt-3 p-3 bg-[#FFFBF0] rounded-lg border border-[#FFCC00]/30">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Selected: {selectedIngredients.length} ingredients
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedIngredients.map((ing, idx) => (
                      <Badge key={idx} className="bg-[#FF9933] text-white">
                        {ing}
                        <button
                          onClick={() => toggleIngredient(ing)}
                          className="ml-1 hover:text-gray-200"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Search Button */}
            <Button
              onClick={handleSearchRecipes}
              disabled={selectedIngredients.length === 0 || searching}
              className="w-full bg-[#77DD77] hover:bg-[#66CC66] text-gray-900 rounded-full"
              data-testid="search-recipes-btn"
            >
              {searching ? (
                <>
                  <Search className="w-5 h-5 mr-2 animate-spin" />
                  Searching Recipes...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5 mr-2" />
                  Find Recipes with Selected Ingredients
                </>
              )}
            </Button>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div>
                <Label className="text-base font-bold mb-3 block">
                  Recipe Results ({searchResults.length})
                </Label>
                
                {/* Video Preview Player */}
                {previewVideo && (
                  <div className="mb-6 bg-black rounded-xl overflow-hidden" data-testid="video-preview">
                    <div className="relative" style={{ paddingTop: '56.25%' }}>
                      <iframe
                        className="absolute top-0 left-0 w-full h-full"
                        src={`https://www.youtube.com/embed/${previewVideo.video_id}?autoplay=1`}
                        title={previewVideo.title}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                    <div className="bg-gray-900 text-white p-4 flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-sm mb-1">{previewVideo.title}</p>
                        <p className="text-xs text-gray-400">{previewVideo.channel}</p>
                      </div>
                      <Button
                        onClick={() => setPreviewVideo(null)}
                        size="sm"
                        variant="outline"
                        className="ml-4"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Close
                      </Button>
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {searchResults.map((video) => (
                    <div
                      key={video.video_id}
                      className={`bg-white border-2 rounded-xl overflow-hidden transition-all ${
                        previewVideo?.video_id === video.video_id 
                          ? 'border-[#FF9933] ring-2 ring-[#FF9933]/30' 
                          : 'border-gray-200 hover:border-[#FF9933]'
                      }`}
                      data-testid={`recipe-result-${video.video_id}`}
                    >
                      <div className="relative">
                        <img 
                          src={video.thumbnail}
                          alt={video.title}
                          className="w-full h-32 object-cover"
                        />
                        <button
                          onClick={() => setPreviewVideo(video)}
                          className="absolute inset-0 bg-black/40 hover:bg-black/60 transition-all flex items-center justify-center group"
                          data-testid={`play-video-${video.video_id}`}
                        >
                          <div className="w-16 h-16 bg-[#FF9933] rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Play className="w-8 h-8 text-white ml-1" fill="white" />
                          </div>
                        </button>
                      </div>
                      <div className="p-3">
                        <p className="font-medium text-sm text-gray-800 mb-2 line-clamp-2">
                          {video.title}
                        </p>
                        <p className="text-xs text-gray-600 mb-3">{video.channel}</p>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleAddRecipe(video)}
                            size="sm"
                            className="flex-1 bg-[#FF9933] hover:bg-[#E68A2E] text-white text-xs"
                            data-testid={`add-recipe-${video.video_id}`}
                          >
                            Add to Plan
                          </Button>
                          <Button
                            onClick={() => window.open(`https://www.youtube.com/watch?v=${video.video_id}`, '_blank')}
                            size="sm"
                            variant="outline"
                            className="text-xs"
                            data-testid={`open-youtube-${video.video_id}`}
                          >
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PlannerPage;
