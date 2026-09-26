"""Bounded integrity, closure and negative checks for candidate 02."""
import hashlib
import importlib.util
import json
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
ARCHIVE = HERE / 'package-candidate-20260926-02.zip'
PREVIOUS = HERE / 'package-candidate-20260926-01.zip'
spec = importlib.util.spec_from_file_location('package_candidate', ROOT / 'workbench/scripts/package-candidate.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

result = module.verify(ARCHIVE)
with ZipFile(ARCHIVE) as source, ZipFile(PREVIOUS) as previous:
    entries = [(item.filename, source.read(item.filename)) for item in source.infolist()]
    manifest = json.loads(source.read('candidate-manifest.json'))
    old = {item['path']: item['sha256'] for item in json.loads(previous.read('candidate-manifest.json'))['files']}
    records = {item['path']: item for item in manifest['files']}
    names = [name for name, _ in entries]
    assert all(module.allowed_name(name) for name in names)
    assert 'workbench/server/auth/session-request-policy.mjs' in records
    assert set(records) == set(module.collect()), 'SOURCE_FILE_SET_DRIFT'
    changed = [name for name, item in records.items()
               if hashlib.sha256((ROOT / name).read_bytes()).hexdigest() != item['sha256']]
    assert not changed, f'SOURCE_BYTES_DRIFT:{changed}'
    lock_names = ('package-lock.json', 'workbench/package-lock.json', 'harness-probe/package-lock.json')
    assert all(records[name]['sha256'] == old[name] for name in lock_names), 'LOCKFILE_CHANGED'
    assert all(not any(part in {'.local', 'node_modules', '.git'} for part in Path(name).parts) for name in names)

cases = {
    'tampered_byte': [(n, b + b'X' if n == 'workbench/server/auth/session-request-policy.mjs' else b)
                      for n, b in entries],
    'extra_file': entries + [('unexpected.txt', b'extra')],
    'path_traversal': entries + [('../escape.txt', b'escape')],
}
rejections = {}
for label, variant in cases.items():
    trial = HERE / f'package-negative-{label}-20260926-02.zip'
    with ZipFile(trial, 'x', compression=ZIP_DEFLATED) as target:
        for name, data in variant:
            target.writestr(name, data)
    try:
        module.verify(trial)
    except ValueError as error:
        rejections[label] = str(error)
    else:
        raise AssertionError(f'INVALID_ARCHIVE_ACCEPTED:{label}')

print(json.dumps({'positive': result, 'file_count_with_manifest': len(names),
                  'new_files_against_01': sorted(set(records) - set(old)),
                  'three_locks_unchanged': True, 'source_byte_drift': changed,
                  'rejections': rejections}, ensure_ascii=False, indent=2))
