"use client";

import { useEffect } from "react";
import { useAuthSafe, useSessionSafe } from "@/lib/clerk-safe";
import { clearAuthTokenCache, clearLocalAuthStorage, getLocalAuthToken, registerClerkTokenGetter, fetchClerkToken } from "@/lib/auth";

export function ClerkSync() {
  const { isSignedIn, isLoaded } = useAuthSafe();
  const { session } = useSessionSafe();

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn || !session) {
      if (!getLocalAuthToken()) {
        clearAuthTokenCache();
      }
      registerClerkTokenGetter(null);
      return;
    }

    if (getLocalAuthToken()) {
      clearLocalAuthStorage();
    }
    registerClerkTokenGetter(async (forceRefresh?: boolean) => {
      return session.getToken({ skipCache: forceRefresh });
    });
    fetchClerkToken();
  }, [isLoaded, isSignedIn, session]);

  return null;
}
