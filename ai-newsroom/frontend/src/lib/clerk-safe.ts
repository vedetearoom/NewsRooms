"use client";

import {
  useAuth as clerkUseAuth,
  useClerk as clerkUseClerk,
  useSession as clerkUseSession,
} from "@clerk/nextjs";

const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export function useClerkSafe(): ReturnType<typeof clerkUseClerk> | null {
  if (!clerkKey) return null;
  return clerkUseClerk();
}

export function useAuthSafe(): ReturnType<typeof clerkUseAuth> {
  if (!clerkKey) {
    return { isSignedIn: false, isLoaded: true } as ReturnType<typeof clerkUseAuth>;
  }
  return clerkUseAuth();
}

export function useSessionSafe(): ReturnType<typeof clerkUseSession> {
  if (!clerkKey) {
    return { session: null } as ReturnType<typeof clerkUseSession>;
  }
  return clerkUseSession();
}
