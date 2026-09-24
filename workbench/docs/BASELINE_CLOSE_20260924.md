# 2026-09-24 工作台开发基线收口

目标：接收11个既有源码改动，形成可从提交导出的工程基线，收尾当前门禁。输入为802e687476f7b77945b48b67f69001900465032a及已交接工作区。只交付代码集成、必要文档与零模型复验；不扩展AUTH、通用入口或UI。本批真实Harness启动、模型调用、产品候选执行均为0。完成干净复验、门禁和推送后停止。

## 既有文件接收

原AUTH任务已交接写入权，本批核对其为空闲；当前目录与分支保持。原始差异、逐文件哈希和32个未跟踪文件私有备份在`workbench/.local/baseline-close-20260924/backup`，不推送。下列11文件逐项审查后均纳入集成，AUTH归属REQ-0035；QA修复归属REQ-0033。不是整包盲提交。

| 文件（workbench/下） | 接收内容与处理 |
|---|---|
| scripts/start-workbench.ps1 | 接收配置来源隔离与只读预检；恢复UTF-8 BOM；把AUTH闭环过度表述改为部分实现 |
| scripts/verify-start-config.ps1 | 原脚本依赖私有数据及7/7旧额度，保留私有备份；入口改用已提交的合成配置测试 |
| server/app.mjs | AUTH角色参数、错误映射及同候选复跑API |
| server/auth/session.mjs | 失效通知与清除状态 |
| server/build/files.mjs | AUTH媒体登记；保留QA日志最终化规则 |
| server/build/manager.mjs | 会话版本绑定、执行中观察、认证执行/复跑及回放；保留QA最终摘要收尾 |
| server/build/project-case.mjs | auth-session输入绑定；保留通用建例规则 |
| server/build/store.mjs | AUTH授权作用域及上限代码；不修改真实授权账本 |
| server/build/template.mjs | 合成登录站环境绑定与只读探测 |
| server/index.mjs | 注入会话服务 |
| web-v2/app.js | AUTH角色选择、复跑及状态读回接线；不增加NEW编号白名单 |

`.auth01-run/`中的一次性驱动、会话/运行记录及根目录8份控制台输出仅本机留存，逐路径忽略；可长期复用的配置验证已提取为无私有依赖的工程测试。没有忽略整个测试目录。三个已有锁文件与启动配置模板均受版本控制。

## 可复现验证

源码提交和当前结果：待首次集成提交后填写。执行器为`workbench/scripts/verify-committed-baseline.py`，从明确SHA使用git archive导出临时副本，核对所有跟踪文件未被export-ignore漏掉，三个npm ci独立安装，单独下载Chromium；不复制node_modules、私有配置、项目或媒体。完整工作台工程测试含原TC-005离线报告、生命周期正常/取消/异常及label/value/动态选中/可见性反例。浏览器补验使用临时端口与合成数据；历史截图读回校验run.json和媒体哈希不变。

环境边界：需要Windows、Node >=22、npm、Python、PowerShell 7及工程测试指定的本机Microsoft Edge；需要依赖下载网络。真实模型运行另依赖保留的本机DSH私有运行时，未打包、未加载模型密钥，也未验证任意机器开箱即用。配置合成测试只证明路径/优先级/空授权行为，空运行时目录不代表Harness可运行。

## 门禁与历史边界

旧8项及历史失败仍见[原修订记录](../qa/20260924-revision/REVISION.md)（正确仓库路径：`workbench/qa/20260924-revision/REVISION.md`）；原REPORT、manifest、REVISION和日志不改。本批起始check实际为3类失败：REQ-0036非法状态、32个未登记文件、代码变更无当前治理归属。处理：REQ-0036源状态改为“仅静态检查”；私有文件准确忽略；REQ-0033/0035分别更新设计、验证及模块说明，重新收集当前交付指纹和实际验证。最终结果待填写。

工作台、Harness与旧核心分别统计，不累加重叠测试。旧核心108失败仍未完成，沿用QA中的26文件/错误类型分组及代表抽样；相对导入仍不进入旧controller/common，不将所有失败称为过时。新增用例通用工作台建例入口仍未接通。AUTH绑定代码接收不代表完整真实任务、执行中失效、任意站点接入或候选人工批准通过。四条既有产品修订结果不重跑、不重计。

首次源码提交84fd90537a511a95b9bbf38bda9c574e8f8a6025的run-01导出1352个文件、三个npm ci成功；Chromium下载响应后持续0字节，按父子PID核实后仅终止该下载，保留非零退出记录，测试尚未开始。补充显式登记本机已安装浏览器缓存的验收选项后重新提交源码再复验；不复制node_modules。

run-02（58a88c01a4101a6a2378be7658bdfb9e2f7c205f）：工作台113/113、Harness24/24；历史媒体浏览器测试因夹具未注入CaseLibraryStore，页面两次读取`/api/case-library/projects`返回404，整体退出1，后续AUTH/UI浏览器未执行。补齐测试夹具服务接线后本机定向复验退出0；保留原控制台零错误断言，不忽略404。随后提交并重新执行干净验收。
