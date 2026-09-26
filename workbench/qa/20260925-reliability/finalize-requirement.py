import json
from pathlib import Path

root = Path(__file__).resolve().parents[3]
qa = root / 'workbench/qa/20260925-reliability'
load = lambda name: json.loads((qa / name).read_text(encoding='utf-8-sig'))
model, history, cancel, readiness, auth = [load(n) for n in ('model-results.json','history-after.json','active-cancel.json','official-readiness-final.json','official-auth-lifecycle.json')]
assert model['harness_starts'] == 2 and model['tool_calls'] == 70
assert history['unchanged'] and cancel['after'] == 'CANCELLED' and not readiness['active']
assert auth['concurrent_open_same_version'] and auth['final_status'] == 'NOT_LOGGED_IN'
p = root / 'docs/requirements/REQ-0037-autonomous-candidate-development/requirement.source.json'
r = json.loads(p.read_text(encoding='utf-8'))
r['metadata']['requirement_status'] = 'v9诊断D01-D10修复已实现，工程65项及限定4322功能验证完成；真实业务登录和通用语义未验收，历史结论保留'
facts = [
 'v9主管使用3名Sol子Agent实施并独立复核；原4322/fresh25-b重载生效，未commit/push，不改原用例、候选或审批状态。',
 'v9默认工程回归65/65，失败0、跳过0；恢复原包native修改探针与终态停止竞态反转，认证并发、跨管理器准备互斥、存储故障和有界关机均有定向工程证据。',
 'v9正式入口首次批次遇真实Windows EPERM，故障锁存拒接正确；补原子写有界重试后新批次KC-02失败/KC-08通过，失败尝试保留INTERRUPTED。运行中取消及终态重复停止均已在4322验证。',
 'v9真实恢复KC-10：原完整包先执行，修订去掉额外筛选后失败，独立正常复核同样失败；归类BUSINESS_DIFFERENCE，不改原预期、不自动批准。',
 'v9真实从头生成KC-05：首稿自测失败，同会话修订后自测及独立3步验证通过，仍待人工批准。两任务合计2次Harness、70工具、4次自测、2次独立复核；供应商token及费用未知。',
 'v9正式AUTH-01仅验打开/检查/清除生命周期：并发open同版本、清除后未登录且无新增浏览器遗留。未填凭据、未验证真实登录过期或业务授权。',
 'v9核对99个历史用例/任务/候选/报告文件和42条旧授权不变，仅追加2条本轮授权。正式复跑20个媒体、建例48个媒体均核对哈希；报告26个内嵌附件为重复核对，不与源媒体相加。',
 'v9加载版本最终源码SHA256='+readiness['service_identity']['source_sha256']+'，有效配置摘要与本轮前序实例相同；npm start已验证复用原端口实例。',
]
r['confirmed_facts'] = [x for x in r['confirmed_facts'] if not x.startswith('v9主管使用') and not x.startswith('v9默认工程回归') and not x.startswith('v9正式入口首次') and not x.startswith('v9真实恢复') and not x.startswith('v9真实从头') and not x.startswith('v9正式AUTH') and not x.startswith('v9核对99') and not x.startswith('v9加载版本')] + facts
for task in r['tasks']:
 if task['id'] in ('TK-0037-05','TK-0037-06','TK-0037-07'): task['status']='已实现'
for trace in r['trace_current']:
 if trace['un_id']=='UN-0037-04': trace['status']='已实现并完成限定验证'
evidence = {
 'VT-0037-07':('node workbench/qa/20260925-reliability/verify-model-results.mjs','model-results.json','2真实会话；原包恢复、失败一次独立复核、从头自测修订及哈希绑定材料验证。KC-10仍业务失败，KC-05独立技术通过，均未批准。'),
 'VT-0037-08':('node workbench/qa/20260925-reliability/verify-active-cancel.mjs','active-cancel.json','65项工程清单含故障/并发/收口替身回归；正式运行中取消、终态幂等、实际EPERM及AUTH-01打开清除验证。未验证生产磁盘满或真实登录。'),
 'VT-0037-09':('npm run test:official','official-readiness-final.json','已加载源码匹配；正式两条复跑、媒体播放/定位、API下载、固定报告及历史保留验证。外部客户业务覆盖与系统浏览器离线打开未验。'),
}
for v in r['verification_items']:
 if v['id'] in evidence:
  command,log,note=evidence[v['id']]
  v['execution_status']='集成测试通过'
  v['evidence_standard']='生产函数定向回归、正式4322证据、实际退出码与边界说明。'+note
  v['current_evidence']={'command':command,'exit_code':0,'test_count':{'VT-0037-07':2,'VT-0037-08':1,'VT-0037-09':4}[v['id']],'failure_count':0,'skipped_count':0,'log_path':'workbench/qa/20260925-reliability/'+log}
r['verification_environment']['commands']=['npm test','npm run test:official','node workbench/qa/20260925-reliability/verify-model-results.mjs']
r['verification_environment']['environment']=[x for x in r['verification_environment']['environment'] if not x.startswith('v9')]+['v9本轮正式功能仅原4322/fresh25-b；辅助被测目标不属于工作台。工程回归不启动工作台或模型。']
r['verification_environment']['conclusion']=[x for x in r['verification_environment']['conclusion'] if not x.startswith('v9')]+['v9工程65/65及限定正式功能验证完成，详见workbench/qa/20260925-reliability/REPORT.md。全库checker仍有REQ-0015两处历史宣称冲突；不宣称全库门禁通过。']
change=r['changes'][-1]
assert change['version']==9
change['description']='完成诊断D01-D10有界修复及限定正式4322验收；真实Windows EPERM促成有界原子写重试；2开发会话/70工具/4自测，无额外扩量，历史与人工批准保留。'
p.write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('REQ-0037 v9 explicit implementation and bounded verification recorded')
