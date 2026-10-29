"""Build a small offline patch. Never includes an installed environment or data."""
import argparse
import difflib
import hashlib
import json
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[2]
CODE = [
    'workbench/server/requirements/manager.mjs',
    'workbench/server/requirements-routes.mjs',
    'workbench/web-v2/requirements-api.js',
    'workbench/web-v2/case-assistant.js',
]
PAYLOAD = ['workbench/server/requirements/' + name for name in (
    'office-reader.mjs', 'office-word-reader.exe', 'office-word-reader.build.json', 'office-word-reader.cs')]
sha = lambda b: hashlib.sha256(b).hexdigest()
encoded = lambda x: (json.dumps(x, ensure_ascii=False, indent=2) + '\n').encode('utf-8')


def apply_office_changes(base, current, legacy):
    # Keep old-version behavior outside this feature. Context-bound hunks are
    # generated from the frozen pre-feature file; all preimages are hashed.
    text = legacy.decode('utf-8').replace('\r\n', '\n')
    if 'const materialsDisabled = ' not in text and 'const disabled = () => busy || Boolean(activeTurn()) || !capability;' in text:
        text = text.replace('const disabled = () => busy || Boolean(activeTurn()) || !capability;',
                            'const materialsDisabled = () => busy || Boolean(activeTurn());\n  const disabled = () => materialsDisabled() || !capability;')
        text = text.replace('disabled: disabled()', 'disabled: materialsDisabled()')
        text = text.replace('upload.disabled = disabled()', 'upload.disabled = materialsDisabled()')
        text = text.replace('else { draft.files.push(...chosen); setError(null); paintFiles(); }',
                            "else { draft.files.push(...chosen); setError(capability ? null : new Error('CASE_ASSISTANT_UNAVAILABLE')); paintFiles(); }")
    left, right = base.decode('utf-8').replace('\r\n', '\n').splitlines(keepends=True), current.decode('utf-8').replace('\r\n', '\n').splitlines(keepends=True)
    changes = []
    for group in difflib.SequenceMatcher(None, left, right, autojunk=False).get_grouped_opcodes(2):
        before = ''.join(left[group[0][1]:group[-1][2]])
        after = ''.join(right[group[0][3]:group[-1][4]])
        if text.count(before) != 1:
            raise ValueError('UPGRADE_CONTEXT_NOT_SUPPORTED')
        text = text.replace(before, after, 1)
        changes.append((before, after))
    return text.encode('utf-8')


def build(output, original, previous, bootstrap):
    if output.exists():
        raise ValueError('UPGRADE_NEW_OUTPUT_REQUIRED')
    with ZipFile(original) as old, ZipFile(previous) as recent:
        definition = {'schema': 'workbench/incremental-upgrade-v1', 'id': 'office-docx-read-v1',
                      'requirement': 'REQ-0001/v15', 'environment_included': False,
                      'node_sha256': [], 'payload': [], 'edits': []}
        files = {}
        for name in PAYLOAD:
            data = (ROOT / name).read_bytes()
            files['payload/' + name] = data
            definition['payload'].append({'path': name, 'bytes': len(data), 'sha256': sha(data)})
        for name in CODE:
            current, base = (ROOT / name).read_bytes(), recent.read(name)
            if sha(apply_office_changes(base, current, base)) != sha(current.replace(b'\r\n', b'\n')):
                raise ValueError('UPGRADE_CURRENT_PATCH_NOT_EXACT:' + name)
            variants = {}
            for archive in (old, recent):
                before = archive.read(name)
                after = apply_office_changes(base, current, before)
                variants[sha(before)] = {'before_sha256': sha(before), 'after_sha256': sha(after),
                                         'changes': [{'before': before.decode('utf-8'), 'after': after.decode('utf-8')}]}
            definition['edits'].append({'path': name, 'variants': list(variants.values())})
        for archive in (old, recent):
            manifest = json.loads(archive.read('portable-manifest.json'))
            digest = next(x['sha256'] for x in manifest['files'] if x['path'] == 'runtime/node/node.exe')
            if digest not in definition['node_sha256']:
                definition['node_sha256'].append(digest)
    files['upgrade.json'] = encoded(definition)
    files['upgrade.mjs'] = (ROOT / 'workbench/scripts/incremental-upgrade.mjs').read_bytes()
    files['升级测试工作台.exe'] = bootstrap.read_bytes()
    files['升级说明.md'] = (ROOT / 'workbench/docs/office-upgrade.md').read_bytes()
    if any('/node_modules/' in n or n.startswith(('runtime/', 'node_modules/')) for n in files):
        raise ValueError('UPGRADE_ENVIRONMENT_REJECTED')
    output.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(output, 'x', compression=ZIP_DEFLATED, compresslevel=9) as archive:
        for name, data in sorted(files.items()):
            archive.writestr(name, data)
    return {'status': 'INCREMENTAL_UPGRADE_BUILT_PENDING_TARGET_VALIDATION', 'files': len(files),
            'bytes': output.stat().st_size, 'sha256': sha(output.read_bytes()),
            'payload_files': len(PAYLOAD), 'edited_program_files': len(CODE),
            'variants': {x['path']: len(x['variants']) for x in definition['edits']},
            'contains_environment': False, 'contains_user_document': False}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['output', 'original', 'previous', 'bootstrap']:
        parser.add_argument('--' + name, required=True, type=Path)
    args = parser.parse_args()
    print(json.dumps(build(args.output, args.original, args.previous, args.bootstrap), ensure_ascii=False, indent=2))
