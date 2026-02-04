import { Home, Package, ShoppingCart, Calendar, BookOpen } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';

export const BottomNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { getLabel } = useLanguage();

  const navItems = [
    { path: '/', icon: Home, labelKey: 'home', testId: 'nav-home' },
    { path: '/inventory', icon: Package, labelKey: 'inventory', testId: 'nav-inventory' },
    { path: '/planner', icon: Calendar, labelKey: 'planner', testId: 'nav-planner' },
    { path: '/recipes', icon: BookOpen, labelKey: 'recipes', testId: 'nav-recipes' },
    { path: '/shopping', icon: ShoppingCart, labelKey: 'shopping', testId: 'nav-shopping' },
  ];

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden z-[100] safe-area-bottom"
      data-testid="bottom-navigation"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center min-w-[64px] min-h-[56px] rounded-xl transition-all active:scale-95 ${
                isActive 
                  ? 'text-[#FF9933] bg-[#FFFBF0]' 
                  : 'text-gray-500 hover:text-[#FF9933] active:bg-gray-100'
              }`}
              data-testid={item.testId}
            >
              <Icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5px]' : ''}`} />
              <span className={`text-[10px] mt-1 ${isActive ? 'font-semibold' : 'font-medium'}`}>
                {getLabel(item.labelKey)}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
