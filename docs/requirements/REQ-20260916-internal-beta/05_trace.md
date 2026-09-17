# REQ-20260916-internal-beta 追踪

## 当前有效链路

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
