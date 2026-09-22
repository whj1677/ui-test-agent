<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0031 设计

## 设计标识

| DD | 关联 DR | 状态 | 方案摘要 | 设计理由 |
|---|---|---|---|---|
| DD-0031-01 | DR-0031-01 / DR-0031-02 / DR-0031-03 / DR-0031-05 | 已确认 | 在 workbench/web-v2 提供无构建步骤的同源 HTML/CSS/JS 客户端，并由 server/app.mjs 通过限定路径提供资源。 | 最大复用现有单机服务与墨白原型布局，保持可回退且不引入第二套持久化或前端框架。 |
| DD-0031-02 | DR-0031-02 / DR-0031-03 | 已确认 | 业务事实只来自统一 API 客户端和服务端响应，浏览器仅保留搜索、分页、选择和草稿等界面状态。 | 避免 UI-D1 的演示状态被误当成真实数据，并完整保留后端冲突、幂等和 revision 语义。 |
| DD-0031-03 | DR-0031-04 / DR-0031-06 | 已确认 | 验收服务与用户体验分别使用 ui-d2a-acceptance 和 ui-d2a-trial 数据根，样例公开、运行数据私有。 | 证明真实后端持久化，同时不污染已有项目、历史证据和用户体验数据。 |

## 接口与数据流

- 浏览器 /workspace/ -> 同源 /api/case-library/* -> CaseLibraryManager -> CaseLibraryStore -> WORKBENCH_DATA_DIR/case-library。
- File ArrayBuffer -> POST /uploads -> upload_id/workbook|package -> preview -> confirm -> project revision/cases/imports。
- project/case/version -> PATCH case content -> 服务端生成新版本与哈希；export response bytes -> 浏览器下载 -> 另一项目 JSON preview/confirm。

## 模块文档影响

- 新增 workbench/web-v2、限定静态入口和对应工程/浏览器测试；更新 workbench README、API 映射、用户指南与 UI-D2A 验收报告。
- 新增 workbench/examples/ui-d2a 合成样例；不修改正式旧 web、UI-D1 原型数据、Harness 或业务脚本。

## 风险与回滚

- 前端对服务端分类或 revision 语义二次推断会导致假成功；以服务端响应为权威并覆盖冲突、过期和失败测试。
- 新增静态路径可能误开放仓库或 .local；使用明确白名单和 MIME，回滚只需移除 /workspace 路由与 web-v2 文件。
- 浏览器下载和重启证据若只测 UI 外观会产生伪持久化；必须解析实际下载字节并用新空白浏览器上下文读回后端。
