# 独立 AI 建例 / 固定脚本回归试点

起点 `c1e9455`，仅分支 `codex/ai-case-script-pilot`。本目录不是产品运行入口，不修改或接入产品 `src/`。它属于 **Claude Code辅助建例 → 人工首次核对 → Playwright固定脚本回归**，不是原DeepSeek产品全自主能力验收。

本轮已到初稿1/修正2上限，末版仍漏S02行总数不变，**不建议人工批准，正式回归未启动**。见[结论及逐义务对应表](REPORT.md)，不要删除记录或重跑来刷新额度。

## 当前门与边界

仅排序组正常原题HOLD-S1进入建例；排序组成立后才允许详情组。HOLD-S2故障入口不进入建例会话。每组最多初稿1次、修正2轮，连同环境失败全部记录，不重置额度。每轮最多100工具调用/20分钟。首次人工审核未完成前，正式回归必须为零。

人工首次核对须检查脚本与原义务对应表、预期、操作顺序、取证时机、正常/故障共用逻辑和脚本SHA。模型或Codex审查不能代签。批准后再冻结脚本，同逻辑、同预期，仅入口参数切换正常/故障，各3次；`retries=0`，不用模型、不修改脚本、不开healer。技术失败不算故障检出。

## 环境与安全

- 独立包固定 `@playwright/test@1.62.1`，使用官方 `playwright init-agents --loop=claude` 提供的generator指令及 `run-test-mcp-server`；planner/healer定义即使由安装器生成，也不加载或执行。
- 主机Claude Code `2.1.218`；本机现有路由是 `https://api.deepseek.com/anthropic`、`deepseek-v4-pro`。这不是Anthropic Claude模型，不作多模型比较。
- Codex持有控制worktree；Claude工作在单独临时目录。`--bare`、无会话恢复、无自动记忆、无技能/插件、内置工具为空、MCP仅指定白名单。
- `mcp-gate.mjs`只透传官方现场交互/建例工具，禁文件读取、任意代码、页面evaluate、外网/故障入口与通用测试执行；seed固定为主管拥有的初始化脚本，输出只能是 `tests/sorting.spec.ts`。浏览器网络另限制正常入口。工具隔离不是操作系统沙箱。
- 凭据只在子进程环境传递，不放提示、参数或仓库。`private/`、会话、完整工具输出和媒体不提交。

## 本机可复现入口

在本目录执行 `npm ci --ignore-scripts`，再 `npx --no-install playwright init-agents --loop=claude`。主管先创建独立authoring目录、固定seed/config，再执行 `node prepare.mjs <authoring目录>`。初始化只读冻结清单并导出正常原题；此动作不授予人工批准。

`node --test gate.test.mjs` 检查隔离规则；`node probe-gate.mjs <authoring目录> --seed` 检查官方连接和初始化。`node run-author.mjs <authoring目录> <claude可执行文件> draft-1` 只允许一次，后续最多 `correction-1`、`correction-2`。完整失败保留在private；禁止删除日志来重新获得额度。

生成的业务测试必须由Claude Code产出，Codex不代写原义务断言。技术准备、生成期间现场验证、人工核对、正式回归分别统计，不能互相代替。

参考：[Playwright官方Test Agents](https://playwright.dev/docs/test-agents)、[Claude Code CLI](https://code.claude.com/docs/en/cli-reference)。
