"use client";

import {
  useAuth as clerkUseAuth,
  useClerk as clerkUseClerk,
  useSession as clerkUseSession,
} from "@clerk/nextjs";

function hasClerkKey() {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
}

export function useClerkSafe(): ReturnType<typeof clerkUseClerk> | null {
  if (!hasClerkKey()) return null;
  return clerkUseClerk();
}

export function useAuthSafe(): ReturnType<typeof clerkUseAuth> {
  if (!hasClerkKey()) {
    return { isSignedIn: false, isLoaded: true } as ReturnType<typeof clerkUseAuth>;
  }
  return clerkUseAuth();
}

export function useSessionSafe(): ReturnType<typeof clerkUseSession> {
  if (!hasClerkKey()) {
    return { session: null } as ReturnType<typeof clerkUseSession>;
  }
  return clerkUseSession();
}
