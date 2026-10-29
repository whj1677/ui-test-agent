import { DeepSeek } from '../../src/deepseek.mjs';
import { isNetworkErrorCode } from '../../src/model-transport.mjs';
import { createModelCredentialProvider } from './model-credentials.mjs';

const REQUEST_PROFILE = Object.freeze({
  thinking: Object.freeze({ type: 'enabled' }),
  reasoning_effort: 'high',
  max_output_tokens: 32768,
  timeout_ms: 180000,
  max_attempts: 1,
});
const PARTITION_PROFILE = Object.freeze({ ...REQUEST_PROFILE, reasoning_effort: 'low' });
// Script review needs a complete bounded verdict; repeated high-effort reviews
// exhausted the output ceiling before returning usable JSON in real runs.
// Keep the same validation rules, output ceiling, deadline and attempt limit.
const UI_REVIEW_PROFILE = Object.freeze({ ...REQUEST_PROFILE, reasoning_effort: 'low' });
const profileFor = (input, purpose) => purpose === 'ui-candidate-quality-review' ? UI_REVIEW_PROFILE
  : input?.generation_partition ? PARTITION_PROFILE : REQUEST_PROFILE;

// Reuse the configured provider and saved credential in memory only. The
// requirements manager owns per-request consent, admission and durable usage.
export async function createRequirementsModel({ disabled, configuration, dshHome, useStoredCredentials, credentialProvider, clientFactory = options => new DeepSeek(options) }) {
  if (disabled || !configuration || configuration.provider !== 'deepseek-official') return null;
  const credentials = await (credentialProvider || createModelCredentialProvider({ dshHome, useStoredCredentials }))();
  if (!credentials?.apiKey) return null;
  const client = clientFactory({ key: credentials.apiKey, baseURL: credentials.baseUrl, model: configuration.model, timeout: REQUEST_PROFILE.timeout_ms });
  return {
    model: configuration.model,
    credential_source: credentials.source,
    requestProfile: REQUEST_PROFILE,
    profileFor,
    supportsImages: configuration.model === 'deepseek-flash',
    async generate({ input, signal, purpose }) {
      const { system_prompt, image_parts = [], ...payload } = input;
      const profile = profileFor(input, purpose);
      let diagnostic = null;
      try {
        const result = await client.json(system_prompt, payload, { signal, images: image_parts,
          maxAttempts: profile.max_attempts, maxOutputTokens: profile.max_output_tokens,
          reasoningEffort: profile.reasoning_effort, onTrace(event) {
          if (event.type === 'MODEL_TRANSPORT_FINISHED' && ['DEEPSEEK_CONNECTION_FAILED', 'DEEPSEEK_TRANSPORT_ERROR'].includes(event.error_code)) {
            diagnostic = {
              error_code: event.error_code,
              ...(isNetworkErrorCode(event.network_error_code) ? { network_error_code: event.network_error_code } : {}),
              ...(event.transport_error_kind === 'TYPE_ERROR' || event.transport_error_kind === 'OTHER'
                ? { transport_error_kind: event.transport_error_kind } : {}),
            };
          } else if (event.type === 'MODEL_RESPONSE_REJECTED') diagnostic = {
            error_code: event.error_code, finish_reason: event.finish_reason ?? null,
            response_model: event.response_model ?? null, usage: event.usage ?? null,
            // DeepSeek scrubs credentials before delivering trace events. Preserve
            // only the bounded rejected answer so a failed paid call is diagnosable.
            response_text: typeof event.response_text === 'string' ? event.response_text.slice(0, 12000) : null,
          };
        } });
        return { ...result.value, model: result.usage.response_model, usage: result.usage };
      } catch (error) {
        if (diagnostic) error.requirement_diagnostic = diagnostic;
        throw error;
      }
    },
    close: () => client.close(),
  };
}
