"use client";

import { AuthModal, type AuthMode } from "@/components/landing/v2/auth-modal";

export default function SignInPage() {
  const handleModeChange = (mode: AuthMode) => {
    if (mode === "register") {
      window.location.href = "/sign-up";
    }
  };

  return (
    <AuthModal
      mode="login"
      onClose={() => (window.location.href = "/landing")}
      onModeChange={handleModeChange}
      standalone
    />
  );
}
