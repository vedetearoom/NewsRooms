"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { AuthGuard } from "@/components/auth-guard";
import { ClerkSync } from "@/components/clerk-sync";

function getClerkKey() {
  return process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
}

export function Providers({ children }: { children: React.ReactNode }) {
  const clerkKey = getClerkKey();
  if (!clerkKey) return <>{children}</>;

  return (
    <ClerkProvider publishableKey={clerkKey}>
      <ClerkSync />
      <AuthGuard>{children}</AuthGuard>
    </ClerkProvider>
  );
}
