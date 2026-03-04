/**
 * Central i18n hook: use translation key and current language.
 * Use this when you need t(key) without AuthContext (e.g. public pages).
 * For RTL: document.dir is set in AuthProvider from language; when using this hook
 * outside AuthProvider, ensure language is read from localStorage and dir is set.
 */
import { useMemo } from 'react';
import { translations, t as tKey } from '../utils/translations';

const getStoredLanguage = () => {
  if (typeof window === 'undefined') return 'ar';
  return localStorage.getItem('tebbi_lang') || 'ar';
};

export function useTranslations() {
  const language = getStoredLanguage();
  const t = useMemo(() => (key) => tKey(key, language), [language]);
  const isRTL = language === 'ar';
  return { t, language, isRTL };
}

export default useTranslations;
