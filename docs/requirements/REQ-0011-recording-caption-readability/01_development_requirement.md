<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0011 开发需求

## Schema

- schema: ai-engineering-context/req-package-v1

## 开发需求

| DR | 状态 | 开发需求 | 验收标准 | 约束 |
|---|---|---|---|---|
| DR-0011-01 | 已确认 | 新录制字幕优先上方并避开当前动作目标，备用下方位置留播放控件安全区；提高正文可读字号，报告不把录像强制压到500px高。 | 实际1360×900DOM几何验证上方/备用下方/长中文完整；新HTML视频显示高度大于原500限制，实际播放匹配和不一致结果的中文可读；截图缩放和断言结果不改。 | 原140字符分页、观测窗口、1800ms持留不变，字幕仍closed shadow/inert/pointer-events:none；不能注入业务成功文本供定位。 |

只有状态为 已确认 且验收标准明确的 DR 才能成为正式测试 oracle。
