# M2-A DeepSeek Harness 受控调用探针报告

日期：2026-09-21

基线：`7b4416ccbb3ee5ebb4a68ea12e2cabc82d349590`

分支：`codex/test-workbench-m2-probe`

## 结论

**B：DeepSeek Harness 的程序化启动、事件流、官方浏览器工具和文件产出均已真实成立，但本轮最小端到端门槛未全部满足，暂不进入工作台集成。**

这不是“只能打开 Web UI”或“只能聊天”：两次任务都由普通 Node 协调程序启动官方 `dsh --profile headless --json`，分别记录到 5 次和 4 次官方 Playwright MCP 工具调用，并产生了真实候选文件。但集中修复后的第二次候选把 accessibility snapshot 中的 `status` 误写成 CSS 标签选择器 `locator('status')`，独立执行为 1 个测试、1 个失败。按预设预算停止，不做第三次模型调用，也不由 Codex改候选后冒充 Harness 成功。

## 官方接口与实际配置

| 项目 | 实际值 | 依据/边界 |
|---|---|---|
| 工具 | DeepSeek Harness `dsh` | [官方仓库](https://github.com/deepseek-ai/deepseek-harness) |
| 版本 | `@deepseek-ai/dsh@0.1.6-alpha.2` | 本地 `dsh --version` 退出码 0；开发预览 |
| 程序接口 | Headless `--json` NDJSON 事件流 | [Headless 文档](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/bundle/headless/README.md)；退出 0 仅表示 Harness turn completed，外层另验文件与测试 |
| 供应商/适配器 | DeepSeek AI / `deepseek-official` | 不与 Claude Code 混称 |
| 实际模型 | `deepseek-v4-pro` | 公司已配置 DeepSeek Anthropic-compatible 端点；凭据未落盘到仓库或日志 |
| 浏览器工具 | 官方实验性 Playwright MCP provider `0.1.6-alpha.2` | [插件文档](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/experimental/browser-use-playwright-mcp/README.md) |
| 取消 | 外层终止所拥有的 Harness 进程树 | 当前 SDK 协议无逐 prompt cancel；本探针未使用 SDK 常驻进程 |

Headless 提供 session、status、tool_call、tool_result、final 事件，外层据此获取进度和终态。任务取消或 10 分钟到期时只结束本协调器启动的 PID 树；失败不自动重启。模型 retry 插件在探针 patch 中禁用。

## 真实调用证据

完整脱敏索引见 [attempt-summary.json](evidence/attempt-summary.json)，两份候选按原字节保存在 [attempt-1-candidate.spec.mjs](evidence/attempt-1-candidate.spec.mjs) 和 [attempt-2-candidate.spec.mjs](evidence/attempt-2-candidate.spec.mjs)。原始会话、报告、浏览器临时文件和媒体只在 Git 忽略的 `.local/` 中。

### 初验

- Run ID：`probe-2026-09-21T01-28-42-692Z-835e394d`；真实 Harness 时长 23.73 秒。
- Harness：退出码 0、`turn_end=completed`、`final` 存在；浏览器工具调用 5 次（navigate/snapshot/click/snapshot/evaluate）。
- 页面事实：点击前“尚未执行”，点击后可见 `PROBE-42`。
- 文件：305 bytes，SHA-256 `D2A75193C3F4322379571BFC20771C7017BEDF2F33459E31AEFFBDBE25E5F967`，包含任务给定的 `PROBE-42` 断言。
- 初次执行：退出码 1、0 tests；原因是协调器向 Playwright 传绝对 Windows 路径，后者按正则文件过滤器处理。
- 集中修复：只将候选参数改为相对 `testDir` 的文件名。原候选离线复算为退出码 0、1/1 通过；没有模型调用、没有改候选。

### 集中修复后复验

- Run ID：`probe-2026-09-21T01-29-47-892Z-8fbcbdbb`；真实 Harness 时长 23.51 秒。
- Harness：退出码 0、`turn_end=completed`、`final` 存在；浏览器工具调用 4 次（navigate/snapshot/click/snapshot）。浏览器结果仍明确显示 `PROBE-42`。
- 文件：297 bytes，SHA-256 `C4C68178C3F79D60B06E8968AE962865A0A6D56A5AD18E12055AB94980C8C600`。
- 独立执行：退出码 1、1 test、1 failed。原始错误为 `locator('status')` 未找到元素；页面的 `status` 是 accessibility role，真实 DOM 元素是 `<output id="probe-result">`。
- 归因边界：这是候选定位表达错误，不是合成页面业务失败；未改候选，未第三次重跑。

## 故障与控制验证

`npm test` 实际运行 12 项、12 通过、0 失败、0 跳过，覆盖：启动命令不存在快速返回；外层到期；用户取消；完整终态；缺文件；无浏览器工具事实；模型中断/缺 final；取消/超时；敏感字段与 Bearer 脱敏；缺失/损坏报告；0 测试；跳过与失败。取消/超时使用模拟进程验证，和上述真实模型证据分开记账。

成功判定同时要求进程、Harness 终态、浏览器工具、文件和 Playwright 结构化报告全部完整；因此两次整体结果均为 false，没有用 Harness 自报“完成”覆盖外层失败。

## 隔离、安全与依赖风险

- Harness home、工作区、会话、报告和媒体均在 `harness-probe/.local/`；候选进程不继承 DeepSeek Key。
- Harness 只看到空白工作区、合成页面和输出目录；没有向其提供产品源码、批准脚本、业务数据、账号会话或旧答案。
- 路径校验拒绝工作区外候选；子进程用参数数组和 `shell:false`；页面只监听 `127.0.0.1` 随机端口。
- 当前 Windows 主机没有按子进程实施精确网络出站白名单。官方浏览器插件理论上可访问其他 URL，当前约束仍部分依赖空白环境和明确任务；这是正式集成前必须处理或显式接受的安全缺口。
- 固定 alpha 依赖链的 `npm audit` 为 5 moderate、0 high、0 critical。为保持本探针的官方同版组合，未执行 `audit fix --force` 或换版碰运气。

## 投入与调用预算

| 类别 | 实际记录 |
|---|---|
| 环境准备 | npm 精确依赖安装约 120 秒；隔离 profile 插件安装 8.1 秒；启动自检 2.9 秒 |
| 开发/排查 | 09:19–09:31（Asia/Shanghai）完成需求包、协调器、隔离、报告判定及 0-test 根因修复；随后仅做报告收口 |
| 模型调用 | 2 次（达到上限），Harness 活动合计 47.24 秒；13 steps；input 30,434、output 2,136、cache-read 162,432、provider-reported total 195,002 tokens；公司网关未返回货币费用 |
| 工程验证 | 首轮 12 项约 1.81 秒；修复后 12 项约 1.83 秒；原候选离线浏览器复算与工程测试组合命令约 5.3 秒 |

## 未完成项与停止点

- 未取得“集中修复后由 Harness 生成且独立执行通过”的同一次完整闭环，因此不满足 A。
- 未验证正式工作台 Web、复杂用例建例能力、批准资产流程、自愈、多人或发布能力。
- 按任务预算已停止真实调用；下一阶段若继续，应先决定网络隔离方案，并针对 Browser Use accessibility role 到 Playwright locator 的候选质量设最小验证/反馈策略。此报告不授权自动进入该阶段。
