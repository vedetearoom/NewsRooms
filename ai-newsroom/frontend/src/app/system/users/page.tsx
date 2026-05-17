"use client";

import * as React from "react";
import { Ban, Check, ChevronLeft, ChevronRight, Key, PencilLine, RotateCcw } from "lucide-react";
import { api, type CurrentUser, type Role } from "@/lib/api";
import { useAuthState } from "@/lib/auth";
import { useTranslation } from "@/hooks/useTranslation";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

type UserFormErrors = Partial<Record<"username" | "display_name" | "email" | "role_codes", string>>;

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

const tableHeaderClass =
  "py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-500";

const actionButtonClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-all duration-150 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900 dark:hover:bg-white/[0.06] dark:hover:text-zinc-100";

const modalInputClass =
  "w-full rounded-2xl bg-zinc-50/85 px-4 py-3 text-sm text-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(15,23,42,0.06)] outline-none transition-all placeholder:text-zinc-400 focus:bg-white focus:ring-1 focus:ring-zinc-300 disabled:cursor-not-allowed disabled:bg-zinc-100/90 disabled:text-zinc-400 dark:bg-white/[0.06] dark:text-white dark:placeholder:text-white/20 dark:focus:bg-white/[0.08] dark:focus:ring-white/20";

const PAGE_SIZE = 10;

export default function SystemUsersPage() {
  const { ready, hasPermission } = useAuthState();
  const { t, language } = useTranslation();
  const [users, setUsers] = React.useState<CurrentUser[]>([]);
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState<CurrentUser | null>(null);
  const [passwordModalOpen, setPasswordModalOpen] = React.useState(false);
  const [passwordResetUser, setPasswordResetUser] = React.useState<CurrentUser | null>(null);
  const [newPassword, setNewPassword] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [saving, setSaving] = React.useState(false);
  const [formErrors, setFormErrors] = React.useState<UserFormErrors>({});
  const [form, setForm] = React.useState({
    username: "",
    email: "",
    display_name: "",
    role_codes: ["user"] as string[],
    is_active: true,
  });
  const canManage = hasPermission("system.manage");

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [nextUsers, nextRoles] = await Promise.all([api.admin.getUsers(), api.admin.getRoles()]);
      setUsers(nextUsers);
      setRoles(nextRoles.filter((role) => role.code !== "admin"));
      setPage(1);
    } catch (error) {
      console.error(error);
      toast.error(t("system.loadUsersFailed"), t("system.tryLater"));
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

  const openEdit = (target: CurrentUser) => {
    setEditingUser(target);
    setFormErrors({});
    setForm({
      username: target.username,
      email: target.email,
      display_name: target.display_name,
      role_codes: [target.roles[0]?.code || "user"],
      is_active: target.is_active,
    });
    setModalOpen(true);
  };

  const openPasswordReset = (target: CurrentUser) => {
    setPasswordResetUser(target);
    setNewPassword("");
    setPasswordModalOpen(true);
  };

  const validateUserForm = () => {
    const nextErrors: UserFormErrors = {};
    const email = form.email.trim();

    if (form.username.trim().length < 3) nextErrors.username = t("system.validationUsername");
    if (form.display_name.trim().length < 2) nextErrors.display_name = t("system.validationDisplayName");
    if (email.length < 5 || !/^\S+@\S+\.\S+$/.test(email)) nextErrors.email = t("system.validationEmail");
    if (form.role_codes.length === 0) nextErrors.role_codes = t("system.validationRole");

    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateUserForm()) {
      toast.error(t("system.formInvalidTitle"), t("system.formInvalidDesc"));
      return;
    }
    setSaving(true);
    try {
      if (!editingUser) return;
      await api.admin.updateUser(editingUser.id, {
        display_name: form.display_name.trim(),
        role_codes: form.role_codes,
        is_active: form.is_active,
      });
      toast.success(t("system.userUpdated"));
      setModalOpen(false);
      setFormErrors({});
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error(t("system.saveUserFailed"), t("system.saveUserFailedDesc"));
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error(t("system.formInvalidTitle"), t("system.validationPassword"));
      return;
    }
    setSaving(true);
    try {
      if (!passwordResetUser) return;
      await api.admin.resetUserPassword(passwordResetUser.id, newPassword);
      toast.success(t("system.passwordResetSuccess"));
      setPasswordModalOpen(false);
    } catch (error) {
      console.error(error);
      toast.error(t("system.passwordResetFailed"), t("system.passwordResetFailedDesc"));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (target: CurrentUser) => {
    try {
      await api.admin.updateUserStatus(target.id, !target.is_active);
      toast.success(target.is_active ? t("system.userDisabled") : t("system.userEnabled"));
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error(t("system.updateStatusFailed"), t("system.tryLater"));
    }
  };

  if (!ready || loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">{t("system.loading")}</div>;
  }

  if (!canManage) {
    return (
      <EmptyPermissionState
        title={t("system.noAccessTitle")}
        description={t("system.noAccessUsersDesc")}
      />
    );
  }

  const locale = language === "zh" ? "zh-CN" : "en-US";
  const formatLastLogin = (value: string | null | undefined) =>
    value
      ? new Intl.DateTimeFormat(locale, {
          year: "numeric",
          month: "numeric",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(value))
      : t("system.neverLoggedIn");

  const sortedUsers = [...users].sort((a, b) => {
    if (!a.clerk_user_id && b.clerk_user_id) return -1;
    if (a.clerk_user_id && !b.clerk_user_id) return 1;
    return 0;
  });

  const totalPages = Math.max(1, Math.ceil(sortedUsers.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageUsers = sortedUsers.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white dark:bg-[#0b0c0f]">
      <div className="shrink-0 px-8 pt-8 lg:px-12">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              {t("system.userManagement")}
              <div className={cn(countBadgeClass, "ml-3")}>
                {users.length} {t("system.usersUnit")}
              </div>
            </h1>
            <p className="mt-1 max-w-2xl text-[13px] text-zinc-500 dark:text-zinc-400">{t("system.userManagementDesc")}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-zinc-50/50 dark:bg-white/[0.01]">
        <div className="pb-8 pt-6">
          <div className="overflow-x-auto px-8 lg:px-12">
            <table className="w-full min-w-[960px]">
                <colgroup>
                  <col className="w-[28%]" />
                  <col className="w-[24%]" />
                  <col className="w-[18%]" />
                  <col className="w-[12%]" />
                  <col className="w-[14%]" />
                  <col className="w-[132px]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-zinc-200/60 dark:border-white/[0.06]">
                    <th className={cn(tableHeaderClass, "pr-5")}>{t("system.user")}</th>
                    <th className={cn(tableHeaderClass, "px-5")}>{t("system.email")}</th>
                    <th className={cn(tableHeaderClass, "px-5")}>{t("system.role")}</th>
                    <th className={cn(tableHeaderClass, "px-5")}>{t("system.status")}</th>
                    <th className={cn(tableHeaderClass, "px-5")}>{t("system.lastLogin")}</th>
                    <th className={cn(tableHeaderClass, "pl-5")}>{t("system.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageUsers.map((item) => (
                    <tr
                      key={item.id}
                      className="group border-b border-zinc-200/60 transition-colors last:border-b-0 hover:bg-zinc-100/60 dark:border-white/[0.05] dark:hover:bg-white/[0.03]"
                    >
                      <td className="py-4 pr-5 align-middle">
                        <div className="min-w-0">
                          <div className="truncate text-[15px] font-medium text-zinc-900 dark:text-white flex items-center gap-2">
                            {item.display_name}
                            {item.clerk_user_id ? (
                              <span className="inline-flex items-center rounded-sm bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10 dark:bg-indigo-400/10 dark:text-indigo-400 dark:ring-indigo-400/20">
                                SSO
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-sm bg-zinc-50 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 ring-1 ring-inset ring-zinc-500/10 dark:bg-white/5 dark:text-zinc-400 dark:ring-white/10">
                                Local
                              </span>
                            )}
                          </div>
                          <div className="mt-1 truncate font-mono text-[12px] text-zinc-500 dark:text-zinc-400">@{item.username}</div>
                        </div>
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <div className="truncate font-mono text-[12px] text-zinc-500 dark:text-zinc-400">{item.email}</div>
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <div className="flex flex-wrap gap-1.5">
                          {item.roles.map((role) => (
                            <span
                              key={role.code}
                              className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:bg-white/[0.04] dark:text-zinc-300 dark:shadow-none"
                            >
                              {roleLabel(role, t)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-4 align-middle whitespace-nowrap">
                        <span className={cn("inline-flex items-center gap-2 text-sm font-medium", item.is_active ? "text-zinc-700 dark:text-zinc-200" : "text-zinc-500 dark:text-zinc-500")}>
                          <span
                            className={cn(
                              "h-2 w-2 rounded-full",
                              item.is_active
                                ? "bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]"
                                : "bg-zinc-300 dark:bg-zinc-600",
                            )}
                          />
                          {item.is_active ? t("system.enabled") : t("system.disabled")}
                        </span>
                      </td>
                      <td className="px-5 py-4 align-middle whitespace-nowrap">
                        <div className="font-mono text-[12px] tabular-nums text-zinc-500 dark:text-zinc-400">{formatLastLogin(item.last_login_at)}</div>
                      </td>
                      <td className="py-4 pl-5 align-middle">
                        <div className="flex items-center justify-start gap-1">
                          <button onClick={() => openEdit(item)} aria-label={t("system.edit")} title={t("system.edit")} className={actionButtonClass}>
                            <PencilLine className="h-4 w-4" />
                          </button>
                          {!item.clerk_user_id && (
                            <button onClick={() => openPasswordReset(item)} aria-label={t("system.resetPassword")} title={t("system.resetPassword")} className={actionButtonClass}>
                              <Key className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleToggleStatus(item)}
                            aria-label={item.is_active ? t("system.disable") : t("system.enable")}
                            title={item.is_active ? t("system.disable") : t("system.enable")}
                            className={actionButtonClass}
                          >
                            {item.is_active ? <Ban className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            {sortedUsers.length > PAGE_SIZE && (
              <div className="flex items-center justify-center border-t border-zinc-200/60 py-3.5 dark:border-white/[0.06]">
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 transition-all hover:bg-zinc-100 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-white/[0.06] dark:hover:text-zinc-300"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={cn(
                        "inline-flex h-7 min-w-[28px] items-center justify-center rounded-full px-1.5 text-[12px] font-medium transition-all",
                        p === safePage
                          ? "bg-zinc-200/80 text-zinc-900 dark:bg-white/[0.1] dark:text-white"
                          : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-white/[0.06] dark:hover:text-zinc-300",
                      )}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 transition-all hover:bg-zinc-100 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-white/[0.06] dark:hover:text-zinc-300"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center px-4">
          <button className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative z-10 w-full max-w-[560px] rounded-[32px] border border-zinc-200/80 bg-white p-7 text-zinc-950 shadow-[0_30px_90px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-[#121418] dark:text-white dark:shadow-2xl dark:shadow-black/60">
            <h2 className="text-xl font-semibold tracking-tight">{t("system.editUser")}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{t("system.userFormDesc")}</p>
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <FieldLabel label={t("system.username")} required />
                  <input
                    value={form.username}
                    autoComplete="username"
                    disabled={Boolean(editingUser)}
                    onChange={(e) => {
                      const value = e.target.value;
                      setForm((prev) => ({ ...prev, username: value }));
                      setFormErrors((prev) => ({ ...prev, username: undefined }));
                    }}
                    placeholder={t("system.username")}
                    className={cn(modalInputClass, "font-mono text-[13px]")}
                  />
                  {formErrors.username ? <p className="mt-2 text-xs text-red-500">{formErrors.username}</p> : null}
                </div>
                <div>
                  <FieldLabel label={t("system.displayName")} required />
                  <input
                    value={form.display_name}
                    autoComplete="name"
                    onChange={(e) => {
                      const value = e.target.value;
                      setForm((prev) => ({ ...prev, display_name: value }));
                      setFormErrors((prev) => ({ ...prev, display_name: undefined }));
                    }}
                    placeholder={t("system.displayName")}
                    className={modalInputClass}
                  />
                  {formErrors.display_name ? <p className="mt-2 text-xs text-red-500">{formErrors.display_name}</p> : null}
                </div>
              </div>
              <div>
                <FieldLabel label={t("system.email")} />
                <input
                  type="email"
                  value={form.email}
                  readOnly
                  placeholder={t("system.email")}
                  className={cn(modalInputClass, "font-mono text-[13px] cursor-not-allowed opacity-60")}
                />
              </div>
              <div>
                <FieldLabel label={t("system.role")} required />
                <div className="rounded-[28px] bg-zinc-50/80 p-2.5 dark:bg-white/[0.03]">
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {roles.map((role) => {
                      const checked = form.role_codes.includes(role.code);
                      return (
                        <button
                          key={role.code}
                          type="button"
                          onClick={() => {
                            setForm((prev) => ({ ...prev, role_codes: [role.code] }));
                            setFormErrors((prev) => ({ ...prev, role_codes: undefined }));
                          }}
                          className="rounded-[20px] bg-white px-4 py-3 text-left text-zinc-800 shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition-all duration-200 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900 dark:bg-white/[0.04] dark:text-white/80 dark:shadow-none dark:hover:bg-white/[0.06] dark:hover:text-white dark:focus-visible:ring-white"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-[15px] font-medium">{roleLabel(role, t)}</div>
                            </div>
                            <span
                              className={cn(
                                "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] dark:bg-white/[0.06]",
                                checked ? "text-zinc-700 dark:text-white/85" : "text-transparent",
                              )}
                            >
                              <Check
                                className={cn(
                                  "h-3.5 w-3.5 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                                  checked ? "scale-100 opacity-100" : "scale-75 opacity-0",
                                )}
                              />
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {formErrors.role_codes ? <p className="mt-2 text-xs text-red-500">{formErrors.role_codes}</p> : null}
              </div>
              <label className="flex items-center gap-3 rounded-2xl bg-zinc-50/85 px-4 py-3 text-sm text-zinc-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] dark:bg-white/[0.04] dark:text-zinc-300">
                <input
                  type="checkbox"
                  className="accent-zinc-900 dark:accent-white"
                  checked={form.is_active}
                  onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                />
                {t("system.activeAfterCreate")}
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl px-4 py-2.5 text-sm text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900 dark:text-white/45 dark:hover:bg-white/[0.05] dark:hover:text-white/75 dark:focus-visible:ring-white"
                >
                  {t("system.cancel")}
                </button>
                <button disabled={saving} type="submit" className={primaryButtonClass}>
                  {saving ? t("system.saving") : t("system.saveUser")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {passwordModalOpen && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center px-4">
          <button className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={() => setPasswordModalOpen(false)} />
          <div className="relative z-10 w-full max-w-[420px] rounded-[32px] border border-zinc-200/80 bg-white p-7 text-zinc-950 shadow-[0_30px_90px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-[#121418] dark:text-white dark:shadow-2xl dark:shadow-black/60">
            <h2 className="text-xl font-semibold tracking-tight">{t("system.resetPassword")}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              {t("system.resetPasswordDesc").replace("{name}", passwordResetUser?.display_name || "")}
            </p>
            <form className="mt-6 space-y-4" onSubmit={handlePasswordSubmit}>
              <div>
                <FieldLabel label={t("system.newPassword")} required />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className={cn(modalInputClass, "font-mono")}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPasswordModalOpen(false)}
                  className="rounded-xl px-4 py-2.5 text-sm text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900 dark:text-white/45 dark:hover:bg-white/[0.05] dark:hover:text-white/75 dark:focus-visible:ring-white"
                >
                  {t("system.cancel")}
                </button>
                <button disabled={saving || newPassword.length < 6} type="submit" className={primaryButtonClass}>
                  {saving ? t("system.saving") : t("system.confirmReset")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
