# 三项继续修复与功能复验

日期：2026-10-29。三个指定问题已完成修复，本机可执行的工程及正式工作台功能回归通过；助手候选业务确认与未覆盖现场环境仍独立保留。

修改前新增远端回退点为 [83618cf5](https://github.com/whj1677/ui-test-agent/commit/83618cf5fbfd93e9feb9748cc8a758f1e78ffa93)，分支 codex/archive-before-three-fixes-20261029。原归档599fea82继续保留。当前修改在codex/architecture-review-20261029，未提交或推送修复后的版本；历史运行数据和QA留本机。

## 修复结果

| 问题 | 当前行为 | 实际证据 |
|---|---|---|
| 报告预览CSP报错 | 固定模板style块在进入文档解析前提取，template读取CSS后按顺序/media使用构造样式表。CSP和sandbox未放宽，原报告和下载字节不改。 | 离线真实Edge负对照及16项定向；正式18页/4下载和10项媒体检查均通过，CSP/console错误0。 |
| 助手无来源扩写 | 去除默认失焦/空白点击规则；动作和预期分别检查完整来源文字。保留条件、否定和分号/换行，不以有效引用冒充语义支持；未核验字段提示进入保存与Excel。 | 旧3处错误准确标UNVERIFIED且原文不改；新真实输出不再出现这3处扩写，5项正式保存/导出检查通过。 |
| 宿主PID复用 | v2锁记录PID与Windows CIM精确创建身份；同代/未知身份仍保护，确证旧代退出才恢复，兼容旧锁时间上界并保留孤儿扫描、二次身份/字节核对及并发门。 | 30项专项/联动通过；原4322重启后22项真实身份检查通过，锁前后SHA不变，未终止无关进程。 |

来源核对是保守文字匹配：合理改写也可能UNVERIFIED，DIRECT_QUOTE只证明完整文字出处，semantic_status仍为NOT_REVIEWED。真实助手输出为UI7步/HTTP3步，原空白点击和查询后控件保持均消失；items的数组类型属于未确认技术推断，仍保留待核对。候选和Excel继续待确认/未执行，未将其自动提升为业务验收。

## 验证矩阵

| 层次 | 本轮结果 | 入口/证据（QA根目录：workbench/qa/20261029-three-fixes） |
|---|---|---|
| 完整工程显式清单 | 1387通过，0失败/跳过 | npm test；engineering.log |
| Harness | 32通过 | harness-engineering.log |
| 正式零模型功能 | 44通过；4类场景在其他流程或未覆盖项单列 | official-functional.log |
| 资料输入 | 7通过，DOCX/PNG/CSV，不调用图片模型 | source-inputs/results.json |
| 正式浏览器 | 18页、4实际下载通过 | page-readiness/results.json |
| 实际报告媒体 | 10通过：3视频解码/播放/暂停、图片放大、锚点、Trace字节、快照保留 | report-media下独立attempt/results.json |
| 需求与助手模型 | 各一次真实流程；来源与导出独立复核，未自动确认 | model-content-review.json；assistant-verification.log |
| UI生成/实际执行 | 2步12断言实际值完整，25文件字节/SHA核验；录像COMPLETE、时间线VERIFIED | ui-integrity.json；ui-read-3.log |
| UI冻结复跑 | PASSED/COMPLETE，model_calls=0 | ui-rerun-result.log |
| HTTP生成/确认/执行 | 已核对1个GET和5业务断言，执行及冻结复跑均通过、model_calls=0 | http-generation-read.log；http-run-result.log；http-rerun-result.log |
| 汇总与保留 | UI/HTTP共2通过、0未执行/不完整；76旧项目保持，仅新增3个 | final-state.json；fixture-shutdown.json |

固定报告ID：report-02b30cabd51135b955681ff67ee990b19d68e3bc。运行源码摘要：a2c806a36d1fc2998a0ebfbd1cf44022da333fbe263d846aedc0b8d848cb69ad。正式4322继续运行，原配置和数据根不变；4479只是本轮只读被测夹具，已停止。实际付费金额不可见；四个真实流程沿用现有限额，没有为未知结果重新发起付费任务。UI任务内部包含一次诊断和两次正式自测，诊断不计业务通过。

首轮CSP实现失败、离线浏览器夹具策略问题、来源检查换行反例、UI首次实际值缺失及一处QA摘要读取可选usage字段错误均保留；最终结果不覆盖这些记录。源码固定后仅运行完整清单一次；后续交付采集器定向验证单独记账，不重复累计。

干净Windows安装、真实认证挑战、WPS/受保护文档现场兼容、图片模型理解、人工示范录制及正式环境故障注入没有在本轮执行。本轮通过不等于全产品在所有环境均已验收，也不代表发布批准。
