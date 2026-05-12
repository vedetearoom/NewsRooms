"use client";

import * as React from "react";
import { api } from "@/lib/api";
import type { CookiePlatformConfig, DiscoveredVideo, MonitorDiscoveryMode, MonitorTarget, QuotaSnapshot } from "@/lib/api";
import { useTranslation } from "@/hooks/useTranslation";
import { toast } from "@/components/ui/use-toast";
import { showMonitorSkippedToast } from "@/lib/async-feedback";

function detectPlatform(url: string): string | null {
  if (url.includes("bilibili")) return "bilibili";
  if (url.includes("youtube")) return "youtube";
  if (url.includes("xiaohongshu")) return "xiaohongshu";
  return null;
}

function normalizeDiscoveryMode(platform: string | null): MonitorDiscoveryMode {
  if (platform === "bilibili") return "cookie";
  if (platform === "xiaohongshu") return "cookie";
  return "rsshub";
}

function getVideoIdentity(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);

    if (parsed.hostname.includes("xiaohongshu")) {
      if (parts[0] === "explore" && parts[1]) return `xiaohongshu:${parts[1]}`;
      if (parts[0] === "discovery" && parts[1] === "item" && parts[2]) return `xiaohongshu:${parts[2]}`;
      if (parts[0] === "user" && parts[1] === "profile" && parts[3]) return `xiaohongshu:${parts[3]}`;
    }
  } catch {
    return url;
  }

  return url;
}

function reconcileSelectedVideos(
  prev: Record<number, Set<string>>,
  nextVideos: Record<number, DiscoveredVideo[]>,
): Record<number, Set<string>> {
  const next: Record<number, Set<string>> = {};

  for (const [monitorIdStr, selected] of Object.entries(prev)) {
    const monitorId = Number(monitorIdStr);
    const availableVideos = nextVideos[monitorId] || [];
    if (availableVideos.length === 0 || selected.size === 0) continue;

    const availableByExact = new Set(availableVideos.map((video) => video.url));
    const availableByIdentity = new Map(
      availableVideos.map((video) => [getVideoIdentity(video.url), video.url]),
    );
    const resolved = new Set<string>();

    for (const url of selected) {
      if (availableByExact.has(url)) {
        resolved.add(url);
        continue;
      }
      const mapped = availableByIdentity.get(getVideoIdentity(url));
      if (mapped) resolved.add(mapped);
    }

    if (resolved.size > 0) {
      next[monitorId] = resolved;
    }
  }

  return next;
}

export function useMonitorsPage() {
  const { t } = useTranslation();
  const [monitors, setMonitors] = React.useState<MonitorTarget[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState("");
  const [showAdd, setShowAdd] = React.useState(false);
  const [quota, setQuota] = React.useState<QuotaSnapshot | null>(null);
  const [addUrl, setAddUrl] = React.useState("");
  const [addName, setAddName] = React.useState("");
  const [addDiscoveryMode, setAddDiscoveryMode] = React.useState<MonitorDiscoveryMode>("cookie");
  const [adding, setAdding] = React.useState(false);
  const [addError, setAddError] = React.useState("");
  const [videos, setVideos] = React.useState<Record<number, DiscoveredVideo[]>>({});
  const [selectedVideos, setSelectedVideos] = React.useState<Record<number, Set<string>>>({});
  const [checking, setChecking] = React.useState<Record<number, boolean>>({});
  const [checkErrors, setCheckErrors] = React.useState<Record<number, string>>({});
  const [analyzing, setAnalyzing] = React.useState<Record<number, boolean>>({});
  const [videoStatus, setVideoStatus] = React.useState<Record<string, "queued" | "submitting" | "done" | "error">>({});
  const [expanded, setExpanded] = React.useState<Set<number>>(new Set());
  const [deleteTarget, setDeleteTarget] = React.useState<MonitorTarget | null>(null);
  const [editTarget, setEditTarget] = React.useState<MonitorTarget | null>(null);
  const [editName, setEditName] = React.useState("");
  const [editUrl, setEditUrl] = React.useState("");
  const [editDiscoveryMode, setEditDiscoveryMode] = React.useState<MonitorDiscoveryMode>("cookie");
  const [editing, setEditing] = React.useState(false);
  const [editError, setEditError] = React.useState("");
  const [showCookieDialog, setShowCookieDialog] = React.useState(false);
  const [cookiePlatforms, setCookiePlatforms] = React.useState<CookiePlatformConfig[]>([]);
  const [cookieInputs, setCookieInputs] = React.useState<Record<string, string>>({});
  const [savingCookie, setSavingCookie] = React.useState(false);
  const [cookieSaveMsg, setCookieSaveMsg] = React.useState("");

  const fetchMonitors = React.useCallback(async () => {
    try {
      setLoadError("");
      const data = await api.getMonitors();
      const nextVideos: Record<number, DiscoveredVideo[]> = {};
      data.forEach((monitor) => {
        nextVideos[monitor.id] = monitor.cached_videos || [];
      });
      setMonitors(data);
      setChecking((prev) => {
        const next = { ...prev };
        data.forEach((monitor) => {
          next[monitor.id] = monitor.last_check_status === "queued" || monitor.last_check_status === "running";
        });
        return next;
      });
      setCheckErrors((prev) => {
        const next = { ...prev };
        data.forEach((monitor) => {
          next[monitor.id] = monitor.last_check_status === "failed" ? monitor.last_check_error || "" : "";
        });
        return next;
      });
      setVideos(() => {
        const next = nextVideos;
        setSelectedVideos((selectedPrev) => reconcileSelectedVideos(selectedPrev, next));
        data.forEach((monitor) => {
          if (monitor.active_jobs) {
            for (const url of Object.keys(monitor.active_jobs)) {
              setVideoStatus((state) => ({ ...state, [url]: "submitting" }));
            }
          }
        });
        return next;
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load monitors.";
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCookieConfig = React.useCallback(async () => {
    try {
      const cfg = await api.getMonitorCredentials();
      setCookiePlatforms(cfg.platforms);
    } catch {
      /* ignore */
    }
  }, []);

  React.useEffect(() => {
    fetchMonitors();
    fetchCookieConfig();
    api.getQuota().then(setQuota).catch(() => {});
  }, [fetchMonitors, fetchCookieConfig]);

  const openAddDialog = React.useCallback(() => {
    const remaining = quota?.resources?.video_monitors?.remaining;
    if (remaining === 0) {
      toast.error("视频博主额度已用完", "请删除旧博主或联系管理员升级套餐。");
      return;
    }
    setShowAdd(true);
  }, [quota]);

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
            setChecking((prev) => ({
              ...prev,
              [monitor.id]: res.status === "queued" || res.status === "running",
            }));
            setCheckErrors((prev) => ({
              ...prev,
              [monitor.id]: res.status === "failed" ? res.error || "" : "",
            }));
            setVideos((prev) => {
              const next = { ...prev, [monitor.id]: res.videos || [] };
              setSelectedVideos((selectedPrev) => reconcileSelectedVideos(selectedPrev, next));
              return next;
            });
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

  const toggleVideo = React.useCallback((monitorId: number, url: string) => {
    setSelectedVideos((prev) => {
      const next = new Set(prev[monitorId] || []);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return { ...prev, [monitorId]: next };
    });
  }, []);

  const toggleExpanded = React.useCallback((id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const openEditDialog = React.useCallback((monitor: MonitorTarget) => {
    setEditTarget(monitor);
    setEditName(monitor.name);
    setEditUrl(monitor.homepage_url);
    setEditDiscoveryMode(normalizeDiscoveryMode(monitor.platform));
  }, []);

  const handleAdd = React.useCallback(async () => {
    if (!addUrl.trim()) return;
    setAdding(true);
    setAddError("");
    try {
      await api.createMonitor({
        url: addUrl.trim(),
        name: addName.trim() || undefined,
        discovery_mode: normalizeDiscoveryMode(detectPlatform(addUrl)),
      });
      setAddUrl("");
      setAddName("");
      setAddDiscoveryMode("cookie");
      setShowAdd(false);
      await fetchMonitors();
      api.getQuota().then(setQuota).catch(() => {});
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      setAddError(msg);
    } finally {
      setAdding(false);
    }
  }, [addName, addUrl, fetchMonitors]);

  const handleAnalyzeAll = React.useCallback(async () => {
    const urlsByMonitor: Record<number, string[]> = {};
    for (const [monitorId, urls] of Object.entries(selectedVideos)) {
      if (urls.size > 0) {
        const availableVideos = videos[Number(monitorId)] || [];
        const availableByIdentity = new Map(
          availableVideos.map((video) => [getVideoIdentity(video.url), video.url]),
        );
        urlsByMonitor[Number(monitorId)] = Array.from(
          new Set(
            Array.from(urls).map((url) => availableByIdentity.get(getVideoIdentity(url)) || url),
          ),
        );
      }
    }

    if (Object.keys(urlsByMonitor).length === 0) return;

    for (const [monitorIdValue, urls] of Object.entries(urlsByMonitor)) {
      const monitorId = Number(monitorIdValue);
      setAnalyzing((prev) => ({ ...prev, [monitorId]: true }));
      setVideoStatus((prev) => {
        const next = { ...prev };
        urls.forEach((url) => {
          next[url] = "submitting";
        });
        return next;
      });

      try {
        const res = await api.dispatchAnalysis(monitorId, urls);
        if (res.skipped?.length) {
          for (const skipped of res.skipped) {
            showMonitorSkippedToast(skipped.reason, t);
            if (skipped.url) {
              setVideoStatus((prev) => ({ ...prev, [skipped.url]: "error" }));
            }
          }
        }
        setVideoStatus((prev) => {
          const next = { ...prev };
          urls.forEach((url) => {
            if (next[url] !== "error") next[url] = "queued";
          });
          return next;
        });
      } catch (error) {
        console.error("Dispatch failed", error);
        const message = error instanceof Error ? error.message : t("monitors.analysisFailedDesc", "加入待处理失败");
        toast.error(t("monitors.analysisFailedTitle", "处理失败"), message);
        setVideoStatus((prev) => {
          const next = { ...prev };
          urls.forEach((url) => {
            next[url] = "error";
          });
          return next;
        });
      } finally {
        setAnalyzing((prev) => ({ ...prev, [monitorId]: false }));
      }
    }

    setSelectedVideos({});
    fetchMonitors();
  }, [fetchMonitors, selectedVideos, t, videos]);

  const handleCheck = React.useCallback(async (monitor: MonitorTarget) => {
    setChecking((prev) => ({ ...prev, [monitor.id]: true }));
    setCheckErrors((prev) => ({ ...prev, [monitor.id]: "" }));
    try {
      const result = await api.checkMonitor(monitor.id);
      setMonitors((prev) =>
        prev.map((item) =>
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
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      setChecking((prev) => ({ ...prev, [monitor.id]: false }));
      setCheckErrors((prev) => ({ ...prev, [monitor.id]: msg }));
    }
  }, []);

  const handleDelete = React.useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteMonitor(deleteTarget.id);
      setDeleteTarget(null);
      await fetchMonitors();
      api.getQuota().then(setQuota).catch(() => {});
    } catch {
      /* ignore */
    }
  }, [deleteTarget, fetchMonitors]);

  const handleEdit = React.useCallback(async () => {
    if (!editTarget || !editUrl.trim()) return;
    setEditing(true);
    setEditError("");
    try {
      await api.updateMonitor(editTarget.id, {
        name: editName.trim() || undefined,
        url: editUrl.trim() || undefined,
        discovery_mode: normalizeDiscoveryMode(detectPlatform(editUrl)),
      });
      setEditTarget(null);
      await fetchMonitors();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      setEditError(msg);
    } finally {
      setEditing(false);
    }
  }, [editName, editTarget, editUrl, fetchMonitors]);

  const handleSaveCookie = React.useCallback(async () => {
    setSavingCookie(true);
    setCookieSaveMsg("");
    try {
      const cookies: Record<string, string> = {};
      for (const [key, value] of Object.entries(cookieInputs)) {
        cookies[key] = value;
      }
      const res = await api.saveCookieConfig(cookies);
      setCookieSaveMsg(res.message || "保存成功");
      setCookieInputs({});
      await fetchCookieConfig();
      setTimeout(() => {
        setShowCookieDialog(false);
        setCookieSaveMsg("");
      }, 2000);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(t("monitors.cookieSaveFailed", "Cookie 保存失败"), msg);
    } finally {
      setSavingCookie(false);
    }
  }, [cookieInputs, fetchCookieConfig, t]);

  const configuredCount = cookiePlatforms.filter((platform) => platform.is_configured).length;
  const totalCookiePlatforms = cookiePlatforms.length;
  const totalSelected = React.useMemo(() => {
    let count = 0;
    for (const set of Object.values(selectedVideos)) {
      count += set.size;
    }
    return count;
  }, [selectedVideos]);
  const detectedPlatform = detectPlatform(addUrl);
  React.useEffect(() => {
    setAddDiscoveryMode(normalizeDiscoveryMode(detectedPlatform));
  }, [detectedPlatform]);
  React.useEffect(() => {
    setEditDiscoveryMode(normalizeDiscoveryMode(detectPlatform(editUrl)));
  }, [editUrl]);
  const activeCount = monitors.filter((monitor) => monitor.is_active).length;
  const isAnyAnalyzing = Object.values(analyzing).some(Boolean);

  return {
    monitors,
    loading,
    loadError,
    showAdd,
    setShowAdd,
    openAddDialog,
    addUrl,
    setAddUrl,
    addName,
    setAddName,
    addDiscoveryMode,
    setAddDiscoveryMode,
    adding,
    addError,
    setAddError,
    videos,
    selectedVideos,
    setSelectedVideos,
    checkErrors,
    checking,
    videoStatus,
    expanded,
    deleteTarget,
    setDeleteTarget,
    editTarget,
    setEditTarget,
    editName,
    setEditName,
    editUrl,
    setEditUrl,
    editDiscoveryMode,
    setEditDiscoveryMode,
    editing,
    editError,
    showCookieDialog,
    setShowCookieDialog,
    cookiePlatforms,
    cookieInputs,
    setCookieInputs,
    savingCookie,
    cookieSaveMsg,
    setCookieSaveMsg,
    configuredCount,
    totalCookiePlatforms,
    totalSelected,
    detectedPlatform,
    activeCount,
    isAnyAnalyzing,
    toggleVideo,
    toggleExpanded,
    openEditDialog,
    handleAdd,
    handleCheck,
    handleAnalyzeAll,
    handleDelete,
    handleEdit,
    handleSaveCookie,
  };
}
