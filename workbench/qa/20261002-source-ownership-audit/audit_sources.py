"""Bounded local provenance audit. No imports of the product, models or binaries.

Reads local Git history, existing package/source evidence and source files.
Writes this task's reports and private textual review diffs under .git only.
Nothing being audited is changed, staged, executed or approved by this script.
"""
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
PRIVATE = ROOT / '.git/source-ownership-audit-20261002'
PREV = ROOT / 'workbench/qa/20261002-release-engineering-closeout'
R4 = ROOT / 'workbench/qa/20261001-release-goal-round4/closeout'
REQ = {
    'REQ0037':'REQ-0037-autonomous-candidate-development',
    'REQ0038':'REQ-0038-requirements-and-protocol-test-input',
    'REQ0039':'REQ-0039-windows-device-license',
    'REQ0040':'REQ-0040-managed-workbench-restart',
}


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)


def sha(b):
    return hashlib.sha256(b).hexdigest()


def oid(b):
    return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()


def read(p):
    return json.loads(p.read_text(encoding='utf-8-sig'))


def save(name, value):
    (OUT/name).write_bytes((json.dumps(value,ensure_ascii=False,indent=2)+'\n').encode('utf-8'))


def scope_for(name):
    """Responsibility proposal from interfaces/features, never an authorship claim."""
    if '/requirements' in name or '/backend' in name or '/cases/design.' in name or '/cases/workbook-' in name:
        return ['REQ0038']
    if 'demonstration' in name or 'action-highlight' in name or 'ui-assertion' in name:
        return ['REQ0037']
    if 'service-restart' in name or 'owned-supervisor' in name or 'owned-child' in name:
        return ['REQ0040']
    if 'licens' in name or '/native/' in name or 'model-credential' in name or 'credential' in name or 'native-runtime' in name or 'native-entry' in name:
        return ['REQ0039']
    if any(t in name for t in ['package','portable','runtime-paths','setup-runtime','check-install','Windows便携','安装','启用模型','配置模型密钥','环境检查']):
        return ['REQ0039']
    if any(t in name for t in ['report-latest','report-project-latest','target-settings','project-target-access','execution-list']):
        return ['REQ0038']
    if 'skills/' in name or 'dsh-skill' in name or 'skills-packaging' in name:
        return ['REQ0037','REQ0038']
    if any(t in name for t in ['quality-review','quality-loop','failure-feedback','feedback-view']):
        return ['REQ0037','REQ0038']
    if '/build/' in name or '/tests/development-' in name or '/tests/auth-' in name or '/server/auth/' in name or 'supervisor-' in name or 'project-trial-authorization' in name:
        return ['REQ0037']
    return ['REQ0037','REQ0038','REQ0039','REQ0040']


SHARED = {
    'package.json','package-lock.json','workbench/package.json','workbench/package-lock.json',
    'harness-probe/config/browser.cordis.yml','harness-probe/config/browser-flash.cordis.yml',
    'harness-probe/config/browser-auth-attach.cordis.yml','harness-probe/src/harness-runner.mjs',
    'harness-probe/src/provider-environment.mjs','harness-probe/src/verify-candidate.mjs',
    'src/deepseek.mjs','src/model-transport.mjs','workbench/config/candidate.playwright.config.mjs',
    'workbench/scripts/start-workbench.ps1','workbench/scripts/check-install.ps1',
    'workbench/scripts/package-candidate.py','workbench/scripts/run-unit-checks.mjs',
    'workbench/scripts/test-manifest.json','workbench/scripts/verify-official-workbench.mjs',
    'workbench/server/app.mjs','workbench/server/index.mjs','workbench/server/batches.mjs',
    'workbench/server/execution-records.mjs','workbench/server/service-identity.mjs',
    'workbench/server/service-shutdown.mjs','workbench/server/script-operations.mjs',
    'workbench/server/report.mjs','workbench/server/report-snapshots.mjs',
    'workbench/server/cases/manager.mjs','workbench/server/build/adapter.mjs',
    'workbench/server/build/manager.mjs','workbench/server/build/trial-environment.mjs',
    'workbench/server/build/user-workflow.mjs','workbench/web-v2/app.js',
    'workbench/web-v2/index.html','workbench/web-v2/styles.css','workbench/web-v2/product.css',
    'workbench/web-v2/workflow.js','workbench/web-v2/script-actions.js',
    'workbench/web-v2/execution-media.js','workbench/web-v2/reports.js','启动.cmd',
}
NON_SOURCE = {
    'workbench/scripts/start-workbench.local.json':'LOCAL_GENERATED_CONFIGURATION_NOT_PUBLISHABLE_SOURCE',
    'workbench/scripts/native/WindowsCredential.exe':'PROJECT_BUILD_BINARY_DELIVERY_ARTIFACT_NOT_SOURCE',
    'workbench/scripts/native/build-manifest.json':'GENERATED_BUILD_MANIFEST_NOT_SOURCE',
    'workbench/qa/20261001-release-goal-round4/closeout/b-persisted-final.json':'SAVED_REAL_MODEL_SYNTHETIC_REPLAY_EVIDENCE_NOT_PRODUCT_SOURCE',
}


def necessity_links(all_rows):
    """Record actual consumer positions instead of inferring from filename only."""
    inbound = collections.defaultdict(list)
    names = {r['path'] for r in all_rows}
    by_leaf = collections.defaultdict(list)
    for n in names:
        by_leaf[Path(n).name].append(n)
    for r in all_rows:
        p = ROOT/r['path']
        if p.suffix not in {'.mjs','.js','.py','.ps1','.cmd','.html','.css','.md','.json','.yml'}:
            continue
        text = p.read_text(encoding='utf-8-sig', errors='replace')
        for no,line in enumerate(text.splitlines(),1):
            for quote,ref in re.findall(r"(['\"])([^'\"\r\n]+)\1",line):
                target = None
                if ref.startswith('.'):
                    full = (p.parent/ref).resolve()
                    if full.is_relative_to(ROOT):
                        candidate = full.relative_to(ROOT).as_posix()
                        if candidate in names: target = candidate
                elif ref in names:
                    target = ref
                elif len(by_leaf.get(ref,[]))==1:
                    target = by_leaf[ref][0]
                if target and target!=r['path']:
                    inbound[target].append({'consumer':r['path'],'line':no,'reference':ref,'relation':'literal_reference_review_context_not_always_runtime_import'})
    for manifest in ['workbench/scripts/test-manifest.json','workbench/scripts/package-candidate.py']:
        p=ROOT/manifest
        for no,line in enumerate(p.read_text(encoding='utf-8-sig').splitlines(),1):
            for n in names:
                if n in line or manifest.endswith('.json') and n.startswith('workbench/') and n[len('workbench/'):] in line:
                    inbound[n].append({'consumer':manifest,'line':no,'relation':'explicit_manifest_entry'})
    return inbound


def git_history(wanted_all):
    refs=[]
    for line in git('for-each-ref','--format=%(refname) %(objectname)').decode().splitlines():
        ref,commit=line.split()
        refs.append({'ref':ref,'commit':commit})
    commits=git('rev-list','--all').decode().splitlines()
    versions=collections.defaultdict(lambda:collections.defaultdict(lambda:{'locations':set(),'commits':set()}))
    direct_trees={}
    tips={r['commit']for r in refs}
    for commit in commits:
        tree={}
        for record in git('ls-tree','-r','-z',commit).split(b'\0'):
            if not record:continue
            meta,name=record.split(b'\t',1);mode,kind,blob=meta.decode().split()
            path=name.decode('utf-8')
            if kind!='blob':continue
            if path in wanted_all:
                tree[path]=blob
                versions[path][blob]['locations'].add(path)
                versions[path][blob]['commits'].add(commit)
            elif '/archive/before/' in path or '/archive/after/' in path:
                logical=path.split('/archive/before/',1)[-1] if '/archive/before/'in path else path.split('/archive/after/',1)[-1]
                if logical in wanted_all:
                    versions[logical][blob]['locations'].add(path)
                    versions[logical][blob]['commits'].add(commit)
        if commit in tips:direct_trees[commit]=tree
    objects={}
    for line in git('rev-list','--objects','--all').decode('utf-8').splitlines():
        parts=line.split(' ',1)
        if len(parts)==2:objects[parts[0]]=parts[1]
    # Per-reference reachability is evaluated locally, not inferred from dates.
    ancestry={tip:set(git('rev-list',tip).decode().splitlines())for tip in tips}
    return refs,commits,versions,direct_trees,objects,ancestry


def main():
    initial=read(PRIVATE/'initial-protection.json')
    assert git('rev-parse','HEAD').decode().strip()==initial['HEAD']
    assert git('diff','--cached','--name-only')==b''
    prior=read(PREV/'required-file-inventory.json')
    all_rows=prior['files'];wanted={r['path']for r in all_rows}
    audited=[r for r in all_rows if r['state']in ['ABSENT_FROM_HEAD','TRACKED_MODIFIED']]
    assert len(audited)==220
    inbound=necessity_links(all_rows)
    refs,commits,versions,trees,objects,ancestry=git_history(wanted)
    map_data=read(R4/'source-service-package-map.json')
    packaged={r['path']:r for r in map_data['checked_files']}
    req_sources={key:read(ROOT/'docs/requirements'/name/'requirement.source.json')for key,name in REQ.items()}
    delta={r['path']:r for r in read(R4/'archive-manifest.json')['archived_source_files']}
    sha_cache={}
    def blob_hash(blob):
        if blob not in sha_cache:sha_cache[blob]=sha(git('cat-file','blob',blob))
        return sha_cache[blob]
    current={r['path']:(ROOT/r['path']).read_bytes()for r in all_rows}
    current_oids={n:{oid(b),' '.join([]) or oid(b.replace(b'\r\n',b'\n'))}for n,b in current.items()}
    scores=[]
    for ref in refs:
        tree=trees.get(ref['commit'],{})
        matching=[n for n in wanted if tree.get(n)in current_oids[n]]
        direct_present=[n for n in wanted if n in tree]
        scores.append({**ref,'required_401_direct_present':len(direct_present),'required_401_missing':len(wanted)-len(direct_present),
                       'current_content_equal_raw_or_EOL_normalized':len(matching),
                       'full_current_implementation_tree':len(matching)==len(wanted),
                       'candidate_229_missing':sorted(n for n in packaged if n not in tree)})
    result=[]
    patch_dir=PRIVATE/'complete-diffs';patch_dir.mkdir(exist_ok=True)
    with ZipFile(ROOT/map_data['archive'])as z:
        for prev in audited:
            n=prev['path'];b=current[n];assert sha(b)==prev['disk_sha256']
            old=git('show','HEAD:'+n) if prev['state']=='TRACKED_MODIFIED' else None
            scopes=scope_for(n)
            group='NON_SOURCE_INPUT' if n in NON_SOURCE else 'CROSS_REQ_SHARED_OR_UNKNOWN_FULL_DIFF' if n in SHARED else 'KNOWN_PROJECT_IMPLEMENTATION'
            history=[]
            for blob,entry in versions.get(n,{}).items():
                exact=blob_hash(blob)==sha(b)
                normalized=blob in current_oids[n]
                history.append({'blob':blob,'blob_sha256':blob_hash(blob),'locations':sorted(entry['locations']),
                                'observed_commit_count':len(entry['commits']), 'example_commits':sorted(entry['commits'])[:3],
                                'reachable_refs':[r['ref']for r in refs if entry['commits']&ancestry[r['commit']]],
                                'matches_current_raw_bytes':exact,'matches_current_raw_or_EOL_normalized':normalized,
                                'meaning':'content availability only; not author or whole-file approval'})
            alias=[]
            for object_id in current_oids[n]:
                if object_id in objects:
                    alias.append({'blob':object_id,'Git_object_first_reported_path':objects[object_id],
                                  'blob_sha256':blob_hash(object_id),'matches_current_raw_bytes':blob_hash(object_id)==sha(b),
                                  'meaning':'reachable object content; path alias does not establish authorship'})
            package=None
            if n in packaged:
                zip_sha=sha(z.read(n));assert zip_sha==packaged[n]['archive_sha256']
                package={'ZIP':map_data['archive'],'member':n,'member_sha256':zip_sha,
                         'same_as_current_source':zip_sha==sha(b),'transformation':packaged[n]['transformation'],
                         'meaning':'frozen deployable bytes, not creator or copyright evidence'}
            base_meta={'present_at_HEAD':old is not None,'HEAD_sha256':sha(old)if old is not None else None,
                       'HEAD_blob':git('rev-parse','HEAD:'+n).decode().strip()if old is not None else None}
            safe_text=b'\0'not in b[:4096] and not re.search(rb'\bsk-[A-Za-z0-9_-]{24,}|-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----\r?\n[A-Za-z0-9+/=\r\n]{64,}',b)
            review=None
            if n in NON_SOURCE:
                review={'kind':'NO_DUPLICATE_RAW_EXPORT','reason':NON_SOURCE[n],
                        'existing_bytes_path':n,'SHA256':sha(b),'recipe_or_archive':'source/build manifest or existing 06568aa model evidence; do not stage this object'}
            elif safe_text:
                before=(old or b'').decode('utf-8-sig',errors='strict').replace('\r\n','\n').splitlines(True)
                after=b.decode('utf-8-sig',errors='strict').replace('\r\n','\n').splitlines(True)
                diff=''.join(difflib.unified_diff(before,after,fromfile='HEAD/'+n,tofile='current/'+n,n=1))
                p=patch_dir/(n.replace('/','__')+'.patch');p.write_bytes(diff.encode('utf-8'))
                review={'kind':'COMPLETE_MINIMAL_CONTEXT_DIFF','path':p.relative_to(ROOT).as_posix(),
                        'sha256':sha(p.read_bytes()),'hunks':re.findall(r'^@@.*@@.*$',diff,re.M),
                        'new_file_whole_body_required':old is None,'before_source':'HEAD '+initial['HEAD'] if old else 'not present in HEAD'}
            else:
                review={'kind':'RAW_EXPORT_STOPPED_SENSITIVE_OR_BINARY','SHA256':sha(b),'existing_bytes_path':n}
            basis=[]
            for key in scopes:
                source=req_sources[key]
                hits=[]
                for section in ['development_requirements','design_decisions','tasks']:
                    for row in source[section]:
                        encoded=json.dumps(row,ensure_ascii=False)
                        if n in encoded or Path(n).name in encoded and len(Path(n).name)>16:
                            hits.append({'section':section,'id':row.get('id'),'relation':'explicit_filename_in_current_canonical_requirement'})
                basis.append({'record':REQ[key],'source_version':source['metadata']['version'],'explicit_file_hits':hits,
                              'relation':'proposed responsibility scope; canonical record confirmation does not prove current whole-file creation'})
            if n.startswith('workbench/tests/'):
                why='当前77文件工程清单或其夹具/导入依赖的复测输入；不是安装运行入口'
            elif n in NON_SOURCE:
                why={'workbench/scripts/start-workbench.local.json':'本机启动状态；不属于发行源码，可按公共example和已授权部署参数重新配置',
                     'workbench/scripts/native/WindowsCredential.exe':'便携客户包需要的凭据桥二进制；应由C#源码/构建器产生或固定构建包提供',
                     'workbench/scripts/native/build-manifest.json':'客户包验证上述产物SHA的构建清单；由构建器生成',
                     'workbench/qa/20261001-release-goal-round4/closeout/b-persisted-final.json':'仅历史B真实返回离线重放需要；非正式工作台或发布运行必须'}[n]
            elif inbound.get(n):why='具有实际消费/构建/清单位置，见必要性引用；结合所属模块决定运行或复测范围'
            elif n in packaged:why='现打包器显式目录/白名单收集；未定位入口时不声称每个文件都是实际运行必需'
            else:why='仅已知静态/身份输入；尚无运行必需性证据，不扩大为必须发布'
            result.append({'path':n,'prior_state':prev['state'],'bytes':len(b),'current_sha256':sha(b),'group':group,
                           'non_source_subtype':NON_SOURCE.get(n),'why_needed_or_not':why,'necessity_references':inbound.get(n,[]),
                           'previous_inventory_roles':prev['roles'],'Git_baseline':base_meta,'history_versions':history,
                           'same_bytes_reachable_object_aliases':alias,'frozen_package_content':package,
                           'R4_delta':delta.get(n),'requirement_scope_evidence':basis,
                           'project_membership':'PROJECT_CODE_OR_CONFIGURATION' if group!='NON_SOURCE_INPUT' else 'NON_SOURCE_WITH_SEPARATE_HANDOFF',
                           'authorized_feature_scope':'linked to prior user requested UI/backend/requirements/recording/report/packaging/licensing/restart features; not approval of unreviewed complete diff',
                           'creator_attribution':'NOT_ESTABLISHED_BY_HASH_OR_PRESERVATION',
                           'whole_current_change_approval':'NOT_INFERRED', 'may_stage_audited_file_this_task':False,
                           'minimum_complete_review':review})
    counts=dict(collections.Counter(r['group']for r in result))
    save('220-file-provenance.json',{'scope':'220 original audited objects; no file staged/edited/approved','HEAD':initial['HEAD'],
        'counts':counts,'direct_third_party_source_among_220':0,'files':result,
        'distinctions':['project responsibility != author','user feature authorization != exact full diff approval','content recovery != license/release approval']})
    save('branch-and-history-availability.json',{'reachable_commit_count':len(commits),'local_ref_count':len(refs),
        'refs':scores,'any_ref_has_complete_current_401':any(s['full_current_implementation_tree']for s in scores),
        'no_fetch_or_checkout_performed':True,'source_of_all_data':'local Git object database; no remote network query'})
    save('audit-summary.json',{'HEAD':initial['HEAD'],'groups':counts,'audited_files':len(result),
        'missing_at_HEAD':sum(r['prior_state']=='ABSENT_FROM_HEAD'for r in result),
        'modified_at_HEAD':sum(r['prior_state']=='TRACKED_MODIFIED'for r in result),
        'has_current_content_reachable_in_Git':sum(bool(r['same_bytes_reachable_object_aliases'])for r in result),
        'has_current_content_in_r4e_ZIP':sum(bool(r['frozen_package_content']and r['frozen_package_content']['same_as_current_source'])for r in result),
        'no_current_content_Git_or_ZIP':sum(not r['same_bytes_reachable_object_aliases'] and not(r['frozen_package_content']and r['frozen_package_content']['same_as_current_source'])for r in result),
        'model_calls':0,'product_files_changed':0,'audited_files_staged':0,'stage_experiments':0})
    print(json.dumps({'groups':counts,'commits':len(commits),'refs':len(refs),'new_models':0},ensure_ascii=False))


if __name__=='__main__':main()
