"""Verify audit consistency and unchanged inputs; never execute product code."""
import collections
import hashlib
import json
import re
import subprocess
import urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).resolve().parent
PREV=ROOT/'workbench/qa/20261002-release-engineering-closeout'


def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def sha(b):return hashlib.sha256(b).hexdigest()
def git(*a):return subprocess.check_output(['git',*a],cwd=ROOT).decode('utf-8').strip()


def main():
    a=read(OUT/'220-file-provenance.json');s=read(OUT/'audit-summary.json');rows=a['files']
    assert len(rows)==220 and len({r['path']for r in rows})==220
    assert dict(collections.Counter(r['group']for r in rows))==s['groups']==a['counts']
    assert sum(r['prior_state']=='ABSENT_FROM_HEAD'for r in rows)==153
    assert sum(r['prior_state']=='TRACKED_MODIFIED'for r in rows)==67
    patches=[]
    for r in rows:
        assert sha((ROOT/r['path']).read_bytes())==r['current_sha256'],r['path']
        d=r['minimum_complete_review']
        if d['kind']=='COMPLETE_MINIMAL_CONTEXT_DIFF':
            assert sha((ROOT/d['path']).read_bytes())==d['sha256'],d['path'];patches.append(d['path'])
        assert not r['may_stage_audited_file_this_task']and not r['this_turn_product_edit_or_staging']
    assert len(patches)==216
    inv=read(PREV/'required-file-inventory.json')['files']
    assert all(sha((ROOT/r['path']).read_bytes())==r['disk_sha256']for r in inv)
    original=read(ROOT/'workbench/qa/20261002-trim-contains-closeout/initial-state.json')['original_dirty_files']
    prior=read(PREV/'preservation-and-clean-checkout.json')
    overrides={r['path']:r['now_sha256']for r in prior['authorized_fact_changes']}
    assert len(original)==4754
    changes=[r['path']for r in original if sha((ROOT/r['path']).read_bytes())!=overrides.get(r['path'],r['sha256'])]
    assert not changes,changes
    gates=read(OUT/'gate-evidence-index.json')
    assert gates['checker_same_as_prior'] and all(r['current_file_same_as_saved_audit']for r in gates['current_documents_v40'])
    for r in gates['mixed_50']:
        assert sha((ROOT/r['path']).read_bytes())==r['current_sha256'],r['path']
        d=r['minimum_complete_diff']
        assert sha((ROOT/d['path']).read_bytes())==d['sha256'],r['path']
    groups=read(OUT/'decision-groups.json')['groups']
    assert sorted(n for g in groups for n in g['paths'])==sorted(r['path']for r in rows)
    deps=read(OUT/'external-dependency-provenance.json')
    assert len(deps['packages'])==deps['total_node_modules_lock_entries']==674
    assert deps['device_license']['matching_build_inputs_now']
    assert deps['WindowsCredential']['source_hash_matches_manifest'] and deps['WindowsCredential']['artifact_hash_matches_manifest']
    # The only HTTP read is the existing formal service's no-side-effect health endpoint.
    with urllib.request.urlopen('http://127.0.0.1:4322/api/health',timeout=5)as res: health=json.loads(res.read())
    start=read(ROOT/'.git/source-ownership-audit-20261002/initial-protection.json')['health']
    assert health['service_identity']==start['service_identity'],'service identity changed'
    active={k:v for k,v in health.items()if k.startswith('active_')and v}
    assert not active and not health.get('backend')and not health.get('requirements',{}).get('active')
    findings=[]
    for p in sorted(OUT.iterdir()):
        if not p.is_file():continue
        b=p.read_bytes()
        if re.search(rb'\bsk-[A-Za-z0-9_-]{24,}',b): findings.append(p.name+': actual secret-shaped token')
        if re.search(rb'-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----\r?\n[A-Za-z0-9+/=\r\n]{64,}',b):findings.append(p.name+': private key block')
        if re.search(rb'https?://[^\s/"<>:]+:[^\s/"<>]+@',b):findings.append(p.name+': URL userinfo')
        if re.search(rb'(?i)["\'](?:api_?key|access_?token|refresh_?token|password)["\']\s*:\s*["\'][A-Za-z0-9_./+\-]{20,}["\']',b):findings.append(p.name+': credential-shaped literal')
    assert not findings,findings
    result={'status':'AUDIT_INPUT_AND_REPORT_CONSISTENCY_VERIFIED_NOT_PRODUCT_OR_RELEASE_ACCEPTANCE',
       'HEAD':git('rev-parse','HEAD'),'branch':git('branch','--show-current'),
       'protected_original_files':len(original),'protected_original_matches_previous_authorized_state':True,
       'required_inventory_files_unchanged':len(inv),'audited_files_unchanged':len(rows),
       'complete_private_diff_files_sha_verified':len(patches),'mixed_50_hashes_and_complete_diff_or_whole_file_references_verified':True,
       'service_identity':health['service_identity'],'active_tasks':active,
       'primary_index_empty_before_this_audit_archive':not git('diff','--cached','--name-only'),
       'new_audit_secret_shape_scan_findings':findings,'source_REQ_checker_data_configuration_edits':0,
       'model_calls':0,'product_tests':0,'stage_experiments':0,
       'last_gate_result_reused_only':gates['last_real_checker_result']}
    (OUT/'preservation-receipt.json').write_bytes((json.dumps(result,ensure_ascii=False,indent=2)+'\n').encode('utf-8'))
    print(json.dumps({k:v for k,v in result.items()if k!='service_identity'},ensure_ascii=False))


if __name__=='__main__':main()
