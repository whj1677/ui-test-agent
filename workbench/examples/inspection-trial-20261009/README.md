# 储能站巡检工单 · 手动体验包

当前阶段：内容准备已核验，等待用户自行导入。最新范围：提供独立的前端、后端、12 条预置用例及通讯协议，由用户自己新建项目、导入、生成和运行脚本。

交付范围：本目录的练习站点、PRD、用例包、协议、准备与启动脚本、验证证据和操作指引。使用公开合成数据，无生产连接，无真实账号。旧项目和数据保持原状。

验收：4460 页面与 API 可用；12 条用例与协议一致；导入文件和配置说明可用；核验数据已清理。停止点：文件交付、用户自行导入。本任务不调用工作台模型，不生成业务自动化脚本，不扩展产品优化。

范围变更记录：收到“你准备内容，我来导入”之前，已建立 project-148c9560-700b-4020-a4fc-7b57cc739bae 并完成 12 条用例和协议的兼容性检查，脚本与执行记录均为空。旧的 35 个项目保持不变。此预建项目保留，但不作为此次用户自行导入的入口；之后不再自动导入。

交付入口：[00-开始这里.md](导入文件/00-开始这里.md)。内容包包含两份原生用例 JSON、一份完整通讯协议、需求说明、可读用例说明和操作指引。

验证证据：verification.json；6 个 API 场景、6 个页面场景、并发写入及数据隔离检查。首轮 UI 验证遇到测试定位器与嵌套 select 标签匹配问题，更换为按可访问角色定位后复验 6 条，页面未因此修改。所有核验空间均已精确清理。范围仅为材料与练习站点准备，不代表 Test Agent 最终验收。

分工：主管负责用例、协议、配置和最终核验；1 个内部子 Agent 负责 target.mjs / target.html，请求 gpt-6-sol / medium。工作派发次数 1，实际费用未知。

## 合成练习契约 v1

服务仅监听 http://127.0.0.1:4460，页面 /inspection/，health 的 service=inspection-trial-20261009。

无登录，公开角色 editor / viewer 由 x-synthetic-role 请求头表示，不是身份认证机制。
每条用例使用全新 runId，格式 [a-z0-9][a-z0-9-]{2,63}。数据按命名空间持久化，仅精确清理自身空间。

初始列表按 code 升序，固定 3 条：

| code | title | station | priority | status |
|---|---|---|---|---|
| WO-1001 | PCS月度巡检 | EAST | HIGH | PENDING |
| WO-1002 | 消防设备检查 | WEST | NORMAL | PENDING |
| WO-1003 | 电池温差复核 | EAST | NORMAL | DONE |

业务接口：GET /api/v1/namespaces/{runId}/orders（可选精确 code、station、status 过滤，AND 组合）；GET 同路径 /{code} 详情；POST orders 新增；POST orders/{code}/complete 完成。新增仅接收 code/title/station/priority，服务补 status=PENDING。editor 可写，viewer 写请求 403 FORBIDDEN；重复 code 为 409 DUPLICATE_CODE；已 DONE 再完成为 409 ALREADY_COMPLETED。三类拒绝均不改变列表。

新增成功 201 {runId,created:true,item}；完成成功 200 {runId,updated:true,item}；列表 200 {runId,items,total}；详情 200 {runId,item}；错误 {runId,error:{code,message}}，message 为非空中文。
校验：code 为 WO- 加 4 位数字；title 去除首尾空白后 1–60 字；station 为 EAST/WEST；priority 为 HIGH/NORMAL；无效输入 400 VALIDATION_ERROR，不写入。

控制接口：POST /__control/namespaces {runId}，新空间 201 {runId,created:true}，已有空间 200 {runId,created:false} 且不重置；DELETE /__control/namespaces/{runId} 返回 200 {runId,deleted:boolean}；GET /__control/baseline 返回 {items,total:3}。未初始化或清理后的空间业务请求 404 NAMESPACE_NOT_FOUND。控制接口仅为练习准备/清理，不是业务用例步骤。

六种场景各有 UI/API 对应：新增 WO-2001 储能舱温控巡检 WEST HIGH；重复 WO-1001；viewer 新增 WO-2002；组合筛选 EAST + PENDING；完成 WO-1001；再次完成初始已完成 WO-1003。每条独立初始化、读回、精确清理。
