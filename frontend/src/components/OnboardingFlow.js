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

// Translations for onboarding flow
const TRANSLATIONS = {
  en: {
    // Step indicators
    stepOf: 'Step {current} of {total}',
    skipSetup: 'Skip setup',
    steps: {
      welcome: 'Welcome',
      household: 'Your Kitchen',
      pantry: 'Stock Pantry',
      tour: 'Quick Tour'
    },
    // Step 1: Welcome
    welcomeTo: 'Welcome to',
    appName: 'Rasoi-Sync',
    appTagline: 'Your intelligent Indian kitchen manager',
    chooseLanguage: 'Choose your language',
    yourCity: 'Your city',
    // Step 2: Household
    setUpKitchen: 'Set Up Your Kitchen',
    setUpKitchenDesc: 'Create a new kitchen or join your family\'s',
    createNew: 'Create New',
    joinFamily: 'Join Family',
    createKitchenInfo: '🏠 Create your digital kitchen and get a code to share with family',
    joinKitchenInfo: '👨‍👩‍👧‍👦 Enter the 6-digit code shared by your family member',
    kitchenName: 'Kitchen Name',
    kitchenNamePlaceholder: 'e.g., Sharma Family Kitchen',
    createKitchen: 'Create Kitchen',
    kitchenCode: 'Kitchen Code',
    joinKitchen: 'Join Kitchen',
    kitchenCreated: 'Kitchen Created! 🎉',
    shareCode: 'Share this code with family:',
    // Step 3: Pantry
    quickPantrySetup: 'Quick Pantry Setup',
    selectItems: 'Select items you usually have at home',
    itemsSelected: '{count} items selected',
    addMoreLater: 'Add more later',
    // Step 4: Tour
    allSet: 'You\'re All Set! 🎉',
    hereIsWhatYouCanDo: 'Here\'s what you can do with Rasoi-Sync',
    dadiTip: 'Dadi\'s Tip',
    dadiMessage: '"Start by adding items you use daily. I\'ll help track expiry dates and suggest recipes!"',
    // Tour highlights
    inventory: 'Inventory',
    inventoryDesc: 'Track what\'s in your kitchen with smart stock levels',
    shoppingList: 'Shopping List',
    shoppingListDesc: 'Auto-generated lists synced with family members',
    mealPlanner: 'Meal Planner',
    mealPlannerDesc: 'Plan weekly meals with YouTube recipe integration',
    digitalDadi: 'Digital Dadi',
    digitalDadiDesc: 'Your AI kitchen assistant with smart suggestions',
    // Buttons
    continue: 'Continue',
    back: 'Back',
    skip: 'Skip',
    addAndContinue: 'Add & Continue',
    startCooking: 'Start Cooking!',
    // Pantry categories
    grains: '🌾 Grains',
    pulses: '🫘 Pulses',
    spices: '🌶️ Spices',
    oils: '🧴 Oils'
  },
  hi: {
    // Step indicators
    stepOf: 'चरण {current} / {total}',
    skipSetup: 'छोड़ें',
    steps: {
      welcome: 'स्वागत',
      household: 'आपका किचन',
      pantry: 'राशन भरें',
      tour: 'परिचय'
    },
    // Step 1: Welcome
    welcomeTo: 'आपका स्वागत है',
    appName: 'रसोई-सिंक',
    appTagline: 'आपका बुद्धिमान भारतीय रसोई प्रबंधक',
    chooseLanguage: 'अपनी भाषा चुनें',
    yourCity: 'आपका शहर',
    // Step 2: Household
    setUpKitchen: 'अपना किचन सेट करें',
    setUpKitchenDesc: 'नया किचन बनाएं या परिवार से जुड़ें',
    createNew: 'नया बनाएं',
    joinFamily: 'परिवार से जुड़ें',
    createKitchenInfo: '🏠 अपना डिजिटल किचन बनाएं और परिवार के साथ कोड शेयर करें',
    joinKitchenInfo: '👨‍👩‍👧‍👦 परिवार के सदस्य द्वारा शेयर किया गया 6-अंकों का कोड दर्ज करें',
    kitchenName: 'किचन का नाम',
    kitchenNamePlaceholder: 'जैसे: शर्मा परिवार का किचन',
    createKitchen: 'किचन बनाएं',
    kitchenCode: 'किचन कोड',
    joinKitchen: 'किचन से जुड़ें',
    kitchenCreated: 'किचन बन गया! 🎉',
    shareCode: 'यह कोड परिवार के साथ शेयर करें:',
    // Step 3: Pantry
    quickPantrySetup: 'जल्दी राशन सेटअप',
    selectItems: 'जो सामान आमतौर पर घर में होता है उसे चुनें',
    itemsSelected: '{count} सामान चुने गए',
    addMoreLater: 'बाद में और जोड़ें',
    // Step 4: Tour
    allSet: 'सब तैयार है! 🎉',
    hereIsWhatYouCanDo: 'रसोई-सिंक में आप यह कर सकते हैं',
    dadiTip: 'दादी की सलाह',
    dadiMessage: '"रोज़ाना इस्तेमाल होने वाली चीज़ें पहले जोड़ें। मैं एक्सपायरी डेट और रेसिपी में मदद करूंगी!"',
    // Tour highlights
    inventory: 'स्टॉक',
    inventoryDesc: 'किचन में क्या है, स्मार्ट तरीके से ट्रैक करें',
    shoppingList: 'खरीदारी सूची',
    shoppingListDesc: 'परिवार के साथ ऑटो-सिंक होने वाली सूची',
    mealPlanner: 'भोजन योजना',
    mealPlannerDesc: 'YouTube रेसिपी के साथ साप्ताहिक मेन्यू',
    digitalDadi: 'डिजिटल दादी',
    digitalDadiDesc: 'स्मार्ट सुझाव देने वाली AI सहायक',
    // Buttons
    continue: 'आगे बढ़ें',
    back: 'वापस',
    skip: 'छोड़ें',
    addAndContinue: 'जोड़ें और आगे बढ़ें',
    startCooking: 'खाना बनाना शुरू करें!',
    // Pantry categories
    grains: '🌾 अनाज',
    pulses: '🫘 दालें',
    spices: '🌶️ मसाले',
    oils: '🧴 तेल'
  },
  mr: {
    // Step indicators
    stepOf: 'पायरी {current} / {total}',
    skipSetup: 'वगळा',
    steps: {
      welcome: 'स्वागत',
      household: 'तुमचे किचन',
      pantry: 'साठा भरा',
      tour: 'ओळख'
    },
    // Step 1: Welcome
    welcomeTo: 'स्वागत आहे',
    appName: 'रसोई-सिंक',
    appTagline: 'तुमचा हुशार भारतीय स्वयंपाकघर व्यवस्थापक',
    chooseLanguage: 'तुमची भाषा निवडा',
    yourCity: 'तुमचे शहर',
    // Step 2: Household
    setUpKitchen: 'तुमचे किचन सेट करा',
    setUpKitchenDesc: 'नवीन किचन तयार करा किंवा कुटुंबात सामील व्हा',
    createNew: 'नवीन तयार करा',
    joinFamily: 'कुटुंबात सामील व्हा',
    createKitchenInfo: '🏠 तुमचे डिजिटल किचन तयार करा आणि कुटुंबासोबत कोड शेअर करा',
    joinKitchenInfo: '👨‍👩‍👧‍👦 कुटुंबातील सदस्याने शेअर केलेला 6-अंकी कोड टाका',
    kitchenName: 'किचनचे नाव',
    kitchenNamePlaceholder: 'उदा: शर्मा कुटुंबाचे किचन',
    createKitchen: 'किचन तयार करा',
    kitchenCode: 'किचन कोड',
    joinKitchen: 'किचनमध्ये सामील व्हा',
    kitchenCreated: 'किचन तयार झाले! 🎉',
    shareCode: 'हा कोड कुटुंबासोबत शेअर करा:',
    // Step 3: Pantry
    quickPantrySetup: 'जलद साठा सेटअप',
    selectItems: 'सहसा घरी असलेल्या वस्तू निवडा',
    itemsSelected: '{count} वस्तू निवडल्या',
    addMoreLater: 'नंतर अधिक जोडा',
    // Step 4: Tour
    allSet: 'सगळं तयार आहे! 🎉',
    hereIsWhatYouCanDo: 'रसोई-सिंक मध्ये तुम्ही हे करू शकता',
    dadiTip: 'आजीची टीप',
    dadiMessage: '"रोज वापरल्या जाणाऱ्या गोष्टी आधी जोडा. मी एक्सपायरी डेट आणि रेसिपीमध्ये मदत करेन!"',
    // Tour highlights
    inventory: 'साठा',
    inventoryDesc: 'किचनमध्ये काय आहे, स्मार्ट पद्धतीने ट्रॅक करा',
    shoppingList: 'खरेदी यादी',
    shoppingListDesc: 'कुटुंबासोबत ऑटो-सिंक होणारी यादी',
    mealPlanner: 'जेवण नियोजन',
    mealPlannerDesc: 'YouTube रेसिपीसह साप्ताहिक मेनू',
    digitalDadi: 'डिजिटल आजी',
    digitalDadiDesc: 'स्मार्ट सूचना देणारी AI सहाय्यक',
    // Buttons
    continue: 'पुढे चला',
    back: 'मागे',
    skip: 'वगळा',
    addAndContinue: 'जोडा आणि पुढे चला',
    startCooking: 'स्वयंपाक सुरू करा!',
    // Pantry categories
    grains: '🌾 धान्य',
    pulses: '🫘 कडधान्ये',
    spices: '🌶️ मसाले',
    oils: '🧴 तेल'
  }
};

// Onboarding steps configuration (will be translated)
const STEPS_CONFIG = [
  { id: 'welcome', key: 'welcome', icon: ChefHat },
  { id: 'household', key: 'household', icon: Home },
  { id: 'pantry', key: 'pantry', icon: Package },
  { id: 'tour', key: 'tour', icon: Sparkles },
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
  { categoryKey: 'grains', items: ['Rice (चावल)', 'Wheat Flour (गेहूं आटा)', 'Rava (रवा)'] },
  { categoryKey: 'pulses', items: ['Toor Dal (तूर दाल)', 'Moong Dal (मूंग दाल)', 'Chana (चना)'] },
  { categoryKey: 'spices', items: ['Turmeric (हळद)', 'Red Chili (लाल मिर्च)', 'Cumin (जीरा)'] },
  { categoryKey: 'oils', items: ['Cooking Oil (तेल)', 'Ghee (तूप)', 'Mustard Oil (सरसों तेल)'] },
];

const TOUR_HIGHLIGHTS = [
  {
    icon: Package,
    titleKey: 'inventory',
    descKey: 'inventoryDesc',
    color: 'bg-amber-500'
  },
  {
    icon: ShoppingBasket,
    titleKey: 'shoppingList',
    descKey: 'shoppingListDesc',
    color: 'bg-green-500'
  },
  {
    icon: Calendar,
    titleKey: 'mealPlanner',
    descKey: 'mealPlannerDesc',
    color: 'bg-blue-500'
  },
  {
    icon: Sparkles,
    titleKey: 'digitalDadi',
    descKey: 'digitalDadiDesc',
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

  // Get translations for current language
  const t = TRANSLATIONS[selectedLanguage] || TRANSLATIONS.en;
  const STEPS = STEPS_CONFIG.map(step => ({
    ...step,
    title: t.steps[step.key]
  }));

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
    const successMsg = selectedLanguage === 'hi' 
      ? '🎉 रसोई-सिंक में आपका स्वागत है! आपका किचन तैयार है।'
      : selectedLanguage === 'mr'
        ? '🎉 रसोई-सिंक मध्ये स्वागत! तुमचे किचन तयार आहे।'
        : '🎉 Welcome to Rasoi-Sync! Your kitchen is ready.';
    toast.success(successMsg);
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
          className="relative w-full max-w-lg mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        >
          {/* Progress Bar */}
          <div className="px-6 pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 font-medium">
                {t.stepOf.replace('{current}', currentStep + 1).replace('{total}', STEPS.length)}
              </span>
              <button 
                onClick={handleSkip}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                {t.skipSetup}
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
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all ${
                    idx < currentStep 
                      ? 'bg-green-500 text-white' 
                      : idx === currentStep 
                        ? 'bg-orange-500 text-white ring-2 sm:ring-4 ring-orange-100' 
                        : 'bg-gray-100'
                  }`}>
                    {idx < currentStep ? (
                      <Check className="w-3 h-3 sm:w-4 sm:h-4" />
                    ) : (
                      <step.icon className="w-3 h-3 sm:w-4 sm:h-4" />
                    )}
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-medium hidden xs:block">{step.title}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Step Content */}
          <div className="p-4 sm:p-6 flex-1 overflow-y-auto min-h-0">
            <AnimatePresence mode="wait">
              {/* Step 1: Welcome */}
              {currentStep === 0 && (
                <motion.div
                  key="welcome"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4 sm:space-y-6"
                >
                  <div className="text-center">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-orange-400 to-amber-500 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-lg">
                      <ChefHat className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
                      {LANGUAGES.find(l => l.value === selectedLanguage)?.greeting || 'Hello!'} 
                      <span className="ml-2">🙏</span>
                    </h2>
                    <p className="text-sm sm:text-base text-gray-600 mt-1 sm:mt-2">
                      {t.welcomeTo} <span className="font-semibold text-orange-600">{t.appName}</span>
                    </p>
                    <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1">
                      {t.appTagline}
                    </p>
                  </div>

                  <div className="space-y-3 sm:space-y-4">
                    <div>
                      <Label className="text-xs sm:text-sm font-medium flex items-center gap-2 mb-2">
                        <Globe className="w-3 h-3 sm:w-4 sm:h-4 text-orange-500" />
                        {t.chooseLanguage}
                      </Label>
                      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                        {LANGUAGES.map(lang => (
                          <button
                            key={lang.value}
                            onClick={() => handleLanguageSelect(lang.value)}
                            className={`p-2 sm:p-3 rounded-xl border-2 transition-all ${
                              selectedLanguage === lang.value
                                ? 'border-orange-500 bg-orange-50 shadow-md'
                                : 'border-gray-200 hover:border-orange-300'
                            }`}
                          >
                            <span className="text-xl sm:text-2xl">{lang.flag}</span>
                            <p className="text-xs sm:text-sm font-medium mt-0.5 sm:mt-1">{lang.label}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs sm:text-sm font-medium flex items-center gap-2 mb-2">
                        <MapPin className="w-3 h-3 sm:w-4 sm:h-4 text-orange-500" />
                        {t.yourCity}
                      </Label>
                      <Select value={selectedCity} onValueChange={setSelectedCity}>
                        <SelectTrigger className="h-9 sm:h-10">
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
                  className="space-y-3 sm:space-y-4"
                >
                  <div className="text-center">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3 shadow-lg">
                      <Package className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                    </div>
                    <h2 className="text-lg sm:text-xl font-bold text-gray-800">
                      Quick Pantry Setup
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
                      Select items you usually have at home
                    </p>
                  </div>

                  <div className="space-y-2 sm:space-y-3 max-h-[180px] sm:max-h-[220px] overflow-y-auto pr-1 sm:pr-2">
                    {QUICK_PANTRY_ITEMS.map((category) => (
                      <div key={category.category} className="space-y-1.5 sm:space-y-2">
                        <p className="text-xs sm:text-sm font-medium text-gray-700">{category.category}</p>
                        <div className="flex flex-wrap gap-1.5 sm:gap-2">
                          {category.items.map((item) => (
                            <button
                              key={item}
                              onClick={() => togglePantryItem(item)}
                              className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm transition-all ${
                                selectedPantryItems.includes(item)
                                  ? 'bg-green-500 text-white shadow-md'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {selectedPantryItems.includes(item) && (
                                <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 inline mr-0.5 sm:mr-1" />
                              )}
                              {item}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-xs sm:text-sm text-gray-500">
                      {selectedPantryItems.length} items selected
                    </span>
                    <Badge variant="outline" className="text-[10px] sm:text-xs">
                      Add more later
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
                  className="space-y-3 sm:space-y-4"
                >
                  <div className="text-center">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3 shadow-lg">
                      <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                    </div>
                    <h2 className="text-lg sm:text-xl font-bold text-gray-800">
                      You're All Set! 🎉
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
                      Here's what you can do with Rasoi-Sync
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    {TOUR_HIGHLIGHTS.map((item, idx) => (
                      <motion.div
                        key={item.title}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="p-2 sm:p-3 bg-gray-50 rounded-xl border border-gray-100 hover:shadow-md transition-shadow"
                      >
                        <div className={`w-8 h-8 sm:w-10 sm:h-10 ${item.color} rounded-lg flex items-center justify-center mb-1.5 sm:mb-2`}>
                          <item.icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                        </div>
                        <h3 className="font-semibold text-xs sm:text-sm text-gray-800">{item.title}</h3>
                        <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 line-clamp-2">{item.description}</p>
                      </motion.div>
                    ))}
                  </div>

                  <div className="p-3 sm:p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-100">
                    <div className="flex items-start gap-2 sm:gap-3">
                      <div className="text-2xl sm:text-3xl">👵</div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-800 text-xs sm:text-sm">Dadi's Tip</p>
                        <p className="text-[10px] sm:text-xs text-gray-600 mt-0.5">
                          "Start by adding items you use daily. I'll help track expiry dates and suggest recipes!"
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Navigation Buttons */}
          <div className="px-4 sm:px-6 pb-4 sm:pb-6 pt-2 flex gap-2 sm:gap-3 border-t bg-white flex-shrink-0">
            {currentStep > 0 && (
              <Button
                variant="outline"
                onClick={handleBack}
                className="flex-1 h-10 sm:h-11 text-sm"
              >
                <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                Back
              </Button>
            )}
            
            {currentStep < STEPS.length - 1 ? (
              <Button
                onClick={currentStep === 2 ? addPantryItems : handleNext}
                className="flex-1 h-10 sm:h-11 text-sm bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
                disabled={loading || (currentStep === 1 && !createdCode && householdMode === 'create')}
              >
                {loading ? 'Please wait...' : (
                  <>
                    <span className="truncate">
                      {currentStep === 2 
                        ? (selectedPantryItems.length > 0 ? 'Add & Continue' : 'Skip')
                        : 'Continue'
                      }
                    </span>
                    <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2 flex-shrink-0" />
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleComplete}
                className="flex-1 h-10 sm:h-11 text-sm bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
              >
                <Heart className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
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
