/**
 * Global job tracking store — persists across React component lifecycle
 * and client-side navigation (module-level singleton).
 *
 * Manages: job registration, background polling, status notifications.
 * Components subscribe via useSyncExternalStore to get reactive updates.
 */
import { api, type JobStatus } from './api';

export interface ActiveJob {
  jobId: string;
  name: string;
  articleIds: number[];   // which articles this job covers (pipeline)
  sourceId?: number;      // which source this is for (sources page)
  shouldPinCreatedCards?: boolean;
  startTime: number;
  status: 'running' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
}

// ── Module-level state (survives navigation) ──
const jobs = new Map<string, ActiveJob>();
const listeners = new Set<() => void>();
let snapshot: ReadonlyMap<string, ActiveJob> = new Map();

interface BackendJob extends JobStatus {
  job_id: string;
  meta?: {
    article_ids?: number[];
    source_id?: number;
  };
}

function notify() {
  snapshot = new Map(jobs);
  listeners.forEach(fn => fn());
}

export const jobStore = {
  /** React useSyncExternalStore subscribe */
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /** React useSyncExternalStore getSnapshot */
  getSnapshot(): ReadonlyMap<string, ActiveJob> {
    return snapshot;
  },

  /**
   * Submit a background job and start polling automatically.
   * Polling continues independently of component lifecycle.
   */
  submit(
    jobId: string,
    meta: { name: string; articleIds?: number[]; sourceId?: number; shouldPinCreatedCards?: boolean }
  ): ActiveJob {
    const job: ActiveJob = {
      jobId,
      name: meta.name,
      articleIds: meta.articleIds ?? [],
      sourceId: meta.sourceId,
      shouldPinCreatedCards: meta.shouldPinCreatedCards,
      startTime: Date.now(),
      status: 'running',
    };
    jobs.set(jobId, job);
    notify();

    // Background polling — runs even if the component unmounts
    api.pollJob(jobId)
      .then((finalStatus: JobStatus) => {
        const existing = jobs.get(jobId);
        if (existing) {
          existing.status = finalStatus.status === 'completed' ? 'completed' : 'failed';
          existing.result = finalStatus.result;
          existing.error = finalStatus.error;
          notify();
          // Auto-cleanup completed/failed jobs after 8 seconds
          setTimeout(() => {
            jobs.delete(jobId);
            notify();
          }, 8000);
        }
      })
      .catch((err: Error) => {
        const existing = jobs.get(jobId);
        if (existing) {
          existing.status = 'failed';
          existing.error = err?.message || 'Unknown error';
          notify();
          setTimeout(() => {
            jobs.delete(jobId);
            notify();
          }, 8000);
        }
      });

    return job;
  },

  /** Find a running job that covers a specific article */
  getRunningJobForArticle(articleId: number): ActiveJob | undefined {
    for (const job of jobs.values()) {
      if (job.status === 'running' && job.articleIds.includes(articleId)) {
        return job;
      }
    }
    return undefined;
  },

  /** Find a running job for a specific source */
  getRunningJobForSource(sourceId: number): ActiveJob | undefined {
    for (const job of jobs.values()) {
      if (job.status === 'running' && job.sourceId === sourceId) {
        return job;
      }
    }
    return undefined;
  },

  /** Check if any job with a given name prefix is running */
  hasRunning(namePrefix?: string): boolean {
    for (const job of jobs.values()) {
      if (job.status === 'running' && (!namePrefix || job.name.startsWith(namePrefix))) {
        return true;
      }
    }
    return false;
  },

  /** Get all recently completed/failed jobs (for toast display on re-mount) */
  getFinished(): ActiveJob[] {
    return Array.from(jobs.values()).filter(j => j.status !== 'running');
  },

  /** Manually remove a job (e.g., after showing toast) */
  dismiss(jobId: string) {
    jobs.delete(jobId);
    notify();
  },

  /** 
   * Global hydration: Fetch all known jobs from the backend.
   * If we find running jobs we didn't know about, add them and start polling.
   */
  async hydrate() {
    try {
      const backendJobs = await api.getJobs() as BackendJob[];
      let changed = false;

      for (const bj of backendJobs) {
        if ((bj.status === 'pending' || bj.status === 'running') && !jobs.has(bj.job_id)) {
          // It's an in-flight job we didn't track yet
          const parsedMeta = bj.meta || {};
          
          const newJob: ActiveJob = {
            jobId: bj.job_id,
            name: bj.name,
            articleIds: parsedMeta.article_ids || [],
            sourceId: parsedMeta.source_id,
            startTime: new Date(bj.created_at).getTime(),
            status: 'running',
          };
          jobs.set(bj.job_id, newJob);
          changed = true;

          // Resume polling for this newly discovered job
          api.pollJob(bj.job_id)
            .then((finalStatus: JobStatus) => {
              const existing = jobs.get(bj.job_id);
              if (existing) {
                existing.status = finalStatus.status === 'completed' ? 'completed' : 'failed';
                existing.result = finalStatus.result;
                existing.error = finalStatus.error;
                notify();
                setTimeout(() => { jobs.delete(bj.job_id); notify(); }, 8000);
              }
            }).catch((err: Error) => {
              const existing = jobs.get(bj.job_id);
              if (existing) {
                existing.status = 'failed';
                existing.error = err?.message || 'Unknown error';
                notify();
                setTimeout(() => { jobs.delete(bj.job_id); notify(); }, 8000);
              }
            });
        }
      }

      if (changed) {
        notify();
      }
    } catch (e) {
      console.warn("Failed to hydrate job store:", e);
    }
  }
};

// --- Automatic Global Synchronization Setup ---

// Hydrate once after a short delay to let the backend start
if (typeof window !== 'undefined') {
  setTimeout(() => jobStore.hydrate(), 2000);

  // Re-hydrate when the user switches back to this tab
  window.addEventListener('focus', () => {
    jobStore.hydrate();
  });

  // Also hydrate periodically to catch jobs started in other tabs
  setInterval(() => {
    jobStore.hydrate();
  }, 15000);
}
