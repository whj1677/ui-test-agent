<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0010 用户需求

## 原始输入

> 承接REQ-0001原目标：“把这个agent优化到你认为可以发布的地步”“这中间有问题你需要修复”“同时修改前要创建需求包”。本包登记实际复现的完整性漏检，不扩展为公开发布。

## 结构化理解

| UN | 状态 | 目标 | 约束 | 成功标准 |
|---|---|---|---|---|
| UN-0010-01 | 已确认 | 候选包损坏须被自检发现，不能误报摘要一致。 | 限定修复，保留源码启动、原数据/用例及发布边界。 | 完整与损坏包正反例及安装维护证据，逐问题Git同步。 |

## 已确认事实

- 状态卡：阶段=正式实现；唯一目标=现有manifest完整性核验；输入=损坏反例和分发/自检源码；交付=限定修复/测试/需求/提交；不做=签名、知识库、多步审批、真实模型、旧服务重启；停止=本包验证同步或真实阻塞。
- 修改前在validation/package-integrity-probe-20260918-01创建完整候选并只改复制的试用说明标题；原说明未动。inspectEnvironment仍返回候选包摘要ready:true、与打包时一致。断言期望false实际true，退出1；validation/release-package-handbook-before.log。
- manifest含全部交付文件SHA256，installation只比较build_id；试用说明不在runtime build摘要中，故损坏漏检。
- 本轮真实模型调用0；不绕过工具策略，不改冻结17文件24用例。
- 修复后对同一损坏副本再次调用inspectEnvironment，候选包摘要ready:false，退出0；日志validation/release-package-handbook-after.log。修复前反例保留，未修改副本来消除损坏。
- 正反例及原安装维护组合53项（含48项新增TAP检查），0失败/跳过；完整非暂停程序564项，0失败/跳过，53包含在564内，不重复相加。日志validation/REQ-0010-first.log及REQ-0010-runtime.log。
- 新候选validation/REQ-0010-package-20260918-01，build=14c2bda0aa6a35ad84495c36ae9ebc46faa8c5a931238b1528a3178b5748843e，保持PENDING_ACCEPTANCE。实际运行复制的安装.ps1，新npm依赖、独立.browsers完整下载、专用Python venv均成功；doctor五项就绪，退出0，validation/REQ-0010-install.log。Python下载使用本机pip缓存，本机已有Node/Python，不算干净Windows。
- 包内环境检查、启动、同实例复用、正常停止、停止后备份共5次PowerShell命令均退出0；完整页面HTTP200、未配置模型、构建/数据目录身份一致、锁释放、合成备份SHA一致、包摘要未改。独立脚本联调1份，不把5命令算5业务用例；validation/REQ-0010-package-smoke.log及validation/package-smoke-STnVjw/summary.json。
- 现有启动器5场景复验退出0：拒绝旧身份/异构建/异数据目录且原模拟服务存活、新启动同实例复用、正常停止。validation/REQ-0010-launcher.log及validation/launcher-1789666014064/summary.json。
- 原17文件24用例冻结摘要核验未变；无真实模型调用、无4179重启或旧任务写入。

## 推断与待确认

- 先比对白名单集合再读路径，避免manifest驱动任意外部读取。
- 同时修改manifest及程序不在摘要保证内；正式发布门槛仍独立。
