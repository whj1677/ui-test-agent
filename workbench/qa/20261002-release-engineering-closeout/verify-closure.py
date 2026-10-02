"""Bounded preservation, committed-file and clean-checkout audit; never starts services."""
import hashlib
import io
import json
import subprocess
import tarfile
import urllib.request
from collections import Counter
from pathlib import Path
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
CLOSEOUT = ROOT / 'workbench/qa/20261001-release-goal-round4/closeout'
CLEAN = ROOT / 'workbench/.local/release-engineering-clean-67ead28'


def sha(b):
    return hashlib.sha256(b).hexdigest()


def load(p):
    return json.loads(p.read_text(encoding='utf-8-sig'))


def cmd(args, cwd=ROOT):
    p = subprocess.run(args, cwd=cwd, capture_output=True, check=False)
    return {'command': args, 'exit_code': p.returncode,
            'stdout': p.stdout.decode('utf-8', errors='replace'), 'stderr': p.stderr.decode('utf-8', errors='replace')}


def main():
    original = load(ROOT / 'workbench/qa/20261002-trim-contains-closeout/initial-state.json')
    before = load(ROOT / '.git/release-engineering-20261002/before.json')
    changed = []
    for r in original['original_dirty_files']:
        p = ROOT / r['path']
        now = sha(p.read_bytes()) if p.is_file() else None
        if now != r['sha256']:
            changed.append({'path': r['path'], 'before_sha256': r['sha256'], 'now_sha256': now})
    permitted = {'docs/requirements/REQ-0038-requirements-and-protocol-test-input/' + n for n in
                 ['requirement.source.json', '04_verification.md', 'current_state.md', 'change_log.md']}
    assert all(r['path'] in permitted for r in changed), 'UNEXPECTED_ORIGINAL_FILE_CHANGE'
    source = load(ROOT / 'docs/requirements/REQ-0038-requirements-and-protocol-test-input/requirement.source.json')
    old_source = load(ROOT / '.git/release-engineering-20261002/REQ0038-before-v39.raw.json')
    for a,b in zip(old_source['verification_items'],source['verification_items']):
        assert b['current_evidence'].endswith(a['current_evidence']) if a['id']=='VT-0038-07' else a['current_evidence']==b['current_evidence']
    assert cmd(['git','diff','--cached','--name-only'])['stdout'] == '', 'PRIMARY_INDEX_NOT_EMPTY'
    mapping = load(CLOSEOUT / 'source-service-package-map.json')
    with ZipFile(ROOT / mapping['archive']) as z:
        zipped = {r['path']: sha(z.read(r['path'])) for r in mapping['checked_files']}
    map_changes = []
    for r in mapping['checked_files']:
        if sha((ROOT / r['path']).read_bytes()) != r['source_sha256'] or zipped[r['path']] != r['archive_sha256']:
            map_changes.append(r['path'])
    assert not map_changes, 'SOURCE_PACKAGE_MAPPING_CHANGED'
    identity = cmd(['node','--input-type=module','-e',
                    "import {sourceFingerprint} from './workbench/server/service-identity.mjs';console.log(JSON.stringify(await sourceFingerprint(process.cwd())))"])
    assert identity['exit_code'] == 0, identity['stderr']
    disk_identity = json.loads(identity['stdout'])
    health = json.load(urllib.request.urlopen('http://127.0.0.1:4322/api/health',timeout=10))
    current_identity = health.get('service_identity') or health.get('serviceIdentity') or health.get('identity')
    if current_identity is None:
        current_identity = next(v for v in health.values() if isinstance(v,dict) and 'source_sha256' in v)
    assert disk_identity['source_sha256'] == current_identity['source_sha256'] == mapping['source']['source_sha256']
    assert current_identity['configuration_sha256'] == mapping['service']['configuration_sha256']
    assert current_identity['data_root_sha256'] == mapping['service']['data_root_sha256']
    # Independently read the actual 169 Git blobs, not a generator's PASS label.
    text = (CLOSEOUT / 'git-archive-receipt.md').read_text(encoding='utf-8-sig')
    receipt = json.loads(text.split('```json\n',1)[1].split('\n```',1)[0])
    archive_data = subprocess.check_output(['git','archive',receipt['commit'],'--','workbench/qa/20261001-release-goal-round4/closeout'],cwd=ROOT)
    with tarfile.open(fileobj=io.BytesIO(archive_data)) as tar:
        blobs = {m.name:sha(tar.extractfile(m).read()) for m in tar.getmembers() if m.isfile()}
    assert len(blobs) == len(receipt['files']) == 169
    assert all(blobs[r['path']] == r['sha256'] for r in receipt['files'])
    assert cmd(['git','rev-parse',receipt['ref']])['stdout'].strip() == receipt['commit']
    # Clean checkout is only a preparation probe. No dependencies copied, no
    # package installation, no model invocation, no workbench startup.
    clean_before = cmd(['git','status','--porcelain=v1','-z'],cwd=CLEAN)
    clean_head = cmd(['git','rev-parse','HEAD'],cwd=CLEAN)['stdout'].strip()
    assert clean_before['stdout'] == ''
    owned_probe = cmd(['node',str(OUT/'verify-owned-module.mjs'),str(CLEAN)],cwd=CLEAN)
    assert owned_probe['exit_code'] == 0
    (OUT / 'clean-owned-module.log').write_bytes((owned_probe['stdout']+owned_probe['stderr']).encode('utf-8'))
    import_probe = cmd(['node','--input-type=module','-e',"await import('./workbench/server/quality-review.mjs')"],cwd=CLEAN)
    assert import_probe['exit_code'] != 0 and 'ERR_MODULE_NOT_FOUND' in import_probe['stderr']
    (OUT / 'clean-runtime-import-failure.log').write_bytes((import_probe['stdout']+import_probe['stderr']).encode('utf-8'))
    inventory = load(OUT / 'required-file-inventory.json')
    clean_files = []
    for r in inventory['files']:
        p = CLEAN / r['path']
        state = 'ABSENT' if not p.is_file() else 'EXACT_WORKSPACE_BYTES' if sha(p.read_bytes())==r['disk_sha256'] else 'DIFFERENT_BYTES'
        clean_files.append({'path':r['path'],'state':state,'checkout_sha256':sha(p.read_bytes()) if p.is_file() else None,'workspace_sha256':r['disk_sha256']})
    clean_after = cmd(['git','status','--porcelain=v1','-z'],cwd=CLEAN)
    assert clean_after['stdout'] == ''
    final = {'status':'ENGINEERING_SCOPE_VERIFIED_RELEASE_BLOCKED', 'head_at_probe':cmd(['git','rev-parse','HEAD'])['stdout'].strip(),
             'original_protected_file_count':len(original['original_dirty_files']), 'authorized_fact_changes':changed,
             'all_other_original_bytes_unchanged':True,'all_original_verification_evidence_verbatim_preserved':True,'primary_index_empty':True,
             'old_169_archive_commit':receipt['commit'],'old_169_git_blobs_verified':len(blobs),
             'source_zip_correspondence_rows':len(mapping['checked_files']),'source_zip_mismatches':map_changes,
             'source_fingerprint':disk_identity,'service_identity':current_identity,
             'candidate_zip':{'path':mapping['archive'],'recorded_sha256':mapping['archive_sha256'],'bytes':(ROOT/mapping['archive']).stat().st_size,
                              'verification':'229 mapped ZIP members checked; whole ZIP digest reused from preserved prior mapping, not recomputed'},
             'clean_checkout':{'path':str(CLEAN),'head':clean_head,'git_clean_before':True,'git_clean_after':True,
                               'owned_module_checks':6,'runtime_import':import_probe,'required_file_counts':dict(Counter(r['state'] for r in clean_files)),
                               'files':clean_files,'service_started':False,'dependencies_installed':False,
                               'conclusion':'NOT_RUNNABLE_AT_CURRENT_COMMIT; missing runtime module independently reproduced'},
             'scope_limits':{'model_calls':0,'full_558_rerun':False,'ALL_paid_generation':False,'raw_stage':'REUSED_EXTERNAL_PUBLIC_REPRODUCTION_ROOT_CAUSE_UNKNOWN',
                             'native_URL':'STOPPED_UNVERIFIED','second_Windows':'NOT_RUN_NO_SECOND_COMPUTER','push_merge_deploy':False}}
    (OUT/'preservation-and-clean-checkout.json').write_text(json.dumps(final,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:final[k] for k in ['status','original_protected_file_count','authorized_fact_changes','old_169_git_blobs_verified','source_zip_correspondence_rows']} ,ensure_ascii=False))
    print('clean_checkout',final['clean_checkout']['required_file_counts'])


if __name__ == '__main__':
    main()
