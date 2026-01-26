import { useState, useEffect } from 'react';
import { useMealPlanner, useRecipes, useInventory, useFavoriteChannels } from '@/hooks/useRasoiSync';
import { Plus, Calendar as CalendarIcon, Trash2, Search, ChefHat, X, Play, ExternalLink, Star, ChevronDown, ChevronUp, Youtube, Video, FileText, Clock } from 'lucide-react';
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
  const { searchLocalRecipes } = useRecipes();
  const { inventory } = useInventory();
  const { favoriteChannels, addFavoriteChannel, removeFavoriteChannel } = useFavoriteChannels();
  
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedMealType, setSelectedMealType] = useState('');
  const [selectedIngredients, setSelectedIngredients] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [isRecipeDialogOpen, setIsRecipeDialogOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [previewVideo, setPreviewVideo] = useState(null);
  const [videosOnly, setVideosOnly] = useState(false);
  const [totalFound, setTotalFound] = useState(0);
  
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

  // Search recipes based on selected ingredients (using local database)
  const handleSearchRecipes = async () => {
    if (selectedIngredients.length === 0) {
      alert('Please select at least one ingredient');
      return;
    }

    setSearching(true);
    try {
      const response = await searchLocalRecipes(selectedIngredients, videosOnly, favoriteChannels, 20);
      setSearchResults(response.results || []);
      setTotalFound(response.total_found || 0);
    } catch (error) {
      console.error('Search error:', error);
      alert('Failed to search recipes. Please try again.');
      setSearchResults([]);
      setTotalFound(0);
    } finally {
      setSearching(false);
    }
  };

  // Add recipe to meal plan
  // Add recipe to meal plan
  const handleAddRecipe = async (recipe) => {
    if (!selectedDate || !selectedMealType) {
      alert('Please select date and meal type first');
      return;
    }

    try {
      await addMealPlan({
        date: selectedDate,
        meal_type: selectedMealType,
        meal_name: recipe.title,
        youtube_video_id: recipe.video_id || null,
        youtube_thumbnail: recipe.thumbnail,
        ingredients_needed: recipe.ingredients || selectedIngredients
      });

      // Reset selections
      setSelectedIngredients([]);
      setSearchResults([]);
      setTotalFound(0);
      setIsRecipeDialogOpen(false);
      setSelectedDate('');
      setSelectedMealType('');
      setVideosOnly(false);
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

  // Handle adding a favorite channel
  const handleAddFavoriteChannel = async () => {
    if (!newChannelInput.trim()) return;
    
    try {
      // Extract channel name/ID from input (could be URL or name)
      let channelId = newChannelInput.trim();
      let channelName = newChannelInput.trim();
      
      // If it's a YouTube URL, try to extract channel info
      if (channelId.includes('youtube.com')) {
        // Simple extraction - use the last part of URL as ID
        const parts = channelId.split('/');
        channelId = parts[parts.length - 1] || parts[parts.length - 2];
        channelName = channelId.replace('@', '');
      }
      
      // Generate a unique ID if we're just using a name
      const uniqueId = channelId.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      
      await addFavoriteChannel(uniqueId, channelName);
      setNewChannelInput('');
    } catch (error) {
      console.error('Failed to add favorite channel:', error);
      alert('Failed to add channel. Please try again.');
    }
  };

  // Handle removing a favorite channel
  const handleRemoveFavoriteChannel = async (channelId) => {
    try {
      await removeFavoriteChannel(channelId);
    } catch (error) {
      console.error('Failed to remove favorite channel:', error);
    }
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

      {/* Favorite Channels Section - Inline */}
      <Card className="shadow-sm border-2 border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50" data-testid="favorite-channels-section">
        <CardContent className="p-4">
          {/* Collapsed View */}
          <div 
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setIsFavoritesExpanded(!isFavoritesExpanded)}
            data-testid="favorite-channels-toggle"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center">
                <Youtube className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500" fill="currentColor" />
                  Favorite Channels
                </h3>
                <p className="text-xs text-gray-500">Recipes from these channels appear first</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Channel Pills Preview */}
              {!isFavoritesExpanded && favoriteChannels.length > 0 && (
                <div className="hidden md:flex items-center gap-2">
                  {favoriteChannels.slice(0, 3).map((channel) => (
                    <Badge 
                      key={channel.id} 
                      className="bg-white text-gray-700 border border-gray-200 text-xs"
                    >
                      {channel.name}
                    </Badge>
                  ))}
                  {favoriteChannels.length > 3 && (
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
                      +{favoriteChannels.length - 3} more
                    </Badge>
                  )}
                </div>
              )}
              {!isFavoritesExpanded && favoriteChannels.length === 0 && (
                <Badge className="bg-gray-100 text-gray-500 text-xs">
                  No favorites yet
                </Badge>
              )}
              
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-600"
              >
                {isFavoritesExpanded ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </Button>
            </div>
          </div>
          
          {/* Expanded View */}
          {isFavoritesExpanded && (
            <div className="mt-4 pt-4 border-t border-amber-200 space-y-4" data-testid="favorite-channels-expanded">
              {/* Add Channel Input */}
              <div className="flex gap-2">
                <Input
                  placeholder="Enter channel name (e.g., Ranveer Brar, Kabita's Kitchen)"
                  value={newChannelInput}
                  onChange={(e) => setNewChannelInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddFavoriteChannel()}
                  className="flex-1 bg-white"
                  data-testid="add-channel-input"
                />
                <Button
                  onClick={handleAddFavoriteChannel}
                  disabled={!newChannelInput.trim()}
                  className="bg-red-500 hover:bg-red-600 text-white px-6"
                  data-testid="add-channel-btn"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </div>
              
              {/* Current Favorites */}
              {favoriteChannels.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {favoriteChannels.map((channel) => (
                    <div
                      key={channel.id}
                      className="flex items-center gap-2 bg-white rounded-full px-4 py-2 border border-gray-200 shadow-sm group hover:border-red-300 transition-colors"
                      data-testid={`favorite-channel-${channel.id}`}
                    >
                      <Youtube className="w-4 h-4 text-red-500" />
                      <span className="text-sm font-medium text-gray-700">{channel.name}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFavoriteChannel(channel.id);
                        }}
                        className="w-5 h-5 rounded-full bg-gray-100 hover:bg-red-100 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors"
                        data-testid={`remove-channel-${channel.id}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  <Youtube className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No favorite channels yet</p>
                  <p className="text-xs text-gray-400 mt-1">Add your favorite cooking channels above</p>
                </div>
              )}
              
              {/* Popular Suggestions */}
              <div className="pt-2">
                <p className="text-xs text-gray-500 mb-2">Popular Indian cooking channels:</p>
                <div className="flex flex-wrap gap-2">
                  {['Ranveer Brar', 'Kabita\'s Kitchen', 'Hebbars Kitchen', 'Sanjeev Kapoor', 'Vahchef'].map((name) => {
                    const isAdded = favoriteChannels.some(ch => ch.name.toLowerCase() === name.toLowerCase());
                    return (
                      <button
                        key={name}
                        disabled={isAdded}
                        onClick={() => {
                          setNewChannelInput(name);
                        }}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                          isAdded 
                            ? 'bg-green-50 border-green-200 text-green-600 cursor-not-allowed' 
                            : 'bg-white border-gray-200 text-gray-600 hover:border-amber-400 hover:text-amber-600'
                        }`}
                        data-testid={`suggest-channel-${name.replace(/\s/g, '-')}`}
                      >
                        {isAdded ? '✓ ' : '+ '}{name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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

            {/* Filter Tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setVideosOnly(false)}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  !videosOnly 
                    ? 'bg-[#138808] text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                data-testid="filter-all"
              >
                All
              </button>
              <button
                onClick={() => setVideosOnly(true)}
                className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors ${
                  videosOnly 
                    ? 'bg-[#138808] text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                data-testid="filter-videos"
              >
                <Video className="w-4 h-4" />
                Videos Only
              </button>
            </div>

            {/* Search Button */}
            <div className="space-y-2">
              {favoriteChannels.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 p-2 rounded-lg">
                  <Star className="w-4 h-4" fill="currentColor" />
                  <span>Showing recipes from: {favoriteChannels.map(ch => ch.name).join(', ')}</span>
                </div>
              )}
              <Button
                onClick={handleSearchRecipes}
                disabled={selectedIngredients.length === 0 || searching}
                className="w-full bg-[#138808] hover:bg-[#0d6606] text-white rounded-lg"
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
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-bold">
                    Recipe Results ({searchResults.length}{totalFound > searchResults.length ? ` of ${totalFound}` : ''})
                  </Label>
                </div>
                
                {/* Video Preview Player */}
                {previewVideo && previewVideo.video_id && (
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
                        video.is_favorite
                          ? 'border-amber-400 ring-2 ring-amber-200'
                          : previewVideo?.video_id === video.video_id 
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
                        {video.is_favorite && (
                          <div className="absolute top-2 left-2 bg-amber-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                            <Star className="w-3 h-3" fill="currentColor" />
                            Favorite
                          </div>
                        )}
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
                        <p className={`text-xs mb-3 ${video.is_favorite ? 'text-amber-600 font-medium' : 'text-gray-600'}`}>
                          {video.is_favorite && <Star className="w-3 h-3 inline mr-1" fill="currentColor" />}
                          {video.channel}
                        </p>
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
