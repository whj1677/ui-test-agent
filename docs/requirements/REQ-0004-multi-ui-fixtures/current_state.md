<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0004 当前状态

- 需求标题：多结构复杂UI验收夹具与独立真值

## 元数据

- 需求状态：已确认
- 治理分级：G2
- 当前版本：1
- 最后更新：2026-09-17

## 当前有效用户需求

| UN | 状态 | 内容 |
|---|---|---|
| UN-0004-01 | 已确认 | 提供可独立复跑、不为Agent降低难度的复杂UI验收基线。 |

## 当前有效开发需求

| DR | 状态 | 内容 |
|---|---|---|
| DR-0004-01 | 已确认 | 原8页面和导入JSON字节保留，新建两组各8条，统一列明动作/期望/前置/清理/授权分类。 |
| DR-0004-02 | 已确认 | 建设结构不同的两站：卡片列表/异步筛选/抽屉与内层弹窗；多步表单/联动/原生模态/受控CRUD。 |
| DR-0004-03 | 已确认 | 独立于Agent实现的真实Chromium参考检查验证页面行为及预置错误，再做导入/安全/桌面窄屏检查。 |
| DR-0004-04 | 已确认 | 冻结页面/用例/分类真值SHA与重置说明、有限服务器/版本说明，随单独提交同步。 |

## 当前有效设计

| DD | DR | 状态 | 内容 |
|---|---|---|---|
| DD-0004-01 | DR-0004-01 | 已确认 | 原8字节副本与分站导入文件分离，分类真值单独保存。 |
| DD-0004-02 | DR-0004-02 | 已确认 | 本机3独立origin；原站4190不动，新站4191/4192，允许临时端口做自检。 |
| DD-0004-03 | DR-0004-03 | 已确认 | 原生Playwright参考检查直接按冻结业务断言操作，源测试不被站点服务。 |
| DD-0004-04 | DR-0004-04 | 已确认 | 原素材/新素材分别记SHA，最后冻结manifest再核对并Git同步。 |

## 当前有效任务

| TK | DR/DD | 状态 | 内容 |
|---|---|---|---|
| TK-0004-01 | DR-0004-01 / DD-0004-01 | 已实现 | 冻结24用例及分类真值并归档原8。 |
| TK-0004-02 | DR-0004-02 / DD-0004-02 | 已实现 | 构建两个不同结构的复杂合成UI站点。 |
| TK-0004-03 | DR-0004-03 / DD-0004-03 | 已实现 | 独立验真、导入校验和视觉/交互检查。 |
| TK-0004-04 | DR-0004-04 / DD-0004-04 | 已实现 | 冻结摘要、使用说明、正式检查和Git同步。 |

## 当前有效验证项

| VT | DR | 状态 | 内容 | 当前证据 |
|---|---|---|---|---|
| VT-0004-01 | DR-0004-01 | 集成测试通过 | 24例输入/分类/原文保留 | 命令：node --test tests/acceptance-fixtures.test.mjs tests/acceptance-fixtures.integration.mjs；退出码：0；测试数量：32；失败数量：0；跳过数量：0；证据：validation/REQ-0004-reference.log |
| VT-0004-02 | DR-0004-02 | 集成测试通过 | 多结构页面行为 | 命令：node --test tests/acceptance-fixtures.test.mjs tests/acceptance-fixtures.integration.mjs；退出码：0；测试数量：32；失败数量：0；跳过数量：0；证据：validation/REQ-0004-reference.log |
| VT-0004-03 | DR-0004-03 | 集成测试通过 | 独立参考/反例及视觉检查 | 命令：node --test tests/acceptance-fixtures.test.mjs tests/acceptance-fixtures.integration.mjs；退出码：0；测试数量：32；失败数量：0；跳过数量：0；证据：validation/REQ-0004-reference.log |
| VT-0004-04 | DR-0004-04 | 集成测试通过 | 冻结清单与提交 | 命令：node --test tests/acceptance-fixtures.test.mjs tests/acceptance-fixtures.integration.mjs；退出码：0；测试数量：32；失败数量：0；跳过数量：0；证据：validation/REQ-0004-reference.log |

## 人工待确认项

- [ ] 真实模型复测依旧须恢复执行许可和本机安全连接；本包不通过其他路径调用。

## 本轮禁止实现内容

- 不得向Agent提供参考驱动、隐藏预置错误答案或手写计划。
- 不修改原8/业务期待，不将夹具自检称为Agent成功。
