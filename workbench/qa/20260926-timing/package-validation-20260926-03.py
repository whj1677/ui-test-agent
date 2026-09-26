"""Verify candidate 03 bytes, source closure and bounded negative archives."""
import hashlib
import importlib.util
import json
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
ARCHIVE = HERE / 'package-candidate-20260926-03.zip'
PREVIOUS = ROOT / 'workbench/qa/20260925-release/package-candidate-20260926-02.zip'
EXTRACT = HERE / 'package-extract-20260926-03'
spec = importlib.util.spec_from_file_location('package_candidate', ROOT / 'workbench/scripts/package-candidate.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

assert not EXTRACT.exists(), 'EXTRACT_ALREADY_EXISTS'
result = module.verify(ARCHIVE)
with ZipFile(ARCHIVE) as source, ZipFile(PREVIOUS) as previous:
    entries = [(item.filename, source.read(item.filename)) for item in source.infolist()]
    records = {item['path']: item for item in json.loads(source.read('candidate-manifest.json'))['files']}
    old = {item['path']: item for item in json.loads(previous.read('candidate-manifest.json'))['files']}
    required = {
        'workbench/server/build/timing-obligations.mjs',
        'workbench/server/build/timing-observer.mjs',
        'workbench/server/build/timing-evidence.mjs',
        'harness-probe/src/verify-candidate.mjs',
    }
    assert required <= records.keys(), 'TIMING_RUNTIME_CLOSURE_MISSING'
    assert "../../workbench/server/build/timing-evidence.mjs" in source.read(
        'harness-probe/src/verify-candidate.mjs').decode('utf-8'), 'CROSS_DIRECTORY_IMPORT_MISSING'
    assert set(records) == set(module.collect()), 'SOURCE_FILE_SET_DRIFT'
    changed = [name for name, item in records.items()
               if hashlib.sha256((ROOT / name).read_bytes()).hexdigest() != item['sha256']]
    assert not changed, f'SOURCE_BYTES_DRIFT:{changed}'
    locks = ('package-lock.json', 'workbench/package-lock.json', 'harness-probe/package-lock.json')
    assert all(records[name]['sha256'] == old[name]['sha256'] for name in locks), 'LOCKFILE_CHANGED'
    names = [name for name, _ in entries]
    assert all(module.allowed_name(name) for name in names)
    assert all((EXTRACT / name).resolve().is_relative_to(EXTRACT.resolve()) for name in names)
    assert all(not any(part in {'.local', 'node_modules', '.git'} for part in Path(name).parts) for name in names)

cases = {
    'timing_tamper': [(n, b + b'X' if n == 'workbench/server/build/timing-evidence.mjs' else b)
                      for n, b in entries],
    'missing_timing': [(n, b) for n, b in entries if n != 'workbench/server/build/timing-evidence.mjs'],
    'extra_file': entries + [('unexpected.txt', b'extra')],
    'path_traversal': entries + [('../escape.txt', b'escape')],
}
rejections = {}
for label, variant in cases.items():
    trial = HERE / f'package-negative-{label}-20260926-03.zip'
    with ZipFile(trial, 'x', compression=ZIP_DEFLATED) as target:
        for name, data in variant:
            target.writestr(name, data)
    try:
        module.verify(trial)
    except ValueError as error:
        rejections[label] = str(error)
    else:
        raise AssertionError(f'INVALID_ARCHIVE_ACCEPTED:{label}')

EXTRACT.mkdir()
for name, data in entries:
    destination = EXTRACT / name
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(data)
print(json.dumps({'positive': result, 'file_count_with_manifest': len(entries),
                  'new_files_against_02': sorted(set(records) - set(old)),
                  'removed_files_against_02': sorted(set(old) - set(records)),
                  'three_locks_unchanged': True, 'source_byte_drift': changed,
                  'safe_extract': str(EXTRACT), 'rejections': rejections},
                 ensure_ascii=False, indent=2))
