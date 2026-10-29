# 本轮交付说明（2026-10-15）

两件事都已接入 workbench 并通过测试与真实数据核对。设计原型保留在 `design/layered-v1/`（不参与运行路径）。

## 验证汇总

- `node --test` 相关测试：**91/91 通过，0 失败 0 跳过**（含既有 native-dsh 全套 + 新增 11 项）。
- 真实会话端到端：**536 帧全部解出、313 条可展示记录**，7/7 断言通过。

## ① 分层方案：最小接法已实现（预检，不阻塞）

按确认的最小接法落地：**不改提示词、不做新门禁**，只在任务开始前加一次零模型预检，记入 `session.json` 并在页面展示。

| 文件 | 改动 |
|---|---|
| `workbench/server/native-dsh/profile-admission.mjs` | 新增：`module-profile.json` 准入校验（自包含，不依赖设计原型目录） |
| `workbench/server/native-dsh/preflight.mjs` | 新增：静态预检 + 运行期预检 + 结果合并 |
| `workbench/server/native-dsh/manager.mjs` | `create()` 记录静态预检；`process()` 在浏览器附加后、模型启动前做运行期预检 |
| `workbench/web-v2/native-dsh.js` | 任务卡片新增「前置预检（不阻塞执行）」折叠区 |

### 预检做了什么

- **静态（创建任务时）**：档案 schema、每条 target 的 pointer/assumes/实测回执、
  **多匹配未收敛 → FAIL**、回执为 0 → FAIL（除非声明 `conditional`）、清理能力未确认 → 提示。
- **运行期（模型启动前，复用已附加的浏览器，只读）**：目标可达性、当前是否停在登录页、按档案的 `verify` 复核目标计数。

### 四条硬约束（都写进了实现与测试）

1. **只读**：不点击、不输入、不创建会话、不调用模型；只做结构读取与计数。
2. **不 eval**：档案里的 `pointer` 是给人看的表达式，预检**不执行**。需要真实页面复核的目标必须另给 `verify`（纯 CSS 选择器）。
3. **不阻塞**：预检失败只记录并展示，不改变任务能否创建，也不改变业务判定。
4. **不成为新故障点**：任何一步超时或抛错都降级为 UNKNOWN；连接被拒绝、playwright 缺失、档案是坏 JSON，都不影响任务启动。

### 实测效果

- 合法档案 → `WARN`（0 errors，6 条提示：未标定、未知原语、收敛使用、条件目标、双向正则、清理未确认）。
- **删掉 `name_input_in_modal` 的 `known_trap` 并把 matched 改成 2 → 立刻 `SELECTOR_NOT_UNIQUE` 失败**。这正是 008/009 那个 `.first()` 缺陷会在写档案时被拦住的时刻。
- 无档案 → `SKIPPED` 且页面显示「未启用预检」，不会显示成「检查通过」。
- 坏 JSON、混入 null 条目 → 记为问题/提示，不打挂预检。

### 过程中修掉的自身缺陷

1. `bounded()` 只防超时、不防 promise 直接抛错 —— 生产里会让预检异常反过来打断任务，已修为返回结果对象。
2. 校验器遇到非对象条目（如说明性字段）会抛 `TypeError`，已改为跳过并记 `TARGET_NOT_OBJECT`。
3. 曾把「未标定 / 未知原语」一律当 error，导致合法档案永远无法通过；现区分严格模式（启用档案）与非严格模式（预检告知），只保留**确定危险**项为 error。
4. 「回执为 0」曾一刀切算 stale，误杀「错误提示只在出错时存在」这类目标；现允许用 `conditional: true` 显式声明。

## ② 对话可见性：已接入

| 文件 | 改动 |
|---|---|
| `workbench/server/native-dsh/zstd-frames.mjs` | 新增：多帧 zstd 读取器 + JSONL 解析 |
| `workbench/server/native-dsh/transcript.mjs` | 新增：只读对话视图构建（白名单 + 脱敏 + 丢弃思考块） |
| `workbench/server/native-dsh/manager.mjs` | 新增 `resolveSessionLog()` / `getTranscript()`；定位成功后把目录名写入 `session_directory` |
| `workbench/server/native-dsh/routes.mjs` | 新增 `GET …/native-dsh/transcript`（仅 GET） |
| `workbench/web-v2/native-dsh.js` | 新增 `nativeDshTranscriptHtml()` 与「与 dsh 的对话」只读面板 |
| `workbench/scripts/test-manifest.json` | 登记新测试文件 |
| `workbench/tests/native-dsh-transcript.test.mjs` | 11 项测试（含预检） |
| `workbench/tools/verify-live-transcript.mjs` | 真实会话日志端到端只读核对工具 |

真实会话 `session-8d23f460-…`（008/009 两轮）：6 条编排方输入、19 条 dsh 回复、142 次工具调用、142 条工具结果、5 条错误结果。

### 过程中发现并修掉的真实问题

1. **标准库读会话日志会静默截断。** `zlib.zstdDecompressSync` 只解出第一帧（实测 327 字节 / 536 帧），不报错、不抛异常。必须逐帧扫描幻数解压。
2. **`reasoning` 块泄漏。** assistant 消息的 `content[]` 混有 `reasoning` 与 `text`；只含思考的 step 还会退化成 JSON 原文。现在提取阶段丢弃，纯思考条目不渲染。
3. **"空对话"其实是读不到。** 已区分 `SESSION_STORE_ABSENT` 等不同原因，不把"读不到"显示成"没有对话"。
4. **目录名编码无稳定规范。** 实测同机两种形态，且同一连字符表现不同（`-` vs `%2D`）。最终只做可判定判定：**规范化后以工作目录结尾** + 该目录下真实存在该会话日志；首次定位成功后把目录名落盘。
5. 期间还修掉一个我自己引入的过强条件（曾要求目录名含项目 UUID，会误杀不含 UUID 的合法工作目录），以及两处测试夹具自身的偏差。

### 边界

只读：不创建会话、不启动 Host、不调用模型；只渲染 6 类事件，其余仅计数；不展示思考；一律脱敏。

## 「在 dsh 中打开此会话」修复记录（2026-10-15）

### 真实根因

工作台所有页面统一下发：

```
Content-Security-Policy: default-src 'none'; … form-action 'none'; frame-ancestors 'none'
```

见 `server/app.mjs:32-40`。**`form-action 'none'` 会静默拦掉页面上的一切表单提交**——不报错、不发请求、不弹窗。
而该按钮原本正是 `<form method="post" target="_blank">`，所以点击后什么都没有发生。

其他页面的表单之所以没事，是因为它们全部由 JS 接管并调用了 `preventDefault()`；只有这一个用的是原生提交。

实测证据：页面里 `submit` 事件确实触发、`defaultPrevented:false`，但 **没有 POST、没有新标签**。

### 为什么不能只放宽 CSP

1. `form-action 'self'` 也救不了：`form-action` **逐跳校验重定向**，终点是另一个源的 dsh Host（`127.0.0.1:<port>`），仍会被拦。
2. 前端 `fetch` **跟随重定向**也会失败：跨源跳转需要 CORS，Host 不返回 CORS 头 → `Failed to fetch`（已实测）。
3. `fetch` + `redirect:'manual'` 拿不到 `Location`：返回 `opaqueredirect`（`status:0`）——已实测，为此走过一次弯路。

### 最终修法

按钮改为普通 `button` + 脚本处理：

1. 前端先 `window.open('about:blank')` 占位（避免等响应回来再开窗被当作非用户手势而拦截）；
2. 同源 `POST …/native-dsh/session-url` 取得**未经访问的原始启动地址**；
3. 校验必须是本机回环地址，然后 `location.replace(url)` 导航占位窗口。

关键约束（实测踩过）：**启动地址是一次性的，服务端绝不能先去访问它**——
那会消耗令牌并把 cookie 落在服务端，浏览器再打开就只剩 401。
所以服务端只做地址校验与回环限制，不发起任何对 Host 的请求；跳转与 cookie 建立全部由浏览器在一次连续导航中完成。

失败时关掉占位窗口并给出可操作提示（例如「浏览器拦截了新窗口」），不留白标签页。

### 验证结果

真实浏览器（Edge headless）点击按钮：

- 新标签数 1
- 最终 URL `http://127.0.0.1:50096/`
- 标题 **「继续完成 Playwright 测试任务 — DeepSeek Harness」**
- 页面正文 4207 字符，无错误提示

### 改动文件

| 文件 | 改动 |
|---|---|
| `workbench/web-v2/native-dsh.js` | 按钮由原生表单改为脚本；新增打开失败的用户可见提示 |
| `workbench/server/native-dsh/routes.mjs` | 新增 `POST …/native-dsh/session-url`（沿用本地来源校验） |
| `workbench/server/native-dsh/manager.mjs` | 新增 `resolveSessionUrl()`：只校验地址，不访问 Host |
| `workbench/tests/native-dsh-ui-routes.test.mjs` | 原断言绑定了旧表单结构，已改为验证新行为（含弹窗被拦、外部地址拒绝） |

测试：连同既有 native-dsh 全套 **91/91 通过，0 失败 0 跳过**。

### 另一个运维事实（本次踩到）

`start-workbench.ps1` 只在**启动时**检查 4322 是否被占用；由它托管的实例在线重启后，
**新实例的源码指纹变了，但旧标签页不会自动重载**。排查前先核对
`/api/health` 的 `service_identity.source_sha256` 与磁盘是否一致，能直接区分「代码没加载」和「代码有问题」。
本次用一次托管重启（`POST /api/service/restart`）加载新代码，实例 `service-73479115…` → `service-b8166d91…`。

## 尚未完成 / 未验证

- **「在 dsh 中打开此会话」未端到端验证**：代码路径齐全（`open-session` 路由 + `browser-bridge.mjs`），但需要 Host 在线；本轮未启动 Host，所以只能说"没验证"。
- **提示词未改**：`manager.mjs` 里仍要求模型写 `page-facts.md`。是否改成 `module-profile.json` 是产品行为变更，留待你确认。
  - 补充事实：本机 `page-facts.md` **实际并不存在**（008/009 都没走到收尾写文件那一步），所以现有"只看文件在不在"的门禁是**潜在**缺口，不是本次失败的成因。本次失败的直接原因是模型自写共享库里的 `.first()` 定位错误。
- **只看当前会话**：本机工作目录迁移过，历史会话日志留在旧目录下；要读历史会话需按 `session_history` 逐条定位，属后续增强。
- **运行期预检的 `verify` 覆盖度**：目前只有档案里显式提供 `verify` 的目标会被复核（示例档案 9 条目标中 6 条有 `verify`），其余只做静态校验。


## ② 对话可见性：已接入（本次实际改动）

### 改了什么

| 文件 | 改动 |
|---|---|
| `workbench/server/native-dsh/zstd-frames.mjs` | 新增：多帧 zstd 读取器 + JSONL 解析 |
| `workbench/server/native-dsh/transcript.mjs` | 新增：只读对话视图构建（白名单 + 脱敏 + 丢弃思考块） |
| `workbench/server/native-dsh/manager.mjs` | 新增 `resolveSessionLog()` / `getTranscript()`；`getTranscript` 定位成功后把目录名写入 `session_directory` |
| `workbench/server/native-dsh/routes.mjs` | 新增 `GET …/native-dsh/transcript`（仅 GET） |
| `workbench/web-v2/native-dsh.js` | 新增 `nativeDshTranscriptHtml()` 与「与 dsh 的对话」只读面板 |
| `workbench/scripts/test-manifest.json` | 登记新测试文件 |
| `workbench/tests/native-dsh-transcript.test.mjs` | 新增 9 项测试 |
| `workbench/tools/verify-live-transcript.mjs` | 新增：真实会话日志的端到端只读核对工具 |

### 验证结果

- `node --test` 本文件 9/9 通过；连同既有 native-dsh 全部测试共 **89/89 通过，0 失败 0 跳过**。
- 真实会话 `session-8d23f460-…`（008/009 两轮）端到端核对：**536 帧全部解出、313 条可展示记录**（6 条编排方输入、19 条 dsh 回复、142 次工具调用、142 条工具结果、5 条错误结果），7/7 断言通过。

### 过程中发现并修掉的真实问题（都写进了测试）

1. **标准库读会话日志会静默截断。** `zlib.zstdDecompressSync` 只解出第一帧（实测 327 字节 / 536 帧），不报错、不抛异常。必须逐帧扫描幻数解压。
2. **`reasoning` 块泄漏。** assistant 消息的 `content[]` 同时含 `reasoning` 与 `text`；早期版本会把思考一起渲染，只含思考的 step 还会退化成 JSON 原文。现在提取阶段丢弃，纯思考条目直接不渲染。
3. **看到"空对话"其实是读不到。** sessions 根不存在时曾返回「找不到该会话」，会把"读不到"显示成"没有对话"。现区分 `SESSION_STORE_ABSENT` 等不同原因。
4. **目录名编码无稳定规范。** 实测同机两种形态（`--C-Users-…--` 与 `C%3A%5CUsers…`），且同一连字符表现不同（`-` vs `%2D`）。最终只做可判定判定：目录名规范化后**以工作目录规范化形式结尾**，且该目录下真实存在该会话日志；首次定位成功后把目录名落盘，之后不再依赖编码规则。
   - 期间还修掉一个我自己引入的过强条件（曾要求目录名含项目 UUID，会误杀不含 UUID 的合法工作目录）。
5. **两处测试夹具自身的偏差**（fixture 预置日志未清理、断言与实现不同步），已按实际语义修正而不是放宽断言。

### 边界（写死在实现里）

只读：不创建会话、不启动 Host、不调用模型；只渲染 6 类事件，其余仅计数；不展示思考；一律脱敏。
「在 dsh 中打开此会话」仍是原状——它需要 Host 在线，本轮未启动 Host，因此**未端到端验证**。

## ① 分层方案：门禁已可运行，接入待确认

| 产物 | 状态 |
|---|---|
| `workspace/modules/control-electricity-price-template/module-profile.json` | 已填真实回执与已知陷阱 |
| `workspace/gates/profile-admission.mjs` | 可运行（`node --check` 通过），**未接进 manager** |
| `workspace/gates/case-preflight.mjs` | 可运行，**未接进运行路径** |
| `packages/ui-automation-core/{status,registry}.mjs` | 可运行 |
| `packages/ui-automation-web-adapters/*` | 可运行（`probe()` 含占位，需真实标定填充） |

**未做**：替换 `manager.mjs:125` 提示词里的 `page-facts.md` 约定，以及把 `profile-admission` 接成 `run.mjs:22` 的替代门禁。
这一步会改变生成任务的输入约定与失败判定，属于产品行为变更，需要你确认接入方式后再动。

另外两点如实说明：

- 本机 `page-facts.md` **实际并不存在**（008/009 都没走到收尾写文件那一步），所以现有门禁的"只看文件在不在"是**潜在**缺口，不是本次失败的成因。本次失败的直接原因是模型自写共享库里的 `.first()` 定位错误。
- 工作目录迁移过（native-dsh 会把 `session_id` 置空并记入 `session_history`）。历史会话日志仍留在旧工作目录下，当前 `getTranscript` 只读**当前会话**；要读历史会话需要按 `session_history` 逐条定位，这是一个明确的后续增强项。

