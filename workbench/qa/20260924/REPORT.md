# 2026-09-24 真实模型测试报告

本轮测试已执行并发现缺陷。我的判断：**固定演示场景已经具备可追溯的建例与执行链路，但陌生页面的首次建例可靠性不足，当前不能认定为通用、稳定的测试工程师替代工具。**

## 测试对象与边界

- 测试当前工作树：HEAD `b0617c5666e0ef9296298a778a2c3242101ecd58`，包含开始前已有的 11 个文件改动；本轮没有修改这些产品代码或模型候选。[起始差异](evidence/baseline-diff-stat.txt)
- 时间：2026-09-24，北京时间。本轮独立数据目录为 `workbench/.local/qa-20260924`，保留旧项目、旧授权账本和旧结果。
- 原六条：真实工作台 UI 创建项目、原生包导入、三次真实 Harness 建例、正常/故障六次执行、服务重启读回、媒体访问及播放。
- 新增六条：Kimi CLI 生成独立页面及用例；Codex 核验后，由同一真实 Harness 生成三份候选，并各执行正常/故障入口。**新场景走 Harness 底层能力验证，不算工作台通用建例已接通。** 新用例已通过真实工作台 UI 导入，但详情页没有建例按钮。[截图](evidence/08-new-case-no-build-entry.png)
- DeepSeek 使用现有 `deepseek-flash` 配置：**6 个真实建例会话、105 次工具调用、0 次候选修订**。工具调用不是供应商请求次数；请求数、token usage、费用均未知。Kimi 生成会话另计。[调用记录](evidence/real-model-calls.json)
- 模型只得到正常用例和正常入口，没有把故障期望或参考脚本作为建例输入；本机不是强隔离沙箱，页面脚本包含演示分支，不宣称严格盲测。没有测试生产系统、真实账号、付费业务或外部写入。

## 逐组实际结果

| 场景 | 正常入口结果 | 故障入口结果 | 测试工程师判定与证据 |
|---|---|---|---|
| 原查询 TC-001/004 | 通过 | 第3步失败 | 正确检出期望2条/实际3条；工作台识别为断言不符。[报告](evidence/TC-001-final-task.json) |
| 原排序 TC-002/005 | 通过 | 第2步失败 | 脚本抓到期望第2行DEV-006、实际DEV-002；工作台误归类为LOCATOR_OR_TARGET，指定故障识别为false，任务仍WAITING_E2E_TRIALS。[报告](evidence/TC-002-final-task.json) |
| 原详情 TC-003/006 | 通过 | 第2步失败 | 正确检出额定功率220 kW/320 kW，未删除单位。[报告](evidence/TC-003-final-task.json) |
| 新分页 NEW-001/004 | 第1步误报失败 | 同样第1步失败 | 把显示文本“全部”当作select底层值；页面实际value=all。故障页预置的第二页错误尚未触达，不计缺陷检出。[候选第26行](candidates/NEW-001.spec.mjs)、[正常原报告](evidence/NEW-001-normal-playwright.json) |
| 新异步重试 NEW-002/005 | 第1步误报失败 | 同样第1步失败 | 把“仅显示相关控件”写成全部DOM按钮数量=1；隐藏按钮也计入，实际9。电压预置差异尚未触达。[候选第21行](candidates/NEW-002.spec.mjs)、[正常原报告](evidence/NEW-002-normal-playwright.json) |
| 新多步骤表单 NEW-003/006 | 通过 | 第6步失败 | 空值校验、数量上限拒绝、回退保留、确认预览实际执行；正确检出预览数量2/3。[候选](candidates/NEW-003.spec.mjs)、[故障原报告](evidence/NEW-003-fault-playwright.json) |

因此，原三组正常均通过，原三个指定差异均被脚本触发，但工作台只正确识别其中两组的差异类别。新三组正常仅一组通过，另外两组为候选错误导致误报；新三个预置差异只有一个实际触达。**不能把六个故障入口均失败写成六个故障均被正确检出。** 本轮每组只做一次首次生成，没有重复统计为稳定性结果。

## 做得好的地方

1. **成功场景有真实、精确的断言。** 原查询核对完整编号集合及排除DEV-004；排序核对六行完整顺序及第二行各字段；详情保留`220 kW`单位；新表单还核对返回上一步的数据保持。已经逐份读取[六份模型候选](candidates)，不是只看绿色标签。
2. **正反例使用同一份候选，业务失败没有被变成成功。** 本轮各组正反例候选哈希一致；故障原始结果保持失败。查询/详情停在等待人工核对，未自动批准。[原运行汇总](evidence/summary.json)、[新运行汇总](evidence/new-model-summary.json)
3. **原工作台媒体和历史读取可用。** 服务重新构造后六条记录状态一致；35个登记媒体HTTP读回均为200且哈希一致；六条详情页各有至少一个视频实际播放、时间前进且无媒体错误。未登记媒体404、非同源写请求403。[独立核对](evidence/evidence-audit.json)
4. **用例库可接收新增资料。** 六条新增用例通过预览确认导入，项目现有12条用例，保留原步骤与预期。[12条用例截图](evidence/07-all-12-cases.png)

## 做得不好的地方与处理优先级

| 优先级 | 问题 | 证据与影响 | 建议下一步 |
|---|---|---|---|
| P1 | 陌生控件的观察不能稳定转成正确断言 | NEW-001混淆label/value；NEW-002混淆DOM存在与可见。正常页发生误报，真实故障还未执行就停止。 | 优先补label/value与可见性语义的生成约束及反例验证；保持原用例预期。 |
| P1 | 通用用例从UI到建例的入口尚未接通 | 新用例成功导入，NEW-001详情“创建演示建例任务”按钮数量为0；当前前端环境映射固定TC-001/002/003。 | 提供明确环境绑定与启动入口，再验新用例完整工作台链路。底层Harness结果不能代替这个缺口。 |
| P1 | 旧Agent核心工程回归存在大量失败 | 1749项中108失败；单独复跑代表项仍失败，执行事实为PREFLIGHT/INVALID_SCHEMA。不能据此断定108项都同根因，也不能把它们混成工作台97项。 | 先分组核对旧测试输入协议与当前校验契约；是否测试过时或实现回归待诊断。 |
| P2 | 报告错误分类丢失已存在的业务差异 | TC-005原报告明确期望DEV-006/实际DEV-002，工作台却给LOCATOR_OR_TARGET、expected/actual=null。[截图](evidence/TC-005-run-detail.png) | 修正多行字符串diff解析和分类优先级，以原始失败回归验证。 |
| P2 | 生命周期日志登记摘要过早 | 97个登记文件中94个大小/哈希一致，3个lifecycle_log不一致；媒体35/35一致。这是登记快照与继续追加日志不一致的证据，不是篡改证明。 | 在日志终结后登记摘要，或明确标识可追加日志及最终快照。 |
| P3 | 结果页面信息组织仍影响阅读 | 任务页媒体链接密集连排；排序失败页无法展示结构化期望/实际值，需要展开原错误。[任务页截图](evidence/TC-001-task.png) | 优先展示原步骤、期望、实际、错误位置，再分组展示截图/录像/Trace。 |

## 工程验证与退出码

| 执行 | 实际结果 | 退出码 | 日志 |
|---|---|---|---|
| `node --test workbench/tests/*.test.mjs` | 97通过，0失败，0跳过 | 0 | [workbench-tests.log](evidence/workbench-tests.log) |
| `node --test harness-probe/tests/*.test.mjs` | 24通过，0失败，0跳过 | 0 | [harness-tests.log](evidence/harness-tests.log) |
| `node tests/runtime-regression.mjs` | 1749项：1641通过，108失败，0跳过 | 1 | [core-regression.log](evidence/core-regression.log) |
| 核心代表失败项隔离复跑 | 1项失败；plans预期2实际1；执行事实INVALID_SCHEMA | 1 | [隔离日志](evidence/core-failure-isolated.log)、[实际facts](evidence/core-isolated-facts.json) |
| 原六例真实模型驱动 | 三次生成、六次运行及重启读回均已执行；脚本退出0只表示驱动跑完 | 0 | [real-model-driver.log](evidence/real-model-driver.log) |
| 新六例真实模型驱动 | 三次生成、六次执行；包含两组正常误报，不能以驱动退出0当产品通过 | 0 | [new-model-driver.log](evidence/new-model-driver.log) |
| 独立证据审计 | 媒体全部一致，但3个生命周期日志摘要不一致，审计断言失败 | 1 | [audit.log](evidence/audit.log)、[明细](evidence/evidence-audit.json) |

工程测试存在嵌套测试，计数采用TAP末尾`# tests/# pass/# fail`，不用顶层`1..1607`替代1749；[失败索引](evidence/core-failure-index.json)中的父节点失败不重复加总。上述工程集合、页面参考验证和真实模型产品运行分开记账，不累加为“产品通过数”。

正式文档同步检查退出0；证据收集与全项目文档检查退出1，不声明正式交付门禁通过。本轮是失败评价，不将既有REQ的历史通过状态套用为新验收。收集器生成的新快照另存[本轮归档](evidence/governance-current-evidence.md)，既有交付证据已按原字节保留。[最后检查日志](evidence/governance-check-final.log)

## Kimi 新界面与用例

- [打开六个演练入口](site/launch.html)；[逐步用例](site/CASES.md)；[可导入工作台JSON包](site/cases.workbench.json)。
- 本机当前入口：[新演练台](http://127.0.0.1:4343/)；若服务停止，在仓库根执行`node workbench/qa/20260924/site/serve.mjs`可重新打开。该站点无外部写入或持久化。
- 新增分页保留筛选、异步失败后重试、多步骤表单校验与回退三个流程，各有正常/故障入口。参考验证最终为三正常符合、三预置差异精确确认。[参考证据](evidence/new-reference.json)
- Kimi原页面存在表单错误提示被`showStep(true)`清空的问题。Codex仅调整设置错误提示的顺序，保留[原始页面](site/kimi-original.html)及[初次失败](evidence/new-reference-initial.json)。原用例还存在故障前置入口与首步normal不一致，首步已统一为使用绑定入口；原始用例也保留。没有据模型失败调整页面或候选。
- 首次新驱动因相对模块路径写错，在模型启动前退出；修正驱动路径后才启动本轮三个模型会话，原错误日志保留，不计模型失败。

## 停止条件与未验证项

本轮已完成限定范围的执行和证据评价，停止在问题报告。未修产品缺陷、未修模型候选、未追加生成重抽、未批准或发布。没有验证真实企业系统、生产安全、多人并发、长时间稳定性、登录场景或模型自修复收益。

新场景参考脚本不提供给模型；原始模型与Playwright数据、视频、Trace仍保存在`workbench/.local/qa-20260924`。本目录保存关键报告、截图、候选与可复用用例，文件摘要见[manifest.json](manifest.json)。
