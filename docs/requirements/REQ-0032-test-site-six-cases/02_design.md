<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0032 设计

## 设计标识

| DD | 关联 DR | 状态 | 方案摘要 | 设计理由 |
|---|---|---|---|---|
| DD-0032-01 | DR-0032-01 | 已确认 | trial-site 使用一个静态页面模块和 route profile 注入缺陷，Node 仅提供白名单静态文件。 | 保证每组正常/故障入口除实现缺陷外使用同一 UI、数据和业务逻辑。 |
| DD-0032-02 | DR-0032-02 | 已确认 | Excel 采用当前后端映射列，JSON 只接受 CaseLibraryManager.exportPackage 的实际响应。 | 让文件与当前 UI-D2A 真实解析和导出契约一致。 |
| DD-0032-03 | DR-0032-03 | 已确认 | 六条测试共享配对步骤函数，Playwright 原生断言自然产生三个失败并输出原始报告与媒体。 | 失败来自页面预设缺陷，不用 test.fail、skip、throw 或报告篡改制造。 |

## 接口与数据流

- 浏览器 -> 127.0.0.1:4320/ui/{a..f} -> trial-site 静态资源与固定设备数据。
- UI_TRIAL_6_CASES.xlsx -> /workspace/ 文件上传 -> 后端预览 -> 独立项目确认入库 -> 正式导出 UI_TRIAL_6_CASES.workbench.json -> 新项目重新预览。

## 模块文档影响

- 本次无需模块文档变更，原因：仅新增与正式工作台执行链隔离的 trial-site、六案例文件和专项参考测试，不改变现有产品模块、公开接口或配置语义；启动、路由、预设缺陷、文件闭环和未接入边界均由 workbench/trial-site 文档与 REQ-0032 维护。

## 风险与回滚

- 站点与数据均在新增目录；回滚可删除新增目录和 REQ-0032，不影响旧工作台数据。
- 参考执行预期返回非零；必须从原始报告核对恰为指定三条业务失败，不能把退出码 1 当成测试基础设施故障。
