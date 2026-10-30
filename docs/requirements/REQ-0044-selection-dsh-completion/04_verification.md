<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0044 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0044-01 | DR-0044-01 | 已确认 | 集成测试通过 | 按项目与浏览器标签页保存范围；显式本页/筛选全选，切页刷新仍保留，提交不清空；不静默扩大或丢弃选择。 | 实际日志、命令退出码和正式4322产物；正式4322选择与日志链路通过 | 命令：node workbench/qa/20261030-selection-lifecycle/verify-selection.mjs；退出码：0；测试数量：8；失败数量：0；跳过数量：0；证据：workbench/qa/20261030-selection-lifecycle/selection-release.log | node workbench/qa/20261030-selection-lifecycle/verify-selection.mjs | 0 | 8 | 0 | 0 | workbench/qa/20261030-selection-lifecycle/selection-release.log |
| VT-0044-02 | DR-0044-02 | 已确认 | 集成测试通过 | 每批执行/阻塞已覆盖所有所选项、定位经验保存、无执行写入时可提交finish-batch；确认宿主已停止后推进下一批，不要求全通过；停止未确认继续占锁。 | 实际日志、命令退出码和正式4322产物；默认后台真实DSH自测、收尾回执与冻结定位经验下载通过 | 命令：node workbench/qa/20261030-selection-lifecycle/verify-background-dsh.mjs read；退出码：0；测试数量：1；失败数量：0；跳过数量：0；证据：workbench/qa/20261030-selection-lifecycle/background-dsh-progress.log | node workbench/qa/20261030-selection-lifecycle/verify-background-dsh.mjs read | 0 | 1 | 0 | 0 | workbench/qa/20261030-selection-lifecycle/background-dsh-progress.log |
| VT-0044-03 | DR-0044-03 | 已确认 | 集成测试通过 | 正式执行和诊断各最多三次/用例；已通过项不再重跑；收尾阶段显示执行数量及工作，保存执行/收尾/确认日志；收尾无进展或超额工具终止并如实记不完整。 | 实际日志、命令退出码和正式4322产物；全清单通过；补充77项登记收尾检查与故障注入原记录保留 | 命令：npm test；退出码：0；测试数量：1415；失败数量：0；跳过数量：0；证据：workbench/qa/20261030-selection-lifecycle/full-regression-release.log | npm test | 0 | 1415 | 0 | 0 | workbench/qa/20261030-selection-lifecycle/full-regression-release.log |
| VT-0044-04 | DR-0044-04 | 已确认 | 集成测试通过 | 前端不再输入/发送时间上限，生成和冻结脚本复跑均无总时长定时器；保留单工具与传输、停止确认保护。；生成及复跑都可选BACKGROUND/FOREGROUND，默认后台；后台headless并保存页面录像/截图/Trace，跳过整窗录制及用户登录窗口CDP附加，前台保留原证据。仍为单任务。 | 实际日志、命令退出码和正式4322产物；真实前台/后台浏览器工程证据及正式冻结复跑验证见对应JSON | 命令：node --test --test-concurrency=1 workbench/tests/native-dsh-executor.test.mjs workbench/tests/native-dsh-evidence.test.mjs；退出码：0；测试数量：19；失败数量：0；跳过数量：0；证据：workbench/qa/20261030-selection-lifecycle/background-evidence.log | node --test --test-concurrency=1 workbench/tests/native-dsh-executor.test.mjs workbench/tests/native-dsh-evidence.test.mjs | 0 | 19 | 0 | 0 | workbench/qa/20261030-selection-lifecycle/background-evidence.log |
| VT-0044-05 | DR-0044-05 | 已确认 | 集成测试通过 | 连同REQ43和已完成并行修改执行工程全清单、正式4322全功能与新合成真实模型验证，保存失败证据；创建新完整安装器/包，不宣称远端WPS已修复。 | 实际日志、命令退出码和正式4322产物；342源码输入、57376运行文件及独立解压后安装器编译通过；最终1415工程回归与正式4322功能另见REPORT.md，不代表用户电脑/真实WPS/安装试装验收。 | 命令：node workbench/qa/20261030-selection-lifecycle/verify-package-source.mjs；退出码：0；测试数量：1；失败数量：0；跳过数量：0；证据：workbench/qa/20261030-selection-lifecycle/package-source-verified.log | node workbench/qa/20261030-selection-lifecycle/verify-package-source.mjs | 0 | 1 | 0 | 0 | workbench/qa/20261030-selection-lifecycle/package-source-verified.log |

## 本轮命令与环境

- 工作目录：D:\01_AI工程\01_工程项目\ui-test-agent
- 命令：npm test
- 命令：npm run test:official
- 命令：正式4322新合成项目真实模型及零模型复跑
- 命令：完整便携包和Inno安装器字节核验
- 环境：Windows，正式127.0.0.1:4322

## 结论

- 最终1415项回归通过，0失败、0跳过；追加登记收尾77项通过。
- 正式4322新合成项目真实模型、前后台执行、选择、日志和报告均核验；已有失败和证据不完整保持。
- 完整安装器641839966字节及便携ZIP733674848字节，342源码与57376运行文件校验通过。安装器未实际执行，用户电脑及WPS现场未验。
