"""Read-only history/frozen-source/package checks for the bounded timing round."""
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZipFile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
DATA = ROOT / 'workbench/.local/fresh25-b'
LEDGER = 'build-tasks/development-authorizations.json'

def digest(raw):
    return hashlib.sha256(raw).hexdigest()

before = json.loads((HERE / 'history-before.json').read_text('utf-8-sig'))
missing = [name for name in before if not (DATA / name).is_file()]
changed = [name for name, value in before.items()
           if (DATA / name).is_file() and digest((DATA / name).read_bytes()) != value]
ledger = json.loads((DATA / LEDGER).read_text('utf-8'))
# This round began after the three previous authenticated generation attempts.
new_entries = [entry for entry in ledger['entries']
               if entry.get('registered_at', '') >= '2026-09-26T02:00:00.000Z']
ledger['entries'] = [entry for entry in ledger['entries'] if entry not in new_entries]
restored = digest((json.dumps(ledger, ensure_ascii=False, indent=2) + '\n').encode())
fixture = HERE.parent / '20260925-release/fixture'
frozen = json.loads((fixture / 'freeze.json').read_text('utf-8-sig'))['files']
fixture_drift = [name for name, value in frozen.items() if digest((fixture / name).read_bytes()) != value]
archive = HERE / 'package-candidate-20260926-04.zip'
with ZipFile(archive) as source:
    manifest = json.loads(source.read('candidate-manifest.json'))
    names = [item.filename for item in source.infolist()]
    expected = [item['path'] for item in manifest['files']] + ['candidate-manifest.json']
    assert len(names) == len(set(names)) and set(names) == set(expected)
    byte_drift = [item['path'] for item in manifest['files'] if digest(source.read(item['path'])) != item['sha256']]
    source_drift = [item['path'] for item in manifest['files'] if digest((ROOT / item['path']).read_bytes()) != item['sha256']]
result = {'checked_at': datetime.now(timezone.utc).isoformat(),
          'scope': 'history and package integrity; not business acceptance',
          'old_json_count': len(before), 'changed_old_json': changed, 'missing_old_json': missing,
          'new_authorization_entries': len(new_entries),
          'new_task_ids': [entry.get('task_id') for entry in new_entries],
          'old_ledger_matches_baseline': restored == before[LEDGER],
          'changed_frozen_fixture': fixture_drift, 'package_source_count': len(manifest['files']),
          'package_byte_drift': byte_drift, 'package_source_drift': source_drift,
          'zip_sha256': digest(archive.read_bytes())}
(HERE / 'supervisor-integrity.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', 'utf-8')
print(json.dumps(result, ensure_ascii=False, indent=2))
assert not missing and all(name == LEDGER for name in changed)
assert len(new_entries) <= 2 and restored == before[LEDGER]
assert all(entry['project_id'] == 'project-93d8424d-0576-4c76-b18e-2157f823d8f8' for entry in new_entries)
assert not fixture_drift and not byte_drift and not source_drift
