"""Build and verify a source-only, pending-acceptance Windows candidate.

Never reads .local, runtime data, saved model credentials or node_modules.
Does not start services, install dependencies, approve scripts or publish.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path, PurePosixPath
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[2]
DIRECTORIES = ('workbench/server', 'workbench/web', 'workbench/web-v2')
FILES = (
    'package.json', 'package-lock.json', 'workbench/package.json', 'workbench/package-lock.json',
    'harness-probe/package.json', 'harness-probe/package-lock.json',
    '安装.ps1', '安装.cmd', '启动.ps1', '启动.cmd', '环境检查.cmd', '试用说明.md',
    'harness-probe/src/setup-harness.mjs',
    'workbench/scripts/start-workbench.ps1', 'workbench/scripts/check-install.ps1',
    'workbench/scripts/start-workbench.local.json.example',
    'workbench/scripts/unfamiliar-site-server.mjs',
    'workbench/scripts/package-candidate.py',
    'workbench/config/candidate.playwright.config.mjs', 'workbench/config/empty-trial.json',
    'workbench/examples/M3A_CASE_IMPORT_TEMPLATE_V1.xlsx',
    'workbench/docs/release-candidate.md',
)
EXTENSIONS = {'.mjs', '.js', '.json', '.html', '.css', '.yml', '.svg'}
MANIFEST = 'candidate-manifest.json'
SECRET = re.compile(rb'(?:sk-[A-Za-z0-9_-]{24,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)')


def sha(data):
    return hashlib.sha256(data).hexdigest()


def allowed_name(name):
    parts = PurePosixPath(name).parts
    return (bool(parts) and not name.startswith('/') and '\\' not in name and ':' not in name
            and all(p not in ('..', '.', '.local', 'node_modules', 'data', '.git') for p in parts)
            and not any(p.startswith('.env') or p.endswith('.local.json') or '.dpapi' in p for p in parts))


def collect(root=ROOT):
    names = set(FILES)
    for directory in DIRECTORIES:
        base = root / directory
        if not base.is_dir():
            raise ValueError(f'PACKAGE_DIRECTORY_MISSING:{directory}')
        for p in base.rglob('*'):
            if p.is_symlink():
                raise ValueError('PACKAGE_SYMLINK_REJECTED')
            if p.is_file() and p.suffix in EXTENSIONS:
                names.add(p.relative_to(root).as_posix())
    content = {}
    pending = sorted(names)
    while pending:
        name = pending.pop(0)
        if name in content:
            continue
        if not allowed_name(name):
            raise ValueError(f'PACKAGE_PATH_REJECTED:{name}')
        p = root / name
        if p.is_symlink() or not p.is_file() or not p.resolve().is_relative_to(root.resolve()):
            raise ValueError(f'PACKAGE_FILE_MISSING_OR_UNSAFE:{name}')
        data = p.read_bytes()
        if SECRET.search(data):
            raise ValueError(f'PACKAGE_POSSIBLE_SECRET:{name}')
        content[name] = data
        if not name.endswith(('.mjs', '.js')):
            continue
        source = data.decode('utf-8-sig')
        imports = re.findall(r"^\s*(?:import|export)\s+[^;'\"]*?\bfrom\s+['\"]([^'\"]+)['\"]|^\s*import\s*['\"]([^'\"]+)['\"]", source, re.M)
        for left, right in imports:
            spec = left or right
            if spec.startswith('.'):
                target = (root / name).parent.joinpath(spec).resolve().relative_to(root.resolve()).as_posix()
                if target not in content:
                    if not target.startswith(('harness-probe/src/', 'workbench/scripts/', 'workbench/server/', 'workbench/web', 'src/')):
                        raise ValueError(f'PACKAGE_IMPORT_OUTSIDE_RUNTIME:{name}:{spec}')
                    pending.append(target)
    return dict(sorted(content.items()))


def build(destination):
    content = collect()
    records = [{'path': name, 'bytes': len(data), 'sha256': sha(data)} for name, data in content.items()]
    manifest = {'schema': 'workbench/candidate-package-v1', 'status': 'PENDING_ACCEPTANCE',
                'entry': 'http://127.0.0.1:4322/workspace/', 'model_enabled_by_default': False,
                'includes_private_data': False, 'files': records,
                'content_sha256': sha(json.dumps(records, ensure_ascii=False, sort_keys=True).encode()),
                'limitations': ['clean Windows not verified', 'independent human operation not verified',
                                'real business target not verified', 'no OS file or network sandbox',
                                'model setup requires explicit local configuration; no credentials included']}
    destination.parent.mkdir(parents=True, exist_ok=True)
    # Exclusive create: an earlier candidate is evidence, never overwritten.
    with ZipFile(destination, 'x', compression=ZIP_DEFLATED) as archive:
        for name, data in content.items():
            archive.writestr(name, data)
        archive.writestr(MANIFEST, json.dumps(manifest, ensure_ascii=False, indent=2).encode())
    return verify(destination)


def verify(archive_path):
    with ZipFile(archive_path) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)) or any(not allowed_name(name) for name in names):
            raise ValueError('PACKAGE_UNSAFE_OR_DUPLICATE_ENTRY')
        manifest = json.loads(archive.read(MANIFEST))
        if manifest.get('schema') != 'workbench/candidate-package-v1' or manifest.get('status') != 'PENDING_ACCEPTANCE':
            raise ValueError('PACKAGE_MANIFEST_INVALID')
        records = manifest['files']
        listed = [item['path'] for item in records]
        if len(listed) != len(set(listed)) or set(names) != set(listed) | {MANIFEST}:
            raise ValueError('PACKAGE_FILE_SET_MISMATCH')
        if sha(json.dumps(records, ensure_ascii=False, sort_keys=True).encode()) != manifest['content_sha256']:
            raise ValueError('PACKAGE_CONTENT_DIGEST_MISMATCH')
        for record in records:
            data = archive.read(record['path'])
            if len(data) != record['bytes'] or sha(data) != record['sha256']:
                raise ValueError('PACKAGE_FILE_DIGEST_MISMATCH:' + record['path'])
            if SECRET.search(data):
                raise ValueError('PACKAGE_POSSIBLE_SECRET:' + record['path'])
    return {'status': 'PACKAGE_BYTES_VERIFIED_NOT_PRODUCT_ACCEPTANCE', 'file_count': len(records),
            'content_sha256': manifest['content_sha256'], 'zip_sha256': sha(archive_path.read_bytes()),
            'archive': str(archive_path.resolve())}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--output', type=Path)
    group.add_argument('--verify', type=Path)
    args = parser.parse_args()
    print(json.dumps(build(args.output) if args.output else verify(args.verify), ensure_ascii=False, indent=2))
