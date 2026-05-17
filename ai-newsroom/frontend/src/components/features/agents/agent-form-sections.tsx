"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Sparkles, Zap, Pen, Search, Image as ImageIcon } from "lucide-react";
import { AgentCustomSelect, type AgentSelectOption } from "@/components/features/agents/agent-custom-select";
import { AgentSettingsCard } from "@/components/features/agents/agent-settings-card";
import type { ModelProvider } from "@/lib/api";

type SavingSection = "profile" | "prompt" | "knowledge" | "skills" | null;

interface AgentProfileSectionProps {
  name: string;
  role: string;
  providerId: number | null;
  providers: ModelProvider[];
  isSystem: boolean;
  activeAgentCreatedAt?: string;
  isProfileDirty: boolean;
  savingSection: SavingSection;
  inputClass: string;
  t: (key: string, fallback?: string) => string;
  onNameChange: (value: string) => void;
  onRoleChange: (value: string) => void;
  onProviderChange: (value: number | null) => void;
  onSave: () => void;
}

export function AgentProfileSection({
  name,
  role,
  providerId,
  providers,
  isSystem,
  activeAgentCreatedAt,
  isProfileDirty,
  savingSection,
  inputClass,
  t,
  onNameChange,
  onRoleChange,
  onProviderChange,
  onSave,
}: AgentProfileSectionProps) {

  const roleOptions: AgentSelectOption[] = [
    { value: "extractor", label: t("agents.extractors"), icon: <Zap className="w-3.5 h-3.5 text-muted-foreground" /> },
    { value: "writer", label: t("agents.writersGroup"), icon: <Pen className="w-3.5 h-3.5 text-muted-foreground" /> },
    { value: "reviewer", label: t("agents.reviewers"), icon: <Search className="w-3.5 h-3.5 text-muted-foreground" /> },
    { value: "illustrator", label: t("agents.illustrators"), icon: <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" /> },
  ];

  const requiredCategory = role === "illustrator" ? "image" : "text";
  const filteredProviders = providers.filter((p) => p.category === requiredCategory);
  const providerOptions: AgentSelectOption[] = filteredProviders.map((p) => ({
    value: String(p.id),
    label: p.default_model ? `${p.name} · ${p.default_model}` : p.name,
  }));

  return (
    <AgentSettingsCard
      title={t("agents.agentProfile")}
      description={t("agents.agentProfileDesc")}
      footerLeft={isSystem ? t("agents.sysAgentHint") : `${activeAgentCreatedAt ? `${t("agents.createdOn")} ${new Date(activeAgentCreatedAt).toLocaleDateString()}` : t("agents.createdJustNow")}`}
      footerRight={(
        <Button
          size="sm"
          className="h-8 text-xs bg-foreground text-background hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-60 px-5 font-medium transition-all"
          onClick={onSave}
          disabled={savingSection === "profile" || !isProfileDirty}
        >
          {savingSection === "profile" ? t("agents.saving") : t("agents.save")}
        </Button>
      )}
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-5">
          <div className="space-y-2">
            <label className="block text-[11px] font-semibold text-foreground mb-1.5 ml-0.5">
              {t("agents.agentName")} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              disabled={isSystem}
              className={inputClass}
              placeholder={t("agents.namePlaceholder")}
            />
          </div>
          <div className="space-y-4">
            <label className="block text-[11px] font-semibold text-foreground mb-1.5 ml-0.5">
              {t("agents.role")} <span className="text-red-500">*</span>
            </label>
            <AgentCustomSelect
              value={role}
              onChange={onRoleChange}
              disabled={isSystem}
              className={inputClass}
              options={roleOptions}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div className="space-y-4">
            <label className="block text-[11px] font-semibold text-foreground mb-1.5 ml-0.5">
              {t("agents.provider")} <span className="text-red-500">*</span>
            </label>
            {filteredProviders.length > 0 ? (
              <AgentCustomSelect
                value={providerId ? String(providerId) : ""}
                onChange={(v) => onProviderChange(v ? Number(v) : null)}
                className={inputClass}
                options={providerOptions}
              />
            ) : (
              <span className={cn(inputClass, "text-muted-foreground text-xs block")}>No providers configured</span>
            )}
          </div>
          <div />
        </div>
      </div>
    </AgentSettingsCard>
  );
}

interface AgentPromptSectionProps {
  systemPrompt: string;
  savingSection: SavingSection;
  isPromptDirty: boolean;
  t: (key: string, fallback?: string) => string;
  onSystemPromptChange: (value: string) => void;
  onSave: () => void;
}

export function AgentPromptSection({
  systemPrompt,
  savingSection,
  isPromptDirty,
  t,
  onSystemPromptChange,
  onSave,
}: AgentPromptSectionProps) {
  return (
    <AgentSettingsCard
      title={<>{t("agents.systemInstructions")} <span className="text-rose-400/80 dark:text-rose-500/80 ml-0.5">*</span></>}
      description={t("agents.systemInstructionsDesc")}
      footerLeft={(
        <span className="flex items-center gap-1.5">
          <Sparkles className="w-3 h-3" />
          {t("agents.supportsMarkdown")}
        </span>
      )}
      footerRight={(
        <Button
          size="sm"
          className="h-8 text-xs bg-foreground text-background hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-60 px-5 font-medium transition-all"
          onClick={onSave}
          disabled={savingSection === "prompt" || !isPromptDirty}
        >
          {savingSection === "prompt" ? t("agents.saving") : t("agents.save")}
        </Button>
      )}
    >
      <textarea
        value={systemPrompt}
        onChange={(event) => onSystemPromptChange(event.target.value)}
        className={cn(
          "w-full bg-zinc-50/80 dark:bg-white/[0.03] rounded-lg px-4 py-4",
          "font-mono text-[13px] leading-[1.7] text-foreground",
          "outline-none focus:ring-1 focus:ring-zinc-300 dark:focus:ring-white/10 focus:bg-white dark:focus:bg-white/[0.05] transition-all",
          "resize-y min-h-[200px] placeholder:text-muted-foreground/30",
        )}
        placeholder={t("agents.sysPromptPlaceholder")}
      />
    </AgentSettingsCard>
  );
}

interface AgentKnowledgeSectionProps {
  contextText: string;
  savingSection: SavingSection;
  isKnowledgeDirty: boolean;
  t: (key: string, fallback?: string) => string;
  onContextTextChange: (value: string) => void;
  onSave: () => void;
}

export function AgentKnowledgeSection({
  contextText,
  savingSection,
  isKnowledgeDirty,
  t,
  onContextTextChange,
  onSave,
}: AgentKnowledgeSectionProps) {
  return (
    <AgentSettingsCard
      title={t("agents.knowledgeTitle")}
      description={t("agents.knowledgeDesc")}
      footerLeft={(
        <span className="flex items-center gap-1.5">
          <span className="text-[10px] bg-zinc-200/80 dark:bg-white/10 px-1.5 py-0.5 rounded font-semibold tracking-wide uppercase">{t("agents.fewShotInjection")}</span>
          {t("agents.persistHint")}
        </span>
      )}
      footerRight={(
        <Button
          size="sm"
          className="h-8 text-xs bg-foreground text-background hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-60 px-5 font-medium transition-all"
          onClick={onSave}
          disabled={savingSection === "knowledge" || !isKnowledgeDirty}
        >
          {savingSection === "knowledge" ? t("agents.saving") : t("agents.save")}
        </Button>
      )}
    >
      <textarea
        value={contextText}
        onChange={(event) => onContextTextChange(event.target.value)}
        className={cn(
          "w-full bg-zinc-50/80 dark:bg-white/[0.03] rounded-lg px-4 py-4",
          "font-mono text-[12px] leading-[1.8] text-foreground",
          "outline-none focus:ring-1 focus:ring-zinc-300 dark:focus:ring-white/10 focus:bg-white dark:focus:bg-white/[0.05] transition-all",
          "resize-y min-h-[280px] placeholder:text-muted-foreground/30",
        )}
        placeholder={t("agents.knowledgePlaceholder")}
      />
    </AgentSettingsCard>
  );
}
