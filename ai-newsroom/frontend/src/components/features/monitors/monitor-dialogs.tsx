"use client";

import * as React from "react";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CookiePlatformConfig, MonitorDiscoveryMode, MonitorTarget } from "@/lib/api";

interface MonitorDialogPlatformMeta {
  icon: React.ReactNode;
  color?: string;
  disabledKey?: string;
}

const DEFAULT_PLATFORM_META: Record<string, MonitorDialogPlatformMeta> = {
  bilibili: { icon: "📺" },
  youtube: { icon: "▶️" },
  xiaohongshu: { icon: "📕" },
};

function getAvailableDiscoveryModes(platform: string | null): MonitorDiscoveryMode[] {
  if (platform === "bilibili") return ["rsshub", "cookie"];
  if (platform === "xiaohongshu") return ["cookie"];
  if (platform === "youtube") return ["rsshub"];
  return [];
}

function getDiscoveryModeLabel(
  mode: MonitorDiscoveryMode,
  t: (key: string, fallback?: string) => string,
): string {
  return mode === "cookie"
    ? t("monitors.discoveryModeCookie", "Cookie")
    : t("monitors.discoveryModeRsshub", "RSSHub");
}

interface MonitorAddDialogProps {
  open: boolean;
  addUrl: string;
  addName: string;
  addDiscoveryMode: MonitorDiscoveryMode;
  addError: string;
  adding: boolean;
  detectedPlatform: string | null;
  t: (key: string, fallback?: string) => string;
  platformMeta?: Record<string, MonitorDialogPlatformMeta>;
  onClose: () => void;
  onAddUrlChange: (value: string) => void;
  onAddNameChange: (value: string) => void;
  onAddDiscoveryModeChange: (value: MonitorDiscoveryMode) => void;
  onClearAddError: () => void;
  onSubmit: () => void;
}

export function MonitorAddDialog({
  open,
  addUrl,
  addName,
  addDiscoveryMode,
  addError,
  adding,
  detectedPlatform,
  t,
  platformMeta = DEFAULT_PLATFORM_META,
  onClose,
  onAddUrlChange,
  onAddNameChange,
  onAddDiscoveryModeChange,
  onClearAddError,
  onSubmit,
}: MonitorAddDialogProps) {
  if (!open) return null;
  const availableModes = getAvailableDiscoveryModes(detectedPlatform);
  const modeLocked = availableModes.length <= 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white dark:bg-[#1a1b1e] rounded-2xl shadow-2xl border border-zinc-200/60 dark:border-white/[0.08] p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-[16px] font-bold">{t("monitors.addMonitor")}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/10 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[12px] text-muted-foreground mb-5">{t("monitors.addMonitorDesc")}</p>

        <label className="block text-[12px] font-medium mb-1.5">{t("monitors.homepageUrl")} *</label>
        <input
          type="url"
          value={addUrl}
          onChange={(event) => {
            onAddUrlChange(event.target.value);
            onClearAddError();
          }}
          placeholder={t("monitors.homepageUrlPlaceholder")}
          className="w-full px-3 py-2.5 rounded-xl border border-zinc-200/60 dark:border-white/[0.08] bg-zinc-50 dark:bg-white/[0.03] text-[13px] outline-none focus:ring-2 focus:ring-zinc-500/30 dark:focus:ring-white/20 transition-all mb-2"
          autoFocus
        />

        {addUrl.trim() && (
          <div className="mb-4">
            {detectedPlatform ? (
              platformMeta[detectedPlatform]?.disabledKey ? (
                <span className="inline-flex items-center gap-1.5 text-[12px] text-red-500 font-medium">
                  ❌ {t(`monitors.platforms.${platformMeta[detectedPlatform].disabledKey}`)}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[12px] text-emerald-500 font-medium">
                  ✅ {t("monitors.platformDetected")}: {platformMeta[detectedPlatform]?.icon} {t(`monitors.platforms.${detectedPlatform}`)}
                </span>
              )
            ) : (
              <span className="text-[12px] text-amber-500">⚠️ {t("monitors.platformUnknown")}</span>
            )}
          </div>
        )}

        {detectedPlatform && availableModes.length > 0 && !platformMeta[detectedPlatform]?.disabledKey && (
          <div className="mb-4">
            <label className="block text-[12px] font-medium mb-1.5">{t("monitors.discoveryMode")}</label>
            <div className="flex gap-2">
              {availableModes.map((mode) => {
                const isActive = addDiscoveryMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    disabled={modeLocked}
                    onClick={() => onAddDiscoveryModeChange(mode)}
                    className={cn(
                      "flex-1 rounded-xl border px-3 py-2 text-[12px] font-medium transition-colors",
                      isActive
                        ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                        : "border-zinc-200/60 bg-zinc-50 text-zinc-600 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-zinc-300",
                      modeLocked && "cursor-not-allowed opacity-70",
                    )}
                  >
                    {getDiscoveryModeLabel(mode, t)}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {detectedPlatform === "bilibili"
                ? t("monitors.discoveryModeBilibiliHint", "B站默认走 RSSHub；若失败，可切换为 Cookie 方式。")
                : t("monitors.discoveryModeLockedHint", "该平台当前仅支持这一种拉取方式。")}
            </p>
          </div>
        )}

        <label className="block text-[12px] font-medium mb-1.5">{t("monitors.bloggerName")}</label>
        <input
          type="text"
          value={addName}
          onChange={(event) => onAddNameChange(event.target.value)}
          placeholder={t("monitors.bloggerNamePlaceholder")}
          className="w-full px-3 py-2.5 rounded-xl border border-zinc-200/60 dark:border-white/[0.08] bg-zinc-50 dark:bg-white/[0.03] text-[13px] outline-none focus:ring-2 focus:ring-zinc-500/30 dark:focus:ring-white/20 transition-all mb-4"
        />

        {addError && (
          <p className="text-[12px] text-red-500 mb-3 bg-red-50 dark:bg-red-500/10 px-3 py-2 rounded-lg">{addError}</p>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            {t("monitors.cancel")}
          </button>
          <button
            onClick={onSubmit}
            disabled={!addUrl.trim() || !detectedPlatform || !!platformMeta[detectedPlatform]?.disabledKey || adding}
            className="px-4 py-2 rounded-lg text-[13px] font-semibold bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {adding ? "..." : t("monitors.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

interface MonitorEditDialogProps {
  editTarget: MonitorTarget | null;
  editUrl: string;
  editName: string;
  editDiscoveryMode: MonitorDiscoveryMode;
  editError: string;
  editing: boolean;
  t: (key: string, fallback?: string) => string;
  onClose: () => void;
  onEditUrlChange: (value: string) => void;
  onEditNameChange: (value: string) => void;
  onEditDiscoveryModeChange: (value: MonitorDiscoveryMode) => void;
  onSubmit: () => void;
}

export function MonitorEditDialog({
  editTarget,
  editUrl,
  editName,
  editDiscoveryMode,
  editError,
  editing,
  t,
  onClose,
  onEditUrlChange,
  onEditNameChange,
  onEditDiscoveryModeChange,
  onSubmit,
}: MonitorEditDialogProps) {
  if (!editTarget) return null;
  const editPlatform =
    editUrl.includes("bilibili")
      ? "bilibili"
      : editUrl.includes("youtube")
        ? "youtube"
        : editUrl.includes("xiaohongshu")
          ? "xiaohongshu"
          : editTarget.platform;
  const availableModes = getAvailableDiscoveryModes(editPlatform);
  const modeLocked = availableModes.length <= 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white dark:bg-[#1a1b1e] rounded-2xl shadow-2xl border border-zinc-200/60 dark:border-white/[0.08] p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-[18px] font-bold mb-6 tracking-[-0.02em]">{t("monitors.editMonitor")}</h2>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-[13px] font-medium mb-1.5">{t("monitors.url")}</label>
            <input
              type="text"
              value={editUrl}
              onChange={(event) => onEditUrlChange(event.target.value)}
              placeholder={t("monitors.homepageUrlPlaceholder")}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200/60 dark:border-white/[0.08] bg-transparent text-[13px] outline-none focus:ring-2 focus:ring-zinc-500/30 dark:focus:ring-white/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1.5">{t("monitors.nameOptional")}</label>
            <input
              type="text"
              value={editName}
              onChange={(event) => onEditNameChange(event.target.value)}
              placeholder={editTarget.name}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200/60 dark:border-white/[0.08] bg-transparent text-[13px] outline-none focus:ring-2 focus:ring-zinc-500/30 dark:focus:ring-white/20 transition-all"
            />
          </div>

          {availableModes.length > 0 && (
            <div>
              <label className="block text-[13px] font-medium mb-1.5">{t("monitors.discoveryMode")}</label>
              <div className="flex gap-2">
                {availableModes.map((mode) => {
                  const isActive = editDiscoveryMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      disabled={modeLocked}
                      onClick={() => onEditDiscoveryModeChange(mode)}
                      className={cn(
                        "flex-1 rounded-lg border px-3 py-2 text-[12px] font-medium transition-colors",
                        isActive
                          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                          : "border-zinc-200/60 bg-zinc-50 text-zinc-600 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-zinc-300",
                        modeLocked && "cursor-not-allowed opacity-70",
                      )}
                    >
                      {getDiscoveryModeLabel(mode, t)}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {editPlatform === "bilibili"
                  ? t("monitors.discoveryModeBilibiliHint", "B站默认走 RSSHub；若失败，可切换为 Cookie 方式。")
                  : t("monitors.discoveryModeLockedHint", "该平台当前仅支持这一种拉取方式。")}
              </p>
            </div>
          )}
        </div>

        {editError && (
          <p className="text-[12px] text-red-500 mb-3 bg-red-50 dark:bg-red-500/10 px-3 py-2 rounded-lg">{editError}</p>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            {t("monitors.cancel")}
          </button>
          <button
            onClick={onSubmit}
            disabled={!editUrl.trim() || editing}
            className="px-4 py-2 rounded-lg text-[13px] font-semibold bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {editing ? t("monitors.saving") : t("monitors.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

interface MonitorCookieDialogProps {
  open: boolean;
  cookiePlatforms: CookiePlatformConfig[];
  cookieInputs: Record<string, string>;
  savingCookie: boolean;
  cookieSaveMsg: string;
  t: (key: string, fallback?: string) => string;
  platformMeta?: Record<string, MonitorDialogPlatformMeta>;
  onClose: () => void;
  onCookieInputChange: (key: string, value: string) => void;
  onReset: () => void;
  onSubmit: () => void;
}

export function MonitorCookieDialog({
  open,
  cookiePlatforms,
  cookieInputs,
  savingCookie,
  cookieSaveMsg,
  t,
  platformMeta = DEFAULT_PLATFORM_META,
  onClose,
  onCookieInputChange,
  onReset,
  onSubmit,
}: MonitorCookieDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white dark:bg-[#1a1b1e] rounded-2xl shadow-2xl border border-zinc-200/60 dark:border-white/[0.08] p-6 max-h-[85vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-[16px] font-bold">{t("monitors.cookieConfigTitle")}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/10 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[12px] text-muted-foreground mb-5">
          {t("monitors.cookieConfigDesc")}
        </p>

        <div className="space-y-4">
          {cookiePlatforms.map((platform) => {
            const meta = platformMeta[platform.key];
            const isDisabled = Boolean(meta?.disabledKey);

            return (
              <div
                key={platform.key}
                className={cn(
                  "rounded-xl border overflow-hidden relative",
                  isDisabled ? "border-zinc-200/40 dark:border-white/[0.04] bg-zinc-50/50 dark:bg-white/[0.01]" : "border-zinc-200/60 dark:border-white/[0.06]",
                )}
              >
                {isDisabled && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/40 dark:bg-black/20 backdrop-blur-[1px]">
                    <span className="px-3 py-1.5 rounded-full text-[11px] font-medium bg-red-500/10 text-red-500 dark:bg-red-500/20 shadow-sm border border-red-500/20 backdrop-blur-md">
                      {t(`monitors.platforms.${meta?.disabledKey}`)}
                    </span>
                  </div>
                )}

                <div className={cn("px-4 py-2.5 flex items-center justify-between", isDisabled ? "opacity-40 grayscale" : "bg-zinc-50/50 dark:bg-white/[0.02]")}>
                  <div className="flex items-center gap-2">
                    <div className={cn("w-7 h-7 rounded-[6px] flex items-center justify-center shrink-0", meta?.color)}>
                      {meta?.icon || "🎬"}
                    </div>
                    <span className="text-[13px] font-semibold">{t(`monitors.platforms.${platform.key}`)}</span>
                  </div>
                </div>

                <div className={cn("px-4 py-3", isDisabled && "opacity-30")}>
                  <p className="text-[11px] text-muted-foreground mb-2">{t(`monitors.hints.${platform.key}`, platform.hint)}</p>
                  {platform.is_configured && !cookieInputs[platform.key] && (
                    <p className="text-[10px] text-emerald-500/70 mb-2 font-mono truncate">
                      {t("monitors.cookieCurrent")} {platform.cookie_masked}
                    </p>
                  )}
                  {platform.last_validation_status && (
                    <p
                      className={cn(
                        "mb-2 text-[10px]",
                        platform.last_validation_status === "invalid"
                          ? "text-red-500"
                          : "text-zinc-500",
                      )}
                    >
                      {t("monitors.credentialStatus", "状态")}: {platform.last_validation_status}
                      {platform.last_validation_error ? ` · ${platform.last_validation_error}` : ""}
                    </p>
                  )}
                  <textarea
                    value={cookieInputs[platform.key] || ""}
                    onChange={(event) => onCookieInputChange(platform.key, event.target.value)}
                    placeholder={platform.is_configured ? t("monitors.cookiePlaceholderKeep") : t("monitors.cookiePlaceholderPaste")}
                    rows={2}
                    disabled={isDisabled}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200/60 dark:border-white/[0.08] bg-zinc-50 dark:bg-white/[0.03] text-[11px] font-mono outline-none focus:ring-2 focus:ring-zinc-500/30 dark:focus:ring-white/20 transition-all resize-none disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {cookieSaveMsg && (
          <div className="mt-3 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-[12px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {cookieSaveMsg}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={() => {
              onClose();
              onReset();
            }}
            className="px-4 py-2 rounded-lg text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            {t("monitors.cancel")}
          </button>
          <button
            onClick={onSubmit}
            disabled={savingCookie || Object.values(cookieInputs).every((value) => !value.trim())}
            className="px-4 py-2 rounded-lg text-[13px] font-semibold bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white hover:bg-zinc-800 dark:hover:bg-white transition-colors disabled:opacity-50 cursor-pointer"
          >
            {savingCookie ? t("monitors.savingCredentials", "Saving credentials...") : t("monitors.saveCookies")}
          </button>
        </div>
      </div>
    </div>
  );
}

interface MonitorDeleteDialogProps {
  deleteTarget: MonitorTarget | null;
  t: (key: string, fallback?: string) => string;
  onClose: () => void;
  onConfirm: () => void;
}

export function MonitorDeleteDialog({
  deleteTarget,
  t,
  onClose,
  onConfirm,
}: MonitorDeleteDialogProps) {
  if (!deleteTarget) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-white dark:bg-[#1a1b1e] rounded-2xl shadow-2xl border border-zinc-200/60 dark:border-white/[0.08] p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-[15px] font-bold mb-2">{t("monitors.deleteConfirmTitle")}</h3>
        <p className="text-[13px] text-muted-foreground mb-5">
          {t("monitors.deleteConfirmDesc")}
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-[13px] font-medium hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            {t("monitors.cancel")}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-[13px] font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors cursor-pointer"
          >
            {t("monitors.deleteConfirmBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}
