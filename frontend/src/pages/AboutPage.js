import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChefHat, Home, Package, ShoppingCart, Calendar, BookOpen, Users, 
  CheckCircle, ArrowRight, ArrowLeft, Play,
  Heart, Sparkles, Globe, Smartphone, Zap, ChevronDown, ChevronUp,
  UserPlus, TrendingUp, Utensils, Youtube, Lightbulb
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';

const AboutPage = () => {
  const navigate = useNavigate();
  const { getLabel, language } = useLanguage();
  const [expandedSection, setExpandedSection] = useState(null);

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // All translations
  const translations = {
    en: {
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
      multiLanguage: 'Multi-language',
      availableIn: 'Available in English, Hindi, and Marathi',
      familyFocused: 'Family Focused',
      entireFamilyShops: 'Entire family shops & manages together',
      mobileFirst: 'Mobile First',
      designedForShopping: 'Designed for shopping on-the-go',
      aiPowered: 'AI Powered',
      smartSuggestions: 'Smart suggestions & recipe matching',
      features: {
        familyKitchen: {
          description: 'Create a shared kitchen space where all family members can contribute to inventory management, shopping, and meal planning.',
          steps: [
            { title: 'Create Your Kitchen', description: 'Sign up and create a new household. Give it a name like "Sharma Family Kitchen".', example: 'Example: Mrs. Sharma creates "Sharma Kutumb Kitchen" and gets Kitchen Code: SK-7842' },
            { title: 'Invite Family Members', description: 'Share your Kitchen Code with family members.', example: 'Example: Son Rahul joins using code SK-7842 and can now see the same inventory' },
            { title: 'Real-time Sync', description: 'When anyone adds items or marks something as bought, everyone sees updates instantly.', example: 'Example: When Rahul buys milk, Mrs. Sharma sees it marked as "Bought" immediately' },
            { title: 'Shop Together', description: 'Multiple family members can shop simultaneously.', example: 'Example: Father picks Rice (shows "In Cart"), Rahul picks Vegetables - no duplicates!' }
          ]
        },
        inventory: {
          description: 'Keep track of everything in your kitchen with smart alerts when items are running low.',
          steps: [
            { title: 'Add Your Items', description: 'Start by adding items with quantity and unit.', example: 'Example: Add "Rice - 5 kg", "Oil - 2 liters", "Sugar - 1 kg"' },
            { title: 'Set Monthly Requirements', description: 'Define how much your family needs per month.', example: 'Example: Set Rice to 10 kg. When below 3 kg, you get an alert.' },
            { title: 'Organize by Category', description: 'Items are auto-categorized - Grains, Spices, Dairy, etc.', example: 'Example: "Turmeric" → Spices, "Paneer" → Dairy, "Onions" → Vegetables' },
            { title: 'Track Stock Levels', description: 'Visual indicators: Good (Green), Low (Yellow), Critical (Red).', example: 'Example: Oil at 0.5L when need is 2L shows Critical with red indicator' }
          ]
        },
        shopping: {
          description: 'Auto-generated shopping lists based on inventory gaps, with barcode scanning.',
          steps: [
            { title: 'Auto-Generated List', description: 'Items automatically added based on gaps.', example: 'Example: Rice at 2 kg, need 10 kg - "Rice (8 kg)" auto-added' },
            { title: 'Scan Products', description: 'Use barcode scanner to quickly add items.', example: 'Example: Scan Fortune Oil - App adds "Fortune Sunflower Oil 1L"' },
            { title: 'Mark Purchase Status', description: 'Mark "In Cart" while shopping, "Bought" at checkout.', example: 'Example: Pick Dal → Tap "In Cart" → At billing → "Bought" → Goes to inventory' },
            { title: 'Collaborative Shopping', description: 'Family members can shop different sections simultaneously.', example: 'Example: Wife handles grocery, Husband handles vegetables - both see progress' }
          ]
        },
        recipes: {
          description: 'Discover recipes based on ingredients you have. Watch YouTube tutorials.',
          steps: [
            { title: 'Personalized Suggestions', description: 'App suggests recipes matching your inventory.', example: 'Example: Have Paneer, Tomatoes, Onions → Suggests "Paneer Butter Masala"' },
            { title: 'YouTube Integration', description: 'Video tutorials from popular cooking channels.', example: 'Example: Click recipe → Watch video from Ranveer Brar' },
            { title: 'Favorite Channels', description: 'Subscribe to favorite channels for priority recipes.', example: 'Example: Add "Your Food Lab" → Their recipes appear first' },
            { title: 'Ingredient Matching', description: 'See match percentage for each recipe.', example: 'Example: "Dal Tadka" shows 90% match (missing only Ghee)' }
          ]
        },
        planner: {
          description: 'Plan breakfast, lunch, snacks, dinner for the week.',
          steps: [
            { title: 'Weekly View', description: 'See entire week with Breakfast, Lunch, Snacks, Dinner slots.', example: 'Example: Monday - Poha (Breakfast), Dal Rice (Lunch), Roti (Dinner)' },
            { title: 'Add from Recipes', description: 'Add recipes directly to meal plan.', example: 'Example: Find "Masala Dosa" → Click "Add to Plan" → Select Wednesday' },
            { title: 'Festival Specials', description: 'Suggestions for upcoming festivals.', example: 'Example: Ganesh Chaturthi → Suggests "Modak", "Puran Poli"' },
            { title: 'Auto Shopping List', description: 'Missing ingredients auto-added to shopping.', example: 'Example: Plan "Biryani" → Basmati Rice auto-added to list' }
          ]
        },
        community: {
          description: 'Share excess with neighbors, discover local recipes.',
          steps: [
            { title: 'Share Excess Items', description: 'Post extra items for neighbors.', example: 'Example: "Free Coriander (2 bunches)" → Neighbor claims it' },
            { title: 'Recipe Exchange', description: 'Share and discover family recipes.', example: 'Example: Share "Puran Poli" → Get "Shrikhand" from neighbor' },
            { title: 'Group Purchases', description: 'Bulk buy with neighbors for savings.', example: 'Example: 25kg rice bag → Split with 3 neighbors' }
          ]
        }
      },
      setupSteps: [
        { title: 'Create Account & Kitchen', description: 'Sign up and create family kitchen', details: ['Enter name, email, password', 'Create household with name', 'Select language', 'Choose city'] },
        { title: 'Add Initial Inventory', description: 'Add current kitchen items', details: ['Go to Inventory', 'Add items with quantity', 'Set category', 'Set monthly requirement'] },
        { title: 'Invite Family Members', description: 'Share kitchen code', details: ['Go to Settings → Kitchen Code', 'Share 6-digit code', 'They join during signup', 'Everyone sees same inventory'] },
        { title: 'Use Shopping List', description: 'Shop with auto-generated lists', details: ['View auto-generated list', 'Add manually or scan', 'Mark "In Cart"', 'Mark "Bought"'] },
        { title: 'Plan Your Meals', description: 'Never wonder what to cook', details: ['Go to Meal Planner', 'View weekly calendar', 'Add recipes', 'Missing items auto-add'] },
        { title: 'Discover Recipes', description: 'Cook with what you have', details: ['Browse matching recipes', 'Watch YouTube tutorials', 'Add favorite channels', 'Add to meal plan'] }
      ],
      workflow: [
        { title: 'Day 1: Setup Your Kitchen', items: ['Create account', 'Add pantry items', 'Set requirements', 'Invite family'] },
        { title: 'Weekly: Plan & Shop', items: ['Review shopping list', 'Plan meals', 'Check recipes', 'Shop and mark bought'] },
        { title: 'Daily: Cook & Enjoy', items: ['Check planned meals', 'Watch videos', 'Update inventory', 'App learns patterns'] },
        { title: 'Monthly: Review & Optimize', items: ['Review reports', 'Adjust requirements', 'Discover new recipes', 'Share with community'] }
      ]
    },
    hi: {
      aboutTagline: 'आपका स्मार्ट रसोई साथी - सामान प्रबंधन करें, भोजन योजना बनाएं, रेसिपी खोजें, और परिवार के साथ खरीदारी करें।',
      backToHome: 'होम पर वापस जाएं',
      quickSetupGuide: 'त्वरित सेटअप गाइड',
      getStartedSteps: '6 आसान चरणों में रसोई-सिंक शुरू करें',
      featureGuide: 'सुविधा गाइड',
      clickToLearn: 'उदाहरणों के साथ जानने के लिए क्लिक करें',
      completeWorkflow: 'पूर्ण रसोई वर्कफ़्लो',
      emptyToOrganized: 'खाली रसोई से व्यवस्थित रसोई तक',
      whyRasoiSync: 'रसोई-सिंक क्यों?',
      builtForIndian: 'भारतीय परिवारों के लिए, भारतीय डेवलपर्स द्वारा',
      readyToOrganize: 'अपनी रसोई व्यवस्थित करने के लिए तैयार?',
      joinFamilies: 'हजारों परिवारों से जुड़ें',
      getStartedNow: 'अभी शुरू करें',
      madeWithLove: 'भारत में प्यार से बनाया गया',
      appIdea: 'ऐप आइडिया',
      appDevelopment: 'ऐप डेवलपमेंट',
      poweredBy: 'द्वारा संचालित',
      buildingForBharat: 'भारत के लिए निर्माण',
      familyKitchen: 'परिवार रसोई',
      collaborativeHousehold: 'सहयोगी घरेलू प्रबंधन',
      smartInventory: 'स्मार्ट सामान',
      trackPantry: 'अपनी रसोई को ट्रैक करें',
      smartShoppingList: 'स्मार्ट खरीदारी सूची',
      neverForget: 'फिर कभी न भूलें',
      recipeDiscovery: 'रेसिपी खोज',
      cookWithWhat: 'जो है उससे पकाएं',
      mealPlanner: 'भोजन योजनाकार',
      planWeekAhead: 'सप्ताह की योजना पहले से बनाएं',
      communityKitchen: 'समुदाय रसोई',
      shareWithNeighbors: 'पड़ोसियों के साथ साझा करें',
      multiLanguage: 'बहु-भाषा',
      availableIn: 'अंग्रेजी, हिंदी और मराठी में उपलब्ध',
      familyFocused: 'परिवार केंद्रित',
      entireFamilyShops: 'पूरा परिवार एक साथ खरीदारी करे',
      mobileFirst: 'मोबाइल पहले',
      designedForShopping: 'चलते-फिरते खरीदारी के लिए',
      aiPowered: 'AI संचालित',
      smartSuggestions: 'स्मार्ट सुझाव और रेसिपी मिलान',
      features: {
        familyKitchen: {
          description: 'एक साझा रसोई स्थान जहां सभी परिवार के सदस्य योगदान कर सकें।',
          steps: [
            { title: 'अपनी रसोई बनाएं', description: 'साइन अप करें और नया घर बनाएं।', example: 'उदाहरण: श्रीमती शर्मा "शर्मा कुटुंब किचन" बनाती हैं, कोड: SK-7842' },
            { title: 'परिवार को आमंत्रित करें', description: 'किचन कोड परिवार के साथ साझा करें।', example: 'उदाहरण: बेटा राहुल कोड SK-7842 से जुड़ता है' },
            { title: 'रीयल-टाइम सिंक', description: 'सभी को तुरंत अपडेट दिखाई देता है।', example: 'उदाहरण: राहुल दूध खरीदता है, माँ को तुरंत दिखता है' },
            { title: 'एक साथ खरीदारी', description: 'कई सदस्य एक साथ खरीदारी कर सकते हैं।', example: 'उदाहरण: पिताजी चावल उठाते हैं, राहुल सब्जियां - कोई डुप्लिकेट नहीं!' }
          ]
        },
        inventory: {
          description: 'सामान कम होने पर स्मार्ट अलर्ट के साथ सब कुछ ट्रैक करें।',
          steps: [
            { title: 'सामान जोड़ें', description: 'मात्रा और इकाई के साथ सामान जोड़ें।', example: 'उदाहरण: "चावल - 5 किलो", "तेल - 2 लीटर" जोड़ें' },
            { title: 'मासिक आवश्यकताएं सेट करें', description: 'प्रति माह कितना चाहिए परिभाषित करें।', example: 'उदाहरण: चावल 10 किलो सेट करें। 3 किलो से नीचे पर अलर्ट।' },
            { title: 'श्रेणी के अनुसार व्यवस्थित', description: 'स्वचालित वर्गीकरण।', example: 'उदाहरण: "हल्दी" → मसाले, "पनीर" → डेयरी' },
            { title: 'स्टॉक ट्रैक करें', description: 'रंग संकेतक: अच्छा (हरा), कम (पीला), गंभीर (लाल)।', example: 'उदाहरण: तेल 0.5L जब जरूरत 2L - लाल दिखता है' }
          ]
        },
        shopping: {
          description: 'कमी के आधार पर स्वचालित खरीदारी सूची, बारकोड स्कैनिंग के साथ।',
          steps: [
            { title: 'स्वचालित सूची', description: 'कमी के आधार पर स्वचालित जोड़।', example: 'उदाहरण: चावल 2 किलो, जरूरत 10 - "चावल (8 किलो)" जुड़ जाता है' },
            { title: 'स्कैन करें', description: 'बारकोड स्कैनर से जल्दी जोड़ें।', example: 'उदाहरण: फॉर्च्यून तेल स्कैन करें - ऐप जोड़ता है' },
            { title: 'स्थिति चिह्नित करें', description: 'खरीदारी में "कार्ट में", चेकआउट पर "खरीदा"।', example: 'उदाहरण: दाल उठाएं → "कार्ट में" → "खरीदा" → इन्वेंटरी में' },
            { title: 'सहयोगी खरीदारी', description: 'परिवार एक साथ अलग-अलग खरीदारी करे।', example: 'उदाहरण: पत्नी किराना, पति सब्जियां - दोनों प्रगति देखें' }
          ]
        },
        recipes: {
          description: 'उपलब्ध सामग्री के आधार पर रेसिपी खोजें। YouTube देखें।',
          steps: [
            { title: 'व्यक्तिगत सुझाव', description: 'सामान से मिलती रेसिपी सुझाव।', example: 'उदाहरण: पनीर, टमाटर है → "पनीर बटर मसाला" सुझाव' },
            { title: 'YouTube इंटीग्रेशन', description: 'लोकप्रिय चैनलों के वीडियो।', example: 'उदाहरण: रेसिपी क्लिक → रणवीर बराड़ का वीडियो' },
            { title: 'पसंदीदा चैनल', description: 'पसंदीदा चैनल प्राथमिकता पाएं।', example: 'उदाहरण: "Your Food Lab" जोड़ें → उनकी रेसिपी पहले' },
            { title: 'सामग्री मिलान', description: 'मैच प्रतिशत देखें।', example: 'उदाहरण: "दाल तड़का" 90% मैच (घी गायब)' }
          ]
        },
        planner: {
          description: 'पूरे सप्ताह के नाश्ता, दोपहर, स्नैक्स, रात का खाना योजना।',
          steps: [
            { title: 'साप्ताहिक दृश्य', description: 'सभी भोजन स्लॉट देखें।', example: 'उदाहरण: सोमवार - पोहा (नाश्ता), दाल चावल (दोपहर)' },
            { title: 'रेसिपी से जोड़ें', description: 'रेसिपी सीधे योजना में जोड़ें।', example: 'उदाहरण: "मसाला डोसा" → "योजना में जोड़ें" → बुधवार' },
            { title: 'त्योहार विशेष', description: 'त्योहारों के लिए सुझाव।', example: 'उदाहरण: गणेश चतुर्थी → "मोदक", "पूरन पोली"' },
            { title: 'स्वचालित खरीदारी', description: 'गायब सामग्री स्वचालित जुड़े।', example: 'उदाहरण: "बिरयानी" योजना → बासमती चावल जुड़ जाता है' }
          ]
        },
        community: {
          description: 'पड़ोसियों के साथ अतिरिक्त साझा करें, स्थानीय रेसिपी खोजें।',
          steps: [
            { title: 'अतिरिक्त साझा करें', description: 'पड़ोसियों के लिए पोस्ट करें।', example: 'उदाहरण: "मुफ्त धनिया" → पड़ोसी लेता है' },
            { title: 'रेसिपी आदान-प्रदान', description: 'पारिवारिक रेसिपी साझा और खोजें।', example: 'उदाहरण: "पूरन पोली" साझा → "श्रीखंड" मिले' },
            { title: 'समूह खरीदारी', description: 'पड़ोसियों के साथ थोक खरीदें।', example: 'उदाहरण: 25 किलो चावल → 3 पड़ोसियों में बांटें' }
          ]
        }
      },
      setupSteps: [
        { title: 'अकाउंट और रसोई बनाएं', description: 'साइन अप करें और रसोई बनाएं', details: ['नाम, ईमेल, पासवर्ड', 'घर का नाम', 'भाषा चुनें', 'शहर चुनें'] },
        { title: 'प्रारंभिक सामान जोड़ें', description: 'रसोई में सामान जोड़ें', details: ['सामान अनुभाग', 'मात्रा के साथ जोड़ें', 'श्रेणी सेट करें', 'मासिक आवश्यकता'] },
        { title: 'परिवार को आमंत्रित करें', description: 'किचन कोड साझा करें', details: ['सेटिंग्स → किचन कोड', '6-अंकीय कोड साझा', 'साइनअप में जुड़ें', 'सभी एक ही देखें'] },
        { title: 'खरीदारी सूची उपयोग करें', description: 'स्मार्ट खरीदारी', details: ['स्वचालित सूची', 'स्कैन या जोड़ें', '"कार्ट में" चिह्नित', '"खरीदा" चिह्नित'] },
        { title: 'भोजन योजना बनाएं', description: 'कभी न सोचें क्या पकाऊं', details: ['भोजन योजनाकार', 'साप्ताहिक कैलेंडर', 'रेसिपी जोड़ें', 'गायब स्वचालित जुड़े'] },
        { title: 'रेसिपी खोजें', description: 'जो है उससे पकाएं', details: ['मिलती रेसिपी', 'YouTube देखें', 'पसंदीदा चैनल', 'योजना में जोड़ें'] }
      ],
      workflow: [
        { title: 'पहला दिन: रसोई सेट करें', items: ['अकाउंट बनाएं', 'सामान जोड़ें', 'आवश्यकताएं सेट', 'परिवार आमंत्रित'] },
        { title: 'साप्ताहिक: योजना और खरीदारी', items: ['खरीदारी सूची', 'भोजन योजना', 'रेसिपी देखें', 'खरीदें और चिह्नित'] },
        { title: 'दैनिक: पकाएं और आनंद', items: ['योजित भोजन', 'वीडियो देखें', 'इन्वेंटरी अपडेट', 'ऐप सीखता है'] },
        { title: 'मासिक: समीक्षा और अनुकूलन', items: ['रिपोर्ट समीक्षा', 'आवश्यकताएं समायोजित', 'नई रेसिपी', 'समुदाय में साझा'] }
      ]
    },
    mr: {
      aboutTagline: 'तुमचा स्मार्ट स्वयंपाकघर साथीदार - साठा व्यवस्थापित करा, जेवण नियोजित करा, पाककृती शोधा आणि कुटुंबासह खरेदी करा.',
      backToHome: 'मुख्यपृष्ठावर परत',
      quickSetupGuide: 'द्रुत सेटअप मार्गदर्शक',
      getStartedSteps: '6 सोप्या चरणांमध्ये रसोई-सिंक सुरू करा',
      featureGuide: 'वैशिष्ट्य मार्गदर्शक',
      clickToLearn: 'उदाहरणांसह जाणून घेण्यासाठी क्लिक करा',
      completeWorkflow: 'संपूर्ण स्वयंपाकघर कार्यप्रवाह',
      emptyToOrganized: 'रिकाम्यापासून व्यवस्थित स्वयंपाकघरापर्यंत',
      whyRasoiSync: 'रसोई-सिंक का?',
      builtForIndian: 'भारतीय कुटुंबांसाठी, भारतीय डेव्हलपर्सनी बनवलेले',
      readyToOrganize: 'तुमचे स्वयंपाकघर व्यवस्थित करण्यास तयार?',
      joinFamilies: 'हजारो कुटुंबांसोबत सामील व्हा',
      getStartedNow: 'आता सुरू करा',
      madeWithLove: 'भारतात प्रेमाने बनवलेले',
      appIdea: 'अॅप कल्पना',
      appDevelopment: 'अॅप डेव्हलपमेंट',
      poweredBy: 'द्वारे संचालित',
      buildingForBharat: 'भारतासाठी निर्माण',
      familyKitchen: 'कुटुंब स्वयंपाकघर',
      collaborativeHousehold: 'सहयोगी घरगुती व्यवस्थापन',
      smartInventory: 'स्मार्ट साठा',
      trackPantry: 'तुमचे स्वयंपाकघर ट्रॅक करा',
      smartShoppingList: 'स्मार्ट खरेदी यादी',
      neverForget: 'पुन्हा कधीही विसरू नका',
      recipeDiscovery: 'पाककृती शोध',
      cookWithWhat: 'जे आहे त्यातून शिजवा',
      mealPlanner: 'जेवण नियोजक',
      planWeekAhead: 'आठवड्याचे आधीच नियोजन करा',
      communityKitchen: 'समुदाय स्वयंपाकघर',
      shareWithNeighbors: 'शेजाऱ्यांसोबत शेअर करा',
      multiLanguage: 'बहुभाषिक',
      availableIn: 'इंग्रजी, हिंदी आणि मराठीत उपलब्ध',
      familyFocused: 'कुटुंब केंद्रित',
      entireFamilyShops: 'संपूर्ण कुटुंब एकत्र खरेदी करते',
      mobileFirst: 'मोबाइल प्रथम',
      designedForShopping: 'चालताना खरेदीसाठी',
      aiPowered: 'AI संचालित',
      smartSuggestions: 'स्मार्ट सूचना आणि पाककृती जुळणी',
      features: {
        familyKitchen: {
          description: 'सामायिक स्वयंपाकघर जिथे सर्व कुटुंब सदस्य योगदान देऊ शकतात.',
          steps: [
            { title: 'तुमचे स्वयंपाकघर तयार करा', description: 'साइन अप करा आणि नवीन घर तयार करा.', example: 'उदाहरण: श्रीमती शर्मा "शर्मा कुटुंब किचन" तयार करतात, कोड: SK-7842' },
            { title: 'कुटुंबाला आमंत्रित करा', description: 'किचन कोड कुटुंबासोबत शेअर करा.', example: 'उदाहरण: मुलगा राहुल कोड SK-7842 ने सामील होतो' },
            { title: 'रिअल-टाइम सिंक', description: 'सर्वांना लगेच अपडेट दिसतात.', example: 'उदाहरण: राहुल दूध घेतो, आईला लगेच दिसते' },
            { title: 'एकत्र खरेदी करा', description: 'अनेक सदस्य एकाच वेळी खरेदी करू शकतात.', example: 'उदाहरण: वडील तांदूळ उचलतात, राहुल भाज्या - डुप्लिकेट नाही!' }
          ]
        },
        inventory: {
          description: 'वस्तू कमी असताना स्मार्ट अलर्ट्ससह सर्व ट्रॅक करा.',
          steps: [
            { title: 'वस्तू जोडा', description: 'प्रमाण आणि युनिटसह वस्तू जोडा.', example: 'उदाहरण: "तांदूळ - 5 किलो", "तेल - 2 लिटर" जोडा' },
            { title: 'मासिक गरजा सेट करा', description: 'दरमहा किती हवे ते परिभाषित करा.', example: 'उदाहरण: तांदूळ 10 किलो सेट करा. 3 किलोखाली अलर्ट.' },
            { title: 'श्रेणीनुसार व्यवस्थित', description: 'स्वयंचलित वर्गीकरण.', example: 'उदाहरण: "हळद" → मसाले, "पनीर" → दुग्धजन्य' },
            { title: 'साठा ट्रॅक करा', description: 'रंग संकेतक: चांगले (हिरवे), कमी (पिवळे), गंभीर (लाल).', example: 'उदाहरण: तेल 0.5L जेव्हा गरज 2L - लाल दिसते' }
          ]
        },
        shopping: {
          description: 'तफावतींवर आधारित स्वयंचलित खरेदी यादी, बारकोड स्कॅनिंगसह.',
          steps: [
            { title: 'स्वयंचलित यादी', description: 'तफावतींवर आधारित स्वयंचलित जोड.', example: 'उदाहरण: तांदूळ 2 किलो, गरज 10 - "तांदूळ (8 किलो)" जोडले जाते' },
            { title: 'स्कॅन करा', description: 'बारकोड स्कॅनरने पटकन जोडा.', example: 'उदाहरण: Fortune तेल स्कॅन करा - अॅप जोडते' },
            { title: 'स्थिती चिन्हांकित करा', description: 'खरेदीत "कार्टमध्ये", चेकआउटवर "खरेदी केले".', example: 'उदाहरण: डाळ उचला → "कार्टमध्ये" → "खरेदी केले" → साठ्यात' },
            { title: 'सहयोगी खरेदी', description: 'कुटुंब एकाच वेळी वेगवेगळे खरेदी करू शकते.', example: 'उदाहरण: पत्नी किराणा, पती भाज्या - दोघेही प्रगती पाहतात' }
          ]
        },
        recipes: {
          description: 'उपलब्ध साहित्याच्या आधारे पाककृती शोधा. YouTube पहा.',
          steps: [
            { title: 'वैयक्तिक सूचना', description: 'साठ्याशी जुळणाऱ्या पाककृती सूचना.', example: 'उदाहरण: पनीर, टोमॅटो आहे → "पनीर बटर मसाला" सुचवते' },
            { title: 'YouTube इंटिग्रेशन', description: 'लोकप्रिय चॅनेलवरील व्हिडिओ.', example: 'उदाहरण: पाककृती क्लिक → रणवीर बराडचा व्हिडिओ' },
            { title: 'आवडीचे चॅनेल', description: 'आवडीचे चॅनेल प्राधान्य मिळवतात.', example: 'उदाहरण: "Your Food Lab" जोडा → त्यांच्या पाककृती प्रथम' },
            { title: 'साहित्य जुळणी', description: 'जुळणी टक्केवारी पहा.', example: 'उदाहरण: "डाळ तडका" 90% जुळणी (तूप गहाळ)' }
          ]
        },
        planner: {
          description: 'संपूर्ण आठवड्याचे नाश्ता, दुपार, स्नॅक्स, रात्र नियोजित करा.',
          steps: [
            { title: 'साप्ताहिक दृश्य', description: 'सर्व जेवण स्लॉट्स पहा.', example: 'उदाहरण: सोमवार - पोहे (नाश्ता), डाळ भात (दुपार)' },
            { title: 'पाककृतींमधून जोडा', description: 'पाककृती थेट नियोजनात जोडा.', example: 'उदाहरण: "मसाला डोसा" → "नियोजनात जोडा" → बुधवार' },
            { title: 'सण विशेष', description: 'सणांसाठी सूचना.', example: 'उदाहरण: गणेश चतुर्थी → "मोदक", "पुरण पोळी"' },
            { title: 'स्वयंचलित खरेदी', description: 'गहाळ साहित्य स्वयंचलित जोडले जाते.', example: 'उदाहरण: "बिर्याणी" नियोजित → बासमती तांदूळ जोडला जातो' }
          ]
        },
        community: {
          description: 'शेजाऱ्यांसोबत अतिरिक्त शेअर करा, स्थानिक पाककृती शोधा.',
          steps: [
            { title: 'अतिरिक्त शेअर करा', description: 'शेजाऱ्यांसाठी पोस्ट करा.', example: 'उदाहरण: "मोफत कोथिंबीर" → शेजारी घेतो' },
            { title: 'पाककृती देवाणघेवाण', description: 'कौटुंबिक पाककृती शेअर आणि शोधा.', example: 'उदाहरण: "पुरण पोळी" शेअर → "श्रीखंड" मिळवा' },
            { title: 'समूह खरेदी', description: 'शेजाऱ्यांसोबत मोठ्या प्रमाणात खरेदी करा.', example: 'उदाहरण: 25 किलो तांदूळ → 3 शेजाऱ्यांसोबत विभाजित' }
          ]
        }
      },
      setupSteps: [
        { title: 'खाते आणि स्वयंपाकघर तयार करा', description: 'साइन अप आणि स्वयंपाकघर तयार', details: ['नाव, ईमेल, पासवर्ड', 'घराचे नाव', 'भाषा निवडा', 'शहर निवडा'] },
        { title: 'प्रारंभिक साठा जोडा', description: 'स्वयंपाकघरातील वस्तू जोडा', details: ['साठा विभाग', 'प्रमाणासह जोडा', 'श्रेणी सेट', 'मासिक गरज'] },
        { title: 'कुटुंबाला आमंत्रित करा', description: 'किचन कोड शेअर', details: ['सेटिंग्ज → किचन कोड', '6-अंकी कोड शेअर', 'साइनअपमध्ये सामील', 'सर्व समान पाहतात'] },
        { title: 'खरेदी यादी वापरा', description: 'स्मार्ट खरेदी', details: ['स्वयंचलित यादी', 'स्कॅन किंवा जोडा', '"कार्टमध्ये" चिन्हांकित', '"खरेदी केले" चिन्हांकित'] },
        { title: 'जेवण नियोजित करा', description: 'काय शिजवायचे विचार नको', details: ['जेवण नियोजक', 'साप्ताहिक कॅलेंडर', 'पाककृती जोडा', 'गहाळ स्वयंचलित जोडले'] },
        { title: 'पाककृती शोधा', description: 'जे आहे त्यातून शिजवा', details: ['जुळणाऱ्या पाककृती', 'YouTube पहा', 'आवडीचे चॅनेल', 'नियोजनात जोडा'] }
      ],
      workflow: [
        { title: 'पहिला दिवस: स्वयंपाकघर सेट करा', items: ['खाते तयार', 'वस्तू जोडा', 'गरजा सेट', 'कुटुंब आमंत्रित'] },
        { title: 'साप्ताहिक: नियोजन आणि खरेदी', items: ['खरेदी यादी', 'जेवण नियोजन', 'पाककृती पहा', 'खरेदी आणि चिन्हांकित'] },
        { title: 'दैनंदिन: शिजवा आणि आनंद घ्या', items: ['नियोजित जेवण', 'व्हिडिओ पहा', 'साठा अपडेट', 'अॅप शिकते'] },
        { title: 'मासिक: पुनरावलोकन आणि अनुकूल', items: ['अहवाल पुनरावलोकन', 'गरजा समायोजित', 'नवीन पाककृती', 'समुदायात शेअर'] }
      ]
    }
  };

  const t = translations[language] || translations.en;

  const features = [
    { id: 'family-kitchen', icon: Users, title: t.familyKitchen, subtitle: t.collaborativeHousehold, color: '#F59E0B', bgColor: 'bg-amber-50', ...t.features.familyKitchen },
    { id: 'inventory', icon: Package, title: t.smartInventory, subtitle: t.trackPantry, color: '#10B981', bgColor: 'bg-emerald-50', ...t.features.inventory },
    { id: 'shopping', icon: ShoppingCart, title: t.smartShoppingList, subtitle: t.neverForget, color: '#3B82F6', bgColor: 'bg-blue-50', ...t.features.shopping },
    { id: 'recipes', icon: BookOpen, title: t.recipeDiscovery, subtitle: t.cookWithWhat, color: '#EC4899', bgColor: 'bg-pink-50', ...t.features.recipes },
    { id: 'planner', icon: Calendar, title: t.mealPlanner, subtitle: t.planWeekAhead, color: '#8B5CF6', bgColor: 'bg-purple-50', ...t.features.planner },
    { id: 'community', icon: Heart, title: t.communityKitchen, subtitle: t.shareWithNeighbors, color: '#EF4444', bgColor: 'bg-red-50', ...t.features.community }
  ];

  const setupIcons = [UserPlus, Package, Users, ShoppingCart, Calendar, Youtube];
  const workflowIcons = [Home, Calendar, Utensils, TrendingUp];
  const workflowColors = ['#FF9933', '#8B5CF6', '#10B981', '#3B82F6'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-amber-500/10"></div>
        <div className="max-w-6xl mx-auto px-4 py-12 relative">
          <Button variant="ghost" onClick={() => navigate('/')} className="mb-6 text-gray-600 hover:text-orange-600" data-testid="back-to-home">
            <ArrowLeft className="w-4 h-4 mr-2" />{t.backToHome}
          </Button>
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl shadow-lg mb-6">
              <ChefHat className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
              {language === 'en' ? 'About ' : ''}<span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-600">Rasoi-Sync</span>{language === 'hi' ? ' के बारे में' : language === 'mr' ? ' बद्दल' : ''}
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">{t.aboutTagline}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-12">
            {[
              { icon: Package, label: getLabel('inventory'), color: '#10B981' },
              { icon: ShoppingCart, label: getLabel('shopping'), color: '#3B82F6' },
              { icon: Calendar, label: getLabel('planner'), color: '#8B5CF6' },
              { icon: BookOpen, label: getLabel('recipes'), color: '#EC4899' },
              { icon: Users, label: t.familyKitchen.split(' ')[0], color: '#F59E0B' },
              { icon: Heart, label: getLabel('community'), color: '#EF4444' },
            ].map((item, idx) => (
              <div key={idx} className="bg-white/80 backdrop-blur rounded-xl p-4 text-center shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-xl mx-auto mb-2 flex items-center justify-center" style={{ backgroundColor: `${item.color}15` }}>
                  <item.icon className="w-6 h-6" style={{ color: item.color }} />
                </div>
                <span className="text-sm font-medium text-gray-700">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Setup Guide */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-gray-800 mb-3">{t.quickSetupGuide}</h2>
          <p className="text-gray-600">{t.getStartedSteps}</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {t.setupSteps.map((item, idx) => {
            const Icon = setupIcons[idx];
            return (
              <Card key={idx} className="bg-white/80 backdrop-blur border-0 shadow-md hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full flex items-center justify-center text-white font-bold">{idx + 1}</div>
                    <div>
                      <CardTitle className="text-lg">{item.title}</CardTitle>
                      <p className="text-sm text-gray-500">{item.description}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {item.details.map((detail, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />{detail}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Feature Guide */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-gray-800 mb-3">{t.featureGuide}</h2>
          <p className="text-gray-600">{t.clickToLearn}</p>
        </div>
        <div className="space-y-4">
          {features.map((feature) => (
            <Card key={feature.id} className={`overflow-hidden border-0 shadow-md transition-all duration-300 ${expandedSection === feature.id ? 'shadow-xl' : ''}`}>
              <button onClick={() => toggleSection(feature.id)} className="w-full text-left" data-testid={`feature-${feature.id}`}>
                <CardHeader className={`${feature.bgColor} transition-colors`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-xl flex items-center justify-center shadow-md" style={{ backgroundColor: feature.color }}>
                        <feature.icon className="w-7 h-7 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-xl text-gray-800">{feature.title}</CardTitle>
                        <p className="text-sm text-gray-600">{feature.subtitle}</p>
                      </div>
                    </div>
                    {expandedSection === feature.id ? <ChevronUp className="w-6 h-6 text-gray-500" /> : <ChevronDown className="w-6 h-6 text-gray-500" />}
                  </div>
                </CardHeader>
              </button>
              {expandedSection === feature.id && (
                <CardContent className="pt-6 bg-white">
                  <p className="text-gray-600 mb-6">{feature.description}</p>
                  <div className="space-y-6">
                    {feature.steps.map((step, idx) => (
                      <div key={idx} className="relative pl-8 pb-6 border-l-2 border-gray-200 last:border-0 last:pb-0">
                        <div className="absolute -left-3 w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: feature.color }}>{idx + 1}</div>
                        <h4 className="font-semibold text-gray-800 mb-1">{step.title}</h4>
                        <p className="text-sm text-gray-600 mb-2">{step.description}</p>
                        <div className="bg-gray-50 rounded-lg p-3 border-l-4" style={{ borderColor: feature.color }}>
                          <div className="flex items-start gap-2">
                            <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: feature.color }} />
                            <p className="text-sm text-gray-700 italic">{step.example}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      </div>

      {/* Complete Workflow */}
      <div className="bg-white/50 py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-800 mb-3">{t.completeWorkflow}</h2>
            <p className="text-gray-600">{t.emptyToOrganized}</p>
          </div>
          <div className="relative">
            <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-1 bg-gradient-to-b from-orange-500 via-amber-500 to-green-500 transform -translate-x-1/2"></div>
            <div className="space-y-12">
              {t.workflow.map((phase, idx) => {
                const Icon = workflowIcons[idx];
                return (
                  <div key={idx} className={`flex items-center gap-8 ${idx % 2 === 1 ? 'md:flex-row-reverse' : ''}`}>
                    <div className={`flex-1 ${idx % 2 === 1 ? 'md:text-right' : ''}`}>
                      <Card className="bg-white border-0 shadow-lg inline-block">
                        <CardHeader className="pb-2">
                          <div className={`flex items-center gap-3 ${idx % 2 === 1 ? 'md:flex-row-reverse' : ''}`}>
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: workflowColors[idx] }}>
                              <Icon className="w-6 h-6 text-white" />
                            </div>
                            <CardTitle className="text-lg">{phase.title}</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <ul className={`space-y-2 ${idx % 2 === 1 ? 'md:text-right' : ''}`}>
                            {phase.items.map((item, i) => (
                              <li key={i} className={`flex items-center gap-2 text-sm text-gray-600 ${idx % 2 === 1 ? 'md:flex-row-reverse' : ''}`}>
                                <ArrowRight className="w-3 h-3 flex-shrink-0" style={{ color: workflowColors[idx] }} />{item}
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    </div>
                    <div className="hidden md:flex w-12 h-12 rounded-full bg-white shadow-lg items-center justify-center z-10">
                      <span className="text-lg font-bold" style={{ color: workflowColors[idx] }}>{idx + 1}</span>
                    </div>
                    <div className="flex-1 hidden md:block"></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Why Rasoi-Sync */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-800 mb-3">{t.whyRasoiSync}</h2>
          <p className="text-gray-600">{t.builtForIndian}</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: Globe, title: t.multiLanguage, description: t.availableIn, color: '#3B82F6' },
            { icon: Users, title: t.familyFocused, description: t.entireFamilyShops, color: '#F59E0B' },
            { icon: Smartphone, title: t.mobileFirst, description: t.designedForShopping, color: '#10B981' },
            { icon: Sparkles, title: t.aiPowered, description: t.smartSuggestions, color: '#8B5CF6' }
          ].map((item, idx) => (
            <Card key={idx} className="bg-white border-0 shadow-md text-center p-6">
              <div className="w-14 h-14 rounded-xl mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: `${item.color}15` }}>
                <item.icon className="w-7 h-7" style={{ color: item.color }} />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">{item.title}</h3>
              <p className="text-sm text-gray-600">{item.description}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 py-12">
        <div className="max-w-4xl mx-auto px-4 text-center text-white">
          <h2 className="text-3xl font-bold mb-4">{t.readyToOrganize}</h2>
          <p className="text-lg opacity-90 mb-8">{t.joinFamilies}</p>
          <Button onClick={() => navigate('/')} className="bg-white text-orange-600 hover:bg-gray-100 px-8 py-6 text-lg font-semibold rounded-xl shadow-lg" data-testid="get-started-btn">
            <Play className="w-5 h-5 mr-2" />{t.getStartedNow}
          </Button>
        </div>
      </div>

      {/* Credits Footer */}
      <div className="bg-gray-900 text-white py-12">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl mb-4">
              <ChefHat className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-2xl font-bold mb-2">Rasoi-Sync</h3>
            <p className="text-gray-400">{language === 'hi' ? 'आपका स्मार्ट रसोई साथी' : language === 'mr' ? 'तुमचा स्मार्ट स्वयंपाकघर साथीदार' : 'Your Smart Kitchen Companion'}</p>
          </div>
          <div className="border-t border-gray-800 pt-8">
            <div className="grid md:grid-cols-3 gap-8 text-center">
              <div>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Lightbulb className="w-5 h-5 text-amber-400" />
                  <span className="text-gray-400 text-sm">{t.appIdea}</span>
                </div>
                <p className="font-semibold text-lg">Tejasvi Shardul Wargantiwar</p>
                <p className="text-gray-500 text-sm">Chandrapur, Maharashtra</p>
              </div>
              <div>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Zap className="w-5 h-5 text-blue-400" />
                  <span className="text-gray-400 text-sm">{t.appDevelopment}</span>
                </div>
                <p className="font-semibold text-lg">Akshay Arun Bhaskarwar</p>
                <p className="text-gray-500 text-sm">Pune, Maharashtra</p>
              </div>
              <div>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Heart className="w-5 h-5 text-red-400" />
                  <span className="text-gray-400 text-sm">{t.poweredBy}</span>
                </div>
                <p className="font-semibold text-lg">Anubandh.com Team</p>
                <p className="text-gray-500 text-sm">{t.buildingForBharat}</p>
              </div>
            </div>
          </div>
          <div className="text-center mt-8 pt-8 border-t border-gray-800">
            <p className="text-gray-500 text-sm">© 2025 Rasoi-Sync. {t.madeWithLove}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
