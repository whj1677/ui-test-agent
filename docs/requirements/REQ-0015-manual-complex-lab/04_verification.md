<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0015 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0015-01 | DR-0015-01 | 已确认 | 集成测试通过 | 多级导航、同名行分页、异步抽屉、嵌套弹窗、筛选日期与多步工单；可重复重置合成状态。 | 实际浏览器、原生导入器、只服务白名单与旧基线检查；非Agent实测结果。 | 命令：node --test --test-reporter=tap manual-lab/verify.test.mjs；退出码：0；测试数量：26；失败数量：0；跳过数量：0；证据：validation/REQ-0015-lab-second.log | node --test --test-reporter=tap manual-lab/verify.test.mjs | 0 | 26 | 0 | 0 | validation/REQ-0015-lab-second.log |
| VT-0015-02 | DR-0015-02 | 已确认 | 集成测试通过 | 18条有效、4条输入审查、2条已知UI缺陷；JSON可原生导入，步骤及预期对应冻结规格。 | 实际浏览器、原生导入器、只服务白名单与旧基线检查；非Agent实测结果。 | 命令：node --test --test-reporter=tap manual-lab/verify.test.mjs；退出码：0；测试数量：26；失败数量：0；跳过数量：0；证据：validation/REQ-0015-lab-second.log | node --test --test-reporter=tap manual-lab/verify.test.mjs | 0 | 26 | 0 | 0 | validation/REQ-0015-lab-second.log |
| VT-0015-03 | DR-0015-03 | 已确认 | 集成测试通过 | 实际浏览器逐场景核验站点、导入与安全自检，提供启动及分组操作步骤。 | 实际浏览器、原生导入器、只服务白名单与旧基线检查；非Agent实测结果。 | 命令：node --test --test-reporter=tap manual-lab/verify.test.mjs；退出码：0；测试数量：26；失败数量：0；跳过数量：0；证据：validation/REQ-0015-lab-second.log | node --test --test-reporter=tap manual-lab/verify.test.mjs | 0 | 26 | 0 | 0 | validation/REQ-0015-lab-second.log |
| VT-0015-04 | DR-0015-04 | 已确认 | 人工待确认 | 已实际执行24例：12通过12失败；分类为页面缺陷11例、用例自身错误1例，首次失败保留，非页面验收通过 | 真实Chromium操作与业务断言、逐例错误和媒体、Kimi来源哈希；非工作台Agent通过率。 | 命令：node workbench/qa/20260925-kimi-complex/verify.mjs；退出码：1；测试数量：24；失败数量：12；跳过数量：0；证据：workbench/qa/20260925-kimi-complex/evidence/2026-09-25T03-04-13-091Z/results.json | node workbench/qa/20260925-kimi-complex/verify.mjs | 1 | 24 | 12 | 0 | workbench/qa/20260925-kimi-complex/evidence/2026-09-25T03-04-13-091Z/results.json |

## 本轮命令与环境

- 工作目录：D:/01_AI工程/01_工程项目/ui-test-agent
- 命令：node --test --test-reporter=tap manual-lab/verify.test.mjs
- 命令：node acceptance/check.mjs
- 命令：node workbench/qa/20260925-kimi-complex/verify.mjs
- 环境：Windows Node22，Playwright Chromium，临时loopback端口与独立浏览器上下文；无外部网络请求。

## 结论

- 修正后26项夹具检查0失败/跳过；18有效用例、4输入审查、2已知页面缺陷包均可导入。
- 1440/375px与双层弹窗截图已查看；原17文件/24例冻结检查不变。
- 只验证新网站/用例，不运行Agent/DeepSeek、不修改4179或旧任务，不发布Release。
- 常驻后台4196启动被执行策略拒绝且未换路径重试；用户通过README前台命令启动，临时验证服务器已结束。
- v2首轮24例退出1：12通过12失败；正常表单/单设备预约/取消可用，但默认筛选、重置、批量记录金额与详情串对象存在问题。未修页面或原预期。
- 正式检查仍有2项：历史26项集成测试通过与本轮12项失败同文时，现有检查器按全文混判；已保留最小复现，未修改检查器或旧成绩。
