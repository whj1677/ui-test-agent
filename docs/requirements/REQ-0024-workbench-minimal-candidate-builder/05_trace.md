<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0024 追踪

## 当前有效链路

| UN | DR | DD | TK | VT | 状态 |
|---|---|---|---|---|---|
| UN-0024-01 | DR-0024-01 | DD-0024-01 | TK-0024-01 | VT-0024-01 | 已完成 |
| UN-0024-01 | DR-0024-02 | DD-0024-02 | TK-0024-01 | VT-0024-01 | 已完成 |
| UN-0024-01 | DR-0024-03 | DD-0024-03 | TK-0024-02 | VT-0024-02 | 已完成-工程范围 |
| UN-0024-01 | DR-0024-04 | DD-0024-04 | TK-0024-03 | VT-0024-03 | 已完成 |
| UN-0024-01 | DR-0024-02 | DD-0024-05 | TK-0024-01 | VT-0024-01 | 已完成 |
| UN-0024-01 | DR-0024-05 | DD-0024-05 | TK-0024-05 | VT-0024-05 | 已完成-工程范围 |
| UN-0024-01 | DR-0024-01 | DD-0024-01 | TK-0024-04 | VT-0024-04 | 受阻 |
| UN-0024-01 | DR-0024-03 | DD-0024-03 | TK-0024-06 | VT-0024-06 | 已完成-既有候选技术复验 |

## 历史链路

| 版本 | 链路 | 状态 | 说明 |
|---:|---|---|---|
| 1 | 无 | 实现中 | 从M2-B已验证原语建立固定合成任务的最小Web建例入口 |
| 2 | workbench/docs/M2C_ACCEPTANCE_REPORT.md | 部分实现-真实集成中断 | 工程验证通过；真实初始建例中断且无候选，未把剩余额度改作第二次初始调用。 |
| 3 | workbench/docs/M2C_INTERRUPTION_DIAGNOSTIC.md | 部分实现-中断诊断已补齐 | 不改写历史中断；增加事件时生命周期、exit/close收尾、存储失败关闭和零模型外部进程验证。 |
| 4 | workbench/docs/M2C_REVALIDATION_REPORT.md | 部分实现-单次复验C类收口 | 独立授权1/1已消耗；真实新任务因复验驱动误判旧历史终态而被取消，无候选和双验证；修复后不重跑。 |
| 5 | workbench/docs/M2C_REVALIDATION_WAIT_TEST_REVISION.md | 部分实现-单次复验C类收口 | 只补准终态等待测试：直接观察pending并用旧任意历史卡片扫描逻辑作预期失败对照；未调用Harness。 |
| 6 | workbench/docs/M2C_WAIT_FIX_VALIDATION_REPORT.md | 部分实现-真实候选验证失败 | 新独立授权完成真实Web提交与Harness候选生成；正常和反例均因Playwright Test双实例重复加载而零测试，无媒体、修订或替补调用。 |
| 7 | workbench/docs/M2C_PLAYWRIGHT_RUNTIME_FIX_REVALIDATION.md | 部分实现-既有候选技术复验通过 | 不调用Harness或模型；统一workbench Playwright运行根后，原候选正常通过、反例取得指定断言差异且两边三类媒体齐全。原B类任务和Web展示保持。 |
