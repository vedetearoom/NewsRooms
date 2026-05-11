"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { HeroV2 } from "@/components/landing/v2/hero-v2";
import { ScaledHero } from "@/components/landing/v2/scaled-hero";
import {
  AgentStudioSection,
  ClosingCTA,
  DiscoverSection,
  KanbanSection,
  LandingFooter,
  MetricsStrip,
  PipelineSection,
  ReviewSection,
} from "@/components/landing/v2/sections";
import { api } from "@/lib/api";
import { isAuthenticated, login } from "@/lib/auth";

type AuthMode = "login" | "register";

function AuthModal({
  mode,
  onClose,
  onModeChange,
}: {
  mode: AuthMode;
  onClose: () => void;
  onModeChange: (mode: AuthMode) => void;
}) {
  const router = useRouter();
  const [username, setUsername] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const session =
        mode === "login"
          ? await api.auth.login({ username, password })
          : await api.auth.register({
              username,
              email,
              display_name: displayName,
              password,
            });

      login(session);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-2xl" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-[380px] mx-4"
        style={{ animation: "modalIn 280ms cubic-bezier(0.16,1,0.3,1) forwards" }}
      >
        <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-white/[0.08] to-transparent pointer-events-none" />
        <div className="relative bg-[#111113]/95 border border-white/[0.07] rounded-2xl p-7 shadow-2xl shadow-black/80">
          <div className="flex items-center gap-2.5 mb-7">
            <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-black" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-[14px] font-semibold text-white tracking-tight">Newsroom</span>
          </div>

          <div className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.03] p-1 mb-6">
            <button
              type="button"
              onClick={() => onModeChange("login")}
              className={`rounded-full px-3 py-1.5 text-[12px] transition-colors ${
                mode === "login" ? "bg-white text-black font-semibold" : "text-white/45 hover:text-white/75"
              }`}
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => onModeChange("register")}
              className={`rounded-full px-3 py-1.5 text-[12px] transition-colors ${
                mode === "register" ? "bg-white text-black font-semibold" : "text-white/45 hover:text-white/75"
              }`}
            >
              Register
            </button>
          </div>

          <h2 className="text-[20px] font-bold text-white tracking-tight mb-1">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h2>
          <p className="text-[13px] text-white/40 mb-6">
            {mode === "login"
              ? "Sign in to your intelligence editorial dashboard."
              : "Register a new workspace identity for Newsroom."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "register" && (
              <>
                <div>
                  <label className="block text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-1.5">
                    Display name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Jay"
                    className="w-full bg-white/[0.04] border border-white/[0.07] rounded-lg px-3.5 py-2.5 text-[13px] text-white placeholder:text-white/20 outline-none focus:border-white/20 focus:bg-white/[0.06] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@newsroom.ai"
                    autoComplete="email"
                    className="w-full bg-white/[0.04] border border-white/[0.07] rounded-lg px-3.5 py-2.5 text-[13px] text-white placeholder:text-white/20 outline-none focus:border-white/20 focus:bg-white/[0.06] transition-all"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-1.5">
                Username
              </label>
              <input
                ref={inputRef}
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="admin"
                autoComplete="username"
                className="w-full bg-white/[0.04] border border-white/[0.07] rounded-lg px-3.5 py-2.5 text-[13px] text-white placeholder:text-white/20 outline-none focus:border-white/20 focus:bg-white/[0.06] transition-all"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••"
                autoComplete="current-password"
                className="w-full bg-white/[0.04] border border-white/[0.07] rounded-lg px-3.5 py-2.5 text-[13px] text-white placeholder:text-white/20 outline-none focus:border-white/20 focus:bg-white/[0.06] transition-all"
              />
            </div>

            {error && (
              <p className="text-[12px] text-red-400 flex items-center gap-1.5">
                <span>⚠</span> {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !username || !password || (mode === "register" && (!email || !displayName))}
              className="w-full mt-1 bg-white text-black rounded-lg py-2.5 text-[13px] font-semibold tracking-tight hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {mode === "login" ? "Signing in..." : "Creating account..."}
                </>
              ) : mode === "login" ? (
                "Continue →"
              ) : (
                "Create account →"
              )}
            </button>

            <button
              type="button"
              onClick={() => onModeChange(mode === "login" ? "register" : "login")}
              className="w-full text-center text-[12px] text-white/45 hover:text-white/75 transition-colors pt-1"
            >
              {mode === "login" ? "Need an account? Register" : "Already have an account? Log in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const [authOpen, setAuthOpen] = React.useState(false);
  const [authMode, setAuthMode] = React.useState<AuthMode>("login");
  const accent = "#c0c0dd";

  React.useEffect(() => {
    if (isAuthenticated()) {
      router.replace("/");
    }
  }, [router]);

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
      <DiscoverSection accent={accent} />
      <AgentStudioSection accent={accent} />
      <PipelineSection accent={accent} />
      <ReviewSection accent={accent} />
      <KanbanSection accent={accent} />
      <ClosingCTA accent={accent} onRegister={openRegister} />
      <LandingFooter accent={accent} />

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
