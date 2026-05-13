"use client";

import { useEffect } from "react";
import { useAuth, useSession } from "@clerk/nextjs";
import { registerClerkTokenGetter, fetchClerkToken } from "@/lib/auth";

export function ClerkSync() {
  const { isSignedIn } = useAuth();
  const { session } = useSession();

  useEffect(() => {
    if (isSignedIn && session) {
      registerClerkTokenGetter(async () => {
        const token = await session.getToken();
        return token;
      });
      // Immediately populate the cache so getAuthToken() returns a value
      fetchClerkToken();
    }
  }, [isSignedIn, session]);

  return null;
}
