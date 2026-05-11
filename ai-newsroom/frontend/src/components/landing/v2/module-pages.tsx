"use client";

import { Bot, ClipboardList, FileCheck, FileText, Gauge, Library, MonitorPlay, Network, PenLine, Radio, Search, ShieldCheck, Tags } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { ModulePage } from "./module-page";

export function IntelligencePanoramaPage() {
  const { language } = useTranslation();
  const zh = language === "zh";
  return (
    <ModulePage
      variant="panorama"
      badge={zh ? "资讯全景" : "Intelligence Panorama"}
      title={zh ? "所有信号，一面" : "Turn every incoming signal into a"}
      accentTitle={zh ? "实时资讯墙。" : "live intelligence wall."}
      description={zh ? "资讯全景是进入 Newsroom 后的第一层视图。图文情报、视频情报、时间轴筛选、分类标签与相关性评分汇聚为一个可操作的编辑界面。" : "Intelligence Panorama is the first layer of Newsroom: articles, video intelligence, time filters, topic tags, and relevance scores in one editorial view."}
      accent="#c0c0dd"
      appPath="/"
      appCta={zh ? "进入全景" : "Open panorama"}
      guestCta={zh ? "申请体验全景" : "Request panorama access"}
      workflowCta={zh ? "全景发现流程" : "See discovery workflow"}
      sections={[
        { title: zh ? "图文情报流" : "Text intelligence", description: zh ? "将 RSS、网站与 Newsletter 中的高价值内容自动整理为可筛选的情报卡片。" : "Turn RSS, websites, and newsletters into filterable intelligence cards.", icon: FileText },
        { title: zh ? "视频情报流" : "Video intelligence", description: zh ? "解构博主视频、访谈与长视频，提取摘要、核心观点和引用片段。" : "Break down creator videos, interviews, and long-form clips into summaries and citations.", icon: MonitorPlay },
        { title: zh ? "时间轴与归档" : "Time and archive", description: zh ? "在今日、本周与历史归档之间快速切换，不丢失编辑上下文。" : "Move between today, this week, and archive views without losing context.", icon: Gauge },
        { title: zh ? "自动分类与评分" : "Tags and scoring", description: zh ? "按主题自动归类，依据编辑标准对每条信号进行可信度与价值评分。" : "Automatically classify topics and score every signal against your editorial rubric.", icon: Tags },
      ]}
      workflow={[
        { label: zh ? "采集信号" : "Collect signals", detail: zh ? "从情报网络中汇入图文与视频素材。" : "Bring article and video material in from the intelligence network." },
        { label: zh ? "分类评分" : "Classify and score", detail: zh ? "按主题、热度、可信度与相关性自动排序。" : "Rank by topic, urgency, trust, and editorial relevance." },
        { label: zh ? "聚焦筛选" : "Filter the board", detail: zh ? "编辑按时间段、内容类型和标签缩小关注范围。" : "Editors narrow the board by time, media type, and tags." },
        { label: zh ? "批量分发" : "Dispatch in batches", detail: zh ? "将高价值信号送入内容工作台进入生产流程。" : "Send promising items into the content workspace." },
        { label: zh ? "进入生产" : "Move to production", detail: zh ? "信号转化为选题、草稿与编辑任务。" : "Signals become topics, drafts, and production tasks." },
      ]}
      mockTitle={zh ? "实时资讯墙" : "Live signal wall"}
      mockSubtitle={zh ? "今日 · 图文 · 视频 · 标签" : "Today · Text · Video · Tags"}
      mockItems={zh ? ["AI 行业动态", "安全风险", "视频解构", "本周归档"] : ["AI industry feed", "Security risks", "Video breakdowns", "Weekly archive"]}
    />
  );
}

export function ContentWorkspaceModulePage() {
  const { language } = useTranslation();
  const zh = language === "zh";
  return (
    <ModulePage
      variant="workspace"
      badge={zh ? "内容工作台" : "Content Workspace"}
      title={zh ? "零散情报，整理成可交付的" : "Turn scattered signals into"}
      accentTitle={zh ? "内容资产。" : "content assets."}
      description={zh ? "内容工作台承接全景中的重要发现，将它们组织为情报卡片、灵感素材、写作任务、审稿上下文与可复用的素材库。" : "Content Workspace receives the best discoveries from the panorama and turns them into cards, inspiration blocks, writing tasks, review context, and reusable source material."}
      accent="#a78bfa"
      appPath="/vault"
      appCta={zh ? "进入工作台" : "Open workspace"}
      guestCta={zh ? "申请体验工作台" : "Request workspace access"}
      workflowCta={zh ? "内容生产流程" : "See content workflow"}
      sections={[
        { title: zh ? "情报卡片" : "Intelligence cards", description: zh ? "将值得关注的信号保存为可追踪、可引用、可分发的结构化卡片。" : "Save promising signals as trackable, citable, dispatchable cards.", icon: ClipboardList },
        { title: zh ? "灵感武器库" : "Inspiration library", description: zh ? "沉淀优质选题角度、标题范式、内容结构与表达模式。" : "Collect angles, titles, structures, examples, and reusable patterns.", icon: Library },
        { title: zh ? "写作任务" : "Writing tasks", description: zh ? "将整理好的素材分配给写作智能体，自动进入草稿生产。" : "Hand curated materials to Writer agents for draft production.", icon: PenLine },
        { title: zh ? "审稿上下文" : "Review context", description: zh ? "来源、引用、修改记录和审稿状态保留在同一视图，减少反复确认。" : "Keep sources, citations, edits, and review status together.", icon: FileCheck },
      ]}
      workflow={[
        { label: zh ? "保存卡片" : "Save cards", detail: zh ? "从资讯全景中挑选值得深入跟进的情报。" : "Pick promising intelligence from the panorama." },
        { label: zh ? "整理素材" : "Organize material", detail: zh ? "补充来源出处、写作角度和参考结构。" : "Add sources, angles, references, and structure." },
        { label: zh ? "创建任务" : "Create tasks", detail: zh ? "将素材包分配给写作智能体开始生产。" : "Pass the working set to a writer agent." },
        { label: zh ? "审稿修订" : "Review edits", detail: zh ? "反馈意见、评分记录和修改历史集中管理。" : "Keep feedback, scores, and edits in one place." },
        { label: zh ? "沉淀复用" : "Reuse assets", detail: zh ? "将优秀的结构与素材转化为可复用资产。" : "Turn strong structures and sources into reusable assets." },
      ]}
      mockTitle={zh ? "生产桌面" : "Production desk"}
      mockSubtitle={zh ? "卡片 · 灵感 · 草稿 · 审稿" : "Cards · Inspiration · Drafts · Review"}
      mockItems={zh ? ["情报卡片", "灵感模板", "写作任务", "引用上下文"] : ["Signal cards", "Inspiration blocks", "Writing tasks", "Citation context"]}
    />
  );
}

export function IntelligenceNetworkPage() {
  const { language } = useTranslation();
  const zh = language === "zh";
  return (
    <ModulePage
      variant="network"
      badge={zh ? "情报网络" : "Intelligence Network"}
      title={zh ? "每个外部来源，接入受控的" : "Connect every outside source into a governed"}
      accentTitle={zh ? "情报网络。" : "intelligence network."}
      description={zh ? "情报网络统一管理 RSS、网站、Newsletter、视频博主与凭证边界。进入 Newsroom 的每条信号都有可追溯的来源、抓取状态和接入记录。" : "Intelligence Network manages RSS, websites, newsletters, video creators, and credential boundaries so every signal has a source, status, and ingestion trail."}
      accent="#d6c7a1"
      appPath="/sources"
      appCta={zh ? "进入情报网络" : "Open network"}
      guestCta={zh ? "申请接入信源" : "Request network access"}
      workflowCta={zh ? "信源接入流程" : "See source workflow"}
      sections={[
        { title: zh ? "RSS 与网站信源" : "RSS / Web sources", description: zh ? "统一维护媒体、博客、官方网站和垂直领域信源。" : "Maintain media, blogs, official sites, and niche sources in one registry.", icon: Radio },
        { title: zh ? "视频博主监控" : "Creator monitoring", description: zh ? "持续追踪目标博主的最新视频，自动转换为可处理的文本摘要。" : "Track video creators and long-form content, then convert them into usable text.", icon: MonitorPlay },
        { title: zh ? "抓取健康度" : "Fetch health", description: zh ? "实时监控失败请求、过期订阅、重复内容和低质量来源。" : "Watch failures, stale feeds, duplicates, and low-quality sources.", icon: ShieldCheck },
        { title: zh ? "凭证与权限边界" : "Credential boundary", description: zh ? "Cookie、API Key 等平台凭证仅存储于运行时配置，不泄露至公开页面。" : "Keep private cookies and platform credentials in runtime configuration.", icon: Network },
      ]}
      workflow={[
        { label: zh ? "添加来源" : "Add source", detail: zh ? "接入 RSS、网站、Newsletter 或视频博主主页。" : "Connect RSS, websites, newsletters, or video creators." },
        { label: zh ? "定时抓取" : "Schedule fetches", detail: zh ? "按设定频率自动拉取更新并记录抓取状态。" : "Pull updates on a cadence and record status." },
        { label: zh ? "清洗去重" : "Clean and dedupe", detail: zh ? "自动移除重复内容，补齐缺失的元数据字段。" : "Remove duplicates and complete metadata." },
        { label: zh ? "推入全景" : "Route to panorama", detail: zh ? "将可信内容自动推送至资讯全景视图。" : "Route trustworthy material into the panorama." },
        { label: zh ? "持续治理" : "Govern continuously", detail: zh ? "根据抓取健康度动态调整来源优先级与策略。" : "Tune sources and fetch strategy by health." },
      ]}
      mockTitle={zh ? "信源管理台" : "Source registry"}
      mockSubtitle={zh ? "RSS · Web · Video · 凭证" : "RSS · Web · Video · Credentials"}
      mockItems={zh ? ["RSS 信源", "网站监控", "视频博主", "抓取健康"] : ["RSS feeds", "Website monitors", "Video creators", "Fetch health"]}
    />
  );
}

export function AgentStudioModulePage() {
  const { language } = useTranslation();
  const zh = language === "zh";
  return (
    <ModulePage
      variant="studio"
      badge={zh ? "智能体工作室" : "Agent Studio"}
      title={zh ? "配置一支能协作的" : "Configure a collaborative AI"}
      accentTitle={zh ? "AI 编辑团队。" : "editorial team."}
      description={zh ? "智能体工作室用于配置信息抽取、内容写作、审稿校验与配图生成等智能体角色，涵盖模型绑定、Prompt 编排、知识库注入与插件集成。" : "Agent Studio configures extraction, writing, review, and illustration agents: models, prompts, knowledge, plugins, and execution modes."}
      accent="#e0c097"
      appPath="/agents"
      appCta={zh ? "进入工作室" : "Open Agent Studio"}
      guestCta={zh ? "申请配置智能体" : "Request agent access"}
      workflowCta={zh ? "智能体协作流程" : "See agent workflow"}
      sections={[
        { title: zh ? "抽取智能体" : "Extractor agents", description: zh ? "从原始来源中提取核心事实、主题标签、引用和结构化元数据。" : "Extract facts, tags, citations, and structured metadata from sources.", icon: Search },
        { title: zh ? "写作智能体" : "Writer agents", description: zh ? "根据素材包与风格要求自动生成草稿、摘要和深度长文。" : "Generate drafts, briefs, and long-form copy from curated materials.", icon: PenLine },
        { title: zh ? "审核智能体" : "Reviewer agents", description: zh ? "检查内容结构、来源可信度、语气一致性与夸张表述。" : "Check structure, sourcing, tone, hype, and credibility.", icon: FileCheck },
        { title: zh ? "模型与插件" : "Models and plugins", description: zh ? "按角色分配模型能力、工具权限、专属知识库与外部插件。" : "Assign models, tool access, knowledge, and plugin capabilities per role.", icon: Bot },
      ]}
      workflow={[
        { label: zh ? "选择角色" : "Choose role", detail: zh ? "确定智能体负责抽取、写作、审核或配图。" : "Pick extraction, writing, review, or illustration." },
        { label: zh ? "绑定模型" : "Configure model", detail: zh ? "指定模型、API Key 与执行模式。" : "Bind model, API key, and execution mode." },
        { label: zh ? "编排指令" : "Write prompts", detail: zh ? "定义风格规范、输出约束、格式模板与禁区。" : "Define style, constraints, format, and boundaries." },
        { label: zh ? "注入知识" : "Attach knowledge", detail: zh ? "关联参考文档、范例样本和长期记忆。" : "Attach references, examples, and memory." },
        { label: zh ? "投入流水线" : "Ship to pipeline", detail: zh ? "将智能体部署到真实编辑任务中运行。" : "Put the agent into real editorial work." },
      ]}
      mockTitle={zh ? "智能体配置台" : "Agent configuration desk"}
      mockSubtitle={zh ? "模型 · 指令 · 知识库 · 插件" : "Model · Prompt · Knowledge · Plugins"}
      mockItems={zh ? ["抽取智能体", "写作智能体", "审核智能体", "插件能力"] : ["Extractor", "Writer", "Reviewer", "Plugins"]}
    />
  );
}
