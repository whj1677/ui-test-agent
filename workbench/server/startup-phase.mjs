import {performance} from 'node:perf_hooks';
import {diagnostics} from './diagnostics.mjs';

const phases=new Set(['LICENSE','RUN_RECOVERY','BUILD_RECOVERY','NATIVE_WORKSPACE','NATIVE_HOST','NATIVE_HISTORY','SERVICE_IDENTITY']);
/** Diagnostic-only projection: never include inputs, outputs, paths or errors. */
export async function startupPhase(phase,operation,{now=()=>performance.now(),report=event=>console.log(JSON.stringify(event))}={}) {
  if(!phases.has(phase))throw Error('STARTUP_PHASE_INVALID');
  const started=now();
  const emit=state=>{const event={type:'startup_phase',phase,state,elapsed_ms:Math.max(0,Math.round(now()-started))};void diagnostics.record('startup',state,event,state==='FAILED'?'error':'info');try{report(event);}catch{}};
  emit('STARTED');
  try {const result=await operation();emit('COMPLETED');return result;}
  catch(error){emit('FAILED');await diagnostics.record('startup','phase.failed',{phase,error},'error');throw error;}
}
