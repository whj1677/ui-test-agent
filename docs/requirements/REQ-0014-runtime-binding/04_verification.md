<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0014 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0014-01 | DR-0014-01 | 已确认 | 集成测试通过 | 独立意图协议与输入审查 | 本机真实命令、退出码、非零统计和日志；模型注入与真实模型分开。 | 命令：node tests/runtime-regression.mjs；退出码：0；测试数量：647；失败数量：0；跳过数量：0；证据：validation/REQ-0014-runtime-final.log | node tests/runtime-regression.mjs | 0 | 647 | 0 | 0 | validation/REQ-0014-runtime-final.log |
| VT-0014-02 | DR-0014-02 | 已确认 | 集成测试通过 | 当前动作与断言绑定 | 本机真实命令、退出码、非零统计和日志；模型注入与真实模型分开。 | 命令：node tests/runtime-regression.mjs；退出码：0；测试数量：647；失败数量：0；跳过数量：0；证据：validation/REQ-0014-runtime-final.log | node tests/runtime-regression.mjs | 0 | 647 | 0 | 0 | validation/REQ-0014-runtime-final.log |
| VT-0014-03 | DR-0014-03 | 已确认 | 集成测试通过 | 产品可见通道与兼容回归 | 本机真实命令、退出码、非零统计和日志；模型注入与真实模型分开。 | 命令：node --test tests/runtime-binding.test.mjs；退出码：0；测试数量：20；失败数量：0；跳过数量：0；证据：validation/REQ-0014-binding-final.log | node --test tests/runtime-binding.test.mjs | 0 | 20 | 0 | 0 | validation/REQ-0014-binding-final.log |

## 本轮命令与环境

- 工作目录：D:/01_AI工程/01_工程项目/ui-test-agent
- 命令：node --test tests/runtime-binding.test.mjs
- 命令：node tests/runtime-regression.mjs
- 命令：node acceptance/check.mjs
- 环境：Windows Node22 / 隔离随机端口和临时数据 / Chromium

## 结论

- 最终本机非暂停工程回归647项，0失败/跳过；包含本轮20项协议/真实Chromium/控制台检查，不重复相加。
- 此前专项19/19通过；最终增补完整对象及预期来源反例后再跑647回归。
- 24条/17文件冻结检查通过；所有模型回复本机注入，真实模型0调用；不是业务/通用能力/发布验收。
- 核心实现构建46d3cdbf4734ed526411b527c62ad608ef147cfb7df261f42de6961c0a469723已跑647项回归；随后只修正意图审查展示，最终构建542e5c5efe9bea1d6eb0d377d77b3e0e4a0315dc4b41199e31642a948d807aa1的20项专项collector复验全部通过（validation/REQ-0014-binding-final.log）。4179未重启，不产新ZIP或Release。
