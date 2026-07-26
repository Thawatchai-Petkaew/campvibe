"use client";

import { useLanguage } from '@/contexts/LanguageContext';
import { Globe } from 'lucide-react';

export function LanguageSwitcher() {
    const { language, setLanguage, t } = useLanguage();

    const toggleLanguage = () => {
        setLanguage(language === 'en' ? 'th' : 'en');
    };

    return (
        <button
            onClick={toggleLanguage}
            // CAM-558: measured 36px tall (px-3 py-2 + content). This control now only
            // renders at md+ (CAM-549 hides it below md), so only the desktop-width
            // measurement matters — h-11 pins it to the 44px floor.
            className="flex items-center gap-2 px-3 h-11 rounded-full hover:bg-muted transition text-sm font-medium"
            aria-label={t.nav.switchLanguageAriaLabel}
        >
            <Globe className="w-4 h-4" />
            <span className="uppercase">{language}</span>
        </button>
    );
}
