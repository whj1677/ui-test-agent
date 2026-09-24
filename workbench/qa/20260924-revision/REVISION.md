# 20260924 QA 修订记录

当前阶段：修复与有界反馈验证。唯一目标：修正 TC-005 解析、生命周期登记一致性、两类通用浏览器建例语义，并验证 NEW-001/002 各一次真实 Harness 修订。

输入：[原 QA 报告](../20260924/REPORT.md)，证据提交 `b651ed04a67cbdfc68700e0e7031e3d12416ea50`；原实际受测版本为 `b0617c5 + 11 个本地改动`。本批保留现场分支 `codex/qa-real-model-20260924`。AUTH 执行者已明确交接主目录写入权；现存非本批改动仍归既有工作。

有限交付：生产修复、工程回归、两份 Harness 新版本、追加证据及此记录。验收：原始报告离线判定可追溯、日志最终字节/哈希一致、修订正常页全部原步骤通过后才运行同哈希故障页。明确不做：旧六条重跑、UI 重排/新增白名单、通用环境平台、Laya、其他模型路线、修复全部旧核心失败。权限：最多 2 次新增 Harness、最多 4 次产品运行；到限停止。仅提交本批拥有的变更，保留原报告及 manifest。

## 修复和验证结果

| 项目 | 本批实际结果 | 证据 |
|---|---|---|
| TC-005 多行差异 | 原报告离线重解析为 `ASSERTION_MISMATCH`，步骤 2 归属一致，指定差异检出为 true；原 FAILED 和 `PENDING_ANALYSIS` 保持 | [补充评估](evidence/TC-005-supplemental-assessment.json)、[原始报告回归夹具](../../tests/fixtures/qa-tc005-report.json) |
| lifecycle 摘要 | 生产保存路径复现登记 2045 字节、最终 2367 字节；修复后三种路径字节/哈希与最后事件一致 | [修复前](evidence/lifecycle-before.log)、[修复后](evidence/lifecycle-after.log) |
| NEW-001 | 初稿正常页第 1 步失败；本次 v2 正常页 4/4 步通过，同哈希故障页第 3 步出现 P05 / P02 差异 | [初次失败](../20260924/evidence/NEW-001-normal-playwright.json)、[v2](candidates/NEW-001-v2.spec.mjs)、[正常](evidence/NEW-001-normal-assessment.json)、[故障](evidence/NEW-001-fault-assessment.json) |
| NEW-002 | 初稿正常页第 1 步失败；本次 v2 正常页 6/6 步通过，同哈希故障页第 5 步出现 750 V / 705 V 差异 | [初次失败](../20260924/evidence/NEW-002-normal-playwright.json)、[v2](candidates/NEW-002-v2.spec.mjs)、[正常](evidence/NEW-002-normal-assessment.json)、[故障](evidence/NEW-002-fault-assessment.json) |

TC-005 期望 `DEV-006`、实际 `\n    DEV-002循环泵二号西站\n    检修\n    120 kW详情\n  ` 均直接来自原错误 diff。解析版本 `playwright-error-facts-v2`；优先接受受限匹配器的双侧结构化值，其余仅接受完整字符串/数组/带计数边界的多行格式。`waiting for locator` 不再覆盖已取得的双侧差异；真正缺元素、严格冲突、单侧值、纯超时及截断输入继续区分。展示和步骤归属共用 `errorFacts`。没有重跑旧六条，没有修改旧任务判定；补充评估绑定原报告与原任务 SHA-256。

日志根因已经通过实际追加顺序和旧文件字节核实：[旧 3 份补充评估](evidence/old-lifecycle-supplement.json)显示，三份登记摘要均恰好匹配最终文件的旧前缀，后续各追加 324 字节的 `attempt_settled`。原 3 份不一致仍然保留。修复在 owned process 回调排空、执行 finally 清理之后，阻止新的取消写入，等待保存队列，最后从同一字节缓冲区登记字节数和 SHA-256，并刷新最后事件摘要。收尾前为 `PENDING_FINALIZATION`，收尾后为 `FINALIZED`；没有删除日志或关闭完整性检查。正常、取消、异常三条零模型适配器路径均包含延迟 append 和异步 process_close 收尾；Harness 原有真实子进程关闭测试也通过。

通用规则已加入生产项目用例建例输入：分别处理显示标签和内部 value；每次变更后观察 live selectedOptions / `option:checked`；可见数量限定原要求区域，不等于全部 DOM；不增加原要求没有的内部编码约束。没有 NEW 编号/标题特判，没有禁用全部 `toHaveValue` / `toHaveCount`，也没有批量改写旧候选。[独立工程页面](../../tests/fixtures/qa-browser-semantics.html)和[浏览器回归](evidence/semantics.log)验证相同显示标签对应不同 value、切换后初始 selected 属性不变、隐藏按钮保留以及区域外可见按钮。工程参考断言未登记为产品候选。

## 每步实际执行

| 候选 | 步骤及核对内容 | 正常入口 | 故障入口 |
|---|---|---|---|
| NEW-001 | 1：P01/P02、8 条、1/4 页、全部 | PASSED | PASSED |
| NEW-001 | 2：北站、P01/P03、4 条、1/2 页 | PASSED | PASSED |
| NEW-001 | 3：下一页、北站、P05/P07、2/2 页 | PASSED | FAILED：第 1 行期望 P05，实际 P02 |
| NEW-001 | 4：上一页、仍为北站、P01/P03、1/2 页 | PASSED | NOT_EXECUTED |
| NEW-002 | 1：遥测区域及可见按钮 | PASSED | PASSED |
| NEW-002 | 2：打开 dialog、立即读取中、重试禁用或不可见 | PASSED | PASSED |
| NEW-002 | 3：首次失败、重试可见可用 | PASSED | PASSED |
| NEW-002 | 4：重试后立即读取中、重试禁用 | PASSED | PASSED |
| NEW-002 | 5：读取成功、750 V、指定采样时间 | PASSED | FAILED：电压实际 705 V；该断言后的采样时间检查未执行 |
| NEW-002 | 6：关闭 dialog | PASSED | NOT_EXECUTED |

故障运行在首个真实不符处停止，不能把尚未执行的后续断言算作通过。NEW-001 故障第 3 步在 P05 检查失败，后续 P07、分页/按钮检查未执行。原始 Playwright JSON 与步骤归属保存在各运行 evidence 文件中。截图：[分页正常](evidence/NEW-001-normal.png)、[分页故障](evidence/NEW-001-fault.png)、[遥测正常关闭后](evidence/NEW-002-normal.png)、[遥测故障读数](evidence/NEW-002-fault.png)。截图只含本地合成页面；私有会话、凭据、原始视频和 trace 未提交。

## 候选哈希与独立预算

| 候选 | 初稿 SHA-256 | 本次 v2 SHA-256 |
|---|---|---|
| NEW-001 | F4BEF3A75B597BF948162470B344244BF2C3B01E4570336116DF5A2376A1F137 | 556BA603DC690000B89A010E366C61D4A1B7C625195F522E30C595B24A29277F |
| NEW-002 | 7EBF7783ABA1AB643D224B765B94C616C3B18CC045EAE2801D87A157C0241A3B | A3ACDE2572F4D941920EB0AAB80DF1D4B9FDA056FD02E48C0BF0DB45D9BCB80B |

[独立账本](evidence/revision-ledger.json)：真实 DeepSeek Harness 启动 **2/2**，每组一次，无自动重试；产品验证 **4/4**，每组正常一次、正常完整通过后故障一次。NEW-001 19 次工具调用、NEW-002 28 次工具调用，共 47 次；工具调用数不等于供应商 API 请求数，后者及费用未知。启动前的私有驱动导入路径错误发生在 Harness 入口调用之前，不消耗模型启动。旧 E2E 预算没有被借用。

每组仅提供原正常用例、正常入口、该组原候选、原正常页错误和通用规则；实际输入和输入哈希见 [NEW-001](inputs/NEW-001/task.md)、[NEW-002](inputs/NEW-002/task.md)及账本。`original.spec.mjs` 对应原 QA 目录中的同组初稿，未更改。模型工具记录见 [NEW-001](evidence/NEW-001-tool-calls.json)、[NEW-002](evidence/NEW-002-tool-calls.json)；[范围核对](evidence/input-scope-audit.json)核对已记录的读写、glob 与导航，未见越界读取。允许观察控件 DOM 事实，未提供页面源文件、参考测试、故障入口或其他候选。共享工程可访问，**不是强隔离**。Codex/Kimi 均未代写或补产品候选断言。

本批证明两条特定候选的**反馈修订后恢复能力**。原首次生成成绩不变，不能解释为首次成功率提升或通用稳定性通过。模型仍产生过一次浏览器 evaluate 语法错误后自行观察修正；这不构成额外 Harness 启动，也不能当作所有观察都一次成功。

## 工程测试、旧核心范围和正式门禁

| 范围 | 本批执行结果 | 证据 |
|---|---|---|
| 工作台全量工程测试 | 112/112；之后补充 FINALIZED 状态断言，受影响 15/15 复验通过。范围包含解析、保存路径、通用语义浏览器反例及既有回归 | [collector 实际执行日志](workbench-final.log)、[最终保存路径复验](evidence/lifecycle-after.log) |
| Harness 工程测试 | 24/24，通过；与工作台不累加 | [日志](evidence/harness-tests.log) |
| 旧核心抽样 | 5 个选定测试：1 通过、4 失败；未修改或跳过原测试，未重跑整套 1749 项 | [抽样 1](evidence/core-representative.log)、[抽样 2](evidence/core-representative-2.log)、[抽样 3](evidence/core-representative-3.log)、[抽样 4](evidence/core-representative-4.log) |
| 正式门禁 | sync dry-run 无生成视图变更；collector 已实际运行测试；check 返回 1，未通过 | [sync](evidence/governance-sync.log)、[collector](evidence/governance-collector.log)、[check](evidence/governance-check.log) |

中间工作台全量曾为 111/112：通用提示里的英文 `oracle` 触发已有 M4-A 输入防泄漏检查的宽泛禁词。改为“sole expected-result source”后保持相同语义，未放宽检查；相关 16 项复验及最终全量均通过。[中间失败记录](evidence/workbench-before-wording-fix.log)、[复验](evidence/affected-retest.log)。解析红灯基线 7/11，修复后解析相关 29/29；日志红灯基线 2/3，修复后相关 15/15。这些是重叠工程回归，不能相加为独立产品成绩。

旧核心原 108 个失败按 26 个文件分组，其中 84 个 `ERR_ASSERTION`、24 个 `ERR_TEST_FAILURE`；完整文件分组及原名称见 [core-grouping.json](evidence/core-grouping.json)，权威总数仍来自原 QA。已实测的 binding-feedback、completion、display-number 三个代表均在 `validateInterpretation` 收到旧 `{actions, assertions, complete, within_ms, reason}`，而该入口要求 `{obligations}`，在 PREFLIGHT 失败；零模型只读 loader 仅输出字段名与调用栈，没有改变返回值或源码。这三个可判为测试注入协议与现实现不一致。另一个 adaptive-execution 代表复现 `BROWSER_OPERATION_FAILED`，旧注入代码假设 planning input；尚未隔离底层异常，不宣布为已排除实现回归。其余失败未逐项确认，保留 VALIDATE；不把 108 项统称历史包袱。

按[工作台静态相对导入闭包](evidence/workbench-dependency-scope.json)，本批路径为 workbench → Harness/Playwright，不包含旧 `src/controller.mjs` 或 `src/common.mjs`。当前未发现这些核心失败成为本批工作台调用路径的明确共享模块阻塞；computed dynamic import、依赖包内部及旧核心产品路径不在此结论内。旧核心整体仍失败，未宣布核心验收通过。

正式 check 的 8 项失败为：REQ-0036 验证状态非法；未登记的现存 untracked 文件；REQ-0033 设计视图未更新；验证视图未更新；模块说明未更新；交付指纹陈旧；未绑定全部当前改动；旧通过证据未绑定当前 collector 日志。原 REQ 完整机器报告未替换（collector 新输出留本机），本批按用户要求仅追加此记录和实际日志，不批量再生需求视图，也不将共享目录既有 AUTH 改动纳入本批交付。以上不是借用旧通过状态；正式门禁仍失败。

## 交付边界

修复落在现有 `codex/qa-real-model-20260924`，提交仅包括本批解析/生命周期/通用规则增量、工程测试和脱敏追加证据。原 84 条 manifest 项逐字节核对无变化，原 manifest 自身及原 REPORT 未修改。共享的 manager/files/project-case 仅暂存本批增量，其余既有未提交代码没有代为提交或丢弃；私有基线差异、逐文件哈希与写入交接记录保留在本机 `.local/qa-fix-20260924`。

**完整被测版本尚不能只从本次提交复现**：实际测试使用本目录既有未提交代码加本批修复，AUTH/其他既有 11 个代码文件改动仍保留在工作区。本批提交可审查修复本身，不能冒充完整产品基线。

NEW-001/002/003 尚无通用工作台建例 UI 入口的事实保持；没有新增编号白名单。本次是底层 Harness 反馈修订验证，不能包装为新页面工作台闭环接通。达到两次启动和四次产品运行上限后停止，不继续模型抽样、通用环境管理或 UI 重构。
