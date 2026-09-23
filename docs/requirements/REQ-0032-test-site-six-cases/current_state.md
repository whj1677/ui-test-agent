<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0032 当前状态

- 需求标题：TEST-SITE-01 设备台账六条通过失败案例

## 元数据

- 需求状态：已确认
- 治理分级：G2
- 当前版本：1
- 最后更新：2026-09-23

## 当前有效用户需求

| UN | 状态 | 内容 |
|---|---|---|
| UN-0032-01 | 已确认 | 提供可在本机亲自操作的设备台账案例及六条完整人工用例。 |

## 当前有效开发需求

| DR | 状态 | 内容 |
|---|---|---|
| DR-0032-01 | 已确认 | 实现共享模板的设备台账页面与 a-f 六个路由，包含筛选、排序、查询、重置、计数、表格和详情弹窗。 |
| DR-0032-02 | 已确认 | 交付六条一行一用例 Excel，并通过正式后端导入后导出 workbench/case-package-v1 JSON。 |
| DR-0032-03 | 已确认 | 提供独立 Playwright 参考自检和用户中文操作指南。 |

## 当前有效设计

| DD | DR | 状态 | 内容 |
|---|---|---|---|
| DD-0032-01 | DR-0032-01 | 已确认 | trial-site 使用一个静态页面模块和 route profile 注入缺陷，Node 仅提供白名单静态文件。 |
| DD-0032-02 | DR-0032-02 | 已确认 | Excel 采用当前后端映射列，JSON 只接受 CaseLibraryManager.exportPackage 的实际响应。 |
| DD-0032-03 | DR-0032-03 | 已确认 | 六条测试共享配对步骤函数，Playwright 原生断言自然产生三个失败并输出原始报告与媒体。 |

## 当前有效任务

| TK | DR/DD | 状态 | 内容 |
|---|---|---|---|
| TK-0032-01 | DR-0032-01 / DD-0032-01 | 已完成 | 实现并验证设备台账页面、固定数据和六路由。 |
| TK-0032-02 | DR-0032-02 / DD-0032-02 | 已完成 | 生成 Excel，经真实工作台导入后导出 JSON 并复验。 |
| TK-0032-03 | DR-0032-03 / DD-0032-03 | 已完成 | 编写独立参考测试、执行六条并形成指南和报告。 |

## 当前有效验证项

| VT | DR | 状态 | 内容 | 当前证据 |
|---|---|---|---|---|
| VT-0032-01 | DR-0032-01 | 人工待确认 | 站点 DOM/交互和三种缺陷精确符合冻结规格。 | 命令：npm run test:trial-site（脚本随后更名为 self-check:trial-site，配置未变）；退出码：1；测试数量：6；失败数量：3；跳过数量：0；证据：workbench/.local/ui-six-cases/reference/raw-report.json；六条均有截图、录像、trace，三个失败均为冻结规格指定业务差异 |
| VT-0032-02 | DR-0032-02 | 人工待确认 | Excel 后端预览/确认及正式 JSON 导出/重新预览均为六条。 | 命令：真实 /workspace/ 浏览器流程；npm --prefix workbench test；退出码：0；测试数量：83；失败数量：0；跳过数量：0；证据：docs/requirements/REQ-0032-test-site-six-cases/logs/workbench-tests-rerun.log；独立数据根 workbench/.local/ui-six-cases/workbench-trial；因同一交付含预期非零的3个业务失败，正式状态统一保留人工待确认 |
| VT-0032-03 | DR-0032-03 | 人工待确认 | 完整参考执行得到 TC-001/002/003 通过，TC-004/005/006 在指定步骤业务断言失败。 | 命令：npm run test:trial-site（脚本随后更名为 self-check:trial-site，配置未变）；退出码：1；测试数量：6；失败数量：3；跳过数量：0；证据：workbench/trial-site/REFERENCE_SELF_CHECK.md；workbench/.local/ui-six-cases/reference/ |

## 人工待确认项

- [ ] 无待确认问题；当前范围与验收均已由用户明确。

## 本轮禁止实现内容

- 不得调用 Harness、建例模型、批量调度或自愈。
- 不得运行或修改既有批准脚本、HOLD/LAB 页面和历史结果。
- 不得用错误预期、test.fail、跳过、故意 throw、吞异常或改报告制造失败。
- 不得把参考脚本结果或演示记录冒充 Coding Agent 执行。
