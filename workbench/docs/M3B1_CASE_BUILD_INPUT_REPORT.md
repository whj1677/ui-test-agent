# M3-B1 项目单条用例建例输入接通报告

日期：2026-09-21

基线：`dd04501de512f7fd9badb0ecb980ab7daa63c462`

分支：`codex/test-workbench-m3b-case-build-input`

## 结论

项目内一条已确认用例现在可以创建进入既有 build task 历史的真实输入任务，并在 Web 查看实际冻结快照、`task.md`、固定 Agent 指令及三份登记原件。任务状态停在 `SUBMITTED / NOT_STARTED / NOT_STARTED / NOT_READY`，并明确显示“已创建，尚未启动”。本批 Harness 启动 0 次、模型调用 0 次、候选 0 份、业务脚本执行 0 次，不能据此宣称真实模型建例或项目用例自动化完成。

Codex 沿用当前窗口配置；运行环境没有提供可核验的具体子型号和推理档位，因此两项记录为未知。本批建例端未加载 DeepSeek 连接配置。

## 输入与版本绑定

- Web 只提交 `project_id`、内部 `case_id`、指定版本、该版本 SHA-256、固定环境 ID 和幂等 request ID；不提交正文或确认状态。
- 服务端从 CaseLibraryStore 读取指定版本并复算内容哈希，冻结编号、标题、模块、前置条件、多行测试数据、全部有序步骤、逐步预期、根来源、lineage 和环境引用。
- 任务目录原子写入 `input/case-snapshot.json`、`task.md` 和 `agent-instruction.txt`，task.json 登记其大小、SHA-256 和受控路径。
- v1 创建后修改项目用例形成 v2，旧 task 的 v1 快照保持不变；新 task 独立绑定 v2 和新哈希。
- 同一 request ID 并发或重复提交返回同一 task；不同 request ID 表示用户明确创建另一任务。

## 阻止条件与执行边界

跨项目/用例混用、版本不存在、哈希不符、内容待确认、动作或逐步预期不完整、非法环境和额外 API 字段均被拒绝。仅允许 `synthetic-probe-normal-v1` 无登录合成环境引用，不从用例文字推断 URL。项目用例 task 带 `execution_policy.mode=INPUT_ONLY`，页面禁用“启动 Harness”，后端 start 同样返回 `BUILD_INPUT_ONLY_TASK_NOT_STARTABLE`；查看、轮询和重启不领取 M2-C 预算。

## 实际验证

| 命令 | 结果 | 说明 |
|---|---|---|
| `node --test tests/project-case-build-input.test.mjs tests/build-manager.test.mjs tests/case-library.test.mjs tests/case-library-api.test.mjs` | 11/11 通过，退出码 0 | 真实 xlsx 解析后冻结；两用例差异；v1/v2；拒绝条件；并发幂等；重启；固定探针兼容。 |
| `npm run test:m3b1-browser` | 1/1 通过，退出码 0 | 真实 Chromium：创建项目、上传/预览/确认 xlsx、选择用例、创建、查看完整输入、返回关联历史、重启读回。Harness 计数 0。 |
| `npm test` | 最终 54/54 通过，退出码 0 | 完整 workbench 工程集合。首次执行因 worktree 自动换行造成批准脚本工作树哈希不符、且 harness-probe 锁定依赖未安装而为 47/54；恢复 Git 索引中的批准原始字节并执行两个子工程各自 `npm ci` 后原集合全部通过，未修改批准哈希或依赖版本。 |

批准排序脚本复验哈希为 `280A787546AABDD87570838932663A5DC254AEE5E0C329BE3A13294E9A18079A`，Git 无该文件内容变更。工程测试中的合成候选执行不属于批准业务脚本运行。

## Web 证据

[M3-B1 项目用例输入页面](evidence/M3B1_PROJECT_CASE_BUILD_INPUT_WEB.png) 显示来源用例、指定版本、固定环境、关联 task、四类未启动状态、冻结 JSON、task.md/Agent 指令折叠区和三份登记文件。截图使用临时合成项目，不含密钥、用户原文件或私有媒体。

## 未完成与停止点

未验证 Coding Agent 是否实际读取该输入、是否能生成有效候选，也未验证项目真实业务页面。没有批量建例、执行套件、自动批准、自愈或任意 URL 支持。本批到输入接通和零模型验证结束即停止。
