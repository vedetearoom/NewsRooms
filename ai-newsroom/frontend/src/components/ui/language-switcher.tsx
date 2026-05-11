"use client";

import { useLanguageStore } from "@/store/language";
import { usePathname } from "next/navigation";

export function LanguageSwitcher() {
  const { language, toggleLanguage } = useLanguageStore();
  const pathname = usePathname();

  // Only show on the Inbox page
  if (pathname !== "/") return null;

  return (
    <button
      onClick={toggleLanguage}
      className="fixed top-3 right-6 z-50 flex items-center justify-center w-7 h-7 rounded bg-transparent text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors"
      title={language === 'en' ? '切换到中文' : 'Switch to English'}
    >
      {language === 'en' ? '中' : 'EN'}
    </button>
  );
}
