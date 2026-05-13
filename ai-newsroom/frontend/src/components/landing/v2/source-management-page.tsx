"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Database, FileText, Globe2, LockKeyhole, Radio, Rss, ShieldCheck, Sparkles, Video } from "lucide-react";
import { AuthModal, type AuthMode } from "./auth-modal";
import { V2Navbar } from "./navbar";
import { useAuth } from "@clerk/nextjs";
import { useTranslation } from "@/hooks/useTranslation";

const isCJK = (s: string) => /[\u4e00-\u9fff]/.test(s);

const accent = "#d6c7a1";
const signal = "#86efac";

const sources = [
  { name: "The Verge AI", type: "RSS", cadence: "10m", health: "99.8%", stories: 43, status: "Live", color: "#86efac" },
  { name: "MIT Tech Review", type: "Website", cadence: "30m", health: "98.1%", stories: 18, status: "Live", color: "#d6c7a1" },
  { name: "YouTube Analysts", type: "Video", cadence: "2h", health: "94.6%", stories: 12, status: "Queued", color: "#93c5fd" },
  { name: "Policy Briefs", type: "Newsletter", cadence: "Daily", health: "100%", stories: 7, status: "Synced", color: "#fca5a5" },
];

const workflow = [
  { label: "Connect", detail: "RSS, websites, newsletters, video channels", icon: Globe2 },
  { label: "Fetch", detail: "Scheduled pulls, retries, and source health", icon: Radio },
  { label: "Normalize", detail: "Transcripts, articles, metadata, duplicates", icon: Database },
  { label: "Score", detail: "Relevance, trust, topic, and freshness", icon: Sparkles },
  { label: "Route", detail: "Inbox cards ready for editors and agents", icon: FileText },
];

const capabilities = [
  { title: "One registry for every beat", desc: "Keep RSS feeds, monitored sites, newsletters, and video channels in one governed source desk.", icon: Rss },
  { title: "Health before volume", desc: "Surface stale feeds, broken crawls, retries, and low-signal channels before they pollute the pipeline.", icon: ShieldCheck },
  { title: "Credentials stay operational", desc: "Platform cookies and private fetch config belong in runtime settings, not in a public marketing page or repo history.", icon: LockKeyhole },
  { title: "Video becomes source material", desc: "Turn analyst channels and creator uploads into transcript-backed intelligence cards alongside text feeds.", icon: Video },
];

export function SourceManagementPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [authOpen, setAuthOpen] = React.useState(false);
  const [authMode, setAuthMode] = React.useState<AuthMode>("login");
  const [authed, setAuthed] = React.useState(false);
  const { isSignedIn } = useAuth();

  React.useEffect(() => {
    setAuthed(!!isSignedIn);
  }, [isSignedIn]);

  const openLogin = () => {
    setAuthMode("login");
    setAuthOpen(true);
  };

  const openRegister = () => {
    setAuthMode("register");
    setAuthOpen(true);
  };

  const goToApp = () => router.push("/");
  const goToSourcesOrRegister = () => (authed ? router.push("/sources") : openRegister());

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#08090b] text-white" style={{ fontFamily: "'Inter Tight', 'Inter', system-ui, sans-serif" }}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_10%,rgba(214,199,161,0.14),transparent_36%),radial-gradient(circle_at_8%_34%,rgba(134,239,172,0.08),transparent_32%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.7)_1px,transparent_1px)] [background-size:64px_64px]" />

      <V2Navbar accent={accent} isAuthenticated={authed} onLogin={openLogin} onRegister={openRegister} onGoToApp={goToApp} />

      <main className="relative z-[1]">
        <section className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-[0.82fr_1.18fr] lg:px-10 lg:py-24 xl:px-0">
          <div className="pt-6">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-white/55">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: signal, boxShadow: `0 0 10px ${signal}` }} />
              {t("landing.sourceManagement.badge")}
            </div>
            <h1 className={`max-w-2xl font-semibold leading-[0.96] text-[#f4f3ee] ${isCJK(t("landing.sourceManagement.headlineBefore")) ? 'text-[42px] tracking-[-0.02em] sm:text-[58px]' : 'text-[54px] tracking-[-0.055em] sm:text-[74px]'}`}>
              {t("landing.sourceManagement.headlineBefore")} <span className={isCJK(t("landing.sourceManagement.headlineAccent")) ? 'font-semibold' : 'font-serif italic font-normal'} style={{ color: accent }}>{t("landing.sourceManagement.headlineAccent")}</span>
            </h1>
            <p className={`mt-7 max-w-xl text-white/52 ${isCJK(t("landing.sourceManagement.body")) ? 'text-[16px] leading-[1.9] tracking-[0.01em]' : 'text-[17px] leading-8 tracking-[-0.005em]'}`}>
              {t("landing.sourceManagement.body")}
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={goToSourcesOrRegister}
                className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-3 text-[14px] font-semibold tracking-[-0.005em] text-[#08090b] shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_18px_48px_rgba(0,0,0,0.35)] transition-colors hover:bg-white/90"
              >
                {authed ? t("landing.sourceManagement.openModule") : t("landing.sourceManagement.addSource")}
                <ArrowRight className="h-4 w-4" />
              </button>
              <a
                href="#workflow"
                className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] px-4 py-3 text-[14px] font-semibold tracking-[-0.005em] text-white/72 no-underline transition-colors hover:bg-white/[0.04] hover:text-white"
              >
                {t("landing.sourceManagement.workflowCta")}
              </a>
            </div>
          </div>

          <SourceDeskMockup />
        </section>

        <section id="workflow" className="border-t border-white/[0.04] px-6 py-20 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 max-w-3xl">
              <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.16em] text-white/35">{t("landing.sourceManagement.workflowEyebrow")}</p>
              <h2 className="text-[44px] font-semibold leading-[1.04] tracking-[-0.04em] text-[#f4f3ee]">{t("landing.sourceManagement.workflowTitle")}</h2>
            </div>
            <div className="grid gap-3 lg:grid-cols-5">
              {workflow.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.label} className="group rounded-2xl border border-white/[0.06] bg-white/[0.025] p-5 transition-colors hover:border-white/[0.14] hover:bg-white/[0.04]">
                    <div className="mb-10 flex items-center justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] bg-black/25 text-white/75">
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="font-mono text-[11px] text-white/25">0{index + 1}</span>
                    </div>
                    <h3 className="text-[18px] font-semibold tracking-[-0.018em] text-white">{step.label}</h3>
                    <p className="mt-3 text-[13px] leading-6 tracking-[-0.005em] text-white/45">{step.detail}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="capabilities" className="border-t border-white/[0.04] px-6 py-20 lg:px-10">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.16em] text-white/35">{t("landing.sourceManagement.governanceEyebrow")}</p>
              <h2 className="text-[46px] font-semibold leading-[1.04] tracking-[-0.045em] text-[#f4f3ee]">{t("landing.sourceManagement.governanceTitle")}</h2>
              <p className="mt-5 max-w-md text-[15px] leading-7 tracking-[-0.005em] text-white/48">
                {t("landing.sourceManagement.governanceBody")}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {capabilities.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-6">
                    <div className="mb-7 flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04]" style={{ color: accent }}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <h3 className="text-[19px] font-semibold tracking-[-0.02em] text-white">{item.title}</h3>
                    <p className="mt-3 text-[13.5px] leading-6 tracking-[-0.005em] text-white/48">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="customer-path" className="border-t border-white/[0.04] px-6 py-24 lg:px-10">
          <div className="mx-auto max-w-7xl rounded-[28px] border border-white/[0.07] bg-white/[0.025] p-8 md:p-12">
            <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
              <div>
                <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.16em] text-white/35">{t("landing.sourceManagement.customerPathEyebrow")}</p>
                <h2 className="text-[42px] font-semibold leading-[1.04] tracking-[-0.04em] text-white">{t("landing.sourceManagement.customerPathTitle")}</h2>
                <p className="mt-5 text-[15px] leading-7 text-white/48">{t("landing.sourceManagement.customerPathBody")}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  { title: "Overview", path: "/landing" },
                  { title: "Feature page", path: "/landing/source-management" },
                  { title: "App module", path: "/sources" },
                ].map((item) => (
                  <div key={item.title} className="rounded-2xl border border-white/[0.07] bg-black/20 p-5">
                    <div className="mb-10 flex items-center gap-2 font-mono text-[11px] text-emerald-300">
                      <Check className="h-3.5 w-3.5" />
                      {item.path}
                    </div>
                    <div className="text-[18px] font-semibold tracking-[-0.02em] text-white">{item.title}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-10 flex flex-wrap gap-3 border-t border-white/[0.06] pt-8">
              <button type="button" onClick={goToSourcesOrRegister} className="rounded-lg bg-white px-4 py-3 text-[14px] font-semibold text-[#08090b] hover:bg-white/90">
                {authed ? t("landing.sourceManagement.openSources") : t("landing.sourceManagement.requestAccess")} &rarr;
              </button>
              <a href="/landing" className="rounded-lg border border-white/[0.08] px-4 py-3 text-[14px] font-semibold text-white/70 no-underline hover:bg-white/[0.04] hover:text-white">
                {t("landing.sourceManagement.backOverview")}
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-[1] border-t border-white/[0.05] bg-[#050507] px-6 py-10 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 font-mono text-[12px] text-white/30 sm:flex-row sm:items-center">
          <span>© 2026 Newsroom Labs · Source Management</span>
          <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full" style={{ background: signal, boxShadow: `0 0 8px ${signal}` }} />{t("landing.sourceManagement.boundary")}</span>
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

function SourceDeskMockup() {
  return (
    <div className="relative min-h-[620px] rounded-[28px] border border-white/[0.08] bg-[#101114]/80 p-4 shadow-[0_40px_120px_rgba(0,0,0,0.45)] backdrop-blur-xl">
      <div className="absolute -inset-8 -z-10 rounded-full opacity-40 blur-3xl" style={{ background: `radial-gradient(circle, ${accent}22, transparent 68%)` }} />
      <div className="mb-4 flex items-center justify-between border-b border-white/[0.06] px-2 pb-4">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/35">Source registry</div>
          <div className="mt-1 text-[18px] font-semibold tracking-[-0.02em] text-white">Monitored intake desk</div>
        </div>
        <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 font-mono text-[11px] text-emerald-300">42 sources live</div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-2xl border border-white/[0.06] bg-black/25 p-3">
          {sources.map((source) => (
            <div key={source.name} className="grid grid-cols-[1fr_auto] gap-4 border-b border-white/[0.05] px-3 py-4 last:border-b-0 sm:grid-cols-[1.1fr_0.55fr_0.55fr_0.45fr_auto] sm:items-center">
              <div>
                <div className="flex items-center gap-2 text-[14px] font-semibold tracking-[-0.015em] text-white">
                  <span className="h-2 w-2 rounded-full" style={{ background: source.color, boxShadow: `0 0 10px ${source.color}` }} />
                  {source.name}
                </div>
                <div className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.08em] text-white/30">{source.type}</div>
              </div>
              <Metric label="Cadence" value={source.cadence} />
              <Metric label="Health" value={source.health} />
              <Metric label="Stories" value={String(source.stories)} />
              <div className="justify-self-end rounded-md border border-white/[0.07] bg-white/[0.04] px-2.5 py-1 font-mono text-[10.5px] text-white/50">{source.status}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-4">
          <div className="rounded-2xl border border-white/[0.06] bg-black/25 p-5">
            <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.14em] text-white/35">Ingest log</div>
            {[
              "Fetched 18 articles from MIT Tech Review",
              "Deduplicated 7 mirrored stories",
              "Queued 3 video transcripts for scoring",
              "Routed 24 cards to Intelligence Inbox",
            ].map((line, index) => (
              <div key={line} className="flex gap-3 border-l border-white/[0.08] pb-4 pl-4 last:pb-0">
                <span className="mt-1.5 h-2 w-2 -translate-x-[21px] rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(134,239,172,0.8)]" />
                <div>
                  <div className="font-mono text-[10.5px] text-white/25">{String(index + 1).padStart(2, "0")} · just now</div>
                  <div className="mt-1 text-[12.5px] leading-5 text-white/62">{line}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-black/25 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/35">Signal quality</div>
              <span className="text-[28px] font-semibold tracking-[-0.05em]" style={{ color: accent }}>91%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full w-[91%] rounded-full" style={{ background: `linear-gradient(90deg, ${signal}, ${accent})` }} />
            </div>
            <p className="mt-4 text-[12.5px] leading-5 text-white/45">Fresh, deduplicated, and topic-scored material is ready for the editorial pipeline.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="hidden sm:block">
      <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-white/25">{label}</div>
      <div className="mt-1 text-[13px] font-semibold tracking-[-0.01em] text-white/75">{value}</div>
    </div>
  );
}
