"""Reports only: existing evidence/metadata reads, no product execution or edits."""
import collections
import difflib
import hashlib
import json
import re
import subprocess
from pathlib import Path
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
PREV = ROOT/'workbench/qa/20261002-release-engineering-closeout'
R4 = ROOT/'workbench/qa/20261001-release-goal-round4/closeout'


def read(p):
    return json.loads(p.read_text(encoding='utf-8-sig'))


def sha(b):
    return hashlib.sha256(b).hexdigest()


def save(n,v):
    (OUT/n).write_bytes((json.dumps(v,ensure_ascii=False,indent=2)+'\n').encode('utf-8'))


def meta(p):
    return {'path':str(p.relative_to(ROOT)) if p.is_relative_to(ROOT) else str(p),
            'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())}


def module_purpose(n):
    s=n.lower()
    if 'demonstration' in s: return '人工登录后录制操作、暂停/断言标记、原生悬浮控制及示范转脚本'
    if '/requirements' in s or 'docx-image' in s: return 'PRD/MRD/协议/图片摄取、前后端用例设计、质量复审、版本绑定与导出'
    if '/backend' in s: return '按后端用例及协议生成HTTP计划、沙箱审查、执行断言/精确清理与结果呈现'
    if '/cases/design.' in s or '/cases/workbook-' in s: return '确认设计用例进入用例库，以及可追溯Excel交换'
    if any(x in s for x in ['service-restart','service-shutdown','owned-supervisor','owned-child']): return '原4322实例空闲检查、托管生命周期与原配置受控重启'
    if 'licens' in s: return '独立DLL授权组件的主板绑定校验与启动门禁、激活及客户策略'
    if any(x in s for x in ['credential','/native/','native-entry','native-runtime']): return '本机Windows凭据保存/读取、公开凭据桥构建和打包运行位置适配'
    if any(x in s for x in ['package','portable','runtime','安装','环境检查','便携','enable-model','启用模型']): return '锁定依赖的安装诊断、客户便携构建、模型入口配置与交付说明'
    if 'report' in s: return '最新用例报告的固定快照、前后端汇总、可信断言值与脱敏导出'
    if any(x in s for x in ['execution-list','execution-record','execution-media','execution-ux','run-evidence']): return '项目执行列表、状态/运行归属及可信失败/媒体证据呈现'
    if any(x in s for x in ['target-settings','project-target-access','project-target-browser','project-trial-authorization']): return '项目被测地址、登录及逐任务试跑授权的范围控制'
    if any(x in s for x in ['quality-review','quality-loop','failure-feedback','feedback-view']): return '候选同SHA质量审核、明确失败反馈和有界修复再验证'
    if any(x in s for x in ['skills','ui-test-authoring','dsh-skill']): return '已存在的测试编写规范装载/隔离及冻结版本回归夹具；不扩充Skill功能'
    if any(x in s for x in ['deepseek','model-transport','harness','cordis']): return 'DeepSeek/DSH协议适配、隔离插件、取消/超时、模型传输及候选验证'
    if '/build/' in s or 'development-' in s or 'candidate-trials' in s: return 'UI候选的编写、自测、修复、忠实度/权限/浏览器证据控制'
    if '/auth' in s or 'auth-' in s: return '专用会话登录、失效及并发请求控制；不录制登录凭据'
    if 'test-manifest' in s or 'run-unit' in s: return '既有77文件工程复测的显式清单与并发控制入口'
    if 'verify-official' in s or 'service-identity' in s: return '正式4322身份、源码指纹及在途任务检查'
    if '/cases/manager' in s: return '项目用例库、设计导入与版本/执行关联'
    if 'batches' in s or 'script-operation' in s or 'script-actions' in s: return '项目脚本操作、批次安排及前后端/录制入口集成'
    return '正式工作台入口/路由/项目页面、公共样式及多个已授权模块的集成'


def scope_override(n):
    if n=='workbench/docs/release-candidate.md': return ['REQ0037','REQ0038','REQ0039']
    if n in ['workbench/scripts/enable-model-workbench.ps1','workbench/scripts/verify-runtime-dependencies.mjs']: return ['REQ0039']
    if n=='workbench/tests/fixtures/docx-image-fixture.mjs': return ['REQ0038']
    if 'ui-test-authoring-v1' in n: return ['REQ0037']
    if n=='workbench/tests/harness-provider-address.test.mjs': return ['REQ0037','REQ0039']
    if n=='workbench/tests/product-v21.test.mjs': return ['REQ0037','REQ0038','REQ0039']
    if n=='workbench/tests/run-evidence.test.mjs': return ['REQ0037']
    if n=='workbench/web-v2/reports.js': return ['REQ0037','REQ0038']
    return None


def dependencies(mapping):
    packages=[]; lock_totals={}
    for folder in [ROOT,ROOT/'workbench',ROOT/'harness-probe']:
        decl=read(folder/'package.json'); lock=read(folder/'package-lock.json')
        label=folder.relative_to(ROOT).as_posix() or '.'
        lock_totals[label]=sum(n.startswith('node_modules/') for n in lock['packages'])
        direct=set(decl.get('dependencies',{}))|set(decl.get('devDependencies',{}))
        for n,r in lock['packages'].items():
            if not n.startswith('node_modules/'): continue
            name=n.rsplit('node_modules/',1)[-1]; d=folder/n; p=d/'package.json'
            item={'root':label,'logical_path':(folder/n).relative_to(ROOT).as_posix(),'name':name,
                  'direct':n=='node_modules/'+name and name in direct,'dev':bool(r.get('dev')),
                  'optional':bool(r.get('optional')),'lock_version':r.get('version'),
                  'lock_integrity':r.get('integrity'),'resolved':r.get('resolved'),
                  'link':bool(r.get('link')),'license_declaration_in_lock':r.get('license'),
                  'installed_metadata_available':p.exists(),'license_evidence':[],
                  'delivery_method':'locked registry package with integrity + existing license/notice files; preserve notices; no source vendoring in this audit'}
            if p.exists():
                m=read(p); item['installed_version']=m.get('version');item['installed_license']=m.get('license')
                item['package_metadata_sha256']=sha(p.read_bytes())
                for x in sorted(d.iterdir()):
                    if x.is_file() and any(x.name.lower().startswith(v) for v in ['license','licence','notice','copyright','copying']): item['license_evidence'].append(meta(x))
            if r.get('link'): item['delivery_method']='separate owned component: not covered by registry lock integrity; versioned source/runtime package and usage rights required'
            packages.append(item)
    old=read(PREV/'external-component-inputs.json')
    component={**old,'rights_status':'NO_SPDX_FIELD_OR_ROOT_LICENSE_FOUND; ownership/right statement needed, not presumed forbidden',
        'matching_build_inputs_now':all(sha(Path(x['path']).read_bytes())==x['sha256'] for x in old['inputs']),
        'compiler_pin_status':'build.ps1 chooses Framework64/v4.0.30319/csc.exe; no compiler binary SHA pin in recorded component',
        'same_binary_rebuild':'NOT_EXECUTED_NOT_PROVEN',
        'handoff_proposal':'separate immutable @offline/device-license 0.2.0 / DLL manifest 1.0.0-rsa release; include 10 runtime files, 4 build inputs, SHA-256, usage/redistribution authority, compiler/runtime version; exclude issuer private key',
        'runtime_files':[]}
    with ZipFile(ROOT/mapping['archive']) as z:
        man=json.loads(z.read('portable-manifest.json'))
        component['runtime_files']=next(x['files']for x in man['local_components']if x['name']=='@offline/device-license')
        shipped=len(man['dependencies'])
        runtimes={'node_version':man['node_version'],'browsers':man['browsers'],
                  'recorded_shipped_dependency_entries':shipped,
                  'binary_delivery':'existing frozen r4e archive and portable-manifest file SHA records; no binaries rebuilt or executed',
                  'required_notice_paths':[n for n in z.namelist() if n=='runtime/node/LICENSE' or re.match(r'runtime/browsers/[^/]+/(LICENSE|NOTICE|COPYING)',n)],
                  'browser_rights_scope':'versions/resources and recorded notices only; not a new legal release approval'}
    native=read(ROOT/'workbench/scripts/native/build-manifest.json')
    native.update({'source_path':'workbench/native/WindowsCredential.cs',
       'builder':'workbench/scripts/build-credential-broker.mjs',
       'source_hash_matches_manifest':sha((ROOT/'workbench/native/WindowsCredential.cs').read_bytes())==native['source_sha256'],
       'artifact_hash_matches_manifest':sha((ROOT/'workbench/scripts/native/WindowsCredential.exe').read_bytes())==native['sha256'],
       'exact_rebuild':'NOT_EXECUTED; static recipe x64 .NET compiler /optimize+, compiler hash not pinned',
       'source_membership':'project-owned integration source; not the external device-license DLL'})
    v={'scope':'existing lock/installed public metadata and frozen ZIP; no downloads/installs/license legal opinion',
       'lock_entries_count_overlapping_not_unique_runtime_packages':lock_totals,
       'total_node_modules_lock_entries':sum(lock_totals.values()),'packages':packages,
       'device_license':component,'WindowsCredential':native,'bundled_runtime':runtimes,
       'all_220_audited_files_are_project_source_or_non_source_inputs_not_vendored_third_party_code':True}
    save('external-dependency-provenance.json',v)
    return v


def gate_report():
    before=read(PREV/'governance-statements-v39.json');after=read(PREV/'governance-statements.json')
    # Preserve precise original rows already exported by the prior audit; no checker import or execution.
    changed=[]
    for d in after['documents']:
        changed.append({**d,'current_file_same_as_saved_audit':sha((ROOT/d['path']).read_bytes())==d['sha256']})
    mix=read(PREV/'mixed-50-file-review.json')
    mix_rows=[]
    private=ROOT/'.git/source-ownership-audit-20261002/governance-diffs'
    private.mkdir(exist_ok=True)
    for r in mix:
        item={k:r.get(k)for k in ['path','current_sha256','HEAD_sha256','same_prior_snapshot','HEAD_to_disk_diff_hunks','exact_private_patch','absent_from_HEAD_whole_file_diff','current_task_fact_diff_only','ownership']}
        if item['exact_private_patch']:
            p=ROOT/item['exact_private_patch'];item['minimum_complete_diff']={'kind':'EXISTING_FULL_PATCH','path':item['exact_private_patch'],'sha256':sha(p.read_bytes())}
        else:
            p=ROOT/r['path'];b=p.read_bytes()
            if p.suffix=='.png' or p.name=='delivery_evidence.md':
                item['minimum_complete_diff']={'kind':'WHOLE_FILE_ADDITION_REFERENCED_WITHOUT_DUPLICATING_BINARY_OR_GENERATED_EVIDENCE','path':r['path'],'sha256':sha(b),'bytes':len(b),'HEAD_has_file':False,'scope':'empty baseline to existing whole file; no claim a textual patch exists'}
            elif re.search(rb'\bsk-[A-Za-z0-9_-]{24,}|-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----\r?\n[A-Za-z0-9+/=\r\n]{64,}',b):
                item['minimum_complete_diff']={'kind':'RAW_COPY_STOPPED_SENSITIVE_CONTENT','path':r['path'],'sha256':sha(b),'HEAD_has_file':False}
            else:
                patch=''.join(difflib.unified_diff([],b.decode('utf-8-sig').replace('\r\n','\n').splitlines(True),fromfile='HEAD/'+r['path'],tofile='current/'+r['path'],n=1))
                target=private/(r['path'].replace('/','__')+'.patch');target.write_bytes(patch.encode('utf-8'))
                item['minimum_complete_diff']={'kind':'NEW_PRIVATE_FULL_ADDITION_PATCH','path':target.relative_to(ROOT).as_posix(),'sha256':sha(target.read_bytes())}
        mix_rows.append(item)
    source_chain=[]
    for req in ['REQ-0015-manual-complex-lab','REQ-0037-autonomous-candidate-development','REQ-0038-requirements-and-protocol-test-input','REQ-0039-windows-device-license','REQ-0040-managed-workbench-restart']:
        src=ROOT/'docs/requirements'/req/'requirement.source.json';v=read(src)
        source_chain.append({**meta(src),'version':v['metadata']['version'],
          'renderer':meta(ROOT/'scripts/requirement_source.py'),
          'canonical_fields':'verification_items execution_status / current_evidence and source metadata/changelog → 04_verification.md/current_state.md',
          'generated_views_edited_this_task':False})
    v={'last_real_checker_result':'EXIT_1_FIVE_REFUSALS_PRESERVED; checker not rerun in this read-only audit',
       'original_failure_log':meta(ROOT/'.git/trim-contains-governance-final.log'),
       'latest_real_failure_log':meta(ROOT/'.git/release-engineering-20261002/governance-final.log'),
       'checker':meta(ROOT/'scripts/check_ai_context.py'),
       'checker_same_as_prior':sha((ROOT/'scripts/check_ai_context.py').read_bytes())==after['checker']['sha256'],
       'original_documents_v39':before['documents'],'current_documents_v40':changed,
       'source_render_chain':source_chain,'structured_actual_log_proofs':after['structured_verification_log_proofs'],
       'original_timeout_proofs':read(PREV/'original-timeout-proofs.json'),
       'fifth_records':['REQ0037 v16','REQ0038 v40','REQ0039 v4','REQ0040 v5'],
       'mixed_50':mix_rows,'mixed_50_by_record':dict(collections.Counter(next((t for t in r['path'].split('/')if t.startswith('REQ-')),'INDEX_OR_MODULE')for r in mix)),
       'minimum_actual_product_or_REQ_diff_this_task':0,
       'prior_REQ0038_fact_correction_retained':meta(PREV/'REQ0038-v39-to-v40.patch')}
    save('gate-evidence-index.json',v)
    return v


def main():
    inventory=read(OUT/'220-file-provenance.json');rows=inventory['files']
    mapping=read(R4/'source-service-package-map.json'); external=dependencies(mapping); gates=gate_report()
    package_names={r['name'] for r in external['packages']}
    for r in rows:
        n=r['path'];r['feature_purpose']=module_purpose(n)
        if n=='workbench/web-v2/reports.js': r['group']='CROSS_REQ_SHARED_OR_UNKNOWN_FULL_DIFF'
        override=scope_override(n)
        if override:
            records={'REQ0037':'REQ-0037-autonomous-candidate-development','REQ0038':'REQ-0038-requirements-and-protocol-test-input','REQ0039':'REQ-0039-windows-device-license','REQ0040':'REQ-0040-managed-workbench-restart'}
            r['requirement_scope_evidence']=[{'record':records[k],'source_version':read(ROOT/'docs/requirements'/records[k]/'requirement.source.json')['metadata']['version'],
                'relation':'reviewed responsibility proposal from actual patch/import/build behavior, not file author attribution'}for k in override]
        body=(ROOT/n).read_text(encoding='utf-8-sig',errors='replace') if r['group']!='NON_SOURCE_INPUT'else ''
        imports=set(re.findall(r"(?:from\s+|import\s*\(|require\s*\()\s*['\"]([^'\"]+)",body))
        r['direct_external_component_imports']=sorted(q for q in imports if any(q==p or q.startswith(p+'/')for p in package_names))
        r['external_component_versions_rights_and_handoff']='external-dependency-provenance.json; own integration/fixture ≠ vendored dependency'
        if r['group']!='NON_SOURCE_INPUT':
            role='工程复测及夹具' if n.startswith('workbench/tests/') else '构建/安装/验证入口'if '/scripts/'in n or n.endswith(('.cmd','.ps1','.cs'))else '客户说明或固定页面资源'if n.endswith(('.md','.css','.html'))else '运行模块或入口集成'
            r['why_needed_or_not']=role+'：'+r['feature_purpose']+'；引用位置和旧清单角色分别列出，未将打包白名单等同实际运行import'
        if n=='workbench/scripts/run-unit-checks.mjs':r['necessity_references'].append({'consumer':'workbench/package.json','line':16,'relation':'npm test script entry'})
        if n=='workbench/scripts/build-credential-broker.mjs':r['necessity_references'].append({'consumer':'workbench/scripts/native/build-manifest.json','relation':'recorded source/output SHA recipe; developer build entry, not customer runtime'})
        if n=='workbench/web-v2/index.html':r['necessity_references'].append({'consumer':'workbench/server/app.mjs','line':42,'relation':'formal /workspace/ static route'})
        r['decision_group']='EXCLUDE_SOURCE_HANDOFF' if r['group']=='NON_SOURCE_INPUT'else 'SHARED_FULL_DIFF_REVIEW'if r['group']=='CROSS_REQ_SHARED_OR_UNKNOWN_FULL_DIFF'else 'MODULE_FULL_DIFF_REVIEW'
        r['diff_required_before_future_source_commit']=r['minimum_complete_review']
        r['current_creation_or_specific_user_edit_origin']='NOT_PROVEN; original preservation and matching snapshots are content evidence only'
        r['this_turn_product_edit_or_staging']=False
    counts=dict(collections.Counter(r['group']for r in rows));inventory['counts']=counts
    save('220-file-provenance.json',inventory)
    summary=read(OUT/'audit-summary.json');summary['groups']=counts
    summary['reachable_raw_Git_bytes']=sum(any(x['matches_current_raw_bytes']for x in r['same_bytes_reachable_object_aliases'])for r in rows)
    summary['remaining_project_source_build_test_inputs_without_Git_or_ZIP_content']=sum(r['group']!='NON_SOURCE_INPUT' and not r['same_bytes_reachable_object_aliases']and not(r['frozen_package_content']and r['frozen_package_content']['same_as_current_source'])for r in rows)
    summary['source_candidate_rows_excluding_four_non_source']=216
    summary['exact_raw_current_bytes_in_Git_or_ZIP']=sum(bool(any(x['matches_current_raw_bytes']for x in r['same_bytes_reachable_object_aliases'])or(r['frozen_package_content']and r['frozen_package_content']['same_as_current_source']))for r in rows)
    summary['EOL_only_recovery_without_exact_raw_archive']=[r['path']for r in rows if r['same_bytes_reachable_object_aliases']and not any(x['matches_current_raw_bytes']for x in r['same_bytes_reachable_object_aliases'])and not(r['frozen_package_content']and r['frozen_package_content']['same_as_current_source'])]
    save('audit-summary.json',summary)
    scopes=collections.defaultdict(list)
    for r in rows:
        k='NON_SOURCE' if r['group']=='NON_SOURCE_INPUT'else 'SHARED_INTEGRATION'if r['group']=='CROSS_REQ_SHARED_OR_UNKNOWN_FULL_DIFF'else '+'.join(x['record'].split('-')[1]for x in r['requirement_scope_evidence'])
        scopes[k].append(r['path'])
    save('decision-groups.json',{'scope':'review groups, no audited file approved/staged','groups':[{'id':k,'count':len(v),'paths':v,'future_action':'retain/exclude source handoff'if k=='NON_SOURCE'else 'responsibility owner reviews complete indexed patch; no automatic creator/authorization attribution'}for k,v in scopes.items()]})
    # Human readable file-by-file index keeps complete SHA, HEAD and diff, not huge source bodies.
    table=['# 220项逐文件归属和必要性审阅','', '基线 a037e78；153缺失+67修改。项目用途、历史可恢复内容、作者归属和允许提交是不同判断。本轮被审文件全部禁止入库。完整最小上下文diff放在.git，未复制本机配置、二进制或原始B响应。','',
           '| 路径 / 当前SHA256 | 必要性与范围 | HEAD/历史/冻结ZIP | 决策与完整diff |','|---|---|---|---|']
    for r in rows:
        base=r['Git_baseline']; aliases=r['same_bytes_reachable_object_aliases']; pkg=r['frozen_package_content']; d=r['minimum_complete_review']
        history=('HEAD '+base['HEAD_sha256']if base['present_at_HEAD']else 'HEAD无文件')+'；可达版本'+str(len(r['history_versions']))+'种'
        if aliases: history+='；现内容Git blob '+','.join(x['blob']for x in aliases)
        if pkg: history+='；r4e '+('字节一致'if pkg['same_as_current_source']else '客户策略转换，不能直接替代开发源码')
        refs='；'.join(x['consumer']+(':'+str(x['line'])if x.get('line')else '')for x in r['necessity_references'][:3]) or '见清单入口/静态资源用途，未推定必须runtime'
        scopes_text=','.join(x['record'].split('-')[1]for x in r['requirement_scope_evidence'])
        diff=d.get('path',d['kind']);dhash=d.get('sha256',d.get('SHA256',''))
        table.append('| '+r['path']+'<br>'+r['current_sha256']+' | '+r['why_needed_or_not']+'<br>'+refs+' | '+history+' | '+r['decision_group']+'；拟责任 '+scopes_text+'；作者/全文许可未推定<br>'+diff+'<br>'+dhash+' |')
    (OUT/'220项逐文件审阅.md').write_text('\n'.join(table)+'\n',encoding='utf-8')
    print(json.dumps({'groups':counts,'decision_groups':{k:len(v)for k,v in scopes.items()},'external_lock_entries':external['total_node_modules_lock_entries'],'new_models':0},ensure_ascii=False))


if __name__=='__main__':main()
