export function createServiceShutdown({nativeDshManager,caseAssistantManager,demonstrations,backendManager,state,server,runManager,buildManager,batchManager,scriptOperations,authSessions,requirementsManager,requirementsModel,onError=()=>{},drainMs=10000}) {
  let pending;
  return function shutdown() {
    if (pending) return pending;
    state.accepting = false;
    state.shutting_down = true;
    for (const manager of [runManager,buildManager,batchManager,scriptOperations,demonstrations]) if (manager) manager.shutdownRequested = true;
    pending = (async () => {
      const deadline = Date.now()+drainMs;
      state.shutdown_errors = [];
      const bounded = async (operation,promise) => {
        let timer;
        try { return await Promise.race([promise,new Promise((_,reject)=>{
          timer=setTimeout(()=>reject(Error('SHUTDOWN_DRAIN_TIMEOUT')),Math.max(1,deadline-Date.now()));
        })]); } finally {clearTimeout(timer);}
      };
      // Close admission immediately; existing requests are allowed to finish.
      const serverClosed = new Promise(resolve => server.close(resolve));
      server.closeIdleConnections?.();
      const stop = async (operation, invoke) => { try { await bounded(operation,Promise.resolve().then(invoke)); } catch(error) { state.shutdown_errors.push({operation,code:error.code||error.message});onError(error,operation); } };
      await stop('backend_stop',()=>backendManager?.shutdown());
      await stop('native_dsh_stop',()=>nativeDshManager?.shutdown());
      await stop('demonstrations_close',()=>demonstrations?.closeAll());
      await stop('requirements_stop',()=>requirementsManager?.shutdown());
      await stop('case_assistant_stop',()=>caseAssistantManager?.shutdown());
      if (scriptOperations?.active) await stop('script_stop',()=>scriptOperations.stop(scriptOperations.active.operation.operation_id,scriptOperations.active.operation.project_id));
      if (batchManager?.active) await stop('batch_stop',()=>batchManager.stop(batchManager.active.id));
      const stopExecutors = async () => {
        if (buildManager?.active) await stop('build_stop',()=>buildManager.active.runId
          ? buildManager.stopCandidateTrial(buildManager.active.runId) : buildManager.stop(buildManager.active.taskId));
        if (runManager?.active) await stop('run_stop',()=>runManager.stop(runManager.active.runId));
      };
      await stopExecutors();
      // Starting methods must check shutdownRequested again before launching an executor.
      await stop('preparation_drain',async()=>{
        while ([runManager,buildManager,batchManager,scriptOperations].some(manager=>manager?.starting)) {
          if(Date.now()>=deadline)throw Error('SHUTDOWN_DRAIN_TIMEOUT');
          await new Promise(resolve=>setTimeout(resolve,Math.min(25,Math.max(1,deadline-Date.now()))));
        }
      });
      await stopExecutors();
      await stop('execution_drain',()=>Promise.allSettled([scriptOperations?.completion,batchManager?.completion,buildManager?.settle(),runManager?.settle()]));
      await stop('auth_close',()=>authSessions?.close());
      await stop('requirements_model_close',()=>requirementsModel?.close());
      await stop('server_close',()=>serverClosed);
      state.closed = state.shutdown_errors.length === 0;
      state.shutdown_incomplete = !state.closed;
      return {closed:state.closed,errors:state.shutdown_errors};
    })();
    return pending;
  };
}
