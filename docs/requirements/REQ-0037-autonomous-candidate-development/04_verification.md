<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0037 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0037-01 | DR-0037-01 | 已确认 | 集成测试通过 | 零模型协议、生产浏览器与Playwright、取消/预算/哈希、空草稿准入工程回归 | 命令退出码、版本哈希、工具结果、调用计数及逐步状态 | 命令：node --test workbench/tests/*.test.mjs；退出码：0；测试数量：120；失败数量：0；跳过数量：0；证据：workbench/qa/20260925-autonomous/collector-workbench.log | node --test workbench/tests/*.test.mjs | 0 | 120 | 0 | 0 | workbench/qa/20260925-autonomous/collector-workbench.log |
| VT-0037-02 | DR-0037-01 | 已确认 | 人工待确认 | 两项真实任务已执行：A恢复完成，B候选语义及指定差异证据失败；待人工核对，不是产品通过 | 真实工具记录、执行报告、覆盖核查与相同候选哈希；不得仅靠绿色或模型自报 | 命令：node workbench/scripts/accept-autonomous-20260925.mjs --run-authorized-pair；退出码：0；测试数量：2；失败数量：1；跳过数量：0；证据：workbench/qa/20260925-autonomous/manifest.json | node workbench/scripts/accept-autonomous-20260925.mjs --run-authorized-pair | 0 | 2 | 1 | 0 | workbench/qa/20260925-autonomous/manifest.json |
| VT-0037-03 | DR-0037-01 | 已确认 | 集成测试通过 | 真实工具链贯通、原稿单次工程执行和真实恢复独立验收 | 零模型真实工具协议和浏览器执行；哈希绑定与越界拒绝；业务语义仍人工核对 | b-recovery/manifest.json与engineering-tool-chain.json、original/report.json；真实3开发+3最终，额外原稿1次共7业务执行。工程工作台127/127、Harness24/24；候选等待人工核对。 | - | - | - | - | - | - |
| VT-0037-04 | DR-0037-01 | 已确认 | 人工待确认 | 固定产品条件下两条陌生流程从零生成及独立故障验证 | 首稿/工具记录/正常与故障报告、完整包哈希、维护者逐项语义核查；不自动批准 | 命令：node workbench/scripts/accept-unfamiliar-20260925.mjs --run-authorized-a ; node workbench/scripts/accept-unfamiliar-20260925.mjs --run-authorized-b；退出码：0；测试数量：2；失败数量：0；跳过数量：0；证据：workbench/qa/20260925-unfamiliar/manifest.json | node workbench/scripts/accept-unfamiliar-20260925.mjs --run-authorized-a ; node workbench/scripts/accept-unfamiliar-20260925.mjs --run-authorized-b | 0 | 2 | 0 | 0 | workbench/qa/20260925-unfamiliar/manifest.json |
| VT-0037-05 | DR-0037-02 | 已确认 | 集成测试通过 | 已有候选完整包与用例身份、幂等/取消/媒体工程验证及原数据真实浏览器试跑 | 原任务哈希不变、2新run真实报告、浏览器实际解码/播放/暂停/拖动/章节定位/下载哈希及重启，不能只看文件存在 | 命令：node workbench/scripts/accept-candidate-trial.mjs --execute；退出码：0；测试数量：2；失败数量：0；跳过数量：0；证据：workbench/qa/20260925-candidate-trial/manifest.json | node workbench/scripts/accept-candidate-trial.mjs --execute | 0 | 2 | 0 | 0 | workbench/qa/20260925-candidate-trial/manifest.json |
| VT-0037-06 | DR-0037-03 | 已确认 | 人工待确认 | 工作台138项工程及真实DSH零模型链路；24真实任务已结束，18独立执行通过/6失败保留，语义核查14完整/其余分层，候选未批准 | 生产UI导入/启动记录，候选包/执行报告/截图来源一致，语义另行核对 | 命令：node --test workbench/tests/*.test.mjs；退出码：0；测试数量：138；失败数量：0；跳过数量：0；证据：workbench/qa/20260925-kimi-workbench/engineering.log | node --test workbench/tests/*.test.mjs | 0 | 138 | 0 | 0 | workbench/qa/20260925-kimi-workbench/engineering.log |
| VT-0037-07 | DR-0037-04 | 已确认 | 集成测试通过 | 原稿与helper首次自测前受完整包校验；提交自动记录有限审查而非自动审批；失败分类及可执行业务差异一次独立复核；耗尽反馈与重复尝试有界 | 生产函数定向回归、正式4322证据、实际退出码与边界说明。2真实会话；原包恢复、失败一次独立复核、从头自测修订及哈希绑定材料验证。KC-10仍业务失败，KC-05独立技术通过，均未批准。 | 命令：node workbench/qa/20260925-reliability/verify-model-results.mjs；退出码：0；测试数量：2；失败数量：0；跳过数量：0；证据：workbench/qa/20260925-reliability/model-results.json | node workbench/qa/20260925-reliability/verify-model-results.mjs | 0 | 2 | 0 | 0 | workbench/qa/20260925-reliability/model-results.json |
| VT-0037-08 | DR-0037-05 | 已确认 | 集成测试通过 | 终态不可倒退；后台错误锁存并拒绝新任务；准备/执行/收口互斥；关闭先拒接；同scope登录浏览器无泄漏 | 生产函数定向回归、正式4322证据、实际退出码与边界说明。65项工程清单含故障/并发/收口替身回归；正式运行中取消、终态幂等、实际EPERM及AUTH-01打开清除验证。未验证生产磁盘满或真实登录。 | 命令：node workbench/qa/20260925-reliability/verify-active-cancel.mjs；退出码：0；测试数量：1；失败数量：0；跳过数量：0；证据：workbench/qa/20260925-reliability/active-cancel.json | node workbench/qa/20260925-reliability/verify-active-cancel.mjs | 0 | 1 | 0 | 0 | workbench/qa/20260925-reliability/active-cancel.json |
| VT-0037-09 | DR-0037-06 | 已确认 | 集成测试通过 | 默认工程测试不另起工作台/模型；正式功能仅4322；每次新run/task绑定已加载源码及脱敏配置身份；有限真实UI旅程及报告 | 生产函数定向回归、正式4322证据、实际退出码与边界说明。已加载源码匹配；正式两条复跑、媒体播放/定位、API下载、固定报告及历史保留验证。外部客户业务覆盖与系统浏览器离线打开未验。 | 命令：npm run test:official；退出码：0；测试数量：4；失败数量：0；跳过数量：0；证据：workbench/qa/20260925-reliability/official-readiness-final.json | npm run test:official | 0 | 4 | 0 | 0 | workbench/qa/20260925-reliability/official-readiness-final.json |
| VT-0037-10 | DR-0037-06 | 已确认 | 集成测试通过 | 独立真实UI旅程、一次有界从头建例、主管语义核对与取消展示复验 | 13个UI场景及取消原路径复验见本轮REPORT和agent简报；主管5组对象核验是3批次/1建例/1报告，不是5业务用例通过。KC02仍业务失败，取消不计完成；65项工程回归/最终入口4项只读核对分别记账。真实客户、多平台、离线系统浏览器未验。 | 命令：node workbench/qa/20260925-independent-ui/verify-round2.mjs batch-ef21886d-a9b2-4bf4-97b1-cbde23f3b1f9 batch-c5bfa41e-131e-444e-b4ff-c13aa4f62411 batch-036f6471-e080-41be-a066-be03a8a7c5a2 report-52201e00c26f334a826ef5129d7f7e2214657f2c build-20260925142505-0fc7ce0d；退出码：0；测试数量：5；失败数量：0；跳过数量：0；证据：workbench/qa/20260925-independent-ui/supervisor/verification.log | node workbench/qa/20260925-independent-ui/verify-round2.mjs batch-ef21886d-a9b2-4bf4-97b1-cbde23f3b1f9 batch-c5bfa41e-131e-444e-b4ff-c13aa4f62411 batch-036f6471-e080-41be-a066-be03a8a7c5a2 report-52201e00c26f334a826ef5129d7f7e2214657f2c build-20260925142505-0fc7ce0d | 0 | 5 | 0 | 0 | workbench/qa/20260925-independent-ui/supervisor/verification.log |

## 本轮命令与环境

- 工作目录：workbench/
- 命令：npm test
- 命令：npm run test:official
- 命令：node workbench/qa/20260925-reliability/verify-model-results.mjs
- 环境：Windows Node22、锁定Playwright1.62.1、DSH0.1.6-alpha.2；独立测试端口，日常4322不变。
- 环境：v9本轮正式功能仅原4322/fresh25-b；辅助被测目标不属于工作台。工程回归不启动工作台或模型。

## 结论

- 工作台最终collector回归见当前日志；Harness24/24退出0；锁定DSH零模型插件检查通过。
- 真实逻辑任务2/2，Harness2次，工具57次，开发执行3次+最终验证4次。A恢复完成，B仍有缺口；不得自动批准。
- 旧核心108项失败未修复/未重跑；AUTH扩展、任意环境接入、自动恢复不在本批完成范围。
- v9工程65/65及限定正式功能验证完成，详见workbench/qa/20260925-reliability/REPORT.md。全库checker仍有REQ-0015两处历史宣称冲突；不宣称全库门禁通过。
