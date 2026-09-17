<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0005 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0005-01 | DR-0005-01 | 已确认 | 集成测试通过 | 协议正反例 | 旧协议保持；禁止递归scope/row/cell、任意CSS/XPath/nth/模糊身份；命名/标题必须二选一，未知属性拒绝。 | 命令：node --test tests/semantic-scope.test.mjs；退出码：0；测试数量：17；失败数量：0；跳过数量：0；证据：validation/REQ-0005-scope-verified.log | node --test tests/semantic-scope.test.mjs | 0 | 17 | 0 | 0 | validation/REQ-0005-scope-verified.log |
| VT-0005-02 | DR-0005-02 | 已确认 | 集成测试通过 | 真实观察/当前范围唯一定位 | 范围/内部目标均唯一、同DOM且归属正确；重复标题、嵌套外借标题、近似对象不得取首个；自定义适配器不能借此把错误目标洗白。 | 命令：node --test tests/semantic-scope.test.mjs；退出码：0；测试数量：17；失败数量：0；跳过数量：0；证据：validation/REQ-0005-scope-verified.log | node --test tests/semantic-scope.test.mjs | 0 | 17 | 0 | 0 | validation/REQ-0005-scope-verified.log |
| VT-0005-03 | DR-0005-03 | 已确认 | 集成测试通过 | 身份变化与授权边界 | 身份变化或重复对象到来时无错误目标业务点击；合法重排仍同对象；不使用page.evaluate直接click，不承诺抵御恶意业务事件逻辑。 | 命令：node --test tests/semantic-scope.test.mjs；退出码：0；测试数量：17；失败数量：0；跳过数量：0；证据：validation/REQ-0005-scope-verified.log | node --test tests/semantic-scope.test.mjs | 0 | 17 | 0 | 0 | validation/REQ-0005-scope-verified.log |
| VT-0005-04 | DR-0005-04 | 已确认 | 集成测试通过 | 消费链兼容/全量/Git | 已观察完整范围或经观察的标题模板加原文完整身份；无证据、近似清理身份与跨scope修复拒绝；工程正反例与真实模型结果分列。 | 命令：node tests/runtime-regression.mjs；退出码：0；测试数量：414；失败数量：0；跳过数量：0；证据：validation/REQ-0005-runtime-final.log | node tests/runtime-regression.mjs | 0 | 414 | 0 | 0 | validation/REQ-0005-runtime-final.log |

## 本轮命令与环境

- 工作目录：D:/01_AI工程/01_工程项目/ui-test-agent
- 命令：node --test tests/semantic-scope.test.mjs
- 命令：node tests/runtime-regression.mjs
- 环境：Windows Node22/Chromium；临时合成服务器与浏览器，不调用模型

## 结论

- 限定范围定位修复已实现并完成17项专项、414项非暂停工程回归；正式门禁及Git同步继续按实际结果记录。
- 原4项修复前失败、捕获时序反例失败及中间测试记录保留；自定义适配器参数/重复范围断言的测试构造错误另行纠正，不改原24例。
- 仅工程证据，不等于真实DeepSeek自主链路或发布验收；Kimi只读通用建议经本机复核，并非代码独立验收。
