# M2-A DeepSeek Harness 受控调用探针

本子工程只验证 DeepSeek 官方 Harness 能否由普通程序受控调用、使用浏览器工具、写出文件并让外层独立执行。它不接工作台 Web，不登记批准业务资产，也不读取 M1 脚本、历史结果或产品源码。

## 固定组件

- DeepSeek Harness CLI：`@deepseek-ai/dsh@0.1.6-alpha.2`，实际命令 `dsh`；供应商/项目为 DeepSeek AI。
- 模型适配器：Harness 内置 `deepseek-official`；本探针选择公司已配置的实际模型 `deepseek-v4-pro`。
- 浏览器提供方：`@deepseek-ai/dsh-experimental-browser-use-playwright-mcp@0.1.6-alpha.2`，其固定上游为 `@playwright/mcp@0.0.80`。
- 候选执行器：`@playwright/test@1.62.1`；本机实际浏览器为 Microsoft Edge 153.0.4234.48。

官方依据：[DeepSeek Harness 仓库与安装说明](https://github.com/deepseek-ai/deepseek-harness)、[Headless 自动化接口](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/bundle/headless/README.md)、[CLI 行为参考](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/cli/reference/README.md)、[官方 Playwright MCP Browser Use 插件](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/experimental/browser-use-playwright-mcp/README.md)。官方明确标注 Harness 为 developer preview，Browser Use 为 experimental；版本不得在运行时漂移。

## 安装与自检（Windows PowerShell）

```powershell
cd harness-probe
npm ci
npm run setup:harness
npm test
```

`setup:harness` 只初始化 `harness-probe/.local/dsh`，并以精确版本安装两个插件；不写 `%USERPROFILE%\.dsh`。运行时不会用 `npx` 下载最新版。

## 真实探针

先通过安全的本机凭据来源设置下列进程环境变量，不要把值写入仓库或命令历史：

```powershell
$env:DEEPSEEK_API_KEY = '<公司批准的凭据>'
$env:DEEPSEEK_BASE_URL = 'https://api.deepseek.com/anthropic'
$env:DSH_PROBE_BROWSER_EXECUTABLE = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$env:PROBE_TIMEOUT_MS = '600000'
npm run probe
```

协调器使用参数数组与 `shell:false` 启动本地 `dsh`，工作目录仅为 `.local/workspace/<run_id>`。它消费 Headless `--json` 事件流，要求同时满足：进程退出码 0、`turn_end=completed`、`final` 存在、至少一次 `mcp__playwright-mcp__*` 调用、候选文件存在且在工作区内、独立 Playwright 报告至少运行一个测试且全部通过。任何一项缺失均失败，不自动重启。

`Ctrl+C` 可终止当前前台命令。程序化取消通过 `AbortSignal` 进入拥有进程树的有界终止；工程测试使用模拟进程验证，不冒充真实模型证据。

## 隔离和已知边界

- Git 忽略 `.local/`、Playwright 报告和媒体；公开仓库只保留合成页面、控制代码、测试与脱敏摘要。
- Harness 子进程只继承运行所需的系统路径、临时目录、DeepSeek 凭据、端点和浏览器路径；候选执行进程不继承模型凭据。
- 文件系统工作区为空白且独立，不暴露产品源码、批准脚本、账号会话或历史答案。
- 当前 Windows 环境没有按进程限定“仅 DeepSeek API + localhost”的现成网络沙箱；本探针通过空白工作区、无账号浏览器和无其他敏感环境变量降低影响，但这仍是进入正式集成前的隔离缺口。
- `npm audit` 在固定 Harness 依赖链中报告 5 个 moderate、0 high、0 critical；未用破坏性升级绕开固定版本。

M2-A 实际结果和停止结论见 [PROBE_REPORT.md](PROBE_REPORT.md)。M2-B 对现有宿主边界作了确定性核对；文件、网络和凭据隔离均未满足，因此没有启动新的 Harness/DeepSeek 修订任务，详见 [M2B_ISOLATION_REPORT.md](M2B_ISOLATION_REPORT.md)。
