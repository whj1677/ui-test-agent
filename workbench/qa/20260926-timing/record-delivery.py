"""Update the existing release requirement with this round's bounded evidence."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
source = ROOT / 'docs/requirements/REQ-0001-release-readiness/requirement.source.json'
d = json.loads(source.read_text('utf-8-sig'))
fact = '2026-09-26时间保真轮已完成有限修复：原CASE02重新生成，1/2新Harness、26工具、1自测；final两段519.4/517.5ms，零模型复跑515.2/511.5ms，全部原400–600ms零容差。原CASE03六步复跑成功。独立语义审查未见当前合成站拒绝项；仍未批准，不等于发布。106工程项通过、680旧JSON只新增1授权、冻结源不变；最终04包101源文件，呈现更新前后70服务端/Harness文件逐字节相同。详见workbench/qa/20260926-timing/REPORT.md。'
if fact not in d['confirmed_facts']:
    d['confirmed_facts'].insert(0, fact)
for task in d['tasks']:
    if task['id'] == 'TK-0001-11':
        task['status'] = '已实现'
for trace in d['trace_current']:
    if trace.get('tk_id') == 'TK-0001-11':
        trace['status'] = '已实现'
for item in d['verification_items']:
    if item['id'] == 'VT-0001-11':
        item['execution_status'] = '集成测试通过'
        item['current_evidence'] = {
            'command': 'npm test', 'exit_code': 0, 'test_count': 106,
            'failure_count': 0, 'skipped_count': 0,
            'log_path': 'workbench/qa/20260926-timing/engineering-presentation-final.log'}
    if item['id'] == 'VT-0001-07':
        item['current_evidence'] = '认证合成目标已完成真实生成与零模型复跑。旧CASE02时间放宽反例保留；本轮可信计时新候选五步独立语义未见拒绝，CASE03原六步复跑正常。范围见workbench/qa/20260926-timing/REPORT.md；真实业务未验、CASE01生命周期未完整执行。'
    if item['id'] == 'VT-0001-09':
        item['current_evidence'] = '当前工程清单106项通过、0失败/跳过；精确登记会话终止接口保护和原时间保真拒绝完成。新CASE02及原CASE03正式复跑后身份有效。仅有限已登记策略与DOM提示计时，操作系统隔离及通用语义仍未提供。见workbench/qa/20260926-timing/REPORT.md。'
    if item['id'] == 'VT-0001-10':
        item['current_evidence'] = '最终04候选101源文件、SHA28ad0485003fba314e25bc7f8b63835675d732a430d9cf5509015b13a87962e2，精确字节/闭包/主管独立核对及正式UI呈现检查完成。03至04仅2个前端文件及说明变化，70服务端/Harness字节不变。三锁不变，沿用01有限离线安装证据，04未重新安装。正式发布未达标；见workbench/qa/20260926-timing/REPORT.md、package-report-20260926-04.md。'
summary = '2026-09-26当前4322时间保真续修：106工程项通过；新CASE02五步与原400–600ms已真实生成/独立审查/零模型复跑验证，原CASE03复跑正常。新增Harness1/2，26工具，1自测；最终呈现修正与执行逻辑字节一致证据分开。整体发布未达标；下列既往版本和未执行范围保留历史含义。'
if d['verification_environment']['conclusion'][0] != summary:
    d['verification_environment']['conclusion'].insert(0, summary)
change = {'date': '2026-09-26', 'version': 2, 'type': '原时间边界有界修复验收',
          'description': '执行器可信DOM提示计时、原界拒绝和结果呈现完成；新CASE02语义及同版CASE02/03复跑已有真实证据，106工程检查通过。',
          'impact': 'TK11已实现、VT11限当前合成站集成验证；04待验包替代03为当前交付，旧包/候选/历史保持，整体发布不提升。',
          'confirmed_by': '用户委托下一轮修复；主管核对实际代码/NDJSON/哈希/UI/预算及两位独立Agent审查，详见20260926-timing/REPORT.md。'}
if change not in d['changes']:
    d['changes'].insert(0, change)
source.write_text(json.dumps(d, ensure_ascii=False, indent=2) + '\n', 'utf-8')
print('Updated REQ-0001 explicit facts and bounded status only.')
