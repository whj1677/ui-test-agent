<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0039 变更记录

| 日期 | 版本 | 类型 | 变更内容 | 影响 | 确认人 |
|---|---:|---|---|---|---|
| 2026-09-26 | 1 | 新建 | 用户授权完整环境包及主板永久授权；独立组件供其他Agent接入。 | 新增独立device-license与主库启动适配及便携打包。 | 用户2026-09-26确认主板绑定及独立组件。 |
| 2026-09-26 | 2 | 实现及有限验收 | 完成全环境r2候选、独立.NET DLL接入、首次DPAPI配置、同机中文路径重定位及正式4322真实激活与重启；完整产品VT不扩大为通过。 | 新增部署产物/独立授权组件与证据；正式数据原位保留，未提交推送。 | 用户已授权实现与真实验收，主管按实际证据独立复核。 |
| 2026-09-27 | 3 | Skills包及首次初始化路径复核 | 用户授权继续未完事项。初步审查遗漏setup-runtime而怀疑首次初始化依赖pnpm；主管核对portable启动、启用模型和原真实探针后推翻该判断，叫停不必要的bootstrap改造。新Skills包构建与独立核验仍进行中。 | 沿用已有离线profile/junction架构，更新含Skills的候选包；DLL、硬件策略、旧包和旧证据保持。 | start-workbench.ps1:106、enable-model-workbench.ps1:14、setup-runtime.ps1及旧verify-installed.mjs。 |
| 2026-09-28 | 4 | Skills 1.1本机包有限验收 | 完成Skills 1.1新候选/便携ZIP构建及独立字节核验、普通Windows PowerShell解压、包内Node与私有RuntimeHome离线探针；保留r2/a7历史证据。 | TK-0039-01从待重包更新为本机新包核验完成；发布、干净Windows与客户独立安装仍待确认，未扩展DLL或实体换板结论。 | 主管复核workbench/qa/20260928-skills11/packaging-acceptance-summary.json/.md、原日志与截图/录像。 |

历史记录只保留在本文件；已撤销或已替换内容不得继续出现在当前任务、验证和当前 trace 中。
