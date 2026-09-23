<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0034 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0034-02 | DR-0034-02 | 已确认 | 集成测试通过 | 观察适配器有序采集、六条产品运行及工作台/独立媒体真实浏览器检查。 | 命令、退出码、截图、视频解码画面、运行ID与哈希 | 命令：node tests/step-observer.integration.mjs && node tests/step-replay-browser.integration.mjs；退出码：0；测试数量：35；失败数量：0；跳过数量：0；证据：workbench/.local/step-observer-check-YO7U01/ and workbench/.local/step-replay-browser/ (engineering only) | node tests/step-observer.integration.mjs && node tests/step-replay-browser.integration.mjs | 0 | 35 | 0 | 0 | workbench/.local/step-observer-check-YO7U01/ and workbench/.local/step-replay-browser/ (engineering only) |
| VT-0034-01 | DR-0034-01 | 已确认 | 集成测试通过 | 工作台运行身份、独立编码校准、六条旧录像及详情组两条新产品运行核对；新运行可播放原视频并保留业务结果，但没有可验证的字幕与步骤定位。 | 真实命令、退出码、测试统计和产物路径 | 命令：node tests/e2e01-product-unavailable-browser.integration.mjs；退出码：0；测试数量：2；失败数量：0；跳过数量：0；证据：workbench/.local/e2e01-product-unavailable-browser/ | node tests/e2e01-product-unavailable-browser.integration.mjs | 0 | 2 | 0 | 0 | workbench/.local/e2e01-product-unavailable-browser/ |

## 本轮命令与环境

- 工作目录：workbench/
- 命令：npm run test:e2e01-clock-calibration
- 命令：node --test tests/e2e01-caption-timeline.test.mjs
- 命令：node tests/e2e01-caption-browser.integration.mjs
- 命令：node tests/e2e01-product-unavailable-browser.integration.mjs
- 命令：node tests/step-observer.integration.mjs
- 命令：node tests/step-replay-browser.integration.mjs
- 命令：npm test
- 命令：node --check server/build/caption-video.mjs && node --check server/build/trial-timeline.mjs && node --check web-v2/app.js
- 环境：本机Node锁定依赖；Playwright 1.62.1；工作台4322；原六条运行使用独立数据目录workbench/.local/six-case-e2e；校准媒体留在workbench/.local/e2e01-video-clock-calibration-*。

## 结论

- 历史v2服务实际用于详情组2次产品运行并保留业务结果；当前新方案通过工程步骤采图和回放浏览器夹具，但4322仍加载v3，正常重启被执行策略拒绝。本批新版产品运行0次、六条回放未验证，整体开发自测未完成。
