<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0008 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0008-01 | DR-0008-01 / DR-0008-02 | 已确认 | 集成测试通过 | 产品选择和范围确认 | 用户明确选择、设计分支一致性；只读探测不是审批确认。 | 命令：node tests/runtime-regression.mjs；退出码：0；测试数量：614；失败数量：0；跳过数量：0；证据：validation/REQ-0008-runtime-verified.log | node tests/runtime-regression.mjs | 0 | 614 | 0 | 0 | validation/REQ-0008-runtime-verified.log |
| VT-0008-02 | DR-0008-02 / DR-0008-03 | 已确认 | 集成测试通过 | 所选审批分支正常多步链路 | 实际浏览器、固定计划/审批身份、各步原始动作与事实、非零断言统计。 | 命令：node tests/runtime-regression.mjs；退出码：0；测试数量：614；失败数量：0；跳过数量：0；证据：validation/REQ-0008-runtime-verified.log | node tests/runtime-regression.mjs | 0 | 614 | 0 | 0 | validation/REQ-0008-runtime-verified.log |
| VT-0008-03 | DR-0008-03 | 已确认 | 集成测试通过 | 错步骤同名可编辑字段、重复控件、错误类型、伪造来源、计划变化与停止反例 | 实际副作用计数及明确阻止原因，批准前/后边界均覆盖。 | 命令：node tests/runtime-regression.mjs；退出码：0；测试数量：614；失败数量：0；跳过数量：0；证据：validation/REQ-0008-runtime-verified.log | node tests/runtime-regression.mjs | 0 | 614 | 0 | 0 | validation/REQ-0008-runtime-verified.log |
| VT-0008-04 | DR-0008-04 | 已确认 | 集成测试通过 | 受影响工程回归与冻结原例核对；真实模型另列 | 命令、退出码、日志、测试/失败/跳过统计及17文件摘要；完整模型证据须归入父需求真实链路。 | 命令：node tests/runtime-regression.mjs；退出码：0；测试数量：614；失败数量：0；跳过数量：0；证据：validation/REQ-0008-runtime-verified.log | node tests/runtime-regression.mjs | 0 | 614 | 0 | 0 | validation/REQ-0008-runtime-verified.log |

## 本轮命令与环境

- 工作目录：D:/01_AI工程/01_工程项目/ui-test-agent
- 命令：node --test tests/case-named.test.mjs
- 命令：node tests/runtime-regression.mjs
- 命令：node acceptance/check.mjs
- 命令：python scripts/sync_requirement_status.py --req REQ-0008-multistep-plan-grounding --apply
- 命令：python scripts/collect_delivery_evidence.py --req REQ-0008-multistep-plan-grounding --verify-command "node --test tests/case-named.test.mjs"
- 命令：python scripts/check_ai_context.py
- 环境：本机Windows / Node22.19.0 / Chromium，隔离requests夹具随机端口，原4179实例未改变。

## 结论

- A限定工程实现及614项非暂停回归完成；原冻结多步用例固定计划与注入provider协议流证据已记录，真实外部模型调用0。
- 首版需要可观察步骤标识、固定路由、唯一页面/步骤标题和原生表单，不支持任意无标识向导或未经证实的业务对象；没有改变旧4179、原基线或发布门槛。
