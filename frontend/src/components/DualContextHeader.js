import { useState, useEffect } from 'react';
import { MapPin, Globe, Shield, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import HouseholdSwitcher from '@/components/HouseholdSwitcher';

export const DualContextHeader = ({ onLanguageChange }) => {
  const { language, changeLanguage, getLabel } = useLanguage();
  const { isAuthenticated, user } = useAuth();

  const handleLanguageChange = (value) => {
    changeLanguage(value);
    if (onLanguageChange) {
      onLanguageChange(value);
    }
  };

  return (
    <header 
      className="sticky top-0 z-50 glassmorphism shadow-sm"
      data-testid="dual-context-header"
    >
      {/* Mobile Header - Compact */}
      <div className="md:hidden px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full masala-gradient flex items-center justify-center text-white font-bold text-sm">
              RS
            </div>
            <span className="font-bold text-lg text-gray-800">{getLabel('appName')}</span>
          </div>
          
          {/* Mobile: Household Switcher + About + Admin + Language */}
          <div className="flex items-center gap-2">
            {/* About Link - Mobile */}
            <Link to="/about">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" data-testid="about-link-mobile">
                <Info className="w-4 h-4 text-orange-600" />
              </Button>
            </Link>
            
            {/* Admin Link - Mobile */}
            {isAuthenticated && user?.is_admin && (
              <Link to="/admin">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <Shield className="w-4 h-4 text-purple-600" />
                </Button>
              </Link>
            )}
            
            {isAuthenticated && <HouseholdSwitcher />}
            
            {/* Language toggle - compact */}
            <Select value={language} onValueChange={handleLanguageChange}>
              <SelectTrigger 
                className="w-[80px] h-8 border-[#FF9933] focus:ring-[#FF9933] text-xs px-2"
                data-testid="language-selector-mobile"
              >
                <Globe className="w-3 h-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en" className="text-xs">🇬🇧 EN</SelectItem>
                <SelectItem value="hi" className="text-xs">🇮🇳 हिं</SelectItem>
                <SelectItem value="mr" className="text-xs">🇮🇳 मरा</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Desktop Header - Full */}
      <div className="hidden md:block container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full masala-gradient flex items-center justify-center text-white font-bold text-lg">
              RS
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{getLabel('appName')}</h1>
              <p className="text-xs text-gray-500">{getLabel('appTagline')}</p>
            </div>
          </div>

          {/* Location & Culture Badge */}
          <div className="flex items-center gap-4 bg-[#FFFBF0] px-4 py-2 rounded-full border border-[#FFCC00]/30">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-[#FF9933]" />
              <span className="font-medium">{user?.city || 'Pune'}, MH</span>
            </div>
            <div className="w-px h-4 bg-gray-300" />
            <div className="flex items-center gap-2 text-sm">
              <span className="text-xl">🍛</span>
              <span className="font-medium">{getLabel('indianKitchen')}</span>
            </div>
          </div>

          {/* Right side: Admin + Household + Language */}
          <div className="flex items-center gap-4">
            {/* Admin Link - Desktop */}
            {isAuthenticated && user?.is_admin && (
              <Link to="/admin">
                <Button variant="outline" size="sm" className="gap-2 border-purple-300 text-purple-700 hover:bg-purple-50">
                  <Shield className="w-4 h-4" />
                  Admin
                </Button>
              </Link>
            )}
            
            {/* Household Switcher */}
            {isAuthenticated && <HouseholdSwitcher />}
            
            {/* Language Toggle */}
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-gray-600" />
              <Select value={language} onValueChange={handleLanguageChange}>
                <SelectTrigger 
                  className="w-[160px] border-[#FF9933] focus:ring-[#FF9933]"
                  data-testid="language-selector"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en" data-testid="lang-en">
                    <span className="flex items-center gap-2">🇬🇧 English</span>
                  </SelectItem>
                  <SelectItem value="hi" data-testid="lang-hi">
                    <span className="flex items-center gap-2">🇮🇳 हिन्दी (Hindi)</span>
                  </SelectItem>
                  <SelectItem value="mr" data-testid="lang-mr">
                    <span className="flex items-center gap-2">🇮🇳 मराठी (Marathi)</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
