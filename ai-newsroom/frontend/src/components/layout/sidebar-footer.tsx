"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { LogOut, Moon, Sun } from "lucide-react";
import { logout, useAuthState } from "@/lib/auth";
import { useTranslation } from "@/hooks/useTranslation";
import { useLanguageStore } from "@/store/language";

export function SidebarFooter() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { t, language } = useTranslation();
  const { toggleLanguage } = useLanguageStore();
  const { user } = useAuthState();

  const [mounted, setMounted] = React.useState(false);
  
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const initials = React.useMemo(() => {
    const base = user?.display_name || user?.username || "AD";
    return base
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("")
      .slice(0, 2);
  }, [user]);

  const roleName = React.useMemo(() => {
    const code = user?.roles?.[0]?.code;
    if (code === "super_admin") return t("system.superAdmin");
    if (code === "user") return t("system.normalUser");
    return user?.roles?.[0]?.name || t("sidebar.freePlan");
  }, [t, user]);

  return (
    <div className="group flex items-center justify-between rounded-2xl bg-zinc-100/75 p-2 transition-all dark:bg-white/[0.03] dark:hover:bg-white/[0.05]">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 shrink-0 rounded-lg bg-zinc-200/70 dark:bg-white/10 flex items-center justify-center text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase">
          {initials || "AD"}
        </div>
          <div className="flex flex-col min-w-0 pr-1">
            <span className="text-[13.5px] font-medium text-zinc-900 dark:text-zinc-100 leading-none truncate">
              {user?.display_name || user?.username || "admin"}
            </span>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1.5 leading-none whitespace-nowrap truncate">
              {roleName}
            </span>
          </div>
      </div>

      {mounted && (
        <div className="flex items-center gap-0.5 text-zinc-400 dark:text-zinc-500 opacity-80 group-hover:opacity-100 transition-opacity shrink-0 ml-1">
          <button
            onClick={(e) => { e.stopPropagation(); toggleLanguage(); }}
            className="flex items-center justify-center w-6 h-6 rounded-lg hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-white/10 transition-colors"
            title={language === 'en' ? t("sidebar.switchToChinese") : t("sidebar.switchToEnglish")}
          >
            <span className="text-[10px] font-mono tracking-widest ml-[1px]">{language === 'en' ? '中' : 'EN'}</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setTheme(theme === "dark" ? "light" : "dark"); }}
            className="flex items-center justify-center w-6 h-6 rounded-lg hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-white/10 transition-colors"
            title={t("sidebar.toggleTheme")}
          >
            {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              logout();
              router.push("/landing");
            }}
            className="flex items-center justify-center w-6 h-6 rounded-lg hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors ml-0.5"
            title={t("sidebar.logOut")}
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
