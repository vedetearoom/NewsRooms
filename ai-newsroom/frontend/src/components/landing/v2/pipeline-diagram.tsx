"use client";

import type { ReactNode } from "react";

type PipelineDiagramProps = {
  accent?: string;
};

type AgentStatus = "DONE" | "WORKING" | "QUEUED";

type AgentNodeProps = {
  color: string;
  label: "Extract" | "Writer" | "Assassin";
  subtitle: string;
  status: AgentStatus;
  metric: string;
  metricNote: string;
  body?: ReactNode;
  working?: boolean;
  dim?: boolean;
};

export function PipelineDiagram({ accent = "#ffffff" }: PipelineDiagramProps) {
  const colors = {
    extract: "#fbbf24",
    writer: accent,
    assassin: "#f87171",
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: 680,
        background: "linear-gradient(180deg, rgba(255,255,255,0.015), rgba(255,255,255,0.005))",
        border: "1px solid rgba(255,255,255,0.05)",
        borderRadius: 16,
        padding: 28,
        boxShadow: "0 40px 100px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
          `,
          backgroundSize: "32px 32px",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 5,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(0,0,0,0.4)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 6,
              padding: "4px 9px",
            }}
          >
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "#34d399",
                boxShadow: "0 0 6px #34d399",
                animation: "v2Pulse 1.4s ease-in-out infinite",
              }}
            />
            <span
              style={{
                fontSize: 10.5,
                color: "rgba(255,255,255,0.55)",
                letterSpacing: "0.04em",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              RUNNING
            </span>
          </div>
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 500,
              color: "rgba(255,255,255,0.85)",
              letterSpacing: "-0.01em",
            }}
          >
            r-2026-04-28 · Daily AI Brief
          </span>
        </div>
        <div
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.4)",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          elapsed <span style={{ color: "rgba(255,255,255,0.85)" }}>00:47.3s</span>
        </div>
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 5,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <SourcesNode />
        <Arrow color="rgba(255,255,255,0.2)" />
        <AgentNode
          color={colors.extract}
          label="Extract"
          subtitle="Ingest · Score · Classify"
          status="DONE"
          metric="47 cards"
          metricNote="3 prioritized"
          body={<ExtractBody color={colors.extract} />}
        />
        <Arrow color={colors.extract} animated />
        <AgentNode
          color={colors.writer}
          label="Writer"
          subtitle="Draft · Stream · Cite"
          status="WORKING"
          metric="1,847 tok"
          metricNote="streaming..."
          body={<WriterBody color={colors.writer} />}
          working
        />
        <Arrow color={colors.writer} animated />
        <AgentNode
          color={colors.assassin}
          label="Assassin"
          subtitle="Critique · Suggest · Score"
          status="QUEUED"
          metric="-"
          metricNote="awaiting draft"
          body={<AssassinBody />}
          dim
        />
      </div>

      <style>{`
        @keyframes v2Pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.85); }
        }
        @keyframes v2FlowDot {
          0% { top: -8px; opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes v2RingPulse {
          0% { opacity: 0.6; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.4); }
        }
        @keyframes v2Blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function SourcesNode() {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        justifyContent: "flex-start",
        alignItems: "center",
        marginBottom: 4,
      }}
    >
      <div
        style={{
          fontSize: 9.5,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.3)",
          fontWeight: 600,
          fontFamily: "'JetBrains Mono', monospace",
          width: 70,
          flexShrink: 0,
        }}
      >
        SOURCES
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {["RSS · 12", "Newsletters · 8", "Web · 23", "Twitter · 4"].map((source) => (
          <div
            key={source}
            style={{
              fontSize: 11,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 6,
              padding: "4px 10px",
              color: "rgba(255,255,255,0.55)",
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "-0.01em",
            }}
          >
            {source}
          </div>
        ))}
      </div>
    </div>
  );
}

function Arrow({ color, animated }: { color: string; animated?: boolean }) {
  return (
    <div
      style={{
        position: "relative",
        height: 18,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 2,
          height: "100%",
          background: `linear-gradient(180deg, transparent, ${color}55, transparent)`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {animated && (
          <div
            style={{
              position: "absolute",
              left: -1,
              top: 0,
              width: 4,
              height: 8,
              background: color,
              boxShadow: `0 0 8px ${color}`,
              borderRadius: 2,
              animation: "v2FlowDot 1.4s linear infinite",
            }}
          />
        )}
      </div>
    </div>
  );
}

function AgentNode({
  color,
  label,
  subtitle,
  status,
  metric,
  metricNote,
  body,
  working,
  dim,
}: AgentNodeProps) {
  const statusColor = status === "DONE" ? "#34d399" : status === "WORKING" ? color : "rgba(255,255,255,0.3)";

  return (
    <div
      style={{
        position: "relative",
        background: dim ? "rgba(255,255,255,0.015)" : "rgba(255,255,255,0.025)",
        border: working ? `1px solid ${color}55` : "1px solid rgba(255,255,255,0.06)",
        borderRadius: 12,
        padding: "14px 16px",
        boxShadow: working
          ? `0 0 0 4px ${color}10, 0 8px 32px rgba(0,0,0,0.4)`
          : "0 4px 16px rgba(0,0,0,0.3)",
        opacity: dim ? 0.55 : 1,
        transition: "all 200ms",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: body ? 12 : 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: `${color}18`,
              border: `1px solid ${color}40`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color,
              position: "relative",
            }}
          >
            <AgentIcon label={label} />
            {working && (
              <div
                style={{
                  position: "absolute",
                  inset: -4,
                  borderRadius: 11,
                  border: `1.5px solid ${color}`,
                  opacity: 0.5,
                  animation: "v2RingPulse 1.6s ease-out infinite",
                }}
              />
            )}
          </div>
          <div>
            <div
              style={{
                fontSize: 13.5,
                fontWeight: 600,
                color: "rgba(255,255,255,0.95)",
                letterSpacing: "-0.015em",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {label}
              <span
                style={{
                  fontSize: 8.5,
                  fontWeight: 600,
                  color: statusColor,
                  background:
                    status === "DONE"
                      ? "rgba(52,211,153,0.1)"
                      : status === "WORKING"
                        ? `${color}18`
                        : "rgba(255,255,255,0.05)",
                  border:
                    status === "DONE"
                      ? "1px solid rgba(52,211,153,0.25)"
                      : status === "WORKING"
                        ? `1px solid ${color}40`
                        : "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 4,
                  padding: "1.5px 6px",
                  letterSpacing: "0.08em",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {status}
              </span>
            </div>
            <div
              style={{
                fontSize: 10.5,
                color: "rgba(255,255,255,0.4)",
                marginTop: 1,
                letterSpacing: "-0.005em",
              }}
            >
              {subtitle}
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: status === "QUEUED" ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.95)",
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "-0.02em",
            }}
          >
            {metric}
          </div>
          <div
            style={{
              fontSize: 10,
              color: "rgba(255,255,255,0.35)",
              marginTop: 1,
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {metricNote}
          </div>
        </div>
      </div>

      {body}
    </div>
  );
}

function AgentIcon({ label }: { label: AgentNodeProps["label"] }) {
  if (label === "Extract") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    );
  }

  if (label === "Writer") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
      </svg>
    );
  }

  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
      <line x1="13" y1="19" x2="19" y2="13" />
    </svg>
  );
}

function ExtractBody({ color }: { color: string }) {
  const cards = [
    { title: "OpenAI announces GPT-5 with new reasoning architecture", score: "9.4", source: "techcrunch.com" },
    { title: "EU issues EUR48M in fines under AI Act enforcement", score: "8.7", source: "ft.com" },
    { title: "Anthropic closes $5B Series F at $60B valuation", score: "8.2", source: "bloomberg.com" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {cards.map((card) => (
        <div
          key={card.title}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "5px 8px",
            background: "rgba(0,0,0,0.25)",
            border: "1px solid rgba(255,255,255,0.04)",
            borderRadius: 6,
          }}
        >
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              color,
              fontFamily: "'JetBrains Mono', monospace",
              background: `${color}15`,
              border: `1px solid ${color}30`,
              borderRadius: 4,
              padding: "2px 5px",
              minWidth: 28,
              textAlign: "center",
            }}
          >
            {card.score}
          </div>
          <div
            style={{
              flex: 1,
              fontSize: 11.5,
              color: "rgba(255,255,255,0.78)",
              letterSpacing: "-0.005em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {card.title}
          </div>
          <div
            style={{
              fontSize: 9.5,
              color: "rgba(255,255,255,0.3)",
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {card.source}
          </div>
        </div>
      ))}
    </div>
  );
}

function WriterBody({ color }: { color: string }) {
  return (
    <div
      style={{
        background: "rgba(0,0,0,0.35)",
        border: "1px solid rgba(255,255,255,0.04)",
        borderRadius: 8,
        padding: "10px 12px",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
        lineHeight: 1.7,
        color: "rgba(255,255,255,0.7)",
        position: "relative",
      }}
    >
      <div style={{ color: "rgba(255,255,255,0.35)", marginBottom: 4 }}>
        <span style={{ color }}>##</span> Daily AI Intelligence Report · 2026-04-28
      </div>
      <div style={{ color: "rgba(255,255,255,0.55)" }}>
        The AI landscape saw two major inflection points today. OpenAI&apos;s GPT-5 marks a pivotal
        architecture shift that fundamentally changes how multimodal reasoning is approached at scale
        <span
          style={{
            display: "inline-block",
            width: 7,
            height: 13,
            background: color,
            marginLeft: 2,
            verticalAlign: "middle",
            animation: "v2Blink 1s step-end infinite",
          }}
        />
      </div>
    </div>
  );
}

function AssassinBody() {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {["Hyperbole check", "Citation density", "Passive voice", "Lede strength"].map((check) => (
        <div
          key={check}
          style={{
            flex: 1,
            padding: "8px 10px",
            background: "rgba(255,255,255,0.02)",
            border: "1px dashed rgba(255,255,255,0.08)",
            borderRadius: 6,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 9,
              color: "rgba(255,255,255,0.35)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontFamily: "'JetBrains Mono', monospace",
              marginBottom: 4,
            }}
          >
            queued
          </div>
          <div
            style={{
              fontSize: 10.5,
              color: "rgba(255,255,255,0.55)",
              letterSpacing: "-0.005em",
            }}
          >
            {check}
          </div>
        </div>
      ))}
    </div>
  );
}
