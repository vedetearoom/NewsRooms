"use client";

import Link from "next/link";
import { ArrowRight, Bot, FolderKanban, LayoutDashboard, Radio, Workflow } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

type FeatureGatewayProps = {
  accent?: string;
};

const featurePages = [
  {
    titleKey: "landing.nav.panorama",
    href: "/landing/intelligence-panorama",
    eyebrowKey: "landing.gateway.panoramaEyebrow",
    descriptionKey: "landing.gateway.panoramaDescription",
    icon: LayoutDashboard,
    statusKey: "landing.gateway.statusOverview",
  },
  {
    titleKey: "landing.nav.workspace",
    href: "/landing/content-workspace",
    eyebrowKey: "landing.gateway.workspaceEyebrow",
    descriptionKey: "landing.gateway.workspaceDescription",
    icon: FolderKanban,
    statusKey: "landing.gateway.statusOverview",
  },
  {
    titleKey: "landing.nav.network",
    href: "/landing/intelligence-network",
    eyebrowKey: "landing.gateway.networkEyebrow",
    descriptionKey: "landing.gateway.networkDescription",
    icon: Radio,
    statusKey: "landing.gateway.statusOnePage",
  },
  {
    titleKey: "landing.nav.studio",
    href: "/landing/agent-studio",
    eyebrowKey: "landing.gateway.studioEyebrow",
    descriptionKey: "landing.gateway.studioDescription",
    icon: Bot,
    statusKey: "landing.gateway.statusOverview",
  },
];

export function FeatureGateway({ accent = "#c0c0dd" }: FeatureGatewayProps) {
  const { t, language } = useTranslation();
  const zh = language === "zh";
  return (
    <section id="features" className="border-t border-white/[0.05] px-6 py-20 sm:px-10 lg:px-24">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-start">
        <div className="max-w-xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 font-mono text-[11px] uppercase text-white/55">
            <Workflow className="h-3.5 w-3.5" style={{ color: accent }} />
            {t("landing.gateway.badge")}
          </div>
          <h2 className={`font-semibold text-[#f4f3ee] ${zh ? 'text-[40px] sm:text-[48px] leading-[1.15] tracking-[0.02em] text-balance font-serif' : 'text-[40px] sm:text-[48px] leading-[1.05]'}`}>
            {t("landing.gateway.title")}
          </h2>
          <p className={`mt-5 text-white/50 ${zh ? 'text-[17px] leading-[2] tracking-[0.02em] text-pretty' : 'text-[16px] leading-7'}`}>
            {t("landing.gateway.body")}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {featurePages.map((feature) => {
            const Icon = feature.icon;
            const card = (
              <div className="group flex h-full min-h-[260px] flex-col justify-between rounded-lg border border-white/[0.07] bg-white/[0.025] p-5 transition-colors hover:border-white/[0.16] hover:bg-white/[0.04]">
                <div>
                  <div className="mb-6 flex items-center justify-between gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md border border-white/[0.08] bg-black/20">
                      <Icon className="h-4 w-4 text-white/75" />
                    </div>
                    <span className="rounded-md border border-white/[0.07] px-2 py-1 font-mono text-[10px] uppercase text-white/35">
                      {t(feature.statusKey)}
                    </span>
                  </div>
                  <p className="mb-3 font-mono text-[11px] uppercase text-white/35">{t(feature.eyebrowKey)}</p>
                  <h3 className={`font-semibold text-white ${zh ? 'text-[22px] tracking-[0.01em] text-balance font-serif' : 'text-[21px]'}`}>{t(feature.titleKey)}</h3>
                  <p className={`mt-4 text-white/48 ${zh ? 'text-[13.5px] leading-[1.85] tracking-[0.01em] text-pretty' : 'text-[13.5px] leading-6'}`}>{t(feature.descriptionKey)}</p>
                </div>
                <div className="mt-8 inline-flex items-center gap-2 text-[13px] font-semibold text-white/72">
                  {t("landing.gateway.openPage")}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            );

            return feature.href.startsWith("#") ? (
              <a key={feature.titleKey} href={feature.href} className="block h-full no-underline">
                {card}
              </a>
            ) : (
              <Link key={feature.titleKey} href={feature.href} className="block h-full no-underline">
                {card}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
