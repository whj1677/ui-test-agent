"""Bounded integrity and safe extraction check for this release candidate."""
import importlib.util
import json
import shutil
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
ARCHIVE = HERE / 'package-candidate-20260926-01.zip'
EXTRACT = HERE / 'package-extract-20260926-01'
SCRIPT = ROOT / 'workbench/scripts/package-candidate.py'
spec = importlib.util.spec_from_file_location('package_candidate', SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

assert not EXTRACT.exists(), 'EXTRACT_ALREADY_EXISTS'
result = module.verify(ARCHIVE)
with ZipFile(ARCHIVE) as source:
    entries = [(item.filename, source.read(item.filename)) for item in source.infolist()]
    names = [name for name, _ in entries]
    assert 'workbench/examples/M3A_CASE_IMPORT_TEMPLATE_V1.xlsx' in names
    assert all(module.allowed_name(name) for name in names)
    assert all((EXTRACT / name).resolve().is_relative_to(EXTRACT.resolve()) for name in names)
    assert all(not any(p in {'.local', 'node_modules', '.git'} for p in Path(name).parts) for name in names)

cases = {
    'tampered_byte': [(n, b + b'X' if n == 'workbench/config/empty-trial.json' else b) for n, b in entries],
    'extra_file': entries + [('unexpected.txt', b'extra')],
    'path_traversal': entries + [('../escape.txt', b'escape')],
}
rejections = {}
for label, variant in cases.items():
    trial = HERE / f'package-negative-{label}-20260926-01.zip'
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
with ZipFile(ARCHIVE) as source:
    for name in names:
        destination = EXTRACT / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(source.read(name))
packaged_script = EXTRACT / 'workbench/scripts/package-candidate.py'
packaged_source = SCRIPT.read_bytes()
assert packaged_script.read_bytes() == packaged_source
print(json.dumps({'positive': result, 'rejections': rejections,
                  'extraction': str(EXTRACT), 'file_count_with_manifest': len(names)},
                 ensure_ascii=False, indent=2))
