# 00 项目概要

## 结论

`通用 Web UI 测试 Agent · v0.3.0` 的初始上下文已根据项目文件自动扫描生成。项目描述：面向不同业务项目的测试工作台：导入人工用例 → 核对歧义 → 登录确认一次 → Agent 自动探索页面与弹窗 → 自动生成候选计划 → 集中核对 → 浏览器执行 → 查看事实和离线报告。

业务目标、验收标准、生产部署边界仍需人工确认。

## 项目定位

1. 项目名称：`通用 Web UI 测试 Agent · v0.3.0`。
2. 项目摘要：面向不同业务项目的测试工作台：导入人工用例 → 核对歧义 → 登录确认一次 → Agent 自动探索页面与弹窗 → 自动生成候选计划 → 集中核对 → 浏览器执行 → 查看事实和离线报告。
3. 技术栈线索：package.json。
4. 扫描日期：2026-09-16。

## 目录概览

```text
data/
docs/
optimization/
public/
src/
tests/
validation/
vendor/
.gitignore
.prettierignore
.prettierrc.json
AGENTS.md
CLAUDE.md
DESIGN.md
package-lock.json
package.json
README.md
v0.2.1日志与真实联调.md
v0.2修改与验证.md
v0.3自动探索与验证.md
validation-self-repair-tests.log
任务说明.md
停止.cmd
停止.ps1
```

## 范围

包含：

1. `src`：项目源码目录线索。

不包含：

1. 未经确认的生产环境、私有依赖源、账号密钥和发布流程。
2. 未从项目文件直接证明的业务承诺。

## 后续处理项

1. 人工确认真实业务目标和验收方式。
2. 审查自动识别的源码目录、测试目录和候选命令。
3. 如项目有私有构建环境、远端设备或硬件依赖，补充到 `04_build_test.md`。
