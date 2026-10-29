# 设备台账合成 HTTP/JSON 协议 v1

技术契约来自 workbench/qa/20260926-req0038-completion/PROTOCOL.md；仅保留本次三个业务场景所需接口。不是客户协议或生产认证方案。业务预期来自 01-PRD.md，不能由实际响应反推或修改。

## 地址、输入与数据

Base URL：http://127.0.0.1:4401，仅监听回环地址。JSON 使用 UTF-8，写请求 Content-Type 为 application/json；不使用真实 Cookie、密码或 Token，不跟随重定向。
每次执行每条用例使用全新 runId，格式 [a-z0-9][a-z0-9-]{2,63}。文档中的示例 runId 不固定复用。
公开请求头 x-synthetic-role 只接受 editor 或 viewer；它是合成角色字段，不是认证。
基线对象为 {"code":"DEV-001","name":"循环泵一号","site":"东站","ratedPowerKw":80}。功率为数字，单位 kW。

## 初始化、读取、清理

| 方法与路径 | 请求与响应 |
|---|---|
| GET /health | 200，service=req0038-synthetic-ledger，schemaVersion=1；只识别服务，不算业务通过 |
| POST /__control/namespaces | JSON {"runId":"本次全新编号"}；新空间 201 {runId,created:true}，已有空间 200 {runId,created:false} 且不重置。测试初始前提不成立时不能继续声称初次新增 |
| GET /api/v1/namespaces/{runId}/devices | 200 {runId,items:[...],total:N}；未传 code 为整个台账，可用 ?code=DEV-007 精确过滤 |
| GET /api/v1/namespaces/{runId}/devices/{code} | 存在时 200 {runId,item:{code,name,site,ratedPowerKw}}；不存在 404 DEVICE_NOT_FOUND |
| DELETE /__control/namespaces/{runId} | 200 {runId,deleted:true}；已不存在 deleted:false。只删除自身空间，不使用通配符 |
| GET /__control/baseline | 200 {items:[基线完整对象],total:1}；清理后仍保留 DEV-001 |

未初始化或已清理的业务命名空间返回 404 NAMESPACE_NOT_FOUND，不隐式创建。初始化与清理为本次合成测试编排接口，不扩展产品业务需求。

## 创建请求

POST /api/v1/namespaces/{runId}/devices，请求头 x-synthetic-role，JSON 四字段 code、name、site、ratedPowerKw。
code/name/site 为非空文本、首尾无空白，长度不超过 100；ratedPowerKw 为有限正数。原练习只使用下表合法输入，不另生字段边界测试。

| 场景 | 请求 | 响应与独立读回 |
|---|---|---|
| 正常新增 | editor；{"code":"DEV-007","name":"冷却泵二号","site":"西站","ratedPowerKw":110} | 201 {runId,created:true,item:{输入四字段}}；独立 GET DEV-007 恰好一条且四字段一致，DEV-001 不变，total=2 |
| 重复编号 | editor；{"code":"DEV-001","name":"不得覆盖的设备","site":"西站","ratedPowerKw":110} | 409 {runId,created:false,error:{code:"DUPLICATE_CODE",message:非空重复说明}}；独立 GET 整个台账与提交前一致，DEV-001 不覆盖，total=1 |
| viewer 拒绝 | viewer；{"code":"DEV-008","name":"观察泵三号","site":"西站","ratedPowerKw":110} | 403 {runId,created:false,error:{code:"FORBIDDEN",message:非空拒绝说明}}；独立 GET ?code=DEV-008 的 items=[]，整个台账与提交前一致，total=1 |

断言必须同时包含响应类别、真实业务字段/数量和后置不变条件，不能只断言接口未抛异常。拒绝用例按照其原拒绝预期判断，不属于错误注入或正常新增失败。

## 隔离与执行范围

只允许本机目标、GET/POST/DELETE；控制路径 /__control/namespaces/ 与业务路径 /api/v1/namespaces/。初始化实际路径为 /__control/namespaces，清理为 /__control/namespaces/{runId}。
测试计划使用 {{runId}} 引用执行器产生的当前命名空间；每条用例单独初始化、独立观察、精确清理。不得修改/清理别的 runId。
没有修改设备或删除设备接口，不加入这类业务步骤。通用故障注入、读栅栏、超时和取消接口不在本次练习资料中。
