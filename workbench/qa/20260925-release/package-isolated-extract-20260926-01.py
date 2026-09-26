"""Extract verified candidate to a new temp directory without ancestor Node modules."""
import importlib.util
import json
import os
from pathlib import Path
from zipfile import ZipFile

HERE = Path(__file__).resolve().parent
SOURCE = HERE / 'package-candidate-20260926-01.zip'
TARGET = Path(os.environ['TEMP']) / 'ui-test-agent-package-20260926-01'
SCRIPT = HERE.parents[2] / 'workbench/scripts/package-candidate.py'
spec = importlib.util.spec_from_file_location('package_candidate', SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
assert not TARGET.exists(), 'TARGET_ALREADY_EXISTS'
for ancestor in (TARGET, *TARGET.parents):
    assert not (ancestor / 'node_modules').exists(), f'ANCESTOR_NODE_MODULES:{ancestor}'
module.verify(SOURCE)
with ZipFile(SOURCE) as archive:
    names = archive.namelist()
    assert all(module.allowed_name(name) for name in names)
    assert all((TARGET / name).resolve().is_relative_to(TARGET.resolve()) for name in names)
    TARGET.mkdir()
    for name in names:
        destination = TARGET / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(archive.read(name))
print(json.dumps({'target': str(TARGET), 'files': len(names),
                  'ancestor_node_modules': False, 'service_started': False}, ensure_ascii=False))
