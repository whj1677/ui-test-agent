const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
export const SERVICE_RESTART_TIMEOUT_MS = 90_000;

async function boundedRequest(request, timeoutMs) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      const error = new Error('服务请求超时');
      error.code = 'SERVICE_REQUEST_TIMEOUT';
      reject(error);
    }, Math.max(1, timeoutMs));
  });
  try { return await Promise.race([Promise.resolve().then(() => request(controller.signal)), timeout]); }
  finally { clearTimeout(timer); }
}

function isRestartedHealth(next, previous, modelActivation=false) {
  const identity = next?.service_identity;
  return Boolean(identity?.service_instance_id
    && identity.service_instance_id !== previous.service_instance_id
    && identity.data_root_sha256 === previous.data_root_sha256
    && (modelActivation ? next.case_assistant?.available===true : identity.configuration_sha256 === previous.configuration_sha256)
    && next.accepting === true && next.status === 'ready');
}

export function canRestart(serviceHealth, restartInProgress = false) {
  return !restartInProgress && serviceHealth?.restart?.managed === true && serviceHealth?.restart?.available === true;
}

export async function restartAndWait({ previous, postRestart, getHealth, modelActivation=false, timeoutMs = SERVICE_RESTART_TIMEOUT_MS, requestTimeoutMs = 3000, intervalMs = 1000, now = Date.now, sleep = delay }) {
  const deadline = now() + timeoutMs;
  try {
    await boundedRequest(signal => postRestart(previous.service_instance_id, signal), Math.min(requestTimeoutMs, deadline - now()));
  } catch (error) {
    // A timed out POST may already have been accepted. Never submit it again;
    // health polling can still establish whether the new instance came up.
    const outcomeUnknown = error.code === 'SERVICE_REQUEST_TIMEOUT' || error.code === 'WORKBENCH_UNREACHABLE' || error.status === 0;
    if (!outcomeUnknown) throw error;
  }
  while (now() < deadline) {
    await sleep(Math.min(intervalMs, deadline - now()));
    const remaining = deadline - now();
    if (remaining <= 0) break;
    try {
      const next = await boundedRequest(signal => getHealth(signal), Math.min(requestTimeoutMs, remaining));
      if (isRestartedHealth(next, previous, modelActivation)) return next;
    } catch { /* transient outage or a bounded health request timeout */ }
  }
  const error = new Error('重启后未在 60 秒内确认新实例及原数据配置恢复接收请求。');
  error.code = 'SERVICE_RESTART_UNCONFIRMED';
  throw error;
}
