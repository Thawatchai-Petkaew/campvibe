"use client";

import { useLanguage } from '@/contexts/LanguageContext';
import { Globe } from 'lucide-react';

export function LanguageSwitcher() {
    const { language, setLanguage } = useLanguage();

    const toggleLanguage = () => {
        setLanguage(language === 'en' ? 'th' : 'en');
    };

    return (
        <button
            onClick={toggleLanguage}
            className="flex items-center gap-2 px-3 py-2 rounded-full hover:bg-gray-100 transition text-sm font-medium"
            aria-label="Switch language"
        >
            <Globe className="w-4 h-4" />
            <span className="uppercase">{language}</span>
        </button>
    );
}
