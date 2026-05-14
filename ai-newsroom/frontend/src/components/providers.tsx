"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { AuthGuard } from "@/components/auth-guard";
import { ClerkSync } from "@/components/clerk-sync";

const clerkKey =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "pk_test_dummy";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider publishableKey={clerkKey}>
      <ClerkSync />
      <AuthGuard>{children}</AuthGuard>
    </ClerkProvider>
  );
}
