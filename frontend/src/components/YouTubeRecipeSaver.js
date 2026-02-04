import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  Youtube, Link2, Loader2, Check, X, Package, ShoppingCart,
  Calendar, Clock, Users, Tag, MessageSquare, Sparkles, Play
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import axios from 'axios';
import AddToPlannerModal from './AddToPlannerModal';

const API = process.env.REACT_APP_BACKEND_URL;

// YouTube URL regex patterns
const YOUTUBE_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

// Common Indian ingredient keywords for matching
const INGREDIENT_KEYWORDS = [
  // Vegetables
  'onion', 'tomato', 'potato', 'garlic', 'ginger', 'carrot', 'peas', 'beans',
  'capsicum', 'cauliflower', 'cabbage', 'spinach', 'palak', 'methi', 'bhindi',
  'brinjal', 'cucumber', 'bottle gourd', 'bitter gourd', 'pumpkin', 'beetroot',
  // Pulses & Grains  
  'dal', 'toor', 'moong', 'chana', 'urad', 'masoor', 'rajma', 'chole', 'chickpeas',
  'rice', 'basmati', 'wheat', 'atta', 'maida', 'besan', 'rava', 'semolina', 'poha',
  // Dairy
  'milk', 'dahi', 'curd', 'yogurt', 'paneer', 'butter', 'ghee', 'cream', 'cheese',
  // Spices
  'turmeric', 'haldi', 'cumin', 'jeera', 'coriander', 'dhania', 'mustard', 'rai',
  'red chili', 'green chili', 'garam masala', 'curry leaves', 'bay leaf', 'tejpatta',
  'cinnamon', 'dalchini', 'cardamom', 'elaichi', 'cloves', 'laung', 'pepper',
  'asafoetida', 'hing', 'fenugreek', 'kasuri methi', 'saffron', 'kesar',
  // Others
  'oil', 'coconut', 'tamarind', 'imli', 'jaggery', 'gur', 'sugar', 'salt',
  'lemon', 'lime', 'cashew', 'kaju', 'almond', 'badam', 'raisin', 'kishmish',
  'egg', 'chicken', 'mutton', 'fish', 'prawns'
];

// Category detection keywords
const CATEGORY_KEYWORDS = {
  'Breakfast': ['breakfast', 'nashta', 'morning', 'poha', 'upma', 'paratha', 'idli', 'dosa'],
  'Lunch': ['lunch', 'rice', 'dal', 'sabzi', 'roti', 'thali'],
  'Dinner': ['dinner', 'roti', 'chapati', 'curry'],
  'Snacks': ['snacks', 'chaat', 'samosa', 'pakora', 'vada', 'bhaji', 'tikki'],
  'Dessert': ['dessert', 'sweet', 'mithai', 'halwa', 'kheer', 'gulab jamun', 'ladoo'],
  'Maharashtrian': ['maharashtrian', 'marathi', 'misal', 'pav bhaji', 'puran poli', 'modak'],
  'South Indian': ['south indian', 'tamil', 'kerala', 'andhra', 'dosa', 'idli', 'sambar'],
  'Punjabi': ['punjabi', 'amritsari', 'makki', 'sarson', 'chole bhature'],
  'Gujarati': ['gujarati', 'dhokla', 'thepla', 'khaman', 'undhiyu'],
  'Bengali': ['bengali', 'kolkata', 'fish curry', 'mishti'],
  'Quick Recipe': ['quick', 'easy', 'simple', '5 minute', '10 minute', '15 minute'],
  'Healthy': ['healthy', 'diet', 'low calorie', 'protein', 'salad'],
  'Festival': ['festival', 'diwali', 'holi', 'ganesh', 'navratri', 'eid', 'christmas']
};

// Extract video ID from URL
const extractVideoId = (url) => {
  const match = url.match(YOUTUBE_REGEX);
  return match ? match[1] : null;
};

// Extract ingredients from text
const extractIngredients = (text) => {
  if (!text) return [];
  const textLower = text.toLowerCase();
  const found = [];
  
  INGREDIENT_KEYWORDS.forEach(keyword => {
    if (textLower.includes(keyword.toLowerCase())) {
      // Capitalize first letter
      const formatted = keyword.charAt(0).toUpperCase() + keyword.slice(1);
      if (!found.includes(formatted)) {
        found.push(formatted);
      }
    }
  });
  
  return found;
};

// Detect categories from text
const detectCategories = (title, description) => {
  const text = `${title} ${description}`.toLowerCase();
  const detected = [];
  
  Object.entries(CATEGORY_KEYWORDS).forEach(([category, keywords]) => {
    if (keywords.some(kw => text.includes(kw))) {
      detected.push(category);
    }
  });
  
  return detected.slice(0, 3); // Max 3 categories
};

// Format duration from ISO 8601
const formatDuration = (isoDuration) => {
  if (!isoDuration) return null;
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return null;
  
  const hours = parseInt(match[1] || 0);
  const minutes = parseInt(match[2] || 0);
  const seconds = parseInt(match[3] || 0);
  
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
};

// YouTube Recipe Saver Component
const YouTubeRecipeSaver = ({ onSave, onCancel }) => {
  const { user, activeHousehold } = useAuth();
  const { language, getLabel } = useLanguage();
  
  const [url, setUrl] = useState('');
  const [videoId, setVideoId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [videoData, setVideoData] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [matchedIngredients, setMatchedIngredients] = useState([]);
  const [missingIngredients, setMissingIngredients] = useState([]);
  const [detectedCategories, setDetectedCategories] = useState([]);
  const [personalNote, setPersonalNote] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [showPlanner, setShowPlanner] = useState(false);
  
  // Fetch household inventory
  useEffect(() => {
    const fetchInventory = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const res = await axios.get(`${API}/api/inventory/household`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setInventory(res.data || []);
      } catch (error) {
        console.error('Error fetching inventory:', error);
      }
    };
    fetchInventory();
  }, []);
  
  // Handle URL paste/change
  const handleUrlChange = useCallback(async (value) => {
    setUrl(value);
    const id = extractVideoId(value);
    
    if (id && id !== videoId) {
      setVideoId(id);
      setLoading(true);
      setVideoData(null);
      
      try {
        const token = localStorage.getItem('auth_token');
        const res = await axios.get(`${API}/api/youtube/video-details/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const data = res.data;
        setVideoData(data);
        
        // Extract ingredients from title and description
        const titleIngredients = extractIngredients(data.title);
        const descIngredients = extractIngredients(data.description);
        const allDetected = [...new Set([...titleIngredients, ...descIngredients])];
        
        // Match with inventory
        const inventoryNames = inventory.map(i => i.name_en?.toLowerCase());
        const matched = allDetected.filter(ing => 
          inventoryNames.some(inv => inv?.includes(ing.toLowerCase()) || ing.toLowerCase().includes(inv))
        );
        const missing = allDetected.filter(ing => !matched.includes(ing));
        
        setMatchedIngredients(matched);
        setMissingIngredients(missing);
        
        // Detect categories
        const cats = detectCategories(data.title, data.description);
        setDetectedCategories(cats);
        setSelectedCategories(cats);
        
      } catch (error) {
        console.error('Error fetching video:', error);
        toast.error('Failed to fetch video details');
        setVideoId(null);
      } finally {
        setLoading(false);
      }
    } else if (!id) {
      setVideoId(null);
      setVideoData(null);
    }
  }, [videoId, inventory]);
  
  // Toggle category
  const toggleCategory = (cat) => {
    setSelectedCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };
  
  // Save YouTube recipe
  const handleSave = async () => {
    if (!videoData || !videoId) return;
    
    setSaving(true);
    try {
      const token = localStorage.getItem('auth_token');
      
      const payload = {
        youtube_video_id: videoId,
        youtube_url: url,
        title: videoData.title,
        thumbnail: videoData.thumbnail,
        channel_name: videoData.channel,
        channel_id: videoData.channel_id,
        duration: videoData.duration,
        description: videoData.description?.substring(0, 500),
        detected_ingredients: [...matchedIngredients, ...missingIngredients],
        matched_inventory_items: matchedIngredients,
        personal_note: personalNote,
        categories: selectedCategories,
        tags: selectedCategories
      };
      
      const res = await axios.post(`${API}/api/recipes/youtube`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Recipe saved to your cookbook! 🎉');
      onSave?.(res.data);
      
    } catch (error) {
      console.error('Error saving recipe:', error);
      toast.error(error.response?.data?.detail || 'Failed to save recipe');
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <div className="space-y-6 pb-28">
      {/* URL Input */}
      <div>
        <Label className="text-sm font-medium flex items-center gap-2 mb-2">
          <Link2 className="w-4 h-4 text-red-500" />
          Paste YouTube Recipe Link
        </Label>
        <div className="relative">
          <Input
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://youtube.com/watch?v=... or youtu.be/..."
            className="pr-10"
            data-testid="youtube-url-input"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-500 animate-spin" />
          )}
          {videoData && !loading && (
            <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Supports youtube.com, youtu.be, and YouTube Shorts links
        </p>
      </div>
      
      {/* Video Preview */}
      {videoData && (
        <Card className="overflow-hidden border-2 border-green-200 bg-green-50/30">
          <div className="relative aspect-video bg-black">
            <img 
              src={videoData.thumbnail} 
              alt={videoData.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center">
                <Play className="w-8 h-8 text-white ml-1" fill="white" />
              </div>
            </div>
            {videoData.duration && (
              <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
                {formatDuration(videoData.duration)}
              </div>
            )}
          </div>
          <CardContent className="p-4">
            <h3 className="font-bold text-gray-800 line-clamp-2 mb-1">{videoData.title}</h3>
            <p className="text-sm text-gray-500">{videoData.channel}</p>
          </CardContent>
        </Card>
      )}
      
      {/* Pantry Match Preview */}
      {videoData && (matchedIngredients.length > 0 || missingIngredients.length > 0) && (
        <Card className="overflow-hidden">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <span className="font-semibold text-gray-800">Matches Your Pantry</span>
            </div>
            
            {/* Matched Ingredients */}
            {matchedIngredients.length > 0 && (
              <div>
                <p className="text-sm text-green-700 mb-2 flex items-center gap-1">
                  <Package className="w-4 h-4" />
                  Found {matchedIngredients.length} ingredient{matchedIngredients.length !== 1 ? 's' : ''} in your stock:
                </p>
                <div className="flex flex-wrap gap-2">
                  {matchedIngredients.map((ing, idx) => (
                    <Badge key={idx} className="bg-green-100 text-green-700 border-green-300">
                      <Check className="w-3 h-3 mr-1" /> {ing}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {/* Missing Ingredients */}
            {missingIngredients.length > 0 && (
              <div>
                <p className="text-sm text-amber-700 mb-2 flex items-center gap-1">
                  <ShoppingCart className="w-4 h-4" />
                  May need to buy:
                </p>
                <div className="flex flex-wrap gap-2">
                  {missingIngredients.map((ing, idx) => (
                    <Badge key={idx} variant="outline" className="text-amber-700 border-amber-300">
                      {ing}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Categories */}
      {videoData && (
        <div>
          <Label className="text-sm font-medium flex items-center gap-2 mb-2">
            <Tag className="w-4 h-4 text-purple-500" />
            Categories & Tags
          </Label>
          <div className="flex flex-wrap gap-2">
            {Object.keys(CATEGORY_KEYWORDS).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => toggleCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  selectedCategories.includes(cat)
                    ? 'bg-purple-500 text-white'
                    : detectedCategories.includes(cat)
                    ? 'bg-purple-100 text-purple-700 border border-purple-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          {detectedCategories.length > 0 && (
            <p className="text-xs text-purple-600 mt-2">
              ✨ Auto-detected from video title
            </p>
          )}
        </div>
      )}
      
      {/* Personal Note */}
      {videoData && (
        <div>
          <Label className="text-sm font-medium flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4 text-blue-500" />
            Personal Note (Optional)
          </Label>
          <Textarea
            value={personalNote}
            onChange={(e) => setPersonalNote(e.target.value)}
            placeholder="e.g., 'Aai, this is exactly like the Dal you make!' or 'Add extra garlic'"
            className="h-20"
          />
        </div>
      )}
      
      {/* Sticky Action Buttons */}
      <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 flex gap-3 mt-6 -mx-1 shadow-lg">
        <Button
          variant="outline"
          onClick={onCancel}
          className="flex-1 h-12"
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={!videoData || saving}
          className="flex-1 h-12 bg-red-600 hover:bg-red-700 text-base font-semibold"
          data-testid="save-youtube-recipe-btn"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Youtube className="w-4 h-4 mr-2" />
              Save to Cookbook
            </>
          )}
        </Button>
      </div>
      
      {/* Add to Planner Modal */}
      {showPlanner && videoData && (
        <AddToPlannerModal
          video={{
            video_id: videoId,
            title: videoData.title,
            thumbnail: videoData.thumbnail,
            channel: videoData.channel
          }}
          onClose={() => setShowPlanner(false)}
          onSuccess={() => {
            setShowPlanner(false);
            toast.success('Added to meal plan!');
          }}
        />
      )}
    </div>
  );
};

// YouTube Recipe Card for display in feed
export const YouTubeRecipeCard = ({ recipe, onView, onAddToPlanner, onAddToShopping }) => {
  const { language } = useLanguage();
  
  return (
    <Card 
      className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
      onClick={() => onView?.(recipe)}
      data-testid={`youtube-recipe-card-${recipe.id}`}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-gray-100">
        {recipe.thumbnail ? (
          <img 
            src={recipe.thumbnail} 
            alt={recipe.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Youtube className="w-12 h-12 text-gray-300" />
          </div>
        )}
        <div className="absolute top-2 left-2">
          <Badge className="bg-red-600 text-white text-[10px]">
            <Youtube className="w-3 h-3 mr-1" /> YouTube
          </Badge>
        </div>
        {recipe.duration && (
          <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
            {formatDuration(recipe.duration)}
          </div>
        )}
      </div>
      
      <CardContent className="p-4">
        {/* Title */}
        <h3 className="font-bold text-gray-800 line-clamp-2 mb-1">{recipe.title}</h3>
        <p className="text-xs text-gray-500 mb-3">{recipe.channel_name}</p>
        
        {/* Stock Status */}
        {recipe.stock_status && (
          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium mb-3 ${
            recipe.stock_status.status === 'green' ? 'bg-green-100 text-green-700' :
            recipe.stock_status.status === 'yellow' ? 'bg-amber-100 text-amber-700' :
            'bg-red-100 text-red-700'
          }`}>
            {recipe.stock_status.status === 'green' ? '✓' : recipe.stock_status.status === 'yellow' ? '⚠' : '✗'}
            {' '}{recipe.stock_status.message}
          </div>
        )}
        
        {/* Matched Ingredients Preview */}
        {recipe.matched_inventory_items?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {recipe.matched_inventory_items.slice(0, 3).map((ing, idx) => (
              <Badge key={idx} variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                {ing}
              </Badge>
            ))}
            {recipe.matched_inventory_items.length > 3 && (
              <Badge variant="outline" className="text-[10px]">
                +{recipe.matched_inventory_items.length - 3} more
              </Badge>
            )}
          </div>
        )}
        
        {/* Personal Note */}
        {recipe.personal_note && (
          <p className="text-xs text-gray-600 italic line-clamp-2 bg-amber-50 p-2 rounded mb-3">
            &ldquo;{recipe.personal_note}&rdquo;
          </p>
        )}
        
        {/* Actions */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs"
            onClick={(e) => { e.stopPropagation(); onAddToPlanner?.(recipe); }}
          >
            <Calendar className="w-3 h-3 mr-1" /> Plan
          </Button>
          {recipe.stock_status?.missing?.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs text-amber-700 border-amber-300"
              onClick={(e) => { e.stopPropagation(); onAddToShopping?.(recipe); }}
            >
              <ShoppingCart className="w-3 h-3" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default YouTubeRecipeSaver;
