import * as React from "react";

import { api, type MonitorTarget } from "@/lib/api";
import type { MonitorVideoStatusMap } from "@/lib/monitor-video-ui";
import { showMonitorAnalysisErrorToast } from "@/lib/async-feedback";

interface UseMonitorJobStatusPollingParams {
  monitors: MonitorTarget[];
  manualJobUrls?: string[];
  t: (key: string, fallback?: string) => string;
  onAnyCompleted?: () => void | Promise<void>;
}

export function useMonitorJobStatusPolling({
  monitors,
  manualJobUrls = [],
  t,
  onAnyCompleted,
}: UseMonitorJobStatusPollingParams) {
  const [videoStatus, setVideoStatus] = React.useState<MonitorVideoStatusMap>({});
  const shownErrorsRef = React.useRef<Set<string>>(new Set());

  const onAnyCompletedRef = React.useRef(onAnyCompleted);
  React.useEffect(() => { onAnyCompletedRef.current = onAnyCompleted; }, [onAnyCompleted]);

  React.useEffect(() => {
    const activeMonitors = monitors.filter(
      (monitor) => monitor.active_jobs && Object.keys(monitor.active_jobs).length > 0,
    );
    if (activeMonitors.length === 0 && manualJobUrls.length === 0) return;

    let polling = true;
    const poll = async () => {
      while (polling) {
        let anyCompleted = false;
        const pendingErrors: { url: string; detail: string }[] = [];

        for (const monitor of activeMonitors) {
          try {
            const res = await api.getMonitorJobStatus(monitor.id);

            for (const status of Object.values(res.statuses)) {
              if (status === "completed" || status === "failed") {
                anyCompleted = true;
              }
            }

            setVideoStatus((prev) => {
              const next = { ...prev };
              let changed = false;
              for (const [url, status] of Object.entries(res.statuses)) {
                let mappedStatus: MonitorVideoStatusMap[string] = "submitting";
                if (status === "completed") {
                  mappedStatus = "done";
                } else if (status === "failed") {
                  mappedStatus = "error";
                  if (!shownErrorsRef.current.has(url)) {
                    shownErrorsRef.current.add(url);
                    pendingErrors.push({ url, detail: res.errors?.[url] || "" });
                  }
                }

                if (next[url] !== mappedStatus) {
                  next[url] = mappedStatus;
                  changed = true;
                }
              }
              return changed ? next : prev;
            });
          } catch (error) {
            console.error(error);
          }
        }

        if (manualJobUrls.length > 0) {
          try {
            const res = await api.getManualVideoJobStatus();

            for (const status of Object.values(res.statuses)) {
              if (status === "completed" || status === "failed") {
                anyCompleted = true;
              }
            }

            setVideoStatus((prev) => {
              const next = { ...prev };
              let changed = false;

              for (const [url, status] of Object.entries(res.statuses)) {
                let mappedStatus: MonitorVideoStatusMap[string] = "submitting";
                if (status === "completed") {
                  mappedStatus = "done";
                } else if (status === "failed") {
                  mappedStatus = "error";
                  if (!shownErrorsRef.current.has(url)) {
                    shownErrorsRef.current.add(url);
                    pendingErrors.push({ url, detail: res.errors?.[url] || "" });
                  }
                }

                if (next[url] !== mappedStatus) {
                  next[url] = mappedStatus;
                  changed = true;
                }
              }

              return changed ? next : prev;
            });
          } catch (error) {
            console.error(error);
          }
        }

        for (const err of pendingErrors) {
          showMonitorAnalysisErrorToast(err.detail, t);
        }

        if (anyCompleted) {
          await onAnyCompletedRef.current?.();
        }

        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    };

    void poll();
    return () => {
      polling = false;
    };
  }, [manualJobUrls, monitors, t]);

  const markSubmitting = React.useCallback((urls: string[]) => {
    urls.forEach((url) => {
      shownErrorsRef.current.delete(url);
    });
    setVideoStatus((prev) => {
      const next = { ...prev };
      urls.forEach((url) => {
        next[url] = "submitting";
      });
      return next;
    });
  }, []);

  const markError = React.useCallback((urls: string[]) => {
    setVideoStatus((prev) => {
      const next = { ...prev };
      urls.forEach((url) => {
        next[url] = "error";
      });
      return next;
    });
  }, []);

  return {
    videoStatus,
    setVideoStatus,
    markSubmitting,
    markError,
  };
}
