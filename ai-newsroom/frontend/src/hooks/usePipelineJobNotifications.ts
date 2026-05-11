import * as React from "react";

import { toast } from "@/components/ui/use-toast";
import type { ActiveJob } from "@/lib/job-store";

interface UsePipelineJobNotificationsOptions {
  jobs: unknown;
  getFinished: () => ActiveJob[];
  dismiss: (jobId: string) => void;
  t: (key: string, fallback?: string) => string;
  watchScrape?: boolean;
  watchProcess?: boolean;
  onScrapeHandled?: () => void | Promise<void>;
  onProcessHandled?: () => void | Promise<void>;
}

export function usePipelineJobNotifications({
  jobs,
  getFinished,
  dismiss,
  t,
  watchScrape = true,
  watchProcess = true,
  onScrapeHandled,
  onProcessHandled,
}: UsePipelineJobNotificationsOptions) {
  const toastedRef = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    const finished = getFinished();

    for (const job of finished) {
      if (toastedRef.current.has(job.jobId)) continue;

      const isScrapeJob = job.name === "scrape_all" || job.name.startsWith("scrape_source_");
      const isProcessJob = job.name.startsWith("process");

      if ((isScrapeJob && !watchScrape) || (isProcessJob && !watchProcess)) {
        continue;
      }
      if (!isScrapeJob && !isProcessJob) {
        continue;
      }

      toastedRef.current.add(job.jobId);

      if (isScrapeJob) {
        if (job.status === "completed") {
          const result = job.result as { articles_scraped?: number; articles_found?: number } | null;
          const count = result?.articles_scraped ?? result?.articles_found ?? 0;
          const detail =
            count > 0
              ? (count === 1
                  ? t("pipeline.syncFetched_one")
                  : t("pipeline.syncFetched_other").replace("{count}", String(count)))
              : t("pipeline.syncUpToDate");
          toast.success(t("pipeline.syncCompleteTitle"), detail);
        } else {
          toast.error(t("pipeline.syncFailedTitle"), job.error || t("pipeline.syncFailedDesc"));
        }
        void onScrapeHandled?.();
      }

      if (isProcessJob) {
        if (job.status === "completed") {
          const result = job.result as { cards_created?: number } | null;
          const count = result?.cards_created ?? 0;
          const detail =
            count > 0
              ? (count === 1
                  ? t("pipeline.processingGenerated_one")
                  : t("pipeline.processingGenerated_other").replace("{count}", String(count)))
              : t("pipeline.processingNoNewCards");
          toast.success(t("pipeline.processingCompleteTitle"), detail);
        } else {
          toast.error(t("pipeline.processingFailedTitle"), job.error || t("pipeline.processingFailedDesc"));
        }
        void onProcessHandled?.();
      }

      dismiss(job.jobId);
    }
  }, [
    jobs,
    dismiss,
    getFinished,
    onProcessHandled,
    onScrapeHandled,
    t,
    watchProcess,
    watchScrape,
  ]);
}
