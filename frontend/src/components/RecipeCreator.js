import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  ChefHat, Plus, Minus, GripVertical, Camera, X, Check,
  Clock, Users, Sparkles, BookOpen, Upload, Tag, Trash2,
  AlertCircle, ShoppingCart, Heart, Share2, Search
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

// Stock status badge component
const StockStatusBadge = ({ status }) => {
  if (!status) return null;
  
  const config = {
    green: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
    yellow: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
    red: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' }
  };
  
  const c = config[status.status] || config.red;
  
  return (
    <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${c.bg} ${c.text} border ${c.border}`}>
      {status.status === 'green' ? '✓ ' : status.status === 'yellow' ? '⚠ ' : '✗ '}
      {status.message}
    </div>
  );
};

// Recipe Card Component
export const RecipeCard = ({ recipe, onView, onAddToShopping, onLike, onAddToPlanner, compact = false }) => {
  const { language } = useLanguage();
  
  const getIngredientDisplay = (ing) => {
    if (language === 'mr' && ing.name_mr) return ing.name_mr;
    if (language === 'hi' && ing.name_hi) return ing.name_hi;
    return ing.name_en || ing.ingredient_name;
  };
  
  const isYouTubeRecipe = recipe.recipe_type === 'youtube' || recipe.youtube_video_id;
  
  return (
    <Card 
      className={`overflow-hidden hover:shadow-lg transition-shadow cursor-pointer ${compact ? '' : 'h-full'}`}
      onClick={() => onView?.(recipe)}
      data-testid={`recipe-card-${recipe.id}`}
    >
      {/* Photo/Thumbnail */}
      {(recipe.photo_url || recipe.youtube_thumbnail) && !compact && (
        <div className="relative h-40 bg-gradient-to-br from-orange-100 to-amber-50 flex items-center justify-center">
          {recipe.photo_base64 ? (
            <img 
              src={`data:image/jpeg;base64,${recipe.photo_base64}`} 
              alt={recipe.title}
              className="w-full h-full object-cover"
            />
          ) : recipe.youtube_thumbnail || recipe.photo_url ? (
            <img 
              src={recipe.youtube_thumbnail || recipe.photo_url} 
              alt={recipe.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <ChefHat className="w-16 h-16 text-orange-300" />
          )}
          {/* YouTube Badge */}
          {isYouTubeRecipe && (
            <div className="absolute top-2 left-2">
              <Badge className="bg-red-600 text-white text-[10px]">
                <Camera className="w-3 h-3 mr-1" /> YouTube
              </Badge>
            </div>
          )}
        </div>
      )}
      
      <CardContent className={compact ? 'p-3' : 'p-4'}>
        {/* Title & Chef */}
        <div className="mb-2">
          <h3 className={`font-bold text-gray-800 ${compact ? 'text-sm' : 'text-lg'} line-clamp-2`}>
            {recipe.title}
          </h3>
          {recipe.chef_name && (
            <p className="text-xs text-gray-500 mt-0.5">
              {isYouTubeRecipe ? '' : 'by '}{recipe.chef_name}
            </p>
          )}
        </div>
        
        {/* Personal Note for YouTube recipes */}
        {isYouTubeRecipe && recipe.personal_note && !compact && (
          <p className="text-xs text-gray-600 italic line-clamp-2 bg-amber-50 p-2 rounded mb-2">
            &ldquo;{recipe.personal_note}&rdquo;
          </p>
        )}
        
        {/* Stock Status */}
        {recipe.stock_status && (
          <div className="mb-3">
            <StockStatusBadge status={recipe.stock_status} />
          </div>
        )}
        
        {/* Tags */}
        {recipe.tags?.length > 0 && !compact && (
          <div className="flex flex-wrap gap-1 mb-3">
            {recipe.tags.slice(0, 3).map((tag, idx) => (
              <Badge key={idx} variant="outline" className="text-[10px]">
                {tag}
              </Badge>
            ))}
          </div>
        )}
        
        {/* Meta Info */}
        {!compact && (
          <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
            {recipe.prep_time_minutes && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {recipe.prep_time_minutes + (recipe.cook_time_minutes || 0)} min
              </span>
            )}
            {recipe.servings && (
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {recipe.servings} servings
              </span>
            )}
            {recipe.likes > 0 && (
              <span className="flex items-center gap-1">
                <Heart className="w-3 h-3 text-red-400" />
                {recipe.likes}
              </span>
            )}
          </div>
        )}
        
        {/* Ingredients Preview */}
        {!compact && recipe.ingredients?.length > 0 && (
          <p className="text-xs text-gray-600 line-clamp-2">
            {recipe.ingredients.slice(0, 4).map(i => getIngredientDisplay(i)).join(', ')}
            {recipe.ingredients.length > 4 && ` +${recipe.ingredients.length - 4} more`}
          </p>
        )}
        
        {/* Actions */}
        <div className="flex gap-2 mt-3">
          {onAddToPlanner && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-xs border-orange-200 text-orange-700 hover:bg-orange-50"
              onClick={(e) => { e.stopPropagation(); onAddToPlanner?.(recipe); }}
            >
              <Sparkles className="w-3 h-3 mr-1" /> Plan
            </Button>
          )}
          {recipe.stock_status?.missing?.length > 0 && !compact && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
              onClick={(e) => { e.stopPropagation(); onAddToShopping?.(recipe); }}
            >
              <ShoppingCart className="w-3 h-3 mr-1" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Smart Recipe Creator Form
export const RecipeCreator = ({ onSuccess, onCancel, editRecipe = null }) => {
  const { user } = useAuth();
  const { language, getLabel } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [tags, setTags] = useState([]);
  const [units, setUnits] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [activeIngredientIndex, setActiveIngredientIndex] = useState(null);
  const fileInputRef = useRef(null);
  
  const [recipe, setRecipe] = useState({
    title: editRecipe?.title || '',
    chef_name: editRecipe?.chef_name || user?.name || '',
    story: editRecipe?.story || '',
    servings: editRecipe?.servings || 4,
    prep_time_minutes: editRecipe?.prep_time_minutes || null,
    cook_time_minutes: editRecipe?.cook_time_minutes || null,
    tags: editRecipe?.tags || [],
    is_published: editRecipe?.is_published || false,
    ingredients: editRecipe?.ingredients || [{ ingredient_name: '', quantity: '', unit: 'g' }],
    instructions: editRecipe?.instructions || [{ step_number: 1, instruction: '' }],
    photo_base64: null
  });
  
  const [photoPreview, setPhotoPreview] = useState(null);
  
  // Fetch tags and units on mount
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        
        const [tagsRes, unitsRes] = await Promise.all([
          axios.get(`${API}/api/recipes/tags`, { headers }),
          axios.get(`${API}/api/recipes/units`, { headers })
        ]);
        
        setTags(tagsRes.data.tags || []);
        setUnits(unitsRes.data.units || []);
      } catch (error) {
        console.error('Error fetching options:', error);
      }
    };
    fetchOptions();
  }, []);
  
  // Ingredient auto-suggest
  const handleIngredientChange = async (index, value) => {
    const newIngredients = [...recipe.ingredients];
    newIngredients[index].ingredient_name = value;
    setRecipe({ ...recipe, ingredients: newIngredients });
    setActiveIngredientIndex(index);
    
    if (value.length >= 2) {
      try {
        const token = localStorage.getItem('auth_token');
        const res = await axios.get(
          `${API}/api/recipes/suggest-ingredients?query=${encodeURIComponent(value)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setSuggestions(res.data.suggestions || []);
      } catch (error) {
        setSuggestions([]);
      }
    } else {
      setSuggestions([]);
    }
  };
  
  const selectSuggestion = (index, suggestion) => {
    const newIngredients = [...recipe.ingredients];
    newIngredients[index] = {
      ...newIngredients[index],
      ingredient_name: suggestion.name_en,
      inventory_item_id: suggestion.id,
      name_en: suggestion.name_en,
      name_mr: suggestion.name_mr,
      name_hi: suggestion.name_hi
    };
    setRecipe({ ...recipe, ingredients: newIngredients });
    setSuggestions([]);
    setActiveIngredientIndex(null);
  };
  
  // Add/remove ingredients
  const addIngredient = () => {
    setRecipe({
      ...recipe,
      ingredients: [...recipe.ingredients, { ingredient_name: '', quantity: '', unit: 'g' }]
    });
  };
  
  const removeIngredient = (index) => {
    if (recipe.ingredients.length > 1) {
      const newIngredients = recipe.ingredients.filter((_, i) => i !== index);
      setRecipe({ ...recipe, ingredients: newIngredients });
    }
  };
  
  // Add/remove steps
  const addStep = () => {
    setRecipe({
      ...recipe,
      instructions: [
        ...recipe.instructions,
        { step_number: recipe.instructions.length + 1, instruction: '' }
      ]
    });
  };
  
  const removeStep = (index) => {
    if (recipe.instructions.length > 1) {
      const newSteps = recipe.instructions
        .filter((_, i) => i !== index)
        .map((step, i) => ({ ...step, step_number: i + 1 }));
      setRecipe({ ...recipe, instructions: newSteps });
    }
  };
  
  const updateStep = (index, value) => {
    const newSteps = [...recipe.instructions];
    newSteps[index].instruction = value;
    setRecipe({ ...recipe, instructions: newSteps });
  };
  
  // Photo upload
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target.result.split(',')[1];
        setRecipe({ ...recipe, photo_base64: base64 });
        setPhotoPreview(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };
  
  // Toggle tag
  const toggleTag = (tagId) => {
    const newTags = recipe.tags.includes(tagId)
      ? recipe.tags.filter(t => t !== tagId)
      : [...recipe.tags, tagId];
    setRecipe({ ...recipe, tags: newTags });
  };
  
  // Submit recipe
  const handleSubmit = async () => {
    if (!recipe.title.trim()) {
      toast.error('Please enter a recipe title');
      return;
    }
    
    if (recipe.ingredients.filter(i => i.ingredient_name.trim()).length === 0) {
      toast.error('Please add at least one ingredient');
      return;
    }
    
    if (recipe.instructions.filter(i => i.instruction.trim()).length === 0) {
      toast.error('Please add at least one instruction step');
      return;
    }
    
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const headers = { Authorization: `Bearer ${token}` };
      
      // Clean up data
      const payload = {
        ...recipe,
        ingredients: recipe.ingredients.filter(i => i.ingredient_name.trim()).map(i => ({
          ...i,
          quantity: parseFloat(i.quantity) || 1
        })),
        instructions: recipe.instructions.filter(i => i.instruction.trim())
      };
      
      let response;
      if (editRecipe) {
        response = await axios.put(`${API}/api/recipes/${editRecipe.id}`, payload, { headers });
        toast.success('Recipe updated!');
      } else {
        response = await axios.post(`${API}/api/recipes`, payload, { headers });
        toast.success('Recipe created! 🎉');
      }
      
      onSuccess?.(response.data);
    } catch (error) {
      console.error('Error saving recipe:', error);
      toast.error(error.response?.data?.detail || 'Failed to save recipe');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="space-y-6 pb-6">
      {/* Header Section */}
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium">Recipe Title *</Label>
          <Input
            value={recipe.title}
            onChange={(e) => setRecipe({ ...recipe, title: e.target.value })}
            placeholder="e.g., Grandma's Secret Dal Makhani"
            className="mt-1"
            data-testid="recipe-title-input"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium">Chef Name</Label>
            <Input
              value={recipe.chef_name}
              onChange={(e) => setRecipe({ ...recipe, chef_name: e.target.value })}
              placeholder="Who created this?"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Servings</Label>
            <Input
              type="number"
              value={recipe.servings}
              onChange={(e) => setRecipe({ ...recipe, servings: parseInt(e.target.value) || 4 })}
              min={1}
              className="mt-1"
            />
          </div>
        </div>
        
        <div>
          <Label className="text-sm font-medium">Story (Optional)</Label>
          <Textarea
            value={recipe.story}
            onChange={(e) => setRecipe({ ...recipe, story: e.target.value })}
            placeholder="e.g., Passed down from my Nani in Kolhapur..."
            className="mt-1 h-20"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium">Prep Time (min)</Label>
            <Input
              type="number"
              value={recipe.prep_time_minutes || ''}
              onChange={(e) => setRecipe({ ...recipe, prep_time_minutes: parseInt(e.target.value) || null })}
              placeholder="15"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Cook Time (min)</Label>
            <Input
              type="number"
              value={recipe.cook_time_minutes || ''}
              onChange={(e) => setRecipe({ ...recipe, cook_time_minutes: parseInt(e.target.value) || null })}
              placeholder="30"
              className="mt-1"
            />
          </div>
        </div>
      </div>
      
      {/* Photo Upload */}
      <div>
        <Label className="text-sm font-medium">Photo</Label>
        <div 
          className="mt-2 border-2 border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer hover:border-orange-300 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          {photoPreview ? (
            <div className="relative">
              <img src={photoPreview} alt="Preview" className="max-h-48 mx-auto rounded-lg" />
              <Button
                size="sm"
                variant="destructive"
                className="absolute top-2 right-2 h-8 w-8 p-0"
                onClick={(e) => { e.stopPropagation(); setPhotoPreview(null); setRecipe({ ...recipe, photo_base64: null }); }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="py-4">
              <Camera className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Tap to upload photo</p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoUpload}
          />
        </div>
      </div>
      
      {/* Tags */}
      <div>
        <Label className="text-sm font-medium mb-2 block">Tags</Label>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggleTag(tag.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                recipe.tags.includes(tag.id)
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tag.emoji} {language === 'mr' ? tag.label_mr : language === 'hi' ? tag.label_hi : tag.label_en}
            </button>
          ))}
        </div>
      </div>
      
      {/* Ingredients */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <Label className="text-sm font-medium">Ingredients *</Label>
          <Button size="sm" variant="outline" onClick={addIngredient} className="h-8">
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>
        
        <div className="space-y-3">
          {recipe.ingredients.map((ing, index) => (
            <div key={index} className="relative">
              <div className="flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
                
                <div className="flex-1 relative">
                  <Input
                    value={ing.ingredient_name}
                    onChange={(e) => handleIngredientChange(index, e.target.value)}
                    placeholder="e.g., Besan"
                    className="pr-2"
                    data-testid={`ingredient-name-${index}`}
                  />
                  
                  {/* Suggestions dropdown */}
                  {activeIngredientIndex === index && suggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {suggestions.map((sug) => (
                        <button
                          key={sug.id}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-orange-50 flex items-center justify-between"
                          onClick={() => selectSuggestion(index, sug)}
                        >
                          <span>{sug.name_en}</span>
                          <Badge variant={sug.stock_level === 'full' ? 'default' : sug.stock_level === 'half' ? 'secondary' : 'outline'} className="text-[10px]">
                            {sug.stock_level}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                <Input
                  type="number"
                  value={ing.quantity}
                  onChange={(e) => {
                    const newIngredients = [...recipe.ingredients];
                    newIngredients[index].quantity = e.target.value;
                    setRecipe({ ...recipe, ingredients: newIngredients });
                  }}
                  placeholder="100"
                  className="w-20"
                />
                
                <Select
                  value={ing.unit}
                  onValueChange={(val) => {
                    const newIngredients = [...recipe.ingredients];
                    newIngredients[index].unit = val;
                    setRecipe({ ...recipe, ingredients: newIngredients });
                  }}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((u) => (
                      <SelectItem key={u.value} value={u.value}>{u.value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeIngredient(index)}
                  className="h-9 w-9 p-0 text-gray-400 hover:text-red-500"
                  disabled={recipe.ingredients.length === 1}
                >
                  <Minus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Instructions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <Label className="text-sm font-medium">Instructions *</Label>
          <Button size="sm" variant="outline" onClick={addStep} className="h-8">
            <Plus className="w-4 h-4 mr-1" /> Add Step
          </Button>
        </div>
        
        <div className="space-y-3">
          {recipe.instructions.map((step, index) => (
            <div key={index} className="flex items-start gap-2">
              <div className="w-7 h-7 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-sm font-bold flex-shrink-0 mt-1">
                {index + 1}
              </div>
              <Textarea
                value={step.instruction}
                onChange={(e) => updateStep(index, e.target.value)}
                placeholder={`Step ${index + 1}...`}
                className="flex-1 min-h-[60px]"
                data-testid={`instruction-step-${index}`}
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeStep(index)}
                className="h-9 w-9 p-0 text-gray-400 hover:text-red-500 mt-1"
                disabled={recipe.instructions.length === 1}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
      
      {/* Publish Option */}
      <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl">
        <input
          type="checkbox"
          id="publish"
          checked={recipe.is_published}
          onChange={(e) => setRecipe({ ...recipe, is_published: e.target.checked })}
          className="w-5 h-5 rounded border-blue-300 text-blue-600"
        />
        <label htmlFor="publish" className="flex-1">
          <p className="text-sm font-medium text-blue-800">Publish to Community</p>
          <p className="text-xs text-blue-600">Share this recipe with all Rasoi-Sync users</p>
        </label>
        <Share2 className="w-5 h-5 text-blue-400" />
      </div>
      
      {/* Submit Buttons */}
      <div className="bg-white border-t border-gray-200 p-4 flex gap-3 mt-6 -mx-6 sticky bottom-0">
        <Button
          variant="outline"
          onClick={onCancel}
          className="flex-1 h-12"
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={loading}
          className="flex-1 h-12 bg-orange-500 hover:bg-orange-600 text-base font-semibold"
          data-testid="save-recipe-btn"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Saving...
            </>
          ) : (
            <>
              <Check className="w-4 h-4 mr-2" />
              {editRecipe ? 'Update Recipe' : 'Save Recipe'}
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default RecipeCreator;
