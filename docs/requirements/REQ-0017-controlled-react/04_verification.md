<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0017 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0017-01 | DR-0017-01 | 已确认 | 集成测试通过 | 业务合同与完整检查 | 原步骤/输入/对象/预期/顺序/时机保持；表格字段矩阵和明确编号区间全覆盖，25字段同一DOM观察，遗漏中段不得通过。 实际命令/退出码/非零统计/日志；工程与真实模型分列。 | 命令：node --test --test-concurrency=3 tests/definition-fields.test.mjs tests/adaptive-review.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-protocol.test.mjs tests/plan-quality.test.mjs tests/semantic-scope.test.mjs tests/adaptive-semantic-boundary.test.mjs；退出码：0；测试数量：199；失败数量：0；跳过数量：0；证据：validation/req0017/v11-fields-regression.log | node --test --test-concurrency=3 tests/definition-fields.test.mjs tests/adaptive-review.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-protocol.test.mjs tests/plan-quality.test.mjs tests/semantic-scope.test.mjs tests/adaptive-semantic-boundary.test.mjs | 0 | 199 | 0 | 0 | validation/req0017/v11-fields-regression.log |
| VT-0017-02 | DR-0017-02 | 已确认 | 集成测试通过 | 结构化缺口与有界ReAct恢复 | 计划缺项或缺证不得直接撤销已确认用例；真正业务歧义由隔离输入审查判断；补证先于重复生成，预算/无进展终止保持。 实际命令/退出码/非零统计/日志；工程与真实模型分列。 | 命令：node --test --test-concurrency=3 tests/query-result-evidence.test.mjs tests/query-result-evidence.execution.test.mjs tests/row-evidence.test.mjs tests/row-evidence.execution.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-review.test.mjs tests/adaptive-protocol.test.mjs tests/adaptive-semantic-boundary.test.mjs tests/adaptive-source-recovery.test.mjs tests/order-evidence.test.mjs tests/plan-quality.test.mjs tests/query-forms.test.mjs；退出码：0；测试数量：337；失败数量：0；跳过数量：0；证据：validation/req0017/v31-final-regression.log | node --test --test-concurrency=3 tests/query-result-evidence.test.mjs tests/query-result-evidence.execution.test.mjs tests/row-evidence.test.mjs tests/row-evidence.execution.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-review.test.mjs tests/adaptive-protocol.test.mjs tests/adaptive-semantic-boundary.test.mjs tests/adaptive-source-recovery.test.mjs tests/order-evidence.test.mjs tests/plan-quality.test.mjs tests/query-forms.test.mjs | 0 | 337 | 0 | 0 | validation/req0017/v31-final-regression.log |
| VT-0017-03 | DR-0017-03 | 已确认 | 集成测试通过 | 执行时观察与受控技术绑定 | 同一批准只读动作派发前观察/探测/等价绑定；身份/字段/作用域/顺序/期限不变；未知派发和断言差异不重放、不改预期。 实际命令/退出码/非零统计/日志；工程与真实模型分列。 | 命令：node --test --test-concurrency=3 tests/definition-fields.test.mjs tests/adaptive-review.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-protocol.test.mjs tests/plan-quality.test.mjs tests/semantic-scope.test.mjs tests/adaptive-semantic-boundary.test.mjs；退出码：0；测试数量：199；失败数量：0；跳过数量：0；证据：validation/req0017/v11-fields-regression.log | node --test --test-concurrency=3 tests/definition-fields.test.mjs tests/adaptive-review.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-protocol.test.mjs tests/plan-quality.test.mjs tests/semantic-scope.test.mjs tests/adaptive-semantic-boundary.test.mjs | 0 | 199 | 0 | 0 | validation/req0017/v11-fields-regression.log |
| VT-0017-04 | DR-0017-04 | 已确认 | 集成测试通过 | 主流程状态与证据 | 显示当前目标/观察/恢复/停止原因，不新增逐定位审批；旧批准不静默扩权，旧任务不改。 实际命令/退出码/非零统计/日志；工程与真实模型分列。 | 命令：node --test --test-concurrency=3 tests/definition-fields.test.mjs tests/adaptive-review.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-protocol.test.mjs tests/plan-quality.test.mjs tests/semantic-scope.test.mjs tests/adaptive-semantic-boundary.test.mjs；退出码：0；测试数量：199；失败数量：0；跳过数量：0；证据：validation/req0017/v11-fields-regression.log | node --test --test-concurrency=3 tests/definition-fields.test.mjs tests/adaptive-review.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-protocol.test.mjs tests/plan-quality.test.mjs tests/semantic-scope.test.mjs tests/adaptive-semantic-boundary.test.mjs | 0 | 199 | 0 | 0 | validation/req0017/v11-fields-regression.log |
| VT-0017-05 | DR-0017-05 | 已确认 | 人工待确认 | 冻结正反例与独立验证 | 保留原3例和24例/17文件，增加异构留出及故障对照；至少两轮真实模型验证另列，技术救场/漏报/误停/调用耗时分列。 实际命令/退出码/非零统计/日志；工程与真实模型分列。 | 命令：node --test --test-concurrency=2 tests/heldout-lab.test.mjs tests/autonomous-lab.test.mjs heldout-lab/reference.test.mjs；退出码：0；测试数量：25；失败数量：0；跳过数量：0；证据：validation/req0017/v21-final-regression.log | node --test --test-concurrency=2 tests/heldout-lab.test.mjs tests/autonomous-lab.test.mjs heldout-lab/reference.test.mjs | 0 | 25 | 0 | 0 | validation/req0017/v21-final-regression.log |

## 本轮命令与环境

- 工作目录：D:/01_AI工程/01_工程项目/ui-test-agent
- 命令：node --test --test-concurrency=4 tests/adaptive-semantic-boundary.test.mjs tests/adaptive-execution.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-review.test.mjs tests/adaptive-progress.test.mjs tests/adaptive-source-recovery.test.mjs tests/adaptive-protocol.test.mjs tests/adaptive-dispatch.test.mjs tests/plan-quality.test.mjs tests/repair-contracts.test.mjs tests/optional-dialog.test.mjs tests/semantic-scope.test.mjs tests/case-named.test.mjs tests/controlled-react.test.mjs tests/table-invariant.test.mjs
- 命令：node acceptance/check.mjs
- 命令：node validation/req0017/verify-live-round.mjs 058fd81f-4010-4b6d-b08c-c51a7d40ad3c
- 环境：版本9参考夹具验证使用独立headless Chromium、随机loopback端口/浏览器上下文，不与4179活动任务共享状态；真实任务仍冻结2f3976d64a9d，参考脚本不提供模型计划。
- 环境：版本9最终环境：Windows；4179冻结构建2f3976d64a9df9ab59eb30752da24761444d5b514940e6cafbf4ad53e7e29d63；localhost:4196原合成页面及4197新对照；https://api.deepseek.com / deepseek-flash。只使用本机安全输入的内存凭据，不归档密钥；6条已登录并尝试固定计划准备，最终无活动作业。
- 环境：历史工程环境：Windows/Node22/隔离Chromium，注入模型回复，仅本机临时合成服务器和独立数据目录；文件并发4。4179读取返回ECONNREFUSED，本轮未操作启停、未读取或清除凭据、无新增官方模型请求。

## 结论

- 版本9参考工程60项通过，不计产品自主成功。32条全部尝试相应流程：22浏览器尝试中2正常完整通过、1预置价格差异检出、3正常误报、16技术阻塞；4输入审查中3提出问题、1未建立；6准备均失败且未正式执行。累计434调用、83分3.715秒、165媒体SHA一致，1次外部调度接续明确单列；不继承版本8三例成功结论，不具备发布条件。
- 版本8本轮真实原三例均完整通过，12步骤/41执行断言、78逻辑调用、521.384秒；不与历史305工程项相加。V03实际完成一次翻页及一次D009详情打开；没有回写旧失败、代替导航或改服务源码。新行数拒绝分支本轮未触发；详情整区域contains检查的反例能力仍待验证。原用例一致和媒体摘要核验退出0；未逐段播放录像、不宣称产品发布。
- 历史工程阶段结论：版本8工程305项通过、0失败/取消/跳过，596031.2469ms，核心8项属于305项子集，不累加；冻结17文件/24例保持。首次collector已实际运行成功，但文档检查因验证/追踪视图未更新失败，保留初次记录，更新事实源后单独复检。最后真实版本7的2/3不是版本8验收，未生成新发行包。
- 历史版本7结论：版本7工程373项历史证据保留，不重跑或累计。最新限定真实模型66调用、420.143秒、2条完整通过及1条技术失败；不是最终产品验收。原步骤和旧失败不改，媒体33份SHA核对一致。
- 版本6同一组受影响工程回归270项通过（0失败/取消/跳过，554779.033毫秒），原24例/17文件冻结检查保持。最终collector及文档检查退出码0；不与历史版本或各VT重复累计。本轮未调用真实模型，4179仍运行版本5，未重启或清除内存Key。
- 版本5受影响工程回归262项全部通过，443409.2257毫秒；各VT引用同一份证据，不累加。版本4全量1165是历史基线，未重跑新版全量。
- 版本4真实51调用、0/3整例通过；版本5追加真实42调用、0/3整例通过。修复的局部反例工程通过，但自主执行目标未达成，不具备发布或人工验收交接条件。
- 首次版本5collector已实际运行262项且退出码0；其附带文档检查因设计/追踪视图未同步失败，修复事实源视图后单独复检，保留首次检查失败记录。
