"use client";

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import translations from '@/locales/translations.json';

type Language = 'en' | 'th';
type Translations = typeof translations.en;

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: Translations;
    formatCurrency: (amount: number) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [language, setLanguage] = useState<Language>('en');

    // Load language from localStorage on mount
    useEffect(() => {
        const savedLang = localStorage.getItem('campvibe_lang') as Language;
        if (savedLang && (savedLang === 'en' || savedLang === 'th')) {
            setLanguage(savedLang);
        }
    }, []);

    // Save language to localStorage when it changes
    const handleSetLanguage = (lang: Language) => {
        setLanguage(lang);
        localStorage.setItem('campvibe_lang', lang);
    };

    const formatCurrency = (amount: number) => {
        const currentCurrency = translations[language].currency;
        // If English, convert from THB base (demo logic)
        const convertedAmount = language === 'en'
            ? amount / translations.th.currency.rate
            : amount;

        return new Intl.NumberFormat(language === 'th' ? 'th-TH' : 'en-US', {
            style: 'currency',
            currency: currentCurrency.name,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(convertedAmount);
    };

    const value: LanguageContextType = {
        language,
        setLanguage: handleSetLanguage,
        t: (translations as any)[language],
        formatCurrency,
    };

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within LanguageProvider');
    }
    return context;
}
