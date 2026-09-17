<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0002 用户需求

## 原始输入

> 关联REQ-0001-release-readiness。用户要求发布前大量不同界面验证，修改前建包，每个问题修复后独立提交同步。此包仅修复嵌套标签控件漏观察，不改变用例业务预期或执行授权。

## 结构化理解

| UN | 状态 | 目标 | 约束 | 成功标准 |
|---|---|---|---|---|
| UN-0002-01 | 已确认 | 原生表单不同标签布局可被Agent可靠发现并绑定，无法唯一绑定时给出证据而非静默遗漏。 | 只修复控件观察和对应查询绑定，保留原输入、唯一性/身份/敏感字段/写入边界。 | 真实Chromium正反例稳定验证，回归通过，独立Git提交并同步。 |

## 已确认事实

- 基线a71b88f已与私有远端同步，4179运行旧冻结构建不重启。
- snapshot使用labels[0].innerText优先生成label定位，映射不唯一时仅对按钮/链接/表格记录gap，输入/选择控件可能静默丢失。
- 已有查询选择用例使用for标签，不能代表包含select的嵌套label。
- 复现2项失败，日志validation/REQ-0002-before.log：getByLabel精确园区计数0，getByRole combobox/园区计数1；snapshot控件和gap均空。
- 修复后13项针对性与4文件15项受影响浏览器TAP检查通过；同一实际节点及自定义错误适配器反例均验证。
- 全量runtime383项中382通过1失败，validation/REQ-0002-runtime.log；失败为未改动Store的并发读取/rename EPERM，孤立复跑1项通过，不能据此宣称全量稳定。需另包修复并保留本次失败。

## 推断与待确认

- 先在真实Chromium比较标签/角色定位和同节点证据，再选最小修复；不把手写标签规则宣称为完整无障碍命名实现。
