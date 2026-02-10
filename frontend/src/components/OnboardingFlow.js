import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChefHat, Home, Users, Check, Globe, MapPin, Sparkles, Package, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

// Multi-language translations
const TRANSLATIONS = {
  en: {
    steps: {
      welcome: 'Welcome',
      household: 'Kitchen',
      ready: 'Ready!'
    },
    stepOf: 'Step {current} of {total}',
    skipSetup: 'Skip',
    welcomeTo: 'Welcome to',
    appName: 'Rasoi-Sync',
    appTagline: 'Your Intelligent Indian Kitchen Manager',
    chooseLanguage: 'Choose your language',
    yourCity: 'Your city',
    setUpKitchen: 'Set Up Your Kitchen',
    setUpKitchenDesc: 'Create your own kitchen or join a family member\'s kitchen',
    createNew: 'Create New',
    joinFamily: 'Join Family',
    createKitchenInfo: 'Create a kitchen and invite family members to collaborate on grocery lists and meal planning!',
    joinKitchenInfo: 'Enter the 6-digit code shared by your family member to join their kitchen.',
    kitchenName: 'Kitchen Name',
    kitchenNamePlaceholder: 'e.g., Sharma Family Kitchen',
    createKitchen: 'Create Kitchen',
    kitchenCode: '6-Digit Code',
    joinKitchen: 'Join Kitchen',
    kitchenCreated: 'Kitchen Created!',
    shareCode: 'Share this code with family:',
    continueBtn: 'Continue',
    allSet: "You're All Set! 🎉",
    essentialsLoaded: "We've loaded the 'Essentials' pack for you!",
    essentialsDesc: "Your kitchen now has 22 essential items pre-loaded. Update quantities to match your actual stock.",
    goToInventory: 'Go to Inventory',
    startExploring: 'Start Exploring',
    inventoryHint: 'Update your pantry quantities in the Inventory section'
  },
  hi: {
    steps: {
      welcome: 'स्वागत',
      household: 'किचन',
      ready: 'तैयार!'
    },
    stepOf: 'चरण {current} / {total}',
    skipSetup: 'छोड़ें',
    welcomeTo: 'स्वागत है',
    appName: 'रसोई-सिंक',
    appTagline: 'आपका बुद्धिमान भारतीय रसोई प्रबंधक',
    chooseLanguage: 'अपनी भाषा चुनें',
    yourCity: 'आपका शहर',
    setUpKitchen: 'अपना किचन सेट करें',
    setUpKitchenDesc: 'नया किचन बनाएं या परिवार के किचन से जुड़ें',
    createNew: 'नया बनाएं',
    joinFamily: 'परिवार से जुड़ें',
    createKitchenInfo: 'किचन बनाएं और परिवार के सदस्यों को आमंत्रित करें!',
    joinKitchenInfo: 'परिवार के सदस्य द्वारा साझा किया गया 6-अंकों का कोड दर्ज करें।',
    kitchenName: 'किचन का नाम',
    kitchenNamePlaceholder: 'जैसे, शर्मा परिवार किचन',
    createKitchen: 'किचन बनाएं',
    kitchenCode: '6-अंकों का कोड',
    joinKitchen: 'किचन में शामिल हों',
    kitchenCreated: 'किचन बन गया!',
    shareCode: 'परिवार के साथ कोड साझा करें:',
    continueBtn: 'जारी रखें',
    allSet: 'आप तैयार हैं! 🎉',
    essentialsLoaded: "हमने आपके लिए 'आवश्यक वस्तुएं' पैक लोड कर दिया है!",
    essentialsDesc: 'आपके किचन में 22 आवश्यक वस्तुएं पहले से लोड हैं। अपने स्टॉक के अनुसार मात्रा अपडेट करें।',
    goToInventory: 'इन्वेंट्री पर जाएं',
    startExploring: 'एक्सप्लोर करें',
    inventoryHint: 'इन्वेंट्री सेक्शन में अपनी पेंट्री की मात्रा अपडेट करें'
  },
  mr: {
    steps: {
      welcome: 'स्वागत',
      household: 'किचन',
      ready: 'तयार!'
    },
    stepOf: 'पायरी {current} / {total}',
    skipSetup: 'वगळा',
    welcomeTo: 'स्वागत आहे',
    appName: 'रसोई-सिंक',
    appTagline: 'तुमचा बुद्धिमान भारतीय किचन व्यवस्थापक',
    chooseLanguage: 'तुमची भाषा निवडा',
    yourCity: 'तुमचे शहर',
    setUpKitchen: 'तुमचे किचन सेट करा',
    setUpKitchenDesc: 'नवीन किचन तयार करा किंवा कुटुंबाच्या किचनमध्ये सामील व्हा',
    createNew: 'नवीन तयार करा',
    joinFamily: 'कुटुंबात सामील व्हा',
    createKitchenInfo: 'किचन तयार करा आणि कुटुंबातील सदस्यांना आमंत्रित करा!',
    joinKitchenInfo: 'कुटुंबातील सदस्याने शेअर केलेला 6-अंकी कोड टाका.',
    kitchenName: 'किचनचे नाव',
    kitchenNamePlaceholder: 'उदा., शर्मा कुटुंब किचन',
    createKitchen: 'किचन तयार करा',
    kitchenCode: '6-अंकी कोड',
    joinKitchen: 'किचनमध्ये सामील व्हा',
    kitchenCreated: 'किचन तयार झाले!',
    shareCode: 'कुटुंबासोबत कोड शेअर करा:',
    continueBtn: 'पुढे जा',
    allSet: 'तुम्ही तयार आहात! 🎉',
    essentialsLoaded: "आम्ही तुमच्यासाठी 'आवश्यक वस्तू' पॅक लोड केला आहे!",
    essentialsDesc: 'तुमच्या किचनमध्ये 22 आवश्यक वस्तू आधीच लोड आहेत. तुमच्या स्टॉकनुसार प्रमाण अपडेट करा.',
    goToInventory: 'इन्व्हेंटरीवर जा',
    startExploring: 'एक्सप्लोर करा',
    inventoryHint: 'इन्व्हेंटरी सेक्शनमध्ये तुमच्या पेंट्रीचे प्रमाण अपडेट करा'
  }
};

// Onboarding steps (simplified - removed pantry step)
const STEPS_CONFIG = [
  { id: 'welcome', key: 'welcome', icon: ChefHat },
  { id: 'household', key: 'household', icon: Home },
  { id: 'ready', key: 'ready', icon: Sparkles },
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

const OnboardingFlow = ({ onComplete }) => {
  const { user, updateProfile, createHousehold, joinHousehold, households } = useAuth();
  const navigate = useNavigate();
  
  // Determine start step based on user state
  const getInitialStep = () => {
    if (households && households.length > 0) {
      return 2; // Start at ready step (kitchen already exists)
    }
    if (user?.home_language) {
      return 1; // Start at household step (skip welcome/language)
    }
    return 0; // Start at welcome step
  };
  
  const [currentStep, setCurrentStep] = useState(getInitialStep);
  const [isVisible, setIsVisible] = useState(true);
  
  // Form state
  const [selectedLanguage, setSelectedLanguage] = useState(user?.home_language || 'en');
  const [selectedCity, setSelectedCity] = useState(user?.city || 'Pune');
  const [householdMode, setHouseholdMode] = useState('create');
  const [householdName, setHouseholdName] = useState('');
  const [kitchenCode, setKitchenCode] = useState('');
  const [createdCode, setCreatedCode] = useState('');
  const [essentialsCount, setEssentialsCount] = useState(22);
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

  const handleSkip = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (token) {
        await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/complete-onboarding`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }
    } catch (error) {
      console.error('Error marking onboarding complete:', error);
    }
    localStorage.setItem('onboarding_completed', 'true');
    setIsVisible(false);
    onComplete?.();
  };

  const handleComplete = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (token) {
        await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/complete-onboarding`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }
    } catch (error) {
      console.error('Error marking onboarding complete:', error);
    }
    localStorage.setItem('onboarding_completed', 'true');
    setIsVisible(false);
    const successMsg = selectedLanguage === 'hi' 
      ? '🎉 रसोई-सिंक में आपका स्वागत है!'
      : selectedLanguage === 'mr'
        ? '🎉 रसोई-सिंक मध्ये स्वागत!'
        : '🎉 Welcome to Rasoi-Sync!';
    toast.success(successMsg);
    onComplete?.();
  };

  const handleGoToInventory = async () => {
    await handleComplete();
    navigate('/inventory');
  };

  const handleLanguageSelect = async (lang) => {
    setSelectedLanguage(lang);
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
      setEssentialsCount(result.data.items_added || 22);
      toast.success(`Kitchen created with ${result.data.items_added || 22} essential items! 🏠`);
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

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center"
      >
        {/* Dimmed Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        
        {/* Modal Container */}
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
                  <span className="text-[10px] font-medium">{step.title}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Step Content */}
          <div className="p-6 flex-1 overflow-y-auto min-h-0">
            <AnimatePresence mode="wait">
              {/* Step 1: Welcome */}
              {currentStep === 0 && (
                <motion.div
                  key="welcome"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-5"
                >
                  <div className="text-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-orange-400 to-amber-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                      <ChefHat className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800">
                      {LANGUAGES.find(l => l.value === selectedLanguage)?.greeting || 'Hello!'} 
                      <span className="ml-2">🙏</span>
                    </h2>
                    <p className="text-base text-gray-600 mt-2">
                      {t.welcomeTo} <span className="font-semibold text-orange-600">{t.appName}</span>
                    </p>
                    <p className="text-sm text-gray-500 mt-1">{t.appTagline}</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium flex items-center gap-2 mb-2">
                        <Globe className="w-4 h-4 text-orange-500" />
                        {t.chooseLanguage}
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
                        {t.yourCity}
                      </Label>
                      <Select value={selectedCity} onValueChange={setSelectedCity}>
                        <SelectTrigger className="h-10">
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
                    <h2 className="text-xl font-bold text-gray-800">{t.setUpKitchen}</h2>
                    <p className="text-sm text-gray-500 mt-1">{t.setUpKitchenDesc}</p>
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
                          {t.createNew}
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
                          {t.joinFamily}
                        </button>
                      </div>

                      {householdMode === 'create' ? (
                        <div className="space-y-4">
                          <div className="p-4 bg-orange-50 rounded-xl text-center">
                            <p className="text-sm text-gray-600">{t.createKitchenInfo}</p>
                          </div>
                          <div>
                            <Label>{t.kitchenName}</Label>
                            <Input
                              placeholder={t.kitchenNamePlaceholder}
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
                            {loading ? '...' : t.createKitchen}
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="p-4 bg-blue-50 rounded-xl text-center">
                            <p className="text-sm text-gray-600">{t.joinKitchenInfo}</p>
                          </div>
                          <div>
                            <Label>{t.kitchenCode}</Label>
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
                            {loading ? '...' : t.joinKitchen}
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    /* Kitchen Created - Show Code */
                    <div className="space-y-4 text-center">
                      <div className="p-5 bg-green-50 rounded-xl">
                        <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
                          <Check className="w-6 h-6 text-white" />
                        </div>
                        <h3 className="font-bold text-green-800 mb-2">{t.kitchenCreated}</h3>
                        <p className="text-sm text-green-700 mb-3">{t.shareCode}</p>
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

              {/* Step 3: Ready - Essentials Loaded */}
              {currentStep === 2 && (
                <motion.div
                  key="ready"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-5"
                >
                  <div className="text-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                      <Sparkles className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800">{t.allSet}</h2>
                  </div>

                  {/* Essentials Loaded Banner */}
                  <div className="p-5 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <Package className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-amber-800 text-lg">{t.essentialsLoaded}</h3>
                        <p className="text-sm text-amber-700 mt-1">{t.essentialsDesc}</p>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-3">
                    <Button
                      onClick={handleGoToInventory}
                      className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 h-12 text-base"
                      data-testid="go-to-inventory-btn"
                    >
                      <Package className="w-5 h-5 mr-2" />
                      {t.goToInventory}
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                    
                    <Button
                      variant="outline"
                      onClick={handleComplete}
                      className="w-full h-11"
                      data-testid="start-exploring-btn"
                    >
                      {t.startExploring}
                    </Button>
                  </div>

                  <p className="text-xs text-center text-gray-500">
                    💡 {t.inventoryHint}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Navigation Buttons */}
          {currentStep < 2 && (
            <div className="px-6 pb-6 pt-2">
              <Button
                onClick={handleNext}
                className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
                disabled={currentStep === 1 && !createdCode && householdMode === 'create'}
              >
                {t.continueBtn}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default OnboardingFlow;
