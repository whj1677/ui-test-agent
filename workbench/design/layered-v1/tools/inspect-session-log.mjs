import fs from 'node:fs';
import zlib from 'node:zlib';

const file = process.argv[2];
const buffer = zlib.zstdDecompressSync(fs.readFileSync(file));
const lines = buffer.toString('utf8').split('\n').filter((line) => line.trim());
const events = [];
for (const line of lines) {
  try {
    events.push(JSON.parse(line));
  } catch {
    /* 跳过不完整行 */
  }
}

const types = new Map();
for (const event of events) {
  const type = event?.event?.type ?? event?.type ?? 'UNKNOWN';
  types.set(type, (types.get(type) || 0) + 1);
}

const sample = {};
for (const event of events) {
  const type = event?.event?.type ?? event?.type ?? 'UNKNOWN';
  if (!sample[type]) sample[type] = event;
}

const shapes = Object.fromEntries(
  Object.entries(sample).map(([type, event]) => {
    const inner = event?.event ?? event;
    const data = inner?.data ?? {};
    return [
      type,
      {
        topKeys: Object.keys(event).slice(0, 12),
        innerKeys: Object.keys(inner).slice(0, 14),
        dataKeys: Object.keys(data).slice(0, 14),
        dataPreview: JSON.stringify(data).slice(0, 320),
      },
    ];
  }),
);

console.log(JSON.stringify({file, totalLines: lines.length, parsed: events.length, typeCounts: Object.fromEntries(types), shapes}, null, 2));
