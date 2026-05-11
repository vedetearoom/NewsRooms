/**
 * React hook for the global job store.
 * Uses useSyncExternalStore so the component re-renders when job state changes,
 * even for jobs that were started before this component mounted.
 */
import * as React from 'react';
import { jobStore } from '@/lib/job-store';

export function useJobStore() {
  const jobs = React.useSyncExternalStore(
    jobStore.subscribe,
    jobStore.getSnapshot,
    jobStore.getSnapshot, // SSR fallback
  );

  return {
    jobs,
    submit: jobStore.submit,
    getRunningJobForArticle: jobStore.getRunningJobForArticle,
    getRunningJobForSource: jobStore.getRunningJobForSource,
    hasRunning: jobStore.hasRunning,
    getFinished: jobStore.getFinished,
    dismiss: jobStore.dismiss,
  };
}
