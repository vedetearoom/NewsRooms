"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { getAuthToken, hasPermission, isAuthenticated, logout, updateStoredUser } from "@/lib/auth";

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
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (pathname?.startsWith("/landing")) {
        setReady(true);
        return;
      }

      if (!isAuthenticated() || !getAuthToken()) {
        router.replace("/landing");
        return;
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
        logout();
        if (!cancelled) {
          router.replace("/landing");
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  React.useEffect(() => {
    if (pathname?.startsWith("/landing")) {
      setReady(true);
    }
  }, [pathname]);

  if (!ready) {
    return null;
  }

  return <>{children}</>;
}
