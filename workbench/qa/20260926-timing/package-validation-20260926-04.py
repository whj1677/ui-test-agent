"""Compare candidate 04 with frozen source and candidate 03 byte by byte."""
import hashlib
import importlib.util
import json
from pathlib import Path
from zipfile import ZipFile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
CURRENT = HERE / 'package-candidate-20260926-04.zip'
PREVIOUS = HERE / 'package-candidate-20260926-03.zip'
EXTRACT = HERE / 'package-extract-20260926-04'
spec = importlib.util.spec_from_file_location('package_candidate', ROOT / 'workbench/scripts/package-candidate.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

assert not EXTRACT.exists(), 'EXTRACT_ALREADY_EXISTS'
positive = module.verify(CURRENT)
with ZipFile(CURRENT) as current, ZipFile(PREVIOUS) as previous:
    new_records = {item['path']: item for item in json.loads(current.read('candidate-manifest.json'))['files']}
    old_records = {item['path']: item for item in json.loads(previous.read('candidate-manifest.json'))['files']}
    new_paths, old_paths = set(new_records), set(old_records)
    added, removed = sorted(new_paths - old_paths), sorted(old_paths - new_paths)
    modified = sorted(name for name in new_paths & old_paths
                      if new_records[name]['sha256'] != old_records[name]['sha256'])
    expected = ['workbench/docs/release-candidate.md', 'workbench/web-v2/app.js',
                'workbench/web-v2/execution-media.js']
    assert not added and not removed, f'FILE_SET_CHANGED:{added}:{removed}'
    assert modified == expected, f'UNEXPECTED_SOURCE_CHANGE:{modified}'
    protected = sorted(name for name in new_paths if name.startswith(('harness-probe/src/', 'workbench/server/')))
    protected_changed = [name for name in protected if current.read(name) != previous.read(name)]
    assert not protected_changed, f'EXECUTION_SOURCE_CHANGED:{protected_changed}'
    locks = ['package-lock.json', 'workbench/package-lock.json', 'harness-probe/package-lock.json']
    assert all(current.read(name) == previous.read(name) for name in locks), 'LOCKS_CHANGED'
    packager = 'workbench/scripts/package-candidate.py'
    assert current.read(packager) == previous.read(packager), 'PACKAGER_CHANGED'
    assert set(module.collect()) == new_paths, 'COLLECT_FILE_SET_DRIFT'
    source_changed = [name for name in new_paths
                      if hashlib.sha256((ROOT / name).read_bytes()).hexdigest() != new_records[name]['sha256']]
    assert not source_changed, f'SOURCE_BYTES_DRIFT:{source_changed}'
    names = current.namelist()
    assert all(module.allowed_name(name) for name in names)
    assert all((EXTRACT / name).resolve().is_relative_to(EXTRACT.resolve()) for name in names)
    assert all(not any(part in {'.local', 'node_modules', '.git'} for part in Path(name).parts) for name in names)
    EXTRACT.mkdir()
    for name in (packager, 'workbench/web-v2/app.js', 'workbench/web-v2/execution-media.js'):
        target = EXTRACT / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(current.read(name))

print(json.dumps({'positive': positive, 'source_file_count': len(new_records),
                  'added': added, 'removed': removed, 'modified': modified,
                  'protected_source_file_count': len(protected),
                  'protected_source_changed': protected_changed,
                  'locks_unchanged': locks, 'packager_unchanged': True,
                  'source_byte_drift': source_changed,
                  'extracted_for_static_checks': str(EXTRACT)}, ensure_ascii=False, indent=2))
