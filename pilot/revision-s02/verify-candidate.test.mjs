import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

const oldFile = new URL('../tests/sorting.spec.ts', import.meta.url);
const candidateFile = new URL('./tests/sorting.spec.ts', import.meta.url);
const attemptFile = new URL('./attempts/correction-1/sorting.spec.ts', import.meta.url);
const text = await fs.readFile(candidateFile, 'utf8');
const oldText = await fs.readFile(oldFile, 'utf8');
const attemptText = await fs.readFile(attemptFile, 'utf8');
const sha = (value) => createHash('sha256').update(value).digest('hex');

test('candidate is the unedited generator output and the old draft stays unchanged', () => {
  assert.equal(sha(text), '280a787546aabdd87570838932663a5dc254aee5e0c329be3a13294e9a18079a');
  assert.equal(text, attemptText);
  assert.equal(sha(oldText), 'a189e62bca7bd09b217ca954ebbcf2436e4abae6c5ee83a1f08bef7bc126f812');
});

test('S02 owns the row-set completeness assertion', () => {
  const s02 = text.slice(text.indexOf("test.step('S02'"), text.indexOf("test.step('S03'"));
  assert.match(s02, /rowCountBefore\s*=\s*await rows\.count\(\)/);
  assert.match(s02, /expect\(rows\)\.toHaveCount\(rowCountBefore\)/);
  assert.match(s02, /columnheader.*toHaveText\(headerTexts\)/s);
  assert.match(s02, /beforeRowCellTexts/);
  assert.match(s02, /H101/);
  assert.match(s02, /H102/);
  assert.match(s02, /H103/);
  assert.match(s02, /共12条 · 第1\/4页/);
});

test('candidate has no bypass or hidden retry constructs', () => {
  assert.doesNotMatch(text, /\.skip\s*\(|\.fixme\s*\(|expect\.soft|try\s*\{|catch\s*\(|retries|expectedStatus|PILOT_ENTRY_URL\s*[!=]=|fault/i);
});
