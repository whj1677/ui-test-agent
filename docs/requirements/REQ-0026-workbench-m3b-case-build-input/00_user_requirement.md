<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0026 用户需求

## 原始输入

> 从dd04501基线在现有workbench中把项目内一条已确认用例接入既有build task：服务端按project_id、case_id、版本和内容哈希冻结完整用例及合成环境引用，创建但不启动Harness，并在Web展示实际快照、task.md、任务指令和双向关联。

## 结构化理解

| UN | 状态 | 目标 | 约束 | 成功标准 |
|---|---|---|---|---|
| UN-0026-01 | 已确认 | 从项目用例详情创建真实待启动建例任务，完整保留版本化输入及来源，并能查看准备交给Coding Agent的实际内容。 | Harness、模型、候选生成和业务脚本执行均为0；不批量建例、不自动批准、不新建另一套任务系统；仅绑定现有无登录合成环境。 | 真实xlsx导入的已确认用例从Web创建进入现有build task历史；快照不受后续用例修改影响，新版本形成新任务；拒绝跨项目、错误版本/哈希和待澄清输入；刷新与重启仍可双向追溯。 |

## 已确认事实

- 基线dd04501de512f7fd9badb0ecb980ab7daa63c462已在独立worktree和codex/test-workbench-m3b-case-build-input分支核对。
- 现有BuildTaskStore以task.json持久化build task，BuildTaskManager负责固定探针提交、启动、生命周期和预算；本批复用该对象与历史列表。
- 项目用例版本已保存content、content_sha256、root_source与lineage；任务快照必须由服务端读取这些记录生成。
- 本批只允许synthetic-probe-v1对应的无登录本地合成环境引用，创建的项目用例任务显式禁止启动。
- request_id幂等身份由project_id、case_id、case_version、content_sha256和environment_id五项共同确定；同键异身份必须冲突关闭。

## 推断与待确认

- 无阻塞业务歧义；真实模型是否能据项目用例生成有效候选留待后续独立授权验证。
