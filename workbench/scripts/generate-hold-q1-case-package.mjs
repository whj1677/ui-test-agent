import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPaths } from '../server/paths.mjs';
import { holdQ1CasePackage } from '../server/build/heldout-query.mjs';

const workbenchRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputIndex = process.argv.indexOf('--output');
if (outputIndex < 0 || !process.argv[outputIndex + 1]) throw new Error('Usage: node scripts/generate-hold-q1-case-package.mjs --output <private-path>');
const output = path.resolve(process.argv[outputIndex + 1]);
const paths = createPaths({ localRoot: path.join(workbenchRoot, '.local') });
const pkg = await holdQ1CasePackage(paths);
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, `${JSON.stringify(pkg, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ output, package_id: pkg.package_id, cases: pkg.cases.length }));
