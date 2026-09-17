# AI 工程上下文迁移记录

## 结论

本工程已接入标准 AI 工程上下文体系。本文档记录迁移方式、文件范围、人机分工和待确认项。

## 迁移范围

1. 根规则入口：`AGENTS.md`、`CLAUDE.md`。
2. 工程级上下文：`docs/ai_engineering/`。
3. 模块级文档：`docs/modules/`。
4. 可复用经验：`docs/reusable/`。

## AI 已完成

1. 创建缺失的上下文模板文件。
2. 在已有规则文件中追加或更新 managed block。
3. 根据可扫描事实草拟文档结构。

## 待确认

1. 项目真实业务目标和验收标准。
2. 架构边界和关键设计决策。
3. 接口协议、配置、环境变量和安全边界。
4. 构建、测试、部署和发布命令。
5. 所有标记为 `待确认` 或 `人工待确认` 的内容。

## 验证命令

```powershell
git status --short
rg -n "待确认|人工待确认|ai-engineering-context|docs/ai_engineering" AGENTS.md CLAUDE.md docs
```
