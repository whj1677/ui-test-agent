# 储能站巡检工单 · 公开合成需求 v1

本需求仅为测试 Agent 手动练习，由本次准备任务定义，不代表真实云平台验收规则。

## 使用场景

测试人员分别体验前端与 HTTP/JSON 后端脚本生成、结果核对和执行。站点无真实登录；editor、viewer 为公开模拟角色。每条用例使用独立数据空间。

## 基线与字段

固定初始列表：

- {"code":"WO-1001","title":"PCS月度巡检","station":"EAST","priority":"HIGH","status":"PENDING"}
- {"code":"WO-1002","title":"消防设备检查","station":"WEST","priority":"NORMAL","status":"PENDING"}
- {"code":"WO-1003","title":"电池温差复核","station":"EAST","priority":"NORMAL","status":"DONE"}

字段 code 为 WO-加4位数字；title 去首尾空白后1至60字；station 取 EAST/WEST；priority 取 HIGH/NORMAL；status 取 PENDING/DONE。所有列表按 code 升序。

## 业务规则

1. editor 可新增工单，初始状态 PENDING。编号唯一。
2. 重复编号拒绝，不得覆盖任何记录。
3. viewer 可以查询；新增和完成均拒绝，不得改变数据。
4. code、station、status 是精确过滤条件，多条件 AND；无条件返回整个列表。
5. editor 可将 PENDING 工单变为 DONE，其他字段和其他记录不变。
6. DONE 工单再次完成必须拒绝，整个列表不变。
7. 无效创建字段返回校验错误且不写入。本批12条核心练习不扩展边界矩阵。

## 验收证据

成功须核对独立读回的完整业务字段；拒绝须核对错误类型和整个列表不变。提示、HTTP 状态或总数单项不足以证明业务正确。初始化和清理是练习编排能力，不是工单业务功能。

## 本批场景

- 01：新增工单并独立读回；总数 4；WO-2001 恰好一条，五字段为 {"code":"WO-2001","title":"储能舱温控巡检","station":"WEST","priority":"HIGH","status":"PENDING"}；原有三条完整对象 [{"code":"WO-1001","title":"PCS月度巡检","station":"EAST","priority":"HIGH","status":"PENDING"},{"code":"WO-1002","title":"消防设备检查","station":"WEST","priority":"NORMAL","status":"PENDING"},{"code":"WO-1003","title":"电池温差复核","station":"EAST","priority":"NORMAL","status":"DONE"}] 保持不变。
- 02：重复编号被拒绝且原记录不被覆盖；整个列表 items 与提交前及初始基线完全相同：[{"code":"WO-1001","title":"PCS月度巡检","station":"EAST","priority":"HIGH","status":"PENDING"},{"code":"WO-1002","title":"消防设备检查","station":"WEST","priority":"NORMAL","status":"PENDING"},{"code":"WO-1003","title":"电池温差复核","station":"EAST","priority":"NORMAL","status":"DONE"}]；total=3。不得仅核对总数或单个提示。
- 03：只读角色新增被拒绝且数据不变；整个列表 items 与提交前及初始基线完全相同：[{"code":"WO-1001","title":"PCS月度巡检","station":"EAST","priority":"HIGH","status":"PENDING"},{"code":"WO-1002","title":"消防设备检查","station":"WEST","priority":"NORMAL","status":"PENDING"},{"code":"WO-1003","title":"电池温差复核","station":"EAST","priority":"NORMAL","status":"DONE"}]；total=3。不得仅核对总数或单个提示。不存在 WO-2002。
- 04：按东站与待处理组合查询；整个列表 items 与提交前及初始基线完全相同：[{"code":"WO-1001","title":"PCS月度巡检","station":"EAST","priority":"HIGH","status":"PENDING"},{"code":"WO-1002","title":"消防设备检查","station":"WEST","priority":"NORMAL","status":"PENDING"},{"code":"WO-1003","title":"电池温差复核","station":"EAST","priority":"NORMAL","status":"DONE"}]；total=3。不得仅核对总数或单个提示。
- 05：待处理工单完成并持久化；总数 3；WO-1001 五字段为 {"code":"WO-1001","title":"PCS月度巡检","station":"EAST","priority":"HIGH","status":"DONE"}；其余两条完整对象 [{"code":"WO-1002","title":"消防设备检查","station":"WEST","priority":"NORMAL","status":"PENDING"},{"code":"WO-1003","title":"电池温差复核","station":"EAST","priority":"NORMAL","status":"DONE"}] 保持不变。
- 06：已完成工单禁止重复完成；整个列表 items 与提交前及初始基线完全相同：[{"code":"WO-1001","title":"PCS月度巡检","station":"EAST","priority":"HIGH","status":"PENDING"},{"code":"WO-1002","title":"消防设备检查","station":"WEST","priority":"NORMAL","status":"PENDING"},{"code":"WO-1003","title":"电池温差复核","station":"EAST","priority":"NORMAL","status":"DONE"}]；total=3。不得仅核对总数或单个提示。

本次只准备环境和预置人工用例；最终脚本生成、执行与人工验收由用户操作。
