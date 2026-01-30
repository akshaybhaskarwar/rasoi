import { createContext, useContext, useState, useEffect } from 'react';

// Supported languages
export const SUPPORTED_LANGUAGES = {
  en: { name: 'English', native: 'English', flag: '🇬🇧' },
  hi: { name: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
  mr: { name: 'Marathi', native: 'मराठी', flag: '🇮🇳' }
};

// UI Labels for common buttons/text
export const UI_LABELS = {
  en: {
    add: 'Add',
    edit: 'Edit',
    delete: 'Delete',
    save: 'Save',
    cancel: 'Cancel',
    search: 'Search',
    filter: 'Filter',
    inventory: 'Inventory',
    shopping: 'Shopping List',
    planner: 'Meal Planner',
    home: 'Home',
    addItem: 'Add Item',
    noItems: 'No items',
    stockLevel: 'Stock Level',
    full: 'Full',
    half: 'Half',
    low: 'Low',
    empty: 'Empty',
    category: 'Category',
    allCategories: 'All Categories',
    expiringItems: 'Items Expiring Soon!',
    addToCart: 'Add to Cart',
    remove: 'Remove',
    verifyTranslation: 'Looks Right',
    editTranslation: 'Edit Translation',
    aiTranslated: 'AI Translated',
    communityVerified: 'Community Verified',
    yourCustomTerm: 'Your Custom Term'
  },
  hi: {
    add: 'जोड़ें',
    edit: 'संपादित करें',
    delete: 'हटाएं',
    save: 'सहेजें',
    cancel: 'रद्द करें',
    search: 'खोजें',
    filter: 'फ़िल्टर',
    inventory: 'सामान',
    shopping: 'खरीदारी सूची',
    planner: 'भोजन योजना',
    home: 'होम',
    addItem: 'वस्तु जोड़ें',
    noItems: 'कोई वस्तु नहीं',
    stockLevel: 'स्टॉक स्तर',
    full: 'पूरा',
    half: 'आधा',
    low: 'कम',
    empty: 'खाली',
    category: 'श्रेणी',
    allCategories: 'सभी श्रेणियां',
    expiringItems: 'जल्द समाप्त होने वाली वस्तुएं!',
    addToCart: 'कार्ट में डालें',
    remove: 'हटाएं',
    verifyTranslation: 'सही है',
    editTranslation: 'अनुवाद संपादित करें',
    aiTranslated: 'AI अनुवादित',
    communityVerified: 'समुदाय सत्यापित',
    yourCustomTerm: 'आपका कस्टम शब्द'
  },
  mr: {
    add: 'जोडा',
    edit: 'संपादित करा',
    delete: 'हटवा',
    save: 'जतन करा',
    cancel: 'रद्द करा',
    search: 'शोधा',
    filter: 'फिल्टर',
    inventory: 'साठा',
    shopping: 'खरेदी यादी',
    planner: 'जेवण नियोजक',
    home: 'मुख्यपृष्ठ',
    addItem: 'वस्तू जोडा',
    noItems: 'वस्तू नाहीत',
    stockLevel: 'साठा पातळी',
    full: 'पूर्ण',
    half: 'अर्धा',
    low: 'कमी',
    empty: 'रिकामे',
    category: 'वर्ग',
    allCategories: 'सर्व वर्ग',
    expiringItems: 'लवकरच संपणाऱ्या वस्तू!',
    addToCart: 'कार्टमध्ये टाका',
    remove: 'काढा',
    verifyTranslation: 'बरोबर आहे',
    editTranslation: 'भाषांतर संपादित करा',
    aiTranslated: 'AI भाषांतरित',
    communityVerified: 'समुदाय सत्यापित',
    yourCustomTerm: 'तुमचा कस्टम शब्द'
  }
};

// Context
const LanguageContext = createContext(null);

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    // Get from localStorage or default to 'en'
    return localStorage.getItem('rasoi_language') || 'en';
  });

  // Persist language change
  const changeLanguage = (lang) => {
    if (SUPPORTED_LANGUAGES[lang]) {
      setLanguage(lang);
      localStorage.setItem('rasoi_language', lang);
    }
  };

  // Get UI label
  const getLabel = (key) => {
    return UI_LABELS[language]?.[key] || UI_LABELS.en[key] || key;
  };

  // Get translated name based on current language
  const getTranslatedName = (item) => {
    if (language === 'en') return item.name_en;
    if (language === 'hi' && item.name_hi) return `${item.name_en} / ${item.name_hi}`;
    if (language === 'mr' && item.name_mr) return `${item.name_en} / ${item.name_mr}`;
    return item.name_en;
  };

  // Get just the regional name
  const getRegionalName = (item) => {
    if (language === 'hi') return item.name_hi || null;
    if (language === 'mr') return item.name_mr || null;
    return null;
  };

  const value = {
    language,
    changeLanguage,
    getLabel,
    getTranslatedName,
    getRegionalName,
    isEnglish: language === 'en',
    isHindi: language === 'hi',
    isMarathi: language === 'mr',
    languageInfo: SUPPORTED_LANGUAGES[language]
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

// Hook to use language context
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export default LanguageContext;
