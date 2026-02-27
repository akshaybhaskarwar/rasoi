import { Home, Package, ShoppingCart, Calendar, BookOpen } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';

export const BottomNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { getLabel } = useLanguage();

  const navItems = [
    { 
      path: '/', 
      icon: Home, 
      labelKey: 'home', 
      testId: 'nav-home',
      color: '#FF9933',      // Orange - warmth of home
      bgColor: '#FFF7ED'
    },
    { 
      path: '/inventory', 
      icon: Package, 
      labelKey: 'inventory', 
      testId: 'nav-inventory',
      color: '#10B981',      // Emerald green - stock/freshness
      bgColor: '#ECFDF5'
    },
    { 
      path: '/planner', 
      icon: Calendar, 
      labelKey: 'planner', 
      testId: 'nav-planner',
      color: '#8B5CF6',      // Purple - planning/creativity
      bgColor: '#F5F3FF'
    },
    { 
      path: '/recipes', 
      icon: BookOpen, 
      labelKey: 'recipes', 
      testId: 'nav-recipes',
      color: '#EC4899',      // Pink - culinary passion
      bgColor: '#FDF2F8'
    },
    { 
      path: '/shopping', 
      icon: ShoppingCart, 
      labelKey: 'shopping', 
      testId: 'nav-shopping',
      color: '#3B82F6',      // Blue - trust/reliability
      bgColor: '#EFF6FF'
    },
  ];

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-gray-100 md:hidden z-[100] safe-area-bottom shadow-lg"
      data-testid="bottom-navigation"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around py-2 px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center min-w-[60px] min-h-[56px] rounded-2xl transition-all duration-200 active:scale-95 ${
                isActive 
                  ? 'scale-105 shadow-sm' 
                  : 'hover:scale-102'
              }`}
              style={{
                backgroundColor: isActive ? item.bgColor : 'transparent',
                color: isActive ? item.color : '#9CA3AF'
              }}
              data-testid={item.testId}
            >
              <div 
                className={`p-1.5 rounded-xl transition-all duration-200 ${isActive ? 'shadow-sm' : ''}`}
                style={{
                  backgroundColor: isActive ? `${item.color}15` : 'transparent'
                }}
              >
                <Icon 
                  className={`w-5 h-5 transition-all duration-200 ${isActive ? 'stroke-[2.5px]' : 'stroke-[1.5px]'}`} 
                  style={{ color: isActive ? item.color : '#9CA3AF' }}
                />
              </div>
              <span 
                className={`text-[10px] mt-0.5 transition-all duration-200 ${isActive ? 'font-bold' : 'font-medium'}`}
                style={{ color: isActive ? item.color : '#6B7280' }}
              >
                {getLabel(item.labelKey)}
              </span>
              {/* Active indicator dot */}
              {isActive && (
                <div 
                  className="w-1 h-1 rounded-full mt-0.5 animate-pulse"
                  style={{ backgroundColor: item.color }}
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
