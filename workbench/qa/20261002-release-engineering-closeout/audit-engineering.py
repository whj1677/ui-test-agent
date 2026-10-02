"""Read-only engineering audit. No models, installation, service startup or stage reads.

Outputs only this task's reports and private review patches under .git. Never
changes product code, prior evidence, dependencies, credentials or the index.
"""
import collections
import difflib
import hashlib
import importlib.util
import json
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
PRIVATE = ROOT / '.git/release-engineering-20261002'
REQ38 = 'REQ-0038-requirements-and-protocol-test-input'
PREVIOUS = ROOT / 'workbench/qa/20261002-trim-contains-closeout'
CLOSEOUT = ROOT / 'workbench/qa/20261001-release-goal-round4/closeout'


def sha(b):
    return hashlib.sha256(b).hexdigest()


def read_json(p):
    return json.loads(p.read_text(encoding='utf-8-sig'))


def save(name, value):
    (OUT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def git(*args):
    return subprocess.run(['git', *args], cwd=ROOT, capture_output=True, check=False)


def load_module(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def proof(name):
    p = ROOT / name
    if not p.is_file():
        return {'path': name, 'state': 'MISSING'}
    b = p.read_bytes()
    info = {'path': name, 'bytes': len(b), 'sha256': sha(b)}
    if name.endswith('.log'):
        text = b.decode('utf-8-sig', errors='replace')
        info['tap_totals'] = dict(re.findall(r'^# (tests|pass|fail|skipped|cancelled) (\d+)$', text, re.M))
    return info


def governance_audit():
    sys.path.insert(0, str(ROOT / 'scripts'))
    checker = load_module('release_checker_audit', ROOT / 'scripts/check_ai_context.py')
    source_text = (ROOT / 'scripts/check_ai_context.py').read_text(encoding='utf-8-sig')
    sources = {}
    findings = []
    for req in ['REQ-0015-manual-complex-lab', REQ38]:
        package = ROOT / 'docs/requirements' / req
        source = read_json(package / 'requirement.source.json')
        sources[req] = source
        vt = {x['id']: (i, x) for i, x in enumerate(source['verification_items'])}
        for name in ['04_verification.md', 'current_state.md']:
            p = package / name
            text = p.read_text(encoding='utf-8-sig')
            effective = checker.actual_verification_text(p, text)
            pass_rows, failure_rows = [], []
            for line_no, line in enumerate(text.splitlines(), 1):
                if line not in effective.splitlines():
                    continue
                match = re.search(r'VT-\d{4}-\d+', line)
                vid = match.group() if match else None
                row = {'line': line_no, 'text': line, 'verification_id': vid}
                if vid in vt:
                    index, item = vt[vid]
                    row.update({'source_field': f'verification_items[{index}]',
                                'execution_status': item['execution_status'],
                                'item': item['item'], 'original_evidence': item['current_evidence']})
                if checker.has_asserted_pass_claim(line):
                    pass_rows.append({**row, 'matches': [{'term': term, 'columns_1_based': [m.start()+1 for m in re.finditer(re.escape(term), line)]}
                                                       for term in checker.PASS_CLAIM_TERMS if term in line]})
                hits = [term for term in checker.BUILD_FAILURE_TERMS if term in line]
                if hits:
                    failure_rows.append({**row, 'matches': [{'term': term, 'columns_1_based': [m.start()+1 for m in re.finditer(re.escape(term), line)]} for term in hits]})
            issues = []
            checker.check_pass_claim_text(p, effective, issues)
            findings.append({'path': p.relative_to(ROOT).as_posix(), 'sha256': sha(p.read_bytes()),
                             'source_version': source['metadata']['version'],
                             'asserted_pass_rows': pass_rows, 'failure_term_rows': failure_rows,
                             'predicate_reproduced': bool(issues),
                             'scope_rule': 'Any asserted pass anywhere AND any failure term anywhere in effective document; no VT/version/run join.'})
    proofs = []
    for source in sources.values():
        for v in source['verification_items']:
            e = v['current_evidence']
            if isinstance(e, dict) and isinstance(e.get('log_path'), str):
                proofs.append({'verification_id': v['id'], 'recorded_evidence': e, 'actual_file': proof(e['log_path'])})
    lab = read_json(ROOT / 'workbench/qa/20260925-kimi-complex/evidence/2026-09-25T03-04-13-091Z/results.json')
    lab_rows = lab if isinstance(lab, list) else lab['results']
    extra = ['workbench/qa/20260929-project-latest/REPORT.md',
             'workbench/qa/20260929-project-latest/supervisor-final-core.log',
             'workbench/qa/20261001-full-remediation/修复验收报告.md',
             'workbench/qa/20261001-release-goal-round4/closeout/unit-delivery-closeout.log',
             'workbench/qa/20261001-release-goal-round4/closeout/governance-closeout.log']
    save('governance-statements.json', {'checker': proof('scripts/check_ai_context.py'),
        'checker_functions': {name: source_text[:source_text.index('def '+name+'(')].count('\n')+1 for name in ['has_asserted_pass_claim', 'check_pass_claim_text', 'actual_verification_text']},
        'original_final_log': proof('.git/trim-contains-governance-final.log'),
        'documents': findings, 'structured_verification_log_proofs': proofs,
        'extra_original_evidence': [proof(p) for p in extra],
        'REQ0015_actual_24_results': {'count': len(lab_rows), 'by_status': dict(collections.Counter(r['status'] for r in lab_rows)),
                                   'proof': proof('workbench/qa/20260925-kimi-complex/evidence/2026-09-25T03-04-13-091Z/results.json')},
        'fifth_issue': {'original_50_file_inventory': proof('workbench/qa/20261002-trim-contains-closeout/mixed-governance-differences.json'),
                        'records': ['REQ-0037', 'REQ-0038', 'REQ-0039', 'REQ-0040'], 'ownership': 'MIXED_UNCONFIRMED; runtime hashes do not establish authorship'}})


def file_inventory():
    mapping = read_json(CLOSEOUT / 'source-service-package-map.json')
    archive = read_json(CLOSEOUT / 'archive-manifest.json')
    deltas = {r['path']: r for r in archive['archived_source_files']}
    mapped = {r['path']: r for r in mapping['checked_files']}
    roles = collections.defaultdict(set)
    def add(name, role):
        roles[name.replace('\\', '/')].add(role)
    for name in mapped:
        add(name, 'candidate_runtime_import_closure_or_explicit_shipped_file')
    for base in ['workbench/server', 'workbench/web-v2', 'harness-probe/src', 'src']:
        for p in (ROOT / base).rglob('*'):
            if p.is_file() and p.suffix in {'.mjs', '.js', '.json', '.html', '.css', '.yml', '.cs'}:
                add(p.relative_to(ROOT).as_posix(), 'formal_service_fingerprint_input')
    for name in ['package.json', 'package-lock.json', 'workbench/package.json', 'workbench/package-lock.json',
                 'harness-probe/package.json', 'harness-probe/package-lock.json',
                 'workbench/server/skills/ui-test-authoring-v1/SKILL.md', 'workbench/server/skills/backend-http-plan-v1/SKILL.md']:
        add(name, 'formal_service_fingerprint_input')
    manifest = read_json(ROOT / 'workbench/scripts/test-manifest.json')
    for file in manifest['unit']:
        add('workbench/' + file, '558_test_run_manifest')
    # Fixed reproducible entry/build files. Historical paid acceptance drivers
    # and .local model output/data are deliberately not collected.
    for name in ['workbench/scripts/test-manifest.json', 'workbench/scripts/run-unit-checks.mjs',
                 'workbench/scripts/package-portable.py', 'workbench/scripts/package-candidate.py',
                 'workbench/scripts/build-credential-broker.mjs', 'workbench/native/WindowsCredential.cs',
                 'workbench/scripts/verify-official-workbench.mjs',
                 'workbench/tests/trim-contains-quality.test.mjs']:
        add(name, 'run_or_build_or_targeted_retest_entry')
    for p in PREVIOUS.rglob('*'):
        if p.is_file() and p.name in {'scenario.mjs', 'run-scenario.mjs', 'original-case.json', 'case-library.json', 'requirements.json', 'protocol.json', 'prd.md', 'mrd.md'}:
            add(p.relative_to(ROOT).as_posix(), 'accepted_trim_contains_retest_fixture')
    # Expand literal relative imports from tests/build; include URL fixture
    # references if regular files. Do not read dependencies or arbitrary data.
    changed = True
    while changed:
        changed = False
        for name in list(roles):
            p = ROOT / name
            if not p.is_file() or p.suffix not in {'.mjs', '.js', '.py'}:
                continue
            text = p.read_text(encoding='utf-8-sig', errors='replace')
            refs = re.findall(r"(?:\bfrom\s*|\bimport\s*|\bimport\s*\(|new URL\s*\()['\"](\.[^'\"]+)['\"]", text)
            refs += re.findall(r"['\"]((?:workbench|harness-probe|src|vendor|fixtures|tests)/[^'\"\n]+)['\"]", text)
            for ref in refs:
                target = p.parent / ref if ref.startswith('.') else ROOT / ref
                if target.is_file() and target.resolve().is_relative_to(ROOT) and '.local' not in target.parts and 'node_modules' not in target.parts:
                    rel = target.resolve().relative_to(ROOT).as_posix()
                    if rel not in roles:
                        add(rel, 'literal_import_or_file_URL_dependency')
                        changed = True
    head_files = set(git('ls-tree', '-r', '--name-only', '-z', 'HEAD').stdout.decode('utf-8').rstrip('\0').split('\0'))
    git_modified = set(git('diff', '--name-only', '-z', 'HEAD').stdout.decode('utf-8').rstrip('\0').split('\0'))
    initial = {x['path']: x for x in read_json(PREVIOUS / 'initial-state.json')['original_dirty_files']}
    rows = []
    PRIVATE.mkdir(exist_ok=True)
    patch_folder = PRIVATE / 'review-patches'
    patch_folder.mkdir(exist_ok=True)
    secret_patterns = {'api_key_shape': rb'\bsk-[A-Za-z0-9_-]{24,}',
                       'private_key_block': rb'-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----\r?\n[A-Za-z0-9+/=\r\n]{64,}',
                       'credential_assignment': rb'(?i)(?:api[_-]?key|password|authorization|cookie)\s*[:=]\s*[\x22\x27](?!Bearer\s*[\x22\x27]|[\x22\x27])[^\x22\x27\r\n]{12,}[\x22\x27]'}
    for name in sorted(roles):
        p = ROOT / name
        if not p.is_file():
            rows.append({'path': name, 'roles': sorted(roles[name]), 'state': 'REQUIRED_FILE_MISSING_ON_DISK'})
            continue
        b = p.read_bytes()
        committed = git('show', 'HEAD:' + name).stdout if name in head_files else None
        state = ('IN_HEAD_IDENTICAL' if committed == b else 'TRACKED_MODIFIED' if committed is not None and name in git_modified
                 else 'IN_HEAD_CHECKOUT_EOL_DIFFERENCE' if committed is not None else 'ABSENT_FROM_HEAD')
        row = {'path': name, 'roles': sorted(roles[name]), 'bytes': len(b), 'disk_sha256': sha(b),
               'HEAD_sha256': sha(committed) if committed is not None else None, 'state': state,
               'initial_dirty_sha256': initial.get(name, {}).get('sha256'),
               'matches_original_preserved_bytes': initial.get(name, {}).get('sha256') == sha(b) if name in initial else None,
               'sensitive_candidates': [], 'authorship': 'HEAD_EXISTING' if state.startswith('IN_HEAD_') else 'PREEXISTING_UNCONFIRMED'}
        for label, pattern in secret_patterns.items():
            hits = list(re.finditer(pattern, b))
            if hits:
                row['sensitive_candidates'].append({'kind': label, 'lines': [b[:m.start()].count(b'\n')+1 for m in hits]})
        if name in mapped:
            row['package_mapping'] = mapped[name]
        if name in deltas:
            delta = deltas[name]
            row['R4_owned_delta'] = delta
            row['matches_proven_R4_after'] = delta['after_sha256'] == sha(b)
            if delta['baseline_kind'] == 'R4_ADDITION_NOT_PRESENT_PRE_R4' and row['matches_proven_R4_after']:
                row['authorship'] = 'R4_NEW_FILE_PROVEN_CURRENT_REQ0038'
            elif row['matches_proven_R4_after']:
                row['authorship'] = 'R4_DELTA_PROVEN_WHOLE_OLDER_BODY_UNCONFIRMED'
        if state == 'TRACKED_MODIFIED' and not row['sensitive_candidates'] and p.suffix != '.exe':
            before = committed.decode('utf-8-sig', errors='replace').splitlines(keepends=True)
            after = b.decode('utf-8-sig', errors='replace').splitlines(keepends=True)
            diff = ''.join(difflib.unified_diff(before, after, fromfile='HEAD/' + name, tofile='disk/' + name, n=3))
            patch_name = name.replace('/', '__') + '.patch'
            (patch_folder / patch_name).write_text(diff, encoding='utf-8')
            row['full_review_patch_private'] = '.git/release-engineering-20261002/review-patches/' + patch_name
            row['diff_hunk_headers'] = re.findall(r'^@@.*@@.*$', diff, re.M)
        elif state == 'ABSENT_FROM_HEAD':
            row['exact_diff'] = 'Entire regular file is absent in HEAD; review disk file at recorded SHA, not an authored R4 whole-file change.'
        rows.append(row)
    externals = []
    for license_file in mapping['source']['license_runtime']['files']:
        externals.append({**license_file, 'scope': 'external @offline/device-license runtime; absent from this Git repo',
                          'required_input': 'versioned component 0.2.0 + RSA 1.0.0-rsa SDK/DLL/binaries and source/build provenance; no issuer private key'})
    dependencies = []
    for relative in ['', 'workbench/', 'harness-probe/']:
        lock = read_json(ROOT / (relative + 'package-lock.json'))
        for key, value in lock['packages'].items():
            if key.startswith('node_modules/'):
                dependencies.append({'lockfile': relative+'package-lock.json', 'path': relative+key,
                                     'version': value.get('version'), 'integrity': value.get('integrity'),
                                     'resolved': value.get('resolved'), 'link': value.get('link', False),
                                     'dev': value.get('dev', False), 'os': value.get('os'), 'cpu': value.get('cpu')})
    save('required-file-inventory.json', {'scope': 'runtime package closure + source fingerprint + exact 77-file test manifest + literal test/build dependencies; not a release approval',
        'head': git('rev-parse', 'HEAD').stdout.decode().strip(),
        'counts': dict(collections.Counter(r['state'] for r in rows)),
        'role_counts_overlapping_do_not_sum': dict(collections.Counter(role for r in rows for role in r['roles'])),
        'test_manifest_files': len(manifest['unit']), 'files': rows, 'external_component_runtime': externals,
        'sensitivity_policy': 'Pattern candidates are triage only; must inspect affected lines before any staging. Real .local data/config/credentials excluded.',
        'dependencies': dependencies, 'dependency_source': 'three exact lockfiles; installation not performed',
        'additional_external_build_inputs': ['Windows x64 Node >=22 executable + public license', 'Playwright browsers matched to lockfile + revision list',
                                           'Windows .NET/framework compiler + architecture-matched credential binary',
                                           'versioned external offline-license component', 'RSA3072 public trust profile only; issuer key excluded'],
        'reuse_mapping': proof('workbench/qa/20261001-release-goal-round4/closeout/source-service-package-map.json')})


def main():
    governance_audit()
    file_inventory()
    health = json.load(urllib.request.urlopen('http://127.0.0.1:4322/api/health', timeout=10))
    save('service-readonly.json', health)
    inventory = read_json(OUT / 'required-file-inventory.json')
    gates = read_json(OUT / 'governance-statements.json')
    print(json.dumps({'document_predicates': [r['predicate_reproduced'] for r in gates['documents']],
                      'required_file_counts': inventory['counts'], 'models_called': 0,
                      'new_workbench_started': False}, ensure_ascii=False))


if __name__ == '__main__':
    main()
