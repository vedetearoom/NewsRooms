"use client";

import * as React from "react";
import { CircleHelp, Save, ServerCog } from "lucide-react";
import { api, type RSSHubServerConfig } from "@/lib/api";
import { useAuthState } from "@/lib/auth";
import { useTranslation } from "@/hooks/useTranslation";
import { toast } from "@/components/ui/use-toast";

function EmptyPermissionState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50/80 px-8 dark:bg-[#0b0c0f]">
      <div className="max-w-md rounded-[32px] border border-zinc-200/70 bg-white px-8 py-10 text-center shadow-[0_24px_70px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-[#101216] dark:shadow-none">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{description}</p>
      </div>
    </div>
  );
}

function FieldLabel({ label }: { label: string }) {
  return (
    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-500">
      {label}
    </div>
  );
}

const countBadgeClass =
  "inline-flex items-center rounded-full border border-zinc-200/80 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-500 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-zinc-400 dark:shadow-none";

const ghostButtonClass =
  "inline-flex items-center gap-1.5 overflow-hidden rounded-full bg-white px-3.5 py-1.5 text-[13px] font-medium text-zinc-600 shadow-sm transition-all hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-zinc-900/8 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white/[0.06] dark:text-zinc-200 dark:hover:bg-white/[0.1] dark:focus-visible:ring-white/10 dark:shadow-none";

const primaryButtonClass =
  "inline-flex items-center gap-1.5 overflow-hidden rounded-full bg-zinc-900 px-3.5 py-1.5 text-[13px] font-medium text-white shadow-sm transition-all hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-zinc-900/10 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 dark:focus-visible:ring-white/10";

const textareaClass =
  "w-full rounded-[22px] border border-zinc-200 bg-white px-4 py-3 font-mono text-[13px] leading-6 text-zinc-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition-all placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-4 focus:ring-zinc-900/10 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/20 dark:focus:border-white dark:focus:ring-white/10 dark:shadow-none";

export default function SystemServerPage() {
  const { ready, hasPermission } = useAuthState();
  const { t } = useTranslation();
  const canManage = hasPermission("system.manage");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [config, setConfig] = React.useState<RSSHubServerConfig | null>(null);
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});

  const loadConfig = React.useCallback(async () => {
    setLoading(true);
    try {
      const nextConfig = await api.admin.getRSSHubServerConfig();
      setConfig(nextConfig);
      setDrafts({});
    } catch (error) {
      console.error(error);
      toast.error(t("system.serverLoadFailed"), t("system.tryLater"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    if (ready && canManage) {
      loadConfig();
    } else if (ready) {
      setLoading(false);
    }
  }, [canManage, loadConfig, ready]);

  const visiblePlatforms = React.useMemo(() => {
    return (config?.platforms || []).filter((platform) => platform.key === "bilibili");
  }, [config]);

  const cookieGuide = t(
    "system.serverCookieGuide",
    "登录 bilibili.com，打开开发者工具，切到 Network，复制请求里的 Cookie 值。",
  );

  const handleSave = async (restartAfterSave: boolean) => {
    const cookies = Object.fromEntries(
      Object.entries(drafts)
        .map(([key, value]) => [key, value.trim()])
        .filter(([, value]) => value.length > 0),
    );

    if (Object.keys(cookies).length === 0 && !restartAfterSave) {
      toast.info(t("system.serverNoChangesTitle"), t("system.serverNoChangesDesc"));
      return;
    }

    setSaving(true);
    try {
      const result = await api.admin.updateRSSHubServerConfig({
        cookies,
        restart_after_save: restartAfterSave,
      });
      toast.success(
        restartAfterSave ? t("system.serverSaveRestartSuccessTitle") : t("system.serverSaveSuccessTitle"),
        result.message,
      );
      await loadConfig();
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : t("system.serverSaveFailedDesc");
      toast.error(t("system.serverSaveFailedTitle"), message);
    } finally {
      setSaving(false);
    }
  };

  if (!ready || loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">{t("system.loading")}</div>;
  }

  if (!canManage) {
    return (
      <EmptyPermissionState
        title={t("system.noAccessTitle")}
        description={t("system.noAccessServerDesc")}
      />
    );
  }

  if (!config) {
    return (
      <EmptyPermissionState
        title={t("system.serverLoadFailed")}
        description={t("system.tryLater")}
      />
    );
  }

  return (
    <div className="w-full flex-1 flex min-h-screen flex-col bg-white pt-4 dark:bg-[#0b0c0f]">
      <div className="mb-10 px-8 lg:px-12">
        <div className="flex items-center gap-3">
          <span className="text-[17px] font-extrabold tracking-[-0.03em] text-zinc-900 dark:text-zinc-50">
            {t("system.serverManagement")}
          </span>
          <div className={countBadgeClass}>RSSHub</div>
        </div>
      </div>

      <div className="px-8 pb-8 lg:px-12">
        <div className="mx-auto w-full max-w-5xl px-2">
          <div className="mb-10 flex flex-col gap-3">
            <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              {t("system.serverManagement")}
            </h1>
            <div className="max-w-2xl text-[14px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              <p>{t("system.serverManagementDesc")}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-[36px] bg-zinc-50/90 shadow-[0_24px_80px_rgba(15,23,42,0.06)] dark:bg-[#101216] dark:shadow-none">
            <div className="grid lg:grid-cols-[320px_minmax(0,1fr)]">
              <aside className="flex items-center bg-zinc-100/60 px-7 py-8 dark:bg-white/[0.03]">
                <div className="flex w-full items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-zinc-700 shadow-sm dark:bg-white/[0.06] dark:text-zinc-200 dark:shadow-none">
                    <ServerCog className="h-5 w-5" />
                  </div>
                  <div className="text-[18px] font-semibold text-zinc-900 dark:text-white">
                    {t("system.serverServiceTitle")}
                  </div>
                </div>
              </aside>

              <section className="bg-white px-7 py-8 dark:bg-[#101216]">
                <div className="space-y-10">
                  {visiblePlatforms.map((platform, index) => {
                    const draftValue = drafts[platform.key] || "";

                    return (
                      <div
                        key={platform.key}
                        className={index > 0 ? "border-t border-zinc-100 pt-10 dark:border-white/[0.06]" : ""}
                      >
                        <div className="flex flex-col gap-6">
                          <div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h2 className="text-[22px] font-semibold tracking-[-0.03em] text-zinc-900 dark:text-white">
                                  {platform.label}
                                </h2>
                                <div className="relative group/help">
                                  <button
                                    type="button"
                                    aria-label={t("system.serverCookieGuide", "如何获取 Cookie")}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-zinc-900/10 dark:bg-white/[0.06] dark:text-zinc-400 dark:hover:bg-white dark:hover:text-zinc-900 dark:focus-visible:ring-white/10"
                                  >
                                    <CircleHelp className="h-3.5 w-3.5" />
                                  </button>
                                  <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-3 hidden w-72 -translate-x-1/2 rounded-2xl bg-zinc-900 px-4 py-3 text-xs leading-5 text-white shadow-2xl group-hover/help:block group-focus-within/help:block dark:bg-white dark:text-zinc-900">
                                    {cookieGuide}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-[30px] bg-zinc-50/85 p-6 dark:bg-white/[0.03]">
                            <div>
                              <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-500">
                                  {t("system.serverCurrentValue")}
                                </div>
                                <span className="text-xs font-normal text-zinc-400 dark:text-zinc-500">
                                  {t("system.serverUpdateMode")} · {t("system.serverOverrideOnly")}
                                </span>
                              </div>
                              <div className="break-all rounded-2xl bg-white/75 px-4 py-3 font-mono text-sm text-zinc-500 dark:bg-black/10 dark:text-zinc-400">
                                {platform.is_configured
                                  ? `${platform.env_var}=${platform.value_masked}`
                                  : t("system.serverNotConfigured")}
                              </div>
                            </div>

                            <div className="mt-6">
                              <FieldLabel label={t("system.serverNewValue")} />
                              <textarea
                                value={draftValue}
                                onChange={(event) => setDrafts((prev) => ({ ...prev, [platform.key]: event.target.value }))}
                                rows={6}
                                placeholder={t("system.serverCookiePlaceholder")}
                                className={textareaClass}
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-100 pt-6 dark:border-white/[0.06]">
                            <button onClick={() => void handleSave(true)} disabled={saving} className={primaryButtonClass}>
                              <Save className="h-[14px] w-[14px]" />
                              {saving ? t("system.serverSaving") : t("system.serverSaveAndRestart")}
                            </button>
                            <button onClick={() => void handleSave(false)} disabled={saving} className={ghostButtonClass}>
                              <Save className="h-[14px] w-[14px]" />
                              {saving ? t("system.serverSaving") : t("system.serverSaveOnly")}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
