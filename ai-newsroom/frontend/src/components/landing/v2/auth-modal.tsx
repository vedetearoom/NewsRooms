"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [cardHeight, setCardHeight] = React.useState<number | null>(null);
  const [isFlipping, setIsFlipping] = React.useState(false);
  const loginFaceRef = React.useRef<HTMLDivElement>(null);
  const registerFaceRef = React.useRef<HTMLDivElement>(null);
  const loginInputRef = React.useRef<HTMLInputElement>(null);
  const registerInputRef = React.useRef<HTMLInputElement>(null);

  const updateCardHeight = React.useCallback(() => {
    const activeFace =
      mode === "login" ? loginFaceRef.current : registerFaceRef.current;
    if (activeFace) {
      setCardHeight(activeFace.offsetHeight);
    }
  }, [mode]);

  React.useLayoutEffect(() => {
    updateCardHeight();
  }, [mode, error, updateCardHeight]);

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (mode === "login") loginInputRef.current?.focus();
      else registerInputRef.current?.focus();
      updateCardHeight();
    });

    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    window.addEventListener("resize", updateCardHeight);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handler);
      window.removeEventListener("resize", updateCardHeight);
    };
  }, [mode, onClose, updateCardHeight]);

  const switchMode = (nextMode: AuthMode) => {
    if (nextMode === mode) return;
    setError("");
    setIsFlipping(true);
    window.setTimeout(() => setIsFlipping(false), 620);
    onModeChange(nextMode);
  };

  const handleSubmit = async (event: React.FormEvent, submitMode: AuthMode) => {
    event.preventDefault();
    // Redirect to Clerk's hosted sign-in/sign-up pages
    if (submitMode === "login") {
      router.push("/sign-in");
    } else {
      router.push("/sign-up");
    }
  };

  const renderHeader = (faceMode: AuthMode) => (
    <>
      <div className="mb-7 flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white">
          <svg
            className="h-3.5 w-3.5 text-black"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <span className="text-[14px] font-semibold tracking-tight text-white">
          Newsroom
        </span>
      </div>

      <div className="mb-6 inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.03] p-1">
        <button
          type="button"
          onClick={() => switchMode("login")}
          className={`rounded-full px-3 py-1.5 text-[12px] transition-colors ${
            faceMode === "login"
              ? "bg-white font-semibold text-black"
              : "text-white/45 hover:text-white/75"
          }`}
        >
          {t("landing.auth.loginTab")}
        </button>
        <button
          type="button"
          onClick={() => switchMode("register")}
          className={`rounded-full px-3 py-1.5 text-[12px] transition-colors ${
            faceMode === "register"
              ? "bg-white font-semibold text-black"
              : "text-white/45 hover:text-white/75"
          }`}
        >
          {t("landing.auth.registerTab")}
        </button>
      </div>

      <h2 className="mb-1 text-[20px] font-bold tracking-tight text-white">
        {faceMode === "login"
          ? t("landing.auth.welcomeBack")
          : t("landing.auth.createAccount")}
      </h2>
      <p className="mb-6 text-[13px] text-white/40">
        {faceMode === "login"
          ? t("landing.auth.loginDescription")
          : t("landing.auth.registerDescription")}
      </p>
    </>
  );

  const renderForm = (faceMode: AuthMode) => (
    <form
      onSubmit={(event) => handleSubmit(event, faceMode)}
      className="space-y-3"
    >
      <div>
        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-white/30">
          {t("landing.auth.username")}
        </label>
        <input
          ref={faceMode === "login" ? loginInputRef : registerInputRef}
          type="text"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder={t("landing.auth.usernamePlaceholder")}
          autoComplete="username"
          tabIndex={mode === faceMode ? 0 : -1}
          className="w-full rounded-lg border border-white/[0.07] bg-white/[0.04] px-3.5 py-2.5 text-[13px] text-white outline-none transition-all placeholder:text-white/20 focus:border-white/20 focus:bg-white/[0.06]"
        />
      </div>

      {faceMode === "register" ? (
        <div>
          <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-white/30">
            {t("landing.auth.email")}
          </label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t("landing.auth.emailPlaceholder")}
            autoComplete="email"
            tabIndex={mode === faceMode ? 0 : -1}
            className="w-full rounded-lg border border-white/[0.07] bg-white/[0.04] px-3.5 py-2.5 text-[13px] text-white outline-none transition-all placeholder:text-white/20 focus:border-white/20 focus:bg-white/[0.06]"
          />
        </div>
      ) : null}

      <div>
        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-white/30">
          {t("landing.auth.password")}
        </label>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={t("landing.auth.passwordPlaceholder")}
          autoComplete={
            faceMode === "login" ? "current-password" : "new-password"
          }
          tabIndex={mode === faceMode ? 0 : -1}
          className="w-full rounded-lg border border-white/[0.07] bg-white/[0.04] px-3.5 py-2.5 text-[13px] text-white outline-none transition-all placeholder:text-white/20 focus:border-white/20 focus:bg-white/[0.06]"
        />
      </div>

      {mode === faceMode && error ? (
        <p className="flex items-center gap-1.5 text-[12px] text-red-400">
          ⚠ {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={
          loading ||
          !username ||
          !password ||
          (faceMode === "register" && !email)
        }
        tabIndex={mode === faceMode ? 0 : -1}
        className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-white py-2.5 text-[13px] font-semibold tracking-tight text-black transition-all hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading && mode === faceMode ? (
          <>
            <svg
              className="h-3.5 w-3.5 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            {faceMode === "login"
              ? t("landing.auth.signingIn")
              : t("landing.auth.creatingAccount")}
          </>
        ) : faceMode === "login" ? (
          t("landing.auth.continue")
        ) : (
          t("landing.auth.create")
        )}
      </button>

      <button
        type="button"
        onClick={() => switchMode(faceMode === "login" ? "register" : "login")}
        tabIndex={mode === faceMode ? 0 : -1}
        className="w-full text-center text-[12px] text-white/45 transition-colors hover:text-white/75"
      >
        {faceMode === "login"
          ? t("landing.auth.needAccount")
          : t("landing.auth.haveAccount")}
      </button>
    </form>
  );

  const renderFace = (
    faceMode: AuthMode,
    ref: React.RefObject<HTMLDivElement | null>,
  ) => (
    <div
      ref={ref}
      aria-hidden={mode !== faceMode}
      className="absolute inset-x-0 top-0 overflow-hidden rounded-2xl border border-white/[0.09] bg-[#101012]/95 p-7 shadow-[0_24px_80px_-34px_rgba(0,0,0,0.95),0_1px_0_rgba(255,255,255,0.05)_inset] [backface-visibility:hidden]"
      style={{
        transform:
          faceMode === "register" ? "rotateY(180deg)" : "rotateY(0deg)",
        background:
          faceMode === "login"
            ? "radial-gradient(circle at 16% 10%, rgba(255,255,255,0.08), transparent 30%), linear-gradient(145deg, rgba(24,24,27,0.98), rgba(12,12,14,0.97))"
            : "radial-gradient(circle at 84% 12%, rgba(255,255,255,0.075), transparent 32%), linear-gradient(145deg, rgba(18,18,21,0.98), rgba(10,10,12,0.97))",
      }}
    >
      <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-b from-white/[0.12] via-white/[0.025] to-transparent" />
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_50%_-15%,rgba(255,255,255,0.12),transparent_34%)] opacity-70" />
      <div
        className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 rotate-12 bg-gradient-to-r from-transparent via-white/[0.11] to-transparent blur-[1px] transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          transform: isFlipping
            ? "translateX(360%) rotate(12deg)"
            : "translateX(-40%) rotate(12deg)",
        }}
      />
      <div className="relative">
        {renderHeader(faceMode)}
        {renderForm(faceMode)}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto px-4 pb-[8vh] pt-[12vh]">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-2xl"
        style={{ animation: "authBackdropIn 320ms ease-out forwards" }}
        onClick={onClose}
      />
      <div
        className="relative z-10 w-full max-w-[380px] self-start"
        style={{
          animation: "authCardIn 360ms cubic-bezier(0.16,1,0.3,1) forwards",
          transformOrigin: "50% 28%",
        }}
      >
        <div
          className="relative [perspective:1400px]"
          style={{
            height: cardHeight ?? undefined,
            transition: "height 420ms cubic-bezier(0.2,0.8,0.2,1)",
            filter: isFlipping
              ? "drop-shadow(0 18px 54px rgba(0,0,0,0.72))"
              : "drop-shadow(0 28px 72px rgba(0,0,0,0.58))",
          }}
        >
          <div
            className="relative h-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] [transform-style:preserve-3d]"
            style={{
              transform: `${mode === "register" ? "rotateY(180deg)" : "rotateY(0deg)"} ${isFlipping ? "scale(0.985)" : "scale(1)"}`,
            }}
          >
            {renderFace("login", loginFaceRef)}
            {renderFace("register", registerFaceRef)}
          </div>
        </div>
      </div>
    </div>
  );
}
