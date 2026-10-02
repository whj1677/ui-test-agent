"""Read-only bounded verification; writes only this task's evidence folder."""
import hashlib
import importlib.util
import io
import json
import pathlib
import subprocess
import tarfile
import urllib.request
import zipfile

ROOT = pathlib.Path.cwd()
HERE = ROOT / 'workbench/qa/20261002-trim-contains-closeout'
PREVIOUS = ROOT / 'workbench/qa/20261001-release-goal-round4/closeout'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def git(*args, required=True):
    result = subprocess.run(['git', *args], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if required:
        result.check_returncode()
    return result.stdout if result.returncode == 0 else None


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


initial = read(HERE / 'initial-state.json')
for row in initial['original_dirty_files']:
    assert sha((ROOT / row['path']).read_bytes()) == row['sha256'], row['path']
assert git('diff', '--cached', '--binary').decode().strip() == initial['index']
assert git('branch', '--show-current').decode().strip() == initial['branch']

receipt = json.loads((PREVIOUS / 'git-archive-receipt.md').read_text(encoding='utf-8').split('```json\n', 1)[1].split('\n```', 1)[0])
assert receipt['commit'] == '06568aa6d0ebdfc5f946ff57288fc2536c632532'
archived = {}
with tarfile.open(fileobj=io.BytesIO(git('archive', '--format=tar', receipt['commit'], 'workbench/qa/20261001-release-goal-round4/closeout'))) as archive:
    for member in archive:
        if member.isfile():
            archived[member.name] = sha(archive.extractfile(member).read())
assert len(archived) == len(receipt['files']) == 169
for row in receipt['files']:
    assert archived[row['path']] == row['sha256'], row['path']

mapping = read(PREVIOUS / 'source-service-package-map.json')
archive_path = ROOT / mapping['archive']
assert sha(archive_path.read_bytes()) == mapping['archive_sha256']
spec = importlib.util.spec_from_file_location('portable', ROOT / 'workbench/scripts/package-portable.py')
portable = importlib.util.module_from_spec(spec)
spec.loader.exec_module(portable)
current = portable.SOURCE.collect(ROOT)  # collection only; no build, stage mutation, launch or model
assert set(current) == {row['path'] for row in mapping['checked_files']}
with zipfile.ZipFile(archive_path) as archive:
    assert sha(archive.read('portable-manifest.json')) == mapping['manifest_sha256']
    for row in mapping['checked_files']:
        assert sha(current[row['path']]) == row['source_sha256'], row['path']
        assert sha(archive.read(row['path'])) == row['customer_sha256'], row['path']

js = "import {sourceFingerprint} from './workbench/server/service-identity.mjs'; console.log(JSON.stringify(await sourceFingerprint(process.cwd())));"
source = json.loads(subprocess.run(['node', '--input-type=module', '-e', js], check=True, stdout=subprocess.PIPE).stdout)
health = json.loads(urllib.request.urlopen('http://127.0.0.1:4322/api/health', timeout=10).read())
assert source['source_sha256'] == health['service_identity']['source_sha256'] == mapping['source']['source_sha256']
assert health['service_identity']['data_root_sha256'] == initial['health']['service_identity']['data_root_sha256']
assert health['service_identity']['configuration_sha256'] == initial['health']['service_identity']['configuration_sha256']
assert not any(health.get(key) for key in ('active_demonstration_id', 'active_run_id', 'active_build_task_id', 'active_batch_id', 'active_script_operation_id', 'backend'))
assert not health['requirements']['active']

requests = read(HERE / 'scenario-results.json')
assert [row['actual_status'] for row in requests['rows']] == ['PASSED', 'FAILED', 'FAILED', 'PASSED', 'FAILED']
assert requests['provider_requests'] == 0
prd = read(HERE / 'original-prd.json')
assert prd['sha256'] == '05f3e72c534616a80fc17bfa20d65a0ae797469c39990697aa29c32b69de6298'
anchor = next(segment for segment in prd['segments'] if segment['segment_id'] == 'segment-8')
assert sha(anchor['text'].encode()) == anchor['quote_sha256']

gov = []
for row in initial['original_dirty_files']:
    if not any(row['path'].startswith('docs/requirements/' + name + '/') for name in (
        'REQ-0037-autonomous-candidate-development', 'REQ-0038-requirements-and-protocol-test-input',
        'REQ-0039-windows-device-license', 'REQ-0040-managed-workbench-restart')):
        continue
    original = git('show', initial['head'] + ':' + row['path'], required=False)
    gov.append({'path': row['path'], 'tracked_at_original_HEAD': original is not None,
                'HEAD_sha256': sha(original) if original is not None else None, 'disk_sha256': row['sha256'],
                'numstat_against_HEAD': (git('diff', '--numstat', '--', row['path']) or b'').decode().strip(),
                'ownership': 'PREEXISTING_MIXED_NOT_STAGED_OR_EDITED_THIS_TASK'})
(HERE / 'mixed-governance-differences.json').write_text(json.dumps(gov, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
saved_b = read(PREVIOUS / 'b-persisted-final.json')['generation_session']['quality_reviews'][0]
(HERE / 'saved-b-provenance.json').write_text(json.dumps({
    'file': str((PREVIOUS / 'b-persisted-final.json').relative_to(ROOT)).replace('\\', '/'),
    'sha256': sha((PREVIOUS / 'b-persisted-final.json').read_bytes()),
    'status': saved_b['status'], 'findings': saved_b['findings'],
    'persisted_mcp_boundary': saved_b['process_diagnostic']['mcp_boundary'],
    'original_decoder_failure_file': 'workbench/qa/20261001-release-goal-round4/closeout/original-b-plan-before.json',
    'original_SSE': None, 'provider_or_SDK_origin': 'UNKNOWN_NOT_REPRODUCED_OR_RETRIED_THIS_TASK',
    'new_provider_requests': 0,
}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
summary = {'status': 'BOUNDED_SOURCE_ARCHIVE_CANDIDATE_PRESERVATION_VERIFIED_NOT_RELEASE',
           'old_dirty_entries': len(initial['status_entries']), 'old_file_bytes_verified': len(initial['original_dirty_files']),
           'archival_blobs_verified': len(archived), 'required_source_zip_mappings': len(current),
           'source_sha256': source['source_sha256'], 'zip_sha256': mapping['archive_sha256'],
           'raw_stage_status_unchanged': mapping['raw_stage_status'], 'governance_mixed_files': len(gov),
           'model_requests': 0, 'workbench_started': False, 'native': 'NOT_RUN_STOP_NOT_BYPASSED',
           'second_windows': 'NOT_RUN_NO_SECOND_COMPUTER'}
(HERE / 'bounded-verification.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(summary, ensure_ascii=False))
