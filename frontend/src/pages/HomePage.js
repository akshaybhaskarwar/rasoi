import { useInventory, useMealPlanner, useGapAnalysis } from '@/hooks/useRasoiSync';
import { useLanguage } from '@/contexts/LanguageContext';
import { Package2, Calendar, ShoppingCart, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { DigitalDadiWidget } from '@/components/DigitalDadiWidget';
import { useNavigate } from 'react-router-dom';

const HomePage = () => {
  const { inventory } = useInventory();
  const { mealPlans } = useMealPlanner();
  const { analysis } = useGapAnalysis();
  const navigate = useNavigate();
  const { getLabel } = useLanguage();

  const stats = [
    {
      icon: Package2,
      labelKey: 'itemsInStock',
      value: inventory.filter(i => i.stock_level === 'full' || i.stock_level === 'half').length,
      color: 'text-[#77DD77]',
      bg: 'bg-[#77DD77]/10',
      link: '/inventory'
    },
    {
      icon: ShoppingCart,
      labelKey: 'lowStockItems',
      value: inventory.filter(i => i.stock_level === 'low').length,
      color: 'text-[#FF9933]',
      bg: 'bg-[#FF9933]/10',
      link: '/shopping'
    },
    {
      icon: Calendar,
      labelKey: 'mealsPlanned',
      value: mealPlans.length,
      color: 'text-[#FFCC00]',
      bg: 'bg-[#FFCC00]/10',
      link: '/planner'
    },
    {
      icon: AlertCircle,
      labelKey: 'missingItems',
      value: analysis?.missing_ingredients?.length || 0,
      color: 'text-red-500',
      bg: 'bg-red-50',
      link: '/shopping'
    }
  ];

  return (
    <div className="container mx-auto px-4 py-6 pb-24 md:pb-6 space-y-6" data-testid="home-page">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#FF9933] to-[#FFCC00] rounded-2xl p-6 text-white shadow-lg">
        <h2 className="text-3xl font-bold mb-2">{getLabel('welcomeTo')} {getLabel('appName')}</h2>
        <p className="text-white/90">{getLabel('intelligentKitchenCompanion')}</p>
      </div>

      {/* Digital Dadi Widget */}
      <DigitalDadiWidget />

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card 
              key={index}
              className="hover-lift cursor-pointer transition-transform hover:scale-105"
              onClick={() => navigate(stat.link)}
              data-testid={`stat-card-${index}`}
            >
              <CardContent className="p-6">
                <div className={`w-12 h-12 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <div className="text-3xl font-bold text-gray-800 mb-1">{stat.value}</div>
                <div className="text-sm text-gray-600">{getLabel(stat.labelKey)}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Missing Ingredients Section */}
      {analysis?.missing_ingredients?.length > 0 && (
        <Card className="shadow-sm border-red-200 bg-red-50/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-red-700">{getLabel('missingIngredients')}</h3>
              <button 
                onClick={() => navigate('/shopping')}
                className="text-sm text-red-600 hover:underline"
              >
                {getLabel('viewAll')} →
              </button>
            </div>
            <div className="space-y-3">
              {analysis.missing_ingredients.slice(0, 3).map((item, idx) => (
                <div 
                  key={idx}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border border-red-100"
                >
                  <div>
                    <p className="font-medium text-gray-800">{item.name}</p>
                    <p className="text-xs text-gray-500">
                      {getLabel('forMeal')}: {item.needed_for} | {getLabel('onDate')}: {item.date}
                    </p>
                  </div>
                  <AlertCircle className="w-5 h-5 text-red-500" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <Card className="shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold">{getLabel('recentUpdates')}</h3>
            <button 
              onClick={() => navigate('/inventory')}
              className="text-sm text-[#FF9933] hover:underline"
            >
              {getLabel('viewAll')} →
            </button>
          </div>
          <div className="space-y-3">
            {inventory.slice(0, 5).map((item) => (
              <div 
                key={item.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => navigate('/inventory')}
                data-testid={`recent-item-${item.id}`}
              >
                <div>
                  <p className="font-medium text-gray-800">{item.name_en}</p>
                  {item.name_mr && (
                    <p className="text-sm text-gray-600 bilingual-text">{item.name_mr}</p>
                  )}
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                  item.stock_level === 'full' ? 'bg-[#77DD77]/20 text-[#77DD77]' :
                  item.stock_level === 'half' ? 'bg-[#FFCC00]/20 text-[#FFCC00]' :
                  item.stock_level === 'low' ? 'bg-[#FF9933]/20 text-[#FF9933]' :
                  'bg-gray-200 text-gray-600'
                }`}>
                  {getLabel(item.stock_level)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default HomePage;
