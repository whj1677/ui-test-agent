"""Build a fresh Windows x64 portable candidate from explicit runtime inputs.

No network, npm install, copied user profile, service startup, license issuing or
existing-directory deletion. Repeated equal inputs produce equal ZIP bytes.
"""
import argparse
import hashlib
import importlib.util
import json
import os
import re
import shutil
import subprocess
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('source_package', Path(__file__).with_name('package-candidate.py'))
SOURCE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SOURCE)
POLICY = 'workbench/server/licensing/deployment-policy.mjs'
MANIFEST = 'portable-manifest.json'
LOCAL_COMPONENT_FILES = ('package.json', 'index.mjs', 'hardware.mjs', 'bin/DeviceLicense.dll', 'bin/DeviceLicense.Bridge.exe', 'bin/build-manifest.json')
FORBIDDEN_PARTS = {'.git', '.local', '.npmrc', '.yarnrc', '.pnpm-store', '.env', '.DS_Store'}
PRIVATE_KEY_BLOCK = re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----\r?\n[A-Za-z0-9+/=\r\n]{64,}')


def digest(data):
    return hashlib.sha256(data).hexdigest()


def windows_io_path(value):
    path = Path(value).resolve()
    name = str(path)
    if os.name != 'nt' or name.startswith('\\\\?\\'):
        return path
    return Path('\\\\?\\UNC\\' + name[2:] if name.startswith('\\\\') else '\\\\?\\' + name)


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + '\n').encode('utf-8')


def native_path(value):
    name = str(value)
    if name.startswith('\\\\?\\UNC\\'):
        return '\\\\' + name[8:]
    return name[4:] if name.startswith('\\\\?\\') else name


def safe_name(name):
    parts = name.split('/')
    return bool(name) and not name.startswith('/') and '\\' not in name and ':' not in name and all(p and p not in ('.', '..') and p not in FORBIDDEN_PARTS and not p.startswith('.env') for p in parts)


def read_regular(file, allowed_root):
    file, allowed_root = Path(file), Path(allowed_root).resolve()
    if file.is_symlink() or not file.is_file() or not file.resolve().is_relative_to(allowed_root):
        raise ValueError('PORTABLE_UNSAFE_SOURCE:' + str(file))
    return file.read_bytes()


def write_file(stage, relative, data):
    if not safe_name(relative):
        raise ValueError('PORTABLE_UNSAFE_PATH:' + relative)
    if PRIVATE_KEY_BLOCK.search(data):
        raise ValueError('PORTABLE_PRIVATE_KEY_BLOCK_REJECTED:' + relative)
    destination = windows_io_path(stage / relative)
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        if destination.read_bytes() != data:
            raise ValueError('PORTABLE_DUPLICATE_DIFFERENT_FILE:' + relative)
        return
    with destination.open('xb') as stream:
        stream.write(data)


def copy_tree(stage, source, destination, *, omit_modules=False):
    source = Path(source)
    if source.is_symlink() or not source.is_dir():
        raise ValueError('PORTABLE_SOURCE_DIRECTORY_INVALID:' + str(source))
    for directory, folders, files in os.walk(source, followlinks=False):
        base = Path(directory)
        for name in folders:
            if (base / name).is_symlink():
                raise ValueError('PORTABLE_SYMLINK_REJECTED:' + str(base / name))
        folders[:] = sorted(n for n in folders if n not in FORBIDDEN_PARTS and not n.startswith('.env') and not (omit_modules and n == 'node_modules'))
        for name in sorted(files):
            if name in FORBIDDEN_PARTS or name.startswith('.env'):
                continue
            relative = (Path(destination) / (base / name).relative_to(source)).as_posix()
            write_file(stage, relative, read_regular(base / name, source))


def applicable(values, target):
    if not values:
        return True
    if '!' + target in values:
        return False
    positive = [x for x in values if not x.startswith('!')]
    return not positive or target in positive


def copy_component(stage, source, destination, expected_version):
    source = Path(source).resolve()
    package = json.loads(read_regular(source / 'package.json', source))
    if package.get('name') != '@offline/device-license' or package.get('version') != expected_version:
        raise ValueError('PORTABLE_LICENSE_COMPONENT_IDENTITY_MISMATCH')
    names = list(LOCAL_COMPONENT_FILES) + [p.relative_to(source).as_posix() for p in (source / 'core').rglob('*.mjs')]
    records = []
    for name in sorted(set(names)):
        data = read_regular(source / name, source)
        if SOURCE.SECRET.search(data):
            raise ValueError('PORTABLE_COMPONENT_PRIVATE_KEY:' + name)
        write_file(stage, destination + '/' + name, data)
        records.append({'path': name, 'bytes': len(data), 'sha256': digest(data)})
    return {'name': package['name'], 'version': expected_version, 'files': records, 'content_sha256': digest(json_bytes(records))}


def copy_dependencies(stage, root, relative):
    base = root / relative
    lock = json.loads(read_regular(base / 'package-lock.json', root))
    records, components = [], []
    for name, item in sorted(lock['packages'].items()):
        if not name.startswith('node_modules/') or item.get('dev'):
            continue
        if not applicable(item.get('os'), 'win32') or not applicable(item.get('cpu'), 'x64'):
            continue
        source = base / name
        destination = (Path(relative) / name).as_posix()
        if item.get('link'):
            if name != 'node_modules/@offline/device-license':
                raise ValueError('PORTABLE_UNRECOGNIZED_LOCAL_DEPENDENCY:' + name)
            linked = lock['packages'].get(item.get('resolved'), {})
            components.append(copy_component(stage, base / item['resolved'], destination, linked.get('version')))
            records.append({'path': destination, 'version': linked.get('version'), 'source': 'explicit-component-runtime-whitelist'})
            continue
        manifest = json.loads(read_regular(source / 'package.json', root))
        if manifest.get('version') != item.get('version'):
            raise ValueError('PORTABLE_DEPENDENCY_VERSION_MISMATCH:' + destination)
        copy_tree(stage, source, destination, omit_modules=True)
        records.append({'path': destination, 'version': item['version'], 'lock_integrity': item.get('integrity')})
    return records, components


def validate_trust(file, node):
    value = json.loads(Path(file).read_text(encoding='utf-8-sig'))
    if set(value) != {'schema', 'product', 'profileId', 'publicKey'} or value['schema'] != 'workbench/license-trust-v1' or value['product'] != 'ui-test-agent' or value['profileId'] != 'windows-baseboard-v1' or not isinstance(value['publicKey'], str):
        raise ValueError('PORTABLE_TRUST_INVALID')
    if 'PRIVATE KEY' in value['publicKey']:
        raise ValueError('PORTABLE_PRIVATE_KEY_REJECTED')
    if not re.fullmatch(r'-----BEGIN PUBLIC KEY-----\r?\n[A-Za-z0-9+/=\r\n]+\r?\n-----END PUBLIC KEY-----\s*', value['publicKey']):
        raise ValueError('PORTABLE_PUBLIC_KEY_FORMAT_INVALID')
    checked = subprocess.run([str(node), '-e', "const k=require('node:crypto').createPublicKey(process.argv[1]);if(k.asymmetricKeyType!=='rsa'||k.asymmetricKeyDetails.modulusLength!==3072||k.asymmetricKeyDetails.publicExponent!==65537n)process.exit(1)", '--', value['publicKey']], capture_output=True, timeout=10)
    if checked.returncode:
        raise ValueError('PORTABLE_PUBLIC_KEY_INVALID')
    return value


def deployment_policy(args, node):
    no_license = bool(getattr(args, 'no_device_license', False))
    trust_file = getattr(args, 'trust_file', None)
    if no_license:
        if trust_file:
            raise ValueError('PORTABLE_LICENSE_MODE_CONFLICT')
        return {'required': False, 'trust': None}
    if not trust_file:
        raise ValueError('PORTABLE_EXPLICIT_LICENSE_MODE_REQUIRED')
    return {'required': True, 'trust': validate_trust(trust_file, node)}


def build(args):
    if os.name != 'nt':
        raise ValueError('PORTABLE_BUILD_REQUIRES_WINDOWS_X64')
    root = Path(args.root).resolve()
    stage = Path(args.stage).resolve()
    archive_path = Path(args.output).resolve()
    if stage == root or root.is_relative_to(stage) or stage.exists() or archive_path.exists() or archive_path.is_relative_to(stage):
        raise ValueError('PORTABLE_REQUIRES_NEW_STAGE_AND_ARCHIVE')
    node = Path(args.node).resolve()
    version = subprocess.check_output([str(node), '-p', "process.version+' '+process.platform+' '+process.arch"], timeout=10, text=True).strip()
    match = re.fullmatch(r'v(\d+)\.\d+\.\d+ win32 x64', version)
    if not match or int(match[1]) < 22:
        raise ValueError('PORTABLE_NODE_VERSION_INVALID')
    policy = deployment_policy(args, node)
    node_license = Path(args.node_license).read_bytes()
    if b'Permission is hereby granted' not in node_license or len(node_license) < 1000:
        raise ValueError('PORTABLE_NODE_LICENSE_REQUIRED')
    content = SOURCE.collect(root)
    # Installed dependency trees can exceed MAX_PATH even when the package root
    # is short. Keep validation canonical, then use Windows extended paths for
    # every recursive I/O operation; ZIP member names remain relative.
    root = windows_io_path(root)
    stage = windows_io_path(stage)
    archive_path = windows_io_path(archive_path)
    # Package the explicitly selected policy; omission never disables licensing.
    content[POLICY] = b'// Generated explicit deployment policy.\nexport const deploymentPolicy = ' + json_bytes(policy).rstrip() + b';\n'
    stage.mkdir(parents=True, exist_ok=False)
    for name, data in content.items():
        write_file(stage, name, data)
    dependencies, components = [], []
    for relative in ('.', 'workbench', 'harness-probe', 'workbench/native'):
        deps, local = copy_dependencies(stage, root, relative)
        dependencies.extend(deps)
        components.extend(local)
    write_file(stage, 'runtime/node/node.exe', read_regular(node, node.parent))
    write_file(stage, 'runtime/node/LICENSE', node_license)
    browsers = json.loads((root / 'workbench/node_modules/playwright-core/browsers.json').read_text(encoding='utf8'))['browsers']
    browser_root = windows_io_path(args.browsers)
    browser_records = []
    for name in ('chromium', 'chromium-headless-shell', 'ffmpeg', 'winldd'):
        config = next(item for item in browsers if item['name'] == name)
        directory = name.replace('-', '_') + '-' + config['revision']
        copy_tree(stage, browser_root / directory, 'runtime/browsers/' + directory)
        browser_records.append({'name': name, 'revision': config['revision'], 'version': config.get('browserVersion')})
    records = []
    for file in sorted(stage.rglob('*')):
        if file.is_file():
            data = file.read_bytes()
            records.append({'path': file.relative_to(stage).as_posix(), 'bytes': len(data), 'sha256': digest(data)})
    manifest = {'schema': 'workbench/portable-package-v1', 'status': 'PENDING_ACCEPTANCE', 'release': json.loads(content['workbench/release.json']), 'platform': 'win32-x64', 'entry': 'http://127.0.0.1:4322/workspace/', 'node_version': version.split()[0], 'browser_version': browser_records[0]['version'], 'browsers': browser_records, 'dependencies': dependencies, 'local_components': components, 'source_sha256': digest(json_bytes([{'path': n, 'sha256': digest(b)} for n, b in sorted(content.items())])), 'includes_credentials': False, 'model_enabled_by_default': False, 'license_required': policy['required'], 'trust_public_key_sha256': digest(policy['trust']['publicKey'].encode()) if policy['required'] else None, 'files': records, 'limitations': ['candidate on current Windows host; clean Windows is not verified', 'hash manifest is not publisher code signing or tamper resistance', 'model API use requires separate user credential and network'] + (['hardware change acceptance requires actual second hardware environment'] if policy['required'] else [])}
    write_file(stage, MANIFEST, json_bytes(manifest))
    # Preserve a diagnostic of the raw stage. Some hosts expose different
    # process byte views for loose files; the serialized ZIP is the deliverable.
    # A failed loose-stage check must never be reported as verified.
    native_stage = native_path(stage)
    native_check = subprocess.run([str(node), str(Path(native_stage) / 'workbench/scripts/verify-portable.mjs'), native_stage],
                                  capture_output=True, text=True, encoding='utf-8', timeout=300)
    native_result = {'status': 'RAW_STAGE_NOT_VERIFIED', 'exit_code': native_check.returncode,
                     'diagnostic': (native_check.stderr.strip() or 'verification returned no valid receipt')[:1000]}
    if native_check.returncode == 0:
        try:
            parsed = json.loads(native_check.stdout)
            if parsed.get('status') == 'PORTABLE_BYTES_VERIFIED_NOT_PRODUCT_ACCEPTANCE' and parsed.get('files') == len(records):
                native_result = parsed
        except (ValueError, TypeError):
            pass
    archive_path.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(archive_path, 'x', compression=ZIP_DEFLATED, compresslevel=6, allowZip64=True) as archive:
        for file in sorted(p for p in stage.rglob('*') if p.is_file()):
            item = ZipInfo(file.relative_to(stage).as_posix(), date_time=(2020, 1, 1, 0, 0, 0))
            item.compress_type = ZIP_DEFLATED
            item.external_attr = 0o100644 << 16
            with archive.open(item, 'w', force_zip64=True) as out, file.open('rb') as stream:
                shutil.copyfileobj(stream, out)
    # Independently read every ZIP entry with the Windows Node runtime. Bind
    # the serialized manifest to the exact builder manifest, then check all
    # entry lengths and hashes; an invalid archive receives no build receipt.
    check = subprocess.run([str(node), str(Path(native_path(root)) / 'workbench/scripts/verify-portable-archive.mjs'),
                            native_path(archive_path), digest(json_bytes(manifest))],
                           capture_output=True, text=True, encoding='utf-8', timeout=300)
    if check.returncode != 0:
        raise ValueError('PORTABLE_NATIVE_ARCHIVE_REJECTED:' + (check.stderr.strip() or 'verification failed')[:1000])
    archive_result = json.loads(check.stdout)
    if archive_result.get('status') != 'PORTABLE_ARCHIVE_BYTES_VERIFIED_NOT_PRODUCT_ACCEPTANCE' or archive_result.get('files') != len(records):
        raise ValueError('PORTABLE_NATIVE_ARCHIVE_RESULT_INVALID')
    return {'status': 'PORTABLE_CANDIDATE_BUILT_NOT_PRODUCT_ACCEPTANCE', 'native_stage_verification': native_result, 'native_archive_verification': archive_result, 'stage': str(stage), 'archive': str(archive_path), 'file_count': len(records), 'bytes_uncompressed': sum(record['bytes'] for record in records), 'zip_bytes': archive_path.stat().st_size, 'zip_sha256': digest(archive_path.read_bytes()), 'dependency_count': len(dependencies), 'local_components': components, 'node_version': manifest['node_version'], 'browser_version': manifest['browser_version']}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', default=ROOT, type=Path)
    parser.add_argument('--stage', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--node', required=True, type=Path)
    parser.add_argument('--node-license', required=True, type=Path)
    parser.add_argument('--browsers', required=True, type=Path)
    license_mode = parser.add_mutually_exclusive_group(required=True)
    license_mode.add_argument('--trust-file', '--TrustFile', type=Path)
    license_mode.add_argument('--no-device-license', action='store_true', help='Explicit engineer trial without device activation')
    print(json.dumps(build(parser.parse_args()), ensure_ascii=False, indent=2))
