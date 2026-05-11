# Backend Tests

这个目录用于统一存放后端正式测试，方便后续做回归测试、查验和新增用例。
这里应只保留能够被 `unittest` 直接发现并执行的测试文件。

## 当前分组

- `test_external_integrations.py`
  回归测试入口，覆盖这轮修过的关键链路：
  - Context Lab / Writer 提示词生效
  - 上传与图片生成权限
  - 图片生成按当前用户隔离配置
  - 默认 Agent 并发初始化
  - monitor check / active_jobs 并发保护
  - review job 并发去重
  - 同步 SDK 调用的异步 offload
- `test_monitor_service.py`
  监控任务状态与 URL 解析辅助逻辑
- `test_monitor_discovery.py`
  监控发现模式、小红书提取辅助逻辑
- `test_local_video_service.py`
  本地视频上传、存储与异常处理
- `test_video_downloader.py`
  视频下载与元数据提取
- `test_video_thumbnail_utils.py`
  视频缩略图辅助逻辑
- `test_video_url_utils.py`
  视频 URL 规范化与平台识别

## 推荐跑法

在 `backend/` 目录下执行：

```bash
./.venv/bin/python -m unittest discover -s tests -p 'test*.py'
```

只跑这轮回归重点：

```bash
./.venv/bin/python -m unittest -v tests.test_external_integrations
```

只跑某一个测试文件：

```bash
./.venv/bin/python -m unittest -v tests.test_monitor_service
```

## 维护约定

- 新增后端测试默认放进这个目录，不再散落到 `backend/` 根目录。
- 偏“回归保障”的测试优先追加到 `test_external_integrations.py`，这样排查本轮高风险改动时有统一入口。
- 偏单模块工具函数或服务的测试，按领域继续放独立 `test_*.py` 文件。
- 手工探测、临时查库、一次性排障脚本不要放进这里，统一放到 `scripts/` 或独立的 `tools/manual-tests/`。
