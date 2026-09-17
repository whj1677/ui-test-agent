<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0007 用户需求

## 原始输入

> REQ-0001用户发布目标的限定缺陷子包：修改前建需求，实际测试驱动修复，逐修复Git同步；不把密钥或用户业务原文写入包。

## 结构化理解

| UN | 状态 | 目标 | 约束 | 成功标准 |
|---|---|---|---|---|
| UN-0007-01 | 已确认 | 探索能够使用原用例指定的普通查询表单，不因按钮采用submit而要求人工代筛选。 | 维持非生产、网络、审批与原期望边界；不开放向导下一步、保存、CRUD提交。 | 限定查询通过真实Chromium产品能力验证，反例正确阻止，冻结用例不修改。 |

## 已确认事实

- 当前queryScopeFacts仅识别type=button；DiscoveryBrowser候选和事件层均拦截submit。
- 冻结工单与申请站筛选区是默认GET form和submit查询按钮；原字面查询无法生成输入/查询候选。REQ-0006失败日志保留这一前置缺口。
- REQ-0006/f4a6de3与父进展90d017c已同步；本包不扩大上一包阅读能力、不修改冻结资产。
- 修复前两站查询组件检查均失败于输入候选缺失，validation/REQ-0007-before.log保留。首版基本查询成功后，新增原句后续改值和观察后同值换字段反例再次暴露缺陷；两个实际问题使7项TAP出现3失败（含父项），日志REQ-0007-counterexamples-before.log未删除。
- 修复后专项和原查询能力组合命令node --test tests/query-forms.test.mjs tests/query-capability.test.mjs，退出0，57项、失败0/跳过0，validation/REQ-0007-verified.log。只验证冻结两站查询段及隔离组件，不是完整WORK/REQS用例自主运行。
- Kimi仅收通用最小设计摘要，session_44ab73af-e1a3-4ff3-85d1-a21ed73b4d87，无工具/源码/业务资料/Key。采纳submit终验、拒绝按钮覆盖属性、字段歧义/禁用/默认值反例；不采纳直接试探click或手工拼GET，因为会扩大未知处理器执行或改变页面行为。意见不是验收。
- 最终代码复核新增命名控件遮蔽DOM方法反例：点击时将name改为getAttribute，旧检查抛错但本机模拟submit处理器执行1次，REQ-0007-clobber-reproduction.log保留；guard内部异常转false后同反例处理器0次、DISCOVERY_DISPATCH_BLOCKED，REQ-0007-clobber-verified.log。此前474全量通过只是中间版，不冒充最终结论。
- 否定前缀别在/不在输入也曾被绑定；REQ-0007-negative-source-before.log保留失败。引号外否定动作保守拒绝后，原文/协议/方法遮蔽3项复验退出0，REQ-0007-last-counterexamples.log。正向原文解析为有限保守语法，不支持任意自然语言或同义改写。
- 冻结产品版本程序回归476项、退出0、失败0/跳过0（validation/REQ-0007-runtime-release.log）；3个Chromium集成文件6项TAP同为0失败/跳过（REQ-0007-integration-release.log）。专项与工程集合重叠不相加，既有24例17文件摘要再次核验不变。

## 推断与待确认

- 受控查询需要不同于业务提交的能力，名称和GET只提供保守资格，不证明黑盒处理器无副作用。
- 原句省略引号的查询动词可按固定语法绑定，但不得当任意同义词推断；必须有同句字段原值。
- 多步表单/读取失败重试等剩余问题独立，不用本包测试冒充其完成。
