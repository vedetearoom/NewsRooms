# AI Newsroom Frontend

前端基于 `Next.js 16 + React 19 + TypeScript + Tailwind CSS 4`，负责 AI Newsroom 的编辑、收件箱、消息源、素材库和智能体配置界面。

## 主要模块

- `src/app/page.tsx`
  收件箱首页，聚合内容卡片与筛选视图。
- `src/app/editor`
  编辑器工作区，包含写作、审稿、差异对比和源卡片引用。
- `src/app/sources`
  消息源与监控管理，包括文本源、视频监控和抓取流水线。
- `src/app/vault`
  素材库与 inspirations 管理。
- `src/app/agents`
  智能体配置页面。
- `src/components/features`
  按业务域拆分的功能组件。
- `src/components/shared`
  跨页面共享组件。
- `src/hooks`
  页面状态、轮询、选择状态等复用逻辑。
- `src/lib`
  API 封装、工具函数和编辑器/监控相关辅助逻辑。

## 本地启动

在 `frontend/` 目录下执行：

```bash
npm install
npm run dev
```

默认开发地址：

```bash
http://localhost:3000
```

也可以使用仓库根目录脚本：

```bash
bash ../start-frontend.sh
```

## 环境变量

当前前端主要依赖：

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
INTERNAL_API_URL=http://localhost:8000
```

说明：

- `NEXT_PUBLIC_API_URL` 主要给本地开发或直接访问前端容器时使用
- `INTERNAL_API_URL` 主要给 Next.js 服务端渲染和容器内反向代理使用
- 浏览器端默认继续走同源 `/api/*`，这样在 Nginx 反代场景下不需要把前端代码改成写死某个后端域名

如果都不配置，前端会默认回落到本地 `8000` 端口后端。定义位置见 [src/lib/api.ts](/Users/jay/Desktop/claude/ai-newsroom/frontend/src/lib/api.ts:1) 和 [next.config.ts](/Users/jay/Desktop/claude/ai-newsroom/frontend/next.config.ts:1)。

## Docker / Nginx

前端容器化入口见：

- [Dockerfile](/Users/jay/Desktop/claude/ai-newsroom/frontend/Dockerfile:1)
- [../../docker/ai-newsroom/nginx/default.conf](</Users/jay/Desktop/claude/docker/ai-newsroom/nginx/default.conf>)

当前策略不是导出纯静态页面，而是：

- 生产镜像使用 Next.js `standalone` 运行时
- Nginx 作为统一入口，把 `/` 代理到前端，把 `/api/` 代理到后端
- 这样既兼顾 SSR / App Router，又兼顾 Nginx 部署、SSE 和大文件上传

## 常用命令

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## 当前结构状态

前端这一轮结构整理后的主要落点是：

- 页面层：
  - `Inbox / Sources / Pipeline / Monitors` 已统一到共享的 [page-top-bar.tsx](/Users/jay/Desktop/claude/ai-newsroom/frontend/src/components/shared/page-top-bar.tsx:1) 与 [page-states.tsx](/Users/jay/Desktop/claude/ai-newsroom/frontend/src/components/shared/page-states.tsx:1) 体系
  - 页面级 `loading / error / empty / content` 分支优先通过 `PageStateBoundary` 处理
- 共享组件层：
  - `command-palette` 已拆成 `state hook + chrome + step panels`
  - 文本流水线工具栏、多选条、视频卡片等共享热点已抽出基础组件
- 业务组件层：
  - `inbox / sources / editor / vault` 的主要状态逻辑已经尽量从页面文件收口到 `hooks/` 或 `features/`
  - 图文与视频链路的相对时间、状态文案、空态提示已经统一到共享工具和 locale

如果后续继续开发，建议优先遵守下面的落点：

- 新页面优先复用 `PageTopBar`、`PageStateBoundary`
- 复杂交互状态优先进入 `src/hooks/`
- 同类业务 UI 优先先看 `src/components/shared/` 是否已经有基础壳层可以复用
- 避免把新的异步反馈、状态文案和轮询逻辑重新散回页面组件

## 开发约定

- API 请求统一从 [src/lib/api.ts](/Users/jay/Desktop/claude/ai-newsroom/frontend/src/lib/api.ts:1) 进入
- 页面级复杂状态优先放到 `src/hooks/`
- 业务组件优先放在 `src/components/features/<domain>/`
- 共享 UI 或共享流程组件放到 `src/components/shared/`
- 结构性重构以“减轻页面职责”为主，不追求过度拆分

## 共享组件约定

当前已经沉淀出来的共享壳层和基础组件主要有：

- 页面壳层：
  - [page-top-bar.tsx](/Users/jay/Desktop/claude/ai-newsroom/frontend/src/components/shared/page-top-bar.tsx:1)
  - [page-states.tsx](/Users/jay/Desktop/claude/ai-newsroom/frontend/src/components/shared/page-states.tsx:1)
- 文本流水线：
  - [article-pipeline-toolbar.tsx](/Users/jay/Desktop/claude/ai-newsroom/frontend/src/components/shared/article-pipeline-toolbar.tsx:1)
  - [article-pipeline-selection-bar.tsx](/Users/jay/Desktop/claude/ai-newsroom/frontend/src/components/shared/article-pipeline-selection-bar.tsx:1)
- 视频链路：
  - [monitor-video-card.tsx](/Users/jay/Desktop/claude/ai-newsroom/frontend/src/components/shared/monitor-video-card.tsx:1)
- 命令面板：
  - [command-palette.tsx](/Users/jay/Desktop/claude/ai-newsroom/frontend/src/components/shared/command-palette.tsx:1)
  - [command-palette-step-panels.tsx](/Users/jay/Desktop/claude/ai-newsroom/frontend/src/components/shared/command-palette-step-panels.tsx:1)
- 选择操作条：
  - [floating-action-bar.tsx](/Users/jay/Desktop/claude/ai-newsroom/frontend/src/components/shared/floating-action-bar.tsx:1)

新增同类功能时，优先在这些基础壳层上扩展，而不是复制一套新的页面结构。

## 任务状态约定

任务主状态统一由 [src/lib/task-status.ts](/Users/jay/Desktop/claude/ai-newsroom/frontend/src/lib/task-status.ts:1) 和 [backend/app/task_status.py](/Users/jay/Desktop/claude/ai-newsroom/backend/app/task_status.py:1) 维护，当前以这 6 个状态为准：

- `pending`：任务刚创建，或被重生成后等待重新写作
- `writing`：正在生成正文，或翻译重跑后的草稿生成阶段
- `written`：正文生成完成，尚未进入或完成审稿
- `reviewing`：审稿任务进行中
- `completed`：用户接受结果，任务正式完成
- `failed`：写作或审稿链路失败，可恢复或重试

页面层按下面的口径消费状态：

- 看板分组使用 `getTaskBoardStage`
- 资料库收纳使用 `getTaskLibraryBucket`
- 编辑器恢复能力使用 `isEditorRecoverableTaskStatus`
- 编辑器按钮显隐与禁用逻辑统一走 [src/lib/editor-phase.ts](/Users/jay/Desktop/claude/ai-newsroom/frontend/src/lib/editor-phase.ts:1)

## 异步反馈约定

异步任务的提示和结果恢复遵循同一套入口，避免页面各自维护一份文案和轮询逻辑：

- 文本抓取/处理完成提示统一走 [src/hooks/usePipelineJobNotifications.ts](/Users/jay/Desktop/claude/ai-newsroom/frontend/src/hooks/usePipelineJobNotifications.ts:1)
- 视频分析、编辑器流式写作、审稿、图片生成失败提示统一走 [src/lib/async-feedback.ts](/Users/jay/Desktop/claude/ai-newsroom/frontend/src/lib/async-feedback.ts:1)
- 跨页面后台任务恢复统一走 [src/lib/job-store.ts](/Users/jay/Desktop/claude/ai-newsroom/frontend/src/lib/job-store.ts:1)
- 任务重生成使用专用接口 `/api/tasks/{id}/regenerate`，不要在前端直接写任意任务状态
