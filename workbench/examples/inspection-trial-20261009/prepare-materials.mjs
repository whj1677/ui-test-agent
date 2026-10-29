import fs from 'node:fs/promises';
const dir = new URL('./', import.meta.url);
const save = (name, value) => fs.writeFile(new URL(name, dir), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
const baseline = [
  {code:'WO-1001',title:'PCS月度巡检',station:'EAST',priority:'HIGH',status:'PENDING'},
  {code:'WO-1002',title:'消防设备检查',station:'WEST',priority:'NORMAL',status:'PENDING'},
  {code:'WO-1003',title:'电池温差复核',station:'EAST',priority:'NORMAL',status:'DONE'},
];
const create = {code:'WO-2001',title:'储能舱温控巡检',station:'WEST',priority:'HIGH'};
const duplicate = {code:'WO-1001',title:'不得覆盖的工单',station:'WEST',priority:'NORMAL'};
const viewer = {code:'WO-2002',title:'只读角色提交',station:'WEST',priority:'HIGH'};
const j = JSON.stringify;
const baselineText = j(baseline);
const unchanged = `整个列表 items 与提交前及初始基线完全相同：${baselineText}；total=3。不得仅核对总数或单个提示。`;
const created = `总数 4；WO-2001 恰好一条，五字段为 ${j({...create,status:'PENDING'})}；原有三条完整对象 ${baselineText} 保持不变。`;
const completed = `总数 3；WO-1001 五字段为 ${j({...baseline[0],status:'DONE'})}；其余两条完整对象 ${j(baseline.slice(1))} 保持不变。`;
const path = '/api/v1/namespaces/{{runId}}/orders';
const scenarios = [
  {id:'01',name:'新增工单并独立读回',role:'editor',data:create,
    ui:'在新增工单区域填写编号 WO-2001、标题 储能舱温控巡检、站点 西站（WEST）、优先级 高（HIGH），点击“新增工单”。',
    action:`POST ${path}；请求头 x-synthetic-role=editor；JSON ${j(create)}。`,
    response:`HTTP 201；created=true；item=${j({...create,status:'PENDING'})}。`,
    uiResponse:'显示新增成功提示；新增记录可见，状态待处理（PENDING）。', after:created},
  {id:'02',name:'重复编号被拒绝且原记录不被覆盖',role:'editor',data:duplicate,
    ui:'在新增工单区域填写编号 WO-1001、标题 不得覆盖的工单、站点 西站（WEST）、优先级 普通（NORMAL），点击“新增工单”。',
    action:`POST ${path}；请求头 x-synthetic-role=editor；JSON ${j(duplicate)}。`,
    response:'HTTP 409；error.code=DUPLICATE_CODE；error.message 为非空重复说明。',
    uiResponse:'显示非空重复编号拒绝说明，不得显示新增成功。',after:unchanged},
  {id:'03',name:'只读角色新增被拒绝且数据不变',role:'viewer',data:viewer,
    ui:'保持公开角色为 viewer，在新增工单区域填写编号 WO-2002、标题 只读角色提交、站点 西站（WEST）、优先级 高（HIGH），点击“新增工单”。',
    action:`POST ${path}；请求头 x-synthetic-role=viewer；JSON ${j(viewer)}。`,
    response:'HTTP 403；error.code=FORBIDDEN；error.message 为非空权限拒绝说明。',
    uiResponse:'显示非空只读角色拒绝说明，不得显示新增成功。',after:unchanged+'不存在 WO-2002。'},
  {id:'04',name:'按东站与待处理组合查询',role:'editor',data:{station:'EAST',status:'PENDING'},
    ui:'在列表筛选区域选择站点 东站（EAST）、状态 待处理（PENDING），编号筛选留空，点击“查询”。',
    action:`GET ${path}?station=EAST&status=PENDING。`,
    response:`HTTP 200；total=1；items 恰好等于 ${j([baseline[0]])}。不得包含 WO-1002 或 WO-1003。`,
    uiResponse:'列表仅一条 WO-1001 / PCS月度巡检 / 东站 / 高 / 待处理，总数1。',after:unchanged},
  {id:'05',name:'待处理工单完成并持久化',role:'editor',data:{code:'WO-1001'},
    ui:'定位工单编号为 WO-1001 的行，点击该行“完成工单”。',
    action:`POST ${path}/WO-1001/complete；请求头 x-synthetic-role=editor；不发送正文。`,
    response:`HTTP 200；updated=true；item=${j({...baseline[0],status:'DONE'})}。`,
    uiResponse:'显示完成成功提示；WO-1001 状态变为已完成（DONE）。',after:completed},
  {id:'06',name:'已完成工单禁止重复完成',role:'editor',data:{code:'WO-1003'},
    ui:'定位初始已完成的工单 WO-1003，点击该行“完成工单”。',
    action:`POST ${path}/WO-1003/complete；请求头 x-synthetic-role=editor；不发送正文。`,
    response:'HTTP 409；error.code=ALREADY_COMPLETED；error.message 为非空已完成说明。',
    uiResponse:'显示非空已完成拒绝说明；不得把本次操作显示为完成成功。',after:unchanged},
];
const cases = [];
for (const type of ['UI','BACKEND']) for (const s of scenarios) {
  const external_id = `${type==='UI'?'UI':'API'}-WO-${s.id}`;
  const step = (order,action,expected) => ({order,action,expected});
  const steps = type === 'UI' ? [
    step(1,`打开 http://127.0.0.1:4460/inspection/，填写本条全新运行编号，公开角色选择 ${s.role}，点击“初始化本次数据”。`, `初始化新空间成功。未使用任何筛选时表格恰好包含三条基线，五字段为 ${baselineText}，总数3。若提示已有空间则换新编号，不能重用。`),
    step(2,s.ui,s.uiResponse),
    step(3,'将编号筛选清空，站点和状态筛选恢复“全部”，点击“查询”；再点击“刷新列表”，从页面独立读回最新完整列表。',s.after),
    step(4,'点击“清理本次数据”，仅清理当前运行编号。','提示清理完成，表格清空且不可继续操作已删除空间；不得清理其他运行编号。'),
  ] : [
    step(1,`GET ${path}，不加过滤参数，保存完整提交前列表。`,`HTTP 200；total=3；items=${baselineText}。`),
    step(2,s.action,s.response),
    step(3,`GET ${path}，不加过滤参数，独立查询整个列表。`,`HTTP 200；${s.after}`),
  ];
  const preconditions = type === 'UI'
    ? '本地公开合成站点可访问，无需登录。每条独立使用新运行编号，不共享其他用例数据。EAST/东站、WEST/西站，HIGH/高、NORMAL/普通，PENDING/待处理、DONE/已完成。'
    : `Base URL=http://127.0.0.1:4460。测试编排 setup 先 POST /__control/namespaces，JSON {"runId":"{{runId}}"}，必须 HTTP 201 且 created=true。业务步骤结束后，无论成败均在 cleanup DELETE /__control/namespaces/{{runId}}，核对 HTTP 200 且 deleted=true。setup/cleanup 不属于下面三个业务步骤。每条单独空间，无需登录。`;
  cases.push({package_case_id:external_id,source_version:1,root_source:{type:'public-synthetic',stable_id:'inspection-20261009-'+external_id,file_name:'01-PRD.md'},lineage:[],content:{external_id,title:s.name,case_type:type,module:'储能站巡检工单',preconditions,test_data:`${j(s.data)}；x-synthetic-role=${s.role}；runId=每次执行生成的唯一编号。基线 ${baselineText}。`,steps,status:'CONFIRMED'}});
}
await save('case-package.json',{schema:'workbench/case-package-v1',package_id:'inspection-trial-20261009-v1',cases});
for (const type of ['UI','BACKEND']) await save(type==='UI'?'前端用例.json':'后端用例.json',{schema:'workbench/case-package-v1',package_id:`inspection-trial-20261009-${type}-v1`,cases:cases.filter(c=>c.content.case_type===type)});
await save('01-PRD.md',`# 储能站巡检工单 · 公开合成需求 v1\n\n本需求仅为测试 Agent 手动练习，由本次准备任务定义，不代表真实云平台验收规则。\n\n## 使用场景\n\n测试人员分别体验前端与 HTTP/JSON 后端脚本生成、结果核对和执行。站点无真实登录；editor、viewer 为公开模拟角色。每条用例使用独立数据空间。\n\n## 基线与字段\n\n固定初始列表：\n\n${baseline.map(o=>'- '+j(o)).join('\n')}\n\n字段 code 为 WO-加4位数字；title 去首尾空白后1至60字；station 取 EAST/WEST；priority 取 HIGH/NORMAL；status 取 PENDING/DONE。所有列表按 code 升序。\n\n## 业务规则\n\n1. editor 可新增工单，初始状态 PENDING。编号唯一。\n2. 重复编号拒绝，不得覆盖任何记录。\n3. viewer 可以查询；新增和完成均拒绝，不得改变数据。\n4. code、station、status 是精确过滤条件，多条件 AND；无条件返回整个列表。\n5. editor 可将 PENDING 工单变为 DONE，其他字段和其他记录不变。\n6. DONE 工单再次完成必须拒绝，整个列表不变。\n7. 无效创建字段返回校验错误且不写入。本批12条核心练习不扩展边界矩阵。\n\n## 验收证据\n\n成功须核对独立读回的完整业务字段；拒绝须核对错误类型和整个列表不变。提示、HTTP 状态或总数单项不足以证明业务正确。初始化和清理是练习编排能力，不是工单业务功能。\n\n## 本批场景\n\n${scenarios.map(s=>`- ${s.id}：${s.name}；${s.after}`).join('\n')}\n\n本次只准备环境和预置人工用例；最终脚本生成、执行与人工验收由用户操作。\n`);
await save('02-用例说明.md',`# 前后端预置用例\n\n用例编号 UI-WO-01 至 UI-WO-06、API-WO-01 至 API-WO-06。原生导入格式见 case-package.json，也可单独导入前端用例.json、后端用例.json。\n\n“CONFIRMED”表示本练习包冻结的合成测试规则已可供生成脚本使用，不表示真实客户需求已确认或执行通过。无需再手工录入。\n\n${cases.map(({content:c})=>`## ${c.external_id} ${c.title}\n\n类型：${c.case_type}\n\n前提：${c.preconditions}\n\n数据：${c.test_data}\n\n${c.steps.map(s=>`${s.order}. 操作：${s.action}\n   预期：${s.expected}`).join('\n\n')}`).join('\n\n')}\n`);
await save('03-通讯协议.md',`# 巡检工单 HTTP/JSON 通讯协议 v1\n\n仅用于公开合成练习。Base URL：http://127.0.0.1:4460。页面 /inspection/。无需登录，不使用真实密码、Token 或 Cookie。UTF-8 JSON；创建与初始化请求使用 Content-Type: application/json。公开角色 x-synthetic-role 是练习输入，不是认证。\n\n## 数据与范围\n\nrunId 格式 [a-z0-9][a-z0-9-]{2,63}，每条执行独立新建；执行器引用 {{runId}}。初始列表：${baselineText}。\ncode=WO-加4位数字，title 去首尾空白后1至60字，station=EAST/WEST，priority=HIGH/NORMAL，status=PENDING/DONE。列表按 code 升序。允许控制路径 /__control/namespaces 与业务路径 /api/v1/namespaces/。\n\n## 初始化（仅 setup）\n\nPOST /__control/namespaces\n\nJSON {"runId":"本次全新编号"}。已有编号不覆盖、不重置。\n\n响应 201 {"runId":"当前编号","created":true}。已有空间响应 200 {"runId":"当前编号","created":false}。\n\n## 列表查询\n\nGET /api/v1/namespaces/{runId}/orders\n\n可选 query code、station、status，精确匹配，多条件 AND；无过滤返回全部记录，total 是过滤后数量。\n\n响应 200 {"runId":"当前编号","items":[${j(baseline[0])}],"total":1}。此示例对应 station=EAST&status=PENDING；无条件初始 total=3 且 items 为上述完整基线。\n\n## 单条查询\n\nGET /api/v1/namespaces/{runId}/orders/{code}\n\n路径 code 是精确编号。\n\n响应 200 {"runId":"当前编号","item":${j(baseline[0])}}；无记录响应 404 {"runId":"当前编号","error":{"code":"ORDER_NOT_FOUND","message":"工单不存在"}}。\n\n## 新增工单\n\nPOST /api/v1/namespaces/{runId}/orders\n\n请求头 x-synthetic-role=editor 或 viewer。JSON 四字段 code、title、station、priority。示例 JSON ${j(create)}。status 由服务赋 PENDING。\n\n响应 201 {"runId":"当前编号","created":true,"item":${j({...create,status:'PENDING'})}}。\n响应 409 {"runId":"当前编号","error":{"code":"DUPLICATE_CODE","message":"工单编号已存在"}}：输入 WO-1001 等已存在编号，原记录不变。\n响应 403 {"runId":"当前编号","error":{"code":"FORBIDDEN","message":"只读角色不能修改工单"}}：viewer 写入拒绝。\n响应 400 {"runId":"当前编号","error":{"code":"VALIDATION_ERROR","message":"字段不符合要求"}}：字段无效。\n所有拒绝的 items 与请求前逐字段相同，不得仅核对数量。拒绝 message 是非空中文，测试不要求文字逐字一致。\n\n## 完成工单\n\nPOST /api/v1/namespaces/{runId}/orders/{code}/complete\n\n请求头 x-synthetic-role=editor 或 viewer。不发送正文。editor 将 PENDING 转为 DONE；其他字段不变。\n\n响应 200 {"runId":"当前编号","updated":true,"item":${j({...baseline[0],status:'DONE'})}}。\n响应 409 {"runId":"当前编号","error":{"code":"ALREADY_COMPLETED","message":"工单已完成"}}：已有 DONE 不重复完成。\n响应 403 {"runId":"当前编号","error":{"code":"FORBIDDEN","message":"只读角色不能修改工单"}}：viewer 拒绝。\n响应 404 {"runId":"当前编号","error":{"code":"ORDER_NOT_FOUND","message":"工单不存在"}}。拒绝均不写入。\n\n## 清理（仅 cleanup）\n\nDELETE /__control/namespaces/{runId}\n\n只删除本条用例自己的 runId。\n\n响应 200 {"runId":"当前编号","deleted":true}；不存在时 deleted=false。生成的执行计划在任何结果下都要安排精确清理。\n\n## 全局约束\n\n未初始化或清理后的业务空间返回 HTTP 404，error.code=NAMESPACE_NOT_FOUND。初始化与清理必须处于执行计划 setup/cleanup，不放入业务 steps。每条用例只操作自身空间，不固定复用示例 runId，不清理其他用例。\n\n健康检查 /health 和只读基线 /__control/baseline 用于环境维护，不属于本批后端业务 steps，不能充当业务断言。\n`);
await save('fixture-expectations.json',{baseline,create,duplicate,viewer,scenarios:scenarios.map(({id,name,role,data})=>({id,name,role,data}))});
console.log('Prepared 6 UI + 6 BACKEND cases, requirements, protocol and independent expected data.');
