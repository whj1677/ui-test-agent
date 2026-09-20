<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0017 当前状态

- 需求标题：受控ReAct只读主流程与完整检查

## 元数据

- 需求状态：已确认
- 治理分级：G3
- 当前版本：35
- 最后更新：2026-09-20

## 当前有效用户需求

| UN | 状态 | 内容 |
|---|---|---|
| UN-0017-01 | 已确认 | 只读列表/查询/分页/详情自主完成操作和完整检查，技术缺口有界恢复，不依赖外部Code Agent现场救场。 |

## 当前有效开发需求

| DR | 状态 | 内容 |
|---|---|---|
| DR-0017-01 | 已确认 | 业务合同与完整检查 |
| DR-0017-02 | 已确认 | 结构化缺口与有界ReAct恢复 |
| DR-0017-03 | 已确认 | 执行时观察与受控技术绑定 |
| DR-0017-04 | 已确认 | 主流程状态与证据 |
| DR-0017-05 | 已确认 | 冻结正反例与独立验证 |

## 当前有效设计

| DD | DR | 状态 | 内容 |
|---|---|---|---|
| DD-0017-01 | DR-0017-01 | 已确认 | 业务合同与完整检查 |
| DD-0017-02 | DR-0017-02 | 已确认 | 版本22扩展现有table_unchanged来源识别：明确表格/列表内容与本步骤操作前完全一致/相同，以及未应用条件，同一函数用于提前捕获、计划来源和完整覆盖。排除否定/条件/例子/选择分支、上一步/历史/操作后/外部标准和仅记录数关系；不一般性解释任意同义词。运行器基线绑定、实际矩阵比较和差异不重试保持，不能事后捕获或用当前固定值代替关系。v20审查反馈/旧来源守卫继续保持。 版本23新增aria_selected布尔测量限role=tab且显式true/false；selected_label仍限SELECT。现场类型不匹配在派发前定向纠错，不点击页签制造预期，缺失状态技术失败，真实未选中为差异。 版本24新增受限table_order关系，当前原步骤字段/方向与技术列绑定分离，完整原生矩阵同次采样当前页单调顺序。数字同单位/15有效位，无转换；等宽同前缀编号不猜排序规则。至少2行，真实逆序一次采样失败；不替代精确位置/字段/数量/跨页义务。 版本25检查点私有关系字幕队列：每个动作后原基线比较和事实持久化仍立即进行；最终业务组在原deadline采样后再播放字幕，异常也排空且字幕故障仅证据部分，不覆盖业务错误；不重放动作、不扩时。 版本26共享证据来源约束语义，候选只读语法目录区分自身字段/列/整区域/标题；即使干扰值出现不等于要求其出现，显式正向备注义务仍须测量。标签不代表DOM验证，来源、审查及执行比较保持。 版本27仅自适应完成态要求有限明确可见/关闭条款的实际必要测量：可见X即使的X单独visible，原关闭动作绑定的同dialog须hidden或count0；字段/点击/背景列表不能代替。否定/条件/示例/未支持表达不由此推定，独立审查仍负责全部语义。 版本28当前步骤肯定字面切换页签时，aria_selected=true须在同目标click之后，按checkpoints顺序且部分候选同样校验；默认/初始/明确前态不重解释。仅必要时序，实际选中值不参与补造预期或重试决定。 版本29：明确实际排序原文须有表体关系证据，控件选中状态不能单独作为排序验收；限定肯定来源语法、同义务table_order或完整有序原值矩阵，不猜对象、不重放业务动作。 版本30完整业务行聚合文本不得替代原字段/AND义务；候选结构及当前DOM真实行只读检查、严格原整行字面意图例外、精确恢复及证据域指导，不归一化伪造预期或重放。 版本31：明确AND原义务的支持字面输入，要求当前步骤同表同记录每个条件的必要字段测量；原明确空结果允许实际空表。最多8条件、未知匹配语义保留缺口，不猜预期、不借未来步骤、不跨记录拼凑。结构检查不授予最终语义或总体证明，原审查/预算保持。 版本32：明确当前第N页缺总数时，用独立当前页码文字的原N最小有边界比较，不能用记录ID或观察总数代替；肯定明确N/T沿用原覆盖，历史/条件/导航控件不抹除当前页要求。当前DOM别名只读检查，固定路径不变，原比较/预算/不重放保持。 版本33：内部空收尾候选按本步骤已成功测量目标/谓词/预期的去重集合至多一次，真正新测量后可再次全审，重复/仅来源重贴不解锁。只有控制器自产候选的拒绝键带证据指纹，模型不能提供该元数据；原完整校验、独立最终审查、2次纠错/8段/期限不变。 版本34：当前候选断言有效性与整个义务覆盖分离；缺乏明确支持的当前断言追加至多一次同预算语义核验，已知反向/不确定/格式错误拒绝未执行片段，合法局部SUPPORTED不升级MISSING。 版本35：将明确位置区间的原身份逐项映射到绝对行号，既有position比较/来源事实/完成守卫共用，不用relative顺序代替。位置范围不是全表数量，模糊已识别范围保留技术缺口，不从现场补造。 |
| DD-0017-03 | DR-0017-03 | 已确认 | 执行时观察与受控技术绑定；版本11新增scope内原生唯一dt/dd只读字段定位definition，禁止动作/跨域/值反选。 |
| DD-0017-04 | DR-0017-04 | 已确认 | 主流程状态与证据 |
| DD-0017-05 | DR-0017-05 | 已确认 | 版本21独立留出8例：Kimi仅基于新合成真值著作HTML与用例，无产品源码/旧测试输入。冻结前核对作者错项并记录，冻结后不按Agent失败改原题。固定4198、六资产SHA和原11资产同时核验，heldout独立suite保持all原32；server不暴露答案/源码，模型只得该组原用例及现场观察。无登录站点只用首页标记建立会话，不为Agent提供业务定位器/计划；全部只读，共享调用/期限与官方供应商保持。参考18场景和工程注入不计产品，真实正常完成/指定差异/技术失败分开。 |

## 当前有效任务

| TK | DR/DD | 状态 | 内容 |
|---|---|---|---|
| TK-0017-01 | DR-0017-01 / DD-0017-01 | 已实现 | 业务合同与完整检查 |
| TK-0017-02 | DR-0017-02 / DD-0017-02 | 进行中 | 版本35已实现：原范围身份映射绝对行位置，范围终点不再授权全表数量；301项受影响工程0失败/取消/跳过，129233.5435ms，v35-regression.log。34项定向已含其中不相加。原错误候选不派发、实际错位仍差异、重复候选有界停止，原导航不重放。官方模型原V01待冻结单轮，原3两整轮及迁移/写入清理未完成。 |
| TK-0017-03 | DR-0017-03 / DD-0017-03 | 已实现 | 版本11实现没有HTML属性的原生dt/dd只读definition绑定，含重名/诱饵/错位及未修改manual-lab验证；真实产品效果另列。未来写入绑定仍待修复。 |
| TK-0017-04 | DR-0017-04 / DD-0017-04 | 已实现 | 版本10同步登录后的父阶段，当前prepare/run使用对应界面流程；失败状态、原事实与未执行边界保持。 |
| TK-0017-05 | DR-0017-05 / DD-0017-05 | 进行中 | 已调试独立8转回归，未来另留未调试迁移集；累计33完成官方轮2528调用/12837153ms，v34 V02单例完整但未触发新细粒度分支。先修V01范围位置再原3同构建两整轮；写入清理及其他原32能力仍未完成。 |

## 当前有效验证项

| VT | DR | 状态 | 内容 | 当前证据 |
|---|---|---|---|---|
| VT-0017-01 | DR-0017-01 | 集成测试通过 | 业务合同与完整检查 | 命令：node --test --test-concurrency=3 tests/definition-fields.test.mjs tests/adaptive-review.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-protocol.test.mjs tests/plan-quality.test.mjs tests/semantic-scope.test.mjs tests/adaptive-semantic-boundary.test.mjs；退出码：0；测试数量：199；失败数量：0；跳过数量：0；证据：validation/req0017/v11-fields-regression.log |
| VT-0017-02 | DR-0017-02 | 集成测试通过 | 结构化缺口与有界ReAct恢复 | 命令：node --test --test-concurrency=2 tests/range-position.test.mjs tests/range-position.execution.test.mjs tests/adaptive-position-reset.test.mjs tests/adaptive-position-recovery.test.mjs tests/adaptive-prefix-cardinality.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-capabilities.test.mjs tests/adaptive-source-recovery.test.mjs tests/table-assertion.test.mjs tests/table-observation.test.mjs tests/partial-assertion-review.test.mjs tests/partial-assertion-review.execution.test.mjs tests/adaptive-completion-evidence.test.mjs；退出码：0；测试数量：301；失败数量：0；跳过数量：0；证据：validation/req0017/v35-regression.log |
| VT-0017-03 | DR-0017-03 | 集成测试通过 | 执行时观察与受控技术绑定 | 命令：node --test --test-concurrency=3 tests/definition-fields.test.mjs tests/adaptive-review.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-protocol.test.mjs tests/plan-quality.test.mjs tests/semantic-scope.test.mjs tests/adaptive-semantic-boundary.test.mjs；退出码：0；测试数量：199；失败数量：0；跳过数量：0；证据：validation/req0017/v11-fields-regression.log |
| VT-0017-04 | DR-0017-04 | 集成测试通过 | 主流程状态与证据 | 命令：node --test --test-concurrency=3 tests/definition-fields.test.mjs tests/adaptive-review.test.mjs tests/adaptive-plan.test.mjs tests/adaptive-protocol.test.mjs tests/plan-quality.test.mjs tests/semantic-scope.test.mjs tests/adaptive-semantic-boundary.test.mjs；退出码：0；测试数量：199；失败数量：0；跳过数量：0；证据：validation/req0017/v11-fields-regression.log |
| VT-0017-05 | DR-0017-05 | 人工待确认 | 冻结正反例与独立验证 | 命令：node --test --test-concurrency=2 tests/heldout-lab.test.mjs tests/autonomous-lab.test.mjs heldout-lab/reference.test.mjs；退出码：0；测试数量：25；失败数量：0；跳过数量：0；证据：validation/req0017/v21-final-regression.log |

## 人工待确认项

- [ ] 版本10首批状态、批次隔离和部分字段观察修复完成1212项工程回归；真实新32例尚未完整复验。导航路径否定、整区域误断言、范围声明、120秒期限、负向遮挡和未来写入绑定仍待解决，不因工程项通过声称全部修复。免重复Key与合成登录基础见REQ-0016版本2，初次迁移已完成。
- [ ] 版本9验证已收口，但完整业务覆盖未达到：32条均尝试相应流程，6准备失败无正式执行，新故障对照未触及故障目标。434调用/83分3.715秒，未使用扩时。BLOCK_NOW：字段级采集/绑定、合法入口及同名作用域、范围声明与预期区分、一动作往返与120秒期限冲突、父/子任务状态不同步、单例JSON错误终止批次、写入未来页面预绑定限制。运行源码保持冻结，须按通用能力修复后复验，不改旧结果或原预期。
- [ ] VALIDATE：版本8本轮3/3不证明重复稳定性。真实模型未提出额外row_count，因此新的提前拒绝/纠错分支仅有工程注入反例证据；应另行故障对照验证详情整区域contains在错字段或诱饵值下不会误报，不能从当前正常页面推断该能力。
- [ ] 历史版本8：用户“再进行一轮测试吧”授权的一轮100调用/15分钟已使用，实际78调用/521.384秒；当时已结束。版本9扩大验证依最新明确请求另行建账，未续用或篡改版本8记录。
- [ ] VALIDATE（历史版本6发现）：无活动测试时login-confirmation会自动走旧探索入口；当时停止该分支并计入4次调用。当前版本7复测未走该分支，未在冻结版本中顺便修改登录流程。

## 本轮禁止实现内容

- 不得修改冻结用例/预期/选集换取通过。
- 不得任意代码执行、未知写入、未知派发重放、跨对象修定位、跨时刻拼同时证据。
- 不得把模型审查/预置计划/注入回复/回放/工程测试计为自主产品验收。
