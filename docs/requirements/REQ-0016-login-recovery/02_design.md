<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0016 设计

## 设计标识

| DD | 关联 DR | 状态 | 方案摘要 | 设计理由 |
|---|---|---|---|---|
| DD-0016-04 | DR-0016-04 | 已确认 | 采用Windows DPAPI CurrentUser、项目数据目录内加密文件及显式remember选择；独立测试辅助函数仅进入受信本机合成页面。 | 无新依赖，不以明文环境文件保存真实Key；子进程通过stdin传递，错误不回显敏感输出；损坏不自动覆盖。首次迁移不尝试读取旧进程私密字段。 |
| DD-0016-01 | DR-0016-01 | 已确认 | 区分连接与页面存活；同任务闭页可在原context恢复，context丢失重新打开；认证重新核验，准备中恢复有上限，不重放执行。 | 不接管其他标签页或其他任务，关闭清空内存证据。 |
| DD-0016-02 | DR-0016-02 | 已确认 | 等待登录时提供受同作业阶段限制的确认入口；过滤唯一可见小范围标志、拒绝登录挑战和跨源；确认续原prepare而不另起discover。 | 仅内存短时确认票据绑定页面及URL；不保存会话凭据、不因公开菜单自动成功。 |
| DD-0016-03 | DR-0016-03 | 已确认 | 主流程展示等待挑战、需确认、页面关闭/恢复等状态；确认错误保留表单并可重试；真实lab和反例完成自动化回归。 | 沿用现有样式，无新依赖；原24例/17文件和lab原预期不改。 |

## 接口与数据流

- 版本2：POST /api/config新增可选布尔remember，GET仅返回credential_storage supported/saved/error，不返回Key；DPAPI加密文件受Git忽略。scripts/autonomous-lab.mjs为维护入口，默认预检；显式真实模式才发送冻结合成资料，最多900调用/90分钟，写入仅prepare不自动批准。
- BrowserSession页面状态 -> Controller.view -> 主流程反馈。新增受CSRF和作业阶段限制的登录确认端点，短时票据只存内存。
- 原logout+navigation自动登录证据保留；无证据时等待一次人工选择标志，同prepare继续，不启动第二作业。

## 模块文档影响

- 更新 docs/modules/release_runtime.md 的页面生存期与登录确认接口边界。

## 风险与回滚

- 正式执行途中页面丢失仍停止，不自动重复业务动作。
- 恢复只访问原任务入口，不能保证丢失context后的sessionStorage仍存在；要求重新登录。
- 回滚本轮源码提交，不回滚/覆盖旧任务数据。运行版本切换只在无活动作业且可安全重启时进行，否则明确需人工重启。
