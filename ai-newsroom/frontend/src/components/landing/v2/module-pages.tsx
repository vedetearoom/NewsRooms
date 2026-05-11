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
      title={zh ? "把当天所有信号整理成一面" : "Turn every incoming signal into a"}
      accentTitle={zh ? "资讯全景墙。" : "live intelligence wall."}
      description={zh ? "资讯全景是客户进入 Newsroom 后看到的第一层：图文情报、视频情报、时间筛选、分类标签和相关性评分汇成一个可行动的编辑视图。" : "Intelligence Panorama is the first layer of Newsroom: articles, video intelligence, time filters, topic tags, and relevance scores in one editorial view."}
      accent="#c0c0dd"
      appPath="/"
      appCta={zh ? "打开资讯全景" : "Open panorama"}
      guestCta={zh ? "申请查看资讯全景" : "Request panorama access"}
      workflowCta={zh ? "查看发现流程" : "See discovery workflow"}
      sections={[
        { title: zh ? "图文情报" : "Text intelligence", description: zh ? "把 RSS、网站和 newsletter 中的重要内容整理成可筛选卡片。" : "Turn RSS, websites, and newsletters into filterable intelligence cards.", icon: FileText },
        { title: zh ? "视频情报" : "Video intelligence", description: zh ? "把视频博主、访谈和长视频解构成摘要、观点和引用。" : "Break down creator videos, interviews, and long-form clips into summaries and citations.", icon: MonitorPlay },
        { title: zh ? "时间与归档" : "Time and archive", description: zh ? "按今日、本周、归档快速定位编辑团队需要关注的内容。" : "Move between today, this week, and archive views without losing context.", icon: Gauge },
        { title: zh ? "分类与评分" : "Tags and scoring", description: zh ? "自动分类主题，并按编辑标准给每条信号打分。" : "Automatically classify topics and score every signal against your editorial rubric.", icon: Tags },
      ]}
      workflow={[
        { label: zh ? "抓取信号" : "Collect signals", detail: zh ? "从情报网络进入图文和视频素材。" : "Bring article and video material in from the intelligence network." },
        { label: zh ? "分类打分" : "Classify and score", detail: zh ? "按主题、热度、可信度和相关性排序。" : "Rank by topic, urgency, trust, and editorial relevance." },
        { label: zh ? "筛选重点" : "Filter the board", detail: zh ? "编辑按时间、类型和标签缩小范围。" : "Editors narrow the board by time, media type, and tags." },
        { label: zh ? "批量分发" : "Dispatch in batches", detail: zh ? "把值得跟进的内容送入内容工作台。" : "Send promising items into the content workspace." },
        { label: zh ? "进入生产" : "Move to production", detail: zh ? "由素材变成选题、草稿和任务。" : "Signals become topics, drafts, and production tasks." },
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
      title={zh ? "把零散情报变成可生产的" : "Turn scattered signals into"}
      accentTitle={zh ? "内容资产。" : "content assets."}
      description={zh ? "内容工作台负责承接资讯全景里的重要发现，把它们整理成情报卡片、灵感素材、写作任务、审稿上下文和可复用素材库。" : "Content Workspace receives the best discoveries from the panorama and turns them into cards, inspiration blocks, writing tasks, review context, and reusable source material."}
      accent="#a78bfa"
      appPath="/vault"
      appCta={zh ? "打开内容工作台" : "Open workspace"}
      guestCta={zh ? "申请试用工作台" : "Request workspace access"}
      workflowCta={zh ? "查看内容生产流程" : "See content workflow"}
      sections={[
        { title: zh ? "情报卡片" : "Intelligence cards", description: zh ? "把值得关注的信号保存成可追踪、可引用、可分发的卡片。" : "Save promising signals as trackable, citable, dispatchable cards.", icon: ClipboardList },
        { title: zh ? "灵感库" : "Inspiration library", description: zh ? "沉淀选题角度、标题、结构、案例和表达方式。" : "Collect angles, titles, structures, examples, and reusable patterns.", icon: Library },
        { title: zh ? "写作任务" : "Writing tasks", description: zh ? "把整理好的素材交给 Writer Agent，进入草稿生产。" : "Hand curated materials to Writer agents for draft production.", icon: PenLine },
        { title: zh ? "审稿上下文" : "Review context", description: zh ? "保留来源、引用、修改记录和审稿状态，减少来回确认。" : "Keep sources, citations, edits, and review status together.", icon: FileCheck },
      ]}
      workflow={[
        { label: zh ? "保存卡片" : "Save cards", detail: zh ? "从资讯全景挑选值得跟进的情报。" : "Pick promising intelligence from the panorama." },
        { label: zh ? "整理素材" : "Organize material", detail: zh ? "补充来源、角度、参考和结构。" : "Add sources, angles, references, and structure." },
        { label: zh ? "创建任务" : "Create tasks", detail: zh ? "把素材交给写作智能体。" : "Pass the working set to a writer agent." },
        { label: zh ? "审稿修改" : "Review edits", detail: zh ? "把反馈、评分和修改记录留在同一处。" : "Keep feedback, scores, and edits in one place." },
        { label: zh ? "沉淀复用" : "Reuse assets", detail: zh ? "把优秀结构和素材变成下次可复用资产。" : "Turn strong structures and sources into reusable assets." },
      ]}
      mockTitle={zh ? "内容生产桌面" : "Production desk"}
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
      title={zh ? "把每个外部来源接入受控的" : "Connect every outside source into a governed"}
      accentTitle={zh ? "情报网络。" : "intelligence network."}
      description={zh ? "情报网络管理 RSS、网站、newsletter、视频博主和凭证边界，让进入 Newsroom 的每条信号都有来源、状态和抓取记录。" : "Intelligence Network manages RSS, websites, newsletters, video creators, and credential boundaries so every signal has a source, status, and ingestion trail."}
      accent="#d6c7a1"
      appPath="/sources"
      appCta={zh ? "打开情报网络" : "Open network"}
      guestCta={zh ? "申请接入信源" : "Request network access"}
      workflowCta={zh ? "查看信源接入流程" : "See source workflow"}
      sections={[
        { title: zh ? "RSS / Web 信源" : "RSS / Web sources", description: zh ? "统一维护媒体、博客、官网和垂直网站来源。" : "Maintain media, blogs, official sites, and niche sources in one registry.", icon: Radio },
        { title: zh ? "视频博主监控" : "Creator monitoring", description: zh ? "持续跟踪视频博主和长视频内容，并转成可处理文本。" : "Track video creators and long-form content, then convert them into usable text.", icon: MonitorPlay },
        { title: zh ? "抓取健康状态" : "Fetch health", description: zh ? "监控失败、过期、重复和低质量来源。" : "Watch failures, stale feeds, duplicates, and low-quality sources.", icon: ShieldCheck },
        { title: zh ? "凭证边界" : "Credential boundary", description: zh ? "私有 cookie 和平台凭证留在运行时配置里，不进入公开页面。" : "Keep private cookies and platform credentials in runtime configuration.", icon: Network },
      ]}
      workflow={[
        { label: zh ? "添加来源" : "Add source", detail: zh ? "接入 RSS、网站、newsletter 或视频博主。" : "Connect RSS, websites, newsletters, or video creators." },
        { label: zh ? "定时抓取" : "Schedule fetches", detail: zh ? "按频率拉取更新，并记录状态。" : "Pull updates on a cadence and record status." },
        { label: zh ? "清洗去重" : "Clean and dedupe", detail: zh ? "移除重复内容，补齐元数据。" : "Remove duplicates and complete metadata." },
        { label: zh ? "进入全景" : "Route to panorama", detail: zh ? "把可信内容送入资讯全景。" : "Route trustworthy material into the panorama." },
        { label: zh ? "持续治理" : "Govern continuously", detail: zh ? "按健康度调整来源和抓取策略。" : "Tune sources and fetch strategy by health." },
      ]}
      mockTitle={zh ? "情报来源库" : "Source registry"}
      mockSubtitle={zh ? "RSS · Web · Video · Credentials" : "RSS · Web · Video · Credentials"}
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
      title={zh ? "配置一支可协作的" : "Configure a collaborative"}
      accentTitle={zh ? "AI 编辑团队。" : "AI editorial team."}
      description={zh ? "智能体工作室负责配置抽取、写作、审稿和配图智能体，包括模型、Prompt、知识库、插件和执行方式。" : "Agent Studio configures extraction, writing, review, and illustration agents: models, prompts, knowledge, plugins, and execution modes."}
      accent="#86efac"
      appPath="/agents"
      appCta={zh ? "打开智能体工作室" : "Open Agent Studio"}
      guestCta={zh ? "申请配置智能体" : "Request agent access"}
      workflowCta={zh ? "查看智能体协作流程" : "See agent workflow"}
      sections={[
        { title: zh ? "抽取智能体" : "Extractor agents", description: zh ? "从来源中提取核心事实、标签、引用和结构化元数据。" : "Extract facts, tags, citations, and structured metadata from sources.", icon: Search },
        { title: zh ? "写作智能体" : "Writer agents", description: zh ? "根据素材和风格要求生成草稿、摘要和长文。" : "Generate drafts, briefs, and long-form copy from curated materials.", icon: PenLine },
        { title: zh ? "审核智能体" : "Reviewer agents", description: zh ? "检查结构、来源、语气、夸张表述和可信度。" : "Check structure, sourcing, tone, hype, and credibility.", icon: FileCheck },
        { title: zh ? "模型与插件" : "Models and plugins", description: zh ? "为不同角色配置模型、工具权限、知识和插件能力。" : "Assign models, tool access, knowledge, and plugin capabilities per role.", icon: Bot },
      ]}
      workflow={[
        { label: zh ? "选择角色" : "Choose role", detail: zh ? "确定抽取、写作、审核或配图任务。" : "Pick extraction, writing, review, or illustration." },
        { label: zh ? "配置模型" : "Configure model", detail: zh ? "绑定模型、API key 和执行模式。" : "Bind model, API key, and execution mode." },
        { label: zh ? "写入指令" : "Write prompts", detail: zh ? "定义风格、约束、格式和禁区。" : "Define style, constraints, format, and boundaries." },
        { label: zh ? "注入知识" : "Attach knowledge", detail: zh ? "补充参考文档、样例和长期记忆。" : "Attach references, examples, and memory." },
        { label: zh ? "投入流水线" : "Ship to pipeline", detail: zh ? "让智能体进入真实编辑任务。" : "Put the agent into real editorial work." },
      ]}
      mockTitle={zh ? "智能体配置台" : "Agent configuration desk"}
      mockSubtitle={zh ? "Model · Prompt · Knowledge · Plugins" : "Model · Prompt · Knowledge · Plugins"}
      mockItems={zh ? ["抽取智能体", "写作智能体", "审核智能体", "插件能力"] : ["Extractor", "Writer", "Reviewer", "Plugins"]}
    />
  );
}
