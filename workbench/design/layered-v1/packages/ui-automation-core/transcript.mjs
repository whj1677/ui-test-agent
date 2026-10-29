/**
 * 会话对话视图构建器（只读）
 *
 * 目的：让工作台能显示"编排方传了什么输入、原生 agent 回了什么、调用了哪些工具、产出了什么证据"。
 *
 * 边界（硬约束，不允许放宽）：
 *   - 只读：绝不创建/收养会话，绝不触发模型调用；
 *   - 白名单：只渲染下面 EVENT_MAP 里列出的事件类型，其余事件只统计数量、不渲染内容；
 *   - 不显示原始思考块（reasoning/thinking），只显示对外可见的消息与工具摘要；
 *   - 一律经 redact() 脱敏后再输出。
 */
import {readMultiFrameZstd, parseJsonLines} from './zstd-frames.mjs';

/** 只渲染这些事件；其余类型只进 counts。 */
const EVENT_MAP = {
  'user/message': 'user',
  'assistant/message': 'assistant',
  'tool/call': 'tool_call',
  'tool/result': 'tool_result',
  'turn/start': 'turn_start',
  'turn/end': 'turn_end',
};

/** 这些类型明确**不渲染**，仅计数（原始思考、内部状态等）。 */
const NEVER_RENDER = [/reasoning/i, /thinking/i, /system/i, /llm\//i, /approval/i, /inbox/i, /token/i, /context/i];

export function redact(text) {
  return String(text ?? '')
    .replace(/\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|password|authorization|cookie|set-cookie)\b["']?\s*[:=]\s*[^\s"',;}]+/gi, '[凭据已隐藏]')
    // 只匹配真实密钥形状（sk- 后接较长的高熵串），避免误伤 sk-specific 这类英文词
    .replace(/\bsk-(?=[A-Za-z0-9_-]{20,}\b)[A-Za-z0-9_-]{20,}\b/g, '[凭据已隐藏]')
    .replace(/\bBearer\s+[A-Za-z0-9._-]{20,}/gi, 'Bearer [凭据已隐藏]');
}

/**
 * 取"可展示文本"。
 * 实测约束：assistant/message 的 data 是 {turn, step, message:{role, content:[{type:'reasoning'|'text'|'tool-call'}, …]}}。
 * reasoning 块**必须丢弃**（工作台边界：不展示原始思考）；只含思考的 step 返回空串，
 * 上层按空串过滤，不得退化成 JSON 原文——那会把思考内容间接漏出去。
 */
function textOf(data) {
  if (typeof data === 'string') return data;
  const content = data?.message?.content ?? data?.content;
  if (Array.isArray(content)) {
    const texts = content
      .filter((part) => {
        if (!part) return false;
        if (typeof part === 'string') return true;
        return !/reasoning|thinking/i.test(String(part.type ?? ''));
      })
      .map((part) => (typeof part === 'string' ? part : String(part.text ?? '')))
      .filter((text) => text.length > 0);
    if (texts.length) return texts.join('\n');
    // 有 content 结构但没有任何可展示文本（例如只有 reasoning）：明确返回空串
    if (content.length) return '';
  }
  if (typeof data?.text === 'string') return data.text;
  if (typeof data?.message?.content === 'string') return data.message.content;
  return null;
}

/** 实测：错误标记在 data.message.isError；无 message 时看 data.error。 */
function clamp(text, limit = 4000) {
  const value = String(text ?? '');
  return value.length > limit ? `${value.slice(0, limit)}\n…[已截断，原文 ${value.length} 字符]` : value;
}

function errorFlag(data) {
  return data?.is_error === true || data?.isError === true || data?.message?.isError === true || Boolean(data?.error);
}

function toolName(data) {
  return data?.name ?? data?.tool ?? data?.message?.toolName ?? null;
}

/** tool/result 只带 callId，不含工具名；用前面的 tool/call 建表回填。 */
function callIdOf(data) {
  return data?.callId ?? data?.message?.toolCallId ?? data?.message?.source?.callId ?? null;
}

function normalize(event, index, callNames) {
  const inner = event?.event ?? event;
  const type = inner?.type ?? 'UNKNOWN';
  const data = inner?.data ?? {};
  const role = EVENT_MAP[type] ?? null;
  const entry = {
    seq: Number.isInteger(inner?.seq) ? inner.seq : index,
    type,
    role,
    at: inner?.time ?? inner?.at ?? null,
  };
  if (role === 'user' || role === 'assistant') {
    entry.text = clamp(redact(textOf(data) ?? JSON.stringify(data)), 8000);
  } else if (role === 'tool_call') {
    entry.tool = toolName(data);
    entry.call_id = callIdOf(data);
    entry.arguments_preview = clamp(redact(typeof data?.arguments === 'string' ? data.arguments : JSON.stringify(data?.input ?? data?.arguments ?? {})), 1200);
  } else if (role === 'tool_result') {
    entry.call_id = callIdOf(data);
    entry.tool = toolName(data) ?? callNames.get(entry.call_id) ?? null;
    entry.is_error = errorFlag(data);
    entry.result_preview = clamp(redact(textOf(data) ?? JSON.stringify(data?.result ?? data ?? {})), 1200);
  }
  return entry;
}

/**
 * 从会话日志文件构建只读对话视图。
 * @returns {{
 *   session_id: string|null, cwd: string|null, created_at: number|null,
 *   turns: Array<object>, counts: Record<string, number>, skipped: number,
 *   integrity: {frames:number, framesDecoded:number, truncated:boolean, reason:string|null, malformed:number}
 * }}
 */
export function buildTranscript(file) {
  const read = readMultiFrameZstd(file);
  const {records, malformed} = parseJsonLines(read.text);

  const header = records.find((record) => (record?.type ?? record?.event?.type) === 'session');
  const counts = {};
  const turns = [];
  let skipped = 0;
  let empty = 0;

  // 先建 callId -> 工具名 映射，供 tool/result 回填（result 本身不含工具名）
  const callNames = new Map();
  for (const record of records) {
    const inner = record?.event ?? record;
    if (inner?.type === 'tool/call' && inner?.data?.callId) callNames.set(inner.data.callId, inner.data.name ?? null);
  }

  for (const [index, record] of records.entries()) {
    const inner = record?.event ?? record;
    const type = inner?.type ?? 'UNKNOWN';
    counts[type] = (counts[type] || 0) + 1;
    if (!(type in EVENT_MAP)) {
      skipped += 1;
      if (NEVER_RENDER.some((pattern) => pattern.test(type))) continue;
      continue;
    }
    const entry = normalize(record, index, callNames);
    // 只含思考、没有任何可展示文本的 assistant 条目直接丢弃，避免出现空行
    if ((entry.role === 'assistant' || entry.role === 'user') && !entry.text) {
      empty += 1;
      continue;
    }
    turns.push(entry);
  }

  return {
    session_id: header?.id ?? null,
    cwd: header?.cwd ?? null,
    created_at: header?.createdAt ?? null,
    turns,
    counts,
    skipped,
    empty_entries: empty,
    integrity: {
      frames: read.frames,
      framesDecoded: read.framesDecoded,
      truncated: read.truncated,
      reason: read.reason,
      malformed,
    },
  };
}
