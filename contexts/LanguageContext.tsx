"use client";

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import translations from '@/locales/translations.json';

export type Language = 'en' | 'th';
type Translations = typeof translations.en;

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: Translations;
    formatCurrency: (amount: number) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// CAM-688 — BR-2: the cookie the SERVER reads (app/layout.tsx) to resolve the
// language before the first byte, so first paint matches the camper's saved
// preference. Not httpOnly (the client must write it); carries no personal
// data and reaches no permission/pricing decision.
const COOKIE_NAME = 'campvibe_lang';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // one year (BR-2)

function writeLanguageCookie(lang: Language) {
    const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; secure' : '';
    document.cookie = `${COOKIE_NAME}=${lang}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; samesite=lax${secure}`;
}

// Only recognises a resolved `th`/`en` value (BR-3); an absent or garbage
// cookie both read as "no cookie" here, which is the correct input to the
// one-time migration below either way.
function readLanguageCookie(): Language | null {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(/(?:^|;\s*)campvibe_lang=([^;]*)/);
    const value = match?.[1];
    return value === 'th' || value === 'en' ? value : null;
}

// CAM-688 BR-4: `useRouter()` throws ("invariant expected app router to be
// mounted") outside a real Next.js App Router tree — true for several of the
// 9 test files that mount LanguageProvider bare (no next/navigation mock;
// they predate this story and are out of this diff's file surface). The
// hook itself always runs, in the same order, on every render (Rules of
// Hooks intact); only the RESULT differs when no router is mounted, and
// `refresh` degrades to a no-op rather than crashing the provider.
function useOptionalRouter() {
    try {
        return useRouter();
    } catch {
        return null;
    }
}

export function LanguageProvider({
    children,
    initialLanguage = 'en',
}: {
    children: ReactNode;
    /** CAM-688 — server-resolved from the `campvibe_lang` cookie (app/layout.tsx)
     * so SSR and the client's first render agree. Optional + defaults to 'en' so
     * the provider still mounts bare in tests. */
    initialLanguage?: Language;
}) {
    const [language, setLanguage] = useState<Language>(initialLanguage);
    const router = useOptionalRouter();

    // CAM-688 — one-time migration, NOT a "load on every mount" effect: a
    // returning camper's Thai preference may still live only in localStorage
    // (pre-fix). Copy it into the cookie so the SERVER can read it on the
    // NEXT visit. Runs only when no cookie is present yet (BR-1: cookie wins)
    // AND localStorage carries a value (EC-2: neither present -> no write).
    // A lazy useState initializer reading localStorage was rejected in
    // tech.md — it would diverge from the server's SSR value and trip a real
    // React 19 hydration mismatch; this effect intentionally runs AFTER the
    // SSR-matched first paint instead.
    useEffect(() => {
        if (readLanguageCookie()) return; // cookie already resolved this
        const savedLang = localStorage.getItem('campvibe_lang');
        if (savedLang === 'en' || savedLang === 'th') {
            setLanguage(savedLang);
            writeLanguageCookie(savedLang);
        }
    }, []);

    // Save language to localStorage + the cookie when it changes (BR-2: keep
    // both in sync — e2e + back-compat depend on localStorage staying
    // populated too).
    const handleSetLanguage = (lang: Language) => {
        setLanguage(lang);
        localStorage.setItem('campvibe_lang', lang);
        writeLanguageCookie(lang);
        // BR-4: the server-rendered <html lang> (and any other
        // server-resolved copy) must not go stale after an in-session switch.
        router?.refresh();
    };

    const formatCurrency = (amount: number) => {
        const currentCurrency = translations[language].currency;
        // Coerce: money may arrive as a Decimal serialized to string (ADR-002). Number() normalizes.
        const numericAmount = Number(amount);
        // If English, convert from THB base (demo logic)
        const convertedAmount = language === 'en'
            ? numericAmount / translations.th.currency.rate
            : numericAmount;

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
