import { useState } from 'react';
import { MapPin, Globe } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export const DualContextHeader = ({ onLanguageChange }) => {
  const [language, setLanguage] = useState('en');

  const handleLanguageChange = (value) => {
    setLanguage(value);
    if (onLanguageChange) {
      onLanguageChange(value);
    }
  };

  return (
    <header 
      className="sticky top-0 z-50 glassmorphism shadow-sm"
      data-testid="dual-context-header"
    >
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full masala-gradient flex items-center justify-center text-white font-bold text-lg">
              RS
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Rasoi-Sync</h1>
          </div>

          {/* Location & Culture Badge */}
          <div className="hidden md:flex items-center gap-4 bg-[#FFFBF0] px-4 py-2 rounded-full border border-[#FFCC00]/30">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-[#FF9933]" />
              <span className="font-medium">Pune, MH</span>
            </div>
            <div className="w-px h-4 bg-gray-300" />
            <div className="flex items-center gap-2 text-sm">
              <span className="text-xl">🍛</span>
              <span className="font-medium">Gujarati Home</span>
            </div>
          </div>

          {/* Language Toggle */}
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-gray-600" />
            <Select value={language} onValueChange={handleLanguageChange}>
              <SelectTrigger 
                className="w-[140px] border-[#FF9933] focus:ring-[#FF9933]"
                data-testid="language-selector"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en" data-testid="lang-en">English</SelectItem>
                <SelectItem value="gu" data-testid="lang-gu">ગુજરાતી</SelectItem>
                <SelectItem value="mr" data-testid="lang-mr">मराठी</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </header>
  );
};
