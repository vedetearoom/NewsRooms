"use client";

import { AuthModal, type AuthMode } from "@/components/landing/v2/auth-modal";

export default function SignUpPage() {
  const handleModeChange = (mode: AuthMode) => {
    if (mode === "login") {
      window.location.href = "/sign-in";
    }
  };

  return (
    <AuthModal
      mode="register"
      onClose={() => (window.location.href = "/landing")}
      onModeChange={handleModeChange}
      standalone
    />
  );
}
