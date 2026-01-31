import { useState, useEffect, useCallback } from 'react';
import { Youtube, Search, Filter, Clock, Play, Plus, X, Link2, ChevronLeft, ChevronRight, Loader2, Sparkles, TrendingUp, Zap, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Cache key generator
const getCacheKey = (ingredients, textQuery) => {
  return `yt_search_${[...ingredients].sort().join(',')}_${textQuery}`.toLowerCase();
};

// LocalStorage cache helpers (24-hour TTL)
const getFromCache = (key) => {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    const { data, expires } = JSON.parse(cached);
    if (Date.now() > expires) {
      localStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
};

const setToCache = (key, data) => {
  try {
    const expires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    localStorage.setItem(key, JSON.stringify({ data, expires }));
  } catch (e) {
    console.warn('LocalStorage full, clearing old cache');
    // Clear old YouTube cache entries
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('yt_search_')) localStorage.removeItem(k);
    });
  }
};

// Shimmer skeleton component
const ShimmerCard = () => (
  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
    <div className="aspect-video bg-gray-200" />
    <div className="p-4 space-y-3">
      <div className="h-4 bg-gray-200 rounded w-3/4" />
      <div className="h-3 bg-gray-200 rounded w-1/2" />
      <div className="flex gap-2">
        <div className="h-6 bg-gray-200 rounded-full w-16" />
        <div className="h-6 bg-gray-200 rounded-full w-20" />
      </div>
    </div>
  </div>
);

const YouTubeRecipeDiscovery = ({ inventory = [], onAddToPlan, selectedDate, selectedMealType }) => {
  // State
  const [recommendations, setRecommendations] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedIngredients, setSelectedIngredients] = useState([]);
  const [textQuery, setTextQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchSource, setSearchSource] = useState(null);
  const [quotaCost, setQuotaCost] = useState(0);
  
  // User video submission
  const [videoUrl, setVideoUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userVideos, setUserVideos] = useState([]);
  
  // Carousel state
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Fetch Dadi's Recommendations on mount
  useEffect(() => {
    fetchRecommendations();
    fetchUserVideos();
  }, []);

  const fetchRecommendations = async () => {
    try {
      const response = await axios.get(`${API}/youtube/recommendations`);
      setRecommendations(response.data.recommendations || []);
    } catch (error) {
      console.error('Failed to fetch recommendations:', error);
    }
  };

  const fetchUserVideos = async () => {
    try {
      const response = await axios.get(`${API}/youtube/user-videos`);
      setUserVideos(response.data.videos || []);
    } catch (error) {
      console.error('Failed to fetch user videos:', error);
    }
  };

  // Toggle ingredient selection
  const toggleIngredient = (ingredientName) => {
    setSelectedIngredients(prev =>
      prev.includes(ingredientName)
        ? prev.filter(i => i !== ingredientName)
        : prev.length < 5 ? [...prev, ingredientName] : prev
    );
  };

  // Search recipes - Cache-First approach
  const handleSearch = useCallback(async () => {
    if (selectedIngredients.length === 0 && !textQuery.trim()) {
      return;
    }

    const cacheKey = getCacheKey(selectedIngredients, textQuery);
    
    // Check localStorage cache first
    const cachedResult = getFromCache(cacheKey);
    if (cachedResult) {
      console.log('LocalStorage cache HIT');
      setSearchResults(cachedResult.results || []);
      setSearchSource('local_cache');
      setQuotaCost(0);
      return;
    }

    setIsSearching(true);
    try {
      const response = await axios.post(`${API}/youtube/search`, {
        ingredients: selectedIngredients,
        text_query: textQuery.trim(),
        max_results: 12
      });
      
      const results = response.data.results || [];
      setSearchResults(results);
      setSearchSource(response.data.source);
      setQuotaCost(response.data.quota_cost || 0);
      
      // Cache in localStorage
      setToCache(cacheKey, { results });
      
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [selectedIngredients, textQuery]);

  // Submit user video
  const handleSubmitVideo = async () => {
    if (!videoUrl.trim()) return;
    
    setIsSubmitting(true);
    try {
      const response = await axios.post(`${API}/youtube/add-video`, {
        youtube_url: videoUrl.trim()
      });
      
      if (response.data.success) {
        setUserVideos(prev => [response.data.video, ...prev]);
        setVideoUrl('');
        alert(response.data.message);
      }
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to add video');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Carousel navigation
  const nextSlide = () => {
    setCarouselIndex(prev => 
      prev + 1 >= recommendations.length ? 0 : prev + 1
    );
  };
  
  const prevSlide = () => {
    setCarouselIndex(prev => 
      prev - 1 < 0 ? recommendations.length - 1 : prev - 1
    );
  };

  // Video card component
  const VideoCard = ({ video, showMatchBadge = true, showDeleteButton = false, onDelete }) => {
    const match = video.inventory_match;
    const [isDeleting, setIsDeleting] = useState(false);
    
    const handleDelete = async (e) => {
      e.stopPropagation();
      if (!onDelete) return;
      
      setIsDeleting(true);
      try {
        await onDelete(video.video_id);
      } finally {
        setIsDeleting(false);
      }
    };
    
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow group relative">
        {/* Delete button for user videos */}
        {showDeleteButton && (
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="absolute top-2 right-2 z-10 w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-md transition-all opacity-0 group-hover:opacity-100"
            data-testid={`delete-video-${video.video_id}`}
          >
            {isDeleting ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Trash2 className="w-3 h-3" />
            )}
          </button>
        )}
        
        {/* Thumbnail with duration badge */}
        <div className="relative aspect-video">
          <img 
            src={video.thumbnail} 
            alt={video.title}
            className="w-full h-full object-cover"
          />
          {/* Duration badge */}
          {video.duration && (
            <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
              {video.duration}
            </span>
          )}
          {/* Play overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
            <button 
              onClick={() => window.open(`https://www.youtube.com/watch?v=${video.video_id}`, '_blank')}
              className="w-14 h-14 bg-red-600 rounded-full flex items-center justify-center transform scale-90 group-hover:scale-100 transition-transform"
            >
              <Play className="w-6 h-6 text-white ml-1" fill="white" />
            </button>
          </div>
          {/* Tag badge */}
          {video.tag && (
            <span className="absolute top-2 left-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs px-2 py-1 rounded-full font-medium">
              {video.tag}
            </span>
          )}
        </div>
        
        {/* Content */}
        <div className="p-4">
          <h3 className="font-semibold text-gray-900 line-clamp-2 mb-1 text-sm">
            {video.title}
          </h3>
          <p className="text-xs text-gray-500 mb-3 flex items-center gap-1">
            <Youtube className="w-3 h-3 text-red-500" />
            {video.channel}
          </p>
          
          {/* Inventory match badge */}
          {showMatchBadge && match && match.total > 0 && (
            <div className={`mb-3 p-2 rounded-lg text-xs ${
              match.percentage >= 70 ? 'bg-green-50 border border-green-200' :
              match.percentage >= 40 ? 'bg-yellow-50 border border-yellow-200' :
              'bg-gray-50 border border-gray-200'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium">
                  {match.percentage >= 70 ? '✅' : match.percentage >= 40 ? '🟡' : '⚪'} 
                  {' '}You have {match.matched}/{match.total} ingredients
                </span>
                <span className={`font-bold ${
                  match.percentage >= 70 ? 'text-green-600' : 
                  match.percentage >= 40 ? 'text-yellow-600' : 'text-gray-500'
                }`}>
                  {match.percentage}%
                </span>
              </div>
              {match.missing_items?.length > 0 && (
                <p className="text-gray-500 truncate">
                  Need: {match.missing_items.slice(0, 3).join(', ')}
                  {match.missing_items.length > 3 && ` +${match.missing_items.length - 3}`}
                </p>
              )}
            </div>
          )}
          
          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              onClick={() => window.open(`https://www.youtube.com/watch?v=${video.video_id}`, '_blank')}
            >
              <Play className="w-3 h-3 mr-1" />
              Watch
            </Button>
            {onAddToPlan && (
              <Button
                size="sm"
                className="flex-1 text-xs bg-[#138808] hover:bg-[#0d6606] text-white"
                onClick={() => onAddToPlan({
                  title: video.title,
                  video_id: video.video_id,
                  thumbnail: video.thumbnail,
                  ingredients: video.ingredients || []
                })}
              >
                <Plus className="w-3 h-3 mr-1" />
                Add to Plan
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6" data-testid="youtube-recipe-discovery">
      {/* Dadi's Recommended Carousel */}
      <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Dadi's Recommended</h3>
                <p className="text-xs text-gray-500">Pre-fetched • 0 API quota used</p>
              </div>
            </div>
            
            {/* Carousel controls */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={prevSlide}
                className="w-8 h-8 p-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={nextSlide}
                className="w-8 h-8 p-0"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          {/* Carousel content */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recommendations.slice(carouselIndex, carouselIndex + 3).map((video) => (
              <VideoCard key={video.id} video={video} showMatchBadge={false} />
            ))}
            {/* Show from start if we're near the end */}
            {carouselIndex + 3 > recommendations.length && 
              recommendations.slice(0, (carouselIndex + 3) - recommendations.length).map((video) => (
                <VideoCard key={video.id} video={video} showMatchBadge={false} />
              ))
            }
          </div>
        </CardContent>
      </Card>

      {/* Recipe Search - Text Only */}
      {/* <Card className="border-2 border-gray-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
              <Search className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800">Search Recipes</h3>
              <p className="text-xs text-gray-500">Find recipes by name on YouTube</p>
            </div>
          </div> */}

          {/* Text search input */}
          {/* <div className="flex gap-2">
            <Input
              placeholder="Search recipe (e.g., 'Dal Tadka', 'Pav Bhaji')"
              value={textQuery}
              onChange={(e) => setTextQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
              data-testid="recipe-text-search"
            />
            <Button
              onClick={handleSearch}
              disabled={isSearching || !textQuery.trim()}
              className="bg-[#FF9933] hover:bg-[#E68A2E] text-white font-semibold px-6"
              data-testid="find-recipes-btn"
            >
              {isSearching ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Search className="w-5 h-5" />
              )}
            </Button>
          </div> */}
          
          {/* Search source indicator */}
          {/* {searchSource && (
            <p className="text-xs text-center text-gray-500 mt-3">
              {searchSource === 'local_cache' && '⚡ Instant result from cache (0 API units)'}
              {searchSource === 'cache' && '⚡ Result from server cache (0 API units)'}
              {searchSource === 'youtube_api' && `📡 Fresh from YouTube (${quotaCost} API units used)`}
              {searchSource === 'local_fallback' && '📚 Showing local recipes (YouTube quota exceeded)'}
            </p>
          )}
        </CardContent>
      </Card> */}

      {/* Search Results */}
      {/* {isSearching ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <ShimmerCard key={i} />
          ))}
        </div>
      ) : searchResults.length > 0 ? (
        <div>
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#138808]" />
            Search Results ({searchResults.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {searchResults.map((video) => (
              <VideoCard key={video.video_id} video={video} />
            ))}
          </div>
        </div>
      ) : null} */}

      {/* User-Submitted Video Section */}
      <Card className="border-2 border-dashed border-gray-300 bg-gray-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <Link2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800">Found a Video You Love?</h3>
              <p className="text-xs text-gray-500">Paste the URL here (costs only 1 API unit!)</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Input
              placeholder="https://www.youtube.com/watch?v=..."
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmitVideo()}
              className="flex-1"
              data-testid="submit-video-url"
            />
            <Button
              onClick={handleSubmitVideo}
              disabled={isSubmitting || !videoUrl.trim()}
              className="bg-purple-600 hover:bg-purple-700 text-white"
              data-testid="submit-video-btn"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </Button>
          </div>
          
          {/* User's saved videos - Now with Add to Plan buttons */}
          {userVideos.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-gray-600 mb-3 font-medium">Your saved videos:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {userVideos.slice(0, 4).map((video) => (
                  <VideoCard 
                    key={video.video_id} 
                    video={video} 
                    showMatchBadge={false}
                  />
                ))}
              </div>
              {userVideos.length > 4 && (
                <p className="text-xs text-center text-gray-400 mt-3">
                  +{userVideos.length - 4} more videos saved
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default YouTubeRecipeDiscovery;
