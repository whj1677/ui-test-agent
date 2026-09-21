const mode = process.argv[2];

const line = (value) => `${JSON.stringify(value)}\n`;
const completed = [
  { type: 'session', sessionId: 'synthetic' },
  { type: 'tool_call', tool: 'mcp__playwright-mcp__browser_navigate' },
  { type: 'status', phase: 'turn_end', reason: { kind: 'completed' } },
  { type: 'final', text: 'synthetic done' },
];

if (mode === 'chunked-complete') {
  const body = completed.map(line).join('');
  process.stdout.write(body.slice(0, 17));
  setTimeout(() => process.stdout.write(body.slice(17, 61)), 20);
  setTimeout(() => process.stdout.end(body.slice(61)), 40);
} else if (mode === 'partial-error') {
  process.stdout.write(line({ type: 'status', phase: 'step_start' }));
  process.stderr.write('synthetic child failure');
  process.exitCode = 7;
} else if (mode === 'terminal-no-newline') {
  process.stdout.write(completed.slice(0, -1).map(line).join(''));
  process.stdout.end(JSON.stringify(completed.at(-1)));
} else if (mode === 'truncated-json') {
  process.stdout.end('{"type":"final","text":"unfinished"');
} else if (mode === 'many-tools') {
  let count = 0;
  setInterval(() => {
    count += 1;
    process.stdout.write(line({ type: 'tool_call', tool: `synthetic_tool_${count}` }));
  }, 15);
} else if (mode === 'sleep') {
  process.stdout.write(line({ type: 'status', phase: 'step_start' }));
  setInterval(() => {}, 1000);
} else {
  process.exitCode = 9;
}
