/**
 * 多帧 zstd 读取器
 *
 * 背景（实测）：DSH 会话日志 `session.v4.jsonl.zstd` 是**多帧拼接**的 zstd 文件。
 * Node 的 zstdDecompressSync / createZstdDecompress 只解出第一帧（实测 514662 字节的日志只解出 327 字节），
 * 因此直接调用标准库会静默截断，只能看到 session 头、看不到任何对话。
 *
 * 做法：扫描 zstd 帧幻数 0x28 B5 2F FD，逐帧独立解压；某帧失败则连同其后内容停止，
 * 并把「已解出/已截断」的边界如实报告给调用方——不允许把截断当成完整。
 */
import fs from 'node:fs';
import zlib from 'node:zlib';

const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);

function frameStarts(buffer) {
  const offsets = [];
  let index = buffer.indexOf(MAGIC);
  while (index !== -1) {
    offsets.push(index);
    index = buffer.indexOf(MAGIC, index + MAGIC.length);
  }
  return offsets;
}

/**
 * @returns {{text: string, frames: number, framesDecoded: number, truncated: boolean, reason: string|null}}
 */
export function readMultiFrameZstd(file) {
  const raw = fs.readFileSync(file);
  if (!raw.subarray(0, 4).equals(MAGIC)) {
    throw Object.assign(new Error('NOT_ZSTD'), {code: 'NOT_ZSTD'});
  }
  const starts = frameStarts(raw);
  const parts = [];
  let reason = null;
  for (let i = 0; i < starts.length; i += 1) {
    const from = starts[i];
    const to = i + 1 < starts.length ? starts[i + 1] : raw.length;
    try {
      parts.push(zlib.zstdDecompressSync(raw.subarray(from, to)));
    } catch (error) {
      reason = `FRAME_${i}_FAILED:${String(error?.message ?? error).slice(0, 80)}`;
      break;
    }
  }
  const text = Buffer.concat(parts).toString('utf8');
  return {
    text,
    frames: starts.length,
    framesDecoded: parts.length,
    truncated: parts.length !== starts.length,
    reason,
  };
}

/** 解析 JSONL；损坏行不静默丢弃，计数后如实返回。 */
export function parseJsonLines(text) {
  const lines = text.split('\n');
  const records = [];
  let malformed = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      records.push(JSON.parse(trimmed));
    } catch {
      malformed += 1;
    }
  }
  return {records, malformed, totalLines: lines.filter((l) => l.trim()).length};
}
