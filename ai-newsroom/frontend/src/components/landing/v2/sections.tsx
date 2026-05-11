"use client";

import type { ReactNode } from "react";
import { useTranslation } from "@/hooks/useTranslation";

const isCJK = (s: string) => /[\u4e00-\u9fff]/.test(s);

type AccentProps = {
  accent?: string;
};

type SectionShellProps = AccentProps & {
  children: ReactNode;
  eyebrow?: string;
  eyebrowColor?: string;
  title?: string;
  blurb?: string;
  dense?: boolean;
  id?: string;
};

type ClosingCTAProps = AccentProps & {
  onRegister?: () => void;
};

type StudioAgent = {
  name: string;
  type: string;
  active?: boolean;
};

type StudioGroup = {
  kind: string;
  color: string;
  agents: StudioAgent[];
};

type KanbanTask = {
  id: string;
  title: string;
  agent: string;
  refs: number;
  dot: string;
};

type KanbanColumn = {
  name: string;
  count: number;
  dot: string;
  tasks: KanbanTask[];
};

function SectionShell({ children, eyebrow, eyebrowColor, title, blurb, dense, id }: SectionShellProps) {
  return (
    <section
      id={id}
      style={{
        position: "relative",
        padding: dense ? "100px 96px" : "140px 96px",
        borderTop: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto", position: "relative" }}>
        {(eyebrow || title) && (
          <div style={{ marginBottom: 56, maxWidth: 720 }}>
            {eyebrow && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 11,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: eyebrowColor || "rgba(244,243,238,0.55)",
                  fontFamily: "'JetBrains Mono', monospace",
                  marginBottom: 20,
                  fontWeight: 500,
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: eyebrowColor || "rgba(244,243,238,0.5)",
                    boxShadow: eyebrowColor ? `0 0 8px ${eyebrowColor}66` : "none",
                  }}
                />
                {eyebrow}
              </div>
            )}
            {title && (
              <h2
                style={{
                  fontSize: isCJK(title) ? 44 : 52,
                  fontWeight: 600,
                  letterSpacing: isCJK(title) ? "0.02em" : "-0.035em",
                  lineHeight: isCJK(title) ? 1.15 : 1.04,
                  margin: 0,
                  color: "#f4f3ee",
                  textWrap: isCJK(title) ? "balance" : "auto",
                  fontFamily: isCJK(title) ? "ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif" : "inherit",
                }}
              >
                {title}
              </h2>
            )}
            {blurb && (
              <p
                style={{
                  fontSize: isCJK(blurb) ? 16 : 17,
                  lineHeight: isCJK(blurb) ? 2.0 : 1.55,
                  color: "rgba(244,243,238,0.5)",
                  letterSpacing: isCJK(blurb) ? "0.02em" : "-0.005em",
                  margin: "22px 0 0",
                  maxWidth: 620,
                  textWrap: isCJK(blurb) ? "pretty" : "auto",
                }}
              >
                {blurb}
              </p>
            )}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

function ChipBadge({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 10.5,
        fontFamily: "'JetBrains Mono', monospace",
        letterSpacing: "0.04em",
        color,
        background: `${color}14`,
        border: `1px solid ${color}35`,
        borderRadius: 5,
        padding: "3px 8px",
      }}
    >
      {children}
    </span>
  );
}

export function MetricsStrip({ accent = "#22d3ee" }: AccentProps) {
  const metrics = [
    { value: "47s", label: "Avg. brief generation", sub: "from RSS to draft" },
    { value: "23x", label: "Faster than manual", sub: "per editorial cycle" },
    { value: "94%", label: "Critique acceptance", sub: "Reviewer to editor" },
    { value: "1.2k", label: "Daily intelligence cards", sub: "across active feeds" },
  ];

  return (
    <section
      style={{
        position: "relative",
        padding: "72px 96px 0",
        borderTop: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 0,
            background: "rgba(255,255,255,0.015)",
            border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          {metrics.map((metric, index) => (
            <div
              key={metric.label}
              style={{
                padding: "32px 28px",
                borderRight: index < metrics.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
              }}
            >
              <div
                style={{
                  fontSize: 40,
                  fontWeight: 600,
                  letterSpacing: "-0.04em",
                  color: index === 0 ? accent : "#f4f3ee",
                  fontFamily: "'Inter Tight', sans-serif",
                  marginBottom: 8,
                }}
              >
                {metric.value}
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "rgba(244,243,238,0.78)",
                  letterSpacing: "-0.005em",
                  marginBottom: 2,
                }}
              >
                {metric.label}
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: "rgba(244,243,238,0.38)",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {metric.sub}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function DiscoverSection({ accent = "#22d3ee" }: AccentProps) {
  const { t } = useTranslation();
  const bullets = [
    { title: t("landing.sections.discoverBullets.oneTitle"), desc: t("landing.sections.discoverBullets.oneDesc") },
    { title: t("landing.sections.discoverBullets.twoTitle"), desc: t("landing.sections.discoverBullets.twoDesc") },
    { title: t("landing.sections.discoverBullets.threeTitle"), desc: t("landing.sections.discoverBullets.threeDesc") },
  ];

  return (
    <SectionShell
      id="discover"
      eyebrow="01 · Discover"
      eyebrowColor={accent}
      title={t("landing.sections.discoverTitle")}
      blurb={t("landing.sections.discoverBlurb")}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1.4fr",
          gap: 48,
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {bullets.map((bullet, index) => (
            <div
              key={bullet.title}
              style={{
                display: "grid",
                gridTemplateColumns: "32px 1fr",
                gap: 14,
                alignItems: "start",
                padding: "14px 0",
                borderTop: index === 0 ? "1px solid rgba(255,255,255,0.06)" : "none",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                  color: "rgba(255,255,255,0.35)",
                  paddingTop: 2,
                }}
              >
                0{index + 1}
              </div>
              <div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 500,
                    letterSpacing: "-0.015em",
                    color: "rgba(255,255,255,0.95)",
                    marginBottom: 4,
                  }}
                >
                  {bullet.title}
                </div>
                <div
                  style={{
                    fontSize: 13.5,
                    lineHeight: 1.55,
                    color: "rgba(255,255,255,0.5)",
                    letterSpacing: "-0.005em",
                  }}
                >
                  {bullet.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
        <DiscoverWallMockup accent={accent} />
      </div>
    </SectionShell>
  );
}

function DiscoverWallMockup({ accent }: { accent: string }) {
  const cards = [
    {
      category: "Security",
      categoryColor: "#f87171",
      title: "Iran-linked actors target U.S. critical infrastructure",
      excerpt: "Coordinated campaign against PLC devices in water and energy sectors; medical manufacturer Stryker also affected.",
      tags: ["#cybersecurity", "#iran", "#critical-infra"],
      score: "9.1",
      background: "linear-gradient(135deg, #1a1a2e 0%, #0a0a18 100%)",
      pattern: "rain",
    },
    {
      category: "Science",
      categoryColor: "#a78bfa",
      title: "Quantum advances accelerate, breaking existing crypto",
      excerpt: "Two new reports highlight ECC vulnerabilities; Google's Q-Day moved up to 2029.",
      tags: ["#quantum", "#crypto", "#cybersecurity"],
      score: "8.7",
      background: "linear-gradient(135deg, #1c1530 0%, #0e0820 100%)",
      pattern: "grid",
    },
    {
      category: "Security",
      categoryColor: "#f87171",
      title: "Multi-vendor supply-chain attacks expose software flaws",
      excerpt: "TeamPCP campaign uses popular installer to deliver multi-stage payloads via signed updates.",
      tags: ["#cybersecurity", "#supply-chain", "#patches"],
      score: "8.2",
      background: "linear-gradient(135deg, #2a1410 0%, #170808 100%)",
      pattern: "wave",
    },
    {
      category: "Security",
      categoryColor: "#f87171",
      title: "Russian military hackers exploit consumer routers",
      excerpt: "GRU-affiliated cluster harvests credentials from edge devices in EU networks.",
      tags: ["#cybersecurity", "#russia", "#routers"],
      score: "7.9",
      background: "linear-gradient(135deg, #2d1d10 0%, #170d05 100%)",
      pattern: "topo",
    },
  ];

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.015)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 16,
        padding: 18,
        boxShadow: "0 30px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 4px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "rgba(255,255,255,0.85)", fontWeight: 500 }}>
          <span style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 5, padding: "3px 8px" }}>
            Text Intel
          </span>
          <span style={{ color: "rgba(255,255,255,0.35)", padding: "3px 8px" }}>Video Intel</span>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 4, fontSize: 10.5, color: "rgba(255,255,255,0.4)", fontFamily: "'JetBrains Mono', monospace" }}>
          {["All 23", "Security 9", "AI 6", "Science 3", "Other 5"].map((filter, index) => (
            <span
              key={filter}
              style={{
                padding: "3px 8px",
                background: index === 0 ? "rgba(255,255,255,0.06)" : "transparent",
                border: index === 0 ? "1px solid rgba(255,255,255,0.08)" : "1px solid transparent",
                borderRadius: 4,
                color: index === 0 ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.4)",
              }}
            >
              {filter}
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {cards.map((card) => (
          <div
            key={card.title}
            style={{
              background: card.background,
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 12,
              padding: 14,
              position: "relative",
              overflow: "hidden",
              minHeight: 180,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <CardTexture pattern={card.pattern} />
            <div style={{ position: "relative", zIndex: 2 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 9.5,
                  fontWeight: 600,
                  color: card.categoryColor,
                  background: `${card.categoryColor}18`,
                  border: `1px solid ${card.categoryColor}35`,
                  borderRadius: 4,
                  padding: "2px 7px",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  fontFamily: "'JetBrains Mono', monospace",
                  marginBottom: 32,
                }}
              >
                {card.category}
              </div>
              <div
                style={{
                  fontSize: 14.5,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.95)",
                  letterSpacing: "-0.018em",
                  lineHeight: 1.25,
                  marginBottom: 6,
                }}
              >
                {card.title}
              </div>
              <div
                style={{
                  fontSize: 11,
                  lineHeight: 1.5,
                  color: "rgba(255,255,255,0.5)",
                  letterSpacing: "-0.005em",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {card.excerpt}
              </div>
            </div>
            <div
              style={{
                position: "relative",
                zIndex: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingTop: 10,
                borderTop: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
                {card.tags.slice(0, 2).map((tag) => (
                  <span key={tag} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {tag}
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: accent, fontFamily: "'JetBrains Mono', monospace" }}>
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: accent, boxShadow: `0 0 6px ${accent}` }} />
                {card.score}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CardTexture({ pattern }: { pattern: string }) {
  if (pattern === "rain") {
    return (
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.5 }}>
        {Array.from({ length: 20 }).map((_, index) => (
          <line key={index} x1={index * 18 + 10} y1="0" x2={index * 18 - 30} y2="80" stroke="rgba(180,200,255,0.18)" strokeWidth="1" />
        ))}
      </svg>
    );
  }

  if (pattern === "grid") {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `linear-gradient(rgba(167,139,250,0.08) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(167,139,250,0.08) 1px, transparent 1px)`,
          backgroundSize: "20px 20px",
        }}
      />
    );
  }

  if (pattern === "wave") {
    return (
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.4 }} preserveAspectRatio="none" viewBox="0 0 200 100">
        <path d="M0,30 Q50,10 100,30 T200,30" stroke="rgba(248,113,113,0.25)" strokeWidth="1" fill="none" />
        <path d="M0,50 Q50,30 100,50 T200,50" stroke="rgba(248,113,113,0.18)" strokeWidth="1" fill="none" />
        <path d="M0,70 Q50,50 100,70 T200,70" stroke="rgba(248,113,113,0.12)" strokeWidth="1" fill="none" />
      </svg>
    );
  }

  if (pattern === "topo") {
    return (
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.4 }} preserveAspectRatio="none" viewBox="0 0 200 120">
        {Array.from({ length: 8 }).map((_, index) => (
          <ellipse key={index} cx="100" cy="60" rx={20 + index * 18} ry={10 + index * 8} stroke="rgba(251,191,36,0.15)" strokeWidth="0.7" fill="none" />
        ))}
      </svg>
    );
  }

  return null;
}

export function ContentWorkspaceSection({ accent = "#22d3ee" }: AccentProps) {
  const { t, language } = useTranslation();
  const cards = [
    { title: t("landing.sections.workspaceCardOneTitle"), desc: t("landing.sections.workspaceCardOneDesc"), color: "#a78bfa" },
    { title: t("landing.sections.workspaceCardTwoTitle"), desc: t("landing.sections.workspaceCardTwoDesc"), color: "#fbbf24" },
    { title: t("landing.sections.workspaceCardThreeTitle"), desc: t("landing.sections.workspaceCardThreeDesc"), color: accent },
  ];

  return (
    <SectionShell
      id="workspace"
      eyebrow="02 · Content Workspace"
      eyebrowColor={accent}
      title={t("landing.sections.workspaceTitle")}
      blurb={t("landing.sections.workspaceBlurb")}
    >
      <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 34, alignItems: "stretch" }}>
        <div style={{ display: "grid", gap: 14 }}>
          {cards.map((card, index) => (
            <div key={card.title} style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.025)", borderRadius: 16, padding: 22 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: card.color, boxShadow: `0 0 10px ${card.color}` }} />
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>0{index + 1}</span>
              </div>
              <h3 style={{ margin: 0, fontSize: 19, fontWeight: 600, color: "white", letterSpacing: "-0.02em" }}>{card.title}</h3>
              <p style={{ margin: "10px 0 0", fontSize: 13.5, lineHeight: 1.65, color: "rgba(255,255,255,0.48)", letterSpacing: "-0.005em" }}>{card.desc}</p>
            </div>
          ))}
        </div>

        <div style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.018)", borderRadius: 18, padding: 22, minHeight: 420, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 72% 18%, ${accent}18, transparent 42%)`, pointerEvents: "none" }} />
          <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "white", letterSpacing: "-0.02em" }}>{t("landing.sections.workspaceMockTitle")}</div>
              <div style={{ marginTop: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: "rgba(255,255,255,0.35)" }}>{t("landing.sections.workspaceMockSubtitle")}</div>
            </div>
            <ChipBadge color="#34d399">READY</ChipBadge>
          </div>
          <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {["Signal card", "Angle bank", "Draft brief", "Source context"].map((item, index) => {
              const zh = language === "zh";
              const texts = zh 
                ? ["提取核心事实与观点", "整理多个关联角度", "生成带有引用标注的初稿", "提供原始信息与对比数据"]
                : ["Extract core facts and views", "Organize related angles", "Generate draft with citations", "Provide original context"];
              return (
              <div key={item} style={{ minHeight: index === 0 ? 150 : 118, border: "1px solid rgba(255,255,255,0.06)", background: index === 0 ? "rgba(255,255,255,0.055)" : "rgba(0,0,0,0.22)", borderRadius: 12, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 28 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "rgba(255,255,255,0.35)" }}>WRK-{index + 1}</span>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: ["#a78bfa", "#fbbf24", accent, "#34d399"][index] }} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.9)", letterSpacing: "-0.015em", marginBottom: 12 }}>{item}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>{texts[index]}</div>
              </div>
            )})}
          </div>
        </div>
      </div>
    </SectionShell>
  );
}

export function AgentStudioSection({ accent = "#22d3ee" }: AccentProps) {
  const { t } = useTranslation();
  const groups: StudioGroup[] = [
    { kind: "EXTRACTOR AGENTS", color: "#fbbf24", agents: [{ name: "Default Extractor", type: "System", active: true }] },
    {
      kind: "WRITER AGENTS",
      color: accent,
      agents: [
        { name: "Default Writer", type: "System" },
        { name: "Xiaohongshu Style", type: "Custom" },
        { name: "Long-form Analyst", type: "Custom" },
      ],
    },
    { kind: "REVIEWER AGENTS", color: "#f87171", agents: [{ name: "Default Reviewer", type: "System" }] },
    { kind: "IMAGE AGENTS", color: "#a78bfa", agents: [{ name: "Default Illustrator", type: "System" }] },
  ];

  return (
    <SectionShell
      id="agents"
      eyebrow="02 · Agent Studio"
      eyebrowColor={accent}
      title={t("landing.sections.agentTitle")}
      blurb={t("landing.sections.agentBlurb")}
    >
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 28, alignItems: "stretch" }}>
        <div style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 18 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
              paddingBottom: 12,
              borderBottom: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.95)", letterSpacing: "-0.015em" }}>Agent Studio</span>
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "rgba(255,255,255,0.5)",
                fontSize: 14,
              }}
            >
              +
            </span>
          </div>

          {groups.map((group) => (
            <div key={group.kind} style={{ marginBottom: 14 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 9.5,
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: "0.1em",
                  color: "rgba(255,255,255,0.35)",
                  marginBottom: 8,
                  paddingLeft: 6,
                }}
              >
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: group.color, boxShadow: `0 0 5px ${group.color}` }} />
                {group.kind}
              </div>
              {group.agents.map((agent) => (
                <div
                  key={agent.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 10px",
                    marginBottom: 2,
                    borderRadius: 7,
                    background: agent.active ? "rgba(255,255,255,0.05)" : "transparent",
                    border: agent.active ? "1px solid rgba(255,255,255,0.08)" : "1px solid transparent",
                  }}
                >
                  <span
                    style={{
                      fontSize: 12.5,
                      color: agent.active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.55)",
                      letterSpacing: "-0.005em",
                      fontWeight: agent.active ? 500 : 400,
                    }}
                  >
                    {agent.name}
                  </span>
                  <span style={{ fontSize: 9.5, fontFamily: "'JetBrains Mono', monospace", color: "rgba(255,255,255,0.32)", display: "flex", alignItems: "center", gap: 5 }}>
                    {agent.type}
                    {agent.type === "System" && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#34d399" }} />}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.015)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 16,
            padding: 22,
            position: "relative",
            minHeight: 460,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 18,
              paddingBottom: 14,
              borderBottom: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "rgba(255,255,255,0.95)", letterSpacing: "-0.018em" }}>
                Default Extractor{" "}
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    color: "rgba(255,255,255,0.4)",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 4,
                    padding: "1px 6px",
                    marginLeft: 6,
                    fontFamily: "'JetBrains Mono', monospace",
                    verticalAlign: "middle",
                  }}
                >
                  System
                </span>
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4, letterSpacing: "-0.005em" }}>
                Tabs · Config · <span style={{ color: "rgba(255,255,255,0.85)", fontWeight: 500 }}>Workbench</span>
              </div>
            </div>
            <ChipBadge color="#34d399">ACTIVE</ChipBadge>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div
              style={{
                alignSelf: "flex-end",
                maxWidth: "70%",
                fontSize: 12.5,
                color: "rgba(255,255,255,0.85)",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 10,
                padding: "10px 14px",
                letterSpacing: "-0.005em",
              }}
            >
              Help me extract the latest articles from theverge feed.
            </div>

            <div
              style={{
                alignSelf: "flex-start",
                maxWidth: "85%",
                background: "rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 10,
                padding: 14,
                fontSize: 12,
                color: "rgba(255,255,255,0.7)",
                lineHeight: 1.6,
              }}
            >
              <div style={{ marginBottom: 10, fontWeight: 500, color: "rgba(255,255,255,0.9)" }}>Pulling source: theverge</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(255,255,255,0.55)", lineHeight: 1.7 }}>
                <div>Source: theverge</div>
                <div>Source ID: 1</div>
                <div>Link: theverge.com/rss/ai-artificial-intelligence</div>
              </div>
            </div>

            <div
              style={{
                alignSelf: "flex-start",
                maxWidth: "85%",
                background: "rgba(52,211,153,0.06)",
                border: "1px solid rgba(52,211,153,0.2)",
                borderRadius: 10,
                padding: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 600, color: "#34d399", marginBottom: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Action completed
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.7 }}>
                <div>38 articles fetched · 12 deduplicated</div>
                <div>Task ID: 0b48cf99-5d25-4645-bb5e-95957ea0b07b</div>
              </div>
              <div
                style={{
                  marginTop: 10,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11,
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.85)",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 6,
                  padding: "5px 10px",
                }}
              >
                View source
              </div>
            </div>
          </div>

          <div
            style={{
              position: "absolute",
              bottom: 22,
              left: 22,
              right: 22,
              background: "rgba(0,0,0,0.4)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 10,
              padding: "10px 14px",
              fontSize: 12,
              color: "rgba(255,255,255,0.3)",
            }}
          >
            For example: add an RSS source and fetch the latest posts
          </div>
        </div>
      </div>
    </SectionShell>
  );
}

export function PipelineSection({ accent = "#22d3ee" }: AccentProps) {
  const { t } = useTranslation();
  const stages = [
    { number: "01", label: "Sources", desc: "RSS · Newsletters · Web · Video", color: "rgba(255,255,255,0.5)" },
    { number: "02", label: "Discover", desc: "Score · Classify · Dedupe", color: "#fbbf24" },
    { number: "03", label: "Inspiration", desc: "Curate · Cluster · Tag", color: "#a78bfa" },
    { number: "04", label: "Writer", desc: "Draft · Stream · Cite", color: accent },
    { number: "05", label: "Reviewer", desc: "Critique · Score · Suggest", color: "#f87171" },
    { number: "06", label: "Report", desc: "Publish · Export · Archive", color: "#34d399" },
  ];

  return (
    <SectionShell
      id="pipeline"
      eyebrow="03 · Editorial Pipeline"
      eyebrowColor={accent}
      title={t("landing.sections.pipelineTitle")}
      blurb={t("landing.sections.pipelineBlurb")}
    >
      <div style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 36, position: "relative" }}>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${stages.length}, 1fr)`, gap: 0, position: "relative" }}>
          <div
            style={{
              position: "absolute",
              top: 24,
              left: "8%",
              right: "8%",
              height: 1,
              background: `linear-gradient(90deg, rgba(255,255,255,0.5) 0%, #fbbf24 20%, #a78bfa 40%, ${accent} 60%, #f87171 80%, #34d399 100%)`,
              opacity: 0.4,
            }}
          />
          {stages.map((stage) => (
            <div key={stage.number} style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative", zIndex: 2 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: "#08090b",
                  border: `1.5px solid ${stage.color}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 600,
                  color: stage.color,
                  fontFamily: "'JetBrains Mono', monospace",
                  boxShadow: `0 0 24px ${stage.color}30`,
                  marginBottom: 16,
                }}
              >
                {stage.number}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.95)", letterSpacing: "-0.015em", marginBottom: 4 }}>{stage.label}</div>
              <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.4)", fontFamily: "'JetBrains Mono', monospace", textAlign: "center", letterSpacing: "0.01em" }}>
                {stage.desc}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 48, paddingTop: 28, borderTop: "1px solid rgba(255,255,255,0.06)", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {[
            { title: "Pause anywhere", desc: "Stop after Discover to manually rank, or after Writer to edit before review." },
            { title: "Branch and retry", desc: "Send the same draft through three reviewers in parallel and pick the best." },
            { title: "Human in the loop", desc: "Reviewers can require analyst sign-off before any stage transitions." },
          ].map((item) => (
            <div key={item.title}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.92)", letterSpacing: "-0.012em", marginBottom: 6 }}>{item.title}</div>
              <div style={{ fontSize: 12.5, lineHeight: 1.55, color: "rgba(255,255,255,0.5)", letterSpacing: "-0.005em" }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </SectionShell>
  );
}

export function ReviewSection({ accent = "#22d3ee" }: AccentProps) {
  const { t } = useTranslation();

  return (
    <SectionShell
      id="review"
      eyebrow="04 · Editorial Review"
      eyebrowColor={accent}
      title={t("landing.sections.reviewTitle")}
      blurb={t("landing.sections.reviewBlurb")}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 32, alignItems: "stretch" }}>
        <div style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 28, position: "relative", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11.5, color: "rgba(255,255,255,0.4)", fontFamily: "'JetBrains Mono', monospace", marginBottom: 20 }}>
            <span>Pipeline</span>
            <span style={{ opacity: 0.4 }}>/</span>
            <span style={{ color: "rgba(255,255,255,0.85)" }}>Daily Report</span>
            <span style={{ opacity: 0.4 }}>/</span>
            <span>Apr 26, 2026</span>
            <span style={{ flex: 1 }} />
            <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#34d399" }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#34d399", boxShadow: "0 0 6px #34d399" }} />
              Complete
            </span>
          </div>

          <div style={{ fontSize: 26, fontWeight: 700, color: "rgba(255,255,255,0.97)", letterSpacing: "-0.025em", marginBottom: 8 }}>Daily AI Intelligence Report</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace", marginBottom: 20 }}>
            Source Materials · 2 Articles
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            {[
              { title: "Google accelerates Q-Day projection to 2029", source: "arstechnica.com" },
              { title: "Post-quantum cryptography deployment", source: "techcrunch.com" },
            ].map((source) => (
              <div key={source.title} style={{ flex: 1, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.8)", letterSpacing: "-0.005em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 4 }}>
                  {source.title}
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: "'JetBrains Mono', monospace" }}>{source.source}</div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 18, fontWeight: 600, color: "rgba(255,255,255,0.95)", letterSpacing: "-0.022em", marginBottom: 10 }}>Executive Summary</div>
          <div style={{ fontSize: 13, lineHeight: 1.75, color: "rgba(255,255,255,0.6)", letterSpacing: "-0.005em" }}>
            <span style={{ background: "rgba(251,191,36,0.18)", borderBottom: "1px solid rgba(251,191,36,0.5)", padding: "1px 2px" }}>
              U.S. military operations leveraging AI systems show significant efficiency gains, while simultaneously facing cyber attacks linked to Iran and Russia.
            </span>{" "}
            Quantum computing advances threaten existing encryption frameworks; Google has accelerated its Q-Day projection to 2029, urging adoption of post-quantum cryptography across the federal stack.
          </div>
          <div style={{ marginTop: 22, fontSize: 18, fontWeight: 600, color: "rgba(255,255,255,0.95)", letterSpacing: "-0.022em", marginBottom: 10 }}>Key Stories</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.85)", letterSpacing: "-0.015em", marginBottom: 8 }}>1. AI-driven targeting in the field</div>
          <div style={{ fontSize: 13, lineHeight: 1.75, color: "rgba(255,255,255,0.6)", letterSpacing: "-0.005em" }}>
            The U.S. military&apos;s Maven smart system has reportedly{" "}
            <span style={{ background: "rgba(251,191,36,0.18)", borderBottom: "1px solid rgba(251,191,36,0.5)", padding: "1px 2px" }}>
              nearly doubled targeting efficiency
            </span>
            . Meanwhile,{" "}
            <span style={{ background: "rgba(248,113,113,0.18)", borderBottom: "1px solid rgba(248,113,113,0.5)", padding: "1px 2px" }}>
              Iran-linked APT clusters have, since March 2026, conducted coordinated
            </span>
            cyber espionage against infrastructure.
          </div>
        </div>

        <div style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 26, display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>Editorial Review</span>
            <div style={{ display: "flex", gap: 4, fontSize: 11.5 }}>
              <span style={{ color: "rgba(255,255,255,0.95)", fontWeight: 500, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "4px 10px" }}>
                Review
              </span>
              <span style={{ color: "rgba(255,255,255,0.4)", padding: "4px 10px" }}>Trace</span>
            </div>
          </div>

          <ScoreGauge value={6.8} max={10} accent={accent} />
          <div style={{ fontSize: 13, lineHeight: 1.7, color: "rgba(255,255,255,0.6)", letterSpacing: "-0.005em" }}>
            The report is structurally clear and covers core developments in tech and security. <span style={{ color: "rgba(255,255,255,0.85)" }}>However, depth of analysis is limited in several places</span> - particularly when discussing Iran-linked attacks and quantum cryptography. Verbatim claims need stronger sourcing.
          </div>
          <div style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span style={{ fontSize: 12.5, fontWeight: 500, color: "rgba(255,255,255,0.9)" }}>Content modified</span>
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.55, marginBottom: 12 }}>You&apos;ve made changes to the document. Re-run AI review to get fresh feedback.</div>
            <button type="button" style={{ width: "100%", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: 500, padding: "8px 12px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}>
              Re-run AI Review
            </button>
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>7 Issues Remaining</span>
              <span style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.85)", cursor: "pointer" }}>Accept All</span>
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.6, color: "rgba(255,255,255,0.55)", padding: "10px 12px", background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 8, fontStyle: "italic" }}>
              &quot;Nearly doubled targeting efficiency&quot; - claim too vague; lacks attribution. Suggest citing the underlying study and clarifying the baseline.
            </div>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}

function ScoreGauge({ value, max, accent }: { value: number; max: number; accent: string }) {
  const percentage = value / max;
  const radius = 56;
  const circumference = 2 * Math.PI * radius;

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "8px 0" }}>
      <div style={{ position: "relative", width: 140, height: 140 }}>
        <svg width="140" height="140" viewBox="0 0 140 140">
          <circle cx="70" cy="70" r={radius} stroke="rgba(255,255,255,0.06)" strokeWidth="8" fill="none" />
          <circle
            cx="70"
            cy="70"
            r={radius}
            stroke={accent}
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - circumference * percentage}
            transform="rotate(-90 70 70)"
            style={{ filter: `drop-shadow(0 0 8px ${accent}88)` }}
          />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
          <div style={{ fontSize: 36, fontWeight: 600, color: "rgba(255,255,255,0.97)", letterSpacing: "-0.04em", lineHeight: 1 }}>{value.toFixed(1)}</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", fontFamily: "'JetBrains Mono', monospace", marginTop: 4 }}>EDITORIAL</div>
        </div>
      </div>
    </div>
  );
}

export function KanbanSection({ accent = "#22d3ee" }: AccentProps) {
  const { t } = useTranslation();
  const columns: KanbanColumn[] = [
    { name: "Backlog", count: 0, dot: "rgba(255,255,255,0.4)", tasks: [] },
    { name: "Todo", count: 1, dot: "#9ca3af", tasks: [{ id: "TSK-6", title: "Executive Summary", agent: "Default Writer", refs: 1, dot: "rgba(255,255,255,0.4)" }] },
    {
      name: "In Progress",
      count: 2,
      dot: "#fbbf24",
      tasks: [
        { id: "TSK-7", title: "Executive Summary", agent: "Default Writer", refs: 1, dot: "#fbbf24" },
        { id: "TSK-4", title: "Gemini plugin validation after celery restart", agent: "Default Writer", refs: 0, dot: "#fbbf24" },
      ],
    },
    { name: "Done", count: 0, dot: accent, tasks: [] },
    { name: "Failed", count: 0, dot: "#f87171", tasks: [] },
  ];

  return (
    <SectionShell
      id="kanban"
      eyebrow="05 · Task Kanban"
      eyebrowColor={accent}
      title={t("landing.sections.kanbanTitle")}
      blurb={t("landing.sections.kanbanBlurb")}
    >
      <div style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 14, marginBottom: 18, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: "rgba(255,255,255,0.95)", letterSpacing: "-0.015em" }}>Task Kanban</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'JetBrains Mono', monospace" }}>3 total</span>
          </div>
          <div style={{ display: "flex", gap: 14, fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'JetBrains Mono', monospace" }}>
            <span>Filter</span>
            <span>Display</span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns.length}, 1fr)`, gap: 10 }}>
          {columns.map((column) => (
            <div key={column.name}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.85)", letterSpacing: "-0.005em", marginBottom: 12, padding: "0 4px" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: column.dot, boxShadow: column.count > 0 ? `0 0 6px ${column.dot}` : "none" }} />
                {column.name}
                <span style={{ marginLeft: 4, fontSize: 10.5, color: "rgba(255,255,255,0.35)", fontFamily: "'JetBrains Mono', monospace" }}>{column.count}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 200 }}>
                {column.tasks.length === 0 ? (
                  <div style={{ border: "1px dashed rgba(255,255,255,0.06)", borderRadius: 8, padding: "32px 12px", textAlign: "center", fontSize: 11.5, color: "rgba(255,255,255,0.25)" }}>No tasks</div>
                ) : (
                  column.tasks.map((task) => (
                    <div key={task.id} style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.4)", fontFamily: "'JetBrains Mono', monospace" }}>{task.id}</span>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2">
                          <rect x="3" y="11" width="18" height="11" rx="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      </div>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 7, fontSize: 12.5, fontWeight: 500, color: "rgba(255,255,255,0.92)", letterSpacing: "-0.012em", lineHeight: 1.4, marginBottom: 10 }}>
                        <span style={{ width: 9, height: 9, borderRadius: "50%", border: `1.5px solid ${task.dot}`, marginTop: 4, flexShrink: 0 }} />
                        {task.title}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9.5, color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 4, padding: "2px 6px" }}>
                          {task.agent}
                        </span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9.5, color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 4, padding: "2px 6px" }}>
                          refs {task.refs}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SectionShell>
  );
}

export function ClosingCTA({ accent = "#22d3ee", onRegister }: ClosingCTAProps) {
  const { t, language } = useTranslation();
  const zh = language === "zh";

  return (
    <section id="cta" style={{ position: "relative", padding: "160px 96px", borderTop: "1px solid rgba(255,255,255,0.04)", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          top: "30%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "70%",
          height: "60%",
          background: `radial-gradient(ellipse at center, ${accent}1a 0%, ${accent}06 35%, transparent 65%)`,
          filter: "blur(60px)",
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "relative", maxWidth: 880, margin: "0 auto", textAlign: "center" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 11,
            color: "rgba(255,255,255,0.5)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            fontFamily: "'JetBrains Mono', monospace",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 999,
            padding: "6px 14px",
            marginBottom: 32,
          }}
        >
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: accent, boxShadow: `0 0 8px ${accent}` }} />
          {t("landing.sections.ctaBadge")}
        </div>
        <h2 className={`font-semibold text-[rgba(255,255,255,0.97)] ${zh ? 'text-[56px] leading-[1.15] tracking-[0.02em] text-balance font-serif' : 'text-[76px] leading-[1.0] tracking-[-0.045em]'}`} style={{ margin: 0 }}>
          {t("landing.sections.ctaTitleLine1")}
          {zh ? "" : <br />}
          <span className={zh ? "font-serif" : "italic font-normal font-serif"} style={{ color: accent }}>{t("landing.sections.ctaTitleAccent")}</span>
        </h2>
        <p className={`mx-auto mt-7 max-w-[560px] text-white/50 ${zh ? 'text-[16px] leading-[2] tracking-[0.02em] text-pretty' : 'text-[17px] leading-[1.55] tracking-[-0.005em]'}`}>
          {t("landing.sections.ctaBody")}
        </p>
        <div style={{ marginTop: 40, display: "flex", justifyContent: "center", gap: 12 }}>
          <button
            type="button"
            onClick={onRegister}
            style={{
              background: "white",
              color: "#08090b",
              fontSize: 14,
              fontWeight: 600,
              padding: "12px 22px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              letterSpacing: "-0.005em",
              boxShadow: "0 1px 0 rgba(255,255,255,0.4) inset, 0 8px 24px rgba(0,0,0,0.4)",
            }}
          >
            {t("landing.sections.requestAccess")}
          </button>
          <a
            href="#pipeline"
            style={{
              background: "transparent",
              color: "rgba(255,255,255,0.7)",
              fontSize: 14,
              fontWeight: 500,
              padding: "12px 18px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.08)",
              cursor: "pointer",
              letterSpacing: "-0.005em",
              textDecoration: "none",
            }}
          >
            {t("landing.sections.readDocs")}
          </a>
        </div>
      </div>
    </section>
  );
}

export function LandingFooter({ accent = "#22d3ee" }: AccentProps) {
  const { t } = useTranslation();
  const columns = [
    {
      heading: "Product",
      links: [
        { label: "Discover", href: "/landing#discover" },
        { label: "Source Management", href: "/landing/source-management" },
        { label: "Agent Studio", href: "/landing#agents" },
        { label: "Pipeline", href: "/landing#pipeline" },
        { label: "Task Kanban", href: "/landing#kanban" },
      ],
    },
    {
      heading: "Resources",
      links: [
        { label: "Feature pages", href: "/landing#features" },
        { label: "Editorial Review", href: "/landing#review" },
        { label: "Request access", href: "/landing#cta" },
      ],
    },
    {
      heading: "Company",
      links: [
        { label: "Overview", href: "/landing" },
        { label: "Customer path", href: "/landing/source-management#customer-path" },
      ],
    },
    {
      heading: "Legal",
      links: [
        { label: "Security", href: "/landing/source-management#capabilities" },
        { label: "Status", href: "/landing#cta" },
      ],
    },
  ];

  return (
    <footer style={{ background: "#050507", borderTop: "1px solid rgba(255,255,255,0.05)", padding: "64px 96px 40px" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr 1fr", gap: 32, paddingBottom: 48, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, #888 0%, #1a1a1a 70%)", border: "1px solid rgba(255,255,255,0.1)" }} />
              <span style={{ fontSize: 16, fontWeight: 600, color: "white", letterSpacing: "-0.02em" }}>Newsroom</span>
            </div>
            <p style={{ fontSize: 12.5, lineHeight: 1.6, color: "rgba(255,255,255,0.4)", letterSpacing: "-0.005em", maxWidth: 280, margin: 0 }}>
              {t("landing.sections.footerTagline")}
            </p>
          </div>

          {columns.map((column) => (
            <div key={column.heading}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace", marginBottom: 16 }}>{column.heading}</div>
              {column.links.map((link) => (
                <a key={link.label} href={link.href} style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.65)", letterSpacing: "-0.005em", marginBottom: 9, textDecoration: "none" }}>
                  {link.label}
                </a>
              ))}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 32, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "rgba(255,255,255,0.3)", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.02em" }}>
          <span>© 2026 Newsroom Labs · v2.4.1</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: accent, boxShadow: `0 0 6px ${accent}` }} />
            {t("landing.sections.statusOperational")}
          </span>
        </div>
      </div>
    </footer>
  );
}
