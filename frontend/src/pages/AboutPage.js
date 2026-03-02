import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChefHat, Home, Package, ShoppingCart, Calendar, BookOpen, Users, 
  Scan, CheckCircle, ArrowRight, ArrowLeft, Play, Settings, Bell,
  Heart, Sparkles, Globe, Shield, Smartphone, Zap, ChevronDown, ChevronUp,
  UserPlus, QrCode, TrendingUp, Clock, Utensils, Youtube, Lightbulb
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const AboutPage = () => {
  const navigate = useNavigate();
  const [expandedSection, setExpandedSection] = useState(null);

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const features = [
    {
      id: 'family-kitchen',
      icon: Users,
      title: 'Family Kitchen',
      subtitle: 'Collaborative household management',
      color: '#F59E0B',
      bgColor: 'bg-amber-50',
      description: 'Create a shared kitchen space where all family members can contribute to inventory management, shopping, and meal planning.',
      steps: [
        {
          title: 'Create Your Kitchen',
          description: 'Sign up and create a new household. Give it a name like "Sharma Family Kitchen" or "Pune Home".',
          example: 'Example: Mrs. Sharma creates "Sharma Kutumb Kitchen" and gets a unique Kitchen Code: SK-7842'
        },
        {
          title: 'Invite Family Members',
          description: 'Share your Kitchen Code with family members. They can join using this code during signup.',
          example: 'Example: Son Rahul joins using code SK-7842 and can now see the same inventory'
        },
        {
          title: 'Real-time Sync',
          description: 'When anyone adds items or marks something as bought, everyone sees updates instantly.',
          example: 'Example: When Rahul buys milk at the store, Mrs. Sharma sees it marked as "Bought" immediately'
        },
        {
          title: 'Shop Together',
          description: 'Multiple family members can shop simultaneously. Items show "In Cart" status when someone picks them.',
          example: 'Example: Father picks Rice (shows "In Cart"), while Rahul picks Vegetables - no duplicate purchases!'
        }
      ]
    },
    {
      id: 'inventory',
      icon: Package,
      title: 'Smart Inventory',
      subtitle: 'Track your pantry efficiently',
      color: '#10B981',
      bgColor: 'bg-emerald-50',
      description: 'Keep track of everything in your kitchen - from spices to vegetables, with smart alerts when items are running low.',
      steps: [
        {
          title: 'Add Your Items',
          description: 'Start by adding items you currently have. Specify quantity and unit (kg, liters, packets, etc.).',
          example: 'Example: Add "Rice - 5 kg", "Cooking Oil - 2 liters", "Sugar - 1 kg"'
        },
        {
          title: 'Set Monthly Requirements',
          description: 'Define how much of each item your family needs per month. This helps track consumption.',
          example: 'Example: Set Rice monthly requirement to 10 kg. When stock drops below 3 kg, you get an alert.'
        },
        {
          title: 'Organize by Category',
          description: 'Items are automatically categorized - Grains, Spices, Dairy, Vegetables, Fruits, Snacks, etc.',
          example: 'Example: "Turmeric" goes to Spices, "Paneer" to Dairy, "Onions" to Vegetables'
        },
        {
          title: 'Track Stock Levels',
          description: 'Visual indicators show stock status - Good (Green), Low (Yellow), Critical (Red).',
          example: 'Example: Oil at 0.5L when monthly need is 2L shows as Critical with red indicator'
        }
      ]
    },
    {
      id: 'shopping',
      icon: ShoppingCart,
      title: 'Smart Shopping List',
      subtitle: 'Never forget items again',
      color: '#3B82F6',
      bgColor: 'bg-blue-50',
      description: 'Automatically generated shopping lists based on your inventory gaps, with barcode scanning for easy additions.',
      steps: [
        {
          title: 'Auto-Generated List',
          description: 'Based on your inventory and monthly requirements, items are automatically added to shopping list.',
          example: 'Example: Rice stock is 2 kg, monthly need is 10 kg - "Rice (8 kg)" auto-added to shopping list'
        },
        {
          title: 'Scan Products',
          description: 'Use barcode scanner to quickly add items. Product details are fetched automatically.',
          example: 'Example: Scan Fortune Oil barcode - App recognizes it as "Fortune Sunflower Oil 1L" and adds it'
        },
        {
          title: 'Mark Purchase Status',
          description: 'At store, mark items as "In Cart" while shopping, then "Bought" at checkout.',
          example: 'Example: Pick up Dal packet → Tap "In Cart" → At billing → Tap "Bought" → Item moves to inventory'
        },
        {
          title: 'Collaborative Shopping',
          description: 'Family members can split the list and shop different sections simultaneously.',
          example: 'Example: Wife handles grocery section, Husband handles vegetables - both see each other\'s progress'
        }
      ]
    },
    {
      id: 'recipes',
      icon: BookOpen,
      title: 'Recipe Discovery',
      subtitle: 'Cook with what you have',
      color: '#EC4899',
      bgColor: 'bg-pink-50',
      description: 'Discover recipes based on ingredients you already have. Watch YouTube tutorials for each dish.',
      steps: [
        {
          title: 'Personalized Suggestions',
          description: 'App analyzes your inventory and suggests recipes you can make with available ingredients.',
          example: 'Example: You have Paneer, Tomatoes, Onions → App suggests "Paneer Butter Masala", "Kadai Paneer"'
        },
        {
          title: 'YouTube Integration',
          description: 'Each recipe comes with curated YouTube video tutorials from popular cooking channels.',
          example: 'Example: Click "Paneer Butter Masala" → Watch step-by-step video from Ranveer Brar or Kunal Kapoor'
        },
        {
          title: 'Favorite Channels',
          description: 'Subscribe to your favorite cooking channels. Their recipes appear first in your feed.',
          example: 'Example: Add "Your Food Lab" as favorite → Their recipes prioritized in your suggestions'
        },
        {
          title: 'Ingredient Matching',
          description: 'See how many ingredients you have for each recipe with match percentage.',
          example: 'Example: "Dal Tadka" shows 90% match (you have 9/10 ingredients, missing only Ghee)'
        }
      ]
    },
    {
      id: 'planner',
      icon: Calendar,
      title: 'Meal Planner',
      subtitle: 'Plan your week ahead',
      color: '#8B5CF6',
      bgColor: 'bg-purple-50',
      description: 'Plan breakfast, lunch, snacks, and dinner for the entire week. Never wonder "What to cook today?"',
      steps: [
        {
          title: 'Weekly View',
          description: 'See the entire week at a glance with slots for Breakfast, Lunch, Snacks, and Dinner.',
          example: 'Example: Monday - Poha (Breakfast), Dal Rice (Lunch), Tea & Pakora (Snacks), Roti Sabzi (Dinner)'
        },
        {
          title: 'Add from Recipes',
          description: 'Browse recipe suggestions and add them directly to your meal plan.',
          example: 'Example: Find "Masala Dosa" in recipes → Click "Add to Plan" → Select Wednesday Breakfast'
        },
        {
          title: 'Festival Specials',
          description: 'App suggests special dishes for upcoming festivals based on your region.',
          example: 'Example: Ganesh Chaturthi coming → Suggests "Modak", "Puran Poli", "Ukdiche Modak"'
        },
        {
          title: 'Auto Shopping List',
          description: 'Missing ingredients for planned meals are automatically added to shopping list.',
          example: 'Example: Plan "Biryani" for Sunday → Missing Basmati Rice auto-added to shopping list'
        }
      ]
    },
    {
      id: 'community',
      icon: Heart,
      title: 'Community Kitchen',
      subtitle: 'Share with neighbors',
      color: '#EF4444',
      bgColor: 'bg-red-50',
      description: 'Share excess ingredients with neighbors, discover local recipes, and build community connections.',
      steps: [
        {
          title: 'Share Excess Items',
          description: 'Have extra vegetables or items? Share with nearby community members.',
          example: 'Example: Bought extra Coriander → Post "Free Coriander (2 bunches)" → Neighbor claims it'
        },
        {
          title: 'Local Recipe Exchange',
          description: 'Share your family recipes and discover traditional dishes from neighbors.',
          example: 'Example: Share grandmother\'s "Puran Poli" recipe → Get "Shrikhand" recipe from neighbor'
        },
        {
          title: 'Group Purchases',
          description: 'Coordinate bulk purchases with neighbors for better prices.',
          example: 'Example: Rice 25kg bag cheaper → Split with 3 neighbors, each pays for their share'
        }
      ]
    }
  ];

  const setupGuide = [
    {
      step: 1,
      title: 'Create Account & Kitchen',
      icon: UserPlus,
      description: 'Sign up with email and create your family kitchen',
      details: [
        'Enter your name, email, and password',
        'Create a new household with a name (e.g., "Wargantiwar Home")',
        'Select your home language (English, Hindi, Marathi)',
        'Choose your city for festival calendar'
      ]
    },
    {
      step: 2,
      title: 'Add Initial Inventory',
      icon: Package,
      description: 'Add items currently in your kitchen',
      details: [
        'Go to Inventory section',
        'Add items with name, quantity, and unit',
        'Set category (Grains, Spices, Dairy, etc.)',
        'Set monthly requirement for each item'
      ]
    },
    {
      step: 3,
      title: 'Invite Family Members',
      icon: Users,
      description: 'Share kitchen code with family',
      details: [
        'Go to Settings → Kitchen Code',
        'Share the 6-digit code with family members',
        'They join using this code during signup',
        'Everyone sees the same inventory and lists'
      ]
    },
    {
      step: 4,
      title: 'Use Shopping List',
      icon: ShoppingCart,
      description: 'Shop smartly with auto-generated lists',
      details: [
        'View auto-generated shopping list based on gaps',
        'Add items manually or scan barcodes',
        'Mark items "In Cart" while shopping',
        'Mark "Bought" to move items to inventory'
      ]
    },
    {
      step: 5,
      title: 'Plan Your Meals',
      icon: Calendar,
      description: 'Never wonder what to cook',
      details: [
        'Go to Meal Planner section',
        'View weekly calendar with meal slots',
        'Add recipes from suggestions',
        'Missing ingredients auto-add to shopping list'
      ]
    },
    {
      step: 6,
      title: 'Discover Recipes',
      icon: Youtube,
      description: 'Cook with what you have',
      details: [
        'Browse recipes matching your inventory',
        'Watch YouTube tutorials for each dish',
        'Add favorite cooking channels',
        'Add recipes directly to meal plan'
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-amber-500/10"></div>
        <div className="max-w-6xl mx-auto px-4 py-12 relative">
          {/* Back Button */}
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="mb-6 text-gray-600 hover:text-orange-600"
            data-testid="back-to-home"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>

          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl shadow-lg mb-6">
              <ChefHat className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
              About <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-600">Rasoi-Sync</span>
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Your Smart Kitchen Companion - Manage inventory, plan meals, discover recipes, and shop together as a family.
            </p>
          </div>

          {/* Key Features Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-12">
            {[
              { icon: Package, label: 'Inventory', color: '#10B981' },
              { icon: ShoppingCart, label: 'Shopping', color: '#3B82F6' },
              { icon: Calendar, label: 'Planner', color: '#8B5CF6' },
              { icon: BookOpen, label: 'Recipes', color: '#EC4899' },
              { icon: Users, label: 'Family', color: '#F59E0B' },
              { icon: Heart, label: 'Community', color: '#EF4444' },
            ].map((item, idx) => (
              <div key={idx} className="bg-white/80 backdrop-blur rounded-xl p-4 text-center shadow-sm hover:shadow-md transition-shadow">
                <div 
                  className="w-12 h-12 rounded-xl mx-auto mb-2 flex items-center justify-center"
                  style={{ backgroundColor: `${item.color}15` }}
                >
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
          <h2 className="text-3xl font-bold text-gray-800 mb-3">Quick Setup Guide</h2>
          <p className="text-gray-600">Get started with Rasoi-Sync in 6 simple steps</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {setupGuide.map((item) => (
            <Card key={item.step} className="bg-white/80 backdrop-blur border-0 shadow-md hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full flex items-center justify-center text-white font-bold">
                    {item.step}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{item.title}</CardTitle>
                    <p className="text-sm text-gray-500">{item.description}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {item.details.map((detail, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      {detail}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Detailed Feature Sections */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-gray-800 mb-3">Feature Guide</h2>
          <p className="text-gray-600">Click on each feature to learn more with examples</p>
        </div>

        <div className="space-y-4">
          {features.map((feature) => (
            <Card 
              key={feature.id}
              className={`overflow-hidden border-0 shadow-md transition-all duration-300 ${
                expandedSection === feature.id ? 'shadow-xl' : ''
              }`}
            >
              <button
                onClick={() => toggleSection(feature.id)}
                className="w-full text-left"
                data-testid={`feature-${feature.id}`}
              >
                <CardHeader className={`${feature.bgColor} transition-colors`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-14 h-14 rounded-xl flex items-center justify-center shadow-md"
                        style={{ backgroundColor: feature.color }}
                      >
                        <feature.icon className="w-7 h-7 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-xl text-gray-800">{feature.title}</CardTitle>
                        <p className="text-sm text-gray-600">{feature.subtitle}</p>
                      </div>
                    </div>
                    {expandedSection === feature.id ? (
                      <ChevronUp className="w-6 h-6 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-6 h-6 text-gray-500" />
                    )}
                  </div>
                </CardHeader>
              </button>

              {expandedSection === feature.id && (
                <CardContent className="pt-6 bg-white">
                  <p className="text-gray-600 mb-6">{feature.description}</p>
                  
                  <div className="space-y-6">
                    {feature.steps.map((step, idx) => (
                      <div key={idx} className="relative pl-8 pb-6 border-l-2 border-gray-200 last:border-0 last:pb-0">
                        <div 
                          className="absolute -left-3 w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-bold"
                          style={{ backgroundColor: feature.color }}
                        >
                          {idx + 1}
                        </div>
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
            <h2 className="text-3xl font-bold text-gray-800 mb-3">Complete Kitchen Workflow</h2>
            <p className="text-gray-600">From empty pantry to organized kitchen</p>
          </div>

          <div className="relative">
            {/* Timeline */}
            <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-1 bg-gradient-to-b from-orange-500 via-amber-500 to-green-500 transform -translate-x-1/2"></div>

            <div className="space-y-12">
              {[
                {
                  title: 'Day 1: Setup Your Kitchen',
                  icon: Home,
                  color: '#FF9933',
                  items: [
                    'Create account and name your kitchen',
                    'Add existing pantry items with quantities',
                    'Set monthly requirements based on family size',
                    'Invite family members with kitchen code'
                  ]
                },
                {
                  title: 'Weekly: Plan & Shop',
                  icon: Calendar,
                  color: '#8B5CF6',
                  items: [
                    'Review auto-generated shopping list',
                    'Plan meals for the week in Meal Planner',
                    'Check recipes to cook with available ingredients',
                    'Go shopping - scan items and mark bought'
                  ]
                },
                {
                  title: 'Daily: Cook & Enjoy',
                  icon: Utensils,
                  color: '#10B981',
                  items: [
                    'Check today\'s planned meals',
                    'Watch recipe videos if needed',
                    'Update inventory when items are used',
                    'App learns your consumption patterns'
                  ]
                },
                {
                  title: 'Monthly: Review & Optimize',
                  icon: TrendingUp,
                  color: '#3B82F6',
                  items: [
                    'Review consumption reports',
                    'Adjust monthly requirements if needed',
                    'Discover new recipes based on favorites',
                    'Share excess with community'
                  ]
                }
              ].map((phase, idx) => (
                <div key={idx} className={`flex items-center gap-8 ${idx % 2 === 1 ? 'md:flex-row-reverse' : ''}`}>
                  <div className={`flex-1 ${idx % 2 === 1 ? 'md:text-right' : ''}`}>
                    <Card className="bg-white border-0 shadow-lg inline-block">
                      <CardHeader className="pb-2">
                        <div className={`flex items-center gap-3 ${idx % 2 === 1 ? 'md:flex-row-reverse' : ''}`}>
                          <div 
                            className="w-12 h-12 rounded-xl flex items-center justify-center"
                            style={{ backgroundColor: phase.color }}
                          >
                            <phase.icon className="w-6 h-6 text-white" />
                          </div>
                          <CardTitle className="text-lg">{phase.title}</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <ul className={`space-y-2 ${idx % 2 === 1 ? 'md:text-right' : ''}`}>
                          {phase.items.map((item, i) => (
                            <li key={i} className={`flex items-center gap-2 text-sm text-gray-600 ${idx % 2 === 1 ? 'md:flex-row-reverse' : ''}`}>
                              <ArrowRight className="w-3 h-3 flex-shrink-0" style={{ color: phase.color }} />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  </div>
                  <div className="hidden md:flex w-12 h-12 rounded-full bg-white shadow-lg items-center justify-center z-10">
                    <span className="text-lg font-bold" style={{ color: phase.color }}>{idx + 1}</span>
                  </div>
                  <div className="flex-1 hidden md:block"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Why Rasoi-Sync */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-800 mb-3">Why Rasoi-Sync?</h2>
          <p className="text-gray-600">Built for Indian families, by Indian developers</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              icon: Globe,
              title: 'Multi-language',
              description: 'Available in English, Hindi, and Marathi',
              color: '#3B82F6'
            },
            {
              icon: Users,
              title: 'Family Focused',
              description: 'Entire family shops & manages together',
              color: '#F59E0B'
            },
            {
              icon: Smartphone,
              title: 'Mobile First',
              description: 'Designed for shopping on-the-go',
              color: '#10B981'
            },
            {
              icon: Sparkles,
              title: 'AI Powered',
              description: 'Smart suggestions & recipe matching',
              color: '#8B5CF6'
            }
          ].map((item, idx) => (
            <Card key={idx} className="bg-white border-0 shadow-md text-center p-6">
              <div 
                className="w-14 h-14 rounded-xl mx-auto mb-4 flex items-center justify-center"
                style={{ backgroundColor: `${item.color}15` }}
              >
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
          <h2 className="text-3xl font-bold mb-4">Ready to Organize Your Kitchen?</h2>
          <p className="text-lg opacity-90 mb-8">
            Join thousands of families already using Rasoi-Sync
          </p>
          <Button
            onClick={() => navigate('/')}
            className="bg-white text-orange-600 hover:bg-gray-100 px-8 py-6 text-lg font-semibold rounded-xl shadow-lg"
            data-testid="get-started-btn"
          >
            <Play className="w-5 h-5 mr-2" />
            Get Started Now
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
            <p className="text-gray-400">Your Smart Kitchen Companion</p>
          </div>

          <div className="border-t border-gray-800 pt-8">
            <div className="grid md:grid-cols-3 gap-8 text-center">
              <div>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Lightbulb className="w-5 h-5 text-amber-400" />
                  <span className="text-gray-400 text-sm">App Idea</span>
                </div>
                <p className="font-semibold text-lg">Tejasvi Shardul Wargantiwar</p>
                <p className="text-gray-500 text-sm">Chandrapur, Maharashtra</p>
              </div>

              <div>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Zap className="w-5 h-5 text-blue-400" />
                  <span className="text-gray-400 text-sm">App Development</span>
                </div>
                <p className="font-semibold text-lg">Akshay Arun Bhaskarwar</p>
                <p className="text-gray-500 text-sm">Pune, Maharashtra</p>
              </div>

              <div>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Heart className="w-5 h-5 text-red-400" />
                  <span className="text-gray-400 text-sm">Powered by</span>
                </div>
                <p className="font-semibold text-lg">Anubandh.com Team</p>
                <p className="text-gray-500 text-sm">Building for Bharat</p>
              </div>
            </div>
          </div>

          <div className="text-center mt-8 pt-8 border-t border-gray-800">
            <p className="text-gray-500 text-sm">
              © 2025 Rasoi-Sync. Made with love in India.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
