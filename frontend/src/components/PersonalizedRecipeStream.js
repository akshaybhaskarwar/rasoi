import { useState, useEffect, useCallback } from 'react';
import { Youtube, Play, Plus, RefreshCw, Filter, ChevronLeft, ChevronRight, Loader2, Sparkles, Check, X, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useLanguage } from '@/contexts/LanguageContext';
import AddToPlannerModal from './AddToPlannerModal';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Shimmer skeleton for loading state
const VideoCardSkeleton = () => (
  <div className="min-w-[280px] bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
    <div className="aspect-video bg-gray-200" />
    <div className="p-4 space-y-3">
      <div className="h-4 bg-gray-200 rounded w-3/4" />
      <div className="h-3 bg-gray-200 rounded w-1/2" />
      <div className="h-6 bg-gray-200 rounded-full w-24" />
    </div>
  </div>
);

// Channel avatar component
const ChannelAvatar = ({ channel, isSelected, onClick }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center gap-2 p-2 rounded-xl transition-all min-w-[80px] ${
      isSelected 
        ? 'bg-red-50 border-2 border-red-500 scale-105' 
        : 'bg-white border-2 border-gray-200 hover:border-red-300'
    }`}
    data-testid={`channel-avatar-${channel.id}`}
  >
    <div className={`w-14 h-14 rounded-full overflow-hidden border-2 ${
      isSelected ? 'border-red-500' : 'border-gray-300'
    }`}>
      {channel.thumbnail ? (
        <img 
          src={channel.thumbnail} 
          alt={channel.name}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center">
          <Youtube className="w-6 h-6 text-white" />
        </div>
      )}
    </div>
    <span className={`text-xs font-medium text-center line-clamp-2 ${
      isSelected ? 'text-red-600' : 'text-gray-700'
    }`}>
      {channel.name}
    </span>
    {isSelected && (
      <Check className="w-4 h-4 text-red-500 absolute -top-1 -right-1 bg-white rounded-full" />
    )}
  </button>
);

// Inventory match badge component
const InventoryMatchBadge = ({ match }) => {
  const percentage = match?.percentage || 0;
  const matchedCount = match?.matched_count || 0;
  const totalInventory = match?.total_inventory || 0;
  
  let colorClass = 'bg-gray-100 text-gray-600 border-gray-200';
  let icon = '⚪';
  
  if (percentage >= 60) {
    colorClass = 'bg-green-100 text-green-700 border-green-300';
    icon = '✅';
  } else if (percentage >= 30) {
    colorClass = 'bg-yellow-100 text-yellow-700 border-yellow-300';
    icon = '🟡';
  }
  
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${colorClass}`}>
      <span>{icon}</span>
      <span>{percentage}% in Stock</span>
      <span className="text-[10px] opacity-70">({matchedCount} items)</span>
    </div>
  );
};

// Video card component
const VideoCard = ({ video, onOpenModal, plannedInfo, labels }) => {
  const isPlanned = plannedInfo?.is_planned;
  
  return (
    <div 
      className={`w-[85vw] sm:w-[300px] min-w-[280px] sm:min-w-[300px] max-w-[320px] sm:max-w-[300px] bg-white rounded-xl border overflow-hidden hover:shadow-lg transition-all group snap-center ${
        isPlanned ? 'border-green-300 bg-green-50/30' : 'border-gray-200'
      }`}
      data-testid={`stream-video-${video.video_id}`}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video">
        <img 
          src={video.thumbnail} 
          alt={video.title}
          className="w-full h-full object-cover"
        />
        {/* Play overlay - visible on touch for mobile */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 active:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 group-active:opacity-100">
          <button 
            onClick={() => window.open(`https://www.youtube.com/watch?v=${video.video_id}`, '_blank')}
            className="w-12 h-12 sm:w-14 sm:h-14 bg-red-600 rounded-full flex items-center justify-center transform scale-90 group-hover:scale-100 transition-transform shadow-lg"
          >
            <Play className="w-5 h-5 sm:w-6 sm:h-6 text-white ml-0.5" fill="white" />
          </button>
        </div>
        {/* Match badge overlay */}
        {video.inventory_match && (
          <div className="absolute top-2 left-2">
            <InventoryMatchBadge match={video.inventory_match} />
          </div>
        )}
        {/* Planned badge */}
        {isPlanned && (
          <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 shadow-md">
            <Check className="w-3 h-3" />
            {labels?.addToPlan ? labels.addToPlan.replace('Add to ', '').replace('जोडा', 'नियोजित').replace('जोड़ें', 'नियोजित') : 'Planned'}
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 line-clamp-2 mb-2 text-sm leading-tight">
          {video.title}
        </h3>
        
        {/* Channel info */}
        <div className="flex items-center gap-2 mb-3">
          {video.channel_thumbnail ? (
            <img 
              src={video.channel_thumbnail} 
              alt={video.channel}
              className="w-5 h-5 rounded-full"
            />
          ) : (
            <Youtube className="w-4 h-4 text-red-500" />
          )}
          <span className="text-xs text-gray-500 truncate">{video.channel}</span>
        </div>
        
        {/* Matched ingredients */}
        {video.inventory_match?.matched_items?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {video.inventory_match.matched_items.slice(0, 4).map((item, idx) => (
              <span 
                key={idx}
                className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200"
              >
                {item}
              </span>
            ))}
            {video.inventory_match.matched_items.length > 4 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                +{video.inventory_match.matched_items.length - 4}
              </span>
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
          
          {isPlanned ? (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-xs border-green-500 text-green-600 bg-green-50"
              disabled
            >
              <Check className="w-3 h-3 mr-1" />
              {plannedInfo.display_text || 'Planned'}
            </Button>
          ) : (
            <Button
              size="sm"
              className="flex-1 text-xs bg-[#138808] hover:bg-[#0d6606] text-white"
              onClick={() => onOpenModal(video)}
            >
              <Plus className="w-3 h-3 mr-1" />
              Add
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

const PersonalizedRecipeStream = () => {
  const [channels, setChannels] = useState([]);
  const [feed, setFeed] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [isLoadingChannels, setIsLoadingChannels] = useState(true);
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedStats, setFeedStats] = useState({ total: 0, quotaCost: 0 });
  const [minMatches, setMinMatches] = useState(1);
  const { getLabel } = useLanguage();
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  
  // Track planned videos {video_id: {is_planned, display_text, ...}}
  const [plannedVideos, setPlannedVideos] = useState({});

  // Fetch channels on mount
  useEffect(() => {
    fetchChannels();
  }, []);

  // Fetch feed when channel selection changes
  useEffect(() => {
    fetchFeed();
  }, [selectedChannel, minMatches]);

  // Check planned status for all videos in feed
  useEffect(() => {
    if (feed.length > 0) {
      checkPlannedStatus();
    }
  }, [feed]);

  const fetchChannels = async () => {
    setIsLoadingChannels(true);
    try {
      const response = await axios.get(`${API}/stream/channels`);
      setChannels(response.data.channels || []);
    } catch (error) {
      console.error('Failed to fetch channels:', error);
    } finally {
      setIsLoadingChannels(false);
    }
  };

  const fetchFeed = async () => {
    setIsLoadingFeed(true);
    try {
      const params = new URLSearchParams({ min_matches: minMatches });
      if (selectedChannel) {
        params.append('channel_filter', selectedChannel);
      }
      
      const response = await axios.get(`${API}/stream/feed?${params}`);
      setFeed(response.data.feed || []);
      setFeedStats({
        total: response.data.total_matches || 0,
        quotaCost: response.data.quota_cost || 0,
        channelsChecked: response.data.channels_checked || 0
      });
    } catch (error) {
      console.error('Failed to fetch feed:', error);
      setFeed([]);
    } finally {
      setIsLoadingFeed(false);
    }
  };

  const checkPlannedStatus = async () => {
    // Check planned status for each video
    const newPlannedStatus = {};
    for (const video of feed) {
      try {
        const response = await axios.get(`${API}/meal-plans/check/${video.video_id}`);
        if (response.data.is_planned) {
          newPlannedStatus[video.video_id] = response.data;
        }
      } catch (error) {
        // Video not planned, ignore
      }
    }
    setPlannedVideos(newPlannedStatus);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await axios.post(`${API}/stream/refresh`);
      await fetchFeed();
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleChannelClick = (channelId) => {
    setSelectedChannel(prev => prev === channelId ? null : channelId);
  };

  const handleOpenModal = (video) => {
    setSelectedVideo(video);
    setIsModalOpen(true);
  };

  const handleModalSuccess = ({ date, dayName, mealSlot }) => {
    // Update planned status for this video
    if (selectedVideo) {
      setPlannedVideos(prev => ({
        ...prev,
        [selectedVideo.video_id]: {
          is_planned: true,
          date,
          meal_type: mealSlot,
          display_text: `Planned for ${dayName}`
        }
      }));
    }
    setSelectedVideo(null);
  };

  return (
    <div className="space-y-6" data-testid="personalized-recipe-stream">
      {/* Add to Planner Modal */}
      <AddToPlannerModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedVideo(null);
        }}
        video={selectedVideo}
        matchedIngredients={selectedVideo?.inventory_match?.matched_items || []}
        onSuccess={handleModalSuccess}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{getLabel('cookWithYourStock')}</h2>
            <p className="text-sm text-gray-500">{getLabel('recipesFromFavoriteChannels')}</p>
          </div>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {getLabel('refresh')}
        </Button>
      </div>

      {/* Favorite Channels Bar */}
      <Card className="bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <Youtube className="w-5 h-5 text-red-500" />
              {getLabel('favoriteChannels')}
            </h3>
            {selectedChannel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedChannel(null)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                <X className="w-3 h-3 mr-1" />
                {getLabel('clear')}
              </Button>
            )}
          </div>
          
          {isLoadingChannels ? (
            <div className="flex gap-4 overflow-hidden">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="min-w-[80px] animate-pulse">
                  <div className="w-14 h-14 bg-gray-200 rounded-full mx-auto mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-16 mx-auto" />
                </div>
              ))}
            </div>
          ) : channels.length > 0 ? (
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex gap-3 pb-2">
                {/* "All" option */}
                <button
                  onClick={() => setSelectedChannel(null)}
                  className={`flex flex-col items-center gap-2 p-2 rounded-xl transition-all min-w-[80px] ${
                    !selectedChannel 
                      ? 'bg-red-50 border-2 border-red-500' 
                      : 'bg-white border-2 border-gray-200 hover:border-red-300'
                  }`}
                >
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
                    !selectedChannel ? 'bg-red-500' : 'bg-gray-200'
                  }`}>
                    <Filter className={`w-6 h-6 ${!selectedChannel ? 'text-white' : 'text-gray-500'}`} />
                  </div>
                  <span className={`text-xs font-medium ${!selectedChannel ? 'text-red-600' : 'text-gray-700'}`}>
                    All
                  </span>
                </button>
                
                {channels.map((channel) => (
                  <ChannelAvatar
                    key={channel.id}
                    channel={channel}
                    isSelected={selectedChannel === channel.id}
                    onClick={() => handleChannelClick(channel.id)}
                  />
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          ) : (
            <div className="text-center py-6 text-gray-500">
              <Youtube className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No favorite channels yet</p>
              <p className="text-xs text-gray-400">Add channels from the Planner page</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Match threshold filter */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600">Minimum ingredients match:</span>
        <div className="flex gap-2">
          {[1, 2, 3].map((num) => (
            <button
              key={num}
              onClick={() => setMinMatches(num)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                minMatches === num
                  ? 'bg-[#138808] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {num}+
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400 ml-2">
          {feedStats.total} recipes found • {feedStats.quotaCost} API units used
        </span>
      </div>

      {/* Recipe Feed */}
      {isLoadingFeed ? (
        <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 snap-x snap-mandatory">
          {[1, 2, 3, 4].map(i => (
            <VideoCardSkeleton key={i} />
          ))}
        </div>
      ) : feed.length > 0 ? (
        <ScrollArea className="w-full">
          <div className="flex gap-3 sm:gap-4 pb-4 snap-x snap-mandatory scroll-pl-4">
            {feed.map((video) => (
              <VideoCard 
                key={video.video_id} 
                video={video} 
                onOpenModal={handleOpenModal}
                plannedInfo={plannedVideos[video.video_id]}
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      ) : (
        <Card className="bg-gray-50 border-dashed border-2 border-gray-200">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <Youtube className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-700 mb-2">No Matching Recipes</h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              {channels.length === 0 
                ? "Add some favorite YouTube channels to see personalized recipes here."
                : "Try adding more items to your inventory, or lower the minimum match threshold."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PersonalizedRecipeStream;
