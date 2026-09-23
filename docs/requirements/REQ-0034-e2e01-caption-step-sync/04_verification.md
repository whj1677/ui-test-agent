<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0034 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0034-01 | DR-0034-01 | 已确认 | 集成测试通过 | 工作台运行身份、独立编码校准、六条旧录像及详情组两条新产品运行核对；新运行可播放原视频并保留业务结果，但没有可验证的字幕与步骤定位。 | 真实命令、退出码、测试统计和产物路径 | 命令：node tests/e2e01-product-unavailable-browser.integration.mjs；退出码：0；测试数量：2；失败数量：0；跳过数量：0；证据：workbench/.local/e2e01-product-unavailable-browser/ | node tests/e2e01-product-unavailable-browser.integration.mjs | 0 | 2 | 0 | 0 | workbench/.local/e2e01-product-unavailable-browser/ |

## 本轮命令与环境

- 工作目录：workbench/
- 命令：npm run test:e2e01-clock-calibration
- 命令：node --test tests/e2e01-caption-timeline.test.mjs
- 命令：node tests/e2e01-caption-browser.integration.mjs
- 命令：node tests/e2e01-product-unavailable-browser.integration.mjs
- 命令：node --check server/build/caption-video.mjs && node --check server/build/trial-timeline.mjs && node --check web-v2/app.js
- 环境：本机Node锁定依赖；Playwright 1.62.1；工作台4322；原六条运行使用独立数据目录workbench/.local/six-case-e2e；校准媒体留在workbench/.local/e2e01-video-clock-calibration-*。

## 结论

- v2服务实际用于详情组2次产品运行；业务结果为TC-003 PASSED、TC-006指定断言FAILED，但原视频画面缺乏唯一时间锚且短步骤精度不足，未生成新字幕版。v3安全拒绝重复画面锚已加载；其余四条按首组门槛暂停，整体开发自测未完成。
