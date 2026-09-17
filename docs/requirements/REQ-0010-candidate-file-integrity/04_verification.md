<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0010 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0010-01 | DR-0010-01 | 已确认 | 集成测试通过 | 原候选包通过完整性检查；说明改坏或删除、运行文件变化、元数据不一致必须失败。 | 真实命令、退出码、统计、日志与包身份；本机安装不等于产品验收。 | 命令：node --test tests/release-integrity.test.mjs tests/installation.test.mjs；退出码：0；测试数量：53；失败数量：0；跳过数量：0；证据：validation/REQ-0010-first.log | node --test tests/release-integrity.test.mjs tests/installation.test.mjs | 0 | 53 | 0 | 0 | validation/REQ-0010-first.log |
| VT-0010-02 | DR-0010-02 | 已确认 | 集成测试通过 | 越界、绝对路径、反斜线别名、目录/链接替代、错误摘要均失败；不读取清单指定的未知文件。 | 真实命令、退出码、统计、日志与包身份；本机安装不等于产品验收。 | 命令：node --test tests/release-integrity.test.mjs tests/installation.test.mjs；退出码：0；测试数量：53；失败数量：0；跳过数量：0；证据：validation/REQ-0010-first.log | node --test tests/release-integrity.test.mjs tests/installation.test.mjs | 0 | 53 | 0 | 0 | validation/REQ-0010-first.log |
| VT-0010-03 | DR-0010-03 | 已确认 | 集成测试通过 | 源码无清单维持原行为；包内说明缺失不能因ENOENT被当成源码模式。 | 真实命令、退出码、统计、日志与包身份；本机安装不等于产品验收。 | 命令：node --test tests/release-integrity.test.mjs tests/installation.test.mjs；退出码：0；测试数量：53；失败数量：0；跳过数量：0；证据：validation/REQ-0010-first.log | node --test tests/release-integrity.test.mjs tests/installation.test.mjs | 0 | 53 | 0 | 0 | validation/REQ-0010-first.log |
| VT-0010-04 | DR-0010-04 | 已确认 | 集成测试通过 | 正反例、实际安装/自检/启动/复用/停止均有退出码、日志和包身份；冻结资产不变。 | 真实命令、退出码、统计、日志与包身份；本机安装不等于产品验收。 | 命令：node tests/release-package.integration.mjs validation/REQ-0010-package-20260918-01；退出码：0；测试数量：1；失败数量：0；跳过数量：0；证据：validation/REQ-0010-package-smoke.log | node tests/release-package.integration.mjs validation/REQ-0010-package-20260918-01 | 0 | 1 | 0 | 0 | validation/REQ-0010-package-smoke.log |

## 本轮命令与环境

- 工作目录：D:/01_AI工程/01_工程项目/ui-test-agent
- 命令：node --test tests/release-integrity.test.mjs tests/installation.test.mjs
- 命令：node tests/launcher.integration.mjs
- 命令：node tests/runtime-regression.mjs
- 命令：node acceptance/check.mjs
- 命令：node tests/release-package.integration.mjs validation/REQ-0010-package-20260918-01
- 环境：Windows/Node22；本机新目录/隔离端口和数据；无模型凭据。

## 结论

- 损坏说明反例修复后拒绝，48项新增TAP检查及原5安装维护项均无失败；564项非暂停程序回归无失败/跳过。
- 同版候选本机新目录实际安装与5次包内维护命令成功；仅1个脚本联调文件，不是干净Windows或真实Agent产品验收。
- 保留原失败、旧服务和冻结资产；真实模型/多步审批/独立环境及人员仍待完成，不能宣布可发布。
