<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0034 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0034-01 | DR-0034-01 | 已确认 | 集成测试通过 | 按冻结清单核对导入、六条真实候选试跑、六套媒体、步骤同步、异常、两种桌面尺寸、刷新和服务重启；浏览器与产品记录详见workbench/docs/E2E_01_CAPTION_SELF_TEST.md。 | 真实命令、退出码、测试统计和产物路径 | 命令：npm --prefix workbench test；退出码：0；测试数量：93；失败数量：0；跳过数量：0；证据：docs/requirements/REQ-0034-e2e01-caption-step-sync/verification.log | npm --prefix workbench test | 0 | 93 | 0 | 0 | docs/requirements/REQ-0034-e2e01-caption-step-sync/verification.log |

## 本轮命令与环境

- 工作目录：workbench/
- 命令：node --test tests/e2e01-caption-timeline.test.mjs
- 命令：npm test
- 命令：node tests/project-case-build-run-browser.integration.mjs
- 命令：node tests/e2e01-caption-browser.integration.mjs
- 环境：本机Node锁定依赖；工作台4322；TEST-SITE-01 4320；独立数据目录workbench/.local/six-case-e2e。

## 结论

- 开发者端到端自测按自测报告执行，命令退出码均0；六条产品运行三正常PASSED、三指定缺陷FAILED。用户体验确认和候选批准尚未发生。
