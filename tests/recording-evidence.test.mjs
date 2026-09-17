import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RecordingEvidence,
  recordingPages,
  observationCaption,
} from '../src/recording-evidence.mjs';

test('recording pages retain long Chinese text and Unicode without truncation', () => {
  const text = '这是已确认的预期🙂'.repeat(70);
  const pages = recordingPages(text);
  assert.equal(pages.join(''), text);
  assert.ok(pages.every((page) => Array.from(page).length <= 140));
  assert.ok(pages.length > 1);
});

test('recording captions redact secrets and treat expected markup as plain data', () => {
  const pages = recordingPages(
    'password=synthetic-secret sk-syntheticKeyExample <script>bad</script>',
  );
  assert.ok(!pages.join('').includes('synthetic-secret'));
  assert.ok(!pages.join('').includes('sk-syntheticKeyExample'));
  assert.ok(pages.join('').includes('<script>bad</script>'));
});

test('atomic actual values are not converted into four failures when their group fails', () => {
  const caption = observationCaption([
    { check: 'text', actual: '苹果', passed: true, group_passed: false },
    { check: 'text', actual: '错误状态', passed: false, group_passed: false },
  ]);
  assert.match(caption, /苹果（该项匹配）/);
  assert.match(caption, /错误状态（该项不匹配）/);
});

test('media rendering failure preserves original business mismatch and records partial evidence', async () => {
  const result = {
    status: 'FAIL_ASSERTION',
    business_status: 'ASSERTION_MISMATCH',
    evidence_status: 'COMPLETE',
  };
  const recording = new RecordingEvidence({}, { case_id: 'C', title: '测试', steps: [] }, result);
  recording.render = async () => {
    throw new Error('synthetic renderer failure');
  };
  await recording.show('断言未满足', '读取', '正确状态', '错误状态');
  assert.equal(result.status, 'FAIL_ASSERTION');
  assert.equal(result.business_status, 'ASSERTION_MISMATCH');
  assert.equal(result.evidence_status, 'PARTIAL');
  assert.deepEqual(result.recording.issues, ['RECORDING_CUE_UNAVAILABLE']);
});
