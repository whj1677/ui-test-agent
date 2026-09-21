<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0022 设计

## 设计标识

| DD | 关联 DR | 状态 | 方案摘要 | 设计理由 |
|---|---|---|---|---|
| DD-0022-01 | DR-0022-01 / DR-0022-02 / DR-0022-03 | 已确认 | 新增独立harness-probe子工程，以普通Node协调程序驱动固定版dsh Headless/SDK，并把Harness home、页面、输出和证据全部置于Git忽略目录。 | 最小化对M1及用户全局环境的影响，并让真实调用、工程模拟和候选执行三类证据明确分账。 |
| DD-0022-02 | DR-0022-02 | 已确认 | 固定使用DeepSeek官方0.1.6-alpha.2 Browser Use Playwright MCP插件，不以Claude Code或Harness Web聊天界面代替程序接口。 | 0.1.5-rc.2尚无官方交互式浏览器插件；实验版风险单独披露。 |

## 接口与数据流

- Node协调器 -> dsh程序接口 -> DeepSeek模型 -> 官方Browser Use/Playwright MCP -> 127.0.0.1合成页面；Harness文件工具 -> 专用输出目录 -> 协调器校验 -> 独立Playwright执行。

## 模块文档影响

- 本次无需模块文档变更，原因：harness-probe是与现有产品模块隔离的限时可行性探针，其安装、接口、边界和停止结论统一由harness-probe/README.md与PROBE_REPORT.md维护；M1 workbench、src、public、pilot、heldout-lab及批准脚本不修改。

## 风险与回滚

- 官方Harness和Browser Use仍为开发预览/实验版本，固定版本可复现但不能承诺兼容后续版本。
- 若公司网关协议或凭据不兼容，结论降为B/C并停止，不改Harness核心或连续切换模型版本。
- 删除独立子工程和Git忽略的本地目录即可回滚；不触碰用户全局配置。
