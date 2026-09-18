<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0016 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0016-01 | DR-0016-01 | 已确认 | 集成测试通过 | 区分连接与页面存活；同任务闭页可在原context恢复，context丢失重新打开；认证重新核验，准备中恢复有上限，不重放执行。 | 本机隔离Chromium/Controller与UI测试；真实命令、退出码、非零统计、日志。 | 命令：node --test --test-reporter=tap tests/login-recovery.integration.mjs tests/auth-menu-observation.integration.mjs tests/autonomous-preparation.integration.mjs manual-lab/verify.test.mjs；退出码：0；测试数量：47；失败数量：0；跳过数量：0；证据：validation/REQ-0016-integration-final.log | node --test --test-reporter=tap tests/login-recovery.integration.mjs tests/auth-menu-observation.integration.mjs tests/autonomous-preparation.integration.mjs manual-lab/verify.test.mjs | 0 | 47 | 0 | 0 | validation/REQ-0016-integration-final.log |
| VT-0016-02 | DR-0016-02 | 已确认 | 集成测试通过 | 等待登录时提供受同作业阶段限制的确认入口；过滤唯一可见小范围标志、拒绝登录挑战和跨源；确认续原prepare而不另起discover。 | 本机隔离Chromium/Controller与UI测试；真实命令、退出码、非零统计、日志。 | 命令：node --test --test-reporter=tap tests/login-recovery.integration.mjs tests/auth-menu-observation.integration.mjs tests/autonomous-preparation.integration.mjs manual-lab/verify.test.mjs；退出码：0；测试数量：47；失败数量：0；跳过数量：0；证据：validation/REQ-0016-integration-final.log | node --test --test-reporter=tap tests/login-recovery.integration.mjs tests/auth-menu-observation.integration.mjs tests/autonomous-preparation.integration.mjs manual-lab/verify.test.mjs | 0 | 47 | 0 | 0 | validation/REQ-0016-integration-final.log |
| VT-0016-03 | DR-0016-03 | 已确认 | 集成测试通过 | 主流程展示等待挑战、需确认、页面关闭/恢复等状态；确认错误保留表单并可重试；真实lab和反例完成自动化回归。 | 本机隔离Chromium/Controller与UI测试；真实命令、退出码、非零统计、日志。 | 命令：node --test --test-reporter=tap tests/login-recovery.integration.mjs tests/auth-menu-observation.integration.mjs tests/autonomous-preparation.integration.mjs manual-lab/verify.test.mjs；退出码：0；测试数量：47；失败数量：0；跳过数量：0；证据：validation/REQ-0016-integration-final.log | node --test --test-reporter=tap tests/login-recovery.integration.mjs tests/auth-menu-observation.integration.mjs tests/autonomous-preparation.integration.mjs manual-lab/verify.test.mjs | 0 | 47 | 0 | 0 | validation/REQ-0016-integration-final.log |

## 本轮命令与环境

- 工作目录：D:/01_AI工程/01_工程项目/ui-test-agent
- 命令：node --test --test-reporter=tap tests/login-recovery.integration.mjs
- 命令：node tests/runtime-regression.mjs
- 命令：node tests/console.integration.mjs
- 命令：node tests/workflow.integration.mjs
- 环境：Windows Node22+ Playwright；隔离合成网站、临时数据；不调用真实模型。

## 结论

- 47项合成集成检查完成（11项新登录、10项既有登录/自主准备、26项lab自检），0失败/0跳过；不混加为业务用例数。
- 原控制台合成演示执行/报告测试完成；更新后的流程UI验证完成，模型请求0。桌面1440与375窄屏确认弹窗截图已查看，键盘确认可用。
- 最终源码构建0ce696aba972的非暂停回归647项完成，0失败/0跳过；日志 validation/REQ-0016-runtime-frozen.log。原冻结24例/17文件的清单与基线检查仍满足。
- 曾复现确认期间路由/验证码变化仍认证的2项失败，已增加发布认证前重验并由上述47项复验。初次扩展回归发现1处错误码顺序与2处旧夹具直接在私密输入页确认的setup冲突；修正顺序，夹具改为先首页确认再进入原业务页面，原隐私断言不变。
- 测试使用临时隔离数据与本机合成站点，未调用真实DeepSeek；产品控制器在验证交接后由注入provider主动报SYNTHETIC_LOGIN_HANDOFF_END，不能算模型规划成功。
- 4179仍运行653a95ecb090旧构建，未关闭或重启，旧任务未操作；本轮源码构建0ce696aba972待用户正常停止/启动后生效。模型Key只在内存，重启后需本机重连。
- 最终流程UI日志 validation/REQ-0016-workflow-v4.log：prepare、prepare、run三次显式作业，真实模型请求0；首次等待允许原位确认，二次准备模拟已认证规划。
