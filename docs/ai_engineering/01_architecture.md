# 01 架构说明

## 当前架构（2026-10-29 源码核验）

正式应用为 `workbench`，唯一入口 `http://127.0.0.1:4322/workspace/`。运行链路：`start-workbench.ps1 → server/index.mjs 装配及恢复 → app.mjs/领域 routes → manager → store/executor → 执行记录/报告快照`。浏览器使用 `web-v2`，通过 HTTP API 调用服务。这是进程内组合的模块化应用。

| 目录 | 当前职责与边界 |
|---|---|
| workbench/web-v2 | 正式页面；app.js 装配路由，领域视图分工，api.js 提供请求与下载公共处理。 |
| workbench/server | 服务装配及共享设施；cases、requirements、case-assistant、build、backend、native-dsh、auth 分领域实现。 |
| workbench/scripts | 唯一启动器、安装诊断、打包与显式测试清单；部分模块仍被运行时引用。 |
| src、public | 早期执行器及当前共享基础能力/报告组件，仍有正式模块引用，不能整目录删除。 |
| harness-probe | Harness 调用与候选检查，仍在正式构建调用链中。 |
| workbench/tests、tests | 工程测试；npm test 仅执行工作台显式清单，不代表全部业务功能。 |
| acceptance、manual-lab、heldout-lab、expanded-lab、pilot | 冻结验收输入、目标夹具及试点；按实际依赖判断，不批量清理。 |
| docs/requirements、docs/modules | 需求事实源与领域契约；JSON 包兼容视图由事实源生成。 |
| vendor、packaging、skills | 本地依赖、Windows 安装定义与运行技能。 |
| .local、workbench/.local、workbench/qa、outputs、artifacts | 本机运行或派生产物；QA 含已跟踪夹具与现场记录，不整体当可删缓存。 |

`paths.mjs` 集中派生运行数据路径。各领域 Store 分别维护项目、需求、助手与构建任务；共享 `atomic-json.mjs` 提供独占临时文件、有限 Windows 替换重试与清理。本轮统一四个已有重试 Store，保持尾部换行及原有无换行调用字节格式，其他存储策略未改。

`service-identity.mjs` 捕获加载时的源码、配置和数据根摘要；磁盘更新后必须在原入口受控重启并核验摘要。主服务 ready 不代表 Native DSH 或模型子能力可用。固定脚本复跑、生成、真实模型、人工确认及报告导出分别记账，旧失败和报告快照保留。

当前维护重点是公共逻辑集中和测试覆盖边界。较大的管理器按真实需求逐步分解；忙碌状态枚举、CSS 多代层叠和 HTML 转义归属留待独立验证，不只按行数拆文件。见 [REQ-0042 审查与验证](../requirements/REQ-0042-architecture-review/review.md)。

## 历史架构记录（保留追踪，不代表当前完整结构）

2026-10-04（REQ-0038 v41）：项目测试环境配置 → 项目绑定修订（UI/HTTP ID + 配置摘要）→ 生成/示范/候选/HTTP 执行前校验。绑定服务由 `workbench/server/index.mjs` 统一装配；旧注册表、脚本、计划与运行历史保持原身份。接口与兼容边界见 `docs/modules/workbench-case-library.md` 和本轮 `workbench/qa/20261004-project-environment/REPORT.md`。

## 结论

本文档基于当前项目目录和构建文件自动草拟。模块职责、上下游依赖和关键数据流需要后续人工确认。

## 总体结构

```text
入口/脚本 -> 源码模块 -> 测试与构建配置
源码目录：src
测试目录：tests
构建配置：package.json
```

## 核心模块

| 模块 | 代码路径 | 职责 | 上游 | 下游 | 状态 |
|---|---|---|---|---|---|
| optimization | optimization | 源码目录，职责待人工确认 | 待确认 | 待确认 | 扫描生成 |
| public | public | 源码目录，职责待人工确认 | 待确认 | 待确认 | 扫描生成 |
| vendor | vendor | 源码目录，职责待人工确认 | 待确认 | 待确认 | 扫描生成 |

## 关键数据流

1. 自动扫描阶段只能确认目录和入口线索，不能确认真实业务数据流。
2. 涉及接口、协议、配置或持久化行为时，需要补充调用链和数据流。

## 分层与边界

2026-09-25 REQ-0037 v9 工作台可靠性：启动时捕获源码、脱敏配置及数据根的 SHA256，固定在新任务、运行、生成操作、接纳批次和报告中。各管理器在准备、执行和结果收口期间持有互斥状态；后台写入故障汇入 BuildTaskManager 存储故障锁存，健康接口继续可读并拒绝新写请求。批次/生成原子保存对 Windows 临时占用有界重试，持续失败不伪造终态。关机先关闭接纳，再取消与等待本进程拥有的执行器及认证会话；超时明确记录未排空。

自主开发的恢复种子完整包保存在模型可写草稿目录之外，首次自测使用该包。提交自动生成绑定完整包哈希的原前提、动作、预期、代码行和实测材料；有限规则不等于语义证明，人工批准不变。可执行业务差异至多一次独立正常复核，其他不确定原因保留分类。详见 `docs/modules/test-workbench.md` 的 v9 说明。

1. 禁止跨层或反向依赖的规则：待人工确认。
2. 公共模块依赖边界：待人工确认。

## 文档同步触发

架构、模块职责、调用边界、关键数据流变化时，必须同步本文档和相关 `docs/modules/` 文档。
