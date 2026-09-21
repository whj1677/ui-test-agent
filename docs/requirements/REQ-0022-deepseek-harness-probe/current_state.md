<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0022 当前状态

- 需求标题：M2-A DeepSeek Harness受控调用可行性探针

## 元数据

- 需求状态：已完成（结论B）
- 治理分级：G2
- 当前版本：3
- 最后更新：2026-09-21

## 当前有效用户需求

| UN | 状态 | 内容 |
|---|---|---|
| UN-0022-01 | 已确认 | 以固定版本DeepSeek官方Harness完成一次可审计的程序化浏览器工具调用、候选文件产出及独立执行闭环，并形成A/B/C可行性结论。 |

## 当前有效开发需求

| DR | 状态 | 内容 |
|---|---|---|
| DR-0022-01 | 已确认 | 提供固定版本、隔离目录、环境变量白名单、无shell拼接的Harness启动适配器，并记录事件、终态、退出码和文件摘要。 |
| DR-0022-02 | 已确认 | 让Harness通过官方Browser Use工具操作本地合成页面，并在指定目录生成最小Playwright候选。 |
| DR-0022-03 | 已确认 | 验证启动失败、外层取消/到期、模型中断、缺失产物和报告不完整的封闭行为。 |

## 当前有效设计

| DD | DR | 状态 | 内容 |
|---|---|---|---|
| DD-0022-01 | DR-0022-01 / DR-0022-02 / DR-0022-03 | 已确认 | 新增独立harness-probe子工程，以普通Node协调程序驱动固定版dsh Headless/SDK，并把Harness home、页面、输出和证据全部置于Git忽略目录。 |
| DD-0022-02 | DR-0022-02 | 已确认 | 固定使用DeepSeek官方0.1.6-alpha.2 Browser Use Playwright MCP插件，不以Claude Code或Harness Web聊天界面代替程序接口。 |

## 当前有效任务

| TK | DR/DD | 状态 | 内容 |
|---|---|---|---|
| TK-0022-01 | DR-0022-01 / DD-0022-01 / DD-0022-02 | 已完成 | 核对官方接口，固定并安装DeepSeek Harness和Browser Use依赖，建立隔离配置。 |
| TK-0022-02 | DR-0022-01 / DR-0022-03 / DD-0022-01 | 已完成 | 实现受控协调器、合成站点、候选校验和异常/取消工程测试。 |
| TK-0022-03 | DR-0022-02 / DD-0022-02 | 已完成 | 在预算内执行真实Harness探针并独立执行其候选。 |
| TK-0022-04 | DR-0022-01 / DR-0022-02 / DR-0022-03 / DD-0022-01 / DD-0022-02 | 已完成 | 形成脱敏报告、结论与成本记录，检查并推送指定分支。 |

## 当前有效验证项

| VT | DR | 状态 | 内容 | 当前证据 |
|---|---|---|---|---|
| VT-0022-01 | DR-0022-01 | 人工待确认 | 固定版本安装、版本输出、配置解析和隔离边界检查。 | 命令：npm run setup:harness；dsh --version；dsh --profile headless --patch config/browser.cordis.yml --help；退出码：0；测试数量：3；失败数量：0；跳过数量：0；证据：harness-probe/PROBE_REPORT.md |
| VT-0022-02 | DR-0022-01 / DR-0022-03 | 人工待确认 | 启动失败、取消、超时、模型中断、缺文件、不完整报告、无自动重启和日志脱敏工程测试。 | 命令：cd harness-probe && npm test；退出码：0；测试数量：12；失败数量：0；跳过数量：0；证据：harness-probe/PROBE_REPORT.md |
| VT-0022-03 | DR-0022-02 | 人工待确认 | 真实Harness浏览器交互、候选产出及候选Playwright执行。 | 命令：cd harness-probe && npm run probe（初验一次、集中修复后复验一次）；退出码：1；测试数量：1；失败数量：1；跳过数量：0；证据：harness-probe/evidence/attempt-summary.json（初验为0测试，复验为1测试1失败） |
| VT-0022-04 | DR-0022-01 / DR-0022-02 / DR-0022-03 | 人工待确认 | 敏感信息/本地产物检查，Git提交、推送和远端SHA核对。 | 命令：实际凭据扫描；git push -u origin codex/test-workbench-m2-probe；git ls-remote --heads origin refs/heads/codex/test-workbench-m2-probe；退出码：0；测试数量：1；失败数量：0；跳过数量：0；证据：首批提交a77e57d35c5c42896dca48bdb9f8219d4b3206ff已与远端一致；最终收口提交后实时核对 |

## 人工待确认项

- [ ] 公司批准DeepSeek端点是否支持官方Harness当前协议，由首次真实初始化结果确认，不预设成功。

## 本轮禁止实现内容

- 不得使用Claude Code、Harness聊天页面自动点击或Codex手写候选冒充Harness能力。
- 不得修改M1批准业务脚本、历史结果、src/public/pilot/heldout-lab或用户全局模型/Harness配置。
- 不得为探针临时建设大型安全平台、修改Harness核心、连续切换多个版本/模型或自动重启失败任务。
- 不得提交密钥、Cookie、原始私有会话、本地媒体或完整敏感环境变量。
