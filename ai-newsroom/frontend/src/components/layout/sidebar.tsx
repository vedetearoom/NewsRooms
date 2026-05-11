"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthState } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import { useTabsStore } from "@/store/tabs";
import { SidebarFooter } from "./sidebar-footer";

type TranslationFn = (key: string) => string;

const getNavItems = (t: TranslationFn) => [
  {
    label: t('sidebar.inbox'),
    href: "/",
    permission: "discover.view",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
      </svg>
    ),
  },
  {
    label: t('sidebar.vault'),
    href: "/vault",
    permission: "workspace.view",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    subItems: [
      { label: t('sidebar.editorialPipeline'), href: "/vault" },
      { label: t('sidebar.inspirationVault'), href: "/vault/inspirations" },
      { label: t('sidebar.knowledgeBase'), href: "/vault/library" }
    ]
  },
  {
    label: t('sidebar.sources'),
    href: "/sources",
    permission: "network.view",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
    subItems: [
      { label: t('sidebar.intelligenceInbox'), href: "/inbox" },
      { label: t('sidebar.sourceConfig'), href: "/sources" }
    ]
  },
  {
    label: t('sidebar.agentStudio'),
    href: "/agents",
    permission: "agents.view",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation();
  const tabs = useTabsStore();
  const auth = useAuthState();
  const canViewDiscover = auth.hasPermission("discover.view");
  const canViewWorkspace = auth.hasPermission("workspace.view");
  const canViewNetwork = auth.hasPermission("network.view");
  const canViewAgents = auth.hasPermission("agents.view");
  const canManageSystem = auth.hasPermission("system.manage");

  const getHrefWithParams = React.useCallback((href: string) => {
    if (href === "/") {
      const params = new URLSearchParams();
      if (tabs.discoverContentTab !== "article") params.set("type", tabs.discoverContentTab);
      if (tabs.discoverTimeTab !== "today") params.set("time", tabs.discoverTimeTab);
      const qs = params.toString();
      return qs ? `${href}?${qs}` : href;
    }
    if (href === "/inbox") {
      const params = new URLSearchParams();
      if (tabs.inboxTab !== "text") params.set("tab", tabs.inboxTab);
      
      if (tabs.inboxTab === "text" || !tabs.inboxTab) {
        if (tabs.inboxTextSourceId !== null) params.set("t_source", String(tabs.inboxTextSourceId));
      } else {
        if (tabs.inboxVideoSourceId !== null) params.set("v_source", String(tabs.inboxVideoSourceId));
      }
      
      const qs = params.toString();
      return qs ? `${href}?${qs}` : href;
    }
    if (href === "/sources") {
      const params = new URLSearchParams();
      if (tabs.sourcesTab !== "text") params.set("tab", tabs.sourcesTab);
      const qs = params.toString();
      return qs ? `${href}?${qs}` : href;
    }
    if (href === "/vault/inspirations") {
      const params = new URLSearchParams();
      if (tabs.vaultDetailTab !== "summary") params.set("tab", tabs.vaultDetailTab);
      if (tabs.vaultInspirationId !== null) params.set("id", String(tabs.vaultInspirationId));
      const qs = params.toString();
      return qs ? `${href}?${qs}` : href;
    }
    if (href === "/agents") {
      const params = new URLSearchParams();
      if (tabs.agentsActiveId !== null) params.set("id", String(tabs.agentsActiveId));
      const qs = params.toString();
      return qs ? `${href}?${qs}` : href;
    }
    return href;
  }, [tabs]);

  const NAV_ITEMS = React.useMemo(() => {
    const permissionMap: Record<string, boolean> = {
      "discover.view": canViewDiscover,
      "workspace.view": canViewWorkspace,
      "network.view": canViewNetwork,
      "agents.view": canViewAgents,
    };
    const items = getNavItems(t).filter((item) => permissionMap[item.permission]);
    if (canManageSystem) {
      items.push({
        label: t("sidebar.system"),
        href: "/system",
        permission: "system.manage",
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M12 3l7 4v10l-7 4-7-4V7l7-4z" />
            <path d="M12 8v8" />
            <path d="M8.5 10l7 4" />
            <path d="M15.5 10l-7 4" />
          </svg>
        ),
        subItems: [
          { label: t("sidebar.userManagement"), href: "/system/users" },
          { label: t("sidebar.roleManagement"), href: "/system/roles" },
          { label: t("sidebar.serverManagement"), href: "/system/server" },
        ],
      });
    }
    return items;
  }, [canManageSystem, canViewAgents, canViewDiscover, canViewNetwork, canViewWorkspace, t]);
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    getNavItems(t).forEach(it => {
      if (it.subItems) initial[it.href] = true;
    });
    return initial;
  });

  React.useEffect(() => {
    setExpanded((prev) => {
      let changed = false;
      const next = { ...prev };
      NAV_ITEMS.forEach((item) => {
        if (item.subItems && next[item.href] === undefined) {
          next[item.href] = true;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [NAV_ITEMS]);

  if (pathname.startsWith("/editor") || pathname.startsWith("/landing")) return null;

  return (
    <aside className="w-[220px] min-w-[220px] h-screen sticky top-0 flex flex-col bg-[var(--sidebar-bg)]">
      {/* Logo */}
      <div className="px-5 h-[52px] flex items-center gap-2">
        <div className="w-[22px] h-[22px] rounded-md bg-[var(--logo-bg)] flex items-center justify-center">
          <svg className="w-3 h-3 text-[var(--logo-color)]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <span className="text-[13px] font-semibold tracking-[-0.02em] text-foreground">Newsroom</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-1">
        <div className="flex flex-col gap-5">
          {NAV_ITEMS.map((item) => {
            const isParentActive = pathname.startsWith(item.href) && (item.href !== "/" || pathname === "/");
            const isExactActive = pathname === item.href;
            
            return (
              <div key={item.href} className="flex flex-col">
                <button
                  onClick={() => {
                    if (item.subItems) {
                      setExpanded(prev => ({ ...prev, [item.href]: !prev[item.href] }));
                    } else {
                      router.push(getHrefWithParams(item.href));
                    }
                  }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2.5 py-[6px] rounded-lg text-[13px] font-medium transition-colors cursor-pointer text-zinc-900 dark:text-zinc-100",
                    isExactActive && !item.subItems
                      ? "bg-[var(--nav-active-bg)]" 
                      : "hover:bg-[var(--nav-hover-bg)]"
                  )}
                >
                  <span className={cn(isParentActive ? "text-zinc-900 dark:text-zinc-100" : "text-muted-foreground/80")}>{item.icon}</span>
                  {item.label}
                </button>
                
                {/* Subitems */}
                {item.subItems && expanded[item.href] && (
                  <div className="mt-1 flex flex-col gap-[2px]">
                    {item.subItems.map((sub) => {
                      const isSubActive = pathname === sub.href;
                      return (
                        <button
                          key={sub.href}
                          onClick={() => router.push(getHrefWithParams(sub.href))}
                          className={cn(
                            "w-full text-left pl-[34px] pr-3 py-[7px] rounded-md text-[13px] transition-colors cursor-pointer",
                            isSubActive 
                              ? "font-semibold text-zinc-900 dark:text-zinc-100 bg-[var(--pill-bg)]" 
                              : "font-normal text-zinc-500 dark:text-zinc-400 hover:text-foreground hover:bg-[var(--nav-hover-bg)]"
                          )}
                        >
                          {sub.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="px-3 py-3">
        <SidebarFooter />
      </div>
    </aside>
  );
}
