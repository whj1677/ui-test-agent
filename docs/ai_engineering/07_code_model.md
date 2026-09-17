# 07 代码模型

项目：`通用 Web UI 测试 Agent · v0.3.0`

## 结论

本文档记录项目代码模型索引初稿。模块细节放在 `docs/modules/` 下，本文档只维护入口、核心模块、数据流索引和维护规则。

## 入口文件

| 类型 | 路径 | 说明 |
|---|---|---|
| 项目入口/脚本 | package.json | 项目文件存在，具体用途待确认 |

## 核心模块索引

| 模块 | 文档 | 代码路径 | 状态 |
|---|---|---|---|
| release_runtime | `docs/modules/release_runtime.md` | src、public、启动维护入口 | 内部候选运行与维护契约，部分验证 |
| optimization | `docs/modules/optimization.md` | optimization | 扫描生成，待确认 |
| public | `docs/modules/public.md` | public | 扫描生成，待确认 |
| vendor | `docs/modules/vendor.md` | vendor | 扫描生成，待确认 |

## 模块文档命名

1. 使用小写字母、数字和下划线。
2. 文件名表达模块职责，例如 `auth_module.md`、`http_api.md`、`build_config.md`。
3. 每个模块文档包含职责、接口、输入输出、依赖、数据流和验证方式。

## 同步规则

1. 新增、删除或重命名模块时，同步本文档。
2. 模块职责、输入输出、状态、副作用或数据流变化时，同步对应模块文档。
3. 跨模块数据流变化时，同步 `01_architecture.md`。
4. 代码、测试、配置、接口、日志、文案、业务行为或验收标准变更触达模块时，必须创建或更新 `docs/modules/<module>.md`；如果确实没有模块影响，在当前需求包 `02_design.md` 写明 `本次无需模块文档变更，原因：...`。
