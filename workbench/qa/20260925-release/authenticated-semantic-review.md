# CASE-02/03 认证环境候选语义审查

状态：CASE-03 生成任务 `build-20260926011026-be1ef079` 已有终稿与正常验证，审查结论见下；CASE-02 仍待任务。下文区分 `run-1` 冻结快照与终稿。业务真值以 `fixture/SPEC.md` 为准，原用例以 `fixture/cases.json` 为准；技术自测通过不能替代逐项审查。

## 不可省略的动作与预期

| 用例 | 冻结要求 |
|---|---|
| CASE-02 | 已认证 `/workspace` 中在“名称筛选”输入“温控”并**点击“查询”**；亲眼捕获“正在加载设备列表…”出现与消失，约 **400–600ms**；第 1 页指示“第 1 页 / 共 2 页（共 3 条）”，恰为按编号升序的 INV-101、INV-102，行内核对编号、名称、库存状态、可选状态；点击“下一页”，第 2 页仅 INV-104，指示“第 2 页 / 共 2 页（共 3 条）”；点击 **INV-104 所在行**“查看详情”，抽屉先显示“正在加载设备详情…”约 **400–600ms**，后核对 INV-104、温控采集器C、TCA-100C、A-01-03、在库（充足）、“当前角色 inspector 可选择该设备”；点击“关闭详情”，抽屉关闭、筛选“温控”与第 2 页保持、无数据修改。 |
| CASE-03 | 已认证、无筛选、零勾选；**确认筛选框为空后点击“查询”**，捕获列表加载提示出现及消失，第 1 页恰为 INV-101/102，指示 3 页 5 条；勾选 INV-101，已选文案精确为“已选 1 台：INV-101”；点击“下一页”，第 2 页恰为 INV-103/104，INV-103 复选框 `disabled`、状态“受限不可选”、原因“该设备为受限资产，当前角色 inspector 无权选择”；**实际尝试点击 INV-103 复选框**，确认仍未勾选、未计入已选，再勾 INV-104，已选文案精确为“已选 2 台：INV-101、INV-104”；点击“下一页”，第 3 页仅 INV-105，已选 2 台保持；连续点击“上一页”两次回第 1 页，INV-101 仍勾选；不触发保存、提交或真实数据修改。 |

审查重点：不可把用例动作改写为仅 DOM/源码读取、预设页面状态、跳过“查询”或详情加载；不可用固定等待代替捕获加载提示与 400–600ms 窗口；不可只检查 INV-103 禁用而省去实际尝试点击；不可仅以含糊 `contains`/数量断言替代逐行顺序、字段和跨页保持；不可把认证绕过、手工注入会话或夹具修改当成候选能力。

## 认证执行与输出边界的代码预审

- `workbench/server/auth/session.mjs` 将认证浏览器绑定到 loopback CDP，`attachEndpoint` 先核对会话仍为 `VALID` 且版本一致；`workbench/server/build/manager.mjs` 向生成任务传该端点，并在提示中限制仅观察已登录页面、不得执行登录/退出或查看 Cookie。
- `harness-probe/config/browser-auth-attach.cordis.yml` 固定 `mode: attach`；已安装插件 `harness-probe/node_modules/@deepseek-ai/dsh-experimental-browser-use-playwright-mcp/lib/index.js` 在 attach 分支只传 `--cdp-endpoint` 且设为 `exclusive`，未见失败后自动改用隔离无认证浏览器的分支。此为代码路径判断，仍须结合本次任务轨迹确认实际工具行为。
- `workbench/server/build/adapter.mjs` 固定使用 `workbench/config/candidate.playwright.config.mjs`；该配置在有认证状态时注入新测试上下文、阻止 service worker 且将 Trace 设为 `off`。`harness-probe/src/verify-candidate.mjs` 通过仅 loopback、随机路径、运行后关闭的临时通道提供内存状态；没有把状态写进候选或命令行参数。`workbench/server/build/candidate-trials.mjs` 对认证试跑标记 `DISABLED_FOR_AUTH_PRIVACY`，所需媒体为视频与截图而非 Trace。
- `workbench/server/build/development-policy.mjs` 拒绝候选直接使用新上下文/新页面、`storageState`、`addCookies`、网络请求和任意导航目标。`harness-probe/src/harness-runner.mjs` 对返回的 stdout、stderr、事件做显式端点和常见密钥字段脱敏。脱敏是有限规则；本次仍应只核对任务记录中的脱敏状态与 Trace 策略，不读取原始会话状态或凭据。

## 实际候选与执行报告

### CASE-03：self_test1 前冻结快照（非终稿）

快照路径：`workbench/.local/fresh25-b/build-tasks/build-20260926011026-be1ef079/development/run-1/candidate.spec.mjs` 与同目录 `helpers.mjs`。这是待自测的静态代码审查，**尚不构成实际执行或候选交付通过**。

- 原六步动作均能在代码中找到：空筛选后点击查询并观察加载提示（脚本 37–44、helper 58–66）；INV-101 勾选与精确计数（46–53）；第 2 页行序、名称、INV-103 禁用/状态/原因（55–71）；对禁用的 INV-103 进行 `click({ force: true })` 实际点击尝试并确认未勾选、计数仍为 1，再勾选 INV-104 并精确核对计数（73–85）；第 3 页与跨页计数（87–94）；两次上一页返回并确认 INV-101 仍勾选（96–107）。未看到脚本改原预期或额外筛选。
- 加载 helper 在触发查询前登记 `visible` 等待，随后要求提示文案和隐藏态；它不测量 400–600ms 的时间窗口。CASE-03 原用例仅要求提示出现消失，故不将此列为 CASE-03 用例遗漏；底层 SPEC 的约 500ms 行为仍未由该快照实测。CASE-02 的两个 400–600ms 明确预期必须在其候选中另审。
- “无保存/提交/数据修改入口”的辅助断言只检查工作台内表单、submit 控件及按钮文案（helper 68–79），并未检查网络写请求。脚本本身只执行查询、翻页、勾选，不调用业务写操作；此处可作为 UI 入口断言，不能单独证明无底层数据修改。
- `deviceRow` 以行内带指定设备编号的复选框绑定，列表通过全部当前页行的编号序列做精确比较，降低仅靠文本匹配的弱断言风险。`force: true` 的禁用复选框点击是否能顺利执行、以及运行时认证与媒体结果，待 self_test1 和终稿报告确认。

原用例、候选、被测页和批准状态保持不变。

### CASE-03：终稿与正常验证独立审查

- 终稿 `development/final/candidate.spec.mjs` SHA-256 `1580D690E73CD83E028E9B657D600743228DC9F200810B38D13DE334784BF351`，`helpers.mjs` SHA-256 `674AC6433F62371925B97E459C2BAA8F2AD8C5A27977D140C254CB1CD6CB60E3`，与主管提供的冻结哈希一致。终稿脚本 37–108 行仍对应原六步：空筛选查询及加载循环、第 1 页精确行序、INV-101 勾选、第 2 页 INV-103/104 与受限原因、`force` 点击 INV-103 后验证未勾选且计数仍为 1、勾 INV-104 后计数为 2、第 3 页保持与两次返回。新增 helper 57–80 行将页行数、可见性、已选文案和分页文案显式校验；没有弱化原断言或替换动作。
- 正常验证报告 `development/final/normal/playwright-report.json` 的统计为 expected 1、unexpected 0、skipped 0；单次结果 `passed`、0 errors、约 7031ms，六个 `CASE_STEP_1..6` 均记录于 `development/final/normal/artifacts/step-evidence/step-observations.ndjson`，run_id `build-20260926011026-be1ef079-normal`，记录中的 candidate SHA-256 与终稿一致。每步有 before/after 截图，报告附件有截图和视频、未见 Trace 附件。
- 独立打开 `case_step_4-after.png`，可见第 2 页 INV-103 复选框未勾选且灰置、受限原因可见，INV-104 已勾选、已选文案为 2 台且仅 INV-101/104；打开 `case_step_6-after.png`，可见返回第 1 页后 INV-101 仍勾选，已选仍为 2 台。截图直接支持受限和跨页终态；“确实进行了受限点击”由终稿 77 行的浏览器动作与该运行成功共同支持，静态截图本身不显示点击瞬间。
- **独立语义判断：CASE-03 终稿覆盖原六步动作和预期，未发现遗漏、改动作或弱断言；正常验证已执行通过。** 此判断限于该候选、该认证合成页面与本次报告，不代替主管最终验收。SPEC 的约 500ms 延迟没有量化断言，原 CASE-03 用例仅要求加载提示出现后消失；无底层写入的结论仍需以被测环境只读事实和未执行写操作为边界。

### CASE-03：保真元数据绑定核查

`task.json` 的 `development.fidelity.bundle_sha256` 保留早期手动 `check_fidelity` 的 B21CB8E32B42E3D0D76E37776F4D296213D216C5AD1AE6C881B17FF0E7F17686，这是首测包的历史材料，不能作为最终审查对象。最终 `development.submission.bundle.sha256`、`development.fidelity_review.bundle_sha256` 与磁盘 `development/fidelity-review.json.bundle_sha256` 均为提交包 92F93AE45518799D0022336BCB7FADFF6C0E9E54172EA74FF4C05C8AAF0B85E2；审查对象 candidate SHA-256 为 1580D690E73CD83E028E9B657D600743228DC9F200810B38D13DE334784BF351，`semantic_approval:false`、`human_review_required:true`。`workbench/web-v2/app.js:701` 优先取 `fidelity_review`，且 706 行把所选包与 submission 包比较；`workbench/server/execution-records.mjs:19` 同样优先取 `fidelity_review`。因此当前 UI 和执行记录按代码显示最终包，不会因旧 `development.fidelity` 误示旧包。历史字段仍并存，若外部只读消费者直接取 `development.fidelity` 会读到旧快照；应以 `development.fidelity_review` 和提交包哈希为准。

### CASE-02：首次生成中断（无候选，语义未审）

首次任务 `build-20260926011616-3465280c` 的 `task.json` 显示 `task_status=AUTH_SESSION_BLOCKED`、`verification_status=INCOMPLETE`、`human_review_status=NOT_READY`、`failure.category=AUTH`，`development.tool_calls=22/120`、`harness_starts=1/1`、自测 0/3、`draft_sha256=null`、`submission=null`、候选 0。`development/harness-summary.json` 显示 `success=false`、`completed=false`、`candidateExists=false`、`termination=cancelled`、浏览器工具调用 20、未触及工具数上限。**本次没有可供 CASE-02 语义审查的脚本，不能判断用例覆盖，更不能判语义通过。**

只对 `development/harness-events.json` 做结构化脱敏核对，未输出原始参数或凭据：末段第 104 项为 `browser_evaluate`，参数包含 Cookie/storage 相关词；第 105 项工具结果是 guard 拒绝；第 109 项任务文本、第 110 项 `browser_click` 参数均指向“退出登录”。后者不属于 CASE-02 冻结动作。任务终态表明认证会话阻断；具体点击是否已对页面生效、何时生效不能单凭该事件文件确定。保留此失败事实，等待修复后的独立新任务和新候选，不能沿用本次失败的覆盖结论。

### CASE-02：最后一次生成的终稿审查（技术执行通过，语义拒绝）

新任务 `build-20260926013556-3e1dd8a8` 的最终 `development/final/candidate.spec.mjs` SHA-256 为 `FC6458EBAE8847948A7F68456DC3473A347B95548C6F3222EC9D46CA87EB52EA`，提交包 SHA-256 为 `6DDD7FFCDAD628A4377455C8EF6B083AFD3A34825FBCFF46CACAF3BC47E7C101`，`development.fidelity_review.bundle_sha256` 与之相同。任务记录 `32` 工具、`1` Harness、`2` 次自测（均报告 PASSED），终态 `WAITING_HUMAN_REVIEW / TECHNICAL_VALIDATION_PASSED`，仍 `semantic_approval:false`。正常验证 `development/final/normal/playwright-report.json` 有 1 个 expected、0 unexpected，五个 `CASE_STEP_1..5` 均执行通过；这是技术执行结果，不是原预期保真结论。

逐步语义核对：终稿 33–45 行确实输入“温控”、点击“查询”、断言列表加载提示先显示后隐藏以及 1/2 页共 3 条；47–66 行核对第 1 页恰两行、INV-101/102 顺序、名称、库存状态非空及“可选”；68–81 行翻到第 2 页、仅 INV-104 且合并顺序正确；83–103 行点击该行详情、捕获详情加载提示出现消失并核对六个详情字段；105–115 行关闭抽屉后筛选与第 2 页保持，已选仍 0。上述动作、行序和字段没有发现跳步。库存状态断言只要求可见且非空（59–60 行），未逐字核对 SPEC 中 INV-101“在库（充足）”与 INV-102“在库（紧张）”；原 CASE-02 第 2 步只写“展示库存状态”，这属于较弱的 SPEC 真值覆盖，不是本次语义拒绝的主因。

**阻断缺口：原 CASE-02 第 1 步与第 4 步各明确要求加载提示约 400–600ms 后消失，终稿却在 41–42 和 93–94 行两处断言 `elapsedMs >= 300 && <= 2000`。** 这会放行 300–399ms 与 601–2000ms 的不符合原预期行为；从 `run-1` 的 `>=250 && <4000` 到 `run-2`/终稿虽缩窄，仍未恢复原区间。正常执行报告仅列步骤耗时，不记录这两处 `elapsedMs` 的实际数值；即使本次页面恰有约 500ms 服务端延迟，脚本仍无法守住 400–600ms 原预期。计时从点击前到加载提示隐藏，还包含自动化交互开销，不能把该宽范围解释成原预期的等价验证。

**独立结论：CASE-02 新候选技术执行通过，但原始时间预期被放宽，语义审查拒绝；不得将它标为用例符合或人工批准。** 本轮模型/Harness 总额度已耗尽；本审查不改候选、原用例、被测页或批准状态，也不追加生成。
