"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth, useClerk } from "@clerk/nextjs";
import { api } from "@/lib/api";
import { getAuthToken, hasPermission, updateStoredUser } from "@/lib/auth";

function getRouteRequirement(pathname: string | null): string | null {
  if (!pathname || pathname.startsWith("/landing")) return null;
  if (pathname === "/" || pathname.startsWith("/?")) return "discover.view";
  if (pathname.startsWith("/vault")) return "workspace.view";
  if (pathname.startsWith("/inbox") || pathname.startsWith("/sources")) return "network.view";
  if (pathname.startsWith("/agents")) return "agents.view";
  if (pathname.startsWith("/system")) return "system.manage";
  return null;
}

function getFallbackPath(permissions: string[]): string {
  if (permissions.includes("discover.view")) return "/";
  if (permissions.includes("workspace.view")) return "/vault";
  if (permissions.includes("network.view")) return "/inbox";
  if (permissions.includes("agents.view")) return "/agents";
  return "/landing";
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isSignedIn, isLoaded } = useAuth();
  const clerk = useClerk();
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // Public pages — no auth required
      if (pathname?.startsWith("/landing") || pathname?.startsWith("/sign-in") || pathname?.startsWith("/sign-up")) {
        setReady(true);
        return;
      }

      // Wait for Clerk to initialize
      if (!isLoaded) return;

      // Not signed in via Clerk
      if (!isSignedIn) {
        router.replace("/landing");
        return;
      }

      // Signed in via Clerk but no cached token yet (race condition on first load)
      if (!getAuthToken()) {
        // Poll briefly for ClerkSync to populate the token cache
        for (let i = 0; i < 20; i++) {
          await new Promise((r) => setTimeout(r, 50));
          if (getAuthToken()) break;
        }
      }

      try {
        const user = await api.auth.me();
        if (!cancelled) {
          updateStoredUser(user);
          const requiredPermission = getRouteRequirement(pathname);
          if (requiredPermission && !hasPermission(user, requiredPermission)) {
            router.replace(getFallbackPath(user.permissions));
            return;
          }
          setReady(true);
        }
      } catch {
        if (!cancelled) {
          await clerk.signOut();
          router.replace("/landing");
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [pathname, router, isLoaded, isSignedIn, clerk]);

  React.useEffect(() => {
    if (pathname?.startsWith("/landing") || pathname?.startsWith("/sign-in") || pathname?.startsWith("/sign-up")) {
      setReady(true);
    }
  }, [pathname]);

  if (!ready) {
    return null;
  }

  return <>{children}</>;
}
