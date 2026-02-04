import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  ChefHat, Plus, Search, Filter, Heart, ShoppingCart, 
  Clock, Users, BookOpen, Globe, Home, X, ArrowLeft, Edit, Youtube, Link2
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { toast } from 'sonner';
import axios from 'axios';
import { RecipeCreator, RecipeCard } from '@/components/RecipeCreator';
import YouTubeRecipeSaver, { YouTubeRecipeCard } from '@/components/YouTubeRecipeSaver';
import TranslatedLabel from '@/components/TranslatedLabel';
import AddToPlannerModal from '@/components/AddToPlannerModal';

const API = process.env.REACT_APP_BACKEND_URL;

// Stock Status Badge
const StockStatusBadge = ({ status }) => {
  if (!status) return null;
  
  const config = {
    green: { bg: 'bg-green-100', text: 'text-green-700', icon: '✓' },
    yellow: { bg: 'bg-amber-100', text: 'text-amber-700', icon: '⚠' },
    red: { bg: 'bg-red-100', text: 'text-red-700', icon: '✗' }
  };
  
  const c = config[status.status] || config.red;
  
  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      <span>{c.icon}</span>
      <span>{status.message}</span>
    </div>
  );
};

// Recipe Detail View
const RecipeDetailView = ({ recipe, onClose, onAddToShopping, onLike, onEdit, onAddToPlanner, isOwnRecipe = false }) => {
  const { language } = useLanguage();
  const [photoData, setPhotoData] = useState(null);
  const [loadingPhoto, setLoadingPhoto] = useState(false);
  
  useEffect(() => {
    const fetchPhoto = async () => {
      if (!recipe?.id) return;
      setLoadingPhoto(true);
      try {
        const token = localStorage.getItem('auth_token');
        const res = await axios.get(`${API}/api/recipes/${recipe.id}/photo`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setPhotoData(res.data.photo_base64);
      } catch (error) {
        console.log('No photo available');
      } finally {
        setLoadingPhoto(false);
      }
    };
    fetchPhoto();
  }, [recipe?.id]);
  
  if (!recipe) return null;
  
  const getIngredientName = (ing) => {
    if (language === 'mr' && ing.name_mr) return ing.name_mr;
    if (language === 'hi' && ing.name_hi) return ing.name_hi;
    return ing.name_en || ing.ingredient_name;
  };
  
  return (
    <div className="max-h-[85vh] overflow-y-auto">
      {/* Header with Photo */}
      <div className="relative h-48 bg-gradient-to-br from-orange-100 to-amber-50 -mx-6 -mt-6 mb-4">
        {photoData ? (
          <img 
            src={`data:image/jpeg;base64,${photoData}`} 
            alt={recipe.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ChefHat className="w-20 h-20 text-orange-200" />
          </div>
        )}
        <div className="absolute top-4 right-4 flex gap-2">
          {isOwnRecipe && (
            <button
              onClick={() => onEdit?.(recipe)}
              className="w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow-lg hover:bg-orange-50 transition-colors"
              data-testid="edit-recipe-btn"
            >
              <Edit className="w-4 h-4 text-orange-600" />
            </button>
          )}
          <button
            onClick={onClose}
            className="w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Title & Meta */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-2xl font-bold text-gray-800">{recipe.title}</h2>
          {recipe.youtube_video_id && (
            <Badge variant="outline" className="shrink-0 bg-red-50 text-red-600 border-red-200">
              <Youtube className="w-3 h-3 mr-1" /> YouTube
            </Badge>
          )}
        </div>
        
        {recipe.chef_name && (
          <p className="text-sm text-gray-600">
            <span className="font-medium">Chef:</span> {recipe.chef_name}
          </p>
        )}
        
        {recipe.story && (
          <p className="text-sm text-gray-600 italic bg-amber-50 p-3 rounded-lg border-l-4 border-amber-400">
            &ldquo;{recipe.story}&rdquo;
          </p>
        )}
        
        {/* Stock Status */}
        {recipe.stock_status && (
          <div className="py-2">
            <StockStatusBadge status={recipe.stock_status} />
          </div>
        )}
        
        {/* Meta Info */}
        <div className="flex flex-wrap gap-4 text-sm text-gray-500">
          {recipe.prep_time_minutes && (
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              Prep: {recipe.prep_time_minutes} min
            </span>
          )}
          {recipe.cook_time_minutes && (
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              Cook: {recipe.cook_time_minutes} min
            </span>
          )}
          <span className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            {recipe.servings} servings
          </span>
          {recipe.likes > 0 && (
            <span className="flex items-center gap-1">
              <Heart className="w-4 h-4 text-red-400" />
              {recipe.likes} likes
            </span>
          )}
        </div>
        
        {/* Tags */}
        {recipe.tags?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {recipe.tags.map((tag, idx) => (
              <Badge key={idx} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
      
      {/* Ingredients */}
      <div className="mt-6">
        <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
          <span className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 text-sm">🥘</span>
          Ingredients
        </h3>
        <div className="bg-gray-50 rounded-xl p-4 space-y-2">
          {recipe.ingredients?.map((ing, idx) => {
            const isAvailable = recipe.stock_status?.in_stock?.some(
              i => i.ingredient?.toLowerCase() === ing.ingredient_name?.toLowerCase()
            );
            const isMissing = recipe.stock_status?.missing?.some(
              i => i.ingredient?.toLowerCase() === ing.ingredient_name?.toLowerCase()
            );
            
            return (
              <div 
                key={idx}
                className={`flex items-center justify-between p-2 rounded-lg ${
                  isMissing ? 'bg-red-50' : isAvailable ? 'bg-green-50' : 'bg-white'
                }`}
              >
                <span className={`font-medium ${isMissing ? 'text-red-700' : 'text-gray-800'}`}>
                  {getIngredientName(ing)}
                  {ing.name_mr && language !== 'mr' && (
                    <span className="text-xs text-gray-400 ml-2">({ing.name_mr})</span>
                  )}
                </span>
                <span className={`text-sm ${isMissing ? 'text-red-600' : 'text-gray-600'}`}>
                  {ing.quantity} {ing.unit}
                </span>
              </div>
            );
          })}
        </div>
        
        {/* Add Missing to Shopping */}
        {recipe.stock_status?.missing?.length > 0 && (
          <Button
            onClick={() => onAddToShopping?.(recipe)}
            className="w-full mt-3 bg-amber-500 hover:bg-amber-600"
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            Add {recipe.stock_status.missing.length} Missing Items to Shopping List
          </Button>
        )}
      </div>
      
      {/* Instructions */}
      <div className="mt-6">
        <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
          <span className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-sm">📝</span>
          Instructions
        </h3>
        <div className="space-y-4">
          {recipe.instructions?.map((step, idx) => (
            <div key={idx} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                {idx + 1}
              </div>
              <p className="text-gray-700 pt-1">{step.instruction}</p>
            </div>
          ))}
        </div>
      </div>
      
      {/* Like Button for Published Recipes */}
      {recipe.is_published && (
        <div className="mt-6 pt-4 border-t">
          <Button
            onClick={() => onLike?.(recipe)}
            variant="outline"
            className="w-full"
          >
            <Heart className="w-4 h-4 mr-2 text-red-400" />
            Like this Recipe
          </Button>
        </div>
      )}
    </div>
  );
};

// Main Recipe Page
const RecipesPage = () => {
  const { user, activeHousehold } = useAuth();
  const { language, getLabel } = useLanguage();
  const [activeTab, setActiveTab] = useState('household');
  const [recipes, setRecipes] = useState([]);
  const [communityRecipes, setCommunityRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState(null);
  const [tags, setTags] = useState([]);
  const [showCreator, setShowCreator] = useState(false);
  const [showYouTubeSaver, setShowYouTubeSaver] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [plannerRecipe, setPlannerRecipe] = useState(null);
  
  // Fetch tags
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const res = await axios.get(`${API}/api/recipes/tags`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setTags(res.data.tags || []);
      } catch (error) {
        console.error('Error fetching tags:', error);
      }
    };
    fetchTags();
  }, []);
  
  // Fetch recipes
  const fetchRecipes = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const headers = { Authorization: `Bearer ${token}` };
      
      // Build query params
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (selectedTag) params.append('tag', selectedTag);
      
      const [householdRes, communityRes] = await Promise.all([
        axios.get(`${API}/api/recipes?${params}`, { headers }),
        axios.get(`${API}/api/recipes/community?${params}`, { headers })
      ]);
      
      setRecipes(householdRes.data.recipes || []);
      setCommunityRecipes(communityRes.data.recipes || []);
    } catch (error) {
      console.error('Error fetching recipes:', error);
      toast.error('Failed to load recipes');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchRecipes();
  }, [searchQuery, selectedTag]);
  
  // Add missing to shopping list
  const handleAddToShopping = async (recipe) => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await axios.post(
        `${API}/api/recipes/${recipe.id}/add-missing-to-shopping`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(res.data.message);
    } catch (error) {
      toast.error('Failed to add items to shopping list');
    }
  };
  
  // Like recipe
  const handleLikeRecipe = async (recipe) => {
    try {
      const token = localStorage.getItem('auth_token');
      await axios.post(
        `${API}/api/recipes/${recipe.id}/like`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Recipe liked! ❤️');
      fetchRecipes();
    } catch (error) {
      toast.error('Failed to like recipe');
    }
  };
  
  // Handle recipe created/updated
  const handleRecipeSaved = (savedRecipe) => {
    setShowCreator(false);
    setEditingRecipe(null);
    setSelectedRecipe(null);
    fetchRecipes();
  };
  
  // Handle edit recipe
  const handleEditRecipe = (recipe) => {
    setSelectedRecipe(null);
    setEditingRecipe(recipe);
    setShowCreator(true);
  };
  
  // Handle YouTube recipe saved
  const handleYouTubeSaved = (savedRecipe) => {
    setShowYouTubeSaver(false);
    fetchRecipes();
  };
  
  // Handle add to planner for any recipe (YouTube or user-created)
  const handleAddToPlanner = (recipe) => {
    // For YouTube recipes, use youtube_video_id
    // For user-created recipes, use the recipe id
    setPlannerRecipe({
      video_id: recipe.youtube_video_id || recipe.id,
      title: recipe.title,
      thumbnail: recipe.youtube_thumbnail || recipe.photo_url || null,
      channel: recipe.youtube_channel || recipe.chef_name || 'Family Recipe',
      // Pass additional data for user-created recipes
      is_user_recipe: !recipe.youtube_video_id,
      ingredients: recipe.ingredients || []
    });
  };
  
  // Check if recipe belongs to current household
  const isOwnRecipe = (recipe) => {
    return recipe.household_id === activeHousehold?.id;
  };
  
  return (
    <div className="container mx-auto px-4 py-4 pb-28 md:pb-6" data-testid="recipes-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-orange-500" />
            Family Recipes
          </h1>
          <p className="text-sm text-gray-500">
            {activeHousehold?.name || 'Your household'}&apos;s recipe collection
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowYouTubeSaver(true)}
            variant="outline"
            className="gap-2 border-red-200 text-red-600 hover:bg-red-50"
            data-testid="save-youtube-btn"
          >
            <Youtube className="w-4 h-4" />
            <span className="hidden sm:inline">YouTube</span>
          </Button>
          <Button
            onClick={() => setShowCreator(true)}
            className="bg-orange-500 hover:bg-orange-600 gap-2"
            data-testid="create-recipe-btn"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Recipe</span>
          </Button>
        </div>
      </div>
      {/* Search & Filter */}
      <div className="space-y-3 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search recipes..."
            className="pl-10"
            data-testid="recipe-search"
          />
        </div>
        
        {/* Tag Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => setSelectedTag(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              !selectedTag ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            All
          </button>
          {tags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => setSelectedTag(selectedTag === tag.id ? null : tag.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                selectedTag === tag.id ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {tag.emoji} {language === 'mr' ? tag.label_mr : language === 'hi' ? tag.label_hi : tag.label_en}
            </button>
          ))}
        </div>
      </div>
      
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="household" className="gap-2">
            <Home className="w-4 h-4" />
            My Kitchen
            {recipes.length > 0 && <Badge variant="secondary" className="ml-1">{recipes.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="community" className="gap-2">
            <Globe className="w-4 h-4" />
            Community
            {communityRecipes.length > 0 && <Badge variant="secondary" className="ml-1">{communityRecipes.length}</Badge>}
          </TabsTrigger>
        </TabsList>
        
        {/* Household Recipes */}
        <TabsContent value="household">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-gray-500">Loading recipes...</p>
            </div>
          ) : recipes.length === 0 ? (
            <Card className="p-12 text-center">
              <ChefHat className="w-16 h-16 text-gray-200 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">No recipes yet</h3>
              <p className="text-sm text-gray-500 mb-4">
                Start building your family&apos;s recipe collection!
              </p>
              <Button onClick={() => setShowCreator(true)} className="bg-orange-500 hover:bg-orange-600">
                <Plus className="w-4 h-4 mr-2" />
                Create First Recipe
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  onView={setSelectedRecipe}
                  onAddToShopping={handleAddToShopping}
                  onAddToPlanner={handleAddToPlanner}
                />
              ))}
            </div>
          )}
        </TabsContent>
        
        {/* Community Recipes */}
        <TabsContent value="community">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-gray-500">Loading community recipes...</p>
            </div>
          ) : communityRecipes.length === 0 ? (
            <Card className="p-12 text-center">
              <Globe className="w-16 h-16 text-gray-200 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">No community recipes</h3>
              <p className="text-sm text-gray-500">
                Be the first to share a recipe with the community!
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {communityRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  onView={setSelectedRecipe}
                  onAddToShopping={handleAddToShopping}
                  onLike={handleLikeRecipe}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      {/* Recipe Creator Sheet */}
      <Sheet open={showCreator} onOpenChange={(open) => { setShowCreator(open); if (!open) setEditingRecipe(null); }}>
        <SheetContent side="bottom" className="h-[90vh] flex flex-col p-0 pb-20">
          <SheetHeader className="p-6 pb-2 shrink-0">
            <SheetTitle className="flex items-center gap-2">
              <ChefHat className="w-6 h-6 text-orange-500" />
              {editingRecipe ? 'Edit Recipe' : 'Create New Recipe'}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6">
            <RecipeCreator
              onSuccess={handleRecipeSaved}
              onCancel={() => { setShowCreator(false); setEditingRecipe(null); }}
              editRecipe={editingRecipe}
            />
          </div>
        </SheetContent>
      </Sheet>
      
      {/* YouTube Recipe Saver Sheet */}
      <Sheet open={showYouTubeSaver} onOpenChange={setShowYouTubeSaver}>
        <SheetContent side="bottom" className="h-[90vh] flex flex-col p-0 pb-20">
          <SheetHeader className="p-6 pb-2 shrink-0">
            <SheetTitle className="flex items-center gap-2">
              <Youtube className="w-6 h-6 text-red-500" />
              Save Your YouTube Recipe
            </SheetTitle>
            <p className="text-sm text-gray-500">Save a recipe video to your family cookbook</p>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6">
            <YouTubeRecipeSaver
              onSave={handleYouTubeSaved}
              onCancel={() => setShowYouTubeSaver(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
      
      {/* Recipe Detail Dialog */}
      <Dialog open={!!selectedRecipe} onOpenChange={() => setSelectedRecipe(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden p-6">
          <RecipeDetailView
            recipe={selectedRecipe}
            onClose={() => setSelectedRecipe(null)}
            onAddToShopping={handleAddToShopping}
            onLike={handleLikeRecipe}
            onEdit={handleEditRecipe}
            isOwnRecipe={selectedRecipe ? isOwnRecipe(selectedRecipe) : false}
          />
        </DialogContent>
      </Dialog>
      
      {/* Add to Planner Modal */}
      {plannerRecipe && (
        <AddToPlannerModal
          video={plannerRecipe}
          onClose={() => setPlannerRecipe(null)}
          onSuccess={() => {
            setPlannerRecipe(null);
            toast.success('Added to meal plan!');
          }}
        />
      )}
    </div>
  );
};

export default RecipesPage;
