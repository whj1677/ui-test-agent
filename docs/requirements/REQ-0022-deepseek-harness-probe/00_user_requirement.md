<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0022 用户需求

## 原始输入

> 从M1基线7b4416cc建立独立分支，安装并以普通程序受控调用DeepSeek官方Harness；在隔离工作目录中通过浏览器工具访问无登录合成页面、产出并执行最小Playwright候选，同时验证启动失败、取消、超时和不完整结果的封闭处理。只做可行性探针，不接正式Web建例页面或Harness后续集成。

## 结构化理解

| UN | 状态 | 目标 | 约束 | 成功标准 |
|---|---|---|---|---|
| UN-0022-01 | 已确认 | 以固定版本DeepSeek官方Harness完成一次可审计的程序化浏览器工具调用、候选文件产出及独立执行闭环，并形成A/B/C可行性结论。 | 仅暴露合成页面与专用输出目录；不使用Claude Code代替，不修改M1批准脚本与历史，不调用建例Web，不自动重试整项任务；真实模型最多初验一次及明确配置修复后复验一次。 | 协调程序能获取进度和终态，Harness实际调用浏览器工具并写出候选，候选在隔离环境执行；失败、取消、缺文件或不完整报告均不得判成功；脱敏代码与报告推送指定新分支。 |

## 已确认事实

- 基线为7b4416ccbb3ee5ebb4a68ea12e2cabc82d349590，工作分支为codex/test-workbench-m2-probe。
- 本机初始只发现Claude Code 2.1.218，未发现DeepSeek Harness命令；用户明确要求安装和使用DeepSeek自己的Harness。
- DeepSeek官方npm包@deepseek-ai/dsh当前alpha标签为0.1.6-alpha.2；官方交互式Browser Use能力同属该实验版本。

## 推断与待确认

- 公司现有模型凭据和网关是否与官方DeepSeek适配器兼容，须以不泄露密钥的真实启动结果确认。
