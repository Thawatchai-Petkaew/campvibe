import translations from './translations.json';

export type Language = 'en' | 'th';
export type TranslationType = typeof translations.en;

export function getTranslations(lang: Language): TranslationType {
    return (translations[lang] || translations.en) as TranslationType;
}
