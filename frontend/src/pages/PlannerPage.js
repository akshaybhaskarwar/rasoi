import { useState } from 'react';
import { useMealPlanner, useRecipes } from '@/hooks/useRasoiSync';
import { Plus, Calendar as CalendarIcon, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const PlannerPage = () => {
  const { mealPlans, addMealPlan, deleteMealPlan } = useMealPlanner();
  const { searchYouTube } = useRecipes();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newPlan, setNewPlan] = useState({
    date: '',
    meal_name: '',
    youtube_video_id: '',
    ingredients_needed: []
  });

  const handleSearch = async () => {
    if (!searchQuery) return;
    try {
      const results = await searchYouTube(searchQuery, 5);
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  const handleSelectVideo = (video) => {
    setNewPlan({
      ...newPlan,
      meal_name: video.title,
      youtube_video_id: video.video_id
    });
    setSearchResults([]);
  };

  const handleAddPlan = async () => {
    try {
      await addMealPlan(newPlan);
      setIsAddDialogOpen(false);
      setNewPlan({ date: '', meal_name: '', youtube_video_id: '', ingredients_needed: [] });
      setSearchQuery('');
      setSearchResults([]);
    } catch (error) {
      console.error('Error adding plan:', error);
    }
  };

  const groupedByDate = mealPlans.reduce((acc, plan) => {
    if (!acc[plan.date]) acc[plan.date] = [];
    acc[plan.date].push(plan);
    return acc;
  }, {});

  return (
    <div className="container mx-auto px-4 py-6 pb-24 md:pb-6 space-y-6" data-testid="planner-page">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-800">Meal Planner</h1>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className="bg-[#FF9933] hover:bg-[#E68A2E] text-white rounded-full"
              data-testid="add-meal-btn"
            >
              <Plus className="w-5 h-5 mr-2" />
              Plan Meal
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="add-meal-dialog" className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Plan a Meal</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={newPlan.date}
                  onChange={(e) => setNewPlan({ ...newPlan, date: e.target.value })}
                  data-testid="meal-date-input"
                />
              </div>
              
              <div>
                <Label>Search Recipe on YouTube</Label>
                <div className="flex gap-2">
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="e.g., Gujarati Dal"
                    data-testid="recipe-search-input"
                  />
                  <Button onClick={handleSearch} data-testid="search-recipe-btn">Search</Button>
                </div>
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                  {searchResults.map((video) => (
                    <div
                      key={video.video_id}
                      onClick={() => handleSelectVideo(video)}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                      data-testid={`video-${video.video_id}`}
                    >
                      <img 
                        src={video.thumbnail}
                        alt={video.title}
                        className="w-24 h-16 object-cover rounded"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{video.title}</p>
                        <p className="text-xs text-gray-600">{video.channel}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {newPlan.youtube_video_id && (
                <div className="p-3 bg-[#FFFBF0] rounded-lg border border-[#FFCC00]/30">
                  <p className="text-sm font-medium text-gray-800">Selected: {newPlan.meal_name}</p>
                </div>
              )}

              <div>
                <Label>Ingredients Needed (comma separated)</Label>
                <Input
                  value={newPlan.ingredients_needed.join(', ')}
                  onChange={(e) => setNewPlan({ 
                    ...newPlan, 
                    ingredients_needed: e.target.value.split(',').map(i => i.trim()).filter(Boolean)
                  })}
                  placeholder="e.g., Tuvar Dal, Tomatoes, Spices"
                  data-testid="ingredients-input"
                />
              </div>

              <Button 
                onClick={handleAddPlan}
                disabled={!newPlan.date || !newPlan.meal_name}
                className="w-full bg-[#FF9933] hover:bg-[#E68A2E] text-white rounded-full"
                data-testid="submit-meal-plan"
              >
                Add to Planner
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Weekly Calendar */}
      <div className="overflow-x-auto custom-scrollbar pb-4">
        <div className="flex gap-4 min-w-max">
          {DAYS.map((day, index) => {
            const date = new Date();
            date.setDate(date.getDate() + index);
            const dateStr = date.toISOString().split('T')[0];
            const plansForDay = groupedByDate[dateStr] || [];

            return (
              <Card 
                key={day}
                className="w-72 flex-shrink-0 hover-lift"
                data-testid={`day-card-${day}`}
              >
                <CardContent className="p-4">
                  <div className="text-center mb-4 pb-3 border-b">
                    <p className="text-sm text-gray-600">{day}</p>
                    <p className="text-lg font-bold text-gray-800">{date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</p>
                  </div>

                  <div className="space-y-3">
                    {plansForDay.length === 0 ? (
                      <div className="text-center py-6 text-gray-400">
                        <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No meals planned</p>
                      </div>
                    ) : (
                      plansForDay.map((plan) => (
                        <div 
                          key={plan.id}
                          className="bg-white border border-gray-200 rounded-lg p-3"
                          data-testid={`meal-plan-${plan.id}`}
                        >
                          {plan.youtube_thumbnail && (
                            <img 
                              src={plan.youtube_thumbnail}
                              alt={plan.meal_name}
                              className="w-full h-32 object-cover rounded mb-2"
                            />
                          )}
                          <p className="font-medium text-sm text-gray-800 mb-2">{plan.meal_name}</p>
                          {plan.ingredients_needed.length > 0 && (
                            <p className="text-xs text-gray-600 mb-2">
                              Needs: {plan.ingredients_needed.join(', ')}
                            </p>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteMealPlan(plan.id)}
                            className="w-full text-red-600 hover:text-red-700 text-xs"
                            data-testid={`delete-plan-${plan.id}`}
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Remove
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PlannerPage;
