<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0034 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0034-01 | DR-0034-01 | 已确认 | 集成测试通过 | 工作台运行ID身份行为、独立真实编码视频校准和六条旧录像逐条映射能力复核；工作台行为测试通过，但六条旧记录不具备足以安全跳转的产品时间轴。 | 真实命令、退出码、测试统计和产物路径 | 命令：npm run test:e2e01-clock-calibration；退出码：0；测试数量：1；失败数量：0；跳过数量：0；证据：workbench/.local/e2e01-video-clock-calibration-*/calibration-summary.json | npm run test:e2e01-clock-calibration | 0 | 1 | 0 | 0 | workbench/.local/e2e01-video-clock-calibration-*/calibration-summary.json |

## 本轮命令与环境

- 工作目录：workbench/
- 命令：npm run test:e2e01-clock-calibration
- 命令：node --test tests/e2e01-caption-timeline.test.mjs
- 命令：node tests/e2e01-caption-browser.integration.mjs
- 命令：node --check server/build/caption-video.mjs && node --check server/build/trial-timeline.mjs && node --check web-v2/app.js
- 环境：本机Node锁定依赖；Playwright 1.62.1；工作台4322；原六条运行使用独立数据目录workbench/.local/six-case-e2e；校准媒体留在workbench/.local/e2e01-video-clock-calibration-*。

## 结论

- 真实工作台浏览器身份选择回归和独立编码视频校准完成；历史六条业务运行原PASSED/FAILED未变化。四条旧视频映射不充分，排序两条的精度仍跨相邻步骤界线；六条均禁用精确跳转。未重录产品运行，故整体开发自测未完成，不宣称时间轴收尾通过。
