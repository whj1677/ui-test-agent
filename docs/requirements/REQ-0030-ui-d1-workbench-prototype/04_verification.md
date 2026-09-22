<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0030 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0030-01 | DR-0030-01 / DR-0030-05 | 已确认 | 单元测试通过 | 现有能力矩阵逐项对应真实页面/API/状态，未实现能力不伪装可用。 | 代码路径、接口列表和交互说明 | 命令：node --test workbench/ui-prototype/prototype.test.mjs；退出码：0；测试数量：6；失败数量：0；跳过数量：0；证据：workbench/ui-prototype/UI_D1_ACCEPTANCE_REPORT.md | node --test workbench/ui-prototype/prototype.test.mjs | 0 | 6 | 0 | 0 | workbench/ui-prototype/UI_D1_ACCEPTANCE_REPORT.md |
| VT-0030-02 | DR-0030-01 / DR-0030-02 / DR-0030-03 | 已确认 | 集成测试通过 | 项目创建、多次导入预览、紧凑用例表、成对步骤、状态分层和跨对象定位可点击。 | 静态检查与真实浏览器操作 | 命令：Chromium: 创建项目 → Excel五类预览/确认 → JSON追加/重复预览 → 选择2条并触发JSON导出；退出码：0；测试数量：1；失败数量：0；跳过数量：0；证据：workbench/ui-prototype/screenshots/03-import-preview.png | Chromium: 创建项目 → Excel五类预览/确认 → JSON追加/重复预览 → 选择2条并触发JSON导出 | 0 | 1 | 0 | 0 | workbench/ui-prototype/screenshots/03-import-preview.png |
| VT-0030-03 | DR-0030-04 | 已确认 | 集成测试通过 | 运行详情可查看中文步骤、预期/实际、演示截图和可控合成录像，技术信息折叠且无伪造时间点。 | 真实浏览器媒体交互和DOM状态 | 命令：Chromium 1920x1080: 结果详情 → 截图加载 → WebM播放/暂停/拖动 → 切换步骤保持3.6秒位置 → Trace说明；退出码：0；测试数量：1；失败数量：0；跳过数量：0；证据：workbench/ui-prototype/screenshots/06-run-result-detail.png | Chromium 1920x1080: 结果详情 → 截图加载 → WebM播放/暂停/拖动 → 切换步骤保持3.6秒位置 → Trace说明 | 0 | 1 | 0 | 0 | workbench/ui-prototype/screenshots/06-run-result-detail.png |
| VT-0030-04 | DR-0030-05 | 已确认 | 集成测试通过 | A/B/C三条流程在真实浏览器走通，并在1280×800、1440×900和1920×1080检查六页无遮挡。 | 浏览器步骤记录、视口尺寸、关键截图路径和限制 | 命令：Chromium A/B/C流程；六页×1280x800/1440x900/1920x1080共18组布局核对；退出码：0；测试数量：3；失败数量：0；跳过数量：0；证据：workbench/ui-prototype/UI_D1_ACCEPTANCE_REPORT.md | Chromium A/B/C流程；六页×1280x800/1440x900/1920x1080共18组布局核对 | 0 | 3 | 0 | 0 | workbench/ui-prototype/UI_D1_ACCEPTANCE_REPORT.md |

## 本轮命令与环境

- 工作目录：独立worktree的workbench/ui-prototype；不启动正式workbench服务。
- 命令：node workbench/ui-prototype/serve.mjs 4311
- 命令：浏览器访问 http://127.0.0.1:4311/#/projects 并执行A/B/C流程
- 环境：Windows本机；Node.js 22；桌面Chromium；本地127.0.0.1静态服务。

## 结论

- 静态测试6/6通过；真实Chromium三条原型流程和六屏三尺寸布局通过；原型交付停在用户核对，不作为真实执行或批准证据。
