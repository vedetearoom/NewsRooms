"use client";

import * as React from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useTabsStore } from "@/store/tabs";
import { useUrlTab } from "@/hooks/useUrlTab";
import { Suspense } from "react";
import { SourcesTextTab } from "@/components/features/sources/sources-text-tab";
import { SourcesVideoTab } from "@/components/features/sources/sources-video-tab";
import { Newspaper, Clapperboard, Settings, Plus, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSources } from "@/hooks/useApi";
import { api, type MonitorTarget } from "@/lib/api";
import { PageShellFallback } from "@/components/shared/page-shell-fallback";
import { PageTopBar, PageTopBarBadge, PageTopBarTabs } from "@/components/shared/page-top-bar";

export default function SourcesPage() {
  return (
    <Suspense fallback={<PageShellFallback />}>
      <SourcesContent />
    </Suspense>
  );
}

function SourcesContent() {
  const { t } = useTranslation();
  const setSourcesTab = useTabsStore(s => s.setSourcesTab);
  const [activeTab, setActiveTab] = useUrlTab<"text" | "video">("tab", "text", setSourcesTab);

  // Global counts for "XX active" pill
  const { sources } = useSources();
  const [monitors, setMonitors] = React.useState<MonitorTarget[]>([]);
  React.useEffect(() => {
    api.getMonitors().then((data: MonitorTarget[]) => setMonitors(data)).catch(console.error);
  }, []);
  
  const textActive = sources?.filter((s) => s.is_active !== false)?.length || 0;
  const videoActive = monitors?.filter(m => m.is_active !== false)?.length || 0;
  const displayActive = activeTab === "text" ? textActive : videoActive;

  // Hoisted state
  const [searchQuery, setSearchQuery] = React.useState("");
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [showCookieDialog, setShowCookieDialog] = React.useState(false);

  return (
    <div className="w-full flex-1 flex flex-col pt-4 min-h-screen bg-white dark:bg-[#08090b]">
      <PageTopBar
        title={t('sidebar.sourceConfig')}
        badge={<PageTopBarBadge text={`${displayActive}${t('sources.activeCount')}`} />}
        className="mb-10"
        innerClassName="px-8"
      >
        <div className="flex items-center gap-1 relative">
          <PageTopBarTabs
            value={activeTab}
            onChange={setActiveTab}
            options={[
              { value: "text", label: t('sources.textSources'), icon: Newspaper },
              { value: "video", label: t('sources.videoBloggers'), icon: Clapperboard },
            ]}
          />

          <div className="mx-2 h-[14px] w-[1px] bg-zinc-200 dark:bg-zinc-800" />

          <AnimatePresence>
            {activeTab === "video" && (
              <motion.div
                initial={{ width: 0, opacity: 0, marginRight: 0 }}
                animate={{ width: "auto", opacity: 1, marginRight: 4 }}
                exit={{ width: 0, opacity: 0, marginRight: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="flex items-center overflow-hidden whitespace-nowrap"
              >
                <button
                  onClick={() => setShowCookieDialog(true)}
                  className="flex items-center gap-1.5 rounded-md px-2.5 py-2 text-[13px] font-medium text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-200"
                >
                  <Settings className="h-[15px] w-[15px] text-zinc-400 dark:text-zinc-500" />
                  <span>{t('sources.cookieConfig')}</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={() => setShowAddModal(true)}
            className="ml-1 flex items-center gap-1.5 overflow-hidden rounded-full bg-zinc-900 px-3.5 py-1.5 text-[13px] font-medium text-white shadow-sm transition-all hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
          >
            <Plus className="h-[14px] w-[14px] shrink-0" />
            <AnimatePresence mode="wait">
              <motion.span
                key={activeTab}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.15 }}
                className="whitespace-nowrap"
              >
                {activeTab === "text" ? t('sources.addTextSource') : t('sources.addMonitorSource')}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      </PageTopBar>

      {/* Centered Content Wrapper (Inside the red box) */}
      <div className="max-w-5xl mx-auto w-full px-2">
        
        {/* Main Title & Description */}
        <div className="flex flex-col gap-3 mb-10">
          <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            {t('sidebar.sourceConfig')}
          </h1>
          <div className="text-[14px] text-zinc-500 dark:text-zinc-400/80 leading-relaxed max-w-2xl flex flex-col gap-1">
            <p>{t('sources.desc1')}</p>
            <p>{t('sources.desc2')}</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative w-full mb-10">
          <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
            <Search className="w-[18px] h-[18px] text-zinc-400" />
          </div>
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full h-12 pl-12 pr-4 text-[14.5px] text-zinc-900 dark:text-zinc-100 bg-zinc-50/80 dark:bg-white/[0.03] border border-zinc-200/80 dark:border-white/[0.07] rounded-2xl focus:bg-white dark:focus:bg-white/[0.05] focus:ring-[3px] focus:ring-zinc-900/5 dark:focus:ring-white/[0.08] focus:border-zinc-400 dark:focus:border-white/[0.16] transition-all outline-none placeholder:text-zinc-400 placeholder:font-medium shadow-sm dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)]" 
            placeholder={activeTab === "text" ? t('sources.searchTextSources') : t('sources.searchVideoBloggers')}
          />
        </div>

        {/* Grids via Tabs */}
        <div className="w-full relative">
          <div className={activeTab === "text" ? "block" : "hidden"}>
            <SourcesTextTab 
              searchQuery={searchQuery}
              showAddModal={showAddModal}
              onCloseAddModal={() => setShowAddModal(false)}
              onOpenAddModal={() => setShowAddModal(true)}
            />
          </div>
          <div className={activeTab === "video" ? "block" : "hidden"}>
            <SourcesVideoTab 
              searchQuery={searchQuery}
              showAddModal={showAddModal}
              onCloseAddModal={() => setShowAddModal(false)}
              onOpenAddModal={() => setShowAddModal(true)}
              showCookieDialog={showCookieDialog}
              onOpenCookieDialog={() => setShowCookieDialog(true)}
              onCloseCookieDialog={() => setShowCookieDialog(false)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
