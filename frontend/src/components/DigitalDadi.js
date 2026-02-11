import { useState, useEffect, useCallback } from 'react';
import { 
  Calendar, ShoppingCart, ChevronRight, AlertTriangle, 
  CheckCircle, Clock, Loader2, Sparkles, RefreshCw
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Dadi avatar component
const DadiAvatar = ({ size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-10 h-10 text-xl',
    md: 'w-14 h-14 text-2xl',
    lg: 'w-20 h-20 text-4xl'
  };
  
  return (
    <div className={`${sizeClasses[size]} bg-gradient-to-br from-orange-400 to-amber-500 rounded-full flex items-center justify-center shadow-lg`}>
      <span>👵</span>
    </div>
  );
};

// Ingredient status badge
const IngredientBadge = ({ ingredient, status }) => {
  const statusStyles = {
    in_stock: 'bg-green-100 text-green-800 border-green-200',
    low: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    missing: 'bg-red-100 text-red-800 border-red-200'
  };
  
  const statusIcons = {
    in_stock: <CheckCircle className="w-3 h-3" />,
    low: <AlertTriangle className="w-3 h-3" />,
    missing: <AlertTriangle className="w-3 h-3" />
  };
  
  return (
    <Badge 
      variant="outline" 
      className={`${statusStyles[status]} flex items-center gap-1 text-xs`}
    >
      {statusIcons[status]}
      {ingredient}
    </Badge>
  );
};

// Single Festival Card
const FestivalCard = ({ festival, onAddToShopping, isAdding }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Use backend flag for whether items are already in shopping list
  const isAlreadyAdded = festival.all_missing_in_shopping;
  
  // Calculate urgency based on days until
  const getUrgencyColor = (days) => {
    if (days <= 3) return 'from-red-500 to-orange-500';
    if (days <= 7) return 'from-orange-400 to-amber-400';
    return 'from-amber-300 to-yellow-300';
  };
  
  const getUrgencyText = (days) => {
    if (days === 0) return 'Today!';
    if (days === 1) return 'Tomorrow!';
    if (days <= 3) return `${days} days - Urgent!`;
    return `${days} days`;
  };
  
  return (
    <Card 
      className="overflow-hidden hover:shadow-lg transition-all duration-300 border-l-4 border-l-orange-400"
      data-testid={`upcoming-festival-${festival.id}`}
    >
      <CardContent className="p-0">
        {/* Festival Header */}
        <div 
          className="p-4 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className={`px-3 py-1 rounded-full bg-gradient-to-r ${getUrgencyColor(festival.days_until)} text-white text-sm font-medium flex items-center gap-1`}>
                  <Clock className="w-3 h-3" />
                  {getUrgencyText(festival.days_until)}
                </div>
                {festival.is_fasting_day && (
                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                    🙏 Fasting Day
                  </Badge>
                )}
              </div>
              
              <h3 className="text-lg font-bold text-gray-800 mb-1">
                {festival.name}
                {festival.name_mr && (
                  <span className="text-orange-500 font-normal text-base ml-2">
                    ({festival.name_mr})
                  </span>
                )}
              </h3>
              
              <p className="text-sm text-gray-600 mb-3">{festival.significance}</p>
              
              {/* Readiness Score */}
              <div className="flex items-center gap-3">
                <div className="flex-1 max-w-[200px]">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-500">Readiness</span>
                    <span className={`font-medium ${
                      festival.readiness_score >= 80 ? 'text-green-600' :
                      festival.readiness_score >= 50 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {festival.readiness_score}%
                    </span>
                  </div>
                  <Progress 
                    value={festival.readiness_score} 
                    className="h-2"
                  />
                </div>
                
                {festival.missing_ingredients.length > 0 && (
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddToShopping(festival.id);
                    }}
                    disabled={isAdding || isAlreadyAdded}
                    className={`text-white text-xs gap-1 ${
                      isAlreadyAdded 
                        ? 'bg-green-500 hover:bg-green-500 cursor-not-allowed' 
                        : 'bg-orange-500 hover:bg-orange-600'
                    }`}
                    data-testid={`add-missing-btn-${festival.id}`}
                  >
                    {isAdding ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : isAlreadyAdded ? (
                      <CheckCircle className="w-3 h-3" />
                    ) : (
                      <ShoppingCart className="w-3 h-3" />
                    )}
                    {isAlreadyAdded ? 'Added to List' : `Add ${festival.missing_ingredients.length} Missing`}
                  </Button>
                )}
              </div>
            </div>
            
            <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
          </div>
        </div>
        
        {/* Expanded Content */}
        {isExpanded && (
          <div className="px-4 pb-4 border-t bg-gradient-to-b from-orange-50/50 to-white">
            {/* Ingredients Status */}
            <div className="pt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Ingredient Status:</p>
              <div className="flex flex-wrap gap-2">
                {festival.ingredient_status.map((ing, idx) => (
                  <IngredientBadge 
                    key={idx} 
                    ingredient={ing.name} 
                    status={ing.status} 
                  />
                ))}
              </div>
            </div>
            
            {/* Dadi's Tips */}
            {festival.tips?.length > 0 && (
              <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-sm font-medium text-amber-800 mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Dadi&apos;s Tips:
                </p>
                <ul className="text-sm text-amber-900 space-y-1">
                  {festival.tips.map((tip, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-amber-500">💡</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Main Digital Dadi Component
const DigitalDadi = () => {
  const [upcomingFestivals, setUpcomingFestivals] = useState([]);
  const [tipOfDay, setTipOfDay] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingToShopping, setIsAddingToShopping] = useState(null);
  const { language } = useLanguage();

  const fetchUpcomingFestivals = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;
      
      const response = await axios.get(`${API}/dadi/upcoming?days_ahead=14`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUpcomingFestivals(response.data.upcoming || []);
    } catch (error) {
      console.error('Error fetching upcoming festivals:', error);
    }
  }, []);

  const fetchTipOfDay = useCallback(async () => {
    try {
      // Pass language preference to get tip in regional language
      const response = await axios.get(`${API}/dadi/tip-of-day?lang=${language}`);
      setTipOfDay(response.data);
    } catch (error) {
      console.error('Error fetching tip:', error);
    }
  }, [language]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchUpcomingFestivals(), fetchTipOfDay()]);
      setIsLoading(false);
    };
    loadData();
  }, [fetchUpcomingFestivals, fetchTipOfDay]);

  const handleAddToShopping = async (festivalId) => {
    setIsAddingToShopping(festivalId);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.post(
        `${API}/dadi/add-missing-to-shopping?festival_id=${festivalId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      if (response.data.count > 0) {
        toast.success(`Added ${response.data.count} items to shopping list`, {
          description: `For ${response.data.festival}`
        });
      } else {
        toast.info('All items already in shopping list');
      }
      
      // Refresh festival data to update the all_missing_in_shopping flag
      await fetchUpcomingFestivals();
    } catch (error) {
      toast.error('Failed to add items to shopping list');
    } finally {
      setIsAddingToShopping(null);
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" data-testid="digital-dadi-section">
      {/* Dadi Header with Tip of Day */}
      <Card className="bg-gradient-to-br from-orange-100 via-amber-50 to-yellow-50 border-orange-200 overflow-hidden">
        <CardContent className="p-0">
          <div className="flex items-center gap-4 p-4">
            <DadiAvatar size="lg" />
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                Digital Dadi
                <Sparkles className="w-5 h-5 text-amber-500" />
              </h2>
              <p className="text-sm text-gray-600">Your kitchen wisdom companion</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                fetchUpcomingFestivals();
                fetchTipOfDay();
              }}
              className="text-orange-600"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Tip of Day */}
          {tipOfDay && (
            <div className="px-4 pb-4">
              <div className="bg-white/80 backdrop-blur rounded-xl p-3 border border-orange-200">
                <p className="text-xs text-orange-600 font-medium mb-1">💡 Tip of the Day</p>
                <p className="text-sm text-gray-700">{tipOfDay.tip}</p>
                <p className="text-xs text-gray-500 mt-1">— {tipOfDay.context}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Festivals */}
      {upcomingFestivals.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-orange-500" />
              Upcoming Festivals
            </h3>
            <Badge variant="outline" className="bg-orange-50 text-orange-700">
              {upcomingFestivals.length} in next 14 days
            </Badge>
          </div>
          
          {upcomingFestivals.map((festival) => (
            <FestivalCard
              key={festival.id}
              festival={festival}
              onAddToShopping={handleAddToShopping}
              isAdding={isAddingToShopping === festival.id}
            />
          ))}
        </div>
      ) : (
        <Card className="border-dashed border-orange-300 bg-orange-50/30">
          <CardContent className="p-6 text-center">
            <Calendar className="w-12 h-12 text-orange-300 mx-auto mb-3" />
            <p className="text-gray-600">No festivals in the next 14 days</p>
            <p className="text-sm text-gray-500 mt-1">
              Upload festival calendar from Admin panel
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DigitalDadi;
export { DadiAvatar, IngredientBadge };
