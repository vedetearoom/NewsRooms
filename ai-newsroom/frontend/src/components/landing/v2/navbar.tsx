"use client";

import Link from "next/link";
import { useTranslation } from "@/hooks/useTranslation";
import { useLanguageStore } from "@/store/language";

type V2NavbarProps = {
  accent?: string;
  isAuthenticated?: boolean;
  onLogin?: () => void;
  onRegister?: () => void;
  onGoToApp?: () => void;
};

const navItems = [
  { labelKey: "landing.nav.overview", href: "/landing" },
  { labelKey: "landing.nav.panorama", href: "/landing/intelligence-panorama" },
  { labelKey: "landing.nav.workspace", href: "/landing/content-workspace" },
  { labelKey: "landing.nav.network", href: "/landing/intelligence-network" },
  { labelKey: "landing.nav.studio", href: "/landing/agent-studio" },
];

export function V2Navbar({ accent = "#ffffff", isAuthenticated, onLogin, onRegister, onGoToApp }: V2NavbarProps) {
  const { t, language } = useTranslation();
  const toggleLanguage = useLanguageStore((state) => state.toggleLanguage);
  const secondaryAction = isAuthenticated ? onGoToApp : onLogin;
  const primaryAction = isAuthenticated ? onGoToApp : onRegister;
  const switchTitle = language === "en" ? t("landing.nav.switchToChinese") : t("landing.nav.switchToEnglish");

  return (
    <nav className="relative z-10 flex items-center justify-between gap-5 border-b border-white/[0.04] px-5 py-4 lg:px-10">
      <Link href="/landing" className="flex items-center gap-2.5 no-underline">
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: "radial-gradient(circle at 35% 30%, #666 0%, #1a1a1a 70%)",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: `0 0 18px ${accent}22`,
          }}
        />
        <span className="text-[14.5px] font-semibold tracking-[-0.02em] text-white">Newsroom</span>
        <span className="ml-2 rounded border border-white/[0.06] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-white/30">
          v1.0
        </span>
      </Link>

      <div className="hidden items-center gap-7 text-[13px] tracking-[-0.005em] text-white/50 md:flex">
        {navItems.map((item) => (
          <Link key={item.labelKey} href={item.href} className="text-inherit no-underline transition-colors hover:text-white/80">
            {t(item.labelKey)}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-3.5">
        <button
          type="button"
          onClick={toggleLanguage}
          title={switchTitle}
          aria-label={switchTitle}
          className="font-mono text-[11px] tracking-[-0.01em] text-white/38 transition-colors hover:text-white/70"
        >
          <span className={language === "zh" ? "text-white/75" : "text-white/32"}>中文</span>
          <span className="px-1.5 text-white/18">·</span>
          <span className={language === "en" ? "text-white/75" : "text-white/32"}>EN</span>
        </button>
        <button
          type="button"
          onClick={secondaryAction}
          className="hidden border-0 bg-transparent text-[13px] tracking-[-0.005em] text-white/50 transition-colors hover:text-white/80 sm:inline-flex"
        >
          {isAuthenticated ? t("landing.nav.dashboard") : t("landing.nav.login")}
        </button>
        <button
          type="button"
          onClick={primaryAction}
          className="group inline-flex items-center gap-1.5 rounded-[11px] border border-white/80 bg-white px-3.5 py-1.5 text-[13px] font-semibold tracking-[-0.01em] text-[#08090b] shadow-[0_10px_28px_-18px_rgba(255,255,255,0.75)] transition-all duration-200 hover:bg-white/92 hover:shadow-[0_14px_34px_-20px_rgba(255,255,255,0.85)]"
        >
          <span>{isAuthenticated ? t("landing.nav.goToApp") : t("landing.nav.getAccess")}</span>
          <span className="translate-y-[-0.5px] transition-transform duration-200 group-hover:translate-x-0.5">→</span>
        </button>
      </div>
    </nav>
  );
}
