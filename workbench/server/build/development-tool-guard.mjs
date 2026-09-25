import path from 'node:path';
import fs from 'node:fs';
import { checkDomRead } from './development-dom-read.mjs';
export const name = 'workbench-development-tool-guard';
export const inject = ['tools'];
const native = new Set(['read','read_image','write','edit']);
const browserNames = new Set(['browser_navigate','browser_snapshot','browser_take_screenshot','browser_evaluate','browser_click','browser_select_option','browser_wait_for','browser_press_key','browser_fill_form']);
export const allowedBrowserTools = [...browserNames].map(name => `mcp__playwright-mcp__${name}`);
const workbenchNames = new Set(['run_diagnostic','read_draft','write_draft','self_test','read_evidence','check_fidelity','submit_candidate'].map(name=>`mcp__workbench__${name}`));
export function taskFileAllowed(file, root, readOnly = false) {
  if (!root || typeof file !== 'string' || !file || file.includes(':') && !path.isAbsolute(file)) return false;
  const base = path.resolve(root), target = path.resolve(base, file), relative = path.relative(base,target);
  const managedObservation = readOnly && /^\.playwright-mcp[\\/]([^\\/]+)\.(yml|yaml|log|png)$/.test(relative);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || relative.split(path.sep).some(p=>p.includes(':') || p.startsWith('.') && !(managedObservation && p === '.playwright-mcp') || p === 'node_modules' || /^package(-lock)?\.json$/.test(p))) return false;
  for (let current=target;;current=path.dirname(current)) { try { if (fs.lstatSync(current).isSymbolicLink()) return false; } catch(e) { if(e.code!=='ENOENT')return false; } if(current===base)break; }
  return true;
}
export function developmentToolAllowed(tool,args,normalUrl,root) {
  if (workbenchNames.has(tool)) return true;
  if (native.has(tool)) return taskFileAllowed(args?.file_path,root, ['read','read_image'].includes(tool));
  const prefix='mcp__playwright-mcp__';
  if(!tool.startsWith(prefix)||!browserNames.has(tool.slice(prefix.length)))return false;
  if (tool === `${prefix}browser_snapshot` && args?.filename) return /^[a-zA-Z0-9_-]+\.yml$/.test(args.filename) && !args.path && !args.code && taskFileAllowed(path.join('.playwright-mcp',args.filename),root,true);
  if(args?.filename||args?.path||args?.code)return false;
  if(tool===`${prefix}browser_evaluate`) { try { return checkDomRead(args?.function); } catch { return false; } }
  if(args?.function)return false;
  return tool!==`${prefix}browser_navigate`||args?.url===normalUrl;
}
export function apply(ctx) {
  ctx.on('agent/created',({agent})=>{
    agent.ctx.tools.presentAs('native');
    const deny=ctx.tools.schemas().map(t=>t.name).filter(n=>n!=='run_code'&&!native.has(n)&&!workbenchNames.has(n)&&!allowedBrowserTools.includes(n));
    if(deny.length)agent.ctx.tools.restrict({deny});
  });
  ctx.on('tools/pre-execute',async(exec,next)=>developmentToolAllowed(exec.name,exec.arguments,process.env.WORKBENCH_DEVELOPMENT_NORMAL_URL,process.env.WORKBENCH_DEVELOPMENT_DIRECTORY)
    ? next():{kind:'deny',reason:JSON.stringify({code:'TASK_TOOL_POLICY_DENIED',rule:'TASK_DEVELOPMENT_SCOPE',tool:exec.name,draft_saved:false,
      reason:'Native file tools are confined to the development directory (no links/runtime overrides). Browser navigation is bound; evaluate accepts read-only DOM expressions; screenshots use browser-managed output. Arbitrary shell and script execution remain unavailable without stronger isolation.',
      alternatives:[...native,...workbenchNames,...allowedBrowserTools]})});
}
