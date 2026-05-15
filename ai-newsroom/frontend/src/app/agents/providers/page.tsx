"use client";

import * as React from "react";
import { Plus, PencilLine, Trash2, Eye, EyeOff, KeyRound, Search, X } from "lucide-react";
import { api, type ModelProvider } from "@/lib/api";
import { useModelProviders } from "@/hooks/useApi";
import { useTranslation } from "@/hooks/useTranslation";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { AgentCustomSelect, type AgentSelectOption } from "@/components/features/agents/agent-custom-select";
import { PageTopBar, PageTopBarBadge } from "@/components/shared/page-top-bar";
import { PageEmptyState, PageStateBoundary } from "@/components/shared/page-states";

const PROVIDER_OPTIONS = [
  { value: "google", label: "Gemini" },
  { value: "alibaba", label: "Qwen" },
];

const CATEGORY_OPTIONS = [
  { value: "text", labelKey: "categoryText" },
  { value: "image", labelKey: "categoryImage" },
];

const MODEL_CATALOG: Record<string, Record<string, string[]>> = {
  google: {
    text: ["gemini-2.5-flash", "gemini-2.5-pro"],
    image: ["gemini-2.5-flash-image"],
  },
  alibaba: {
    text: ["qwen-plus", "qwen-max"],
    image: ["qwen-image-2.0-pro"],
  },
};

const inputClass =
  "w-full h-10 rounded-lg bg-background border border-border px-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-foreground/20";

const primaryBtn =
  "inline-flex items-center rounded-full bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200";

export default function ModelProvidersPage() {
  const { t, language } = useTranslation();
  const mp = (key: string) => t(`agents.modelProviders.${key}`);
  const { providers, isLoading: loading, mutate } = useModelProviders();
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ModelProvider | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [showKey, setShowKey] = React.useState(false);
  const [deleteConfirm, setDeleteConfirm] = React.useState<ModelProvider | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [form, setForm] = React.useState({
    name: "",
    provider: "google",
    category: "text",
    api_key: "",
    default_model: "",
  });

  const openCreate = () => {
    const defaultModel = MODEL_CATALOG.google?.text?.[0] || "";
    setEditing(null);
    setForm({ name: "", provider: "google", category: "text", api_key: "", default_model: defaultModel });
    setShowKey(false);
    setModalOpen(true);
  };

  const openEdit = (p: ModelProvider) => {
    setEditing(p);
    setForm({
      name: p.name,
      provider: p.provider,
      category: p.category,
      api_key: "",
      default_model: p.default_model || "",
    });
    setShowKey(false);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error(mp("nameRequired"));
      return;
    }
    if (!editing && !form.api_key.trim()) {
      toast.error(mp("apiKeyRequired"));
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        const update: Record<string, unknown> = {
          name: form.name,
          provider: form.provider,
          category: form.category,
          default_model: form.default_model || null,
        };
        if (form.api_key.trim()) update.api_key = form.api_key;
        await api.updateModelProvider(editing.id, update);
        toast.success(mp("updated"));
      } else {
        await api.createModelProvider({
          name: form.name,
          provider: form.provider,
          category: form.category,
          api_key: form.api_key,
          default_model: form.default_model || null,
        });
        toast.success(mp("created"));
      }
      setModalOpen(false);
      await mutate();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : mp("createFailed");
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await api.deleteModelProvider(deleteConfirm.id);
      toast.success(mp("deleted"));
      setDeleteConfirm(null);
      await mutate();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : mp("deleteFailed");
      toast.error(msg);
    }
  };

  const getProviderLabel = (provider: string) =>
    PROVIDER_OPTIONS.find((o) => o.value === provider)?.label || provider;

  const getCategoryLabel = (category: string) =>
    t(`agents.modelProviders.${CATEGORY_OPTIONS.find((o) => o.value === category)?.labelKey || "categoryText"}`);

  const providerSelectOptions: AgentSelectOption[] = PROVIDER_OPTIONS.map((o) => ({
    value: o.value,
    label: o.label,
  }));

  const categorySelectOptions: AgentSelectOption[] = CATEGORY_OPTIONS.map((o) => ({
    value: o.value,
    label: t(`agents.modelProviders.${o.labelKey}`),
  }));

  const filteredProviders = providers.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.provider.toLowerCase().includes(q) ||
      p.default_model?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="w-full flex-1 flex flex-col pt-4 min-h-screen bg-white dark:bg-[#08090b]">
      <PageTopBar
        title={mp("title")}
        badge={<PageTopBarBadge text={`${providers.length}`} />}
        className="mb-10"
        innerClassName="px-8"
      >
        <button onClick={openCreate} className={primaryBtn}>
          <Plus className="mr-1.5 h-4 w-4" />
          {mp("addProvider")}
        </button>
      </PageTopBar>

      <div className="max-w-5xl mx-auto w-full px-2">
        <div className="flex flex-col gap-3 mb-10">
          <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            {mp("title")}
          </h1>
          <div className="text-[14px] text-zinc-500 dark:text-zinc-400/80 leading-relaxed max-w-2xl">
            <p>{mp("desc")}</p>
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
            placeholder={mp("searchPlaceholder")}
          />
        </div>

        <PageStateBoundary
          loading={loading}
          isEmpty={providers.length === 0 || (filteredProviders.length === 0 && searchQuery.trim().length > 0)}
          emptyState={
            providers.length === 0 ? (
              <PageEmptyState
                icon={KeyRound}
                title={mp("emptyTitle")}
                description={mp("emptyDesc")}
                action={{ label: mp("addProvider"), onClick: openCreate }}
              />
            ) : (
              <PageEmptyState
                icon={KeyRound}
                title={mp("searchNoResults")}
                description={mp("searchNoResultsDesc")}
              />
            )
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
            {filteredProviders.map((p) => (
              <div
                key={p.id}
                className="group relative flex flex-col rounded-[20px] bg-zinc-50/80 dark:bg-white/[0.02] border border-border/50 dark:border-white/[0.06] hover:bg-zinc-100 dark:hover:bg-white/[0.045] dark:hover:border-white/[0.14] dark:hover:shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_20px_50px_-16px_rgba(0,0,0,0.5)] transition-all duration-300 overflow-hidden"
              >
                <div className="p-5 pb-0">
                  <div className="w-full flex items-start justify-between">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-zinc-900 text-white dark:bg-gradient-to-br dark:from-white/[0.15] dark:to-white/[0.06] dark:text-zinc-200 font-bold text-lg dark:ring-1 dark:ring-white/[0.08] dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
                      {p.provider === "google" ? "G" : "Q"}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(p)}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-zinc-200/50 dark:hover:bg-white/10 transition-colors"
                      >
                        <PencilLine className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(p)}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-red-400 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3">
                    <h3 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100 leading-tight inline-flex items-center gap-2">
                      {p.name}
                      <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-white/[0.06] rounded-md px-1.5 py-0.5">
                        {getCategoryLabel(p.category)}
                      </span>
                    </h3>
                  </div>

                  <div className="mt-2 flex items-center gap-2 text-[13px] text-zinc-500 dark:text-zinc-400">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {getProviderLabel(p.provider)}
                    </span>
                    <span className="text-zinc-300 dark:text-zinc-600">·</span>
                    <span className="font-mono text-[12px]">{p.api_key_masked}</span>
                  </div>
                </div>

                <div className="mx-5 mt-3 border-t border-zinc-200/70 dark:border-white/[0.08] group-hover:border-zinc-200/80 dark:group-hover:border-white/[0.1] py-3 flex items-center justify-between transition-colors">
                  <span className="text-[13px] font-mono text-zinc-500 dark:text-zinc-400">
                    {p.default_model || "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </PageStateBoundary>
      </div>

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setModalOpen(false)}>
          <div
            className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border overflow-visible"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-foreground tracking-tight">
                  {editing ? mp("editProviderTitle") : mp("addProviderTitle")}
                </h3>
                <p className="text-sm text-muted-foreground">{mp("desc")}</p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-foreground">{mp("nameLabel")}</label>
                <input
                  className={inputClass}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={mp("namePlaceholder")}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-foreground">{mp("providerLabel")}</label>
                <AgentCustomSelect
                  value={form.provider}
                  onChange={(v) => setForm({ ...form, provider: v, default_model: "" })}
                  className={inputClass}
                  popoverClassName="z-[160]"
                  options={providerSelectOptions}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-foreground">{mp("categoryLabel")}</label>
                <AgentCustomSelect
                  value={form.category}
                  onChange={(v) => setForm({ ...form, category: v, default_model: "" })}
                  className={inputClass}
                  popoverClassName="z-[160]"
                  options={categorySelectOptions}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-foreground">
                  {mp("apiKeyLabel")} {editing ? <span className="text-muted-foreground font-normal">({mp("apiKeyEditHint")})</span> : <span className="text-red-500">*</span>}
                </label>
                <div className="relative">
                  <input
                    className={cn(inputClass, "pr-10 font-mono text-xs")}
                    type={showKey ? "text" : "password"}
                    value={form.api_key}
                    onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                    placeholder={editing ? "••••••••" : mp("apiKeyPlaceholder")}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowKey(!showKey)}
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-foreground">{mp("defaultModel")}</label>
                <AgentCustomSelect
                  value={form.default_model || (MODEL_CATALOG[form.provider]?.[form.category]?.[0] || "")}
                  onChange={(v) => setForm({ ...form, default_model: v })}
                  className={cn(inputClass, "font-mono text-xs")}
                  popoverClassName="z-[160]"
                  options={(MODEL_CATALOG[form.provider]?.[form.category] || []).map((m) => ({ value: m, label: m }))}
                />
              </div>
              <div className="pt-4 flex items-center justify-end gap-3">
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-full px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors">
                  {mp("cancel")}
                </button>
                <button type="submit" disabled={saving} className={primaryBtn}>
                  {saving ? mp("saving") : editing ? mp("saveChanges") : mp("addProvider")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)}>
          <div
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl dark:bg-[#141517]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{mp("deleteTitle")}</h2>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {mp("deleteDesc1")}<strong>{deleteConfirm.name}</strong>{mp("deleteDesc2")}
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="rounded-full px-4 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/[0.06]">
                {mp("cancel")}
              </button>
              <button
                onClick={handleDelete}
                className="inline-flex items-center rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-red-700"
              >
                {mp("delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
