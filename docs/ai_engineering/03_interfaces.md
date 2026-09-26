# 03 接口与配置

## REQ-0001 当前配置增量（2026-09-26）

- `WORKBENCH_AUTH_ENVIRONMENTS` 是显式本机 JSON 配置路径，内容为 `environments` 数组；每项包含 `environment_id/name/origin/login_url/identity_url/roles`。登录及只读身份地址必须同源；允许 HTTPS，HTTP 仅限 loopback；拒绝 URL 凭据、fragment、重复环境/角色。默认保留 AUTH-01 合成样例。
- 生成目标的 `auth_requirement={environment_id,role}` 必须指向已登记同源目标。候选复跑环境可登记 `kind=registered-auth-target` 和 `normal_url`，只提供正常通道。身份检查、会话绑定及失效监控均按当前项目进行；跨项目返回 `TRIAL_AUTH_PROJECT_MISMATCH`。
- `empty-trial.json` 用于首次空工作区，模型和用户发起模型操作默认关闭，无历史授权。`workspace-profile.json` 是启动器写入的数据目录标记；已有正式数据和本机配置不会因打包或验证被切换。
- 已认证执行的公开证据标注 `trace_policy=DISABLED_FOR_AUTH_PRIVACY`；不输出 Cookie、Token、CDP 地址或完整认证状态。实际验证范围见发布收口报告。
- 认证环境新增可选 `session_termination_endpoints:[{path,method}]`，精确规范同源路径及大写方法，经配置校验后供模型探针和认证验证器共同拦截。探针保护按 scope/version 获取租期，任务结束释放；未运行任务时保留人工登录与退出。它只覆盖所列会话终止接口，普通业务 POST 不受此项约束；生命周期用例不在保持会话的业务生成范围内。

## 结论

本文档基于项目配置和入口文件自动草拟。真实外部接口、协议承诺、环境变量和生产配置必须后续人工确认。

## 接口概览

| 类型 | 位置 | 说明 | 后续处理项 |
|---|---|---|---|
| 项目入口/脚本 | package.json | 项目文件存在，具体用途待确认 |

## 配置项

| 配置 | 来源 | 作用 | 注意事项 |
|---|---|---|---|
| package.json | 项目文件 | 配置或元数据来源，具体键值待后续审查 | 不得写入真实密钥或生产配置 |

## 数据模型或协议

2026-09-25 REQ-0037 v9：`GET /api/health` 增加 `service_identity`、`accepting`、`preparing`、运行存储故障摘要；存储降级时仍可读取健康信息，新写请求返回 503，已有停止请求仍可到达执行器。执行中冲突返回 409。新增记录的 `service_identity` 为启动时捕获的版本指纹，不能用当前磁盘版本回填旧记录。自主开发任务增加 `failure={category,reason}` 与 `development.fidelity_review` 完整审查对象；`submission.fidelity_review` 保持文件路径。执行记录及报告以对象形式携带审查材料，材料不授予人工批准。

1. 自动扫描阶段未确认业务协议或外部 API 契约。
2. 如果项目包含 CLI、HTTP API、通信协议、数据库 schema 或配置字段，后续需求变更必须补充本节。

## 变更要求

1. 修改接口路径、请求字段、响应字段、错误码、配置项或环境变量时，同步本文档。
2. 涉及兼容性变化时，记录到 `05_decisions_log.md`。
3. 不在文档中写入真实密钥、账号或敏感生产地址。

2026-09-26 REQ-0001：新自测、最终验证和试跑记录增加 `timing_validation={required,complete,observations}`。每条观测包含原步骤/提示/范围、实际可见周期毫秒值和 PASSED/FAILED 原因；身份由步骤观察记录验证，不接受候选自报计时。缺失可信证据返回 `FROZEN_TIMING_REQUIREMENT_FAILED`，未解析时间要求拒绝执行；提交 ready 还要求本次同包自测时间证据完整。原历史记录不回填。
