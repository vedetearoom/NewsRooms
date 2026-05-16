"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTasks } from "@/hooks/useApi";
import { cn } from "@/lib/utils";
import { FileText, MoreHorizontal, Eye, Search } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useClickOutside } from "@/hooks/useClickOutside";
import { PageEmptyState, PageLoadingState } from "@/components/shared/page-states";
import { getTaskLibraryBucket, normalizeTaskStatus } from "@/lib/task-status";

/* ─── Status badge config ─── */
function statusBadge(status: string, t: (key: string) => string) {
  switch (normalizeTaskStatus(status)) {
    case "completed":
      return { label: t('vault.finalized'), type: "completed" };
    case "pending":
      return { label: t('pipeline.status.pending'), type: "pending" };
    case "writing":
      return { label: t('vault.inProgress'), type: "pending" };
    case "written":
    case "reviewing":
      return { label: t('vault.drafts'), type: "pending" };
    default:
      return { label: status, type: "pending" };
  }
}

type FilterTab = "all" | "drafts" | "finalized";

export default function KnowledgeCenterPage() {
  const router = useRouter();
  const { t, language } = useTranslation();

  // --- Documents State ---
  const { tasks, isLoading } = useTasks();
  const [selectedTaskIds, setSelectedTaskIds] = React.useState<Set<number>>(new Set());
  const [activeFilter, setActiveFilterRaw] = React.useState<FilterTab>("all");
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const filterRef = React.useRef<HTMLDivElement>(null);
  useClickOutside({
    ref: filterRef,
    enabled: filterOpen,
    onClickOutside: () => setFilterOpen(false),
  });

  React.useEffect(() => {
    const saved = localStorage.getItem("newsroom:vault:filter");
    if (saved) setActiveFilterRaw(saved as FilterTab);
  }, []);
  const setActiveFilter = (val: FilterTab) => {
    setActiveFilterRaw(val);
    localStorage.setItem("newsroom:vault:filter", val);
  };

  // Derived Documents
  const toggleTask = (id: number) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const libraryTasks = React.useMemo(() => {
    return tasks.filter((task) => getTaskLibraryBucket(task.status) !== null);
  }, [tasks]);

  const filteredTasks = React.useMemo(() => {
    let list = libraryTasks;
    if (activeFilter === "drafts") list = list.filter((task) => getTaskLibraryBucket(task.status) === "drafts");
    if (activeFilter === "finalized") list = list.filter((task) => getTaskLibraryBucket(task.status) === "finalized");
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(t => (t.title || "").toLowerCase().includes(q));
    }
    return list;
  }, [libraryTasks, activeFilter, searchQuery]);
  const hasActiveFilters = activeFilter !== "all" || searchQuery.trim().length > 0;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const locale = language === 'zh' ? 'zh-CN' : 'en-US';
    return d.toLocaleDateString(locale, { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  };

  const renderBadge = (count: number) => (
    <span className="ml-2 inline-flex items-center justify-center bg-zinc-100 text-zinc-500 dark:bg-white/10 dark:text-zinc-400 text-[11px] font-semibold rounded-full px-2 py-0.5">
      {count}
    </span>
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-white dark:bg-[#0b0c0f]">

      {/* ── Page Header ── */}
      <div className="shrink-0 pt-8 px-8 lg:px-12 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center">
            {t('vault.library')}
            {renderBadge(libraryTasks.length)}
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            {t('vault.libraryDesc')}
          </p>
        </div>
      </div>

      {/* ── Level 2 Filtering & Toolbar ── */}
      <div className="pt-8 px-8 lg:px-12 flex items-center gap-6 pb-3">
        <div className="relative shrink-0 flex items-center" ref={filterRef}>
          <button onClick={() => setFilterOpen(!filterOpen)} className={cn("flex items-center gap-1.5 text-[13px] font-medium transition-colors cursor-pointer", filterOpen ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
            {t('pipeline.filter')}
          </button>
          {filterOpen && (
            <div className="absolute top-full left-0 mt-3 w-[200px] z-50 bg-white dark:bg-[#1a1b1e] border border-zinc-200 dark:border-white/10 rounded-xl shadow-xl py-2 flex flex-col items-start animate-in fade-in slide-in-from-top-1">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 mt-1">{t('vault.status')}</div>
              {(["drafts", "finalized"] as const).map(s => (
                <button key={s} onClick={() => { setActiveFilter(s); setFilterOpen(false); }} className={cn("flex items-center gap-2 px-3 py-1.5 w-full text-left text-[13px] transition-colors", activeFilter === s ? "text-foreground bg-zinc-50 dark:bg-white/5" : "text-muted-foreground hover:text-foreground hover:bg-zinc-50 dark:hover:bg-white/5")}>
                  {s === "drafts" ? t('vault.drafts') : t('vault.finalized')}
                </button>
              ))}
              {activeFilter !== "all" && (
                <div className="w-full pt-1.5 mt-1 border-t border-zinc-100 dark:border-white/5">
                  <button onClick={() => { setActiveFilter("all"); setFilterOpen(false); }} className="flex items-center gap-2 px-3 py-1.5 w-full text-left text-[13px] text-muted-foreground hover:text-foreground hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors font-medium">{t('pipeline.clearFilters')}</button>
                </div>
              )}
            </div>
          )}
          <div className="ml-6 flex items-center group relative">
            <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
            <input type="text" placeholder={t('pipeline.search')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="h-[30px] w-[200px] pl-7 text-[13px] font-medium bg-transparent border-transparent text-foreground placeholder:text-muted-foreground outline-0 focus:outline-0 focus:ring-0 focus:border-transparent focus:shadow-none shadow-none hover:text-foreground" />
          </div>
        </div>
      </div>

      {/* ── Data Views ── */}
      <div className="flex-1 overflow-y-auto bg-zinc-50/50 dark:bg-white/[0.01]">
        <div className="pb-8">
          {isLoading ? (
            <PageLoadingState className="min-h-[320px]" label={t("common.loading", "Loading...")} />
          ) : filteredTasks.length === 0 ? (
            <PageEmptyState
              className="min-h-[320px]"
              compact
              icon={FileText}
              title={t("vault.noAssets")}
              description={
                hasActiveFilters
                  ? t("vault.libraryEmptyFilteredDesc")
                  : t("vault.noAssetsDesc")
              }
              action={
                hasActiveFilters
                  ? {
                      label: t("pipeline.clearFilters"),
                      onClick: () => {
                        setActiveFilter("all");
                        setSearchQuery("");
                      },
                    }
                  : undefined
              }
            />
          ) : (
            <table className="w-full">
              <colgroup>
                <col className="w-[72px] lg:w-[88px]" />
                <col className="w-auto" />
                <col className="w-[120px]" />
                <col className="w-[100px]" />
                <col className="w-[160px]" />
                <col className="w-[100px]" />
              </colgroup>
              <tbody>
                {filteredTasks.map((task) => {
                  const badge = statusBadge(task.status, t);
                  const isChecked = selectedTaskIds.has(task.id);
                  return (
                    <tr key={task.id} className={cn("group h-14 transition-colors cursor-pointer", isChecked ? "bg-blue-50/60 dark:bg-blue-500/[0.08]" : "hover:bg-zinc-100/60 dark:hover:bg-white/[0.04]")} onClick={() => toggleTask(task.id)}>
                      <td className="pl-8 lg:pl-12 pr-2 align-middle">
                        <div className="flex items-center h-full justify-start">
                          <div className={cn(
                            "w-[16px] h-[16px] rounded-[3px] flex items-center justify-center transition-all",
                            isChecked
                              ? "bg-foreground border border-foreground"
                              : "border-[1.5px] border-zinc-300 dark:border-zinc-500 bg-white dark:bg-zinc-900"
                          )}>
                            {isChecked && (
                              <svg className="w-2.5 h-2.5 text-background" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="pr-4 border-b border-zinc-200/50 dark:border-white/[0.04]">
                        <div className="flex items-center gap-3">
                          <FileText className="w-4 h-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
                          <span className="text-[14px] font-normal text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors truncate max-w-[400px]">{task.title || "Untitled Task"}</span>
                        </div>
                      </td>
                      <td className="border-b border-zinc-200/50 dark:border-white/[0.04]">
                        {badge.type === "completed" ? (
                          <span className="text-[11.5px] font-medium text-zinc-400 dark:text-zinc-600 whitespace-nowrap">{badge.label}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-100/80 dark:bg-[#15161a] border border-zinc-200/50 dark:border-white/[0.05]">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-zinc-600 dark:bg-blue-500 dark:shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                            <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-400 whitespace-nowrap">{badge.label}</span>
                          </span>
                        )}
                      </td>
                      <td className="border-b border-zinc-200/50 dark:border-white/[0.04]"><span className="font-mono text-[12px] text-zinc-500 dark:text-zinc-400">TSK-{task.id}</span></td>
                      <td className="border-b border-zinc-200/50 dark:border-white/[0.04]"><span className="text-[13px] text-zinc-500 dark:text-zinc-400">{formatDate(task.created_at)}</span></td>
                      <td className="text-right pr-8 lg:pr-12 border-b border-zinc-200/50 dark:border-white/[0.04]">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); router.push(`/editor/${task.id}`); }} className="flex items-center gap-1 h-7 px-2 rounded-md text-[12px] font-medium text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors whitespace-nowrap"><Eye className="w-3.5 h-3.5" />{t("vault.view")}</button>
                          <button onClick={(e) => e.stopPropagation()} className="w-7 h-7 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors"><MoreHorizontal className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
}
