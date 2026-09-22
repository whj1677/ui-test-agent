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
| VT-0030-05 | DR-0030-02 / DR-0030-03 | 已确认 | 集成测试通过 | 历史版本与旧任务保留完整冻结正文；阶段状态不被单项结果提前完成；选中和全部JSON均通过真实下载文件核对。 | 生产组装纯函数测试、真实Chromium修改/刷新/下载及下载文件独立解析 | 命令：node --test workbench/ui-prototype/prototype.test.mjs；Chromium v1任务→v2修改→v1/v2/旧任务刷新读回；下载监听→选中2条/全部120条JSON解析；退出码：0；测试数量：9；失败数量：0；跳过数量：0；证据：workbench/ui-prototype/UI_D1_CONSISTENCY_REVISION.md | node --test workbench/ui-prototype/prototype.test.mjs；Chromium v1任务→v2修改→v1/v2/旧任务刷新读回；下载监听→选中2条/全部120条JSON解析 | 0 | 9 | 0 | 0 | workbench/ui-prototype/UI_D1_CONSISTENCY_REVISION.md |
| VT-0030-06 | DR-0030-01 / DR-0030-02 / DR-0030-03 / DR-0030-04 / DR-0030-05 | 已确认 | 集成测试通过 | 从重置后的原型按用户指南复走三条体验路线，核对按钮名称、对象、导入数量、冻结版本、待澄清原因、真实下载事件、运行差异和媒体控制。 | 真实浏览器可见页面、下载事件、录像加载与播放状态及指南逐步预期 | 命令：Codex in-app Chromium：http://127.0.0.1:4311/#/projects，从重置状态执行 USER_TRIAL_GUIDE.md 路线 A/B/C；退出码：0；测试数量：3；失败数量：0；跳过数量：0；证据：workbench/ui-prototype/USER_TRIAL_GUIDE.md | Codex in-app Chromium：http://127.0.0.1:4311/#/projects，从重置状态执行 USER_TRIAL_GUIDE.md 路线 A/B/C | 0 | 3 | 0 | 0 | workbench/ui-prototype/USER_TRIAL_GUIDE.md |

## 本轮命令与环境

- 工作目录：独立worktree的workbench/ui-prototype；不启动正式workbench服务。
- 命令：node workbench/ui-prototype/serve.mjs 4311
- 命令：浏览器访问 http://127.0.0.1:4311/#/projects 并执行A/B/C流程
- 命令：按 workbench/ui-prototype/USER_TRIAL_GUIDE.md 从重置状态复走用户体验案例
- 环境：Windows本机；Node.js 22；桌面Chromium；本地127.0.0.1静态服务。

## 结论

- 原六屏与三流程证据保留；一致性修订测试9/9通过，真实Chromium版本快照、阶段条和选中/全部JSON下载通过；原型交付仍停在用户核对，不作为真实执行或批准证据。
- 用户体验案例已从重置状态复走：Excel预览2/1/1/1/1，JSON首次新增2条、重复导入3条，选中2条触发真实下载；DEMO-Q-001的v1与旧任务冻结内容在形成v2后保持，DEMO-C-004禁用原因明确；DEMO-S-001的新演示运行、预置失败差异、未执行步骤、截图和录像加载/播放均已核对。
