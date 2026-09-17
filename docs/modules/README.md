# 模块文档索引

## 结论

本目录记录 `通用 Web UI 测试 Agent · v0.3.0` 的模块级设计、接口、输入输出、依赖关系、数据流和验证方式。以下索引由 Bootstrap 扫描生成，模块职责需后续人工确认。

## 索引

| 模块 | 文档 | 代码路径 | 说明 | 状态 |
|---|---|---|---|---|
| release_runtime | `docs/modules/release_runtime.md` | src、public、启动维护入口 | 构建身份、同源清理保护与本地安装恢复 | 当前内部候选，部分验证 |
| optimization | `docs/modules/optimization.md` | optimization | 源码目录，职责待人工确认 | 扫描生成，待确认 |
| public | `docs/modules/public.md` | public | 源码目录，职责待人工确认 | 扫描生成，待确认 |
| vendor | `docs/modules/vendor.md` | vendor | 源码目录，职责待人工确认 | 扫描生成，待确认 |

## 维护规则

1. 新增、删除或重命名模块时，同步本索引和 `docs/ai_engineering/07_code_model.md`。
2. 模块职责、接口、输入输出、状态、副作用、错误处理或数据流变化时，同步对应模块文档。
3. 代码、测试、配置、接口、日志、文案、业务行为或验收标准变更触达具体模块时，必须创建或更新对应 `docs/modules/<module>.md`。
4. 如果本轮变更确实不影响模块文档，在对应需求包 `02_design.md` 记录：`本次无需模块文档变更，原因：...`。
5. 不确定模块边界时，先记录到 `07_code_model.md`，后续处理后再拆分。
