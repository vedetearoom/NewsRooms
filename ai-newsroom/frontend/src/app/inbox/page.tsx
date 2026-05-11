"use client";

import * as React from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useTabsStore } from "@/store/tabs";
import { useUrlTab } from "@/hooks/useUrlTab";
import { Suspense } from "react";
import { InboxTextTab } from "@/components/features/inbox/inbox-text-tab";
import { InboxVideoTab } from "@/components/features/inbox/inbox-video-tab";
import { Newspaper, Clapperboard, Link2 } from "lucide-react";
import { motion } from "framer-motion";
import { PageShellFallback } from "@/components/shared/page-shell-fallback";
import { PageTopBar, PageTopBarBadge, PageTopBarTabs } from "@/components/shared/page-top-bar";

export default function InboxPage() {
  return (
    <Suspense fallback={<PageShellFallback />}>
      <InboxContent />
    </Suspense>
  );
}

function InboxContent() {
  const { t } = useTranslation();
  const setInboxTab = useTabsStore(s => s.setInboxTab);
  const [activeTab, setActiveTab] = useUrlTab<"text" | "video">("tab", "text", setInboxTab);

  const textCount = useTabsStore(s => s.inboxTextCount);
  const setTextCount = useTabsStore(s => s.setInboxTextCount);
  const videoCount = useTabsStore(s => s.inboxVideoCount);
  const setVideoCount = useTabsStore(s => s.setInboxVideoCount);
  const [showVideoImportBar, setShowVideoImportBar] = React.useState(false);

  const displayCount = activeTab === "text" ? textCount : videoCount;

  return (
    <div className="w-full flex-1 flex flex-col pt-4 min-h-screen bg-white dark:bg-[#0b0c0f]">
      <PageTopBar
        title={t('sidebar.intelligenceInbox')}
        badge={
          displayCount !== null ? (
            <PageTopBarBadge
              animated
              text={<>{displayCount}{t('inbox.pendingCount')}</>}
            />
          ) : null
        }
        innerClassName="max-w-6xl xl:max-w-7xl mx-auto px-4 sm:px-8"
      >
        <div className="flex items-center gap-1 relative">
          <PageTopBarTabs
            value={activeTab}
            onChange={(nextTab) => {
              setActiveTab(nextTab);
              if (nextTab !== "video") {
                setShowVideoImportBar(false);
              }
            }}
            options={[
              { value: "text", label: t('inbox.pendingText'), icon: Newspaper },
              { value: "video", label: t('inbox.pendingVideo'), icon: Clapperboard },
            ]}
          />

          <motion.div
            initial={false}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="ml-1 flex shrink-0 items-center"
          >
            <span className="mx-1.5 h-4 w-px shrink-0 border-l border-dashed border-zinc-200 dark:border-white/10" />
            <button
              type="button"
              onClick={() => {
                if (activeTab !== "video") return;
                setShowVideoImportBar(prev => !prev);
              }}
              disabled={activeTab !== "video"}
              aria-disabled={activeTab !== "video"}
              className={
                activeTab !== "video"
                  ? "flex min-w-[84px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-2 text-[13px] font-medium text-zinc-300 cursor-not-allowed dark:text-zinc-600"
                  : showVideoImportBar
                    ? "flex min-w-[84px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-2 text-[13px] font-medium bg-zinc-100 text-zinc-900 shadow-sm dark:bg-white/10 dark:text-zinc-100"
                    : "flex min-w-[84px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-2 text-[13px] font-medium text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-200"
              }
            >
              <Link2 className="h-[15px] w-[15px] text-current" />
              <span>{t("monitors.manualImportAction")}</span>
            </button>
          </motion.div>
        </div>
      </PageTopBar>

      {/* Centered Content Wrapper */}
      <div className="max-w-6xl xl:max-w-7xl mx-auto w-full px-4 sm:px-8">
        
        {/* Grids via Tabs */}
        <div className="w-full relative">
          <div className={activeTab === "text" ? "block" : "hidden"}>
            <InboxTextTab onCountChange={setTextCount} />
          </div>
          <div className={activeTab === "video" ? "block" : "hidden"}>
            <InboxVideoTab onCountChange={setVideoCount} showImportBar={showVideoImportBar} />
          </div>
        </div>
      </div>
    </div>
  );
}
