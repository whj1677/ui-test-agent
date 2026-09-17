<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0009 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0009-01 | DR-0009-01 | 已确认 | 集成测试通过 | 缺失/否定/条件/同义名称及其他Case不能产生重置候选。 | 实际命令、退出码、非零断言统计、浏览器副作用计数及日志；不是模型业务验收。 | 命令：node tests/runtime-regression.mjs；退出码：0；测试数量：516；失败数量：0；跳过数量：0；证据：validation/REQ-0009-runtime.log | node tests/runtime-regression.mjs | 0 | 516 | 0 | 0 | validation/REQ-0009-runtime.log |
| VT-0009-02 | DR-0009-02 | 已确认 | 集成测试通过 | 原WORK-002查询后出现一项query_reset候选并恢复默认筛选；设备重置、按钮脚本模拟、POST/业务表单等无候选。 | 实际命令、退出码、非零断言统计、浏览器副作用计数及日志；不是模型业务验收。 | 命令：node tests/runtime-regression.mjs；退出码：0；测试数量：516；失败数量：0；跳过数量：0；证据：validation/REQ-0009-runtime.log | node tests/runtime-regression.mjs | 0 | 516 | 0 | 0 | validation/REQ-0009-runtime.log |
| VT-0009-03 | DR-0009-03 | 已确认 | 集成测试通过 | 同值替换、字段改值、按钮/表单变化、跨表单/重复reset、submit、检查异常均拒绝；许可在finally清空。 | 实际命令、退出码、非零断言统计、浏览器副作用计数及日志；不是模型业务验收。 | 命令：node tests/runtime-regression.mjs；退出码：0；测试数量：516；失败数量：0；跳过数量：0；证据：validation/REQ-0009-runtime.log | node tests/runtime-regression.mjs | 0 | 516 | 0 | 0 | validation/REQ-0009-runtime.log |
| VT-0009-04 | DR-0009-04 | 已确认 | 集成测试通过 | 原17文件/24例摘要不变；日志、退出码与统计可追溯，工程测试不计真实Agent成功。 | 实际命令、退出码、非零断言统计、浏览器副作用计数及日志；不是模型业务验收。 | 命令：node tests/runtime-regression.mjs；退出码：0；测试数量：516；失败数量：0；跳过数量：0；证据：validation/REQ-0009-runtime.log | node tests/runtime-regression.mjs | 0 | 516 | 0 | 0 | validation/REQ-0009-runtime.log |

## 本轮命令与环境

- 工作目录：D:/01_AI工程/01_工程项目/ui-test-agent
- 命令：node --test tests/query-reset.test.mjs tests/query-forms.test.mjs tests/release-discovery-chains.test.mjs
- 命令：node tests/runtime-regression.mjs
- 命令：node acceptance/check.mjs
- 环境：本机Windows/Node22/Chromium，隔离合成随机端口。

## 结论

- 限定查询重置与首次拒绝后事件锁定已有真实Chromium正反例；516项程序回归无失败/跳过。
- 3个浏览器集成文件分别有最终成功证据，首轮组合1失败及测试替身中间错误保留。注入模型不计真实DeepSeek，不声称最终可发布。
- 原24例17文件摘要未改；REQ-0008仍待选择，知识库未实现；4179服务和历史任务未改。
