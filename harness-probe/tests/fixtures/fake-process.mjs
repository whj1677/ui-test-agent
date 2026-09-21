import { spawn } from 'node:child_process';

const mode = process.argv[2];
if (mode === 'json-complete') {
  console.log(JSON.stringify({ type: 'session', sessionId: 'fake', cwd: process.cwd() }));
  console.log(JSON.stringify({ type: 'tool_call', tool: 'mcp__playwright-mcp__browser_navigate', callId: '1', input: {} }));
  console.log(JSON.stringify({ type: 'status', phase: 'turn_end', reason: { kind: 'completed' } }));
  console.log(JSON.stringify({ type: 'final', text: 'done' }));
} else if (mode === 'sleep') {
  setInterval(() => {}, 1000);
} else if (mode === 'tree') {
  spawn(process.execPath, [new URL(import.meta.url).pathname, 'sleep'], { stdio: 'ignore' });
  setInterval(() => {}, 1000);
} else if (mode === 'secret') {
  console.log('Authorization: Bearer super-secret-value');
} else {
  process.exitCode = 7;
}
