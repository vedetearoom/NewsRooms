"use client";

import { useTranslation } from "@/hooks/useTranslation";
import { PipelineDiagram } from "./pipeline-diagram";
import { V2Navbar } from "./navbar";

type HeroV2Props = {
  accent?: string;
  onLogin?: () => void;
  onRegister?: () => void;
};

export function HeroV2({ accent = "#ffffff", onLogin, onRegister }: HeroV2Props) {
  const { t, language } = useTranslation();
  const zh = language === "zh";

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        background: "#08090b",
        color: "white",
        fontFamily: "var(--font-inter-tight), 'Inter', system-ui, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Dot grid background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 70% 50%, black 30%, transparent 80%)",
          maskImage: "radial-gradient(ellipse 80% 60% at 70% 50%, black 30%, transparent 80%)",
        }}
      />

      {/* Accent glow */}
      <div
        style={{
          position: "absolute",
          top: zh ? "4%" : "10%",
          right: zh ? "-6%" : "0%",
          width: zh ? "68%" : "60%",
          height: zh ? "76%" : "70%",
          background: zh
            ? `radial-gradient(ellipse at center, ${accent}26 0%, ${accent}0d 34%, transparent 70%)`
            : `radial-gradient(ellipse at center, ${accent}1f 0%, ${accent}06 35%, transparent 70%)`,
          filter: zh ? "blur(96px)" : "blur(80px)",
          pointerEvents: "none",
        }}
      />
      {zh && (
        <div
          style={{
            position: "absolute",
            top: "18%",
            left: "4%",
            width: "520px",
            height: "420px",
            background: "radial-gradient(ellipse at center, rgba(126,140,255,0.14) 0%, rgba(91,103,255,0.05) 34%, transparent 72%)",
            filter: "blur(72px)",
            pointerEvents: "none",
          }}
        />
      )}

      <V2Navbar accent={accent} onLogin={onLogin} onRegister={onRegister} />

      {/* Main hero content */}
      <div
        className="hero-v2-content"
        style={{
          position: "relative",
          zIndex: 5,
          display: "flex",
          alignItems: "flex-start",
          padding: "72px 64px 64px",
          gap: 48,
          maxWidth: 1600,
          margin: "0 auto",
        }}
      >
        {/* Left column — text */}
        <div style={{ flex: "0 1 520px", minWidth: 360, paddingTop: 28 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: zh
                ? "linear-gradient(180deg, rgba(255,255,255,0.09), rgba(255,255,255,0.035))"
                : "rgba(255,255,255,0.03)",
              border: zh ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(255,255,255,0.07)",
              borderRadius: 999,
              padding: zh ? "7px 13px 7px 10px" : "6px 12px 6px 10px",
              marginBottom: zh ? 34 : 32,
              boxShadow: zh ? "0 1px 0 rgba(255,255,255,0.12) inset, 0 18px 42px rgba(0,0,0,0.28)" : undefined,
              backdropFilter: zh ? "blur(18px)" : undefined,
              WebkitBackdropFilter: zh ? "blur(18px)" : undefined,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: accent,
                boxShadow: `0 0 10px ${accent}, 0 0 4px ${accent}`,
                animation: "v2HeroPulse 1.6s ease-in-out infinite",
              }}
            />
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", letterSpacing: "-0.005em" }}>
              {t("landing.hero.badge")}
            </span>
          </div>

          <h1
            className="hero-v2-title text-balance"
            style={{
              fontSize: zh ? "clamp(56px, 6.4vw, 96px)" : "clamp(56px, 5.6vw, 84px)",
              fontWeight: zh ? 800 : 600,
              letterSpacing: zh ? "-0.035em" : "-0.045em",
              lineHeight: zh ? 1.08 : 0.96,
              margin: 0,
              color: zh ? "transparent" : "rgba(255,255,255,0.98)",
              backgroundImage: zh ? "linear-gradient(180deg, #ffffff 0%, #f1f2f8 42%, #9ea3b6 100%)" : undefined,
              WebkitBackgroundClip: zh ? "text" : undefined,
              backgroundClip: zh ? "text" : undefined,
              textShadow: zh ? "0 24px 70px rgba(136,148,255,0.14)" : undefined,
            }}
          >
            {t("landing.hero.titleLine1")}
            <br />
            {t("landing.hero.titleLine2")}
            {!zh && <br />}
            <span
              className={zh ? undefined : "italic font-normal font-serif"}
              style={{
                color: zh ? "#aeb4cb" : accent,
                WebkitTextFillColor: zh ? "#aeb4cb" : undefined,
              }}
            >
              {t("landing.hero.titleAccent")}
            </span>
          </h1>

          <p
            className="text-pretty"
            style={{
              marginTop: zh ? 30 : 28,
              fontSize: zh ? 17 : 17,
              lineHeight: zh ? 1.9 : 1.5,
              color: zh ? "rgba(226,231,255,0.52)" : "rgba(255,255,255,0.5)",
              letterSpacing: zh ? "0.01em" : "-0.005em",
              maxWidth: zh ? 520 : 460,
              fontWeight: zh ? 350 : undefined,
            }}
          >
            {t("landing.hero.body")}
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 36 }}>
            <button
              type="button"
              onClick={onRegister}
              style={{
                background: zh ? "linear-gradient(180deg, #ffffff 0%, #dfe3f2 100%)" : "white",
                color: "#08090b",
                fontSize: 14,
                fontWeight: zh ? 650 : 600,
                padding: "11px 18px",
                borderRadius: zh ? 9 : 8,
                border: "none",
                cursor: "pointer",
                letterSpacing: zh ? "-0.01em" : "-0.005em",
                boxShadow: zh
                  ? `0 1px 0 rgba(255,255,255,0.75) inset, 0 12px 34px ${accent}26, 0 10px 28px rgba(0,0,0,0.46)`
                  : "0 1px 0 rgba(255,255,255,0.4) inset, 0 8px 24px rgba(0,0,0,0.4)",
              }}
            >
              {t("landing.hero.primaryCta")}
            </button>
            <a
              href="#pipeline"
              style={{
                background: "transparent",
                color: zh ? "rgba(235,238,255,0.72)" : "rgba(255,255,255,0.7)",
                fontSize: 14,
                fontWeight: 500,
                padding: "11px 16px",
                borderRadius: zh ? 9 : 8,
                border: zh ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(255,255,255,0.08)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                letterSpacing: "-0.005em",
                textDecoration: "none",
              }}
            >
              {t("landing.hero.secondaryCta")}
              <span style={{ opacity: 0.5 }}>-&gt;</span>
            </a>
          </div>

          <div style={{ marginTop: 64, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.3)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                marginBottom: 14,
              }}
            >
              {t("landing.hero.trustedBy")}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 28,
                fontSize: 14,
                fontWeight: 500,
                color: "rgba(255,255,255,0.4)",
                letterSpacing: "-0.02em",
              }}
            >
              <span style={{ fontStyle: "italic", fontFamily: "Georgia, serif" }}>Bloomberg</span>
              <span style={{ fontWeight: 700 }}>STRATECHERY</span>
              <span>The Information</span>
              <span style={{ fontWeight: 800, letterSpacing: "-0.05em" }}>Pitchbook</span>
            </div>
          </div>
        </div>

        {/* Right column — pipeline diagram */}
        <div style={{ flex: "1 1 0%", position: "relative", marginTop: 0, minWidth: 0 }}>
          <PipelineDiagram accent={accent} />
        </div>
      </div>

      <style>{`
        @keyframes v2HeroPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.85); }
        }
        @media (max-width: 960px) {
          .hero-v2-content {
            flex-direction: column !important;
            padding: 48px 24px 48px !important;
            gap: 32px !important;
          }
        }
      `}</style>
    </div>
  );
}
