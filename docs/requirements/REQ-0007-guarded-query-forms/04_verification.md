<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0007 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0007-01 | DR-0007-01 | 已确认 | 集成测试通过 | 两种冻结页面筛选可通过产品候选完成，原文和页面不改。 | 真实命令、退出码、非零统计和日志；区分组件/模型/业务验收。 | 命令：node tests/runtime-regression.mjs；退出码：0；测试数量：476；失败数量：0；跳过数量：0；证据：validation/REQ-0007-runtime-release.log | node tests/runtime-regression.mjs | 0 | 476 | 0 | 0 | validation/REQ-0007-runtime-release.log |
| VT-0007-02 | DR-0007-02 | 已确认 | 集成测试通过 | 方法/按钮覆盖属性/敏感字段/重复及混合业务按钮反例无候选，输入值仍固定。 | 真实命令、退出码、非零统计和日志；区分组件/模型/业务验收。 | 命令：node tests/runtime-regression.mjs；退出码：0；测试数量：476；失败数量：0；跳过数量：0；证据：validation/REQ-0007-runtime-release.log | node tests/runtime-regression.mjs | 0 | 476 | 0 | 0 | validation/REQ-0007-runtime-release.log |
| VT-0007-03 | DR-0007-03 | 已确认 | 集成测试通过 | 换form/action/value/节点/submitter、隐式/重复提交被拒，finally清理许可。 | 真实命令、退出码、非零统计和日志；区分组件/模型/业务验收。 | 命令：node tests/runtime-regression.mjs；退出码：0；测试数量：476；失败数量：0；跳过数量：0；证据：validation/REQ-0007-runtime-release.log | node tests/runtime-regression.mjs | 0 | 476 | 0 | 0 | validation/REQ-0007-runtime-release.log |
| VT-0007-04 | DR-0007-04 | 已确认 | 集成测试通过 | 保留原24例17文件摘要和旧4179；结果、统计、commit可追溯。 | 真实命令、退出码、非零统计和日志；区分组件/模型/业务验收。 | 命令：node tests/runtime-regression.mjs；退出码：0；测试数量：476；失败数量：0；跳过数量：0；证据：validation/REQ-0007-runtime-release.log | node tests/runtime-regression.mjs | 0 | 476 | 0 | 0 | validation/REQ-0007-runtime-release.log |

## 本轮命令与环境

- 工作目录：D:/01_AI工程/01_工程项目/ui-test-agent
- 命令：node --test tests/query-forms.test.mjs
- 命令：node tests/runtime-regression.mjs
- 命令：node acceptance/check.mjs
- 环境：Windows11 / Node22 / 已安装Chromium；新实例动态端口、无模型调用

## 结论

- 限定GET查询实现已完成；冻结版本非暂停程序476项、3集成文件6TAP无失败/跳过。正式专项由collector实际执行并单独记录，不与全量相加。
- 保留所有先前失败，模型提示仅做协议/文本测试；未调用真实模型、不重启4179，不修改原用例/冻结页面。
- 查询以有限保守语法及严格DOM条件提供；POST表单、多步向导、业务提交仍未由本包支持。GET和黑盒处理器纯读无法保证；不能宣布发布。
