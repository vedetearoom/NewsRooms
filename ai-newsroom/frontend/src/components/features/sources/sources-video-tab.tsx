"use client";

import * as React from "react";
import { api } from "@/lib/api";
import type { MonitorTarget, DiscoveredVideo, CookiePlatformConfig, MonitorDiscoveryMode, QuotaSnapshot } from "@/lib/api";
import { useTranslation } from "@/hooks/useTranslation";
import { toast } from "@/components/ui/use-toast";
import { SourcesVideoMonitorGrid } from "@/components/features/sources/sources-video-monitor-grid";
import { SourcesVideoDialogs } from "@/components/features/sources/sources-video-dialogs";
import { MONITOR_PLATFORM_META } from "@/lib/monitor-video-ui";
import { useMonitorJobStatusPolling } from "@/hooks/useMonitorJobStatusPolling";

function detectPlatform(url: string): string | null {
  if (url.includes("bilibili")) return "bilibili";
  if (url.includes("youtube")) return "youtube";
  if (url.includes("xiaohongshu")) return "xiaohongshu";
  return null;
}

function normalizeDiscoveryMode(
  platform: string | null,
  mode: MonitorDiscoveryMode,
): MonitorDiscoveryMode {
  if (platform === "bilibili") return mode;
  if (platform === "xiaohongshu") return "cookie";
  return "rsshub";
}

export function SourcesVideoTab({
  searchQuery = "",
  showAddModal = false,
  onOpenAddModal = () => {},
  onCloseAddModal = () => {},
  showCookieDialog = false,
  onOpenCookieDialog = () => {},
  onCloseCookieDialog = () => {},
}: {
  searchQuery?: string;
  showAddModal?: boolean;
  onOpenAddModal?: () => void;
  onCloseAddModal?: () => void;
  showCookieDialog?: boolean;
  onOpenCookieDialog?: () => void;
  onCloseCookieDialog?: () => void;
}) {
  const { t, language } = useTranslation();
  const [monitors, setMonitors] = React.useState<MonitorTarget[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [quota, setQuota] = React.useState<QuotaSnapshot | null>(null);

  // Add dialog
  
  const [addUrl, setAddUrl] = React.useState("");
  const [addName, setAddName] = React.useState("");
  const [addDiscoveryMode, setAddDiscoveryMode] = React.useState<MonitorDiscoveryMode>("rsshub");
  const [adding, setAdding] = React.useState(false);
  const [addError, setAddError] = React.useState("");

  // Per-monitor video discovery
  const [videos, setVideos] = React.useState<Record<number, DiscoveredVideo[]>>({});
  const [checking, setChecking] = React.useState<Record<number, boolean>>({});
  const [checkErrors, setCheckErrors] = React.useState<Record<number, string>>({});

  // Per-video analysis status
  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = React.useState<MonitorTarget | null>(null);
  const [openMenuId, setOpenMenuId] = React.useState<number | null>(null);

  // Edit Monitor
  const [editTarget, setEditTarget] = React.useState<MonitorTarget | null>(null);
  const [editName, setEditName] = React.useState("");
  const [editUrl, setEditUrl] = React.useState("");
  const [editDiscoveryMode, setEditDiscoveryMode] = React.useState<MonitorDiscoveryMode>("rsshub");
  const [editing, setEditing] = React.useState(false);
  const [editError, setEditError] = React.useState("");

  // Cookie settings (multi-platform)
  
  const [cookiePlatforms, setCookiePlatforms] = React.useState<CookiePlatformConfig[]>([]);
  const [cookieInputs, setCookieInputs] = React.useState<Record<string, string>>({});
  const [savingCookie, setSavingCookie] = React.useState(false);
  const [cookieSaveMsg, setCookieSaveMsg] = React.useState("");

  const fetchMonitorsRef = React.useRef<() => Promise<void>>(async () => {});

  const { setVideoStatus } = useMonitorJobStatusPolling({
    monitors,
    t,
    onAnyCompleted: () => fetchMonitorsRef.current(),
  });

  const fetchMonitors = React.useCallback(async () => {
    try {
      const data = await api.getMonitors();
      setMonitors(data);
      setChecking(prev => {
        const next = { ...prev };
        data.forEach(m => {
          next[m.id] = m.last_check_status === "queued" || m.last_check_status === "running";
        });
        return next;
      });
      setCheckErrors(prev => {
        const next = { ...prev };
        data.forEach(m => {
          next[m.id] = m.last_check_status === "failed" ? m.last_check_error || "" : "";
        });
        return next;
      });
      // Populate videos from cache
      setVideos(() => {
        const next: Record<number, DiscoveredVideo[]> = {};
        data.forEach(m => {
          next[m.id] = m.cached_videos || [];
          // Also set visual status for active jobs
          if (m.active_jobs) {
            for (const url of Object.keys(m.active_jobs)) {
              setVideoStatus(s => ({ ...s, [url]: 'submitting' }));
            }
          }
        });
        return next;
      });
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [setVideoStatus]);

  React.useEffect(() => {
    fetchMonitorsRef.current = fetchMonitors;
  }, [fetchMonitors]);

  const fetchCookieConfig = React.useCallback(async () => {
    try {
      const cfg = await api.getCookieConfig();
      setCookiePlatforms(cfg.platforms);
    } catch { /* ignore */ }
  }, []);

  React.useEffect(() => {
    fetchMonitors();
    fetchCookieConfig();
    api.getQuota().then(setQuota).catch(() => {});
  }, [fetchMonitors, fetchCookieConfig]);

  React.useEffect(() => {
    const activeChecks = monitors.filter(
      (monitor) =>
        monitor.last_check_job_id &&
        (monitor.last_check_status === "queued" || monitor.last_check_status === "running"),
    );
    if (activeChecks.length === 0) return;

    let polling = true;
    const poll = async () => {
      while (polling) {
        let shouldRefresh = false;

        for (const monitor of activeChecks) {
          try {
            const res = await api.getMonitorCheckStatus(monitor.id);
            setChecking(prev => ({
              ...prev,
              [monitor.id]: res.status === "queued" || res.status === "running",
            }));
            setCheckErrors(prev => ({
              ...prev,
              [monitor.id]: res.status === "failed" ? res.error || "" : "",
            }));
            setVideos(prev => ({ ...prev, [monitor.id]: res.videos || [] }));
            if (res.status === "completed" || res.status === "failed") {
              shouldRefresh = true;
            }
          } catch (error) {
            console.error(error);
          }
        }

        if (shouldRefresh) {
          await fetchMonitors();
        }

        await new Promise((resolve) => setTimeout(resolve, 2500));
      }
    };

    void poll();
    return () => {
      polling = false;
    };
  }, [fetchMonitors, monitors]);

  // ── Add Monitor ──
  const handleAdd = async () => {
    if (!addUrl.trim()) return;
    setAdding(true);
    setAddError("");
    try {
      await api.createMonitor({
        url: addUrl.trim(),
        name: addName.trim() || undefined,
        discovery_mode: normalizeDiscoveryMode(detectPlatform(addUrl), addDiscoveryMode),
      });
      setAddUrl("");
      setAddName("");
      setAddDiscoveryMode("rsshub");
      onCloseAddModal();
      await fetchMonitors();
      api.getQuota().then(setQuota).catch(() => {});
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setAddError(msg);
    } finally {
      setAdding(false);
    }
  };

  // ── Check (Fetch Videos) ──
  const handleCheck = async (monitor: MonitorTarget) => {
    setChecking(prev => ({ ...prev, [monitor.id]: true }));
    setCheckErrors(prev => ({ ...prev, [monitor.id]: "" }));
    try {
      const result = await api.checkMonitor(monitor.id);
      setMonitors(prev =>
        prev.map(item =>
          item.id === monitor.id
            ? {
                ...item,
                last_check_job_id: result.job_id,
                last_check_status: result.status,
                last_check_error: null,
              }
            : item,
        ),
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setCheckErrors(prev => ({ ...prev, [monitor.id]: msg }));
      setChecking(prev => ({ ...prev, [monitor.id]: false }));
    } finally {
      // Polling loop clears the checking state when the background job completes.
    }
  };

  // ── Delete ──
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteMonitor(deleteTarget.id);
      setDeleteTarget(null);
      await fetchMonitors();
      api.getQuota().then(setQuota).catch(() => {});
    } catch { /* ignore */ }
  };


  // ── Edit Monitor ──
  const handleEdit = async () => {
    if (!editTarget || !editUrl.trim()) return;
    setEditing(true);
    setEditError("");
    try {
      await api.updateMonitor(editTarget.id, { 
        name: editName.trim() || undefined, 
        url: editUrl.trim() || undefined,
        discovery_mode: normalizeDiscoveryMode(detectPlatform(editUrl), editDiscoveryMode),
      });
      setEditTarget(null);
      await fetchMonitors();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setEditError(msg);
    } finally {
      setEditing(false);
    }
  };

  // ── Save Cookie (multi-platform) ──
  const handleSaveCookie = async () => {
    setSavingCookie(true);
    setCookieSaveMsg("");
    try {
      // Only send non-empty values
      const cookies: Record<string, string> = {};
      for (const [key, value] of Object.entries(cookieInputs)) {
        cookies[key] = value;
      }
      const res = await api.saveCookieConfig(cookies);
      setCookieSaveMsg(res.message || t("monitors.saveSuccess"));
      setCookieInputs({});
      await fetchCookieConfig();
      // Auto close after 2s
      setTimeout(() => {
        onCloseCookieDialog();
        setCookieSaveMsg("");
      }, 2000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(t("monitors.cookieSaveFailed", "Cookie 保存失败"), msg);
    }
    finally { setSavingCookie(false); }
  };

  const detectedPlatform = detectPlatform(addUrl);

  React.useEffect(() => {
    setAddDiscoveryMode((prev) => normalizeDiscoveryMode(detectedPlatform, prev));
  }, [detectedPlatform]);

  React.useEffect(() => {
    setEditDiscoveryMode((prev) => normalizeDiscoveryMode(detectPlatform(editUrl), prev));
  }, [editUrl]);

  return (
    <div className="flex flex-col w-full">
      <div className="w-full">
        <div className="w-full mx-auto py-2">
          <SourcesVideoMonitorGrid
            loading={loading}
            monitors={monitors}
            searchQuery={searchQuery}
            videos={videos}
            checking={checking}
            checkErrors={checkErrors}
            openMenuId={openMenuId}
            language={language}
            t={t}
            platformMeta={MONITOR_PLATFORM_META}
            onOpenAddModal={() => {
              const remaining = quota?.resources?.video_monitors?.remaining;
              if (remaining === 0) {
                toast.error("视频博主额度已用完", "请删除旧博主或联系管理员升级套餐。");
                return;
              }
              onOpenAddModal();
            }}
            onOpenCookieDialog={onOpenCookieDialog}
            onCheck={handleCheck}
            onToggleMenu={setOpenMenuId}
            onEdit={(monitor) => {
              setEditTarget(monitor);
              setEditName(monitor.name);
              setEditUrl(monitor.homepage_url);
              setEditDiscoveryMode(normalizeDiscoveryMode(monitor.platform, monitor.discovery_mode || "rsshub"));
            }}
            onDelete={setDeleteTarget}
          />
        </div>
      </div>

      <SourcesVideoDialogs
        showAddModal={showAddModal}
        showCookieDialog={showCookieDialog}
        addUrl={addUrl}
        addName={addName}
        addDiscoveryMode={addDiscoveryMode}
        addError={addError}
        adding={adding}
        detectedPlatform={detectedPlatform}
        editTarget={editTarget}
        editName={editName}
        editUrl={editUrl}
        editDiscoveryMode={editDiscoveryMode}
        editError={editError}
        editing={editing}
        deleteTarget={deleteTarget}
        cookiePlatforms={cookiePlatforms}
        cookieInputs={cookieInputs}
        savingCookie={savingCookie}
        cookieSaveMsg={cookieSaveMsg}
        t={t}
        platformMeta={MONITOR_PLATFORM_META}
        onCloseAddModal={onCloseAddModal}
        onCloseCookieDialog={onCloseCookieDialog}
        onAddUrlChange={(value) => {
          setAddUrl(value);
          setAddError("");
        }}
        onAddNameChange={setAddName}
        onAddDiscoveryModeChange={setAddDiscoveryMode}
        onSubmitAdd={handleAdd}
        onCloseEditDialog={() => setEditTarget(null)}
        onEditUrlChange={setEditUrl}
        onEditNameChange={setEditName}
        onEditDiscoveryModeChange={setEditDiscoveryMode}
        onSubmitEdit={handleEdit}
        onCookieInputChange={(key, value) => setCookieInputs((prev) => ({ ...prev, [key]: value }))}
        onResetCookieDialog={() => {
          onCloseCookieDialog();
          setCookieInputs({});
          setCookieSaveMsg("");
        }}
        onSubmitCookie={handleSaveCookie}
        onCloseDeleteDialog={() => setDeleteTarget(null)}
        onSubmitDelete={handleDelete}
      />
    </div>
  );
}
