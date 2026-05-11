import * as React from 'react';
import { useLanguageStore } from '../store/language';
import en from '../locales/en.json';
import zh from '../locales/zh.json';

interface TranslationDict {
  [key: string]: string | TranslationDict;
}

type TranslationValue = string | TranslationDict;

const dictionaries = {
  en,
  zh,
} satisfies Record<string, TranslationDict>;

export function useTranslation() {
  const language = useLanguageStore((state) => state.language);
  const dict = dictionaries[language];
  const missingKeysRef = React.useRef<Set<string>>(new Set());

  const t = React.useCallback((path: string, fallback?: string): string => {
    const keys = path.split('.');
    let current: TranslationValue = dict;
    for (const key of keys) {
      if (typeof current === "string" || !(key in current)) {
        if (fallback !== undefined) {
          return fallback;
        }
        if (!missingKeysRef.current.has(path)) {
          missingKeysRef.current.add(path);
          console.warn(`Translation key not found: ${path}`);
        }
        return path;
      }
      current = current[key];
    }
    if (typeof current === "string") {
      return current;
    }
    if (fallback !== undefined) {
      return fallback;
    }
    if (!missingKeysRef.current.has(path)) {
      missingKeysRef.current.add(path);
      console.warn(`Translation key not found: ${path}`);
    }
    return path;
  }, [dict]);

  return { t, language };
}
