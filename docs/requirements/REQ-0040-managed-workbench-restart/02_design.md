<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0040 设计

## 设计标识

| DD | 关联 DR | 状态 | 方案摘要 | 设计理由 |
|---|---|---|---|---|
| DD-0040-01 | DR-0040-01 | 已确认 | 原launcher派生Node supervisor，父子私有IPC握手；supervisor保存原环境并持有自己派生的child。 | 无需新端口、命名管道或持久控制令牌，不依赖用户机器固定路径。 |
| DD-0040-02 | DR-0040-02 | 已确认 | 现有4322的POST /api/service/restart；同源JSON、实例身份、mutation在途计数与manager忙碌同步判定并锁住入场。 | 复用本地安全边界，同时封闭请求已进入await而manager尚未starting的并发空隙。 |
| DD-0040-03 | DR-0040-03 | 已确认 | 产品入口显示托管能力；用户确认后单次POST，有界轮询实例及数据/配置身份。 | 断线和旧健康响应不能算恢复成功。 |
| DD-0040-04 | DR-0040-04 | 已确认 | 仅明确重启且drain成功、child退出后启动一次；正常关闭或异常退出不触发自动重试。 | 避免重复模型消费、重复业务写入与未知进程影响。 |

## 接口与数据流

- 原launcher → supervisor → owned child → GET health托管状态；同源POST携带实例ID → 原子空闲锁 → IPC安排 → 202完成 → drain → child退出 → 新child → 新身份且原数据配置核验。

## 模块文档影响

- workbench-case-library模块补充托管启动/重启行为；不更改用例、DSH预算或业务预期。

## 风险与回滚

- 内存认证会话会随重启关闭，需要重新连接；持久数据和凭据配置不迁移。
- 旧实例无法追认为owned child；当前policy拒绝不以新机制绕过。
- 失败保留终态诊断，不自动杀进程或重复启动；源码可回退原launcher直启方式。
