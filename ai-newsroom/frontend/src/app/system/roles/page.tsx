"use client";

import * as React from "react";
import { Lock, PencilLine, Plus, Trash2 } from "lucide-react";
import { api, type Permission, type Role } from "@/lib/api";
import { useAuthState } from "@/lib/auth";
import { useTranslation } from "@/hooks/useTranslation";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

type RoleFormErrors = Partial<Record<"name" | "code", string>>;

function permissionLabel(code: string, t: (key: string) => string) {
  const labels: Record<string, string> = {
    "discover.view": t("system.permissionDiscover"),
    "workspace.view": t("system.permissionWorkspace"),
    "network.view": t("system.permissionNetwork"),
    "agents.view": t("system.permissionAgents"),
    "system.manage": t("system.permissionSystem"),
  };
  return labels[code] || code;
}

function roleLabel(role: Role, t: (key: string) => string) {
  if (role.code === "super_admin") return t("system.superAdmin");
  if (role.code === "user") return t("system.normalUser");
  return role.name;
}

function EmptyPermissionState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50/80 px-8 dark:bg-[#0b0c0f]">
      <div className="max-w-md rounded-[32px] border border-zinc-200/70 bg-white px-8 py-10 text-center shadow-[0_24px_70px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-[#101216] dark:shadow-none">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{description}</p>
      </div>
    </div>
  );
}

function FieldLabel({ label, required = false }: { label: string; required?: boolean }) {
  return (
    <div className="mb-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-500">
      <span>{label}</span>
      {required ? <span className="text-red-500">*</span> : null}
    </div>
  );
}

const countBadgeClass =
  "inline-flex items-center justify-center rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-500 dark:bg-white/10 dark:text-zinc-400";

const primaryButtonClass =
  "inline-flex items-center rounded-full bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200";

const topActionButtonClass =
  "inline-flex items-center gap-1.5 overflow-hidden rounded-full bg-zinc-900 px-3.5 py-1.5 text-[13px] font-medium text-white shadow-sm transition-all hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100";

const tableHeaderClass =
  "py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-500";

const actionButtonClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-all duration-150 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900 dark:hover:bg-white/[0.06] dark:hover:text-zinc-100";

const modalInputClass =
  "w-full rounded-2xl bg-zinc-50/85 px-4 py-3 text-sm text-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(15,23,42,0.06)] outline-none transition-all placeholder:text-zinc-400 focus:bg-white focus:ring-1 focus:ring-zinc-300 disabled:cursor-not-allowed disabled:bg-zinc-100/90 disabled:text-zinc-400 dark:bg-white/[0.06] dark:text-white dark:placeholder:text-white/20 dark:focus:bg-white/[0.08] dark:focus:ring-white/20";

const DEFAULT_QUOTA_LIMITS: Record<string, number | null> = {
  text_sources: 3,
  video_monitors: 1,
  tasks: 3,
  inspirations: 10,
  article_cards: 30,
  video_cards: 5,
  manual_video_items: 5,
  custom_agents: 3,
  installed_plugins: 3,
  agent_threads: 20,
  active_background_jobs: 3,
  daily_scrapes: 5,
  daily_monitor_checks: 5,
  daily_article_processes: 3,
  daily_video_analyses: 5,
  daily_image_generations: 5,
  daily_image_uploads: 20,
  daily_agent_messages: 30,
  daily_ai_runs: 10,
};

const QUOTA_GROUPS = [
  {
    title: "资源数量",
    items: [
      ["text_sources", "图文站点"],
      ["video_monitors", "视频博主"],
      ["tasks", "任务"],
      ["inspirations", "灵感"],
      ["article_cards", "图文情报"],
      ["video_cards", "视频情报"],
      ["manual_video_items", "手动视频素材"],
      ["custom_agents", "自定义智能体"],
      ["installed_plugins", "插件"],
      ["agent_threads", "工作台对话"],
      ["active_background_jobs", "进行中的后台任务"],
    ],
  },
  {
    title: "每日动作",
    items: [
      ["daily_scrapes", "抓取"],
      ["daily_monitor_checks", "监控检查"],
      ["daily_article_processes", "文章处理"],
      ["daily_video_analyses", "视频解构"],
      ["daily_image_generations", "生图"],
      ["daily_image_uploads", "图片上传"],
      ["daily_agent_messages", "智能体对话/改写"],
      ["daily_ai_runs", "写作/审核 AI 运行"],
    ],
  },
] as const;

function quotaLimitsToForm(limits?: Record<string, number | null> | null) {
  const source = limits || DEFAULT_QUOTA_LIMITS;
  return Object.fromEntries(
    Object.keys(DEFAULT_QUOTA_LIMITS).map((key) => {
      const value = source[key];
      return [key, value === null || value === undefined ? "" : String(value)];
    }),
  ) as Record<string, string>;
}

function quotaFormToPayload(limits: Record<string, string>) {
  return Object.fromEntries(
    Object.keys(DEFAULT_QUOTA_LIMITS).map((key) => {
      const value = limits[key]?.trim();
      return [key, value ? Math.max(0, Number.parseInt(value, 10) || 0) : null];
    }),
  ) as Record<string, number | null>;
}

export default function SystemRolesPage() {
  const { ready, hasPermission } = useAuthState();
  const { t } = useTranslation();
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [permissions, setPermissions] = React.useState<Permission[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingRole, setEditingRole] = React.useState<Role | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Role | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [formErrors, setFormErrors] = React.useState<RoleFormErrors>({});
  const [form, setForm] = React.useState({
    name: "",
    code: "",
    description: "",
    permission_codes: [] as string[],
    quota_limits: quotaLimitsToForm(),
  });

  const canManage = hasPermission("system.manage");

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [nextRoles, nextPermissions] = await Promise.all([api.admin.getRoles(), api.admin.getPermissions()]);
      setRoles(nextRoles.filter((role) => role.code !== "admin"));
      setPermissions(nextPermissions);
    } catch (error) {
      console.error(error);
      toast.error(t("system.loadRolesFailed"), t("system.tryLater"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    if (ready && canManage) {
      loadData();
    } else if (ready) {
      setLoading(false);
    }
  }, [canManage, loadData, ready]);

  const openCreate = () => {
    setEditingRole(null);
    setFormErrors({});
    setForm({
      name: "",
      code: "",
      description: "",
      permission_codes: [],
      quota_limits: quotaLimitsToForm(),
    });
    setModalOpen(true);
  };

  const openEdit = (role: Role) => {
    setEditingRole(role);
    setFormErrors({});
    setForm({
      name: role.name,
      code: role.code,
      description: role.description || "",
      permission_codes: role.permissions?.map((permission) => permission.code) || [],
      quota_limits: quotaLimitsToForm(role.quota_limits),
    });
    setModalOpen(true);
  };

  const validateRoleForm = () => {
    const nextErrors: RoleFormErrors = {};
    if (form.name.trim().length < 2) nextErrors.name = t("system.validationRoleName");
    if (!editingRole && form.code.trim().length < 2) nextErrors.code = t("system.validationRoleCode");
    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateRoleForm()) {
      toast.error(t("system.formInvalidTitle"), t("system.formInvalidDesc"));
      return;
    }
    setSaving(true);
    try {
      if (editingRole) {
        await api.admin.updateRole(editingRole.id, {
          name: form.name.trim(),
          description: form.description.trim(),
          permission_codes: form.permission_codes,
          quota_limits: quotaFormToPayload(form.quota_limits),
        });
        toast.success(t("system.roleUpdated"));
      } else {
        await api.admin.createRole({
          name: form.name.trim(),
          code: form.code.trim(),
          description: form.description.trim(),
          permission_codes: form.permission_codes,
          quota_limits: quotaFormToPayload(form.quota_limits),
        });
        toast.success(t("system.roleCreated"));
      }
      setModalOpen(false);
      setFormErrors({});
      await loadData();
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : t("system.saveRoleFailedDesc");
      toast.error(t("system.saveRoleFailed"), message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.admin.deleteRole(deleteTarget.id);
      toast.success(t("system.roleDeleted"));
      setDeleteTarget(null);
      await loadData();
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : t("system.tryLater");
      toast.error(t("system.deleteRoleFailed"), message);
    } finally {
      setDeleting(false);
    }
  };

  if (!ready || loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">{t("system.loading")}</div>;
  }

  if (!canManage) {
    return (
      <EmptyPermissionState
        title={t("system.noAccessTitle")}
        description={t("system.noAccessRolesDesc")}
      />
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white dark:bg-[#0b0c0f]">
      <div className="shrink-0 px-8 pt-8 lg:px-12">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              {t("system.roleManagement")}
              <div className={cn(countBadgeClass, "ml-3")}>
                {roles.length} {t("system.rolesUnit")}
              </div>
            </h1>
            <p className="mt-1 max-w-2xl text-[13px] text-zinc-500 dark:text-zinc-400">{t("system.roleManagementDesc")}</p>
          </div>
          <button onClick={openCreate} className={topActionButtonClass}>
            <Plus className="h-[14px] w-[14px] shrink-0" />
            {t("system.createRole")}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-zinc-50/50 dark:bg-white/[0.01]">
        <div className="pb-8 pt-6">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px]">
                <colgroup>
                  <col className="w-[30%]" />
                  <col className="w-auto" />
                  <col className="w-[112px]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-zinc-200/60 dark:border-white/[0.06]">
                    <th className={cn(tableHeaderClass, "pl-8 pr-5 lg:pl-12")}>{t("system.role")}</th>
                    <th className={cn(tableHeaderClass, "px-5")}>{t("system.permissions")}</th>
                    <th className={cn(tableHeaderClass, "pl-5 pr-8 lg:pr-12")}>{t("system.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((role) => {
                    const isLocked = role.code === "super_admin";
                    const canDelete = !role.is_system && role.code !== "super_admin";

                    return (
                      <tr
                        key={role.id}
                        className={cn(
                          "border-b border-zinc-200/60 transition-colors last:border-b-0 dark:border-white/[0.05]",
                          isLocked ? "hover:bg-zinc-100/40 dark:hover:bg-white/[0.015]" : "hover:bg-zinc-100/60 dark:hover:bg-white/[0.03]",
                        )}
                      >
                        <td className="py-4 pl-8 pr-5 align-middle lg:pl-12">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={cn("truncate text-[15px] font-medium", isLocked ? "text-zinc-400 dark:text-zinc-500" : "text-zinc-900 dark:text-white")}>
                                {roleLabel(role, t)}
                              </span>
                              {isLocked ? (
                                <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:bg-white/[0.04] dark:text-zinc-500">
                                  {t("system.locked")}
                                </span>
                              ) : null}
                            </div>
                            <div className={cn("mt-1 text-[12px] leading-5", isLocked ? "text-zinc-400 dark:text-zinc-500" : "text-zinc-500 dark:text-zinc-400")}>
                              {role.description || t("system.noRoleDescription")}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 align-middle">
                          <div className="flex flex-wrap gap-1.5">
                            {(role.permissions || []).map((permission) => (
                              <span
                                key={permission.code}
                                className={cn(
                                  "inline-flex items-center rounded-md px-2 py-1 text-[11px] font-medium",
                                  isLocked
                                    ? "bg-zinc-100 text-zinc-400 shadow-none dark:bg-white/[0.03] dark:text-zinc-500"
                                    : "bg-white text-zinc-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:bg-white/[0.04] dark:text-zinc-300 dark:shadow-none",
                                )}
                              >
                                {permissionLabel(permission.code, t)}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-4 pl-5 pr-8 align-middle lg:pr-12">
                          <div className="flex items-center justify-start gap-1">
                            {isLocked ? (
                              <span
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-300 dark:text-zinc-600"
                                aria-label={t("system.notEditable")}
                                title={t("system.notEditable")}
                              >
                                <Lock className="h-4 w-4" />
                              </span>
                            ) : (
                              <>
                                <button onClick={() => openEdit(role)} aria-label={t("system.editPermissions")} title={t("system.editPermissions")} className={actionButtonClass}>
                                  <PencilLine className="h-4 w-4" />
                                </button>
                                {canDelete ? (
                                  <button
                                    onClick={() => setDeleteTarget(role)}
                                    aria-label={t("system.delete")}
                                    title={t("system.delete")}
                                    className={cn(actionButtonClass, "hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-300")}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                ) : null}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center px-4">
          <button className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative z-10 max-h-[92vh] w-full max-w-[760px] overflow-y-auto rounded-[32px] border border-zinc-200/80 bg-white p-7 text-zinc-950 shadow-[0_30px_90px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-[#121418] dark:text-white dark:shadow-2xl dark:shadow-black/60">
            <h2 className="text-xl font-semibold tracking-tight">{editingRole ? t("system.editRole") : t("system.createRole")}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{t("system.roleFormDesc")}</p>
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <FieldLabel label={t("system.roleName")} required />
                  <input
                    value={form.name}
                    onChange={(e) => {
                      const value = e.target.value;
                      setForm((prev) => ({ ...prev, name: value }));
                      setFormErrors((prev) => ({ ...prev, name: undefined }));
                    }}
                    placeholder={t("system.roleName")}
                    className={modalInputClass}
                  />
                  {formErrors.name ? <p className="mt-2 text-xs text-red-500">{formErrors.name}</p> : null}
                </div>
                <div>
                  <FieldLabel label={t("system.roleCode")} required={!editingRole} />
                  <input
                    value={form.code}
                    disabled={Boolean(editingRole?.is_system)}
                    onChange={(e) => {
                      const value = e.target.value;
                      setForm((prev) => ({ ...prev, code: value }));
                      setFormErrors((prev) => ({ ...prev, code: undefined }));
                    }}
                    placeholder={t("system.roleCode")}
                    className={cn(modalInputClass, "font-mono text-[13px]")}
                  />
                  {formErrors.code ? <p className="mt-2 text-xs text-red-500">{formErrors.code}</p> : null}
                </div>
              </div>
              <div>
                <FieldLabel label={t("system.roleDescription")} />
                <input
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder={t("system.roleDescription")}
                  className={modalInputClass}
                />
              </div>
              <div>
                <FieldLabel label={t("system.permissions")} />
                <div className="rounded-[28px] bg-zinc-50/80 p-2.5 dark:bg-white/[0.03]">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {permissions.map((permission) => {
                      const checked = form.permission_codes.includes(permission.code);
                      return (
                        <button
                          key={permission.code}
                          type="button"
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              permission_codes: checked
                                ? prev.permission_codes.filter((code) => code !== permission.code)
                                : [...prev.permission_codes, permission.code],
                            }))
                          }
                          className="flex w-full items-center justify-between rounded-[20px] bg-white px-4 py-3 text-left text-zinc-800 shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900 dark:bg-white/[0.04] dark:text-white/80 dark:shadow-none dark:hover:bg-white/[0.06] dark:hover:text-white dark:focus-visible:ring-white"
                        >
                          <div className="min-w-0 pr-3">
                            <div className="truncate text-[15px] font-medium">{permissionLabel(permission.code, t)}</div>
                          </div>
                          <div
                            className={cn(
                              "relative h-7 w-12 shrink-0 rounded-full bg-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] dark:bg-white/[0.08]",
                              checked ? "bg-zinc-200 dark:bg-white/[0.16]" : "",
                            )}
                          >
                            <div
                              className={cn(
                                "absolute left-1 top-1 h-5 w-5 rounded-full shadow-sm will-change-transform transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                                checked
                                  ? "translate-x-5 bg-zinc-700 dark:bg-white/90"
                                  : "translate-x-0 bg-zinc-400 dark:bg-zinc-500",
                              )}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div>
                <FieldLabel label={t("system.quotaPackage", "套餐额度")} />
                <div className="rounded-[28px] bg-zinc-50/80 p-3 dark:bg-white/[0.03]">
                  <p className="mb-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                    {t("system.quotaPackageDesc", "留空表示不限额；多角色用户会采用最宽松的额度。")}
                  </p>
                  <div className="space-y-4">
                    {QUOTA_GROUPS.map((group) => (
                      <div key={group.title}>
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
                          {group.title}
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {group.items.map(([key, label]) => (
                            <label
                              key={key}
                              className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.06)] dark:bg-white/[0.04] dark:shadow-none"
                            >
                              <span className="min-w-0 truncate text-sm text-zinc-700 dark:text-zinc-300">{label}</span>
                              <input
                                type="number"
                                min={0}
                                value={form.quota_limits[key] ?? ""}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  setForm((prev) => ({
                                    ...prev,
                                    quota_limits: { ...prev.quota_limits, [key]: value },
                                  }));
                                }}
                                placeholder="不限"
                                className="h-9 w-24 rounded-xl bg-zinc-50 px-3 text-right text-sm text-zinc-900 outline-none focus:ring-1 focus:ring-zinc-300 dark:bg-black/20 dark:text-white dark:focus:ring-white/20"
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl px-4 py-2.5 text-sm text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900 dark:text-white/45 dark:hover:bg-white/[0.05] dark:hover:text-white/75 dark:focus-visible:ring-white"
                >
                  {t("system.cancel")}
                </button>
                <button disabled={saving} type="submit" className={primaryButtonClass}>
                  {saving ? t("system.saving") : t("system.saveRole")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[141] flex items-center justify-center px-4">
          <button className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={() => !deleting && setDeleteTarget(null)} />
          <div className="relative z-10 w-full max-w-[420px] rounded-[32px] border border-zinc-200/80 bg-white p-7 text-zinc-950 shadow-[0_30px_90px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-[#121418] dark:text-white dark:shadow-2xl dark:shadow-black/60">
            <h2 className="text-xl font-semibold tracking-tight">{t("system.delete")}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              {t("system.deleteRoleConfirm").replace("{name}", roleLabel(deleteTarget, t))}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl px-4 py-2.5 text-sm text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900 dark:text-white/45 dark:hover:bg-white/[0.05] dark:hover:text-white/75 dark:focus-visible:ring-white"
              >
                {t("system.cancel")}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void handleDeleteRole()}
                className="inline-flex items-center rounded-full bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              >
                {deleting ? t("system.saving") : t("system.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
