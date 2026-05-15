"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthSafe, useClerkSafe } from "@/lib/clerk-safe";
import { fetchAndCacheMeUser, hasPermission } from "@/lib/auth";

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
  const { isSignedIn, isLoaded } = useAuthSafe();
  const clerk = useClerkSafe();
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

      try {
        const user = await fetchAndCacheMeUser({ throwOnError: true });
        if (!user) return;
        if (!cancelled) {
          const requiredPermission = getRouteRequirement(pathname);
          if (requiredPermission && !hasPermission(user, requiredPermission)) {
            router.replace(getFallbackPath(user.permissions));
            return;
          }
          setReady(true);
        }
      } catch {
        if (!cancelled) {
          if (clerk) await clerk.signOut();
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
