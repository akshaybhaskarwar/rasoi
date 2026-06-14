import { Home, Package, ShoppingCart, Calendar, BookOpen } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';

export const BottomNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { getLabel } = useLanguage();

  // Per-route colors are meaningful: orange=warmth (home), green=fresh
  // (inventory), purple=creative (planner), pink=culinary (recipes),
  // blue=trustworthy (shopping). Each tab carries its color even when
  // inactive; the active tab makes it bolder via gradient background,
  // tighter stroke, scale lift, and a pulsing indicator.
  const navItems = [
    {
      path: '/',
      icon: Home,
      labelKey: 'home',
      testId: 'nav-home',
      color: '#FF9933',
      gradient: 'from-orange-100 to-amber-50',
      ring: 'ring-orange-300/40',
    },
    {
      path: '/inventory',
      icon: Package,
      labelKey: 'inventory',
      testId: 'nav-inventory',
      color: '#10B981',
      gradient: 'from-emerald-100 to-green-50',
      ring: 'ring-emerald-300/40',
    },
    {
      path: '/planner',
      icon: Calendar,
      labelKey: 'planner',
      testId: 'nav-planner',
      color: '#8B5CF6',
      gradient: 'from-violet-100 to-purple-50',
      ring: 'ring-violet-300/40',
    },
    {
      path: '/recipes',
      icon: BookOpen,
      labelKey: 'recipes',
      testId: 'nav-recipes',
      color: '#EC4899',
      gradient: 'from-pink-100 to-rose-50',
      ring: 'ring-pink-300/40',
    },
    {
      path: '/shopping',
      icon: ShoppingCart,
      labelKey: 'shopping',
      testId: 'nav-shopping',
      color: '#3B82F6',
      gradient: 'from-blue-100 to-sky-50',
      ring: 'ring-blue-300/40',
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
              className={`group flex flex-col items-center justify-center min-w-[60px] min-h-[56px] px-1.5 rounded-2xl transition-all duration-200 active:scale-95 ${
                isActive
                  ? `scale-105 shadow-md ring-2 bg-gradient-to-br ${item.gradient} ${item.ring}`
                  : 'hover:bg-gray-50'
              }`}
              data-testid={item.testId}
            >
              {/* Icon — always tinted with the tab's own color, even when
                  inactive, so the navigation feels alive and color-coded
                  at a glance. Active state adds a soft halo + thicker stroke. */}
              <div
                className={`p-1.5 rounded-xl transition-all duration-200 ${
                  isActive ? 'shadow-sm' : ''
                }`}
                style={{
                  backgroundColor: isActive ? `${item.color}1F` : `${item.color}0F`,
                }}
              >
                <Icon
                  className={`w-5 h-5 transition-all duration-200 ${
                    isActive ? 'stroke-[2.5px]' : 'stroke-[2px]'
                  }`}
                  style={{ color: item.color }}
                />
              </div>

              {/* Label — colored when active, soft gray when inactive so
                  the active state is unambiguous even at a quick glance. */}
              <span
                className={`text-[10px] mt-0.5 transition-all duration-200 ${
                  isActive ? 'font-bold' : 'font-medium'
                }`}
                style={{ color: isActive ? item.color : '#4B5563' }}
              >
                {getLabel(item.labelKey)}
              </span>

              {/* Active indicator dot — sits below the label and pulses,
                  the only motion in the nav, so it draws the eye reliably. */}
              <div
                className="w-1 h-1 rounded-full mt-0.5 transition-all duration-200"
                style={{
                  backgroundColor: isActive ? item.color : 'transparent',
                  animation: isActive ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none',
                }}
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
};
