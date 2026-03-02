import { createContext, useContext, useState, useEffect } from 'react';

// Supported languages
export const SUPPORTED_LANGUAGES = {
  en: { name: 'English', native: 'English', flag: '🇬🇧' },
  hi: { name: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
  mr: { name: 'Marathi', native: 'मराठी', flag: '🇮🇳' }
};

// UI Labels for common buttons/text - Comprehensive translations
export const UI_LABELS = {
  en: {
    // App branding
    appName: 'Rasoi-Sync',
    appTagline: 'Your Smart Kitchen Manager',
    indianKitchen: 'Indian Kitchen',
    
    // Navigation
    home: 'Home',
    inventory: 'Inventory',
    shopping: 'Shopping List',
    planner: 'Meal Planner',
    recipes: 'Recipes',
    community: 'Community',
    
    // Common actions
    add: 'Add',
    edit: 'Edit',
    delete: 'Delete',
    save: 'Save',
    cancel: 'Cancel',
    search: 'Search',
    filter: 'Filter',
    remove: 'Remove',
    clear: 'Clear',
    sync: 'Sync',
    refresh: 'Refresh',
    close: 'Close',
    confirm: 'Confirm',
    back: 'Back',
    next: 'Next',
    done: 'Done',
    
    // Inventory page
    addItem: 'Add Item',
    addNewItem: 'Add New Item',
    itemName: 'Item Name',
    noItems: 'No items',
    noItemsFound: 'No items found in inventory',
    stockLevel: 'Stock Level',
    fullStock: 'Full Stock',
    halfStock: 'Half Stock',
    lowStock: 'Low Stock',
    emptyStock: 'Empty',
    full: 'Full',
    half: 'Half',
    low: 'Low',
    empty: 'Empty',
    category: 'Category',
    allCategories: 'All Categories',
    expiryDate: 'Expiry Date',
    expiringItems: 'Items Expiring Soon!',
    expired: 'Expired',
    expiresIn: 'Expires in',
    days: 'days',
    today: 'Today',
    browseTemplate: 'Browse Template',
    indianPantryTemplate: 'Indian Pantry Template',
    scanProduct: 'Scan Product',
    secretStash: "Mummy's Secret Stash",
    monthlyNeed: 'Monthly Need',
    
    // Shopping page
    shoppingList: 'Shopping List',
    smartShoppingAssistant: 'Your smart shopping assistant',
    groceryStore: 'Grocery Store',
    localMandi: 'Local Mandi',
    sendToWhatsApp: 'Send to WhatsApp',
    copyToClipboard: 'Copy to Clipboard',
    syncLowStock: 'Sync Low Stock',
    addToShoppingList: 'Add to Shopping List',
    emptyShoppingList: 'Your shopping list is empty',
    addItemsToStart: 'Add items to get started',
    
    // Planner page
    mealPlanner: 'Meal Planner',
    planYourWeek: 'Plan your week with delicious recipes',
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    snacks: 'Snacks',
    dinner: 'Dinner',
    findRecipe: 'Find Recipe',
    addRecipe: 'Add Recipe',
    noMealPlanned: 'No meal planned',
    youTubeVideos: 'YouTube Videos',
    dadiRecommends: "Dadi's Recommendations",
    cookWithYourStock: 'Cook with Your Stock',
    addToPlan: 'Add to Plan',
    removeFromPlan: 'Remove from Plan',
    watchVideo: 'Watch',
    servings: 'Servings',
    ingredients: 'Ingredients',
    reservedIngredients: 'Reserved Ingredients',
    favoriteChannels: 'Favorite Channels',
    addChannel: 'Add Channel',
    
    // Translation verification
    verifyTranslation: 'Looks Right',
    editTranslation: 'Edit Translation',
    aiTranslated: 'AI Translated',
    communityVerified: 'Community Verified',
    yourCustomTerm: 'Your Custom Term',
    goldVerified: 'Gold Verified',
    
    // Common phrases
    quickAccess: 'Quick Access',
    itemsInStock: 'Items in Stock',
    itemsTotal: 'items total',
    lastUpdated: 'Last updated',
    selectLanguage: 'Select Language',
    manageYourKitchen: 'Manage your kitchen stock',
    quickPicks: 'Quick picks available!',
    mealsPlanned: 'Meals Planned',
    
    // Home page
    welcomeTo: 'Welcome to',
    welcomeMessage: 'Welcome to Rasoi-Sync',
    intelligentKitchenCompanion: 'Your intelligent kitchen companion',
    lowStockItems: 'Low Stock Items',
    missingItems: 'Missing Items',
    missingIngredients: 'Missing Ingredients',
    recentUpdates: 'Recent Updates',
    viewAll: 'View All',
    forMeal: 'For',
    onDate: 'On',
    
    // Planner page
    planYourWeeklyMeals: 'Plan your weekly meals with recipes',
    gapAnalysis: 'Gap Analysis',
    missingIngredientsForMeals: 'Missing ingredients for planned meals',
    cookWithYourStock: 'Cook with Your Stock',
    recipesFromFavoriteChannels: 'Recipes from your favorite channels matching your pantry',
    recipesFromChannelsAppearFirst: 'Recipes from these channels appear first',
    minIngredientsMatch: 'Minimum ingredients match:',
    
    // Days
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday',
    
    // Categories
    grains: 'Grains & Rice',
    pulses: 'Pulses & Lentils',
    spices: 'Spices & Masala',
    vegetables: 'Vegetables',
    fruits: 'Fruits',
    dairy: 'Dairy',
    oils: 'Oils & Ghee',
    bakery: 'Bakery Items',
    fasting: 'Upvas/Fasting',
    snacksCategory: 'Snacks & Ready Mix',
    beverages: 'Tea & Coffee',
    other: 'Other',
    
    // About Page
    aboutRasoiSync: 'About Rasoi-Sync',
    aboutTagline: 'Your Smart Kitchen Companion - Manage inventory, plan meals, discover recipes, and shop together as a family.',
    backToHome: 'Back to Home',
    quickSetupGuide: 'Quick Setup Guide',
    getStartedSteps: 'Get started with Rasoi-Sync in 6 simple steps',
    featureGuide: 'Feature Guide',
    clickToLearn: 'Click on each feature to learn more with examples',
    completeWorkflow: 'Complete Kitchen Workflow',
    emptyToOrganized: 'From empty pantry to organized kitchen',
    whyRasoiSync: 'Why Rasoi-Sync?',
    builtForIndian: 'Built for Indian families, by Indian developers',
    readyToOrganize: 'Ready to Organize Your Kitchen?',
    joinFamilies: 'Join thousands of families already using Rasoi-Sync',
    getStartedNow: 'Get Started Now',
    madeWithLove: 'Made with love in India',
    appIdea: 'App Idea',
    appDevelopment: 'App Development',
    poweredBy: 'Powered by',
    buildingForBharat: 'Building for Bharat',
    
    // About - Features
    familyKitchen: 'Family Kitchen',
    collaborativeHousehold: 'Collaborative household management',
    smartInventory: 'Smart Inventory',
    trackPantry: 'Track your pantry efficiently',
    smartShoppingList: 'Smart Shopping List',
    neverForget: 'Never forget items again',
    recipeDiscovery: 'Recipe Discovery',
    cookWithWhat: 'Cook with what you have',
    mealPlanner: 'Meal Planner',
    planWeekAhead: 'Plan your week ahead',
    communityKitchen: 'Community Kitchen',
    shareWithNeighbors: 'Share with neighbors',
    
    // About - Why sections
    multiLanguage: 'Multi-language',
    availableIn: 'Available in English, Hindi, and Marathi',
    familyFocused: 'Family Focused',
    entireFamilyShops: 'Entire family shops & manages together',
    mobileFirst: 'Mobile First',
    designedForShopping: 'Designed for shopping on-the-go',
    aiPowered: 'AI Powered',
    smartSuggestions: 'Smart suggestions & recipe matching',
    
    // About - Setup Steps
    createAccountKitchen: 'Create Account & Kitchen',
    signUpCreate: 'Sign up with email and create your family kitchen',
    addInitialInventory: 'Add Initial Inventory',
    addItemsCurrently: 'Add items currently in your kitchen',
    inviteFamilyMembers: 'Invite Family Members',
    shareKitchenCode: 'Share kitchen code with family',
    useShoppingList: 'Use Shopping List',
    shopSmartly: 'Shop smartly with auto-generated lists',
    planYourMeals: 'Plan Your Meals',
    neverWonderCook: 'Never wonder what to cook',
    discoverRecipes: 'Discover Recipes',
    cookWithWhatYouHave: 'Cook with what you have',
    
    // About - Workflow Phases
    dayOneSetup: 'Day 1: Setup Your Kitchen',
    weeklyPlanShop: 'Weekly: Plan & Shop',
    dailyCookEnjoy: 'Daily: Cook & Enjoy',
    monthlyReviewOptimize: 'Monthly: Review & Optimize'
  },
  hi: {
    // App branding
    appName: 'रसोई-सिंक',
    appTagline: 'आपका स्मार्ट रसोई प्रबंधक',
    indianKitchen: 'भारतीय रसोई',
    
    // Navigation
    home: 'होम',
    inventory: 'सामान',
    shopping: 'खरीदारी सूची',
    planner: 'भोजन योजना',
    recipes: 'रेसिपी',
    community: 'समुदाय',
    
    // Common actions
    add: 'जोड़ें',
    edit: 'संपादित करें',
    delete: 'हटाएं',
    save: 'सहेजें',
    cancel: 'रद्द करें',
    search: 'खोजें',
    filter: 'फ़िल्टर',
    remove: 'हटाएं',
    clear: 'साफ़ करें',
    sync: 'सिंक करें',
    refresh: 'रीफ्रेश',
    close: 'बंद करें',
    confirm: 'पुष्टि करें',
    back: 'वापस',
    next: 'आगे',
    done: 'हो गया',
    
    // Inventory page
    addItem: 'वस्तु जोड़ें',
    addNewItem: 'नई वस्तु जोड़ें',
    itemName: 'वस्तु का नाम',
    noItems: 'कोई वस्तु नहीं',
    noItemsFound: 'इन्वेंटरी में कोई वस्तु नहीं मिली',
    stockLevel: 'स्टॉक स्तर',
    fullStock: 'पूरा स्टॉक',
    halfStock: 'आधा स्टॉक',
    lowStock: 'कम स्टॉक',
    emptyStock: 'खाली',
    full: 'पूरा',
    half: 'आधा',
    low: 'कम',
    empty: 'खाली',
    category: 'श्रेणी',
    allCategories: 'सभी श्रेणियां',
    expiryDate: 'समाप्ति तिथि',
    expiringItems: 'जल्द समाप्त होने वाली वस्तुएं!',
    expired: 'समाप्त',
    expiresIn: 'समाप्त होगा',
    days: 'दिनों में',
    today: 'आज',
    browseTemplate: 'टेम्पलेट देखें',
    indianPantryTemplate: 'भारतीय रसोई टेम्पलेट',
    scanProduct: 'उत्पाद स्कैन करें',
    secretStash: 'मम्मी का गुप्त भंडार',
    monthlyNeed: 'मासिक जरूरत',
    
    // Shopping page
    shoppingList: 'खरीदारी सूची',
    smartShoppingAssistant: 'आपका स्मार्ट खरीदारी सहायक',
    groceryStore: 'किराना दुकान',
    localMandi: 'सब्जी मंडी',
    sendToWhatsApp: 'WhatsApp पर भेजें',
    copyToClipboard: 'कॉपी करें',
    syncLowStock: 'कम स्टॉक सिंक करें',
    addToShoppingList: 'खरीदारी सूची में जोड़ें',
    emptyShoppingList: 'आपकी खरीदारी सूची खाली है',
    addItemsToStart: 'शुरू करने के लिए वस्तुएं जोड़ें',
    
    // Planner page
    mealPlanner: 'भोजन योजनाकार',
    planYourWeek: 'स्वादिष्ट व्यंजनों के साथ अपने सप्ताह की योजना बनाएं',
    breakfast: 'नाश्ता',
    lunch: 'दोपहर का भोजन',
    snacks: 'नाश्ता',
    dinner: 'रात का खाना',
    findRecipe: 'रेसिपी खोजें',
    addRecipe: 'रेसिपी जोड़ें',
    noMealPlanned: 'कोई भोजन योजित नहीं',
    youTubeVideos: 'YouTube वीडियो',
    dadiRecommends: 'दादी की सिफारिश',
    cookWithYourStock: 'अपने सामान से पकाएं',
    addToPlan: 'योजना में जोड़ें',
    removeFromPlan: 'योजना से हटाएं',
    watchVideo: 'देखें',
    servings: 'परोसने की मात्रा',
    ingredients: 'सामग्री',
    reservedIngredients: 'आरक्षित सामग्री',
    favoriteChannels: 'पसंदीदा चैनल',
    addChannel: 'चैनल जोड़ें',
    
    // Translation verification
    verifyTranslation: 'सही है',
    editTranslation: 'अनुवाद संपादित करें',
    aiTranslated: 'AI अनुवादित',
    communityVerified: 'समुदाय सत्यापित',
    yourCustomTerm: 'आपका कस्टम शब्द',
    goldVerified: 'गोल्ड सत्यापित',
    
    // Common phrases
    quickAccess: 'त्वरित पहुंच',
    itemsInStock: 'स्टॉक में वस्तुएं',
    itemsTotal: 'कुल वस्तुएं',
    lastUpdated: 'अंतिम अपडेट',
    selectLanguage: 'भाषा चुनें',
    manageYourKitchen: 'अपने रसोई के सामान का प्रबंधन करें',
    quickPicks: 'त्वरित चयन उपलब्ध!',
    mealsPlanned: 'भोजन योजित',
    
    // Home page
    welcomeTo: 'आपका स्वागत है',
    welcomeMessage: 'Rasoi-Sync में आपका स्वागत है',
    intelligentKitchenCompanion: 'आपका बुद्धिमान किचन साथी',
    lowStockItems: 'कम स्टॉक वस्तुएं',
    missingItems: 'गायब वस्तुएं',
    missingIngredients: 'गायब सामग्री',
    recentUpdates: 'हाल के अपडेट',
    viewAll: 'सभी देखें',
    forMeal: 'के लिए',
    onDate: 'तारीख',
    
    // Planner page
    planYourWeeklyMeals: 'रेसिपी के साथ अपने साप्ताहिक भोजन की योजना बनाएं',
    gapAnalysis: 'गैप विश्लेषण',
    missingIngredientsForMeals: 'योजित भोजन के लिए गायब सामग्री',
    cookWithYourStock: 'अपने सामान से पकाएं',
    recipesFromFavoriteChannels: 'आपके पसंदीदा चैनलों की रेसिपी जो आपके रसोई से मेल खाती हैं',
    recipesFromChannelsAppearFirst: 'इन चैनलों की रेसिपी पहले दिखाई देती हैं',
    minIngredientsMatch: 'न्यूनतम सामग्री मिलान:',
    
    // Days
    monday: 'सोमवार',
    tuesday: 'मंगलवार',
    wednesday: 'बुधवार',
    thursday: 'गुरुवार',
    friday: 'शुक्रवार',
    saturday: 'शनिवार',
    sunday: 'रविवार',
    
    // Categories
    grains: 'अनाज और चावल',
    pulses: 'दालें',
    spices: 'मसाले',
    vegetables: 'सब्जियां',
    fruits: 'फल',
    dairy: 'डेयरी',
    oils: 'तेल और घी',
    bakery: 'बेकरी',
    fasting: 'उपवास',
    snacksCategory: 'नाश्ता और रेडी मिक्स',
    beverages: 'चाय और कॉफी',
    other: 'अन्य',
    
    // About Page
    aboutRasoiSync: 'रसोई-सिंक के बारे में',
    aboutTagline: 'आपका स्मार्ट रसोई साथी - सामान प्रबंधन करें, भोजन योजना बनाएं, रेसिपी खोजें, और परिवार के साथ खरीदारी करें।',
    backToHome: 'होम पर वापस जाएं',
    quickSetupGuide: 'त्वरित सेटअप गाइड',
    getStartedSteps: '6 आसान चरणों में रसोई-सिंक शुरू करें',
    featureGuide: 'सुविधा गाइड',
    clickToLearn: 'उदाहरणों के साथ अधिक जानने के लिए प्रत्येक सुविधा पर क्लिक करें',
    completeWorkflow: 'पूर्ण रसोई वर्कफ़्लो',
    emptyToOrganized: 'खाली रसोई से व्यवस्थित रसोई तक',
    whyRasoiSync: 'रसोई-सिंक क्यों?',
    builtForIndian: 'भारतीय परिवारों के लिए, भारतीय डेवलपर्स द्वारा बनाया गया',
    readyToOrganize: 'अपनी रसोई व्यवस्थित करने के लिए तैयार?',
    joinFamilies: 'हजारों परिवारों से जुड़ें जो पहले से रसोई-सिंक का उपयोग कर रहे हैं',
    getStartedNow: 'अभी शुरू करें',
    madeWithLove: 'भारत में प्यार से बनाया गया',
    appIdea: 'ऐप आइडिया',
    appDevelopment: 'ऐप डेवलपमेंट',
    poweredBy: 'द्वारा संचालित',
    buildingForBharat: 'भारत के लिए निर्माण',
    
    // About - Features
    familyKitchen: 'परिवार रसोई',
    collaborativeHousehold: 'सहयोगी घरेलू प्रबंधन',
    smartInventory: 'स्मार्ट सामान',
    trackPantry: 'अपनी रसोई को कुशलता से ट्रैक करें',
    smartShoppingList: 'स्मार्ट खरीदारी सूची',
    neverForget: 'फिर कभी सामान न भूलें',
    recipeDiscovery: 'रेसिपी खोज',
    cookWithWhat: 'जो है उससे पकाएं',
    mealPlanner: 'भोजन योजनाकार',
    planWeekAhead: 'अपने सप्ताह की योजना पहले से बनाएं',
    communityKitchen: 'समुदाय रसोई',
    shareWithNeighbors: 'पड़ोसियों के साथ साझा करें',
    
    // About - Why sections
    multiLanguage: 'बहु-भाषा',
    availableIn: 'अंग्रेजी, हिंदी और मराठी में उपलब्ध',
    familyFocused: 'परिवार केंद्रित',
    entireFamilyShops: 'पूरा परिवार एक साथ खरीदारी और प्रबंधन करे',
    mobileFirst: 'मोबाइल पहले',
    designedForShopping: 'चलते-फिरते खरीदारी के लिए डिज़ाइन किया गया',
    aiPowered: 'AI संचालित',
    smartSuggestions: 'स्मार्ट सुझाव और रेसिपी मिलान',
    
    // About - Setup Steps
    createAccountKitchen: 'अकाउंट और रसोई बनाएं',
    signUpCreate: 'ईमेल से साइन अप करें और अपनी पारिवारिक रसोई बनाएं',
    addInitialInventory: 'प्रारंभिक सामान जोड़ें',
    addItemsCurrently: 'अपनी रसोई में वर्तमान में मौजूद सामान जोड़ें',
    inviteFamilyMembers: 'परिवार के सदस्यों को आमंत्रित करें',
    shareKitchenCode: 'परिवार के साथ रसोई कोड साझा करें',
    useShoppingList: 'खरीदारी सूची का उपयोग करें',
    shopSmartly: 'स्वचालित सूची के साथ स्मार्ट खरीदारी करें',
    planYourMeals: 'अपने भोजन की योजना बनाएं',
    neverWonderCook: 'कभी न सोचें कि क्या पकाना है',
    discoverRecipes: 'रेसिपी खोजें',
    cookWithWhatYouHave: 'जो आपके पास है उससे पकाएं',
    
    // About - Workflow Phases
    dayOneSetup: 'पहला दिन: अपनी रसोई सेट करें',
    weeklyPlanShop: 'साप्ताहिक: योजना बनाएं और खरीदारी करें',
    dailyCookEnjoy: 'दैनिक: पकाएं और आनंद लें',
    monthlyReviewOptimize: 'मासिक: समीक्षा करें और अनुकूलित करें'
  },
  mr: {
    // App branding
    appName: 'रसोई-सिंक',
    appTagline: 'तुमचा स्मार्ट स्वयंपाकघर व्यवस्थापक',
    indianKitchen: 'भारतीय स्वयंपाकघर',
    
    // Navigation
    home: 'मुख्यपृष्ठ',
    inventory: 'साठा',
    shopping: 'खरेदी यादी',
    planner: 'जेवण नियोजक',
    recipes: 'रेसिपी',
    community: 'समुदाय',
    
    // Common actions
    add: 'जोडा',
    edit: 'संपादित करा',
    delete: 'हटवा',
    save: 'जतन करा',
    cancel: 'रद्द करा',
    search: 'शोधा',
    filter: 'फिल्टर',
    remove: 'काढा',
    clear: 'साफ करा',
    sync: 'सिंक करा',
    refresh: 'रीफ्रेश',
    close: 'बंद करा',
    confirm: 'पुष्टी करा',
    back: 'मागे',
    next: 'पुढे',
    done: 'झाले',
    
    // Inventory page
    addItem: 'वस्तू जोडा',
    addNewItem: 'नवीन वस्तू जोडा',
    itemName: 'वस्तूचे नाव',
    noItems: 'वस्तू नाहीत',
    noItemsFound: 'साठ्यात वस्तू सापडल्या नाहीत',
    stockLevel: 'साठा पातळी',
    fullStock: 'पूर्ण साठा',
    halfStock: 'अर्धा साठा',
    lowStock: 'कमी साठा',
    emptyStock: 'रिकामे',
    full: 'पूर्ण',
    half: 'अर्धा',
    low: 'कमी',
    empty: 'रिकामे',
    category: 'वर्ग',
    allCategories: 'सर्व वर्ग',
    expiryDate: 'कालबाह्य तारीख',
    expiringItems: 'लवकरच संपणाऱ्या वस्तू!',
    expired: 'कालबाह्य',
    expiresIn: 'संपेल',
    days: 'दिवसांत',
    today: 'आज',
    browseTemplate: 'टेम्पलेट पहा',
    indianPantryTemplate: 'भारतीय स्वयंपाकघर टेम्पलेट',
    scanProduct: 'उत्पादन स्कॅन करा',
    secretStash: 'आईचा गुप्त साठा',
    monthlyNeed: 'मासिक गरज',
    
    // Shopping page
    shoppingList: 'खरेदी यादी',
    smartShoppingAssistant: 'तुमचा स्मार्ट खरेदी सहाय्यक',
    groceryStore: 'किराणा दुकान',
    localMandi: 'भाजी मंडी',
    sendToWhatsApp: 'WhatsApp वर पाठवा',
    copyToClipboard: 'कॉपी करा',
    syncLowStock: 'कमी साठा सिंक करा',
    addToShoppingList: 'खरेदी यादीत जोडा',
    emptyShoppingList: 'तुमची खरेदी यादी रिकामी आहे',
    addItemsToStart: 'सुरू करण्यासाठी वस्तू जोडा',
    
    // Planner page
    mealPlanner: 'जेवण नियोजक',
    planYourWeek: 'चविष्ट पाककृतींसह तुमच्या आठवड्याची योजना करा',
    breakfast: 'नाश्ता',
    lunch: 'दुपारचे जेवण',
    snacks: 'नाश्ता',
    dinner: 'रात्रीचे जेवण',
    findRecipe: 'रेसिपी शोधा',
    addRecipe: 'रेसिपी जोडा',
    noMealPlanned: 'जेवण नियोजित नाही',
    youTubeVideos: 'YouTube व्हिडिओ',
    dadiRecommends: 'आजीची शिफारस',
    cookWithYourStock: 'तुमच्या साठ्याने शिजवा',
    addToPlan: 'योजनेत जोडा',
    removeFromPlan: 'योजनेतून काढा',
    watchVideo: 'पहा',
    servings: 'वाढप',
    ingredients: 'साहित्य',
    reservedIngredients: 'राखीव साहित्य',
    favoriteChannels: 'आवडते चॅनेल',
    addChannel: 'चॅनेल जोडा',
    
    // Translation verification
    verifyTranslation: 'बरोबर आहे',
    editTranslation: 'भाषांतर संपादित करा',
    aiTranslated: 'AI भाषांतरित',
    communityVerified: 'समुदाय सत्यापित',
    yourCustomTerm: 'तुमचा कस्टम शब्द',
    goldVerified: 'गोल्ड सत्यापित',
    
    // Common phrases
    quickAccess: 'जलद प्रवेश',
    itemsInStock: 'साठ्यातील वस्तू',
    itemsTotal: 'एकूण वस्तू',
    lastUpdated: 'शेवटचे अपडेट',
    selectLanguage: 'भाषा निवडा',
    manageYourKitchen: 'तुमच्या स्वयंपाकघराचा साठा व्यवस्थापित करा',
    quickPicks: 'जलद निवड उपलब्ध!',
    mealsPlanned: 'जेवण नियोजित',
    
    // Home page
    welcomeTo: 'Rasoi-Sync मध्ये आपले स्वागत आहे',
    welcomeMessage: 'Rasoi-Sync मध्ये आपले स्वागत आहे',
    intelligentKitchenCompanion: 'तुमचा बुद्धिमान किचन साथीदार',
    lowStockItems: 'कमी साठ्याच्या वस्तू',
    missingItems: 'गहाळ वस्तू',
    missingIngredients: 'गहाळ साहित्य',
    recentUpdates: 'अलीकडील अपडेट्स',
    viewAll: 'सर्व पहा',
    forMeal: 'साठी',
    onDate: 'दिनांक',
    
    // Planner page
    planYourWeeklyMeals: 'पाककृतींसह तुमच्या साप्ताहिक जेवणाचे नियोजन करा',
    gapAnalysis: 'तफावत विश्लेषण',
    missingIngredientsForMeals: 'नियोजित जेवणांसाठी गहाळ साहित्य',
    cookWithYourStock: 'तुमच्या साठ्यातून शिजवा',
    recipesFromFavoriteChannels: 'तुमच्या आवडीच्या चॅनेलवरील पाककृती तुमच्या साठ्याशी जुळणाऱ्या',
    recipesFromChannelsAppearFirst: 'या चॅनेलवरील पाककृती प्रथम दिसतात',
    minIngredientsMatch: 'किमान साहित्य जुळणी:',
    
    // Days
    monday: 'सोमवार',
    tuesday: 'मंगळवार',
    wednesday: 'बुधवार',
    thursday: 'गुरुवार',
    friday: 'शुक्रवार',
    saturday: 'शनिवार',
    sunday: 'रविवार',
    
    // Categories
    grains: 'धान्य आणि तांदूळ',
    pulses: 'कडधान्ये',
    spices: 'मसाले',
    vegetables: 'भाज्या',
    fruits: 'फळे',
    dairy: 'दुग्धजन्य पदार्थ',
    oils: 'तेल आणि तूप',
    bakery: 'बेकरी',
    fasting: 'उपवास',
    snacksCategory: 'नाश्ता आणि रेडी मिक्स',
    beverages: 'चहा आणि कॉफी',
    other: 'इतर',
    
    // About Page
    aboutRasoiSync: 'रसोई-सिंक बद्दल',
    aboutTagline: 'तुमचा स्मार्ट स्वयंपाकघर साथीदार - साठा व्यवस्थापित करा, जेवण नियोजित करा, पाककृती शोधा आणि कुटुंबासह खरेदी करा.',
    backToHome: 'मुख्यपृष्ठावर परत जा',
    quickSetupGuide: 'द्रुत सेटअप मार्गदर्शक',
    getStartedSteps: '6 सोप्या चरणांमध्ये रसोई-सिंक सुरू करा',
    featureGuide: 'वैशिष्ट्य मार्गदर्शक',
    clickToLearn: 'उदाहरणांसह अधिक जाणून घेण्यासाठी प्रत्येक वैशिष्ट्यावर क्लिक करा',
    completeWorkflow: 'संपूर्ण स्वयंपाकघर कार्यप्रवाह',
    emptyToOrganized: 'रिकाम्या स्वयंपाकघरापासून व्यवस्थित स्वयंपाकघरापर्यंत',
    whyRasoiSync: 'रसोई-सिंक का?',
    builtForIndian: 'भारतीय कुटुंबांसाठी, भारतीय डेव्हलपर्सनी बनवलेले',
    readyToOrganize: 'तुमचे स्वयंपाकघर व्यवस्थित करण्यास तयार?',
    joinFamilies: 'हजारो कुटुंबांसोबत सामील व्हा जे आधीच रसोई-सिंक वापरत आहेत',
    getStartedNow: 'आता सुरू करा',
    madeWithLove: 'भारतात प्रेमाने बनवलेले',
    appIdea: 'अॅप कल्पना',
    appDevelopment: 'अॅप डेव्हलपमेंट',
    poweredBy: 'द्वारे संचालित',
    buildingForBharat: 'भारतासाठी निर्माण',
    
    // About - Features
    familyKitchen: 'कुटुंब स्वयंपाकघर',
    collaborativeHousehold: 'सहयोगी घरगुती व्यवस्थापन',
    smartInventory: 'स्मार्ट साठा',
    trackPantry: 'तुमचे स्वयंपाकघर कार्यक्षमतेने ट्रॅक करा',
    smartShoppingList: 'स्मार्ट खरेदी यादी',
    neverForget: 'पुन्हा कधीही वस्तू विसरू नका',
    recipeDiscovery: 'पाककृती शोध',
    cookWithWhat: 'जे आहे त्यातून शिजवा',
    mealPlanner: 'जेवण नियोजक',
    planWeekAhead: 'तुमच्या आठवड्याचे आधीच नियोजन करा',
    communityKitchen: 'समुदाय स्वयंपाकघर',
    shareWithNeighbors: 'शेजाऱ्यांसोबत शेअर करा',
    
    // About - Why sections
    multiLanguage: 'बहुभाषिक',
    availableIn: 'इंग्रजी, हिंदी आणि मराठीत उपलब्ध',
    familyFocused: 'कुटुंब केंद्रित',
    entireFamilyShops: 'संपूर्ण कुटुंब एकत्र खरेदी करते आणि व्यवस्थापित करते',
    mobileFirst: 'मोबाइल प्रथम',
    designedForShopping: 'चालताना खरेदीसाठी डिझाइन केलेले',
    aiPowered: 'AI संचालित',
    smartSuggestions: 'स्मार्ट सूचना आणि पाककृती जुळणी',
    
    // About - Setup Steps
    createAccountKitchen: 'खाते आणि स्वयंपाकघर तयार करा',
    signUpCreate: 'ईमेलने साइन अप करा आणि तुमचे कौटुंबिक स्वयंपाकघर तयार करा',
    addInitialInventory: 'प्रारंभिक साठा जोडा',
    addItemsCurrently: 'तुमच्या स्वयंपाकघरातील सध्याच्या वस्तू जोडा',
    inviteFamilyMembers: 'कुटुंबातील सदस्यांना आमंत्रित करा',
    shareKitchenCode: 'कुटुंबासोबत स्वयंपाकघर कोड शेअर करा',
    useShoppingList: 'खरेदी यादी वापरा',
    shopSmartly: 'स्वयंचलित याद्यांसह स्मार्ट खरेदी करा',
    planYourMeals: 'तुमच्या जेवणाचे नियोजन करा',
    neverWonderCook: 'काय शिजवायचे याचा कधीही विचार करू नका',
    discoverRecipes: 'पाककृती शोधा',
    cookWithWhatYouHave: 'तुमच्याकडे जे आहे त्यातून शिजवा',
    
    // About - Workflow Phases
    dayOneSetup: 'पहिला दिवस: तुमचे स्वयंपाकघर सेट करा',
    weeklyPlanShop: 'साप्ताहिक: नियोजन करा आणि खरेदी करा',
    dailyCookEnjoy: 'दैनंदिन: शिजवा आणि आनंद घ्या',
    monthlyReviewOptimize: 'मासिक: पुनरावलोकन करा आणि अनुकूल करा'
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
