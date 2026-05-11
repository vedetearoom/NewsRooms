"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { login } from "@/lib/auth";
import { useTranslation } from "@/hooks/useTranslation";

export type AuthMode = "login" | "register";

type AuthModalProps = {
  mode: AuthMode;
  onClose: () => void;
  onModeChange: (mode: AuthMode) => void;
};

export function AuthModal({ mode, onClose, onModeChange }: AuthModalProps) {
  const router = useRouter();
  const { t } = useTranslation();
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
      setError(err instanceof Error ? err.message : t("landing.auth.failed"));
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-2xl" onClick={onClose} />
      <div className="relative z-10 mx-4 w-full max-w-[380px]" style={{ animation: "modalIn 280ms cubic-bezier(0.16,1,0.3,1) forwards" }}>
        <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-b from-white/[0.08] to-transparent" />
        <div className="relative rounded-2xl border border-white/[0.07] bg-[#111113]/95 p-7 shadow-2xl shadow-black/80">
          <div className="mb-7 flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white">
              <svg className="h-3.5 w-3.5 text-black" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-[14px] font-semibold tracking-tight text-white">Newsroom</span>
          </div>

          <div className="mb-6 inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.03] p-1">
            <button
              type="button"
              onClick={() => onModeChange("login")}
              className={`rounded-full px-3 py-1.5 text-[12px] transition-colors ${
                mode === "login" ? "bg-white font-semibold text-black" : "text-white/45 hover:text-white/75"
              }`}
            >
              {t("landing.auth.loginTab")}
            </button>
            <button
              type="button"
              onClick={() => onModeChange("register")}
              className={`rounded-full px-3 py-1.5 text-[12px] transition-colors ${
                mode === "register" ? "bg-white font-semibold text-black" : "text-white/45 hover:text-white/75"
              }`}
            >
              {t("landing.auth.registerTab")}
            </button>
          </div>

          <h2 className="mb-1 text-[20px] font-bold tracking-tight text-white">
            {mode === "login" ? t("landing.auth.welcomeBack") : t("landing.auth.createAccount")}
          </h2>
          <p className="mb-6 text-[13px] text-white/40">
            {mode === "login" ? t("landing.auth.loginDescription") : t("landing.auth.registerDescription")}
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "register" && (
              <>
                <div>
                  <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-white/30">{t("landing.auth.displayName")}</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder={t("landing.auth.displayNamePlaceholder")}
                    className="w-full rounded-lg border border-white/[0.07] bg-white/[0.04] px-3.5 py-2.5 text-[13px] text-white outline-none transition-all placeholder:text-white/20 focus:border-white/20 focus:bg-white/[0.06]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-white/30">{t("landing.auth.email")}</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder={t("landing.auth.emailPlaceholder")}
                    autoComplete="email"
                    className="w-full rounded-lg border border-white/[0.07] bg-white/[0.04] px-3.5 py-2.5 text-[13px] text-white outline-none transition-all placeholder:text-white/20 focus:border-white/20 focus:bg-white/[0.06]"
                  />
                </div>
              </>
            )}

            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-white/30">{t("landing.auth.username")}</label>
              <input
                ref={inputRef}
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder={t("landing.auth.usernamePlaceholder")}
                autoComplete="username"
                className="w-full rounded-lg border border-white/[0.07] bg-white/[0.04] px-3.5 py-2.5 text-[13px] text-white outline-none transition-all placeholder:text-white/20 focus:border-white/20 focus:bg-white/[0.06]"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-white/30">{t("landing.auth.password")}</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t("landing.auth.passwordPlaceholder")}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="w-full rounded-lg border border-white/[0.07] bg-white/[0.04] px-3.5 py-2.5 text-[13px] text-white outline-none transition-all placeholder:text-white/20 focus:border-white/20 focus:bg-white/[0.06]"
              />
            </div>

            {error && <p className="flex items-center gap-1.5 text-[12px] text-red-400">⚠ {error}</p>}

            <button
              type="submit"
              disabled={loading || !username || !password || (mode === "register" && (!email || !displayName))}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-white py-2.5 text-[13px] font-semibold tracking-tight text-black transition-all hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? (
                <>
                  <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {mode === "login" ? t("landing.auth.signingIn") : t("landing.auth.creatingAccount")}
                </>
              ) : mode === "login" ? (
                t("landing.auth.continue")
              ) : (
                t("landing.auth.create")
              )}
            </button>

            <button
              type="button"
              onClick={() => onModeChange(mode === "login" ? "register" : "login")}
              className="w-full pt-1 text-center text-[12px] text-white/45 transition-colors hover:text-white/75"
            >
              {mode === "login" ? t("landing.auth.needAccount") : t("landing.auth.haveAccount")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
