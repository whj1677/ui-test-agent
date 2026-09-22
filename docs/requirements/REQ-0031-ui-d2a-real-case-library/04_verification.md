<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0031 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0031-01 | DR-0031-01 | 已确认 | 集成测试通过 | 验证 /workspace 与旧首页并存，项目/用例/版本/草稿和错误状态来自真实后端且刷新可读回。 | 受影响 Node 测试、HTTP 状态、真实 Chromium 页面与重启读回记录；浏览器明细见 workbench/docs/UI_D2A_ACCEPTANCE_REPORT.md。 | 命令：node --test workbench/tests/ui-d2a.test.mjs；退出码：0；测试数量：3；失败数量：0；跳过数量：0；证据：docs/requirements/REQ-0031-ui-d2a-real-case-library/ui-d2a-verification.log | node --test workbench/tests/ui-d2a.test.mjs | 0 | 3 | 0 | 0 | docs/requirements/REQ-0031-ui-d2a-real-case-library/ui-d2a-verification.log |
| VT-0031-02 | DR-0031-02 | 已确认 | 集成测试通过 | 验证真实 A/B xlsx 上传、工作表映射、预览分类、确认前后数量、保真字段及冲突/待澄清处理。 | 原始样例固定预期、后端记录、浏览器上传与预览截图；浏览器明细见 workbench/docs/UI_D2A_ACCEPTANCE_REPORT.md。 | 命令：node --test workbench/tests/ui-d2a.test.mjs；退出码：0；测试数量：3；失败数量：0；跳过数量：0；证据：docs/requirements/REQ-0031-ui-d2a-real-case-library/ui-d2a-verification.log | node --test workbench/tests/ui-d2a.test.mjs | 0 | 3 | 0 | 0 | docs/requirements/REQ-0031-ui-d2a-real-case-library/ui-d2a-verification.log |
| VT-0031-03 | DR-0031-03 | 已确认 | 集成测试通过 | 验证选中/全部实际下载、正式包解析、跨项目导入、重复幂等、项目独立编辑和 409 处理。 | 下载文件字节与 JSON 断言、项目计数/版本/来源记录、浏览器流程；浏览器明细见 workbench/docs/UI_D2A_ACCEPTANCE_REPORT.md。 | 命令：node --test workbench/tests/ui-d2a.test.mjs；退出码：0；测试数量：3；失败数量：0；跳过数量：0；证据：docs/requirements/REQ-0031-ui-d2a-real-case-library/ui-d2a-verification.log | node --test workbench/tests/ui-d2a.test.mjs | 0 | 3 | 0 | 0 | docs/requirements/REQ-0031-ui-d2a-real-case-library/ui-d2a-verification.log |
| VT-0031-04 | DR-0031-04 | 已确认 | 集成测试通过 | 验证独立数据根、三种桌面尺寸、服务重启与空白浏览器读回，且 Harness/模型/业务脚本调用为 0。 | 实际命令、退出码、测试统计、截图、数据根与进程记录；浏览器明细见 workbench/docs/UI_D2A_ACCEPTANCE_REPORT.md。 | 命令：node --test workbench/tests/ui-d2a.test.mjs；退出码：0；测试数量：3；失败数量：0；跳过数量：0；证据：docs/requirements/REQ-0031-ui-d2a-real-case-library/ui-d2a-verification.log | node --test workbench/tests/ui-d2a.test.mjs | 0 | 3 | 0 | 0 | docs/requirements/REQ-0031-ui-d2a-real-case-library/ui-d2a-verification.log |

## 本轮命令与环境

- 工作目录：独立 worktree C:/Users/20240082/.codex/worktrees/workbench-ui-d2a-case-library/ui-test-agent。
- 命令：npm --prefix workbench test（先核对无真实 Harness/业务执行）
- 命令：独立 WORKBENCH_DATA_DIR 与空闲端口启动 npm --prefix workbench start
- 命令：真实 Chromium /workspace/ 流程及下载/重启核对
- 环境：Windows PowerShell
- 环境：Node.js 与 workbench package-lock 锁定依赖
- 环境：本机 Chromium/Playwright；无需模型凭据

## 结论

- UI-D2A 项目与用例真实数据闭环通过：浏览器上传、预览确认、下载、跨项目导入、版本编辑与重启读回均取得实际证据；Harness、模型、业务脚本调用为 0。全量 npm test 的 2 个既有 Harness 运行根用例因 harness-probe 依赖未安装未就绪，不影响本批路径且未为此扩大范围。
