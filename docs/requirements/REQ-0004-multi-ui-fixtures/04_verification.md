<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0004 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0004-01 | DR-0004-01 | 已确认 | 集成测试通过 | 24例输入/分类/原文保留 | 原8摘要完全一致，24唯一CaseID，可通过现有导入器；不更改期望适配结果。 | 命令：node --test tests/acceptance-fixtures.test.mjs tests/acceptance-fixtures.integration.mjs；退出码：0；测试数量：32；失败数量：0；跳过数量：0；证据：validation/REQ-0004-reference.log | node --test tests/acceptance-fixtures.test.mjs tests/acceptance-fixtures.integration.mjs | 0 | 32 | 0 | 0 | validation/REQ-0004-reference.log |
| VT-0004-02 | DR-0004-02 | 已确认 | 集成测试通过 | 多结构页面行为 | 每站有正常和错误路径，重复名称/按钮及遮挡保留；写入仅隔离合成服务器，精确对象清理有旁证。 | 命令：node --test tests/acceptance-fixtures.test.mjs tests/acceptance-fixtures.integration.mjs；退出码：0；测试数量：32；失败数量：0；跳过数量：0；证据：validation/REQ-0004-reference.log | node --test tests/acceptance-fixtures.test.mjs tests/acceptance-fixtures.integration.mjs | 0 | 32 | 0 | 0 | validation/REQ-0004-reference.log |
| VT-0004-03 | DR-0004-03 | 已确认 | 集成测试通过 | 独立参考/反例及视觉检查 | 有真正浏览器操作、断言、异常/失败反例和截图；不使用手写计划注入Agent。 | 命令：node --test tests/acceptance-fixtures.test.mjs tests/acceptance-fixtures.integration.mjs；退出码：0；测试数量：32；失败数量：0；跳过数量：0；证据：validation/REQ-0004-reference.log | node --test tests/acceptance-fixtures.test.mjs tests/acceptance-fixtures.integration.mjs | 0 | 32 | 0 | 0 | validation/REQ-0004-reference.log |
| VT-0004-04 | DR-0004-04 | 已确认 | 集成测试通过 | 冻结清单与提交 | 清单可检查漂移、原样本哈希不变；秘密扫描无命中；测试结果与最终文件同版。 | 命令：node --test tests/acceptance-fixtures.test.mjs tests/acceptance-fixtures.integration.mjs；退出码：0；测试数量：32；失败数量：0；跳过数量：0；证据：validation/REQ-0004-reference.log | node --test tests/acceptance-fixtures.test.mjs tests/acceptance-fixtures.integration.mjs | 0 | 32 | 0 | 0 | validation/REQ-0004-reference.log |

## 本轮命令与环境

- 工作目录：D:/01_AI工程/01_工程项目/ui-test-agent
- 命令：node --test tests/acceptance-fixtures.test.mjs
- 命令：node --test tests/acceptance-fixtures.integration.mjs
- 命令：node tests/runtime-regression.mjs
- 环境：Windows/Node22/Chromium；本机临时端口；不调用模型

## 结论

- 同版参考32项/0失败/0跳过：24条参考行为（权限2条仅可达性和无副作用）、7项摘要/导入/HTTP/CRUD检查、1项两站三尺寸视觉检查；不代表Agent自主结果。
- 17文件摘要冻结，原8页面/用例摘要不变；12张桌面/窄屏/短屏截图，主管抽检7张无裁切和遮挡错误；不改变3处预置产品差异。
- 初轮失败保留在REQ-0004-reference-initial.log：参考脚本未判断已展开的侧栏，误点击收起。另首次Host反例使用fetch被规范化，已改原生HTTP实际发送；未改用例期望或夹具业务规则。
- 现有非暂停工程回归397项/0失败/0跳过，日志validation/REQ-0004-runtime.log；与参考集重叠7项，不相加汇报。
- 真实模型/干净Windows和独立用户验收仍未完成；本包不作发布判断。
