"use client";

import * as React from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { Play, Tv, PlaySquare, BookHeart } from "lucide-react";
import { MonitorAddDialog, MonitorCookieDialog, MonitorDeleteDialog, MonitorEditDialog } from "@/components/features/monitors/monitor-dialogs";
import { MonitorPageHeader, MonitorSelectionBar } from "@/components/features/monitors/monitor-page-chrome";
import { MonitorList } from "@/components/features/monitors/monitor-list";
import { useMonitorsPage } from "@/hooks/useMonitorsPage";
import { PageEmptyState, PageErrorState, PageStateBoundary } from "@/components/shared/page-states";

/* ── Platform helpers ── */
const PLATFORM_META: Record<string, { icon: React.ReactNode; color: string; disabledKey?: string }> = {
  bilibili:     { icon: <Tv className="w-5 h-5" />, color: "text-zinc-600 bg-zinc-100 border border-zinc-200 dark:text-zinc-400 dark:bg-white/5 dark:border-white/10" },
  youtube:      { icon: <PlaySquare className="w-5 h-5" />, color: "text-zinc-600 bg-zinc-100 border border-zinc-200 dark:text-zinc-400 dark:bg-white/5 dark:border-white/10" },
  xiaohongshu:  { icon: <BookHeart className="w-5 h-5" />, color: "text-zinc-600 bg-zinc-100 border border-zinc-200 dark:text-zinc-400 dark:bg-white/5 dark:border-white/10" },
};

export default function MonitorsPage() {
  const { t, language } = useTranslation();
  const {
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
  } = useMonitorsPage();

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-[#0b0c0f] overflow-hidden">
      <MonitorPageHeader
        activeCount={activeCount}
        configuredCount={configuredCount}
        totalCookiePlatforms={totalCookiePlatforms}
        t={t}
        onOpenCookieDialog={() => setShowCookieDialog(true)}
        onOpenAddDialog={openAddDialog}
      />

      {/* Content */}
      <div className="flex-1 overflow-y-scroll">
        <div className="px-8 py-6 max-w-6xl xl:max-w-7xl pb-24 mx-auto">
        <p className="text-[13px] text-muted-foreground mb-6">{t('monitors.desc')}</p>

        <PageStateBoundary
          loading={loading}
          error={loadError}
          isEmpty={monitors.length === 0}
          loadingLabel={t("common.loading")}
          errorState={
            <PageErrorState
              title={t("common.loadFailed")}
              description={loadError}
            />
          }
          emptyState={
            <PageEmptyState
              icon={Play}
              title={t("monitors.emptyTitle")}
              description={t("monitors.emptyDesc")}
              action={{
                label: t("monitors.addMonitor"),
                onClick: openAddDialog,
              }}
            />
          }
        >
          <MonitorList
            monitors={monitors}
            videos={videos}
            checking={checking}
            expanded={expanded}
            selectedVideos={selectedVideos}
            checkErrors={checkErrors}
            videoStatus={videoStatus}
            cookiePlatforms={cookiePlatforms}
            platformMeta={PLATFORM_META}
            t={t}
            language={language}
            onToggleExpanded={toggleExpanded}
            onCheckMonitor={handleCheck}
            onToggleVideo={toggleVideo}
            onEditMonitor={openEditDialog}
            onDeleteMonitor={setDeleteTarget}
            onOpenCookieDialog={() => setShowCookieDialog(true)}
          />
        </PageStateBoundary>
        </div>
      </div>

      <MonitorSelectionBar
        totalSelected={totalSelected}
        isAnyAnalyzing={isAnyAnalyzing}
        t={t}
        onAnalyzeAll={handleAnalyzeAll}
        onClearSelection={() => setSelectedVideos({})}
      />

      <MonitorAddDialog
        open={showAdd}
        addUrl={addUrl}
        addName={addName}
        addDiscoveryMode={addDiscoveryMode}
        addError={addError}
        adding={adding}
        detectedPlatform={detectedPlatform}
        t={t}
        onClose={() => setShowAdd(false)}
        onAddUrlChange={setAddUrl}
        onAddNameChange={setAddName}
        onAddDiscoveryModeChange={setAddDiscoveryMode}
        onClearAddError={() => setAddError("")}
        onSubmit={handleAdd}
      />

      <MonitorEditDialog
        editTarget={editTarget}
        editUrl={editUrl}
        editName={editName}
        editDiscoveryMode={editDiscoveryMode}
        editError={editError}
        editing={editing}
        t={t}
        onClose={() => setEditTarget(null)}
        onEditUrlChange={setEditUrl}
        onEditNameChange={setEditName}
        onEditDiscoveryModeChange={setEditDiscoveryMode}
        onSubmit={handleEdit}
      />

      <MonitorCookieDialog
        open={showCookieDialog}
        cookiePlatforms={cookiePlatforms}
        cookieInputs={cookieInputs}
        savingCookie={savingCookie}
        cookieSaveMsg={cookieSaveMsg}
        t={t}
        onClose={() => setShowCookieDialog(false)}
        onCookieInputChange={(key, value) => setCookieInputs((prev) => ({ ...prev, [key]: value }))}
        onReset={() => { setCookieInputs({}); setCookieSaveMsg(""); }}
        onSubmit={handleSaveCookie}
      />

      <MonitorDeleteDialog
        deleteTarget={deleteTarget}
        t={t}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
