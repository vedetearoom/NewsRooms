"use client";

import * as React from "react";
import { AlertCircle, FileSearch, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface PageStateAction {
  label: string;
  onClick: () => void;
}

interface BasePageStateProps {
  className?: string;
  compact?: boolean;
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: PageStateAction;
}

function PageState({
  className,
  compact = false,
  title,
  description,
  icon: Icon = FileSearch,
  action,
}: BasePageStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "px-4 py-10" : "min-h-[280px] px-6 py-16",
        className,
      )}
    >
      <div
        className={cn(
          "mb-4 flex items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500 dark:bg-white/[0.05] dark:text-zinc-400",
          compact ? "h-12 w-12" : "h-16 w-16",
        )}
      >
        <Icon className={compact ? "h-5 w-5" : "h-7 w-7"} />
      </div>
      <h3 className={cn("font-semibold text-foreground", compact ? "text-[14px]" : "text-[15px]")}>
        {title}
      </h3>
      {description ? (
        <p
          className={cn(
            "mt-1.5 max-w-sm text-muted-foreground",
            compact ? "text-[12px]" : "text-[13px]",
          )}
        >
          {description}
        </p>
      ) : null}
      {action ? (
        <button
          onClick={action.onClick}
          className="mt-4 rounded-lg bg-zinc-900 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

interface PageLoadingStateProps {
  className?: string;
  compact?: boolean;
  label?: string;
}

export function PageLoadingState({
  className,
  compact = false,
  label = "Loading...",
}: PageLoadingStateProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 text-muted-foreground",
        compact ? "px-4 py-10 text-[12px]" : "min-h-[220px] px-6 py-16 text-[13px]",
        className,
      )}
    >
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>{label}</span>
    </div>
  );
}

interface PageEmptyStateProps {
  className?: string;
  compact?: boolean;
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: PageStateAction;
}

export function PageEmptyState(props: PageEmptyStateProps) {
  return <PageState {...props} />;
}

interface PageErrorStateProps {
  className?: string;
  compact?: boolean;
  title?: string;
  description?: string;
  action?: PageStateAction;
}

export function PageErrorState({
  title = "Something went wrong",
  description = "We couldn't load this content right now.",
  ...props
}: PageErrorStateProps) {
  return (
    <PageState
      icon={AlertCircle}
      title={title}
      description={description}
      {...props}
    />
  );
}

interface PageStateBoundaryProps {
  loading?: boolean;
  error?: string | null;
  isEmpty?: boolean;
  loadingLabel?: string;
  emptyState?: React.ReactNode;
  errorState?: React.ReactNode;
  children: React.ReactNode;
}

export function PageStateBoundary({
  loading = false,
  error,
  isEmpty = false,
  loadingLabel,
  emptyState = null,
  errorState,
  children,
}: PageStateBoundaryProps) {
  if (loading) {
    return <PageLoadingState label={loadingLabel} />;
  }

  if (error) {
    return errorState ?? <PageErrorState description={error} />;
  }

  if (isEmpty) {
    return <>{emptyState}</>;
  }

  return <>{children}</>;
}
