// The supervisor is the only process allowed to arrange a replacement child.
export function createServiceRestart({ processRef = process, serviceState, serviceIdentity, managers = {}, inFlightMutations = () => 0, onDrain, timeoutMs = 3000 }) {
  let managed = false;
  let ready = false;
  let hello = false;
  let modelActivation = false;
  let pending = null;
  let drainPromise;
  const drainOnce = () => drainPromise ||= Promise.resolve().then(onDrain);
  const waiters = new Map();
  const send = (message, onError = () => {}) => {
    try { processRef.send(message, error => { if (error) onError(error); }); }
    catch (error) { onError(error); }
  };
  processRef.on?.('message', message => {
    if (message?.type === 'supervisor-hello' && typeof processRef.send === 'function' && !managed) {
      hello = true;
      modelActivation = message.model_activation === true;
      acknowledge();
    }
    if (message?.type === 'restart-ack' && waiters.has(message.request_id)) {
      waiters.get(message.request_id)(message.accepted === true ? 'accepted' : 'denied');
      waiters.delete(message.request_id);
    }
  });
  processRef.on?.('disconnect', () => {
    if (!managed) return;
    managed = false;
    serviceState.accepting = false;
    void drainOnce();
  });
  function acknowledge() {
    if (!hello || !ready || managed) return;
    managed = true;
    send({type:'managed-ready',service_instance_id:serviceIdentity.service_instance_id,
      configuration_sha256:serviceIdentity.configuration_sha256,data_root_sha256:serviceIdentity.data_root_sha256}, () => {
      managed = false;serviceState.accepting = false;void drainOnce();
    });
  }
  const busy = () => Object.values(managers).some(manager => manager && (
    manager.active || manager.starting || manager.generationOwner || manager.generationStarting || manager.generationBatchActive || manager.storageFault || manager.shutdownRequested
  ));
  const available = () => managed && serviceState.accepting && !pending && !busy() && inFlightMutations() === 0;
  function inspect(expectedInstanceId) {
    if (!managed || typeof processRef.send !== 'function') return {status:503,error:'SERVICE_RESTART_UNMANAGED'};
    if (expectedInstanceId !== serviceIdentity.service_instance_id) return {status:409,error:'SERVICE_INSTANCE_CHANGED'};
    if (pending || !serviceState.accepting) return {status:409,error:'SERVICE_RESTART_PENDING'};
    if (busy() || inFlightMutations() !== 1) return {status:409,error:'WORKBENCH_BUSY'};
    return null;
  }
  async function request(expectedInstanceId,{mode}={}) {
    const refusal = inspect(expectedInstanceId);
    if (refusal) return refusal;
    if(mode!==undefined&&(mode!=='enable-model'||!modelActivation))return {status:503,error:'MODEL_ACTIVATION_UNAVAILABLE'};
    // No await between the final busy check and closing mutation admission.
    serviceState.accepting = false;
    const requestId=`restart-${serviceIdentity.service_instance_id}`;
    pending = {request_id:requestId};
    const outcome = await new Promise(resolve => {
      const timer = setTimeout(() => settle('timeout'),timeoutMs);
      const settle = value => {clearTimeout(timer);waiters.delete(requestId);resolve(value);};
      waiters.set(requestId, settle);
      send({type:'restart-request',request_id:requestId,service_instance_id:serviceIdentity.service_instance_id,...(mode?{mode}:{})}, () => settle('send-error'));
    });
    if (outcome === 'denied' && managed) {
      pending = null;
      serviceState.accepting = true;
      return {status:503,error:'SERVICE_RESTART_SUPERVISOR_UNAVAILABLE'};
    }
    let begun = false;
    const beginDrain = () => {
      if (begun) return;
      begun = true;
      drainOnce().then(result => {
        if (managed) send({type:'restart-drained',closed:outcome === 'accepted' && result?.closed === true});
        processRef.disconnect?.();
      }).catch(error => {
        if (managed) send({type:'restart-drained',closed:false,error:error?.code || error?.message || 'UNKNOWN'});
        processRef.disconnect?.();
      });
    };
    if (outcome !== 'accepted') return {status:503,error:'SERVICE_RESTART_SUPERVISOR_UNAVAILABLE',beginDrain};
    return {status:202,value:{status:'restart_scheduled',service_instance_id:serviceIdentity.service_instance_id},beginDrain};
  }
  return {request,isManaged:()=>managed,canActivateModel:()=>managed&&modelActivation,available,markReady:()=>{
    ready=true;
    if (typeof processRef.send === 'function') send({type:'supervisor-awaiting'}, () => {
      serviceState.accepting=false;void drainOnce();
    });
    acknowledge();
  }};
}
