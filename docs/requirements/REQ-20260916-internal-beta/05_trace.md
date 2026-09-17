# REQ-20260916-internal-beta 追踪

本次查询/计划修复：UN-1 → DR-2 → DD-2查询与未来行绑定增量 → T-A1/T-A4/T-A5 → VT-2工程子证据（query-capability、preparation、self-repair及原003固定浏览器回归）。真实模型复验另记，不改变原发布待验状态。

## 当前有效链路

当前准备调度增量：UN-1 → DR-2/DR-4/DR-5 → DD-8 → T-D1..T-D4 → preparation.test、preparation.integration、preparation-ui.integration与repair-contracts中的URL反例。工程子证据不改变原真实模型/独立操作/发布验收待确认状态。

- DR-2 → VT-2：取证/规划隔离、版本绑定及URL断言的工程子证据；真实模型项仍按原验收。
- DR-4 → VT-4：准备状态、设置和人工修订交互的工程子证据；独立人员验收另行判断。
- DR-5 → VT-5：预算/停止/历史消耗和脱敏的工程子证据；真实成本及发布完整性另行判断。

本轮UI顺序增量：UN-1 → DR-2/DR-4 → DD-7 → T-C1/T-C2/T-C3 → `tests/workflow.integration.mjs`、`tests/agent-output.integration.mjs`、`tests/console.integration.mjs`、`tests/model-flow.integration.mjs`。依据本地控制台操作与服务端确认状态判定步骤衔接，工作进程注入状态与真实演示执行分别记录。

本轮条件提示增量：UN-1 → DR-2/DR-4 → DD-2/DD-4条件动作/命中观察 → T-A1/T-A3/T-A4/T-A5 → tests/optional-dialog.test.mjs、tests/optional-dialog.integration.mjs、tests/optional-dialog-flow.integration.mjs及新版原例复验。各证据层次独立，原发布验收表不因工程成功改为已完成。

本轮增量：UN-1 → DR-2/DR-4 → DD-2/DD-4行内定位与按缺口修复 → T-A1/T-A2/T-A4/T-A5 → tests/row-locator.integration.mjs、tests/repair-contracts.test.mjs、tests/self-repair.test.mjs及原3例新版实测。当前为工程实施/验证，真实模型、独立人员试用及发布条件仍按下表分别判断。

| UN | DR | DD | TK | VT | 状态 |
|---|---|---|---|---|---|
| UN-1 | DR-1 | DD-1 | T-1 / T-4 | VT-1 | 部分验证 |
| UN-1 | DR-2 | DD-2 | T-3 | VT-2 | 真实模型未运行 |
| UN-1 | DR-3 | DD-3 | T-2 | VT-3 | 合成工程集成验证通过 |
| UN-1 | DR-4 | DD-4 | T-4 | VT-4 | 独立人员未试用 |
| UN-1 | DR-5 | DD-5 | T-5 | VT-5 | 待验候选，未发布 |

## 历史链路

当前续作：UN-1 → DR-2/DR-4 → DD-2/DD-4 登录/菜单与选填入口补充 → T-A3/T-A5 → tests/auth-menu-observation.integration.mjs、选填入口专项测试和 work/claude-supervision/20260916-autonomy/postfix-observation/summary.json。原fixture源及用例hash冻结；本地浏览器工程检查不能替代VT-2真实模型或VT-4独立人员试用。

本轮自主准备：UN-1 → DR-2/DR-4 → DD-2/DD-4 自主准备补充 → T-A1..T-A5（T-3/T-4子范围）→ `tests/adapter-program.test.mjs`、`tests/autonomous-evidence.test.mjs`、`tests/autonomous-preparation.integration.mjs`、控制台/诊断/探索联调。工程验证与原VT-2真实两轮及VT-4独立试用分开，未用模拟证据替代。

| 版本 | 链路 | 状态 | 说明 |
|---:|---|---|---|
| 1 | UN-1 → DR/DD/T/VT 各5项 | 计划已确认 | 用户授权实施，详细边界见 current_state.md |

## 当前增量链路（2026-09-17）

UN-1（复杂用例集可持续准备）→ DR-2/DR-4（按Case预算、续跑和可观测性）→ DD-6（分批预算状态机）→ T-B1..T-B4 → `tests/job-budget.test.mjs`、`tests/discovery-controller.test.mjs`、`tests/case-entry-url.test.mjs`、`tests/agent-output.integration.mjs`、`npm test`。这是本地工程验证链路；不替代VT-2真实模型或VT-4独立试用。
