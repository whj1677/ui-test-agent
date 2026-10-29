/**
 * 验证 + 落盘：把真实会话的只读对话视图导出为 JSON，便于工作台接入前先核对内容。
 * 用法：node verify-transcript.mjs <session.v4.jsonl.zstd> [输出json路径]
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import {buildTranscript} from '../packages/ui-automation-core/transcript.mjs';
import {readMultiFrameZstd} from '../packages/ui-automation-core/zstd-frames.mjs';

const file = process.argv[2];
const out = process.argv[3];
if (!file) {
  console.error('用法：node verify-transcript.mjs <session.v4.jsonl.zstd> [输出json路径]');
  process.exit(2);
}

// 1) 先证伪：标准库单帧解压会截断
let naive;
try {
  naive = zlib.zstdDecompressSync(fs.readFileSync(file)).length;
} catch (error) {
  naive = `failed: ${error.message}`;
}

const multi = readMultiFrameZstd(file);
const transcript = buildTranscript(file);
if (out) fs.writeFileSync(out, JSON.stringify(transcript, null, 2));

const summarize = (entry) => ({
  seq: entry.seq,
  role: entry.role,
  tool: entry.tool ?? undefined,
  is_error: entry.is_error,
  preview: (entry.text ?? entry.arguments_preview ?? entry.result_preview ?? '').replace(/\s+/g, ' ').slice(0, 120),
});

console.log('=== 完整性 ===');
console.log(
  JSON.stringify(
    {
      naive_single_frame_bytes: naive,
      multi_frame_bytes: Buffer.byteLength(multi.text, 'utf8'),
      frames: multi.frames,
      frames_decoded: multi.framesDecoded,
      truncated: multi.truncated,
      malformed_lines: transcript.integrity.malformed,
      session_id: transcript.session_id,
      rendered_entries: transcript.turns.length,
      skipped_entries: transcript.skipped,
      event_counts: transcript.counts,
    },
    null,
    2,
  ),
);

console.log('\n=== user 消息（编排方传进去的输入）===');
for (const entry of transcript.turns.filter((t) => t.role === 'user')) console.log(JSON.stringify(summarize(entry)));

console.log('\n=== assistant 消息（前 5 条）===');
for (const entry of transcript.turns.filter((t) => t.role === 'assistant').slice(0, 5)) console.log(JSON.stringify(summarize(entry)));

console.log('\n=== 工具调用（前 12 条）===');
for (const entry of transcript.turns.filter((t) => t.role === 'tool_call').slice(0, 12)) console.log(JSON.stringify(summarize(entry)));

console.log('\n=== 工具结果中标记错误的（前 8 条）===');
for (const entry of transcript.turns.filter((t) => t.role === 'tool_result' && t.is_error).slice(0, 8)) console.log(JSON.stringify(summarize(entry)));

const serialized = JSON.stringify(transcript);
const credentialLike = serialized.match(/\bsk-(?=[A-Za-z0-9_-]{20,}\b)[A-Za-z0-9_-]{20,}\b/g);

const assertions = [
  ['多帧解压字节数 > 单帧', typeof naive === 'number' && Buffer.byteLength(multi.text, 'utf8') > naive],
  ['全部帧解码、未截断', multi.truncated === false && multi.framesDecoded === multi.frames],
  ['渲染出至少一条 user 消息', transcript.turns.some((t) => t.role === 'user')],
  ['渲染出至少一条 assistant 消息', transcript.turns.some((t) => t.role === 'assistant')],
  ['渲染出工具调用', transcript.turns.some((t) => t.role === 'tool_call')],
  ['工具结果回填了工具名', transcript.turns.some((t) => t.role === 'tool_result' && t.tool)],
  ['识别出工具错误结果', transcript.turns.some((t) => t.role === 'tool_result' && t.is_error)],
  ['未渲染思考块', transcript.turns.every((t) => !/reasoning|thinking/i.test(t.type))],
  ['无 JSON 原文兜底条目', transcript.turns.every((t) => !/^\{"turn":\d+,"step":\d+/.test(t.text ?? ''))],
  // turn_start / turn_end 是边界标记，本来就没有文本；只要求消息类条目非空
  ['消息类条目均非空', transcript.turns.every((t) => !['user', 'assistant'].includes(t.role) || (t.text ?? '').length > 0)],
  ['无凭据样式残留', !credentialLike],
];
let failed = 0;
console.log('\n=== 断言 ===');
for (const [name, pass] of assertions) {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}`);
  if (!pass) failed += 1;
}
if (credentialLike) console.log('疑似凭据样例:', credentialLike.slice(0, 3));
process.exit(failed ? 1 : 0);
