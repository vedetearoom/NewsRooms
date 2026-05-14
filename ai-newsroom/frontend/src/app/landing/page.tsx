"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuthSafe } from "@/lib/clerk-safe";
import { HeroV2 } from "@/components/landing/v2/hero-v2";
import { ScaledHero } from "@/components/landing/v2/scaled-hero";
import {
  AgentStudioSection,
  ClosingCTA,
  ContentWorkspaceSection,
  DiscoverSection,
  KanbanSection,
  LandingFooter,
  MetricsStrip,
  PipelineSection,
  ReviewSection,
} from "@/components/landing/v2/sections";
import { FeatureGateway } from "@/components/landing/feature-gateway";
import { AuthModal, type AuthMode } from "@/components/landing/v2/auth-modal";

export default function LandingPage() {
  const router = useRouter();
  const { isSignedIn } = useAuthSafe();
  const [authOpen, setAuthOpen] = React.useState(false);
  const [authMode, setAuthMode] = React.useState<AuthMode>("login");
  const accent = "#c0c0dd";

  React.useEffect(() => {
    if (isSignedIn) {
      router.replace("/");
    }
  }, [isSignedIn, router]);

  const openLogin = () => {
    setAuthMode("login");
    setAuthOpen(true);
  };

  const openRegister = () => {
    setAuthMode("register");
    setAuthOpen(true);
  };

  return (
    <div
      className="relative min-h-screen bg-[#08090b] text-white overflow-x-hidden"
      style={{ fontFamily: "'Inter Tight', 'Inter', system-ui, sans-serif" }}
    >
      <ScaledHero>
        <HeroV2 accent={accent} onLogin={openLogin} onRegister={openRegister} />
      </ScaledHero>
      <MetricsStrip accent={accent} />
      <FeatureGateway accent={accent} />
      <DiscoverSection accent={accent} />
      <ContentWorkspaceSection accent={accent} />
      <AgentStudioSection accent={accent} />
      <PipelineSection accent={accent} />
      <ReviewSection accent={accent} />
      <KanbanSection accent={accent} />
      <ClosingCTA accent={accent} onRegister={openRegister} />
      <LandingFooter accent={accent} />

      {authOpen && (
        <AuthModal
          mode={authMode}
          onModeChange={setAuthMode}
          onClose={() => setAuthOpen(false)}
        />
      )}

      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&family=Instrument+Serif&display=swap");
        @keyframes modalIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        @keyframes authBackdropIn {
          from {
            opacity: 0;
            backdrop-filter: blur(0px);
          }
          to {
            opacity: 1;
            backdrop-filter: blur(24px);
          }
        }
        @keyframes authCardIn {
          from {
            opacity: 0;
            transform: translateY(14px) scale(0.96) rotateX(5deg);
            filter: blur(3px);
          }
          62% {
            opacity: 1;
            filter: blur(0);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1) rotateX(0deg);
            filter: blur(0);
          }
        }
      `}</style>
    </div>
  );
}
