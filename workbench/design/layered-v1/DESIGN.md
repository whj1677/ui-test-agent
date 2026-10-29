# UI 测试 Agent 分层方案（L0/L1/L2/L3）

- 版本：v1.0（方案稿）
- 日期：2026-10-15
- 依据：`workbench/qa/20261014-native-dsh-integration`（008/009 真实失败证据）、`workbench/qa/20261015-electricity-first10`（10 条真实通过 + 交互坑位实测）
- 性质：设计提案与接口骨架。骨架代码位于 `workbench/design/layered-v1/`，是形状示例，不是可直接运行的完整实现。

## 0. 要解决的问题

现状（native-dsh 路径）把三类寿命不同的知识放进同一个 markdown 文件 `page-facts.md`，并用「文件是否存在」当门禁：

- `manager.mjs:125` 要求复用 `page-facts.md` 避免逐条重新探索；
- `run.mjs:22` 只检查 `filesystem.stat('page-facts.md')`，`FIRST_CASE_FACTS_MISSING`。

后果（有据可查）：

1. **未验证假设被当作已验证事实传播。** `tests/lib/price-template.mjs:98` 的 `page.locator(NAME_INPUT).first()` 会命中列表页背景筛选框（全页存在两个 `#form_item_name`，placeholder 相同）。它先让 008 三次失败，再被 009 原样继承，009 在 82.9 秒进入首测后立刻死在同一行。
2. **同一层内判据自相矛盾。** 同一份库 `activeProvince()` 用 `offsetParent !== null`（`:168`），`modalState()` 用 `style.display !== 'none'`（`:286`）。`offsetParent` 对 `position:fixed` 元素恒为 `null`，这是本次实测中被截图纠正过的真实误判来源。
3. **探索与用例共用预算。** 008 任务约 30 分钟上限内，模型自写 CDP 探针未清理 60 秒计时器，8 次探针约 493 秒；真正走到业务判断的时间趋近于零。

目标不是「更聪明的模型」，而是：**让未验证的东西无法冒充已验证，让变化只影响受影响的局部。**

## 1. 分层原则（唯一判据：谁控制这个变化）

| 层 | 内容 | 变更所有者 | 变更信号 | 是否模型生成 |
|---|---|---|---|---|
| **L0 驱动/工程层** | 会话与连接、断线检测、登录态识别、证据通道（截图/录像/trace/哈希）、超时与退出码、进程隔离 | 我们 | 打包版本升级 | ❌ 永不 |
| **L1 框架适配层** | 浮层可见性、虚拟列表选择、日期/月份面板、拖拽区间几何、校验消息读取、弹层关闭 | **被测系统的前端栈** | 运行期标定 + `assumes` 标签 | ⚠️ 极少（新增适配器时） |
| **L2 项目层** | 菜单路径、已验证选择器、伪交互组合 | 被测产品 | 页面指纹 | ✅ 每模块一次 |
| **L3 用例层** | 数据、编排、断言 | 测试用例本身 | 用例版本 | ✅ 主要工作 |

**判定规则（写死，不允许例外）：**

> 一条假设的主语如果是**被测系统**（antd 如何渲染弹窗、下拉能否搜索），它不得进入 L0，必须在 L1/L2，并且必须带运行期自检与失效声明。

L0 不是「不会变」，而是「只有我们能让它变」。

## 2. 核心机制

### 2.1 L1 原语 = 标定 + 前置检查 + 动作

每个 L1 原语必须提供三样东西，缺一不可：

```js
export const id = 'calendar.monthRange';          // 唯一 id
export const assumes = ['antd-range-picker'];      // 失效标签：指纹变化时按标签作废
export async function probe(page) { /* 零副作用标定；返回 env 或 null */ }
export async function precheck(page, env) { /* 返回 {ok, code, observed} */ }
export async function run(page, env, args) { /* 真实动作 */ }
```

- **`probe` 只读**，用来在探测任务里标定这一层的真实行为，写进 L2 profile。探测不出结果 → 该原语在本次运行中不可用，**报阻塞，不许猜**。
- **`precheck` 每次调用前执行**，`ok:false` 时上层必须走阻塞分支。这同时补上了 009 缺失的登录态/环境检测。
- **`assumes` 是失效标签**，不是注释。指纹或驱动版本变化时，只让命中标签的原语失效。

### 2.2 可见性：可标定，不写死

两个原始判据都各有已知陷阱，所以不允许任何一处直接写：

- `offsetParent !== null`：`position:fixed` 元素恒为 `null`（本次实测的真实误判源）；
- `style.display !== 'none'`：挡不住祖先隐藏、`visibility:hidden`、零尺寸、被 `opacity:0` 覆盖。

做法：**在探测阶段用两个已知答案的标定元素（一个确知隐藏、一个确知可见）验证候选判据**，选出能同时给出正确「在/不在」的判据，写进 profile；判据在运行期只做二次确认，不合格即 `PRECHECK_FAILED`。

> 注：标定元素必须来自**被测系统自身**（例如页面里天然存在的隐藏节点），不能用测试脚本插入的节点，否则测的是「插入的节点」而不是被测栈的行为。

### 2.3 L2 = 带实测回执的目标清单

`page-facts.md`（散文）→ `module-profile.json`（可校验）。每条目标必须带一次实测回执：

```json
"name_input_in_modal": {
  "assumes": ["antd-modal"],
  "pointer": "modal.locator('input[placeholder=\"请输入电价模板名称\"]')",
  "verified": { "matched": 1, "rendered": true, "box": [x, y, w, h], "at": "..." },
  "known_trap": "全页同名匹配 2 个：列表筛选框 + 弹窗输入框；必须限定 modal 范围内"
}
```

**准入规则（硬）：`matched > 1` 且未写明收敛方式的指针，不得写入 profile。**
`.first()` 那个缺陷会在写 profile 的那一刻被拦住，而不是在第 19 分钟。

### 2.4 指纹失效：只重探受影响的部分

profile 记录两项身份：

- `page_fingerprint`：目标页关键 DOM 结构摘要（不含业务数据）；
- `driver`：L0/L1/Playwright 版本。

变化时的动作分级：

| 变化 | 动作 |
|---|---|
| 驱动版本变 | 重跑全部 L1 `probe`，L2 指针不动 |
| 页面指纹变 | 对每个 target 跑 `verify()` 复核；只对失败的 target 重探，并只重跑命中其 `assumes` 的 L1 原语 |
| 用例版本变 | 只重写该用例的 L3，不碰 L2 |

## 3. 任务模型（把探索从用例里拆出去）

| 任务类型 | 何时 | 预算特征 | 产出 |
|---|---|---|---|
| `explore-module` | 项目接入；或指纹失效 | 独立预算，允许慢、允许失败重来 | L1 标定结果 + `module-profile.json` |
| `probe-module` | 指纹变化后 | 小，只做复核 | profile 修订 + 失效清单 |
| `author-case` | 日常，占绝大多数 | 充裕，因为**不需要探索** | spec + 断言 + 证据清单 |
| `replay` | 验收 | **0 模型调用** | 权威证据（截图/录像/trace/报告） |

成本曲线目标：`总成本 ∝ 用例数 + 页面变更次数`，而不是 `用例数 × 未知量`。

### 3.1 三条验收门

1. **profile 准入**：每个 target 有 `pointer` + `assumes` + 实测回执；无未收敛的重复匹配。
2. **原语标定**：所有被引用的 L1 原语在本次运行中 `probe` 成功；否则 profile 拒绝启用。
3. **用例前置**：`author-case` 开始前跑零模型预检（登录态、入口可达、profile 有效）。任一失败 → 立即 `BLOCKED_*`，不进入编写。

## 4. 失败码（契约的一部分）

| 码 | 含义 | 归类 |
|---|---|---|
| `PASS` / `FAIL` | 业务断言满足 / 不满足 | 业务 |
| `BLOCKED_AUTH_REQUIRED` | 未登录、会话失效、被踢回登录页 | 前置（可重试） |
| `BLOCKED_ENV_UNREACHABLE` | 目标不可达 | 前置（可重试） |
| `PRECHECK_FAILED` | L1 前置检查不通过 | 基础设施（可重试） |
| `SELECTOR_NOT_UNIQUE` | 指针匹配多个且未收敛 | 编写缺陷（须改 profile） |
| `SELECTOR_STALE` | 回执与现状不符 | 触发重探 |
| `EVIDENCE_INCOMPLETE` | 媒体/证据缺失 | 证据（不覆盖业务结论） |
| `BUDGET_EXHAUSTED` | 预算用尽 | 终态 |

规则：**业务失败与前置/基础设施失败必须分开计数**，不得相互转写；`BLOCKED_*` 与 `PRECHECK_FAILED` 不得计为产品缺陷。

## 5. 目录与产物形状

```
<workspace>/
  modules/<module-id>/module-profile.json      # L2：带回执的目标清单 + 指纹
  cases/<external-id>.spec.mjs                 # L3
  evidence/<run-id>/…                          # L0 落盘，含哈希清单
  runs/<run-id>/result.json                    # 逐用例判定 + 失败码
```

包内（随安装包交付，模型不可写）：

```
packages/
  ui-automation-core/          # L0
  ui-automation-web-adapters/  # L1（antd 系列等）
  case-runner/                 # 执行器 + 证据 + 判定
```

## 6. 迁移路径（从现状到目标）

| 步 | 动作 | 直接收益 |
|---|---|---|
| 1 | 用 `module-profile.json` + 回执准入替换 `page-facts.md` 存在性门禁 | 立刻拦住 `.first()` 类缺陷 |
| 2 | 把 `lib.mjs` 里的页面原语按标定/前置/动作重写为 L1，并跑一次零模型预检 | 补上登录态与环境检测 |
| 3 | 拆分预算：探索、编写、复跑三种任务类型 | 消除「19 分钟里 8 分钟探测」的结构浪费 |
| 4 | 指纹 + 标签失效 | 页面升级只重探受影响原语 |
| 5 | 独立复跑产出权威证据 | 生成者与验证者分离 |

## 7. 边界与限制

- **指纹对 Canvas / Shadow DOM / 跨域 iframe 不可靠**，此类页面退回「每次探测」，不假装有缓存。
- **首次探索成本不可消除**：任何系统第一次见一个模块都要付一次；能做的是把它限制在每模块一次。
- **L1 不可能预先完备**：遇到未知框架行为时，`author-case` 只能报告 `PRECHECK_FAILED` 或提交「待评审的新适配器」，不能在用例里私藏框架假设。
- **标定元素依赖被测页面**：若页面没有可用的隐藏/可见标定对，可见性判据退回保守模式（同时满足多个条件才算可见），并记 `assumes_confidence: low`。
- **登录、扫码、验证码、写入授权**始终是人或编排方的职责，不在 L0–L3 的任何自动路径内。
- **权威证据的归属**需由编排方明确：若不重跑而直接展示生成期自测证据，必须在数据结构上标为「生成期自检」，不得与独立复跑结果混用。
