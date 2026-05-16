"use client";

import * as React from "react";
import { useAgents, usePlugins, useAgentSkillCatalog, useModelProviders } from "@/hooks/useApi";
import { useTranslation } from "@/hooks/useTranslation";
import { api, type Agent } from "@/lib/api";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { toast } from "@/components/ui/use-toast";
import { useTabsStore } from "@/store/tabs";
import { useUrlTab } from "@/hooks/useUrlTab";
import { Suspense } from "react";
import { GitBranch, PlugZap, Zap, Pen, Search, Image as ImageIcon, Settings, Eye, EyeOff, X } from "lucide-react";
import { useAuthState, updateStoredUser } from "@/lib/auth";
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
  
  const [savingSection, setSavingSection] = React.useState<"profile" | "prompt" | "knowledge" | "skills" | null>(null);
  const [pluginSourceUrl, setPluginSourceUrl] = React.useState("");
  const [isInstallingPlugin, setIsInstallingPlugin] = React.useState(false);
  const [activePane, setActivePane] = React.useState<"config" | "workbench">("config");
  const [pluginDeleteTarget, setPluginDeleteTarget] = React.useState<{ id: number; name: string } | null>(null);
  const [githubTokenOpen, setGithubTokenOpen] = React.useState(false);
  const [githubTokenInput, setGithubTokenInput] = React.useState("");
  const [showGithubToken, setShowGithubToken] = React.useState(false);
  const [savingGithubToken, setSavingGithubToken] = React.useState(false);
  const { user } = useAuthState();
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
    isSkillsDirty,
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

  const handleSave = async (section: "profile" | "prompt" | "knowledge" | "skills") => {
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
        } else if (section === "prompt") {
          partialPayload.system_prompt = payload.system_prompt;
        } else if (section === "knowledge") {
          partialPayload.context_text = payload.context_text;
        } else if (section === "skills") {
          partialPayload.system_skills = payload.system_skills;
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
  const canAttachPlugins = role === "writer";
  const workbenchSupported = role === "writer" || role === "extractor";
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

    if (!user?.github_token_set) {
      setGithubTokenOpen(true);
      toast.info(t("agents.pluginRateLimitHint"));
      return;
    }

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
          const errMsg = status.error || t("agents.pluginInstallFailed");
          if (errMsg.includes("无法解析") || errMsg.includes("rate limit")) {
            toast.error(t("agents.pluginRateLimitError"));
            setGithubTokenOpen(true);
          } else {
            toast.error(errMsg);
          }
        })
        .catch(async (error) => {
          await mutatePlugins();
          toast.error(error instanceof Error ? error.message : t("agents.pluginInstallFailed"));
        });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : t("agents.pluginInstallFailed");
      if (errMsg.includes("无法解析") || errMsg.includes("rate limit")) {
        toast.error(t("agents.pluginRateLimitError"));
        setGithubTokenOpen(true);
      } else {
        toast.error(errMsg);
      }
    } finally {
      setIsInstallingPlugin(false);
    }
  }, [mutatePlugins, pluginSourceUrl, t]);

  const handleTogglePluginBinding = React.useCallback(async (pluginId: number, attached: boolean) => {
    if (!activeAgent) return;
    try {
      let updatedAgent: Agent;
      if (attached) {
        updatedAgent = await api.unbindPluginFromAgent(activeAgent.id, pluginId);
        toast.success(t("agents.pluginDetached"));
      } else {
        updatedAgent = await api.bindPluginToAgent(activeAgent.id, pluginId, {
          sort_order: activeAgent.attached_plugins?.length || 0,
          is_enabled: true,
        });
        toast.success(t("agents.pluginBound"));
      }
      mutate((prev) => prev?.map(a => a.id === updatedAgent.id ? updatedAgent : a) ?? [], { revalidate: false });
      await mutatePlugins();
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
    }
  }, [mutate, mutatePlugins, pluginDeleteTarget, t]);

  const handleSaveGithubToken = React.useCallback(async () => {
    setSavingGithubToken(true);
    try {
      const updated = await api.auth.updateMe({ github_token: githubTokenInput || null });
      updateStoredUser(updated);
      setGithubTokenOpen(false);
      setGithubTokenInput("");
      toast.success(t("settings.saved"));
    } catch {
      toast.error(t("settings.saveFailed"));
    } finally {
      setSavingGithubToken(false);
    }
  }, [githubTokenInput, t]);

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

          {(role === "writer" || role === "extractor") && (
            <AgentSettingsCard
            title={t("agents.systemSkillsTitle")}
            description={t("agents.systemSkillsDesc")}
            footerLeft={workbenchSupported ? t("agents.systemSkillsFooterAvailable") : t("agents.systemSkillsFooterUnavailable")}
            footerRight={(
              <button
                type="button"
                className="h-8 rounded-lg bg-foreground px-5 text-[12px] font-medium text-background hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-60"
                onClick={() => handleSave("skills")}
                disabled={savingSection === "skills" || !isSkillsDirty}
              >
                {savingSection === "skills" ? t("agents.saving") : t("agents.save")}
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
                      className={cn(
                        "relative flex cursor-pointer items-start gap-3 rounded-2xl px-4 py-3.5 transition-colors",
                        checked
                          ? "bg-zinc-100/90 text-foreground dark:bg-white/[0.07]"
                          : "bg-zinc-50/80 text-foreground hover:bg-zinc-100/70 dark:bg-white/[0.035] dark:hover:bg-white/[0.055]"
                      )}
                    >
                      {checked && (
                        <span className="absolute inset-y-5 left-0 w-[2px] rounded-r-full bg-zinc-300/80 dark:bg-white/25" />
                      )}
                      <input
                        type="checkbox"
                        className="peer sr-only"
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
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] bg-zinc-200 text-white transition-colors peer-checked:bg-zinc-600 dark:bg-white/15 dark:peer-checked:bg-white/45">
                        {checked && (
                          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
                          </svg>
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[13px] font-semibold text-foreground">{localizedSkill.label}</p>
                          <span className="rounded-full bg-zinc-100 dark:bg-white/[0.06] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                            {skill.requires_confirmation ? t("agents.skillExecutionConfirm") : t("agents.skillExecutionDirect")}
                          </span>
                        </div>
                        <p className="mt-1 text-[12px] text-muted-foreground">{localizedSkill.description}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
            </AgentSettingsCard>
          )}

          {role === "writer" && (
            <AgentSettingsCard
            title={(
              <div className="flex w-full flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span>{t("agents.executionPluginsTitle")}</span>
                  <button
                    type="button"
                    onClick={() => setGithubTokenOpen(true)}
                    className="relative flex items-center justify-center w-6 h-6 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors"
                    title={t("settings.githubTokenTitle")}
                  >
                    <Settings className={cn(
                      "w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500",
                      user?.github_token_set && "animate-[spin_4s_linear_infinite]"
                    )} />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                  <span className="inline-flex items-center gap-1.5">
                    <span className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      activeAgent?.execution_mode === "plugin_augmented" ? "bg-zinc-600 dark:bg-zinc-200" : "bg-zinc-300 dark:bg-white/25"
                    )} />
                    <span className="text-zinc-400">{t("agents.executionModeLabel")}:</span>
                    <span className="text-zinc-700 dark:text-zinc-300">
                      {activeAgent?.execution_mode === "plugin_augmented" ? t("agents.executionModePluginAugmented") : t("agents.executionModeNative")}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className={cn(
                      "h-1.5 w-1.5 rounded-full ring-1 ring-inset",
                      activeAgent?.sandbox_enabled ? "bg-zinc-600 ring-zinc-600 dark:bg-zinc-200 dark:ring-zinc-200" : "bg-transparent ring-zinc-300 dark:ring-white/25"
                    )} />
                    <span className="text-zinc-400">{t("agents.executionSandboxLabel")}:</span>
                    <span className="text-zinc-700 dark:text-zinc-300">
                      {activeAgent?.sandbox_enabled ? t("agents.executionSandboxEnabled") : t("agents.executionSandboxDisabled")}
                    </span>
                  </span>
                </div>
              </div>
            )}
            description={t("agents.executionPluginsDesc")}
          >
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="relative flex h-11 items-center rounded-xl bg-zinc-50/90 ring-1 ring-zinc-950/[0.04] transition-all focus-within:bg-white focus-within:ring-zinc-300 dark:bg-white/[0.035] dark:ring-white/[0.06] dark:focus-within:bg-white/[0.055] dark:focus-within:ring-white/15">
                  <GitBranch className="ml-3.5 h-4 w-4 shrink-0 text-zinc-400" />
                  <input
                    type="url"
                    value={pluginSourceUrl}
                    onChange={(event) => setPluginSourceUrl(event.target.value)}
                    className="h-full min-w-0 flex-1 bg-transparent px-3 pr-24 text-[13px] text-foreground outline-none placeholder:text-muted-foreground/40 disabled:opacity-40"
                    placeholder="https://github.com/owner/repo"
                  />
                  <button
                    type="button"
                    onClick={handleInstallPlugin}
                    disabled={isInstallingPlugin || !pluginSourceUrl.trim()}
                    className="absolute right-1.5 top-1/2 h-8 -translate-y-1/2 rounded-lg bg-zinc-900 px-3 text-[12px] font-medium text-white transition-colors hover:bg-zinc-700 disabled:bg-zinc-200 disabled:text-zinc-500 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 dark:disabled:bg-white/10 dark:disabled:text-zinc-500"
                  >
                    {isInstallingPlugin ? t("agents.pluginInstalling") : t("agents.pluginInstall")}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
                  <span>{activeAgent && !canAttachPlugins ? t("agents.pluginsFooterWriterOnly") : t("agents.pluginsFooterPublicOnly")}</span>
                  {activeId === "new" && <span>{t("agents.pluginSaveAgentHint")}</span>}
                </div>

                <div className="space-y-2">
                  {plugins.length === 0 ? (
                    <div className="flex min-h-[112px] flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200/80 bg-zinc-50/40 px-6 py-6 text-center dark:border-white/[0.08] dark:bg-white/[0.02]">
                      <PlugZap className="mb-2 h-5 w-5 text-zinc-300 dark:text-white/25" />
                      <p className="text-[13px] font-medium text-zinc-600 dark:text-zinc-300">{t("agents.pluginEmptyTitle")}</p>
                      <p className="mt-1 max-w-md text-[12px] text-muted-foreground">{t("agents.pluginEmptyState")}</p>
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
                        className="rounded-xl bg-zinc-50/70 dark:bg-white/[0.035] px-3.5 py-3"
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
                              className="h-9 rounded-lg border border-zinc-200 dark:border-white/[0.08] px-3 text-[12px] font-medium text-foreground hover:bg-white/70 dark:hover:bg-white/[0.05] disabled:opacity-50 cursor-pointer"
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
            </div>
            </AgentSettingsCard>
          )}

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

      {/* GitHub Token Modal */}
      {githubTokenOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[4px]" onClick={() => setGithubTokenOpen(false)} />
          <div
            className="relative z-10 w-full max-w-md bg-white dark:bg-[#111214] border border-zinc-200 dark:border-white/10 rounded-2xl shadow-2xl p-6"
            style={{ animation: "modalIn 200ms cubic-bezier(0.16,1,0.3,1) forwards" }}
          >
            <div className="mt-4 space-y-2">
              <div className="relative">
                <input
                  type={showGithubToken ? "text" : "password"}
                  value={githubTokenInput}
                  onChange={(e) => setGithubTokenInput(e.target.value)}
                  placeholder={user?.github_token_set ? user.github_token_masked || "****" : "ghp_xxxxxxxxxxxx"}
                  className="w-full bg-zinc-100/60 dark:bg-white/[0.04] border-transparent rounded-lg px-3.5 py-2.5 pr-10 text-[13px] text-foreground outline-none focus:ring-1 focus:ring-zinc-300 dark:focus:ring-white/10 focus:bg-white dark:focus:bg-white/[0.06] transition-all placeholder:text-muted-foreground/40 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowGithubToken(!showGithubToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                >
                  {showGithubToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <p className="mt-3 text-[11px] text-muted-foreground leading-relaxed">
              {t("settings.githubTokenHint")}
            </p>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                className="flex-1 h-9 rounded-lg border border-zinc-200 dark:border-white/10 text-[13px] font-medium text-foreground hover:bg-zinc-50 dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
                onClick={() => setGithubTokenOpen(false)}
              >
                {t("common.cancel", "Cancel")}
              </button>
              <button
                type="button"
                disabled={savingGithubToken}
                className="flex-1 h-9 rounded-lg bg-zinc-900 text-[13px] font-medium text-white hover:bg-zinc-700 disabled:bg-zinc-200 disabled:text-zinc-500 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 dark:disabled:bg-white/10 dark:disabled:text-zinc-500 transition-colors cursor-pointer"
                onClick={handleSaveGithubToken}
              >
                {savingGithubToken ? t("settings.saving") : t("settings.save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
