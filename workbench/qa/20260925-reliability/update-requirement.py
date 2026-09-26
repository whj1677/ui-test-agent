import json
from pathlib import Path

root = Path(__file__).resolve().parents[3]
p = root / 'docs/requirements/REQ-0037-autonomous-candidate-development/requirement.source.json'
r = json.loads(p.read_text(encoding='utf-8-sig'))
if not any(x['id'] == 'UN-0037-04' for x in r['user_requirements']):
    r['metadata'].update(version=9, last_updated='2026-09-25', requirement_status='诊断 D01-D10 有界修复实施中；历史24条结论保留')
    r['user_requirements'].append(dict(id='UN-0037-04', status='已确认', goal='主管分派及独立验收，在预算内完成诊断D01-D10涉及的现有功能修复。', constraints='原业务语义、历史及人工批准不变；唯一4322；三名Sol子Agent；优先零模型，有界实际建例最多2逻辑任务，不自动扩额度或推送。', success_criteria='恢复原稿/终态停止缺陷反转；异常/认证并发回归；正式入口构建可追溯及有限完整旅程验证。'))
    specs = [
        ('04','开发保真、恢复完整种子及反馈/失败分层','原稿与helper首次自测前受完整包校验；提交自动记录有限审查而非自动审批；失败分类及可执行业务差异一次独立复核；耗尽反馈与重复尝试有界','repair_development','07'),
        ('05','运行收口、存储故障、取消互斥和认证并发','终态不可倒退；后台错误锁存并拒绝新任务；准备/执行/收口互斥；关闭先拒接；同scope登录浏览器无泄漏','repair_runtime / repair_auth_tests / supervisor','08'),
        ('06','唯一入口、测试命令和服务构建身份','默认工程测试不另起工作台/模型；正式功能仅4322；每次新run/task绑定已加载源码及脱敏配置身份；有限真实UI旅程及报告','repair_auth_tests / supervisor','09'),
    ]
    for n, requirement, acceptance, owner, vt in specs:
        dr, dd, tk, vi = (f'DR-0037-{n}',f'DD-0037-{n}',f'TK-0037-{int(n)+1:02}',f'VT-0037-{vt}')
        r['development_requirements'].append(dict(id=dr,status='已确认',requirement=requirement,acceptance_criteria=acceptance,constraints='只修已诊断功能；不改原预期，不以替身回归替代正式入口验收。'))
        r['design_decisions'].append(dict(id=dd,dr_ids=[dr],status='已确认',summary=acceptance,rationale='复用已有管理器/执行器/事实源，以最小防线闭合已证实边界。'))
        r['tasks'].append(dict(id=tk,dr_ids=[dr],dd_ids=[dd],status='进行中',task=requirement+'；职责：'+owner,verification_ids=[vi]))
        r['verification_items'].append(dict(id=vi,dr_ids=[dr],confirmation_status='已确认',execution_status='未运行',item=acceptance,evidence_standard='生产函数定向回归、正式4322证据、实际退出码与边界说明。',current_evidence='本轮尚未运行；不复用历史通过结论。'))
        r['trace_current'].append(dict(un_id='UN-0037-04',dr_id=dr,dd_id=dd,tk_id=tk,vt_id=vi,status='进行中'))
    r['changes'].append(dict(date='2026-09-25',version=9,type='诊断修复授权与实施',description='用户指定主管/验收者并授权在预算内自行选子Agent完成整轮功能修复。覆盖D01-D10，后续真实业务试点缺输入不造材料。',impact='development/runtime/auth/test-entry/build-identity',confirmed_by='当前用户明确指令'))
    r['module_document_impact'].append('v9：补充诊断修复架构、唯一入口测试命令、加载身份和状态边界。')
    r['verification_environment']['environment'].append('v9所有正式功能验收只连接原4322/fresh-b；不再使用独立端口工作台。工程替身/纯函数独立标注。')
    p.write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('REQ-0037 v9 source ready')
