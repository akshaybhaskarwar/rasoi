import { Home, Package, ShoppingCart, Calendar, Users } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

export const BottomNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/', icon: Home, label: 'Home', testId: 'nav-home' },
    { path: '/inventory', icon: Package, label: 'Inventory', testId: 'nav-inventory' },
    { path: '/shopping', icon: ShoppingCart, label: 'Shopping', testId: 'nav-shopping' },
    { path: '/planner', icon: Calendar, label: 'Planner', testId: 'nav-planner' },
    { path: '/community', icon: Users, label: 'Community', testId: 'nav-community' },
  ];

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 bg-white bottom-nav-shadow md:hidden z-50"
      data-testid="bottom-navigation"
    >
      <div className="flex items-center justify-around py-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all ${
                isActive 
                  ? 'text-[#FF9933] bg-[#FFFBF0]' 
                  : 'text-gray-600 hover:text-[#FF9933]'
              }`}
              data-testid={item.testId}
            >
              <Icon className="w-6 h-6" />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
