import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChefHat, Home, Users, ShoppingBasket, Calendar, 
  Sparkles, ArrowRight, ArrowLeft, Check, X,
  Globe, MapPin, Package, Heart
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

// Onboarding steps configuration
const STEPS = [
  { id: 'welcome', title: 'Welcome', icon: ChefHat },
  { id: 'household', title: 'Your Kitchen', icon: Home },
  { id: 'pantry', title: 'Stock Pantry', icon: Package },
  { id: 'tour', title: 'Quick Tour', icon: Sparkles },
];

const LANGUAGES = [
  { value: 'en', label: 'English', flag: '🇬🇧', greeting: 'Hello!' },
  { value: 'hi', label: 'हिन्दी', flag: '🇮🇳', greeting: 'नमस्ते!' },
  { value: 'mr', label: 'मराठी', flag: '🇮🇳', greeting: 'नमस्कार!' },
];

const CITIES = [
  'Pune', 'Mumbai', 'Delhi', 'Bangalore', 'Chennai', 
  'Kolkata', 'Hyderabad', 'Ahmedabad', 'Jaipur', 'Other'
];

// Quick pantry essentials for onboarding
const QUICK_PANTRY_ITEMS = [
  { category: '🌾 Grains', items: ['Rice (चावल)', 'Wheat Flour (गेहूं आटा)', 'Rava (रवा)'] },
  { category: '🫘 Pulses', items: ['Toor Dal (तूर दाल)', 'Moong Dal (मूंग दाल)', 'Chana (चना)'] },
  { category: '🌶️ Spices', items: ['Turmeric (हळद)', 'Red Chili (लाल मिर्च)', 'Cumin (जीरा)'] },
  { category: '🧴 Oils', items: ['Cooking Oil (तेल)', 'Ghee (तूप)', 'Mustard Oil (सरसों तेल)'] },
];

const TOUR_HIGHLIGHTS = [
  {
    icon: Package,
    title: 'Inventory',
    titleMr: 'साठा',
    description: 'Track what\'s in your kitchen with smart stock levels',
    color: 'bg-amber-500'
  },
  {
    icon: ShoppingBasket,
    title: 'Shopping List',
    titleMr: 'खरेदी यादी',
    description: 'Auto-generated lists synced with family members',
    color: 'bg-green-500'
  },
  {
    icon: Calendar,
    title: 'Meal Planner',
    titleMr: 'जेवण नियोजन',
    description: 'Plan weekly meals with YouTube recipe integration',
    color: 'bg-blue-500'
  },
  {
    icon: Sparkles,
    title: 'Digital Dadi',
    titleMr: 'डिजिटल दादी',
    description: 'Your AI kitchen assistant with smart suggestions',
    color: 'bg-purple-500'
  },
];

const OnboardingFlow = ({ onComplete }) => {
  const { user, updateProfile, createHousehold, joinHousehold } = useAuth();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  
  // Form state
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [selectedCity, setSelectedCity] = useState('Pune');
  const [householdMode, setHouseholdMode] = useState('create');
  const [householdName, setHouseholdName] = useState('');
  const [kitchenCode, setKitchenCode] = useState('');
  const [createdCode, setCreatedCode] = useState('');
  const [selectedPantryItems, setSelectedPantryItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem('onboarding_completed', 'true');
    setIsVisible(false);
    onComplete?.();
  };

  const handleComplete = () => {
    localStorage.setItem('onboarding_completed', 'true');
    setIsVisible(false);
    toast.success('🎉 Welcome to Rasoi-Sync! Your kitchen is ready.');
    onComplete?.();
  };

  const handleLanguageSelect = async (lang) => {
    setSelectedLanguage(lang);
    // Update user profile
    if (user) {
      await updateProfile({ home_language: lang, city: selectedCity });
    }
  };

  const handleCreateHousehold = async () => {
    if (!householdName.trim()) {
      toast.error('Please enter a kitchen name');
      return;
    }
    
    setLoading(true);
    const result = await createHousehold(householdName);
    
    if (result.success) {
      setCreatedCode(result.data.kitchen_code);
      toast.success('Kitchen created! 🏠');
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  };

  const handleJoinHousehold = async () => {
    if (!kitchenCode.trim() || kitchenCode.length !== 6) {
      toast.error('Please enter a valid 6-digit code');
      return;
    }
    
    setLoading(true);
    const result = await joinHousehold(kitchenCode.toUpperCase());
    
    if (result.success) {
      toast.success(result.data.message);
      handleNext();
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  };

  const togglePantryItem = (item) => {
    setSelectedPantryItems(prev => 
      prev.includes(item) 
        ? prev.filter(i => i !== item)
        : [...prev, item]
    );
  };

  const addPantryItems = async () => {
    if (selectedPantryItems.length === 0) {
      handleNext();
      return;
    }
    
    setLoading(true);
    try {
      const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
      
      for (const item of selectedPantryItems) {
        // Extract English name (before parentheses)
        const nameEn = item.split(' (')[0].trim();
        await fetch(`${API}/inventory`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          },
          body: JSON.stringify({
            name_en: nameEn,
            category: 'grains',
            stock_level: 'full',
            unit: 'kg'
          })
        });
      }
      
      toast.success(`Added ${selectedPantryItems.length} items to your pantry! 🎉`);
      handleNext();
    } catch (error) {
      console.error('Failed to add items:', error);
      toast.error('Failed to add some items');
    }
    setLoading(false);
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center"
      >
        {/* Dimmed Backdrop with Blur */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        
        {/* Spotlight Container */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Progress Bar */}
          <div className="px-6 pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 font-medium">
                Step {currentStep + 1} of {STEPS.length}
              </span>
              <button 
                onClick={handleSkip}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Skip setup
              </button>
            </div>
            <Progress value={progress} className="h-1.5" />
            
            {/* Step Indicators */}
            <div className="flex justify-between mt-3">
              {STEPS.map((step, idx) => (
                <div 
                  key={step.id}
                  className={`flex flex-col items-center gap-1 ${
                    idx <= currentStep ? 'text-orange-600' : 'text-gray-300'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    idx < currentStep 
                      ? 'bg-green-500 text-white' 
                      : idx === currentStep 
                        ? 'bg-orange-500 text-white ring-4 ring-orange-100' 
                        : 'bg-gray-100'
                  }`}>
                    {idx < currentStep ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <step.icon className="w-4 h-4" />
                    )}
                  </div>
                  <span className="text-[10px] font-medium hidden sm:block">{step.title}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Step Content */}
          <div className="p-6 min-h-[380px]">
            <AnimatePresence mode="wait">
              {/* Step 1: Welcome */}
              {currentStep === 0 && (
                <motion.div
                  key="welcome"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="text-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-orange-400 to-amber-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                      <ChefHat className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800">
                      {LANGUAGES.find(l => l.value === selectedLanguage)?.greeting || 'Hello!'} 
                      <span className="ml-2">🙏</span>
                    </h2>
                    <p className="text-gray-600 mt-2">
                      Welcome to <span className="font-semibold text-orange-600">Rasoi-Sync</span>
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Your intelligent Indian kitchen manager
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium flex items-center gap-2 mb-2">
                        <Globe className="w-4 h-4 text-orange-500" />
                        Choose your language
                      </Label>
                      <div className="grid grid-cols-3 gap-2">
                        {LANGUAGES.map(lang => (
                          <button
                            key={lang.value}
                            onClick={() => handleLanguageSelect(lang.value)}
                            className={`p-3 rounded-xl border-2 transition-all ${
                              selectedLanguage === lang.value
                                ? 'border-orange-500 bg-orange-50 shadow-md'
                                : 'border-gray-200 hover:border-orange-300'
                            }`}
                          >
                            <span className="text-2xl">{lang.flag}</span>
                            <p className="text-sm font-medium mt-1">{lang.label}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm font-medium flex items-center gap-2 mb-2">
                        <MapPin className="w-4 h-4 text-orange-500" />
                        Your city
                      </Label>
                      <Select value={selectedCity} onValueChange={setSelectedCity}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CITIES.map(city => (
                            <SelectItem key={city} value={city}>{city}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Household Setup */}
              {currentStep === 1 && (
                <motion.div
                  key="household"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-5"
                >
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
                      <Home className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-800">
                      Set Up Your Kitchen
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Create a new kitchen or join your family's
                    </p>
                  </div>

                  {!createdCode ? (
                    <>
                      {/* Toggle */}
                      <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                        <button
                          onClick={() => setHouseholdMode('create')}
                          className={`flex-1 py-2.5 px-4 rounded-md font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                            householdMode === 'create'
                              ? 'bg-white shadow text-orange-600'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          <Home className="w-4 h-4" />
                          Create New
                        </button>
                        <button
                          onClick={() => setHouseholdMode('join')}
                          className={`flex-1 py-2.5 px-4 rounded-md font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                            householdMode === 'join'
                              ? 'bg-white shadow text-blue-600'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          <Users className="w-4 h-4" />
                          Join Family
                        </button>
                      </div>

                      {householdMode === 'create' ? (
                        <div className="space-y-4">
                          <div className="p-4 bg-orange-50 rounded-xl text-center">
                            <p className="text-sm text-gray-600">
                              🏠 Create your digital kitchen and get a code to share with family
                            </p>
                          </div>
                          <div>
                            <Label>Kitchen Name</Label>
                            <Input
                              placeholder="e.g., Sharma Family Kitchen"
                              value={householdName}
                              onChange={(e) => setHouseholdName(e.target.value)}
                              className="mt-1"
                            />
                          </div>
                          <Button
                            onClick={handleCreateHousehold}
                            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
                            disabled={loading || !householdName.trim()}
                          >
                            {loading ? 'Creating...' : 'Create Kitchen'}
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="p-4 bg-blue-50 rounded-xl text-center">
                            <p className="text-sm text-gray-600">
                              👨‍👩‍👧‍👦 Enter the 6-digit code shared by your family member
                            </p>
                          </div>
                          <div>
                            <Label>Kitchen Code</Label>
                            <Input
                              placeholder="ABC123"
                              value={kitchenCode}
                              onChange={(e) => setKitchenCode(e.target.value.toUpperCase())}
                              maxLength={6}
                              className="mt-1 text-center text-2xl tracking-widest font-mono"
                            />
                          </div>
                          <Button
                            onClick={handleJoinHousehold}
                            className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
                            disabled={loading || kitchenCode.length !== 6}
                          >
                            {loading ? 'Joining...' : 'Join Kitchen'}
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    /* Created - Show Code */
                    <div className="space-y-4 text-center">
                      <div className="p-5 bg-green-50 rounded-xl">
                        <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
                          <Check className="w-6 h-6 text-white" />
                        </div>
                        <h3 className="font-bold text-green-800 mb-2">Kitchen Created! 🎉</h3>
                        <p className="text-sm text-green-700 mb-3">Share this code with family:</p>
                        <div className="bg-white p-3 rounded-lg border-2 border-dashed border-green-300 inline-block">
                          <p className="text-3xl font-mono font-bold tracking-widest text-green-600">
                            {createdCode}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Step 3: Quick Pantry Setup */}
              {currentStep === 2 && (
                <motion.div
                  key="pantry"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
                      <Package className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-800">
                      Quick Pantry Setup
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Select items you usually have at home
                    </p>
                  </div>

                  <div className="space-y-3 max-h-[240px] overflow-y-auto pr-2">
                    {QUICK_PANTRY_ITEMS.map((category) => (
                      <div key={category.category} className="space-y-2">
                        <p className="text-sm font-medium text-gray-700">{category.category}</p>
                        <div className="flex flex-wrap gap-2">
                          {category.items.map((item) => (
                            <button
                              key={item}
                              onClick={() => togglePantryItem(item)}
                              className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                                selectedPantryItems.includes(item)
                                  ? 'bg-green-500 text-white shadow-md'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {selectedPantryItems.includes(item) && (
                                <Check className="w-3 h-3 inline mr-1" />
                              )}
                              {item}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-sm text-gray-500">
                      {selectedPantryItems.length} items selected
                    </span>
                    <Badge variant="outline" className="text-xs">
                      You can add more later
                    </Badge>
                  </div>
                </motion.div>
              )}

              {/* Step 4: Quick Tour */}
              {currentStep === 3 && (
                <motion.div
                  key="tour"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
                      <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-800">
                      You're All Set! 🎉
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Here's what you can do with Rasoi-Sync
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {TOUR_HIGHLIGHTS.map((item, idx) => (
                      <motion.div
                        key={item.title}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="p-3 bg-gray-50 rounded-xl border border-gray-100 hover:shadow-md transition-shadow"
                      >
                        <div className={`w-10 h-10 ${item.color} rounded-lg flex items-center justify-center mb-2`}>
                          <item.icon className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="font-semibold text-sm text-gray-800">{item.title}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                      </motion.div>
                    ))}
                  </div>

                  <div className="p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-100">
                    <div className="flex items-start gap-3">
                      <div className="text-3xl">👵</div>
                      <div>
                        <p className="font-medium text-gray-800 text-sm">Dadi's Tip</p>
                        <p className="text-xs text-gray-600 mt-0.5">
                          "Start by adding items you use daily. I'll help you track expiry dates and suggest recipes based on what's in your kitchen!"
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Navigation Buttons */}
          <div className="px-6 pb-6 flex gap-3">
            {currentStep > 0 && (
              <Button
                variant="outline"
                onClick={handleBack}
                className="flex-1"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            )}
            
            {currentStep < STEPS.length - 1 ? (
              <Button
                onClick={currentStep === 2 ? addPantryItems : handleNext}
                className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
                disabled={loading || (currentStep === 1 && !createdCode && householdMode === 'create')}
              >
                {loading ? 'Please wait...' : (
                  <>
                    {currentStep === 2 
                      ? (selectedPantryItems.length > 0 ? 'Add & Continue' : 'Skip for now')
                      : 'Continue'
                    }
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleComplete}
                className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
              >
                <Heart className="w-4 h-4 mr-2" />
                Start Cooking!
              </Button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default OnboardingFlow;
