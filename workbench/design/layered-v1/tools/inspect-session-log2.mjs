import fs from 'node:fs';
import zlib from 'node:zlib';

const file = process.argv[2];
const raw = fs.readFileSync(file);
console.log('raw bytes:', raw.length);
console.log('magic:', raw.subarray(0, 4).toString('hex'));

let out = null;
try {
  out = zlib.zstdDecompressSync(raw);
  console.log('sync decompressed bytes:', out.length);
} catch (error) {
  console.log('sync failed:', error.message);
}

// 流式解压：处理多帧拼接（会话日志追加写通常会形成多帧）
try {
  const streamed = zlib.zstdDecompressSync
    ? await new Promise((resolve, reject) => {
        const chunks = [];
        const stream = zlib.createZstdDecompress();
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
        stream.end(raw);
      })
    : null;
  console.log('stream decompressed bytes:', streamed?.length ?? 'n/a');
  if (streamed && streamed.length > (out?.length ?? 0)) out = streamed;
} catch (error) {
  console.log('stream failed:', error.message);
}

if (!out) process.exit(1);

const text = out.toString('utf8');
const lines = text.split('\n').filter((line) => line.trim());
console.log('lines:', lines.length);
console.log('first line:', lines[0]?.slice(0, 200));
console.log('last line:', lines.at(-1)?.slice(0, 200));

const counts = new Map();
for (const line of lines) {
  try {
    const parsed = JSON.parse(line);
    const type = parsed?.event?.type ?? parsed?.type ?? 'UNKNOWN';
    counts.set(type, (counts.get(type) || 0) + 1);
  } catch {
    counts.set('PARSE_FAILED', (counts.get('PARSE_FAILED') || 0) + 1);
  }
}
console.log('type counts:', JSON.stringify(Object.fromEntries(counts), null, 2));

const seen = new Set();
for (const line of lines) {
  let parsed;
  try {
    parsed = JSON.parse(line);
  } catch {
    continue;
  }
  const type = parsed?.event?.type ?? parsed?.type ?? 'UNKNOWN';
  if (seen.has(type)) continue;
  seen.add(type);
  const inner = parsed?.event ?? parsed;
  if (['user/message', 'assistant/message', 'tool/call', 'tool/result', 'turn/start', 'turn/end', 'step/start'].includes(type)) {
    console.log(`\n--- SAMPLE ${type} ---`);
    console.log(JSON.stringify({topKeys: Object.keys(parsed), innerKeys: Object.keys(inner), dataKeys: Object.keys(inner?.data ?? {}), preview: JSON.stringify(inner?.data ?? {}).slice(0, 600)}, null, 2));
  }
}
