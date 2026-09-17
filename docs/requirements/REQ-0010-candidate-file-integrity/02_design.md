<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0010 设计

## 设计标识

| DD | 关联 DR | 状态 | 方案摘要 | 设计理由 |
|---|---|---|---|---|
| DD-0010-01 | DR-0010-01 | 已确认 | 共享明确的交付集合 | 共用构建集合加试用说明，不扫描数据或凭据。 |
| DD-0010-02 | DR-0010-02 | 已确认 | 路径与逐文件核验 | 本地静态完整性，不是签名或恶意并发文件系统安全保证。 |
| DD-0010-03 | DR-0010-03 | 已确认 | 区分缺清单与缺文件 | 不新增启动配置、候选标记或服务协议，不改旧任务。 |
| DD-0010-04 | DR-0010-04 | 已确认 | 限定验证和同步 | 新目录不等于干净Windows，不替代真实模型/独立人员/最终发布；不重启4179。 |

## 接口与数据流

- readBuildInfo+试用说明→固定交付集合；inspectEnvironment读取存在的清单→元数据/集合→路径链及普通文件→实际摘要→完整性状态。
- 清单存在后的文件错误统一为完整性失败，不将缺交付文件的ENOENT传入源码模式分支。

## 模块文档影响

- src/distribution.mjs、src/installation.mjs、tests/release-integrity.test.mjs、tests/release-package.integration.mjs与docs/modules/release_runtime.md；无UI/API/迁移变化。

## 风险与回滚

- 摘要不是签名，不保证恶意并发置换/已篡改程序，不覆盖安装后node_modules和浏览器。
- 独立提交可定位回退；测试只操作新建隔离目录，保留旧服务/任务/失败日志。清单本身不存在仍维持源码模式。
