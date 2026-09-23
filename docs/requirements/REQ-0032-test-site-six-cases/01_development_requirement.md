<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0032 开发需求

## Schema

- schema: ai-engineering-context/req-package-v1

## 开发需求

| DR | 状态 | 开发需求 | 验收标准 | 约束 |
|---|---|---|---|---|
| DR-0032-01 | 已确认 | 实现共享模板的设备台账页面与 a-f 六个路由，包含筛选、排序、查询、重置、计数、表格和详情弹窗。 | a/c/e 满足业务预期；b 忽略状态筛选，d 在功率降序时交换第 2/3 行整行，f 仅将 DEV-005 详情额定功率显示为 320 kW。 | 不重做工作台 UI，不增加生产上传接口，不改旧站点。 |
| DR-0032-02 | 已确认 | 交付六条一行一用例 Excel，并通过正式后端导入后导出 workbench/case-package-v1 JSON。 | Excel 六条均内容已确认、逐步动作预期成对；后端预览新增 6、确认导入 6；JSON 重新导入预览新增 6。 | 不得手工伪造正式导出包。 |
| DR-0032-03 | 已确认 | 提供独立 Playwright 参考自检和用户中文操作指南。 | 单 worker、零重试完整执行六条，原始结果 3 PASSED/3 FAILED；所有用例保留截图、录像和 trace；三条失败精确归属指定业务差异。 | 参考测试不登记为人工首审或批准资产，不作为 Coding Agent 能力验收。 |

只有状态为 已确认 且验收标准明确的 DR 才能成为正式测试 oracle。
