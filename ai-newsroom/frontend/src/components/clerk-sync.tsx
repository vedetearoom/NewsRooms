"use client";

import { useEffect } from "react";
import { useAuth, useSession } from "@clerk/nextjs";
import { clearAuthTokenCache, registerClerkTokenGetter, fetchClerkToken } from "@/lib/auth";

export function ClerkSync() {
  const { isSignedIn, isLoaded } = useAuth();
  const { session } = useSession();

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn || !session) {
      clearAuthTokenCache();
      registerClerkTokenGetter(null);
      return;
    }

    registerClerkTokenGetter(async (forceRefresh?: boolean) => {
      return session.getToken({ skipCache: forceRefresh });
    });
    fetchClerkToken();
  }, [isLoaded, isSignedIn, session]);

  return null;
}
