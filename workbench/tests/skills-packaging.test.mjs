import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { sourceFingerprint } from '../server/service-identity.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const skillFiles = [
  'workbench/server/skills/ui-test-authoring-v1/SKILL.md',
  'workbench/server/skills/backend-http-plan-v1/SKILL.md',
  'workbench/server/skills/case-design-v1/SKILL.md',
];

test('candidate collection packages only the fixed DSH skills and verifies their bytes', async () => {
  const output = path.join(os.tmpdir(), `skills-candidate-${process.pid}-${Date.now()}.zip`);
  const python = String.raw`
import hashlib, importlib.util, json, os, shutil, sys, tempfile
from pathlib import Path
from zipfile import ZipFile
root = Path(sys.argv[1]).resolve()
archive = Path(sys.argv[2])
spec = importlib.util.spec_from_file_location('candidate', root / 'workbench/scripts/package-candidate.py')
module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
skills = [
 'workbench/server/skills/ui-test-authoring-v1/SKILL.md',
 'workbench/server/skills/backend-http-plan-v1/SKILL.md',
 'workbench/server/skills/case-design-v1/SKILL.md',
]
content = module.collect(root)
assert all(name in content for name in skills)
records = {name: hashlib.sha256(content[name]).hexdigest() for name in skills}
result = module.build(archive)
assert result['status'] == 'PACKAGE_BYTES_VERIFIED_NOT_PRODUCT_ACCEPTANCE'
with ZipFile(archive) as z:
 manifest = json.loads(z.read(module.MANIFEST))
 listing = {item['path']: item for item in manifest['files']}
 for name in skills:
  assert name in listing
  assert listing[name]['sha256'] == records[name]
  assert z.read(name) == content[name]
# Recreate the collected source closure in a temporary root and prove that a
# missing fixed skill fails closed without changing the checked-in sources.
with tempfile.TemporaryDirectory(prefix='skills-collect-root-') as temporary:
 clone = Path(temporary)
 for directory in module.DIRECTORIES: (clone / directory).mkdir(parents=True, exist_ok=True)
 for name, data in content.items():
  target = clone / name; target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(data)
 missing = clone / skills[0]; missing.unlink()
 try: module.collect(clone)
 except ValueError as error: assert str(error).startswith('PACKAGE_FILE_MISSING_OR_UNSAFE:')
 else: raise AssertionError('missing fixed skill was accepted')
print(json.dumps({'status': result['status'], 'file_count': result['file_count'], 'skills': records}, sort_keys=True))
`;
  try {
    const result = spawnSync('python', ['-c', python, repoRoot, output], { encoding: 'utf8', timeout: 120_000 });
    assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
    const summary = JSON.parse(result.stdout.trim());
    assert.equal(summary.status, 'PACKAGE_BYTES_VERIFIED_NOT_PRODUCT_ACCEPTANCE');
    assert.deepEqual(Object.keys(summary.skills).sort(), [...skillFiles].sort());
  } finally {
    await fs.rm(output, { force: true });
  }
});

test('source identity changes when any fixed skill changes', async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'skills-fingerprint-'));
  try {
    for (const relative of ['workbench/server', 'workbench/web-v2', 'harness-probe/src', 'src']) {
      await fs.cp(path.join(repoRoot, relative), path.join(temporary, relative), { recursive: true });
    }
    for (const relative of ['package.json', 'package-lock.json', 'workbench/package.json', 'workbench/package-lock.json', 'harness-probe/package.json', 'harness-probe/package-lock.json', 'workbench/native/package.json', 'workbench/native/package-lock.json', 'workbench/release.json', 'workbench/scripts/native-dsh-package.mjs', 'workbench/scripts/native-runtime.mjs', 'workbench/scripts/native-entry.mjs']) {
      const destination = path.join(temporary, relative);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.copyFile(path.join(repoRoot, relative), destination);
    }
    const before = await sourceFingerprint(temporary);
    for (const relative of skillFiles) {
      const skill = path.join(temporary, relative);
      const original = await fs.readFile(skill);
      await fs.appendFile(skill, '\n<!-- packaging identity probe -->\n');
      assert.notEqual((await sourceFingerprint(temporary)).source_sha256, before.source_sha256, relative);
      await fs.writeFile(skill, original);
    }
  } finally {
    assert.equal(path.dirname(temporary), os.tmpdir());
    await fs.rm(temporary, { recursive: true, force: true });
  }
});
