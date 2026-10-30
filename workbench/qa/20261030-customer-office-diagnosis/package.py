"""Build the standalone field tool. Verify ZIP again from a native Node reader."""
from pathlib import Path
import hashlib
import json
import zipfile

qa = Path(__file__).resolve().parent
root = qa.parents[2]
out = root / 'outputs' / '20261030-\u73b0\u573aWPS\u8bca\u65ad-v1'
out.mkdir(parents=True, exist_ok=True)
entries = {
    '\u53cc\u51fb\u8bca\u65ad.cmd': qa / 'Collect-Diagnostics.cmd',
    'collect.ps1': qa / 'collect.ps1',
    'collect-system.ps1': qa / 'collect-system.ps1',
    'collect.mjs': qa / 'collect.mjs',
    'OfficeReaderTrace.exe': qa / 'OfficeReaderTrace.exe',
    'trace-build.json': qa / 'trace-build.json',
    '\u4f7f\u7528\u8bf4\u660e.md': qa / '\u4f7f\u7528\u8bf4\u660e.md',
}
archive = out / '\u6d4b\u8bd5Agent-\u73b0\u573a\u8bca\u65ad\u5305-v1.zip'
data = {name: file.read_bytes() for name, file in entries.items()}
for name, value in data.items():
    if name.endswith(('.ps1', '.mjs', '.md', '.json', '.cmd')):
        value.decode('utf-8-sig')
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for name, value in data.items():
        z.writestr(name, value)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert set(z.namelist()) == set(data)
    for name, value in data.items():
        assert z.read(name) == value
manifest = {
    'schema': 'office-field-diagnostic-delivery/v1',
    'file': archive.name,
    'bytes': archive.stat().st_size,
    'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
    'entries': [{'name': name, 'bytes': len(value), 'sha256': hashlib.sha256(value).hexdigest()}
                for name, value in data.items()],
    'product_worker_modified': False,
    'model_calls': 0,
}
(out / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(out / 'SHA256-combined.sha256').write_text(manifest['sha256'] + '  ' + archive.name + '\n', encoding='utf-8')
print(json.dumps({k: v for k, v in manifest.items() if k != 'entries'}, ensure_ascii=True))
