"use client";

import * as React from "react";
import { Ban, History, Plus, RotateCcw } from "lucide-react";
import { api, type ActivationCode, type ActivationCodeRedemption, type Role } from "@/lib/api";
import { useAuthState } from "@/lib/auth";
import { useTranslation } from "@/hooks/useTranslation";
import { toast } from "@/components/ui/use-toast";
import { AgentCustomSelect, type AgentSelectOption } from "@/components/features/agents/agent-custom-select";
import { cn } from "@/lib/utils";

type ActivationCodeForm = {
  max_uses: string;
  default_role_code: string;
};

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
  "inline-flex items-center gap-1.5 rounded-full bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200";

const tableHeaderClass =
  "py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-500";

const actionButtonClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-all duration-150 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900 dark:hover:bg-white/[0.06] dark:hover:text-zinc-100";

const modalInputClass =
  "w-full rounded-2xl bg-zinc-50/85 px-4 py-3 text-sm text-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(15,23,42,0.06)] outline-none transition-all placeholder:text-zinc-400 focus:bg-white focus:ring-1 focus:ring-zinc-300 dark:bg-white/[0.06] dark:text-white dark:placeholder:text-white/20 dark:focus:bg-white/[0.08] dark:focus:ring-white/20";

function roleLabel(role: Role, t: (key: string) => string) {
  if (role.code === "super_admin") return t("system.superAdmin");
  if (role.code === "user") return t("system.normalUser");
  return role.name;
}

export default function SystemActivationCodesPage() {
  const { ready, hasPermission } = useAuthState();
  const { t, language } = useTranslation();
  const [codes, setCodes] = React.useState<ActivationCode[]>([]);
  const [redemptions, setRedemptions] = React.useState<ActivationCodeRedemption[]>([]);
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [selectedCode, setSelectedCode] = React.useState<ActivationCode | null>(null);
  const [redemptionsLoading, setRedemptionsLoading] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<ActivationCodeForm>({
    max_uses: "1",
    default_role_code: "user",
  });
  const canManage = hasPermission("system.manage");
  const locale = language === "zh" ? "zh-CN" : "en-US";
  const roleOptions = React.useMemo<AgentSelectOption[]>(
    () => roles.map((role) => ({ value: role.code, label: roleLabel(role, t) })),
    [roles, t],
  );

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [nextCodes, nextRoles] = await Promise.all([
        api.admin.getActivationCodes(),
        api.admin.getRoles(),
      ]);
      setCodes(nextCodes);
      setRoles(nextRoles.filter((role) => !["admin", "super_admin"].includes(role.code)));
    } catch (error) {
      console.error(error);
      toast.error(t("system.loadActivationCodesFailed"), t("system.tryLater"));
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

  const formatDate = (value: string | null | undefined) =>
    value
      ? new Intl.DateTimeFormat(locale, {
          year: "numeric",
          month: "numeric",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(value))
      : "-";

  const formatRedemptionStatus = (value: string) => {
    if (value === "approved") return t("system.redemptionStatusApproved");
    if (value === "completed") return t("system.redemptionStatusCompleted");
    if (value === "failed") return t("system.redemptionStatusFailed");
    return value;
  };

  const displayActivationCode = (code: ActivationCode) => code.code_value || code.plain_code || code.code_hint;

  const openCreate = () => {
    setForm({
      max_uses: "1",
      default_role_code: roles.find((role) => role.code === "user")?.code || roles[0]?.code || "user",
    });
    setModalOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.admin.createActivationCode({
        name: null,
        code: null,
        max_uses: form.max_uses.trim() ? Math.max(1, Number.parseInt(form.max_uses, 10) || 1) : null,
        expires_at: null,
        default_role_code: form.default_role_code,
        note: null,
      });
      toast.success(t("system.activationCodeCreated"));
      await loadData();
      setModalOpen(false);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : t("system.tryLater");
      toast.error(t("system.saveActivationCodeFailed"), message);
    } finally {
      setSaving(false);
    }
  };

  const toggleCodeStatus = async (code: ActivationCode) => {
    try {
      await api.admin.updateActivationCode(code.id, { is_active: !code.is_active });
      toast.success(code.is_active ? t("system.activationCodeDisabled") : t("system.activationCodeEnabled"));
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error(t("system.saveActivationCodeFailed"), t("system.tryLater"));
    }
  };

  const openRedemptions = async (code: ActivationCode) => {
    setSelectedCode(code);
    setRedemptions([]);
    setRedemptionsLoading(true);
    try {
      const items = await api.admin.getActivationCodeRedemptions(code.id);
      setRedemptions(items);
    } catch (error) {
      console.error(error);
      toast.error(t("system.loadActivationCodesFailed"), t("system.tryLater"));
    } finally {
      setRedemptionsLoading(false);
    }
  };

  if (!ready || loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">{t("system.loading")}</div>;
  }

  if (!canManage) {
    return (
      <EmptyPermissionState
        title={t("system.noAccessTitle")}
        description={t("system.noAccessActivationCodesDesc")}
      />
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white dark:bg-[#0b0c0f]">
      <div className="shrink-0 px-8 pt-8 lg:px-12">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              {t("system.activationCodeManagement")}
              <div className={cn(countBadgeClass, "ml-3")}>
                {codes.length} {t("system.activationCodesUnit")}
              </div>
            </h1>
            <p className="mt-1 max-w-2xl text-[13px] text-zinc-500 dark:text-zinc-400">{t("system.activationCodeManagementDesc")}</p>
          </div>
          <button onClick={openCreate} className={primaryButtonClass}>
            <Plus className="h-4 w-4" />
            {t("system.createActivationCode")}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-zinc-50/50 dark:bg-white/[0.01]">
        <div className="space-y-8 px-8 pb-10 pt-6 lg:px-12">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-zinc-200/60 dark:border-white/[0.06]">
                  <th className={cn(tableHeaderClass, "pr-5")}>{t("system.activationCode")}</th>
                  <th className={cn(tableHeaderClass, "px-5")}>{t("system.uses")}</th>
                  <th className={cn(tableHeaderClass, "px-5")}>{t("system.defaultRole")}</th>
                  <th className={cn(tableHeaderClass, "pl-5")}>{t("system.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((code) => (
                  <tr key={code.id} className={cn("group border-b border-zinc-200/60 transition-colors last:border-b-0 hover:bg-zinc-100/60 dark:border-white/[0.05] dark:hover:bg-white/[0.03]", !code.is_active && "opacity-55")}>
                    <td className="py-4 pr-5 align-middle">
                      <div className="min-w-0">
                        <div className="font-mono text-[13px] font-medium text-zinc-900 dark:text-white">{displayActivationCode(code)}</div>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <div className="font-mono text-[12px] text-zinc-500 dark:text-zinc-400">
                        {code.used_count} / {code.max_uses ?? t("system.unlimited")}
                      </div>
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:bg-white/[0.04] dark:text-zinc-300 dark:shadow-none">
                        {roles.find((role) => role.code === code.default_role_code) ? roleLabel(roles.find((role) => role.code === code.default_role_code) as Role, t) : code.default_role_code}
                      </span>
                    </td>
                    <td className="py-4 pl-5 align-middle">
                      <button
                        onClick={() => openRedemptions(code)}
                        aria-label={t("system.viewActivationRedemptions")}
                        title={t("system.viewActivationRedemptions")}
                        className={actionButtonClass}
                      >
                        <History className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => toggleCodeStatus(code)}
                        aria-label={code.is_active ? t("system.disable") : t("system.enable")}
                        title={code.is_active ? t("system.disable") : t("system.enable")}
                        className={cn(actionButtonClass, "ml-1")}
                      >
                        {code.is_active ? <Ban className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                      </button>
                    </td>
                  </tr>
                ))}
                {codes.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
                      {t("system.activationCodeEmpty")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center px-4">
          <button className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative z-10 w-full max-w-[560px] rounded-[32px] border border-zinc-200/80 bg-white p-7 text-zinc-950 shadow-[0_30px_90px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-[#121418] dark:text-white dark:shadow-2xl dark:shadow-black/60">
            <h2 className="text-xl font-semibold tracking-tight">{t("system.createActivationCode")}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{t("system.activationCodeFormDesc")}</p>
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div>
                <FieldLabel label={t("system.maxUses")} />
                <input type="number" min={1} value={form.max_uses} onChange={(e) => setForm((prev) => ({ ...prev, max_uses: e.target.value }))} className={modalInputClass} />
              </div>
              <div>
                <FieldLabel label={t("system.defaultRole")} />
                <AgentCustomSelect
                  value={form.default_role_code}
                  onChange={(value) => setForm((prev) => ({ ...prev, default_role_code: value }))}
                  options={roleOptions}
                  popoverClassName="z-[180] rounded-2xl border-zinc-200/80 p-1 shadow-[0_18px_50px_rgba(15,23,42,0.16)] dark:border-white/10"
                  className={cn(modalInputClass, "min-h-[46px]")}
                />
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
                  {saving ? t("system.saving") : t("system.createActivationCode")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedCode && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center px-4">
          <button className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={() => setSelectedCode(null)} />
          <div className="relative z-10 w-full max-w-[760px] rounded-[32px] border border-zinc-200/80 bg-white p-7 text-zinc-950 shadow-[0_30px_90px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-[#121418] dark:text-white dark:shadow-2xl dark:shadow-black/60">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">{t("system.activationRedemptions")}</h2>
                <p className="mt-2 font-mono text-sm text-zinc-500 dark:text-zinc-400">{displayActivationCode(selectedCode)}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCode(null)}
                className="rounded-xl px-4 py-2.5 text-sm text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900 dark:text-white/45 dark:hover:bg-white/[0.05] dark:hover:text-white/75 dark:focus-visible:ring-white"
              >
                {t("system.close")}
              </button>
            </div>

            <div className="mt-6 max-h-[54vh] overflow-auto">
              <table className="w-full min-w-[620px]">
                <thead>
                  <tr className="border-b border-zinc-200/60 dark:border-white/[0.06]">
                    <th className={cn(tableHeaderClass, "pr-5")}>{t("system.email")}</th>
                    <th className={cn(tableHeaderClass, "px-5")}>{t("system.username")}</th>
                    <th className={cn(tableHeaderClass, "px-5")}>{t("system.status")}</th>
                    <th className={cn(tableHeaderClass, "pl-5")}>{t("system.createdAt")}</th>
                  </tr>
                </thead>
                <tbody>
                  {redemptionsLoading ? (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
                        {t("system.loading")}
                      </td>
                    </tr>
                  ) : redemptions.length > 0 ? (
                    redemptions.map((item) => (
                      <tr key={item.id} className="border-b border-zinc-200/60 last:border-b-0 dark:border-white/[0.05]">
                        <td className="py-4 pr-5 text-sm text-zinc-600 dark:text-zinc-300">{item.email}</td>
                        <td className="px-5 py-4 text-sm text-zinc-600 dark:text-zinc-300">{item.username}</td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:bg-white/[0.04] dark:text-zinc-300">
                            {formatRedemptionStatus(item.status)}
                          </span>
                        </td>
                        <td className="py-4 pl-5 font-mono text-[12px] text-zinc-500 dark:text-zinc-400">{formatDate(item.created_at)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
                        {t("system.activationRedemptionsEmpty")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
