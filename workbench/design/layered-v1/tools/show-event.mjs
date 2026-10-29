/** 查看某类事件的原始结构；用法：node show-event.mjs <日志> <类型> */
import {readMultiFrameZstd, parseJsonLines} from '../packages/ui-automation-core/zstd-frames.mjs';

const [file, type] = process.argv.slice(2);
const {records} = parseJsonLines(readMultiFrameZstd(file).text);
const hits = records.filter((record) => (record?.event?.type ?? record?.type) === type);
console.log('matched:', hits.length);
for (const record of hits.slice(0, 2)) {
  console.log('--- raw ---');
  console.log(JSON.stringify(record, null, 2).slice(0, 2200));
  const inner = record?.event ?? record;
  console.log('--- inner.data keys:', Object.keys(inner?.data ?? {}).join(','));
}
