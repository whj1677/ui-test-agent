# 软件架构、文件结构与冗余审查

日期：2026-10-29。修改前归档提交 `599fea82e22157b3ede632c40d05c05626c69214`，远端分支 `codex/archive-before-architecture-review-20261029`，已通过 git ls-remote 核验。本轮分支 `codex/architecture-review-20261029`。

正式工作台已有领域划分，主要问题是公共逻辑散落、测试与运行能力边界不清、架构文档过时。没有证据支持整体重写或按目录名称批量删除。

| 优先级 | 源码依据与问题 | 本轮处理 |
|---|---|---|
| P2 | cases/store、build/store、requirements/store、case-assistant/store 各复制8次Windows rename重试，与atomic-json重复。 | 共享实现，保留换行、wx、重试、清理与IO注入；不改其他存储策略。 |
| P2 | api.js、requirements-api.js、case-assistant-api.js 重复下载逻辑；需求导出未验成功MIME，HTML可伪装导出，错误与文件名容错不一致。 | 集中请求/下载，保留入口契约，补异常响应回归。 |
| P2 | 原清单152文件，工作台206个.test.mjs，根目录另128个；排除项含随机端口工作台；test:official仅4项只读检查。 | 补安全配置测试和新增回归，正式4322功能单列；不直接glob历史测试。 |
| P3 | 01_architecture.md 没有反映正式工作台调用链。 | 增加当前核验架构与目录职责，旧记录明确标为历史。 |
| P3 | index.mjs与service-restart分散枚举忙碌状态。 | 记录重复与漂移风险，尚未证明并发准入缺陷，本轮不改。 |
| P3 | workflow.js业务模块导出公共esc，多处再次实现；styles/product/workspace-v2重复主题布局。 | 留待视觉等价整理，不能直接删除覆盖样式。 |

修改前统计：src 89文件/21825行，workbench/server 173文件/25471行，web-v2 39文件/8510行。构建管理器1410行、需求管理器1243行、前端入口1568行、需求视图1167行。规模仅反映维护成本，不独立证明缺陷。

public仍由src/server.mjs和src/report-view.mjs引用；build/adapter.mjs仍使用harness-probe；requirements-model、backend-manager仍引用src。因此旧入口与共享实现必须分开判断。空workbench/web兼容路径以后可随旧入口整理，本轮不改打包结构或搬目录。

未跟踪区域含大量安装包、浏览器资料和原始报告，均保留本机，此次远端归档未上传。受保护xlsx按Git可见原始字节归档，没有改写用户文件。

定向回归验证字节兼容与异常边界；npm test验证完整显式清单；正式功能只在4322原配置数据上创建自有合成项目。真实模型/业务目标/干净Windows安装独立记账，不引用历史通过替代本轮验证。初查主服务ready，Native DSH为ERROR/NATIVE_DSH_HOME_BUSY；不能用健康检查或单元测试掩盖此限制。

## 实际验证结果

最终运行源码摘要：f73a015df6a8f1a1df9a7e01144baf7b279d189981d4c78e7af86cc6e2141bd4。备份后实际新增修复：协议解析将“无请求体”误判为必须提供请求体；原输入保持不变，按分句限定否定范围，已在正式4322复验为READY。

| 验证层次 | 实际结果与证据 |
|---|---|
| 最终完整工程清单 | 1366通过，0失败/跳过；engineering-final.log。此前1363项是补丁前结果，保留但不累加。 |
| Harness补充 | 32通过，0失败/跳过；harness-engineering.log。 |
| 正式零模型功能 | 44项通过，覆盖导入/编辑/幂等/版本冲突/来源/绑定/报告/API/页面基础；official-functional.log。不是全部业务验收。 |
| 正式资料输入 | 7项通过：DOCX解析、PNG元数据及原字节、CSV预览与格式拒绝；未调用模型/未确认CSV导入；source-inputs/results.json。 |
| 浏览器页面与下载 | 18页17通过1失败；4项实际下载通过（JSON两类、XLSX、HTML）。报告列表等待数据完成，固定报告预览保留CSP控制台错误；page-readiness/results.json。 |
| 需求/助手真实模型 | 需求一次请求生成UI1/HTTP1，来源与业务预期核验通过；助手一轮生成并导出两份Excel，保持待确认。助手存在无来源交互扩写，内容不判全通过。 |
| UI真实生成及运行 | 一个任务内3次自测；首次实际值缺失保留，最终2步13条断言均有实际值，23个产物SHA核验通过，窗口录像COMPLETE/时间线VERIFIED。冻结脚本复跑通过，model_calls=0。 |
| HTTP生成、确认及执行 | 原协议修复后生成1个计划，人工核对5条业务断言；正式执行及冻结复跑各1请求，均通过且model_calls=0。只读目标，无setup/cleanup写操作。 |
| 汇总及数据保留 | report-36c5d6fdc07bac10ea904eba05406dd701119815：2通过、0未执行；73个原项目摘要保持，只新增3个本轮合成项目；配置/数据根不变。final-state.json。 |

测试仅使用正式4322工作台。4479为本轮独立只读合成被测站点，不是工作台，结束后已停止。工作台仍在4322，原生DSH RUNNING，空闲。实际付费金额不可见；没有为刷绿重新发起付费任务，UI任务内部自测按既有产品预算进行。

## 保留的问题及未覆盖项

1. 报告预览先doc.write内联style再adoptedStyleSheets，内容/样式可用但控制台出现CSP错误；本轮不通过放宽安全策略掩盖。
2. 助手候选在原资料之外增加查询后下拉值保持和点击空白动作，NEEDS_CLARIFICATION原样保留；Excel可下载不等于业务正确。
3. 旧Native DSH锁的宿主PID被TQClient复用；本轮核验身份及SHA后改名留档恢复，未结束无关进程。永久PID身份识别缺陷尚未修复。
4. CSS层叠、公共转义函数归属、分散忙碌状态枚举属于后续结构整理；本轮未扩展到大规模重构。
5. 干净Windows安装、真实认证挑战、WPS/受保护文件现场兼容、图片模型理解、人工示范录制及正式环境异常注入没有在本轮实测。工程测试覆盖不能替代它们。

本轮审查与限定修复已完成，主要合成业务链路有真实证据；整体全功能验收未全部通过，不宣称发布就绪。修改保留在codex/architecture-review-20261029，未自动提交或推送本轮修改。

