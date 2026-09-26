# CASE-02 可信计时版独立语义审查

审查对象：正式工作台任务 `build-20260926021703-79029f54`，项目 `project-93d8424d-0576-4c76-b18e-2157f823d8f8`，原 CASE-02 v1。业务真值为 `workbench/qa/20260925-release/fixture/SPEC.md`，原动作为同目录 `cases.json` 的 CASE-02。仅只读审查；未修改候选、被测站、用例或批准状态。

## 冻结要求与五步核对

| 步骤 | 原动作和关键预期 | 终稿实现与判断 |
|---|---|---|
| 1 | 已登录工作台输入“温控”并点击“查询”；“正在加载设备列表…”可见后约 400–600ms 消失并刷新，分页 1/2、共 3 条。 | `development/final/candidate.spec.mjs:33–44` 执行输入、点击、提示属性/文案/可见/隐藏和精确分页。候选不自设时钟；时间由可信运行器核验。动作与非时间断言保留。 |
| 2 | 第 1 页按序恰有 INV-101（温控采集器A）、INV-102（温控采集器B），展示编号、名称、库存状态、“可选”。 | 46–69 行限定恰两行，按表头取字段，精确核对编号、名称、可选状态；库存状态要求可见且非空。符合原用例的“展示”表述，但未逐字断言 SPEC 中各库存状态真值。 |
| 3 | 点击“下一页”，第 2 页仅 INV-104（温控采集器C），分页 2/2、共 3 条，整体顺序 101/102/104。 | 71–82 行实际点击、核对唯一行/分页，并合并两页编号做精确顺序断言；保留。 |
| 4 | 点击 INV-104 所在行“查看详情”；抽屉加载提示先可见，约 400–600ms 后核对编号、名称、型号、库位、库存、权限提示六项。 | 84–101 行限定目标行、点击其按钮，提示文案/可见/隐藏与抽屉、六字段均有断言；候选不自设时钟。保留。 |
| 5 | 点击“关闭详情”，筛选“温控”和第 2 页保持，无数据修改。 | 103–116 行点击关闭、断言抽屉隐藏、筛选/页码/唯一行保持、已选仍 0。脚本未执行写操作；SPEC 明确站点不存在真实业务写入口。保留。 |

## 计时与执行证据

- 磁盘终稿 `development/final/candidate.spec.mjs` 的实际 SHA-256 为 `37CF6ED33738E4A35826D1583D151E39BDE07A9286270534561C30563625A0F0`，与 `task.json` 的 submission、候选、正常运行记录一致；提交包 SHA-256 `224752C8BC34749ADF6A003E0A8EC8C742E18125A2AEC55C9B4AE5E5932FE5C0`，与 `development/fidelity-review.json` 所指包一致。原用例 `content_sha256` 为 `92A92C974DE67B28A8EB95A906C5193C6A981EF4752277894482E6FDCD82876A`，fidelity-review 的 `frozen_case_sha256` 与之相同。
- 运行器从原预期提取两个 `400–600ms` 区间；`timing-observer.mjs:3–69` 在相应 `CASE_STEP` 内用同页面 `performance.now`、精确匹配的 live/status 元素、MutationObserver 与 animation frame 观察隐藏→可见→隐藏。`timing-evidence.mjs:1–31` 要求 run_id、候选哈希、步骤、原目标、原上下界、零附加容差、唯一完整周期及区间值一致；不完整会使技术结果失败。终稿只有可见性断言，未发现 Date/performance/自定义区间或固定等待。
- 自测 1 次的可信计时为 STEP1 **510ms**、STEP4 **521.3ms**；最终正常运行候选的 `trial_runs[0].timing_validation` 为 STEP1 **519.4ms**、STEP4 **517.5ms**，均 `PASSED`、`min_ms=400`、`max_ms=600`、`tolerance_added_ms=0`，每步仅一个完整周期且初始不可见。最终 `development/final/normal/artifacts/step-evidence/step-observations.ndjson` 逐步记录的 run_id 为 `build-20260926021703-79029f54-normal`、候选 SHA-256 与磁盘一致，STEP1/4 原始计时值与 trial_runs 一致，五步均 `PASSED`。`development/final/normal/playwright-report.json` 为 1 expected、0 unexpected、0 skipped，结果 passed、0 errors。独立打开 STEP4-after 与 STEP5-after 截图，分别可见 INV-104 六字段详情和关闭后的“温控”第 2 页状态。
- 此观察器直接证明的是**命名加载提示的可见持续时间**，不独立证明任意产品的数据刷新语义。对当前冻结合成站，`fixture/index.html:188–205` 在同一个 `loadList` 续执行中先隐藏提示、再同步更新列表与分页；`:208–230` 在同一个 `openDetail` 续执行中先隐藏详情提示、再同步填充详情字段。因此当前站的提示周期与随后页面断言紧邻且无中间异步等待；此关联只适用于此夹具。服务端 `fixture/server.mjs:160–162` 与 `:173–182` 对两个请求分别使用固定延迟响应。不能推广为通用网站的完整语义证明。

## 边界与结论

`task.json` 记录 26/120 工具、1/1 Harness、1/3 自测；从 02:17:03.864Z 到 02:20:01.876Z 约 2 分 58 秒，低于 20 分钟。终态 `WAITING_HUMAN_REVIEW / TECHNICAL_VALIDATION_PASSED`，候选 `approval_status=NOT_APPROVED`，保真文件 `semantic_approval=false`、`human_review_required=true`。

**独立有限结论：本轮 CASE-02 候选在当前冻结合成站及最终正常运行中覆盖原五步动作，两个原定 400–600ms 提示周期均由可信运行器按零容差实测落入范围；未发现需要拒绝的原用例语义缺口。** 库存状态只核对展示/非空，未扩展为 SPEC 真值逐字校验。本结论不自动批准候选，也不代替主管的同版复跑及最终验收。
