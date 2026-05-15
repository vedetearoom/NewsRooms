"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useClerk, useSignIn, useSignUp } from "@clerk/nextjs";
import { useTranslation } from "@/hooks/useTranslation";

export type AuthMode = "login" | "register";

type AuthModalProps = {
  mode: AuthMode;
  onClose: () => void;
  onModeChange: (mode: AuthMode) => void;
  standalone?: boolean;
};

function getClerkErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === "object" && err && "errors" in err) {
    const errors = (err as { errors?: Array<{ longMessage?: string; message?: string }> }).errors;
    const first = errors?.[0];
    if (first?.longMessage) return first.longMessage;
    if (first?.message) return first.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function AuthModal({ mode, onClose, onModeChange, standalone = false }: AuthModalProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const clerk = useClerk();
  const { signIn, setActive: setSignInActive, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setSignUpActive, isLoaded: signUpLoaded } = useSignUp();
  const [username, setUsername] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [oauthLoading, setOauthLoading] = React.useState<AuthMode | null>(null);
  const [showForgotPassword, setShowForgotPassword] = React.useState(false);
  const [resetStep, setResetStep] = React.useState<"email" | "verify" | "success">("email");
  const [resetEmail, setResetEmail] = React.useState("");
  const [resetCode, setResetCode] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [cardHeight, setCardHeight] = React.useState<number | null>(null);
  const [isFlipping, setIsFlipping] = React.useState(false);
  const loginFaceRef = React.useRef<HTMLDivElement>(null);
  const registerFaceRef = React.useRef<HTMLDivElement>(null);
  const loginInputRef = React.useRef<HTMLInputElement>(null);
  const registerInputRef = React.useRef<HTMLInputElement>(null);

  const updateCardHeight = React.useCallback(() => {
    const activeFace = mode === "login" ? loginFaceRef.current : registerFaceRef.current;
    if (activeFace) {
      setCardHeight(activeFace.offsetHeight);
    }
  }, [mode]);

  React.useLayoutEffect(() => {
    updateCardHeight();
  }, [mode, error, loading, oauthLoading, resetStep, updateCardHeight]);

  React.useEffect(() => {
    if (standalone) return;
    const scrollY = window.scrollY;
    const html = document.documentElement;
    const els = [html, document.body];
    for (const el of els) {
      el.style.overflow = "hidden";
    }
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    return () => {
      for (const el of els) {
        el.style.overflow = "";
      }
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollY);
    };
  }, [standalone]);

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (mode === "login") loginInputRef.current?.focus();
      else registerInputRef.current?.focus();
      updateCardHeight();
    });

    const handler = (event: KeyboardEvent) => {
      if (!standalone && event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    window.addEventListener("resize", updateCardHeight);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handler);
      window.removeEventListener("resize", updateCardHeight);
    };
  }, [mode, onClose, standalone, updateCardHeight]);

  const switchMode = (nextMode: AuthMode) => {
    if (nextMode === mode) return;
    setError("");
    setIsFlipping(true);
    window.setTimeout(() => setIsFlipping(false), 620);
    onModeChange(nextMode);
  };

  const finishSignIn = async (
    createdSessionId: string | null | undefined,
    setter: ((params: { session: string }) => Promise<void>) | undefined,
  ) => {
    if (!createdSessionId || !setter) {
      setError(t("landing.auth.failed"));
      setLoading(false);
      return;
    }
    await setter({ session: createdSessionId });
    router.push("/");
  };

  const handleLogin = async () => {
    if (!signInLoaded || !signIn) {
      setLoading(false);
      return;
    }
    const result = await signIn.create({ identifier: username, password });
    if (result.status === "complete") {
      await finishSignIn(result.createdSessionId, setSignInActive);
      return;
    }
    setError("This sign-in requires an additional verification step. Please use the full sign-in page.");
    setLoading(false);
  };

  const handleRegister = async () => {
    await clerk.joinWaitlist({ emailAddress: email });
    setError(t("landing.auth.waitlistSuccess"));
    setLoading(false);
  };

  const handleSubmit = async (event: React.FormEvent, submitMode: AuthMode) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (submitMode === "login") {
        await handleLogin();
      } else {
        await handleRegister();
      }
    } catch (err) {
      setError(getClerkErrorMessage(err, t("landing.auth.failed")));
      setLoading(false);
    }
  };

  const handleGoogle = async (faceMode: AuthMode) => {
    setError("");
    setOauthLoading(faceMode);
    try {
      const redirectUrl = faceMode === "login" ? "/sign-in/sso-callback" : "/sign-up/sso-callback";
      if (faceMode === "login") {
        if (!signInLoaded || !signIn) {
          setOauthLoading(null);
          return;
        }
        await signIn.authenticateWithRedirect({
          strategy: "oauth_google",
          redirectUrl,
          redirectUrlComplete: "/",
        });
      } else {
        if (!signUpLoaded || !signUp) {
          setOauthLoading(null);
          return;
        }
        await signUp.authenticateWithRedirect({
          strategy: "oauth_google",
          redirectUrl,
          redirectUrlComplete: "/",
        });
      }
    } catch (err) {
      setError(getClerkErrorMessage(err, t("landing.auth.failed")));
      setOauthLoading(null);
    }
  };

  const handleForgotPassword = async () => {
    if (!signInLoaded || !signIn) return;
    setError("");
    setLoading(true);
    try {
      const result = await signIn.create({ identifier: resetEmail });
      const resetFactor = result.supportedFirstFactors?.find(
        (factor) => factor.strategy === "reset_password_email_code",
      );

      if (!resetFactor || !("emailAddressId" in resetFactor)) {
        setError(t("landing.auth.resetEmailFailed"));
        setLoading(false);
        return;
      }

      await result.prepareFirstFactor({
        strategy: "reset_password_email_code",
        emailAddressId: resetFactor.emailAddressId,
      });
      setResetStep("verify");
    } catch (err) {
      setError(getClerkErrorMessage(err, t("landing.auth.resetEmailFailed")));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndReset = async () => {
    if (!signInLoaded || !signIn) return;
    setError("");
    setLoading(true);
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code: resetCode,
        password: newPassword,
      });
      if (result.status === "complete") {
        await finishSignIn(result.createdSessionId, setSignInActive);
        return;
      }
      setError(t("landing.auth.resetPasswordFailed"));
      setLoading(false);
    } catch (err) {
      const msg = getClerkErrorMessage(err, t("landing.auth.resetPasswordFailed"));
      if (msg.toLowerCase().includes("password") && !msg.toLowerCase().includes("reset password")) {
        setError(t("landing.auth.passwordTooWeak"));
      } else {
        setError(msg);
      }
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setShowForgotPassword(false);
    setResetStep("email");
    setResetEmail("");
    setResetCode("");
    setNewPassword("");
    setError("");
  };

  const renderHeader = (faceMode: AuthMode) => (
    <>
      <div className="mb-8 flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white">
          <svg className="h-3.5 w-3.5 text-black" fill="currentColor" viewBox="0 0 24 24">
            <path d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <span className="text-[14px] font-semibold tracking-tight text-white">Newsroom</span>
      </div>

      <div className="mb-5 inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.03] p-1">
        <button
          type="button"
          onClick={() => switchMode("login")}
          className={`rounded-full px-3 py-1.5 text-[12px] transition-colors ${
            faceMode === "login" ? "bg-white font-semibold text-black" : "text-white/45 hover:text-white/75"
          }`}
        >
          {t("landing.auth.loginTab")}
        </button>
        <button
          type="button"
          onClick={() => switchMode("register")}
          className={`rounded-full px-3 py-1.5 text-[12px] transition-colors ${
            faceMode === "register" ? "bg-white font-semibold text-black" : "text-white/45 hover:text-white/75"
          }`}
        >
          {t("landing.auth.registerTab")}
        </button>
      </div>

      <h2 className="mb-1 text-[20px] font-bold tracking-tight text-white">
        {faceMode === "login" ? t("landing.auth.welcomeBack") : t("landing.auth.joinWaitlist")}
      </h2>
      <p className="mb-7 text-[13px] text-white/40">
        {faceMode === "login"
          ? t("landing.auth.loginDescription")
          : t("landing.auth.waitlistDescription")}
      </p>
    </>
  );

  const renderGoogleButton = (faceMode: AuthMode) => (
    <button
      type="button"
      onClick={() => handleGoogle(faceMode)}
      disabled={Boolean(oauthLoading) || loading}
      tabIndex={mode === faceMode ? 0 : -1}
      className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.04] px-3.5 py-3 text-[13px] font-semibold tracking-tight text-white transition-all hover:-translate-y-px hover:border-white/15 hover:bg-white/[0.07] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
      {oauthLoading === faceMode ? t("landing.auth.connecting") : t("landing.auth.googleContinue")}
    </button>
  );

  const renderForm = (faceMode: AuthMode) => {
    if (faceMode === "login" && showForgotPassword) {
      const inputClass = "w-full rounded-lg border border-white/[0.07] bg-white/[0.04] px-3.5 py-3 text-[13px] text-white outline-none transition-all placeholder:text-white/20 focus:border-white/20 focus:bg-white/[0.06] focus:shadow-[0_0_0_1px_rgba(255,255,255,0.1)]";
      const labelClass = "mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-white/35";

      return (
        <div className="space-y-4">
          {resetStep === "email" && (
            <>
              <p className="text-[13px] text-white/40">
                {t("landing.auth.resetPasswordDescription")}
              </p>
              <div>
                <label className={labelClass}>{t("landing.auth.email")}</label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(event) => setResetEmail(event.target.value)}
                  placeholder={t("landing.auth.emailPlaceholder")}
                  autoComplete="email"
                  className={inputClass}
                />
              </div>
              {error ? (
                <p className="rounded-xl bg-red-500/10 px-3 py-2.5 text-[12px] leading-relaxed text-red-400">{error}</p>
              ) : null}
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={loading || !resetEmail}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-[13px] font-semibold tracking-tight text-black transition-all hover:-translate-y-px hover:bg-white/90 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? (
                  <><svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>{t("landing.auth.connecting")}</>
                ) : t("landing.auth.sendCode")}
              </button>
              <button type="button" onClick={handleBackToLogin} className="w-full text-center text-[13px] text-white/40 transition-colors hover:text-white/75">
                {t("landing.auth.backToLogin")}
              </button>
            </>
          )}

          {resetStep === "verify" && (
            <>
              <p className="text-[13px] text-white/40">
                {t("landing.auth.verifyCodeDescription")}
              </p>
              <div>
                <label className={labelClass}>{t("landing.auth.verificationCode")}</label>
                <input
                  type="text"
                  value={resetCode}
                  onChange={(event) => setResetCode(event.target.value)}
                  placeholder="000000"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={6}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>{t("landing.auth.newPassword")}</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder={t("landing.auth.passwordPlaceholder")}
                  autoComplete="new-password"
                  className={inputClass}
                />
              </div>
              {error ? (
                <p className="rounded-xl bg-red-500/10 px-3 py-2.5 text-[12px] leading-relaxed text-red-400">{error}</p>
              ) : null}
              <button
                type="button"
                onClick={handleVerifyAndReset}
                disabled={loading || !resetCode || !newPassword}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-[13px] font-semibold tracking-tight text-black transition-all hover:-translate-y-px hover:bg-white/90 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? (
                  <><svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>{t("landing.auth.connecting")}</>
                ) : t("landing.auth.resetPassword")}
              </button>
              <button type="button" onClick={handleBackToLogin} className="w-full text-center text-[13px] text-white/40 transition-colors hover:text-white/75">
                {t("landing.auth.backToLogin")}
              </button>
            </>
          )}

          {resetStep === "success" && (
            <>
              <p className="rounded-xl bg-emerald-500/10 px-3 py-2.5 text-[12px] leading-relaxed text-emerald-400">
                {t("landing.auth.resetSuccess")}
              </p>
              <button type="button" onClick={handleBackToLogin} className="w-full text-center text-[13px] text-white/40 transition-colors hover:text-white/75">
                {t("landing.auth.backToLogin")}
              </button>
            </>
          )}
        </div>
      );
    }

    return (
    <form onSubmit={(event) => handleSubmit(event, faceMode)} className="space-y-4">
      {faceMode === "login" ? renderGoogleButton(faceMode) : null}

      {faceMode === "login" ? (
        <div className="flex items-center gap-3 py-1">
          <div className="h-px flex-1 bg-white/[0.08]" />
          <span className="text-[11px] text-white/30">or</span>
          <div className="h-px flex-1 bg-white/[0.08]" />
        </div>
      ) : null}

      {faceMode === "login" ? (
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-white/35">
            {t("landing.auth.username")}
          </label>
          <input
            ref={loginInputRef}
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder={t("landing.auth.usernamePlaceholder")}
            autoComplete="username"
            tabIndex={mode === faceMode ? 0 : -1}
            className="w-full rounded-lg border border-white/[0.07] bg-white/[0.04] px-3.5 py-3 text-[13px] text-white outline-none transition-all placeholder:text-white/20 focus:border-white/20 focus:bg-white/[0.06] focus:shadow-[0_0_0_1px_rgba(255,255,255,0.1)]"
          />
        </div>
      ) : null}

      {faceMode === "register" ? (
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-white/35">
            {t("landing.auth.email")}
          </label>
          <input
            ref={registerInputRef}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t("landing.auth.emailPlaceholder")}
            autoComplete="email"
            tabIndex={mode === faceMode ? 0 : -1}
            className="w-full rounded-lg border border-white/[0.07] bg-white/[0.04] px-3.5 py-3 text-[13px] text-white outline-none transition-all placeholder:text-white/20 focus:border-white/20 focus:bg-white/[0.06] focus:shadow-[0_0_0_1px_rgba(255,255,255,0.1)]"
          />
        </div>
      ) : null}

      {faceMode === "login" ? (
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-white/35">
            {t("landing.auth.password")}
          </label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t("landing.auth.passwordPlaceholder")}
            autoComplete="current-password"
            tabIndex={mode === faceMode ? 0 : -1}
            className="w-full rounded-lg border border-white/[0.07] bg-white/[0.04] px-3.5 py-3 text-[13px] text-white outline-none transition-all placeholder:text-white/20 focus:border-white/20 focus:bg-white/[0.06] focus:shadow-[0_0_0_1px_rgba(255,255,255,0.1)]"
          />
          <button
            type="button"
            onClick={() => setShowForgotPassword(true)}
            tabIndex={mode === faceMode ? 0 : -1}
            className="mt-2 text-[11px] text-white/35 transition-colors hover:text-white/65"
          >
            {t("landing.auth.forgotPassword")}
          </button>
        </div>
      ) : null}

      {mode === faceMode && error ? (
        <p className={`rounded-xl px-3 py-2.5 text-[12px] leading-relaxed ${error === t("landing.auth.waitlistSuccess") ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading || (faceMode === "login" ? !username || !password : !email)}
        tabIndex={mode === faceMode ? 0 : -1}
        className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-[13px] font-semibold tracking-tight text-black transition-all hover:-translate-y-px hover:bg-white/90 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading && mode === faceMode ? (
          <>
            <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {faceMode === "login" ? t("landing.auth.signingIn") : t("landing.auth.creatingAccount")}
          </>
        ) : faceMode === "login" ? (
          t("landing.auth.continue")
        ) : (
          t("landing.auth.joinWaitlist")
        )}
      </button>

      <button
        type="button"
        onClick={() => switchMode(faceMode === "login" ? "register" : "login")}
        tabIndex={mode === faceMode ? 0 : -1}
        className="mt-1 w-full text-center text-[13px] text-white/40 transition-colors hover:text-white/75"
      >
        {faceMode === "login" ? t("landing.auth.needAccount") : t("landing.auth.haveAccount")}
      </button>
    </form>
    );
  };

  const renderFace = (faceMode: AuthMode, ref: React.RefObject<HTMLDivElement | null>) => (
    <div
      ref={ref}
      aria-hidden={mode !== faceMode}
      className="absolute inset-x-0 top-0 overflow-hidden rounded-2xl border border-white/[0.09] bg-[#101012]/95 p-8 shadow-[0_24px_80px_-34px_rgba(0,0,0,0.95),0_1px_0_rgba(255,255,255,0.05)_inset] [backface-visibility:hidden]"
      style={{
        transform: faceMode === "register" ? "rotateY(180deg)" : "rotateY(0deg)",
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
          transform: isFlipping ? "translateX(360%) rotate(12deg)" : "translateX(-40%) rotate(12deg)",
        }}
      />
      <div className="relative">
        {renderHeader(faceMode)}
        {renderForm(faceMode)}
      </div>
    </div>
  );

  const card = (
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
  );

  if (standalone) {
    return (
      <div className="w-full max-w-[400px]" style={{ animation: "authCardIn 360ms cubic-bezier(0.16,1,0.3,1) forwards" }}>
        {card}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto px-4 pb-[6vh] pt-[8vh]">
      <div
        className="absolute inset-0 bg-black/70 opacity-100 backdrop-blur-2xl"
        style={{ animation: "authBackdropIn 320ms ease-out forwards" }}
        onClick={onClose}
      />
      <div
        className="relative z-10 w-full max-w-[400px] self-start"
        style={{
          animation: "authCardIn 360ms cubic-bezier(0.16,1,0.3,1) forwards",
          transformOrigin: "50% 28%",
        }}
      >
        {card}
      </div>
    </div>
  );
}
