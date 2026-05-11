"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, type LucideIcon } from "lucide-react";
import { AuthModal, type AuthMode } from "./auth-modal";
import { V2Navbar } from "./navbar";
import { isAuthenticated } from "@/lib/auth";
import { useTranslation } from "@/hooks/useTranslation";

type ModuleVariant = "panorama" | "workspace" | "network" | "studio";

type ModulePageProps = {
  variant: ModuleVariant;
  badge: string;
  title: string;
  accentTitle: string;
  description: string;
  accent: string;
  appPath: string;
  appCta: string;
  guestCta: string;
  workflowCta: string;
  sections: Array<{
    title: string;
    description: string;
    icon: LucideIcon;
  }>;
  workflow: Array<{
    label: string;
    detail: string;
  }>;
  mockTitle: string;
  mockSubtitle: string;
  mockItems: string[];
};

export function ModulePage({
  variant,
  badge,
  title,
  accentTitle,
  description,
  accent,
  appPath,
  appCta,
  guestCta,
  workflowCta,
  sections,
  workflow,
  mockTitle,
  mockSubtitle,
}: ModulePageProps) {
  const router = useRouter();
  const { t, language } = useTranslation();
  const [authOpen, setAuthOpen] = React.useState(false);
  const [authMode, setAuthMode] = React.useState<AuthMode>("login");
  const [authed, setAuthed] = React.useState(false);
  const zh = language === "zh";

  React.useEffect(() => {
    setAuthed(isAuthenticated());
  }, []);

  const openLogin = () => {
    setAuthMode("login");
    setAuthOpen(true);
  };

  const openRegister = () => {
    setAuthMode("register");
    setAuthOpen(true);
  };

  const goToApp = () => router.push("/");
  const goToModuleOrRegister = () => (authed ? router.push(appPath) : openRegister());

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#08090b] text-white" style={{ fontFamily: "'Inter Tight', 'Inter', system-ui, sans-serif" }}>
      <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(ellipse at 74% 8%, ${accent}1c, transparent 42%), radial-gradient(ellipse at 18% 36%, rgba(255,255,255,0.04), transparent 38%), linear-gradient(180deg, rgba(255,255,255,0.025), transparent 22%)` }} />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white/[0.035] to-transparent" />

      <V2Navbar accent={accent} isAuthenticated={authed} onLogin={openLogin} onRegister={openRegister} onGoToApp={goToApp} />

      <main className="relative z-[1]">
        <section className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-[0.78fr_1.22fr] lg:px-10 lg:py-24 xl:px-0">
          <div className="pt-6">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-white/55 animate-landing-fade-up">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent, boxShadow: `0 0 10px ${accent}`, animation: "v2HeroPulse 1.6s ease-in-out infinite" }} />
              {badge}
            </div>
            <h1 className={`max-w-3xl font-semibold text-[#f4f3ee] animate-landing-fade-up delay-100 ${zh ? 'text-[44px] leading-[1.15] tracking-[0.02em] sm:text-[60px] text-balance font-serif' : 'text-[42px] leading-[1.05] tracking-[-0.03em] sm:text-[52px] text-pretty'}`}>
              {title}{zh && !/^[A-Za-z]/.test(accentTitle) ? '' : ' '}<span className={zh ? 'font-serif' : 'font-serif italic font-normal'} style={{ color: accent }}>{accentTitle}</span>
            </h1>
            <p className={`mt-7 max-w-xl text-white/52 animate-landing-fade-up delay-200 ${zh ? 'text-[17px] leading-[2] tracking-[0.02em] text-pretty' : 'text-[17px] leading-8 tracking-[-0.005em]'}`}>{description}</p>
            <div className="mt-9 flex flex-wrap items-center gap-3 animate-landing-fade-up delay-300">
              <button
                type="button"
                onClick={goToModuleOrRegister}
                className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-3 text-[14px] font-semibold tracking-[-0.005em] text-[#08090b] shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_18px_48px_rgba(0,0,0,0.35)] transition-colors hover:bg-white/90 hover:scale-[1.02] active:scale-95"
              >
                {authed ? appCta : guestCta}
                <ArrowRight className="h-4 w-4" />
              </button>
              <a href="#workflow" className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] px-4 py-3 text-[14px] font-semibold tracking-[-0.005em] text-white/72 no-underline transition-all hover:bg-white/[0.04] hover:text-white hover:border-white/[0.16]">
                {workflowCta}
              </a>
            </div>

            <div className="mt-14 grid max-w-xl grid-cols-3 gap-3 border-t border-white/[0.06] pt-6 animate-landing-fade-up delay-400">
              {heroStats(variant, zh).map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 transition-colors hover:bg-white/[0.04]">
                  <div className="font-mono text-[18px] font-semibold" style={{ color: accent }}>{item.value}</div>
                  <div className="mt-2 text-[12px] leading-5 text-white/40">{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:-mr-10 xl:-mr-20 animate-landing-fade-up delay-200">
            <MockShell accent={accent} title={mockTitle} subtitle={mockSubtitle}>
              <ProductMock variant={variant} accent={accent} zh={zh} />
            </MockShell>
          </div>
        </section>

        <ModuleStorySections variant={variant} accent={accent} zh={zh} />

        <section id="features" className="border-t border-white/[0.04] px-6 py-20 lg:px-10">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-start">
            <div className="lg:sticky lg:top-8">
              <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.16em] text-white/35">{zh ? "实际界面映射" : "Interface mapping"}</p>
              <h2 className={`max-w-xl font-semibold text-[#f4f3ee] ${zh ? 'text-[36px] leading-[1.22] tracking-[-0.015em]' : 'text-[44px] leading-[1.04] tracking-[-0.04em]'}`}>
                {zh ? "把真实产品能力讲成客户能看懂的页面。" : "Show the real product surface, not a feature checklist."}
              </h2>
              <p className={`mt-5 max-w-md text-white/45 ${zh ? 'text-[14px] leading-[1.85] tracking-[0.005em]' : 'text-[15px] leading-7'}`}>
                {zh ? "每个模块页都对应后台实际工作台：客户先看到清晰的业务故事，再看到和真实界面一致的操作线索。" : "Each module page mirrors the internal workspace: a business story first, then recognizable UI patterns from the product."}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {sections.map((section, index) => {
                const Icon = section.icon;
                return (
                  <div key={section.title} className="group relative min-h-[260px] overflow-hidden rounded-[24px] border border-white/[0.07] bg-white/[0.025] p-6 transition-colors hover:border-white/[0.16] hover:bg-white/[0.045]">
                    <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-0 blur-3xl transition-opacity group-hover:opacity-70" style={{ background: `${accent}22` }} />
                    <div className="relative z-[1] mb-12 flex items-center justify-between">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] bg-black/25" style={{ color: accent }}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="font-mono text-[11px] text-white/28">0{index + 1}</span>
                    </div>
                    <h3 className={`relative z-[1] font-semibold text-white ${zh ? 'text-[20px] tracking-[-0.01em] text-balance' : 'text-[22px] tracking-[-0.025em]'}`}>{section.title}</h3>
                    <p className={`relative z-[1] mt-4 text-white/48 ${zh ? 'text-[13px] leading-[1.72] tracking-[0.005em] text-pretty break-keep' : 'text-[13.5px] leading-6 tracking-[-0.005em]'}`}>{section.description}</p>
                    <div className="relative z-[1] mt-8 space-y-2">
                      <div className="h-1.5 w-[86%] rounded-full bg-white/[0.1]" />
                      <div className="h-1.5 w-[58%] rounded-full" style={{ background: `${accent}55` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="workflow" className="border-t border-white/[0.04] px-6 py-20 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 grid gap-6 lg:grid-cols-[0.7fr_1.3fr] lg:items-end">
              <div>
                <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.16em] text-white/35">{zh ? "工作流" : "Workflow"}</p>
                <h2 className={`font-semibold text-[#f4f3ee] ${zh ? 'text-[36px] leading-[1.22] tracking-[-0.015em] text-balance break-keep' : 'text-[44px] leading-[1.04] tracking-[-0.04em]'}`}>{workflowCta}</h2>
              </div>
              <p className={`max-w-2xl text-white/45 lg:justify-self-end ${zh ? 'text-[14px] leading-[1.85] tracking-[0.005em] text-pretty break-keep' : 'text-[15px] leading-7'}`}>
                {zh ? "从进入系统的第一个信号，到整理、分发、生产和复用，模块页需要展示真实编辑团队每天会走的路径。" : "From first signal to organization, dispatch, production, and reuse, the page explains the path an editorial team actually follows."}
              </p>
            </div>

            <div className="relative grid gap-3 lg:grid-cols-5">
              <div className="pointer-events-none absolute left-0 right-0 top-8 hidden h-px bg-gradient-to-r from-transparent via-white/[0.16] to-transparent lg:block" />
              {workflow.map((step, index) => (
                <div key={step.label} className="relative rounded-2xl border border-white/[0.06] bg-[#0d0e11]/88 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.22)] animate-landing-fade-up transition-transform hover:-translate-y-1" style={{ animationDelay: `${(index + 1) * 150}ms` }}>
                  <div className="mb-10 flex items-center justify-between">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.1] bg-[#08090b] font-mono text-[11px]" style={{ color: accent }}>0{index + 1}</span>
                    <Check className="h-4 w-4 text-white/35" />
                  </div>
                  <h3 className={`text-[18px] font-semibold tracking-[-0.018em] text-white ${zh ? 'text-balance' : ''}`}>{step.label}</h3>
                  <p className={`mt-3 text-[13px] leading-6 tracking-[-0.005em] text-white/45 ${zh ? 'text-pretty break-keep' : ''}`}>{step.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-[1] border-t border-white/[0.05] bg-[#050507] px-6 py-10 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 font-mono text-[12px] text-white/30 sm:flex-row sm:items-center">
          <span>© 2026 Newsroom Labs · {badge}</span>
          <a href="/landing" className="text-white/45 no-underline hover:text-white">{t("landing.sourceManagement.backOverview")}</a>
        </div>
      </footer>

      {authOpen && <AuthModal mode={authMode} onModeChange={setAuthMode} onClose={() => setAuthOpen(false)} />}

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&family=Instrument+Serif&display=swap');
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}

function MockShell({ accent, title, subtitle, children }: { accent: string; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="relative min-h-[680px] overflow-hidden rounded-[34px] border border-white/[0.09] bg-[#0b0d0f]/94 p-5 shadow-[0_46px_150px_rgba(0,0,0,0.55)] backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:radial-gradient(rgba(255,255,255,0.85)_1px,transparent_1px)] [background-size:22px_22px]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.035] via-transparent to-black/25" />
      <div className="absolute -inset-8 -z-10 rounded-full opacity-40 blur-3xl" style={{ background: `radial-gradient(circle, ${accent}22, transparent 68%)` }} />
      <div className="relative z-[1] mb-5 flex items-center justify-between border-b border-white/[0.06] px-2 pb-5">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/35">{subtitle}</div>
          <div className="mt-1 text-[18px] font-semibold tracking-[-0.02em] text-white">{title}</div>
        </div>
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 font-mono text-[11px]" style={{ color: accent }}>LIVE</div>
      </div>
      {children}
    </div>
  );
}

function ProductMock({ variant, accent, zh }: { variant: ModuleVariant; accent: string; zh: boolean }) {
  if (variant === "workspace") return <WorkspaceMock accent={accent} zh={zh} />;
  if (variant === "network") return <NetworkMock accent={accent} zh={zh} />;
  if (variant === "studio") return <StudioMock accent={accent} zh={zh} />;
  return <PanoramaMock accent={accent} zh={zh} />;
}

function PanoramaMock({ accent, zh }: { accent: string; zh: boolean }) {
  const cards = zh
    ? [
        { source: "TechCrunch", title: "AI 浏览器开始重写搜索入口", score: "92", tags: ["AI", "产品"], type: "图文" },
        { source: "YouTube", title: "长访谈：Agent 工作流的真实限制", score: "88", tags: ["视频", "Agent"], type: "视频" },
        { source: "Newsletter", title: "开源模型本周融资和发布节奏", score: "81", tags: ["模型", "市场"], type: "图文" },
      ]
    : [
        { source: "TechCrunch", title: "AI browsers start rewriting search entry points", score: "92", tags: ["AI", "Product"], type: "Text" },
        { source: "YouTube", title: "Long interview: where agent workflows still break", score: "88", tags: ["Video", "Agents"], type: "Video" },
        { source: "Newsletter", title: "Open-model funding and release cadence this week", score: "81", tags: ["Models", "Market"], type: "Text" },
      ];

  return (
    <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
      <div className="rounded-[24px] border border-white/[0.06] bg-black/25 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-xl border border-white/[0.07] bg-white/[0.03] p-1 font-mono text-[11px] text-white/42">
            {[zh ? "今日" : "Today", zh ? "本周" : "Week", zh ? "归档" : "Archive"].map((tab, index) => (
              <span key={tab} className={`rounded-lg px-3 py-1.5 ${index === 0 ? "bg-white text-black" : ""}`}>{tab}</span>
            ))}
          </div>
          <div className="w-40 rounded-xl border border-white/[0.07] bg-black/30 px-3 py-2 text-[12px] text-white/30">Search signals</div>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {["AI", "Security", "Launch", "Funding", "Video"].map((tag, index) => (
            <span key={tag} className="rounded-full border border-white/[0.07] px-3 py-1 font-mono text-[10.5px] text-white/38" style={index === 0 ? { borderColor: `${accent}55`, color: accent } : undefined}>{tag}</span>
          ))}
        </div>
        <div className="grid gap-3">
          {cards.map((card, index) => (
            <div key={card.title} className="rounded-2xl border border-white/[0.06] bg-white/[0.035] p-4">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/28">{card.source} · {card.type}</div>
                  <div className="mt-2 text-[15.5px] font-semibold leading-5 tracking-[-0.015em] text-white">{card.title}</div>
                </div>
                <div className="rounded-xl border border-white/[0.08] bg-black/30 px-2.5 py-1.5 text-center font-mono text-[12px]" style={{ color: accent }}>{card.score}</div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {card.tags.map((tag) => <span key={tag} className="rounded-md bg-white/[0.06] px-2 py-1 text-[10px] text-white/42">{tag}</span>)}
                </div>
                <div className="h-4 w-4 rounded border border-white/[0.16]" style={index === 0 ? { background: accent } : undefined} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <div className="rounded-[24px] border border-white/[0.06] bg-black/25 p-4">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-white/30">{zh ? "编辑队列" : "Editorial queue"}</div>
          <div className="mt-5 space-y-3">
            {[zh ? "高相关信号" : "High relevance", zh ? "待分发卡片" : "Ready to dispatch", zh ? "视频待解构" : "Video to parse"].map((item, index) => (
              <div key={item} className="flex items-center gap-3 rounded-xl bg-white/[0.035] p-3">
                <span className="h-2 w-2 rounded-full" style={{ background: index === 0 ? accent : "rgba(255,255,255,0.22)" }} />
                <span className="text-[12.5px] text-white/55">{item}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[24px] border border-white/[0.06] bg-black/25 p-4">
          <div className="text-[42px] font-semibold tracking-[-0.06em]" style={{ color: accent }}>43</div>
          <div className="mt-1 text-[12px] leading-5 text-white/38">{zh ? "今日新增可处理信号" : "new actionable signals today"}</div>
        </div>
      </div>
    </div>
  );
}

function WorkspaceMock({ accent, zh }: { accent: string; zh: boolean }) {
  const columns = zh
    ? [
        { name: "灵感", count: 8, cards: ["OpenAI 产品周报", "AI 搜索角度库"] },
        { name: "写作中", count: 4, cards: ["Agent 工作流深度稿", "视频摘要改写"] },
        { name: "审稿", count: 3, cards: ["安全风险评论", "模型发布复盘"] },
      ]
    : [
        { name: "Inspiration", count: 8, cards: ["OpenAI product weekly", "AI search angle bank"] },
        { name: "Drafting", count: 4, cards: ["Agent workflow deep dive", "Video brief rewrite"] },
        { name: "Review", count: 3, cards: ["Security risk column", "Model release recap"] },
      ];

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-[24px] border border-white/[0.06] bg-black/25 p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-[14px] font-semibold text-white/80">{zh ? "生产看板" : "Production board"}</div>
          <div className="rounded-lg border border-white/[0.07] px-2 py-1 font-mono text-[10px] text-white/35">Kanban</div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {columns.map((column, columnIndex) => (
            <div key={column.name} className="min-h-[350px] rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[12px] font-semibold text-white/62">{column.name}</span>
                <span className="rounded-full bg-white/[0.07] px-2 py-0.5 font-mono text-[10px] text-white/35">{column.count}</span>
              </div>
              <div className="space-y-3">
                {column.cards.map((card, index) => (
                  <div key={card} className="rounded-xl border border-white/[0.06] bg-black/30 p-3">
                    <div className="mb-3 font-mono text-[9px] uppercase tracking-[0.1em] text-white/35" style={{ color: index === 0 && columnIndex === 1 ? accent : undefined }}>{zh ? "写入任务" : "Write task"}</div>
                    <div className="text-[12.5px] font-medium leading-5 text-white/80">{card}</div>
                    <div className="mt-4 flex gap-2">
                      <span className="h-3 w-3 rounded-full bg-white/[0.14]" />
                      <span className="h-3 w-3 rounded-full bg-white/[0.14]" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <div className="rounded-[24px] border border-white/[0.06] bg-black/25 p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-[14px] font-semibold text-white/80">{zh ? "素材上下文" : "Source context"}</div>
            <span className="rounded-md px-2 py-1 font-mono text-[10px]" style={{ background: `${accent}18`, color: accent }}>12 refs</span>
          </div>
          {(zh ? [
            { label: "引用来源", text: "The Verge: 'OpenAI 新模型架构解析'" },
            { label: "标题角度", text: "探讨推理能力对复杂任务的提升" },
            { label: "可复用结构", text: "事实总结 + 技术分析 + 行业影响" }
          ] : [
            { label: "Citations", text: "The Verge: 'OpenAI new architecture'" },
            { label: "Angles", text: "Impact of reasoning on complex tasks" },
            { label: "Structures", text: "Fact list + tech deep dive + impact" }
          ]).map((item) => (
            <div key={item.label} className="mb-3 rounded-xl border border-white/[0.05] bg-white/[0.025] p-3">
              <div className="mb-1.5 text-[12px] font-medium text-white/40">{item.label}</div>
              <div className="text-[13px] text-white/75">{item.text}</div>
            </div>
          ))}
        </div>
        <div className="rounded-[24px] border border-white/[0.06] bg-black/25 p-4">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-white/30">{zh ? "编辑器状态" : "Editor state"}</div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <MetricTile accent={accent} value="18" label={zh ? "草稿" : "Drafts"} />
            <MetricTile accent={accent} value="7" label={zh ? "待审" : "Reviews"} />
          </div>
        </div>
      </div>
    </div>
  );
}

function NetworkMock({ accent, zh }: { accent: string; zh: boolean }) {
  const sources = zh
    ? ["官方博客", "行业媒体", "视频博主", "Newsletter"]
    : ["Official blogs", "Industry media", "Creators", "Newsletters"];
  const inbox = zh
    ? ["新文章等待去重", "视频字幕提取完成", "RSS 失败需要检查"]
    : ["New articles waiting dedupe", "Video transcript extracted", "RSS failure needs review"];

  return (
    <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
      <div className="rounded-[24px] border border-white/[0.06] bg-black/25 p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-[14px] font-semibold text-white/80">{zh ? "信源配置" : "Source registry"}</div>
          <button type="button" className="rounded-lg border-0 px-3 py-1.5 text-[11px] font-semibold text-black" style={{ background: accent }}>{zh ? "添加信源" : "Add source"}</button>
        </div>
        <div className="mb-4 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-[12px] text-white/32">{zh ? "搜索 RSS、网站、视频博主" : "Search RSS, sites, creators"}</div>
        <div className="grid gap-3 sm:grid-cols-2">
          {sources.map((source, index) => {
            const texts = zh ? [
              "OpenAI 官方博客更新 (RSS)",
              "TechCrunch AI 频道 (Web)",
              "MKBHD 最新评测视频 (Video)",
              "Ben Evans 每周洞察 (Mail)"
            ] : [
              "OpenAI official blog (RSS)",
              "TechCrunch AI feed (Web)",
              "MKBHD latest reviews (Video)",
              "Ben Evans insights (Mail)"
            ];
            const text = texts[index];
            return (
            <div key={source} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
              <div className="mb-5 flex items-center justify-between">
                <span className="h-2 w-2 rounded-full" style={{ background: index === 2 ? "#fbbf24" : accent }} />
                <span className="font-mono text-[10px] text-white/28">{index === 2 ? "WARN" : "OK"}</span>
              </div>
              <div className="text-[13.5px] font-semibold text-white/72">{source}</div>
              <div className="mt-2 text-[12px] text-white/45">{text}</div>
            </div>
          )})}
        </div>
      </div>
      <div className="space-y-4">
        <div className="rounded-[24px] border border-white/[0.06] bg-black/25 p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-[14px] font-semibold text-white/80">{zh ? "抓取收件箱" : "Ingestion inbox"}</div>
            <span className="rounded-md border border-white/[0.07] px-2 py-1 font-mono text-[10px] text-white/35">Pipeline</span>
          </div>
          {inbox.map((item, index) => {
            const descriptions = zh ? [
              "23 篇来源涉及重复主题",
              "14:20 提取了摘要片段",
              "来源 fetch_timeout 错误"
            ] : [
              "23 items share topics",
              "Extracted at 14:20",
              "fetch_timeout error"
            ];
            const desc = descriptions[index];
            return (
            <div key={item} className="mb-3 rounded-xl border border-white/[0.05] bg-white/[0.025] p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[12.5px] font-semibold text-white/75">{item}</span>
                <span className="font-mono text-[10px]" style={{ color: index === 2 ? "#fbbf24" : accent }}>{index === 0 ? "23" : index === 1 ? "8" : "2"}</span>
              </div>
              <div className="mt-1.5 text-[11px] text-white/40">{desc}</div>
            </div>
          )})}
        </div>
        <div className="rounded-[24px] border border-white/[0.06] bg-black/25 p-4">
          <div className="grid grid-cols-3 gap-3">
            <MetricTile accent={accent} value="96%" label={zh ? "健康" : "Health"} />
            <MetricTile accent={accent} value="14m" label={zh ? "延迟" : "Latency"} />
            <MetricTile accent={accent} value="132" label={zh ? "今日" : "Today"} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StudioMock({ accent, zh }: { accent: string; zh: boolean }) {
  const agents = zh ? ["抽取智能体", "写作智能体", "审核智能体", "配图智能体"] : ["Extractor", "Writer", "Reviewer", "Illustrator"];

  return (
    <div className="grid gap-4 lg:grid-cols-[0.68fr_1.32fr]">
      <div className="rounded-[24px] border border-white/[0.06] bg-black/25 p-4">
        <div className="mb-4 text-[14px] font-semibold text-white/80">{zh ? "角色列表" : "Agent roles"}</div>
        <div className="space-y-3">
          {agents.map((agent, index) => (
            <div key={agent} className="rounded-2xl border border-white/[0.06] p-3" style={{ background: index === 1 ? `${accent}12` : "rgba(255,255,255,0.025)" }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[13px] font-semibold text-white/70">{agent}</div>
                  <div className="mt-1 font-mono text-[10px] text-white/28">{index === 1 ? "ACTIVE" : "READY"}</div>
                </div>
                <span className="h-2 w-2 rounded-full" style={{ background: index === 1 ? accent : "rgba(255,255,255,0.24)" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <div className="rounded-[24px] border border-white/[0.06] bg-black/25 p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-[14px] font-semibold text-white/80">{zh ? "写作智能体配置" : "Writer agent config"}</div>
            <div className="flex rounded-xl border border-white/[0.07] bg-white/[0.03] p-1 font-mono text-[10px] text-white/42">
              <span className="rounded-lg bg-white px-2.5 py-1 text-black">Config</span>
              <span className="px-2.5 py-1">Workbench</span>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { field: zh ? "模型" : "Model", text: "GPT-4o / Claude 3.5 Sonnet" },
              { field: "API Key", text: "sk-proj-8a9b...7c6d" },
              { field: "Prompt", text: zh ? "作为资深科技编辑，提取文章核心论点并按重要性排序。" : "Act as a senior tech editor. Extract core arguments and rank by importance." },
              { field: zh ? "知识库" : "Knowledge", text: zh ? "过往爆款文章结构库 (8.4MB)" : "Previous viral structures (8.4MB)" }
            ].map((item, index) => (
              <div key={item.field} className={`rounded-xl border border-white/[0.06] bg-white/[0.025] p-3 ${index > 1 ? "sm:col-span-2" : ""}`}>
                <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-white/35">{item.field}</div>
                <div className="text-[12.5px] text-white/65 leading-relaxed">{item.text}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-[24px] border border-white/[0.06] bg-black/25 p-4">
            <div className="mb-4 text-[14px] font-semibold text-white/80">{zh ? "工具权限" : "Tool access"}</div>
            {["Search", "Sources", "Memory", "Images"].map((tool, index) => (
              <div key={tool} className="mb-2 flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2">
                <span className="text-[12px] text-white/48">{tool}</span>
                <span className="h-4 w-4 rounded border border-white/[0.12]" style={index < 3 ? { background: accent } : undefined} />
              </div>
            ))}
          </div>
          <div className="rounded-[24px] border border-white/[0.06] bg-black/25 p-4">
            <div className="mb-4 text-[14px] font-semibold text-white/80">{zh ? "运行结果" : "Run preview"}</div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
              <div className="font-mono text-[10px]" style={{ color: accent }}>PASS · 4 checks</div>
              <div className="mt-3 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-[12px] text-white/60">
                  <span className="text-[#34d399]">✓</span> <span>{zh ? "无事实幻觉" : "No hallucination detected"}</span>
                </div>
                <div className="flex items-center gap-2 text-[12px] text-white/60">
                  <span className="text-[#34d399]">✓</span> <span>{zh ? "交叉验证通过" : "Cross-validation passed"}</span>
                </div>
                <div className="flex items-center gap-2 text-[12px] text-white/60">
                  <span className="text-[#34d399]">✓</span> <span>{zh ? "引用来源匹配" : "Citations match sources"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModuleStorySections({ variant, accent, zh }: { variant: ModuleVariant; accent: string; zh: boolean }) {
  const sections = storySections(variant, zh);

  return (
    <div>
      {sections.map((section, index) => (
        <section key={section.kicker} className="relative overflow-hidden border-t border-white/[0.04] px-6 py-20 lg:px-10 lg:py-28">
          <div className="pointer-events-none absolute inset-0 opacity-70" style={{ background: `radial-gradient(circle at ${index % 2 ? "16%" : "84%"} 22%, ${accent}14, transparent 32%), linear-gradient(180deg, rgba(255,255,255,0.018), transparent 42%)` }} />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.14] to-transparent" />
          <div className={`relative mx-auto grid max-w-[1320px] gap-14 lg:items-center ${index % 2 ? "lg:grid-cols-[0.58fr_0.42fr] lg:[&>*:first-child]:order-2" : "lg:grid-cols-[0.42fr_0.58fr]"}`}>
            <div className="max-w-[520px] lg:sticky lg:top-24 animate-landing-fade-up">
              <div className="mb-6 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-white/42">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent, boxShadow: `0 0 12px ${accent}` }} />
                {String(index + 1).padStart(2, "0")} · {section.kicker}
              </div>
              <h2 className={`font-semibold text-[#f4f3ee] ${zh ? 'text-[42px] sm:text-[56px] lg:text-[64px] leading-[1.15] tracking-[0.02em] text-balance font-serif' : 'text-[38px] sm:text-[44px] lg:text-[48px] leading-[1.05] tracking-[-0.02em] text-pretty'}`}>
                {section.title}
              </h2>
              <p className={`mt-6 max-w-[480px] text-white/48 ${zh ? 'text-[17px] leading-[2] tracking-[0.02em] text-pretty' : 'text-[16px] leading-8'}`}>{section.body}</p>
              <div className="mt-9 grid grid-cols-2 gap-3">
                {storyStats(variant, index, zh).map((item) => (
                  <div key={item.label} className="border-t border-white/[0.08] pt-4">
                    <div className="font-mono text-[22px] font-semibold" style={{ color: accent }}>{item.value}</div>
                    <div className="mt-1 text-[12px] leading-5 text-white/36">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className={`animate-landing-fade-up delay-200 ${index % 2 ? "lg:-ml-8" : "lg:-mr-8"}`}>
              <StoryVisual variant={variant} scene={index} accent={accent} zh={zh} />
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}

function StoryVisual({ variant, scene, accent, zh }: { variant: ModuleVariant; scene: number; accent: string; zh: boolean }) {
  if (variant === "panorama") return <PanoramaStoryVisual scene={scene} accent={accent} zh={zh} />;
  if (variant === "workspace") return <WorkspaceStoryVisual scene={scene} accent={accent} zh={zh} />;
  if (variant === "network") return <NetworkStoryVisual scene={scene} accent={accent} zh={zh} />;
  return <StudioStoryVisual scene={scene} accent={accent} zh={zh} />;
}

function PanoramaStoryVisual({ scene, accent, zh }: { scene: number; accent: string; zh: boolean }) {
  if (scene === 1) {
    return (
      <LargePanel accent={accent} label={zh ? "批量分发" : "BATCH DISPATCH"}>
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            {[zh ? "AI 浏览器重塑入口" : "AI browsers reshape discovery", zh ? "开源模型融资加速" : "Open models accelerate funding", zh ? "长视频访谈可引用片段" : "Long video interview citations"].map((item, index) => (
              <div key={item} className="rounded-2xl border border-white/[0.06] bg-black/30 p-4">
                <div className="mb-5 flex items-center justify-between">
                  <span className="font-mono text-[10px] text-white/28">SIG-{index + 24}</span>
                  <span className="h-4 w-4 rounded border border-white/[0.14]" style={index < 2 ? { background: accent } : undefined} />
                </div>
                <div className="text-[16px] font-semibold text-white/75">{item}</div>
                <div className="mt-4 flex gap-2">
                  {["AI", "Score", "Ready"].map((tag) => <span key={tag} className="rounded-md bg-white/[0.06] px-2 py-1 font-mono text-[10px] text-white/35">{tag}</span>)}
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/30">{zh ? "发送到内容工作台" : "Send to workspace"}</div>
            <div className="mt-8 space-y-4">
              <MetricTile accent={accent} value="2" label={zh ? "已选择信号" : "selected signals"} />
              <MetricTile accent={accent} value="6" label={zh ? "自动补齐引用" : "citations attached"} />
              <button type="button" className="mt-3 w-full rounded-xl border-0 px-4 py-3 text-[13px] font-semibold text-black" style={{ background: accent }}>{zh ? "创建情报卡片" : "Create cards"}</button>
            </div>
          </div>
        </div>
      </LargePanel>
    );
  }

  return (
    <LargePanel accent={accent} label={zh ? "评分与筛选" : "SCORING LAYER"}>
      <div className="grid gap-5 md:grid-cols-[0.75fr_1.25fr]">
        <div className="rounded-2xl border border-white/[0.06] bg-black/30 p-5">
          <div className="text-[64px] font-semibold tracking-[-0.08em]" style={{ color: accent }}>92</div>
          <div className="mt-2 text-[13px] text-white/45">{zh ? "最高相关性信号" : "highest relevance signal"}</div>
          <div className="mt-8 space-y-3">
            {[zh ? "可信来源" : "Trusted source", zh ? "主题匹配" : "Topic match", zh ? "时效性强" : "Time sensitive"].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-xl bg-white/[0.035] p-3 text-[12px] text-white/55"><span className="h-2 w-2 rounded-full" style={{ background: accent }} />{item}</div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-black/30 p-5">
          <div className="mb-5 flex gap-2">
            {[zh ? "全部" : "All", zh ? "图文" : "Text", zh ? "视频" : "Video", zh ? "高分" : "High score"].map((tab, index) => <span key={tab} className={`rounded-lg px-3 py-1.5 font-mono text-[10px] ${index === 3 ? "text-black" : "border border-white/[0.07] text-white/38"}`} style={index === 3 ? { background: accent } : undefined}>{tab}</span>)}
          </div>
          <div className="grid gap-3">
            {[86, 92, 77, 81].map((score, index) => (
              <div key={score} className="grid grid-cols-[38px_1fr_40px] items-center gap-3 rounded-xl bg-white/[0.025] p-3">
                <span className="font-mono text-[10px] text-white/30">0{index + 1}</span>
                <div className="truncate text-[12.5px] text-white/70">
                  {zh ? ["YCombinator W26 趋势分析", "OpenAI o1 模型深度测评", "长视频：Cursor 创始人访谈", "Perplexity 商业模式拆解"][index] : ["YCombinator W26 trends", "OpenAI o1 deep dive", "Video: Cursor founder interview", "Perplexity business model"][index]}
                </div>
                <span className="text-right font-mono text-[12px]" style={{ color: accent }}>{score}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </LargePanel>
  );
}

function WorkspaceStoryVisual({ scene, accent, zh }: { scene: number; accent: string; zh: boolean }) {
  if (scene === 0) {
    return (
      <LargePanel accent={accent} label={zh ? "编辑与审稿" : "EDITOR + REVIEW"}>
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-white/[0.06] bg-black/30 p-6">
            <div className="mb-6 font-mono text-[11px] uppercase tracking-[0.18em] text-white/28">Daily AI Intelligence Report</div>
            <h3 className="text-[28px] font-semibold tracking-[-0.04em] text-white">{zh ? "执行摘要" : "Executive Summary"}</h3>
            <p className="mt-5 text-[14px] leading-7 text-white/52">
              <mark className="bg-yellow-400/25 text-white">{zh ? "AI 系统效率显著提升" : "AI systems show significant efficiency gains"}</mark>{zh ? "，同时需要补充来源和风险说明。" : ", while sourcing and risk notes still need strengthening."}
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {["techcrunch.com", "arstechnica.com"].map((source) => <div key={source} className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3 font-mono text-[11px] text-white/35">{source}</div>)}
            </div>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-black/30 p-6">
            <div className="text-center">
              <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border-[10px] border-white/[0.1] text-[34px] font-semibold" style={{ borderTopColor: accent, color: "white" }}>6.8</div>
              <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-white/30">Editorial score</div>
            </div>
            <div className="mt-8 rounded-xl border border-red-400/25 bg-red-400/10 p-4 text-[12px] leading-6 text-red-100/65">
              {zh ? "“效率提升”表述过泛，需要引用原始研究并说明基线。" : "\"Efficiency gains\" is too vague; cite the underlying study and clarify the baseline."}
            </div>
            <button type="button" className="mt-4 w-full rounded-xl border border-white/[0.08] bg-white/[0.06] py-3 text-[12px] text-white/70">{zh ? "重新运行 AI 审稿" : "Re-run AI Review"}</button>
          </div>
        </div>
      </LargePanel>
    );
  }

  return (
    <LargePanel accent={accent} label={zh ? "素材库" : "ASSET LIBRARY"}>
      <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-2xl border border-white/[0.06] bg-black/30 p-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex rounded-xl border border-white/[0.07] bg-white/[0.03] p-1 font-mono text-[10px] text-white/38">
              {[zh ? "全部" : "All", zh ? "结构" : "Structures", zh ? "引用" : "Citations"].map((tab, index) => (
                <span key={tab} className={`rounded-lg px-3 py-1.5 ${index === 1 ? "text-black" : ""}`} style={index === 1 ? { background: accent } : undefined}>{tab}</span>
              ))}
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2 font-mono text-[10px] text-white/30">{zh ? "搜索素材与案例" : "Search assets"}</div>
          </div>
          <div className="mb-4 grid grid-cols-[1.45fr_0.75fr_0.55fr_0.5fr] gap-4 px-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/28">
            <span>{zh ? "素材" : "Asset"}</span><span>{zh ? "来源" : "Source"}</span><span>{zh ? "状态" : "Status"}</span><span>{zh ? "复用" : "Reuse"}</span>
          </div>
          {[zh ? "Agent 工作流结构模板" : "Agent workflow structure", zh ? "模型发布引用包" : "Model launch citation pack", zh ? "视频访谈观点摘录" : "Video interview excerpts", zh ? "行业融资案例库" : "Funding case library"].map((asset, index) => (
            <div key={asset} className="mb-3 grid grid-cols-[1.45fr_0.75fr_0.55fr_0.5fr] gap-4 rounded-xl border border-white/[0.05] bg-white/[0.025] p-3 text-[12px] text-white/55">
              <span className="font-semibold text-white/72">{asset}</span><span>{index % 2 ? "Video" : "RSS"}</span><span style={{ color: accent }}>Ready</span><span>{index + 3}x</span>
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/30">{zh ? "资产详情" : "Asset detail"}</div>
          <div className="mt-6 text-[19px] font-semibold leading-7 text-white/82">{zh ? "Agent 工作流结构模板" : "Agent workflow structure"}</div>
          <p className="mt-4 text-[12.5px] leading-6 text-white/44">
            {zh ? "保存标题角度、段落结构、引用来源和审稿规则，下次选题可以直接复用。" : "Stores angles, section structure, citation sources, and review rules for the next production run."}
          </p>
          <div className="mt-7 space-y-3">
            {[zh ? "标题角度" : "Angles", zh ? "引用来源" : "Citations", zh ? "审稿规则" : "Review rules"].map((item, index) => (
              <div key={item} className="rounded-xl border border-white/[0.05] bg-black/25 p-3">
                <div className="mb-2 flex items-center justify-between text-[12px] text-white/58">
                  <span>{item}</span>
                  <span className="font-mono text-[10px]" style={{ color: accent }}>0{index + 2}</span>
                </div>
                <div className="text-[11.5px] text-white/45">
                  {zh ? ["设定科技报道分析角度", "自动附加来源 URL", "检查客观性和信息来源"][index] : ["Set tech report angles", "Auto-attach source URLs", "Check objectivity and sources"][index]}
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="mt-6 w-full rounded-xl border border-white/[0.08] bg-white/[0.06] py-3 text-[12px] font-semibold text-white/72">{zh ? "发送到新草稿" : "Send to new draft"}</button>
        </div>
      </div>
    </LargePanel>
  );
}

function NetworkStoryVisual({ scene, accent, zh }: { scene: number; accent: string; zh: boolean }) {
  if (scene === 0) {
    return (
      <LargePanel accent={accent} label={zh ? "抓取流水线" : "FETCH PIPELINE"}>
        <div className="grid gap-5 md:grid-cols-5">
          {["Sources", "Fetch", "Clean", "Score", "Panorama"].map((step, index) => (
            <div key={step} className="rounded-2xl border border-white/[0.06] bg-black/30 p-4 text-center">
              <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full border font-mono text-[12px]" style={{ borderColor: index <= 3 ? accent : "rgba(255,255,255,0.12)", color: index <= 3 ? accent : "rgba(255,255,255,0.35)" }}>0{index + 1}</div>
              <div className="text-[13px] font-semibold text-white/70">{step}</div>
              <div className="mt-3 h-1 rounded-full bg-white/[0.08]" />
            </div>
          ))}
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <MetricTile accent={accent} value="132" label={zh ? "今日入库" : "ingested today"} />
          <MetricTile accent={accent} value="11" label={zh ? "去重命中" : "duplicates removed"} />
          <MetricTile accent={accent} value="2" label={zh ? "需要处理" : "needs attention"} />
        </div>
      </LargePanel>
    );
  }

  return (
    <LargePanel accent={accent} label={zh ? "凭证与健康" : "HEALTH + CREDENTIALS"}>
      <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-2xl border border-white/[0.06] bg-black/30 p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/28">Runtime boundary</div>
          <div className="mt-6 space-y-3">
            {["cookie_store", "youtube_api", "rss_scheduler", "proxy_pool"].map((item, index) => (
              <div key={item} className="flex items-center justify-between rounded-xl bg-white/[0.025] p-3">
                <span className="font-mono text-[11px] text-white/45">{item}</span>
                <span className="h-2 w-2 rounded-full" style={{ background: index === 3 ? "#fbbf24" : accent }} />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-black/30 p-5">
          {[96, 82, 74, 91].map((value, index) => (
            <div key={value} className="mb-5">
              <div className="mb-2 flex justify-between font-mono text-[10px] text-white/35"><span>{["RSS", "Web", "Video", "Newsletter"][index]}</span><span>{value}%</span></div>
              <div className="h-2 rounded-full bg-white/[0.08]"><div className="h-full rounded-full" style={{ width: `${value}%`, background: index === 2 ? "#fbbf24" : accent }} /></div>
            </div>
          ))}
        </div>
      </div>
    </LargePanel>
  );
}

function StudioStoryVisual({ scene, accent, zh }: { scene: number; accent: string; zh: boolean }) {
  if (scene === 0) {
    return (
      <LargePanel accent={accent} label={zh ? "工作台运行" : "AGENT WORKBENCH"}>
        <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-2xl border border-white/[0.06] bg-black/30 p-5">
            {["Extractor", "Writer", "Reviewer", "Illustrator"].map((agent, index) => (
              <div key={agent} className="mb-3 rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                <div className="flex items-center justify-between"><span className="text-[13px] text-white/60">{agent}</span><span className="h-2 w-2 rounded-full" style={{ background: index === 0 ? accent : "rgba(255,255,255,0.24)" }} /></div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-black/30 p-5">
            <div className="ml-auto max-w-md rounded-xl border border-white/[0.08] bg-white/[0.04] p-4 text-[12px] text-white/58">Help me extract the latest articles from theverge feed.</div>
            <div className="mt-8 max-w-sm rounded-xl border border-white/[0.06] bg-black/40 p-4 text-[12px] text-white/50">Pulling source: theverge<br />Source ID: 1<br />Link: theverge.com/rss/ai</div>
            <div className="mt-3 max-w-md rounded-xl border p-4 text-[12px]" style={{ borderColor: `${accent}35`, background: `${accent}10`, color: accent }}>✓ {zh ? "动作完成：38 篇文章，去重 12 篇" : "Action completed: 38 articles fetched, 12 deduplicated"}</div>
          </div>
        </div>
      </LargePanel>
    );
  }

  return (
    <LargePanel accent={accent} label={zh ? "权限与插件" : "TOOLS + PLUGINS"}>
      <div className="grid gap-5 md:grid-cols-3">
        {[zh ? "知识库" : "Knowledge", zh ? "工具权限" : "Tool grants", zh ? "执行模式" : "Execution"].map((title, index) => (
          <div key={title} className="rounded-2xl border border-white/[0.06] bg-black/30 p-5">
            <div className="mb-6 text-[16px] font-semibold text-white/75">{title}</div>
            {[0, 1, 2, 3].map((row) => {
              const texts = index === 0 
                ? (zh ? ["过往爆款结构库", "行业术语词典", "竞品动态档案", "内部品牌指南"] : ["Viral structures", "Industry glossary", "Competitor archives", "Brand guidelines"])
                : index === 1
                ? (zh ? ["联网搜索", "内部数据库查询", "执行代码", "访问向量存储"] : ["Web search", "Internal DB query", "Code execution", "Vector store access"])
                : (zh ? ["自动运行 (Cron)", "人工审核后发布", "仅生成草稿", "触发器回调"] : ["Auto run (Cron)", "Human-in-the-loop", "Draft only", "Trigger webhook"]);
              return (
              <div key={row} className="mb-3 flex items-center justify-between rounded-xl bg-white/[0.025] p-3">
                <div className="text-[12px] text-white/60">{texts[row]}</div>
                <span className="h-4 w-4 rounded border border-white/[0.12]" style={row <= 2 - index ? { background: accent } : undefined} />
              </div>
            )})}
          </div>
        ))}
      </div>
    </LargePanel>
  );
}

function LargePanel({ accent, label, children }: { accent: string; label: string; children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-[26px] border border-white/[0.09] bg-[#0a0b0d] p-4 shadow-[0_44px_130px_rgba(0,0,0,0.5)] sm:p-5 lg:p-6">
      <div className="pointer-events-none absolute inset-0 opacity-[0.03] [background-image:radial-gradient(rgba(255,255,255,0.8)_1px,transparent_1px)] [background-size:24px_24px]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.03] via-transparent to-black/30" />
      <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full opacity-20 blur-3xl" style={{ background: accent }} />
      <div className="pointer-events-none absolute -bottom-28 left-10 h-64 w-64 rounded-full opacity-10 blur-3xl" style={{ background: accent }} />
      <div className="relative z-[1] mb-5 flex items-center justify-between border-b border-white/[0.06] px-1 pb-4">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/35">{label}</span>
        <div className="flex items-center gap-2 font-mono text-[10px] text-white/28">
          <span>LIVE VIEW</span>
          <span className="h-2 w-2 rounded-full" style={{ background: accent, boxShadow: `0 0 14px ${accent}` }} />
        </div>
      </div>
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}

function storyStats(variant: ModuleVariant, scene: number, zh: boolean) {
  const stats = {
    panorama: [
      zh ? [{ value: "4", label: "媒体类型汇总" }, { value: "92", label: "最高相关性" }] : [{ value: "4", label: "media types unified" }, { value: "92", label: "top relevance score" }],
      zh ? [{ value: "2", label: "批量送入生产" }, { value: "6", label: "引用自动携带" }] : [{ value: "2", label: "sent to production" }, { value: "6", label: "citations attached" }],
    ],
    workspace: [
      zh ? [{ value: "7", label: "待审问题" }, { value: "6.8", label: "审稿评分" }] : [{ value: "7", label: "review issues" }, { value: "6.8", label: "editorial score" }],
      zh ? [{ value: "4", label: "资产类型" }, { value: "18", label: "可复用条目" }] : [{ value: "4", label: "asset types" }, { value: "18", label: "reusable entries" }],
    ],
    network: [
      zh ? [{ value: "132", label: "今日入库" }, { value: "11", label: "去重命中" }] : [{ value: "132", label: "ingested today" }, { value: "11", label: "duplicates removed" }],
      zh ? [{ value: "96%", label: "抓取健康" }, { value: "4", label: "运行时边界" }] : [{ value: "96%", label: "fetch health" }, { value: "4", label: "runtime boundaries" }],
    ],
    studio: [
      zh ? [{ value: "4", label: "协作角色" }, { value: "38", label: "执行结果" }] : [{ value: "4", label: "agent roles" }, { value: "38", label: "fetched outputs" }],
      zh ? [{ value: "12", label: "工具权限" }, { value: "8", label: "知识包" }] : [{ value: "12", label: "tool grants" }, { value: "8", label: "knowledge packs" }],
    ],
  } satisfies Record<ModuleVariant, Array<Array<{ value: string; label: string }>>>;

  return stats[variant][scene];
}

function storySections(variant: ModuleVariant, zh: boolean) {
  const content = {
    panorama: zh
      ? [
          { kicker: "Signal wall", title: "不是信息流，是编辑能行动的\u00A0信号墙。", body: "客户看到的不只是文章列表，而是按时间、类型、标签和相关性组织好的情报界面。每条信号都能被打分、勾选、批量送入后续生产。" },
          { kicker: "Dispatch", title: "好的线索不应被孤立，它们可以\u00A0被组合。", body: "单一信息往往不足以成文。全景视图支持把不同来源的信号合并成一个素材包，让智能体在生成时拥有多维度的上下文支持。" },
        ]
      : [
          { kicker: "Signal wall", title: "Not a feed. An actionable signal wall.", body: "The page shows articles and videos organized by time, type, tags, and relevance so editors can score, select, and act on the right signals." },
          { kicker: "Dispatch", title: "Good leads shouldn't be isolated.", body: "High-value articles, videos, and newsletter fragments become workspace cards with sources, tags, and citation context attached." },
        ],
    workspace: zh
      ? [
          { kicker: "Production Desk", title: "内容工作台要展示生产，而不只是\u00A0收藏。", body: "这里承接资讯全景的发现，把素材变成任务、草稿、审稿上下文和可复用资产，客户能看到编辑团队如何推进内容。" },
          { kicker: "Asset Library", title: "好素材会沉淀成下一次可复用的\u00A0资产。", body: "灵感、引用、结构模板和案例库被集中管理，避免每次写作都从零开始。" },
        ]
      : [
          { kicker: "Production desk", title: "Show production, not just saved items.", body: "The workspace turns discoveries into tasks, drafts, review context, and reusable assets so customers see the editorial work moving forward." },
          { kicker: "Asset library", title: "Strong material becomes reusable leverage.", body: "Angles, citations, structures, and case libraries stay organized so the team does not restart from zero every time." },
        ],
    network: zh
      ? [
          { kicker: "Pipeline", title: "让不同类型的数据经过相同的\u00A0流水线。", body: "无论是 YouTube 视频、长文章，还是推文，都在这里被标准化，转化为直接取用的结构化格式。" },
          { kicker: "Governance", title: "维护一张干净的、持续流动的\u00A0情报网。", body: "网络必须是健康的。监控抓取成功率、解析完整度和凭证有效性，确保流入系统的信息源稳定可靠。" },
        ]
      : [
          { kicker: "Pipeline", title: "Explain where every signal comes from.", body: "RSS, websites, newsletters, and creators are not static lists; they form an observable fetch, clean, dedupe, and routing pipeline." },
          { kicker: "Governance", title: "Health and credential boundaries build trust.", body: "Customers need to see how failures, stale feeds, duplicates, low-quality sources, and private credentials are governed." },
        ],
    studio: zh
      ? [
          { kicker: "Workbench", title: "智能体工作室要像一个可运行的\u00A0控制台。", body: "它不只是一个静态的表单，必须能够展示 Prompt 的最终效果、所调用工具的状态，以及知识库的匹配度。" },
          { kicker: "Configuration", title: "每个智能体都有边界、有知识、有\u00A0工具。", body: "模型、Prompt、知识库、插件和执行方式可以按角色配置，让 AI 编辑团队可控地协作。" },
        ]
      : [
          { kicker: "Workbench", title: "Agent Studio should feel like a runnable console.", body: "Customers should see agents as role-based workbenches with permissions, tools, conversations, and execution results — not just forms." },
          { kicker: "Configuration", title: "Every agent has boundaries, knowledge, and tools.", body: "Models, prompts, knowledge, plugins, and execution modes are assigned per role so the AI editorial team can collaborate safely." },
        ],
  } satisfies Record<ModuleVariant, Array<{ kicker: string; title: string; body: string }>>;

  return content[variant];
}

function MetricTile({ accent, value, label }: { accent: string; value: string; label: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
      <div className="font-mono text-[17px] font-semibold" style={{ color: accent }}>{value}</div>
      <div className="mt-1 text-[11px] text-white/35">{label}</div>
    </div>
  );
}

function heroStats(variant: ModuleVariant, zh: boolean) {
  const stats = {
    panorama: zh ? [{ value: "43", label: "今日信号" }, { value: "4", label: "媒体类型" }, { value: "92", label: "最高相关性" }] : [{ value: "43", label: "signals today" }, { value: "4", label: "media types" }, { value: "92", label: "top relevance" }],
    workspace: zh ? [{ value: "18", label: "草稿资产" }, { value: "7", label: "审稿任务" }, { value: "12", label: "引用来源" }] : [{ value: "18", label: "draft assets" }, { value: "7", label: "review tasks" }, { value: "12", label: "citations" }],
    network: zh ? [{ value: "96%", label: "抓取健康" }, { value: "132", label: "今日入库" }, { value: "14m", label: "平均延迟" }] : [{ value: "96%", label: "fetch health" }, { value: "132", label: "ingested today" }, { value: "14m", label: "avg latency" }],
    studio: zh ? [{ value: "4", label: "编辑角色" }, { value: "12", label: "工具权限" }, { value: "8", label: "知识包" }] : [{ value: "4", label: "agent roles" }, { value: "12", label: "tool grants" }, { value: "8", label: "knowledge packs" }],
  } satisfies Record<ModuleVariant, Array<{ value: string; label: string }>>;

  return stats[variant];
}
