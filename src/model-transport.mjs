import { EnvHttpProxyAgent } from 'undici';

// Apply proxy settings only to model requests, never to browser traffic or the console.
export function createModelFetch(proxyOptions) {
  let dispatcher;
  const modelFetch = (url, options) => {
    dispatcher ??= new EnvHttpProxyAgent(proxyOptions);
    return fetch(url, { ...options, dispatcher });
  };
  modelFetch.close = () => dispatcher?.close();
  return modelFetch;
}

const NETWORK_CODES = new Set([
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_SOCKET',
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
  'CERT_HAS_EXPIRED',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'ERR_TLS_CERT_ALTNAME_INVALID',
]);

export function networkErrorCode(error) {
  const code = error?.cause?.code ?? error?.code;
  return NETWORK_CODES.has(code) ? code : null;
}
