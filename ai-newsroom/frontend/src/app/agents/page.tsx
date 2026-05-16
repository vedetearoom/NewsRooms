"use client";

import * as React from "react";
import { useAgents, usePlugins, useAgentSkillCatalog, useModelProviders } from "@/hooks/useApi";
import { useTranslation } from "@/hooks/useTranslation";
import { api } from "@/lib/api";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { toast } from "@/components/ui/use-toast";
import { useTabsStore } from "@/store/tabs";
import { useUrlTab } from "@/hooks/useUrlTab";
import { Suspense } from "react";
import { Zap, Pen, Search, Image as ImageIcon } from "lucide-react";
import { AgentSidebar } from "@/components/features/agents/agent-sidebar";
import { AgentPageHeader } from "@/components/features/agents/agent-page-header";
import { useAgentFormState, denormalizePrompt, type AgentWithAudio } from "@/hooks/useAgentFormState";
import { AgentKnowledgeSection, AgentProfileSection, AgentPromptSection } from "@/components/features/agents/agent-form-sections";
import { AgentSettingsCard } from "@/components/features/agents/agent-settings-card";
import { PageShellFallback } from "@/components/shared/page-shell-fallback";
import { AgentWorkbench } from "@/components/features/agents/agent-workbench";
import { AgentDashboard } from "@/components/features/agents/agent-dashboard";
import { cn } from "@/lib/utils";

type AgentUpdatePayload = Partial<AgentWithAudio>;

function interpolate(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

type SkillMeta = {
  label: string;
  description: string;
};

export default function AgentStudioPage() {
  return (
    <Suspense fallback={<PageShellFallback />}>
      <AgentStudioContent />
    </Suspense>
  );
}

function AgentStudioContent() {
  const { agents, isLoading, mutate } = useAgents();
  const { plugins, mutate: mutatePlugins } = usePlugins();
  const { skills: skillCatalog } = useAgentSkillCatalog();
  const { t } = useTranslation();
  const setActiveIdAction = useTabsStore(s => s.setAgentsActiveId);
  const [activeIdStr, setActiveIdStr] = useUrlTab<string>("id", "", (val) => {
    setActiveIdAction(val === "new" ? "new" : val ? Number(val) : null);
  });
  
  const activeId = activeIdStr === "new" ? "new" : activeIdStr ? Number(activeIdStr) : null;
  const setActiveId = (id: number | "new" | null) => {
    setActiveIdStr(id === null ? "" : String(id));
  };
  
  const [savingSection, setSavingSection] = React.useState<"profile" | "prompt" | "knowledge" | null>(null);
  const [pluginSourceUrl, setPluginSourceUrl] = React.useState("");
  const [isInstallingPlugin, setIsInstallingPlugin] = React.useState(false);
  const [activePane, setActivePane] = React.useState<"config" | "workbench">("config");
  const [pluginDeleteTarget, setPluginDeleteTarget] = React.useState<{ id: number; name: string } | null>(null);
  const { providers } = useModelProviders();

  const activeAgent: AgentWithAudio | null = activeId === "new"
    ? null
    : (agents.find((a) => a.id === activeId) as AgentWithAudio | undefined) ?? null;
  const isSystem = activeAgent?.is_system ?? false;
  const isCurrentlyActiveSlot = activeAgent ? (activeAgent.is_active || (!agents.some(a => a.role === activeAgent.role && a.is_active) && activeAgent.is_system)) : false;

  const getLocalizedAgentName = React.useCallback((agent: AgentWithAudio | null | undefined) => {
    if (!agent?.is_system) return agent?.name || "";
    const nameMap: Record<string, string> = {
      "默认提取器": t('agents.defaultExtractor'),
      "Default Extractor": t('agents.defaultExtractor'),
      "标准写作助手": t('agents.standardWriter'),
      "Standard Writer": t('agents.standardWriter'),
      "格式与语气审核": t('agents.formatReviewer'),
      "Format & Tone Reviewer": t('agents.formatReviewer'),
      "默认插画师": t('agents.defaultIllustrator'),
      "Default Illustrator": t('agents.defaultIllustrator'),
    };
    return nameMap[agent.name] || agent.name;
  }, [t]);

  const {
    name,
    setName,
    role,
    setRole,
    modelType,
    setModelType,
    providerId,
    setProviderId,
    audioModelType,
    audioApiKey,
    systemPrompt,
    setSystemPrompt,
    contextText,
    setContextText,
    systemSkills,
    setSystemSkills,
    isProfileDirty,
    isPromptDirty,
    isKnowledgeDirty,
    populateFromAgent,
  } = useAgentFormState({
    activeId,
    activeAgent,
    getLocalizedAgentName,
    t,
  });

  React.useEffect(() => {
    setActivePane("config");
  }, [activeId]);

  const handleSave = async (section: "profile" | "prompt" | "knowledge") => {
    if (section === "profile" && !name.trim()) {
      toast.error(t("agents.validationNameRequired"));
      return;
    }
    if (section === "profile" && !providerId) {
      toast.error("Please select a model provider");
      return;
    }
    if (section === "prompt" && !systemPrompt.trim()) {
      toast.error(t("agents.validationPromptRequired"));
      return;
    }
    
    setSavingSection(section);

    // Resolve model_ref from provider's default_model
    let resolvedModel = modelType;
    if (providerId) {
      const p = providers.find((pr) => pr.id === providerId);
      if (p?.default_model) resolvedModel = p.default_model;
    }

    // Denormalize: if prompt matches localized default, save back English version
    const localizedPrompts = {
      extractor: t("agents.defaultPrompts.extractor"),
      writer: t("agents.defaultPrompts.writer"),
      reviewer: t("agents.defaultPrompts.reviewer"),
    };
    const savedPrompt = denormalizePrompt(role, systemPrompt, localizedPrompts);

    const payload = {
      name: isSystem ? activeAgent!.name : name,
      role,
      model_ref: resolvedModel,
      provider_id: providerId,
      audio_model_ref: audioModelType || null,
      audio_api_key: audioApiKey || null,
      system_prompt: savedPrompt,
      context_text: contextText || null,
      system_skills: systemSkills,
    };
    
    try {
      if (activeId === "new") {
        const newAgent = await api.createAgent(payload);
        await mutate();
        setActiveId(newAgent.id);
        toast.success(t('agents.createdSuccess'));
      } else {
        const partialPayload: AgentUpdatePayload = {};
        if (section === "profile") {
          partialPayload.name = payload.name;
          partialPayload.role = payload.role;
          partialPayload.model_ref = payload.model_ref;
          partialPayload.provider_id = payload.provider_id;
          partialPayload.audio_model_ref = payload.audio_model_ref;
          partialPayload.audio_api_key = payload.audio_api_key;
          partialPayload.system_skills = payload.system_skills;
        } else if (section === "prompt") {
          partialPayload.system_prompt = payload.system_prompt;
        } else if (section === "knowledge") {
          partialPayload.context_text = payload.context_text;
        }
        
        await api.updateAgent(activeId as number, partialPayload);
        await mutate();
        toast.success(t('agents.savedSuccess'));
      }
    } catch (e) {
      console.error("Failed to save agent:", e);
      toast.error(t("agents.saveFailed"));
    } finally {
      setSavingSection(null);
    }
  };

  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);

  const confirmDelete = async () => {
    if (activeId === "new" || !activeAgent) return;
    await api.deleteAgent(activeId as number);
    await mutate();
    setActiveId("new");
  };

  const handleClone = async () => {
    if (!activeAgent) return;
    setActiveId("new");
    populateFromAgent(activeAgent, " (Copy)");
  };

  const handleActivate = async () => {
    if (activeId === "new" || !activeAgent) return;
    try {
      await api.activateAgent(activeId as number);
      await mutate();
      toast.info(t("agents.activateSuccess"));
    } catch (e) {
      console.error("Failed to activate agent:", e);
      toast.error(t("agents.activateFailed"));
    }
  };

  const roleGroups = [
    { id: "extractor", label: t('agents.extractors'), icon: <Zap className="w-3.5 h-3.5" /> },
    { id: "writer", label: t('agents.writersGroup'), icon: <Pen className="w-3.5 h-3.5" /> },
    { id: "reviewer", label: t('agents.reviewers'), icon: <Search className="w-3.5 h-3.5" /> },
    { id: "illustrator", label: t('agents.illustrators'), icon: <ImageIcon className="w-3.5 h-3.5" /> },
  ];

  const inputClass = "w-full bg-zinc-100/60 dark:bg-white/[0.04] border-transparent rounded-lg px-3.5 py-2.5 text-[13px] text-foreground outline-none focus:ring-1 focus:ring-zinc-300 dark:focus:ring-white/10 focus:bg-white dark:focus:bg-white/[0.06] transition-all placeholder:text-muted-foreground/40 disabled:opacity-40 disabled:cursor-not-allowed";
  const attachedPluginIds = React.useMemo(
    () => new Set(activeAgent?.attached_plugins?.map((plugin) => plugin.id) ?? []),
    [activeAgent],
  );
  const canAttachPlugins = activeAgent?.role === "writer";
  const workbenchSupported = activeAgent ? ["writer", "extractor"].includes(activeAgent.role) : false;
  const availableSkills = React.useMemo(
    () => skillCatalog.filter((skill) => skill.roles.includes(role)),
    [role, skillCatalog],
  );
  const getLocalizedSkillMeta = React.useCallback((skill: { key: string; label: string; description: string }): SkillMeta => {
    const keyMap: Record<string, { label: string; description: string }> = {
      "sources.list": {
        label: t("agents.skillCatalog.sourcesList.label"),
        description: t("agents.skillCatalog.sourcesList.description"),
      },
      "sources.create": {
        label: t("agents.skillCatalog.sourcesCreate.label"),
        description: t("agents.skillCatalog.sourcesCreate.description"),
      },
      "sources.scrape": {
        label: t("agents.skillCatalog.sourcesScrape.label"),
        description: t("agents.skillCatalog.sourcesScrape.description"),
      },
      "sources.delete": {
        label: t("agents.skillCatalog.sourcesDelete.label"),
        description: t("agents.skillCatalog.sourcesDelete.description"),
      },
      "sources.read_recent_articles": {
        label: t("agents.skillCatalog.sourcesReadRecentArticles.label"),
        description: t("agents.skillCatalog.sourcesReadRecentArticles.description"),
      },
      "cards.list": {
        label: t("agents.skillCatalog.cardsList.label"),
        description: t("agents.skillCatalog.cardsList.description"),
      },
      "cards.read": {
        label: t("agents.skillCatalog.cardsRead.label"),
        description: t("agents.skillCatalog.cardsRead.description"),
      },
      "vault.inspirations.list": {
        label: t("agents.skillCatalog.vaultInspirationsList.label"),
        description: t("agents.skillCatalog.vaultInspirationsList.description"),
      },
      "tasks.create_article": {
        label: t("agents.skillCatalog.tasksCreateArticle.label"),
        description: t("agents.skillCatalog.tasksCreateArticle.description"),
      },
    };
    return keyMap[skill.key] ?? { label: skill.label, description: skill.description };
  }, [t]);
  const tabClassName = (pane: "config" | "workbench") => (
    `rounded-[14px] px-5 py-2.5 text-[13px] font-medium transition-all ${
      activePane === pane
        ? "bg-white text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.06),0_8px_20px_-12px_rgba(15,23,42,0.3)] dark:bg-white/[0.09] dark:text-white dark:shadow-none"
        : "text-muted-foreground hover:text-foreground dark:hover:bg-white/[0.04]"
    }`
  );

  const handleInstallPlugin = React.useCallback(async () => {
    const sourceUrl = pluginSourceUrl.trim();
    if (!sourceUrl) return;

    setIsInstallingPlugin(true);
    try {
      const queued = await api.installPlugin({
        source_url: sourceUrl,
        runtime_profile: "light",
      });
      setPluginSourceUrl("");
      toast.info(t("agents.pluginInstallQueued"));
      await mutatePlugins();
      void api.pollJob(queued.job_id, { intervalMs: 2000 })
        .then(async (status) => {
          await mutatePlugins();
          if (status.status === "completed") {
            toast.success(t("agents.pluginInstallCompleted"));
            return;
          }
          toast.error(status.error || t("agents.pluginInstallFailed"));
        })
        .catch(async (error) => {
          await mutatePlugins();
          toast.error(error instanceof Error ? error.message : t("agents.pluginInstallFailed"));
        });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("agents.pluginInstallFailed"));
    } finally {
      setIsInstallingPlugin(false);
    }
  }, [mutatePlugins, pluginSourceUrl, t]);

  const handleTogglePluginBinding = React.useCallback(async (pluginId: number, attached: boolean) => {
    if (!activeAgent) return;
    try {
      if (attached) {
        await api.unbindPluginFromAgent(activeAgent.id, pluginId);
        toast.success(t("agents.pluginDetached"));
      } else {
        await api.bindPluginToAgent(activeAgent.id, pluginId, {
          sort_order: activeAgent.attached_plugins?.length || 0,
          is_enabled: true,
        });
        toast.success(t("agents.pluginBound"));
      }
      await Promise.all([mutate(), mutatePlugins()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("agents.pluginBindFailed"));
    }
  }, [activeAgent, mutate, mutatePlugins, t]);

  const handleDeletePlugin = React.useCallback((pluginId: number, pluginName: string) => {
    setPluginDeleteTarget({ id: pluginId, name: pluginName });
  }, []);

  const confirmDeletePlugin = React.useCallback(async () => {
    if (!pluginDeleteTarget) return;
    try {
      await api.deletePlugin(pluginDeleteTarget.id);
      await Promise.all([mutate(), mutatePlugins()]);
      toast.success(t("agents.pluginDeleted"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("agents.pluginDeleteFailed"));
      throw error;
    }
  }, [mutate, mutatePlugins, pluginDeleteTarget, t]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AgentSidebar
        agents={agents}
        isLoading={isLoading}
        activeId={activeId}
        roleGroups={roleGroups}
        t={t}
        getLocalizedAgentName={getLocalizedAgentName}
        onSelect={setActiveId}
      />

      {/* ── Right Panel ── */}
      <div className="flex-1 overflow-y-auto">
        {activeId === null ? (
          <AgentDashboard
            agents={agents}
            isLoading={isLoading}
            roleGroups={roleGroups}
            t={t}
            getLocalizedAgentName={getLocalizedAgentName}
            onSelect={setActiveId}
          />
        ) : (
          <>
        <AgentPageHeader
          activeId={activeId}
          activeAgent={activeAgent}
          isSystem={isSystem}
          isCurrentlyActiveSlot={isCurrentlyActiveSlot}
          isProfileDirty={isProfileDirty}
          t={t}
          getLocalizedAgentName={getLocalizedAgentName}
          onActivate={handleActivate}
          onClone={handleClone}
          onDelete={() => setIsDeleteModalOpen(true)}
        />

        <div className="mx-auto max-w-5xl px-10 py-8 space-y-6">
          <div className="inline-flex items-center gap-1 rounded-[18px] bg-zinc-100/90 p-1.5 dark:bg-white/[0.04]">
            <button
              type="button"
              onClick={() => setActivePane("config")}
              className={tabClassName("config")}
            >
              {t("agents.configTab")}
            </button>
            <button
              type="button"
              onClick={() => setActivePane("workbench")}
              disabled={activeId === "new"}
              className={cn(tabClassName("workbench"), "disabled:opacity-40")}
            >
              {t("agents.workbenchTab")}
            </button>
          </div>

          {activePane === "workbench" ? (
            <AgentWorkbench activeAgent={activeAgent} />
          ) : (
            <div className="max-w-4xl space-y-6">

          <AgentProfileSection
            name={name}
            role={role}
            providerId={providerId}
            providers={providers}
            isSystem={isSystem}
            activeAgentCreatedAt={activeAgent?.created_at}
            isProfileDirty={isProfileDirty}
            savingSection={savingSection}
            inputClass={inputClass}
            t={t}
            onNameChange={setName}
            onRoleChange={setRole}
            onProviderChange={setProviderId}
            onSave={() => handleSave("profile")}
          />

          <AgentPromptSection
            systemPrompt={systemPrompt}
            savingSection={savingSection}
            isPromptDirty={isPromptDirty}
            t={t}
            onSystemPromptChange={setSystemPrompt}
            onSave={() => handleSave("prompt")}
          />

          <AgentKnowledgeSection
            contextText={contextText}
            savingSection={savingSection}
            isKnowledgeDirty={isKnowledgeDirty}
            t={t}
            onContextTextChange={setContextText}
            onSave={() => handleSave("knowledge")}
          />

          <AgentSettingsCard
            title={t("agents.systemSkillsTitle")}
            description={t("agents.systemSkillsDesc")}
            footerLeft={workbenchSupported ? t("agents.systemSkillsFooterAvailable") : t("agents.systemSkillsFooterUnavailable")}
            footerRight={(
              <button
                type="button"
                className="h-8 rounded-lg bg-foreground px-5 text-[12px] font-medium text-background hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-60"
                onClick={() => handleSave("profile")}
                disabled={savingSection === "profile" || !isProfileDirty}
              >
                {savingSection === "profile" ? t("agents.saving") : t("agents.save")}
              </button>
            )}
          >
            {!workbenchSupported ? (
              <div className="rounded-lg bg-zinc-50 dark:bg-white/[0.03] px-4 py-4 text-[13px] text-muted-foreground">
                {t("agents.systemSkillsUnsupportedDesc")}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {availableSkills.map((skill) => {
                  const checked = systemSkills.includes(skill.key);
                  const localizedSkill = getLocalizedSkillMeta(skill);
                  return (
                    <label
                      key={skill.key}
                      className="rounded-xl border border-zinc-200/80 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.02] px-4 py-3 flex items-start gap-3 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4"
                        checked={checked}
                        onChange={(event) => {
                          setSystemSkills((current) => {
                            if (event.target.checked) {
                              return current.includes(skill.key) ? current : [...current, skill.key];
                            }
                            return current.filter((item) => item !== skill.key);
                          });
                        }}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[13px] font-semibold text-foreground">{localizedSkill.label}</p>
                          <span className="rounded-full bg-zinc-100 dark:bg-white/[0.06] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                            {skill.requires_confirmation ? t("agents.skillExecutionConfirm") : t("agents.skillExecutionDirect")}
                          </span>
                        </div>
                        <p className="mt-1 text-[12px] text-muted-foreground">{localizedSkill.description}</p>
                        <p className="mt-2 text-[11px] text-muted-foreground font-mono">{skill.key}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </AgentSettingsCard>

          <AgentSettingsCard
            title={t("agents.executionTitle")}
            description={t("agents.executionDesc")}
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-zinc-50 dark:bg-white/[0.03] px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground mb-2">{t("agents.executionModeLabel")}</p>
                <p className="text-[14px] font-medium text-foreground">
                  {activeAgent?.execution_mode === "plugin_augmented" ? t("agents.executionModePluginAugmented") : t("agents.executionModeNative")}
                </p>
              </div>
              <div className="rounded-lg bg-zinc-50 dark:bg-white/[0.03] px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground mb-2">{t("agents.executionSandboxLabel")}</p>
                <p className="text-[14px] font-medium text-foreground">
                  {activeAgent?.sandbox_enabled ? t("agents.executionSandboxEnabled") : t("agents.executionSandboxDisabled")}
                </p>
              </div>
            </div>
          </AgentSettingsCard>

          <AgentSettingsCard
            title={t("agents.pluginsTitle")}
            description={t("agents.pluginsDesc")}
            footerLeft={activeAgent && !canAttachPlugins ? t("agents.pluginsFooterWriterOnly") : t("agents.pluginsFooterPublicOnly")}
          >
            <div className="space-y-5">
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <input
                  type="url"
                  value={pluginSourceUrl}
                  onChange={(event) => setPluginSourceUrl(event.target.value)}
                  className={inputClass}
                  placeholder="https://github.com/owner/repo"
                />
                <button
                  type="button"
                  onClick={handleInstallPlugin}
                  disabled={isInstallingPlugin || !pluginSourceUrl.trim()}
                  className="h-[42px] rounded-lg bg-foreground px-4 text-[13px] font-medium text-background hover:bg-foreground/90 disabled:opacity-50 cursor-pointer"
                >
                  {isInstallingPlugin ? t("agents.pluginInstalling") : t("agents.pluginInstall")}
                </button>
              </div>

              {activeId === "new" && (
                <div className="rounded-lg bg-zinc-50 dark:bg-white/[0.03] px-4 py-3 text-[13px] text-muted-foreground">
                  {t("agents.pluginSaveAgentHint")}
                </div>
              )}

              <div className="space-y-3">
                {plugins.length === 0 ? (
                  <div className="rounded-lg bg-zinc-50 dark:bg-white/[0.03] px-4 py-4 text-[13px] text-muted-foreground">
                    {t("agents.pluginEmptyState")}
                  </div>
                ) : plugins.map((plugin) => {
                  const isAttached = attachedPluginIds.has(plugin.id);
                  const canToggleThisPlugin = Boolean(
                    activeAgent &&
                    (
                      isAttached ||
                      (canAttachPlugins && plugin.install_status === "installed")
                    ),
                  );
                  return (
                    <div
                      key={plugin.id}
                      className="rounded-xl border border-zinc-200/70 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.02] px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[14px] font-semibold text-foreground">{plugin.name}</p>
                            <span className="rounded-full bg-zinc-100 dark:bg-white/[0.06] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                              {plugin.runtime_profile}
                            </span>
                            <span className="rounded-full bg-zinc-100 dark:bg-white/[0.06] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                              {plugin.install_status}
                            </span>
                          </div>
                          <p className="mt-1 text-[12px] text-muted-foreground break-all">
                            {plugin.github_owner}/{plugin.github_repo}@{plugin.git_ref}
                          </p>
                          {plugin.entry_hint && (
                            <p className="mt-1 text-[12px] text-muted-foreground">
                              {t("agents.pluginEntryLabel")}: <span className="font-mono">{plugin.entry_hint}</span>
                            </p>
                          )}
                          {plugin.error_message && (
                            <p className="mt-2 text-[12px] text-rose-500">{plugin.error_message}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            disabled={!canToggleThisPlugin}
                            onClick={() => handleTogglePluginBinding(plugin.id, isAttached)}
                            className="h-9 rounded-lg border border-zinc-200 dark:border-white/[0.08] px-3 text-[12px] font-medium text-foreground hover:bg-zinc-50 dark:hover:bg-white/[0.05] disabled:opacity-50 cursor-pointer"
                          >
                            {isAttached ? t("agents.pluginDetach") : t("agents.pluginBind")}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePlugin(plugin.id, plugin.name)}
                            className="h-9 rounded-lg border border-rose-200 dark:border-rose-500/20 px-3 text-[12px] font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer"
                          >
                            {t("agents.pluginDelete")}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </AgentSettingsCard>

          {/* Bottom spacer */}
          <div className="h-10" />
            </div>
          )}
        </div>
          </>
        )}
      </div>

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title={t('agents.confirmDeleteTitle')}
        description={`${t('agents.confirmDeleteDesc1')}${activeAgent?.name}${t('agents.confirmDeleteDesc2')}`}
        confirmText={t('agents.confirmDeleteBtn')}
      />
      <ConfirmModal
        isOpen={Boolean(pluginDeleteTarget)}
        onClose={() => setPluginDeleteTarget(null)}
        onConfirm={confirmDeletePlugin}
        title={t("agents.pluginDeleteModalTitle")}
        description={pluginDeleteTarget ? interpolate(t("agents.pluginDeleteModalDesc"), { name: pluginDeleteTarget.name }) : ""}
        confirmText={t("agents.pluginDelete")}
        cancelText={t("common.cancel", "Cancel")}
        isDestructive
      />
    </div>
  );
}
