import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { RecipePhoto } from '@/components/RecipePhoto';
import {
  ChefHat, Plus, Search, Filter, Heart, ShoppingCart,
  Clock, Users, BookOpen, Globe, Home, X, ArrowLeft, Edit, Youtube, Link2, Calendar, Play, Trash2, Instagram
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
const RecipeDetailView = ({ recipe, onClose, onAddToShopping, onLike, onEdit, onAddToPlanner, onDelete, isOwnRecipe = false }) => {
  const { language } = useLanguage();
  // The photo endpoint now answers with image bytes rather than a base64
  // JSON field, so RecipePhoto owns the fetch. hasPhoto flips to false only
  // when it reports the recipe has none, which is what reveals the YouTube
  // thumbnail / gradient fallback below.
  const [photoMissing, setPhotoMissing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // A different recipe in the same sheet starts over.
  useEffect(() => {
    setPhotoMissing(false);
  }, [recipe?.id]);

  if (!recipe) return null;

  const showPhoto = !!(recipe.has_photo ?? true) && !photoMissing;

  const youtubeUrl = recipe.youtube_url || (recipe.youtube_video_id
    ? `https://www.youtube.com/watch?v=${recipe.youtube_video_id}`
    : null);
  const youtubeThumb = recipe.youtube_thumbnail || (recipe.youtube_video_id
    ? `https://img.youtube.com/vi/${recipe.youtube_video_id}/hqdefault.jpg`
    : null);

  const getIngredientName = (ing) => {
    if (language === 'mr' && ing.name_mr) return ing.name_mr;
    if (language === 'hi' && ing.name_hi) return ing.name_hi;
    return ing.name_en || ing.ingredient_name;
  };
  
  return (
    <div>
      {/* Header with Photo */}
      <div className="relative h-48 bg-gradient-to-br from-orange-100 to-amber-50 -mx-6 -mt-6 mb-4">
        {showPhoto ? (
          <RecipePhoto
            recipeId={recipe.id}
            version={recipe.updated_at}
            alt={recipe.title}
            eager
            className="w-full h-full object-cover"
            onUnavailable={() => setPhotoMissing(true)}
          />
        ) : youtubeThumb && youtubeUrl ? (
          <a
            href={youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group block w-full h-full relative"
            aria-label="Watch on YouTube"
          >
            <img
              src={youtubeThumb}
              alt={recipe.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors flex items-center justify-center">
              <span className="w-16 h-16 bg-red-600 group-hover:bg-red-700 rounded-full flex items-center justify-center shadow-lg transition-colors">
                <Play className="w-7 h-7 text-white ml-1" fill="white" />
              </span>
            </div>
          </a>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ChefHat className="w-20 h-20 text-orange-200" />
          </div>
        )}
        <div className="absolute top-4 right-4 flex gap-2">
          {isOwnRecipe && (
            <>
              <button
                onClick={() => onEdit?.(recipe)}
                className="w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow-lg hover:bg-orange-50 transition-colors"
                data-testid="edit-recipe-btn"
              >
                <Edit className="w-4 h-4 text-orange-600" />
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow-lg hover:bg-red-50 transition-colors"
                data-testid="delete-recipe-btn"
                title="Delete recipe"
              >
                <Trash2 className="w-4 h-4 text-red-600" />
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Recipe?</DialogTitle>
              </DialogHeader>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete "{recipe.title}"? This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    await onDelete?.(recipe.id);
                    setShowDeleteConfirm(false);
                    onClose();
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Delete
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
      
      {/* Title & Meta */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-2xl font-bold text-gray-800">{recipe.title}</h2>
          {youtubeUrl && (
            <a
              href={youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0"
            >
              <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 hover:bg-red-100 cursor-pointer transition-colors">
                <Youtube className="w-3 h-3 mr-1" /> YouTube
              </Badge>
            </a>
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

        {/* Video Links */}
        {recipe.video_links?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {recipe.video_links.map((link, idx) => {
              const Icon = link.type === 'youtube' ? Youtube : Instagram;
              const bgClass = link.type === 'youtube' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-pink-50 text-pink-600 border-pink-200';
              return (
                <a
                  key={idx}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border hover:opacity-80 transition-opacity ${bgClass}`}
                >
                  <Icon className="w-3 h-3" />
                  {link.title || link.type.charAt(0).toUpperCase() + link.type.slice(1)}
                </a>
              );
            })}
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
        
        {/* Add to Meal Planner */}
        <Button
          onClick={() => onAddToPlanner?.(recipe)}
          variant="outline"
          className="w-full mt-3 border-orange-300 text-orange-700 hover:bg-orange-50"
          data-testid="add-recipe-to-planner-btn"
        >
          <Calendar className="w-4 h-4 mr-2" />
          Add to Meal Planner
        </Button>
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
      
      {/* Like Button for Published Recipes. Reflects whether THIS user has
          already liked it — the button used to look identical before and
          after, which is part of why the same person tapped it repeatedly. */}
      {recipe.is_published && (
        <div className="mt-6 pt-4 border-t">
          <Button
            onClick={() => onLike?.(recipe)}
            variant="outline"
            className={`w-full ${recipe.liked_by_me ? 'border-red-300 bg-red-50 text-red-700' : ''}`}
            data-testid="like-recipe-btn"
          >
            <Heart
              className={`w-4 h-4 mr-2 ${recipe.liked_by_me ? 'fill-red-500 text-red-500' : 'text-red-400'}`}
            />
            {recipe.liked_by_me ? 'Liked' : 'Like this Recipe'}
          </Button>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Veg / non-veg classification — ingredient-driven, zero user effort.
// ============================================================================
// Users asked to browse only the recipes matching their diet. Rather than
// requiring every recipe to be re-tagged, we classify from what the recipe
// actually contains: if the title or any ingredient names a non-veg item,
// it's non-veg; otherwise veg. Egg counts as non-veg (the standard line in
// Maharashtrian vegetarian households). Latin keywords match on word
// boundaries so "egg" can never fire on "eggplant"; Devanagari uses plain
// substring since Python-style \b doesn't apply cleanly there either way.
// Tag the Recipes page opens on. Must match an id in the backend's
// RECIPE_TAGS (backend/recipes.py) — "Quick Breakfast" / झटपट नाश्ता.
const DEFAULT_TAG = 'quick-breakfast';

const NON_VEG_KEYWORDS_LATIN = [
  'chicken', 'mutton', 'lamb', 'fish', 'prawn', 'prawns', 'shrimp',
  'egg', 'eggs', 'anda', 'meat', 'keema', 'kheema', 'crab', 'squid',
  'surmai', 'bangda', 'bombil', 'pomfret', 'rohu', 'katla',
];
const NON_VEG_KEYWORDS_DEVANAGARI = [
  'अंडा', 'अंडे', 'अंडी', 'चिकन', 'मटण', 'मटन', 'मांस', 'कीमा',
  'मासे', 'मासा', 'मच्छी', 'मछली', 'झिंगा', 'कोलंबी', 'सुरमई', 'बांगडा', 'बोंबील',
];
const isNonVegRecipe = (recipe) => {
  const haystack = [
    recipe.title,
    ...(recipe.tags || []),
    ...(recipe.ingredients || []).flatMap(i => [
      i.ingredient_name, i.name_en, i.name_mr, i.name_hi,
    ]),
  ].filter(Boolean).join(' ').toLowerCase();
  return (
    NON_VEG_KEYWORDS_LATIN.some(k =>
      new RegExp(`\\b${k}\\b`).test(haystack)
    ) ||
    NON_VEG_KEYWORDS_DEVANAGARI.some(k => haystack.includes(k))
  );
};

const DIET_FILTERS = [
  { key: 'all', label: 'All', emoji: '🍽️' },
  { key: 'veg', label: 'Veg', emoji: '🌿' },
  { key: 'nonveg', label: 'Non-veg', emoji: '🍖' },
];

// Main Recipe Page
const RecipesPage = () => {
  const { user, activeHousehold } = useAuth();
  const { language, getLabel } = useLanguage();
  const [activeTab, setActiveTab] = useState('household');
  const [recipes, setRecipes] = useState([]);
  const [communityRecipes, setCommunityRecipes] = useState([]);
  // Community is a paged feed, not a capped list: each row carries its photo
  // inline, so the server hands back one page plus a cursor for the next.
  // communityTotal comes from the first page only and drives the tab badge —
  // communityRecipes.length would read "20" and look like the whole feed.
  const [communityCursor, setCommunityCursor] = useState(null);
  const [communityTotal, setCommunityTotal] = useState(null);
  const [loadingMoreCommunity, setLoadingMoreCommunity] = useState(false);
  // Separate flags: the two tabs load independently now, so a slow community
  // feed no longer holds back My Kitchen's first paint.
  const [loadingHousehold, setLoadingHousehold] = useState(true);
  const [loadingCommunity, setLoadingCommunity] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  // What actually goes to the server. The input updates searchQuery on every
  // keystroke (so typing stays responsive) but the query is only sent once
  // typing pauses — "paneer" used to fire six request pairs, each one a full
  // regex scan of the recipe collection.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  // The page opens on Quick Breakfast rather than All: the common reason to
  // open Recipes is "what do I cook right now", and an unfiltered list of
  // everything is the least useful answer to that. Tapping "All" (or the
  // chip again) clears it.
  const [selectedTag, setSelectedTag] = useState(DEFAULT_TAG);
  const [tags, setTags] = useState([]);
  const [showCreator, setShowCreator] = useState(false);
  const [showYouTubeSaver, setShowYouTubeSaver] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [plannerRecipe, setPlannerRecipe] = useState(null);
  const [dietFilter, setDietFilter] = useState('all');

  // Diet-filtered views of both lists. Classification is client-side and
  // cheap (string scan per recipe), so useMemo per list-change is plenty.
  const dietMatches = (r) =>
    dietFilter === 'all' ? true
      : dietFilter === 'nonveg' ? isNonVegRecipe(r)
      : !isNonVegRecipe(r);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const visibleRecipes = useMemo(() => recipes.filter(dietMatches), [recipes, dietFilter]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const visibleCommunity = useMemo(() => communityRecipes.filter(dietMatches), [communityRecipes, dietFilter]);
  
  // Display name of the active tag, for the filtered empty states.
  const activeTagLabel = (() => {
    const tag = tags.find((t) => t.id === selectedTag);
    if (!tag) return '';
    return language === 'mr' ? tag.label_mr : language === 'hi' ? tag.label_hi : tag.label_en;
  })();

  // Tags load from their own request, so the label can still be empty when a
  // filtered empty state renders. Collapsing the gap leaves a sentence that
  // reads correctly in all three languages ("No recipes yet") instead of one
  // with a hole in it.
  const tagEmptyMessage = (key) =>
    getLabel(key, { tag: activeTagLabel }).replace(/\s{2,}/g, ' ').trim();

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
  
  // Household and community are fetched separately because they no longer
  // take the same filters: the tag chips scope My Kitchen only. Keeping one
  // combined fetch would mean every tag change also reset the community feed
  // to page 1, throwing away pages the user had already loaded.
  const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('auth_token')}`
  });

  const fetchHouseholdRecipes = async () => {
    setLoadingHousehold(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (selectedTag) params.append('tag', selectedTag);

      const res = await axios.get(`${API}/api/recipes?${params}`, { headers: authHeaders() });
      setRecipes(res.data.recipes || []);
    } catch (error) {
      console.error('Error fetching recipes:', error);
      toast.error('Failed to load recipes');
    } finally {
      setLoadingHousehold(false);
    }
  };

  // No `tag` param: the community feed is browsed, not filtered by the
  // chips. Search still applies to both.
  const fetchCommunityRecipes = async () => {
    setLoadingCommunity(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append('search', debouncedSearch);

      const res = await axios.get(`${API}/api/recipes/community?${params}`, {
        headers: authHeaders()
      });
      setCommunityRecipes(res.data.recipes || []);
      setCommunityCursor(res.data.next_cursor || null);
      setCommunityTotal(typeof res.data.total === 'number' ? res.data.total : null);
    } catch (error) {
      console.error('Error fetching community recipes:', error);
      toast.error('Failed to load community recipes');
    } finally {
      setLoadingCommunity(false);
    }
  };

  // Both lists — for the callers that change shared state (a recipe saved,
  // deleted, or published can appear in either tab).
  const fetchRecipes = async () => {
    await Promise.all([fetchHouseholdRecipes(), fetchCommunityRecipes()]);
  };

  // Append the next page of the community feed. Guarded on the cursor so a
  // double-tap can't request the same page twice and duplicate cards.
  const loadMoreCommunity = async () => {
    if (!communityCursor || loadingMoreCommunity) return;
    setLoadingMoreCommunity(true);
    try {
      const params = new URLSearchParams({ cursor: communityCursor });
      if (debouncedSearch) params.append('search', debouncedSearch);

      const res = await axios.get(`${API}/api/recipes/community?${params}`, {
        headers: authHeaders()
      });

      const page = res.data.recipes || [];
      // De-dup by id as well as trusting the cursor: a recipe deleted between
      // pages shifts the window, and a repeated card is the one failure mode
      // users actually notice.
      setCommunityRecipes((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...page.filter((r) => !seen.has(r.id))];
      });
      setCommunityCursor(res.data.next_cursor || null);
    } catch (error) {
      console.error('Error loading more community recipes:', error);
      toast.error('Failed to load more recipes');
    } finally {
      setLoadingMoreCommunity(false);
    }
  };
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  useEffect(() => {
    fetchHouseholdRecipes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, selectedTag]);
  
  // Deliberately NOT on selectedTag — see fetchCommunityRecipes.
  useEffect(() => {
    fetchCommunityRecipes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);
  
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
  
  // Like / unlike. One like per user is enforced server-side (a liked_by set
  // on the recipe); this toggles so a mis-tap is undoable instead of
  // permanent. Patches the one recipe in place rather than refetching both
  // lists — a like shouldn't cost a full reload, or reset community paging.
  const handleLikeRecipe = async (recipe) => {
    const unliking = !!recipe.liked_by_me;
    try {
      const url = `${API}/api/recipes/${recipe.id}/like`;
      const res = unliking
        ? await axios.delete(url, { headers: authHeaders() })
        : await axios.post(url, {}, { headers: authHeaders() });

      const patch = { liked_by_me: res.data.liked, likes: res.data.likes };
      const apply = (list) =>
        list.map((r) => (r.id === recipe.id ? { ...r, ...patch } : r));

      setRecipes(apply);
      setCommunityRecipes(apply);
      // The open detail sheet holds its own copy of the recipe.
      setSelectedRecipe((prev) =>
        prev && prev.id === recipe.id ? { ...prev, ...patch } : prev
      );

      if (!unliking) toast.success('Recipe liked! ❤️');
    } catch (error) {
      console.error('Error liking recipe:', error);
      toast.error(unliking ? 'Failed to remove like' : 'Failed to like recipe');
    }
  };

  // Handle recipe deletion
  const handleDeleteRecipe = async (recipeId) => {
    try {
      const token = localStorage.getItem('auth_token');
      await axios.delete(
        `${API}/api/recipes/${recipeId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Recipe deleted');
      fetchRecipes();
    } catch (error) {
      console.error('Delete recipe error:', error);
      if (error.response?.status === 403) {
        toast.error('Only the recipe creator can delete it');
      } else {
        toast.error('Failed to delete recipe');
      }
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
        
        {/* Diet filter — veg households never want to scroll past non-veg
            recipes (and vice versa). Segmented control, not a tag: it
            composes with the tag filter below rather than replacing it. */}
        <div className="flex gap-2" data-testid="diet-filter">
          {DIET_FILTERS.map((d) => (
            <button
              key={d.key}
              onClick={() => setDietFilter(d.key)}
              className={`flex-1 sm:flex-none sm:px-6 py-2 rounded-xl text-sm font-medium transition-all border-2 ${
                dietFilter === d.key
                  ? d.key === 'nonveg'
                    ? 'bg-red-50 border-red-400 text-red-700'
                    : d.key === 'veg'
                      ? 'bg-green-50 border-green-500 text-green-700'
                      : 'bg-orange-50 border-orange-400 text-orange-700'
                  : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
              data-testid={`diet-${d.key}`}
            >
              {d.emoji} {d.label}
            </button>
          ))}
        </div>

        {/* Tag Filter — My Kitchen only. Hidden on the Community tab rather
            than shown-but-inert: a chip row that visibly does nothing when
            tapped reads as a broken filter. */}
        {activeTab === 'household' && (
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
        )}
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
            {(communityTotal ?? communityRecipes.length) > 0 && (
              <Badge variant="secondary" className="ml-1">
                {communityTotal ?? communityRecipes.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
        
        {/* Household Recipes */}
        <TabsContent value="household">
          {loadingHousehold ? (
            <div className="text-center py-12">
              <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-gray-500">Loading recipes...</p>
            </div>
          ) : recipes.length === 0 && selectedTag ? (
            /* A tag is active by default now, so an empty list usually means
               "none with this tag" — NOT "you have no recipes". Saying the
               latter to someone with a full cookbook, next to a "Create
               First Recipe" button, is the bug this branch exists to avoid. */
            <Card className="p-12 text-center">
              <ChefHat className="w-16 h-16 text-gray-200 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">
                {tagEmptyMessage('noTaggedRecipes')}
              </h3>
              <Button
                onClick={() => setSelectedTag(null)}
                variant="outline"
                className="mt-2 border-orange-300 text-orange-700 hover:bg-orange-50"
                data-testid="clear-tag-filter"
              >
                {getLabel('showAllRecipes')}
              </Button>
            </Card>
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
          ) : visibleRecipes.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-sm text-gray-500">
                No {dietFilter === 'veg' ? 'vegetarian' : 'non-veg'} recipes in your kitchen yet.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleRecipes.map((recipe) => (
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
          {loadingCommunity ? (
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
            <>
              {/* The diet filter applies to the page already loaded, so it can
                  empty the grid while more pages still exist — keep the Load
                  more button reachable below the empty note rather than
                  returning early on it. */}
              {visibleCommunity.length === 0 ? (
                <Card className="p-8 text-center">
                  <p className="text-sm text-gray-500">
                    No {dietFilter === 'veg' ? 'vegetarian' : 'non-veg'} community recipes on this page.
                  </p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {visibleCommunity.map((recipe) => (
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

              {communityCursor && (
                <div className="mt-6 text-center">
                  <Button
                    onClick={loadMoreCommunity}
                    disabled={loadingMoreCommunity}
                    variant="outline"
                    className="w-full sm:w-auto sm:px-10 h-12 border-orange-300 text-orange-700 hover:bg-orange-50"
                    data-testid="community-load-more"
                  >
                    {loadingMoreCommunity ? (
                      <>
                        <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mr-2" />
                        {getLabel('loading')}
                      </>
                    ) : (
                      getLabel('loadMoreRecipes')
                    )}
                  </Button>
                  {communityTotal !== null && (
                    <p className="text-xs text-gray-400 mt-2">
                      {communityRecipes.length} / {communityTotal}
                    </p>
                  )}
                </div>
              )}
            </>
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-6">
          <RecipeDetailView
            recipe={selectedRecipe}
            onClose={() => setSelectedRecipe(null)}
            onAddToShopping={handleAddToShopping}
            onLike={handleLikeRecipe}
            onEdit={handleEditRecipe}
            onDelete={handleDeleteRecipe}
            onAddToPlanner={(recipe) => {
              setSelectedRecipe(null); // Close detail view
              handleAddToPlanner(recipe);
            }}
            isOwnRecipe={selectedRecipe ? isOwnRecipe(selectedRecipe) : false}
          />
        </DialogContent>
      </Dialog>
      
      {/* Add to Planner Modal */}
      {plannerRecipe && (
        <AddToPlannerModal
          isOpen={!!plannerRecipe}
          video={plannerRecipe}
          matchedIngredients={plannerRecipe.ingredients?.map(i => i.name_en || i.ingredient_name) || []}
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
