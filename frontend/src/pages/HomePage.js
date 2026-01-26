import { useState } from 'react';
import { DigitalDadiWidget } from '@/components/DigitalDadiWidget';
import { useInventory, useMealPlanner, useGapAnalysis } from '@/hooks/useRasoiSync';
import { Package2, Calendar, ShoppingCart, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const HomePage = () => {
  const { inventory } = useInventory();
  const { mealPlans } = useMealPlanner();
  const { analysis } = useGapAnalysis();

  const stats = [
    {
      icon: Package2,
      label: 'Items in Stock',
      value: inventory.filter(i => i.stock_level === 'full' || i.stock_level === 'half').length,
      color: 'text-[#77DD77]',
      bg: 'bg-[#77DD77]/10'
    },
    {
      icon: ShoppingCart,
      label: 'Low Stock Items',
      value: inventory.filter(i => i.stock_level === 'low').length,
      color: 'text-[#FF9933]',
      bg: 'bg-[#FF9933]/10'
    },
    {
      icon: Calendar,
      label: 'Meals Planned',
      value: mealPlans.length,
      color: 'text-[#FFCC00]',
      bg: 'bg-[#FFCC00]/10'
    },
    {
      icon: AlertCircle,
      label: 'Missing Items',
      value: analysis?.missing_ingredients?.length || 0,
      color: 'text-red-500',
      bg: 'bg-red-50'
    }
  ];

  return (
    <div className="container mx-auto px-4 py-6 pb-24 md:pb-6 space-y-6" data-testid="home-page">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#FF9933] to-[#FFCC00] rounded-2xl p-6 text-white shadow-lg">
        <h2 className="text-3xl font-bold mb-2">Welcome to Rasoi-Sync</h2>
        <p className="text-white/90">Your intelligent kitchen companion</p>
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
              className="hover-lift cursor-pointer"
              data-testid={`stat-card-${index}`}
            >
              <CardContent className="p-6">
                <div className={`w-12 h-12 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <div className="text-3xl font-bold text-gray-800 mb-1">{stat.value}</div>
                <div className="text-sm text-gray-600">{stat.label}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Activity */}
      <Card className="shadow-sm">
        <CardContent className="p-6">
          <h3 className="text-xl font-bold mb-4">Recent Updates</h3>
          <div className="space-y-3">
            {inventory.slice(0, 5).map((item) => (
              <div 
                key={item.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                data-testid={`recent-item-${item.id}`}
              >
                <div>
                  <p className="font-medium text-gray-800">{item.name_en}</p>
                  {item.name_gu && (
                    <p className="text-sm text-gray-600 bilingual-text">{item.name_gu}</p>
                  )}
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                  item.stock_level === 'full' ? 'bg-[#77DD77]/20 text-[#77DD77]' :
                  item.stock_level === 'half' ? 'bg-[#FFCC00]/20 text-[#FFCC00]' :
                  item.stock_level === 'low' ? 'bg-[#FF9933]/20 text-[#FF9933]' :
                  'bg-gray-200 text-gray-600'
                }`}>
                  {item.stock_level}
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
