"use client";

import type { ReactNode } from "react";
import type { CookiePlatformConfig, MonitorDiscoveryMode, MonitorTarget } from "@/lib/api";

import {
  MonitorAddDialog,
  MonitorCookieDialog,
  MonitorDeleteDialog,
  MonitorEditDialog,
} from "@/components/features/monitors/monitor-dialogs";

interface PlatformMetaItem {
  icon: ReactNode;
  color: string;
  disabledKey?: string;
}

interface SourcesVideoDialogsProps {
  showAddModal: boolean;
  showCookieDialog: boolean;
  addUrl: string;
  addName: string;
  addDiscoveryMode: MonitorDiscoveryMode;
  addError: string;
  adding: boolean;
  detectedPlatform: string | null;
  editTarget: MonitorTarget | null;
  editName: string;
  editUrl: string;
  editDiscoveryMode: MonitorDiscoveryMode;
  editError: string;
  editing: boolean;
  deleteTarget: MonitorTarget | null;
  cookiePlatforms: CookiePlatformConfig[];
  cookieInputs: Record<string, string>;
  savingCookie: boolean;
  cookieSaveMsg: string;
  t: (key: string, fallback?: string) => string;
  platformMeta: Record<string, PlatformMetaItem>;
  onCloseAddModal: () => void;
  onCloseCookieDialog: () => void;
  onAddUrlChange: (value: string) => void;
  onAddNameChange: (value: string) => void;
  onAddDiscoveryModeChange: (value: MonitorDiscoveryMode) => void;
  onSubmitAdd: () => void;
  onCloseEditDialog: () => void;
  onEditUrlChange: (value: string) => void;
  onEditNameChange: (value: string) => void;
  onEditDiscoveryModeChange: (value: MonitorDiscoveryMode) => void;
  onSubmitEdit: () => void;
  onCookieInputChange: (key: string, value: string) => void;
  onResetCookieDialog: () => void;
  onSubmitCookie: () => void;
  onCloseDeleteDialog: () => void;
  onSubmitDelete: () => void;
}

export function SourcesVideoDialogs({
  showAddModal,
  showCookieDialog,
  addUrl,
  addName,
  addDiscoveryMode,
  addError,
  adding,
  detectedPlatform,
  editTarget,
  editName,
  editUrl,
  editDiscoveryMode,
  editError,
  editing,
  deleteTarget,
  cookiePlatforms,
  cookieInputs,
  savingCookie,
  cookieSaveMsg,
  t,
  platformMeta,
  onCloseAddModal,
  onCloseCookieDialog,
  onAddUrlChange,
  onAddNameChange,
  onAddDiscoveryModeChange,
  onSubmitAdd,
  onCloseEditDialog,
  onEditUrlChange,
  onEditNameChange,
  onEditDiscoveryModeChange,
  onSubmitEdit,
  onCookieInputChange,
  onResetCookieDialog,
  onSubmitCookie,
  onCloseDeleteDialog,
  onSubmitDelete,
}: SourcesVideoDialogsProps) {
  return (
    <>
      <MonitorAddDialog
        open={showAddModal}
        addUrl={addUrl}
        addName={addName}
        addDiscoveryMode={addDiscoveryMode}
        addError={addError}
        adding={adding}
        detectedPlatform={detectedPlatform}
        t={t}
        platformMeta={platformMeta}
        onClose={onCloseAddModal}
        onAddUrlChange={onAddUrlChange}
        onAddNameChange={onAddNameChange}
        onAddDiscoveryModeChange={onAddDiscoveryModeChange}
        onClearAddError={() => {}}
        onSubmit={onSubmitAdd}
      />

      <MonitorEditDialog
        editTarget={editTarget}
        editUrl={editUrl}
        editName={editName}
        editDiscoveryMode={editDiscoveryMode}
        editError={editError}
        editing={editing}
        t={t}
        onClose={onCloseEditDialog}
        onEditUrlChange={onEditUrlChange}
        onEditNameChange={onEditNameChange}
        onEditDiscoveryModeChange={onEditDiscoveryModeChange}
        onSubmit={onSubmitEdit}
      />

      <MonitorCookieDialog
        open={showCookieDialog}
        cookiePlatforms={cookiePlatforms}
        cookieInputs={cookieInputs}
        savingCookie={savingCookie}
        cookieSaveMsg={cookieSaveMsg}
        t={t}
        platformMeta={platformMeta}
        onClose={onCloseCookieDialog}
        onCookieInputChange={onCookieInputChange}
        onReset={onResetCookieDialog}
        onSubmit={onSubmitCookie}
      />

      <MonitorDeleteDialog
        deleteTarget={deleteTarget}
        t={t}
        onClose={onCloseDeleteDialog}
        onConfirm={onSubmitDelete}
      />
    </>
  );
}
