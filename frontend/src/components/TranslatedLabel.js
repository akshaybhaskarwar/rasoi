import { useState, useEffect } from 'react';
import { Check, Sparkles, Edit2, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * TranslatedLabel Component
 * Displays bilingual labels with verification status and edit capability
 * 
 * Props:
 * - textEn: English text (primary)
 * - textRegional: Pre-translated regional text (optional)
 * - targetLanguage: 'hi' | 'mr' (from language selector)
 * - showVerification: Show verify/edit controls (default: true)
 * - onTranslationUpdate: Callback when translation is edited
 * - size: 'sm' | 'md' | 'lg' (default: 'md')
 * - className: Additional classes
 */
export const TranslatedLabel = ({
  textEn,
  textRegional = null,
  targetLanguage = 'hi',
  showVerification = true,
  onTranslationUpdate = null,
  size = 'md',
  className = ''
}) => {
  const [translation, setTranslation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Size classes
  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  // Fetch translation if not provided
  useEffect(() => {
    if (targetLanguage === 'en' || !textEn) {
      setTranslation(null);
      return;
    }

    // If regional text is already provided, use it
    if (textRegional) {
      setTranslation({
        translated_text: textRegional,
        is_ai_generated: false,
        user_verified: true,
        community_verified: true,
        user_verified_count: 100
      });
      return;
    }

    // Fetch from API
    const fetchTranslation = async () => {
      setIsLoading(true);
      try {
        const response = await axios.post(`${API}/translate`, {
          text: textEn,
          target_languages: [targetLanguage]
        });
        
        if (response.data.translations?.[targetLanguage]) {
          setTranslation(response.data.translations[targetLanguage]);
        }
      } catch (error) {
        console.error('Translation fetch error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTranslation();
  }, [textEn, textRegional, targetLanguage]);

  // Handle verification
  const handleVerify = async () => {
    if (!translation) return;
    
    setIsVerifying(true);
    try {
      const response = await axios.post(`${API}/translate/verify`, {
        source_text: textEn,
        target_language: targetLanguage,
        translated_text: translation.translated_text
      });
      
      if (response.data.success) {
        setTranslation(prev => ({
          ...prev,
          user_verified: true,
          community_verified: response.data.community_verified,
          user_verified_count: response.data.user_verified_count
        }));
      }
    } catch (error) {
      console.error('Verification error:', error);
    } finally {
      setIsVerifying(false);
    }
  };

  // Handle edit save
  const handleSaveEdit = async () => {
    if (!editValue.trim()) return;
    
    try {
      const response = await axios.post(`${API}/translate/edit`, {
        source_text: textEn,
        target_language: targetLanguage,
        custom_label: editValue.trim()
      });
      
      if (response.data.success) {
        setTranslation(prev => ({
          ...prev,
          translated_text: editValue.trim(),
          custom_label: editValue.trim(),
          is_ai_generated: false,
          user_verified: true
        }));
        setIsEditing(false);
        
        if (onTranslationUpdate) {
          onTranslationUpdate(editValue.trim());
        }
      }
    } catch (error) {
      console.error('Edit save error:', error);
    }
  };

  // Start editing
  const startEditing = () => {
    setEditValue(translation?.translated_text || '');
    setIsEditing(true);
  };

  // If English only or loading
  if (targetLanguage === 'en') {
    return <span className={`${sizeClasses[size]} ${className}`}>{textEn}</span>;
  }

  if (isLoading) {
    return (
      <span className={`${sizeClasses[size]} ${className}`}>
        {textEn}
        <span className="text-gray-400 ml-1 animate-pulse">/ ...</span>
      </span>
    );
  }

  // Render bilingual label
  return (
    <TooltipProvider>
      <span className={`inline-flex flex-wrap items-center gap-1 ${sizeClasses[size]} ${className}`}>
        {/* English (Primary) */}
        <span className="font-medium text-gray-900">{textEn}</span>
        
        {/* Separator */}
        {translation && (
          <>
            <span className="text-gray-400 mx-0.5">/</span>
            
            {/* Regional Translation */}
            {isEditing ? (
              <span className="inline-flex items-center gap-1">
                <Input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="h-6 w-24 text-xs px-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit();
                    if (e.key === 'Escape') setIsEditing(false);
                  }}
                  autoFocus
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5 w-5 p-0 text-green-600 hover:text-green-700"
                  onClick={handleSaveEdit}
                >
                  <Check className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5 w-5 p-0 text-gray-400 hover:text-gray-600"
                  onClick={() => setIsEditing(false)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </span>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span 
                    className={`cursor-pointer transition-colors ${
                      translation.is_ai_generated && !translation.user_verified
                        ? 'italic text-amber-600'
                        : translation.community_verified
                        ? 'text-green-700 font-medium'
                        : 'text-gray-700'
                    }`}
                    onClick={showVerification ? startEditing : undefined}
                  >
                    {translation.translated_text}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[200px]">
                  <p className="text-xs">
                    {translation.is_ai_generated && !translation.user_verified
                      ? '🤖 AI Translation (click to edit)'
                      : translation.community_verified
                      ? `✅ Community Verified (${translation.user_verified_count}+ users)`
                      : translation.custom_label
                      ? '👵 Your custom term (Dadi\'s choice!)'
                      : translation.user_verified
                      ? '✓ Verified translation'
                      : 'Click to edit'}
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
            
            {/* Status Indicators */}
            {showVerification && !isEditing && (
              <span className="inline-flex items-center gap-0.5 ml-0.5">
                {/* AI Generated indicator */}
                {translation.is_ai_generated && !translation.user_verified && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center">
                        <Sparkles className="w-3 h-3 text-amber-500" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">AI translated - needs verification</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                
                {/* Community Verified Badge */}
                {translation.community_verified && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge 
                        variant="outline" 
                        className="h-4 px-1 py-0 text-[9px] bg-green-50 border-green-200 text-green-700"
                      >
                        <Users className="w-2 h-2 mr-0.5" />
                        Gold
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Community verified by {translation.user_verified_count}+ users</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                
                {/* Verify Button (only for unverified AI translations) */}
                {translation.is_ai_generated && !translation.user_verified && !translation.community_verified && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 w-5 p-0 text-gray-400 hover:text-green-600"
                        onClick={handleVerify}
                        disabled={isVerifying}
                      >
                        <Check className={`w-3 h-3 ${isVerifying ? 'animate-pulse' : ''}`} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Mark as correct ("Looks Right")</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                
                {/* Edit Button (for verified translations) */}
                {(translation.user_verified || translation.community_verified) && !translation.custom_label && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 w-5 p-0 text-gray-400 hover:text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={startEditing}
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Edit (Dadi's Override)</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </span>
            )}
          </>
        )}
      </span>
    </TooltipProvider>
  );
};

export default TranslatedLabel;
