<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0027 设计

## 设计标识

| DD | 关联 DR | 状态 | 方案摘要 | 设计理由 |
|---|---|---|---|---|
| DD-0027-01 | DR-0027-01 | 已确认 | 扩展既有单次启动授权记录为M3-B2项目用例作用域，任务创建时只为当前配置的授权绑定五项身份并设置可启动策略。 | 复用现有spawn时记账，避免全局放开或新任务系统。 |
| DD-0027-02 | DR-0027-02 | 已确认 | 从task根目录按登记哈希复制冻结输入到attempt workspace；启动fixture后将实际渲染指令写入workspace并作为Harness prompt。 | 模型读取与Web展示同一冻结事实，避免读取最新版或父目录。 |
| DD-0027-03 | DR-0027-03 | 已确认 | 创建时把受支持合成环境的输出义务绑定到确切用例步骤并冻结verification_contract；验证只读取该契约。 | 避免运行时回退旧template.expected，同时不引入开放式语义判定。 |
| DD-0027-04 | DR-0027-04 | 已确认 | 直接将attempt正常/反例报告和媒体登记到现有task files，并增加按task/file ID的哈希与Range读取及候选结果展示。 | 真实流程自动返回结果，无需离线手工派生索引。 |
| DD-0027-05 | DR-0027-05 | 已确认 | 使用真实Web创建并启动一条合成项目用例，测试驱动按返回task_id等待；服务由覆盖600秒上限的前台宿主持有。 | 旧历史任务不能提前满足终态，宿主不能先于Harness退出。 |

## 接口与数据流

- Excel上传/预览/确认 -> 选择确切用例版本 -> 创建带本批作用域授权的新build task -> 用户显式start。
- 冻结task文件 -> attempt逐字复制和哈希复核 -> 渲染入口/输出路径 -> Harness专用cwd -> candidate.spec.mjs。
- 同一候选 -> 正常fixture与negative fixture -> Playwright结构化报告和媒体 -> task files/candidate结果 -> 项目页关联历史和任务详情。

## 模块文档影响

- 更新workbench-case-library与test-workbench模块，说明项目用例单次授权、attempt输入、验证契约和直接媒体返回。

## 风险与回滚

- 没有OS级文件/网络强制隔离；继续使用用户已接受的专用任务目录与最小资料暴露，报告残余风险。
- 模型可能生成逻辑错误；只保留候选和实际错误，不重试或人工改写。
- 删除M3-B2授权类型、直接媒体路由和Web显示即可回滚；历史M3-B1 INPUT_ONLY任务及已落盘结果不迁移。
