import { randomUUID } from 'node:crypto';

export const JSON_RECOVERY_LIMIT = 2;
const TOOL_JSON_ERROR = 'DeepSeek Messages stream: tool input is invalid JSON';

export function isToolJsonFailure(failure) {
  return failure?.code === 'MALFORMED_RESPONSE' && failure.message === TOOL_JSON_ERROR;
}

const writeStatus = event => process.stdout.write(`${JSON.stringify(event)}\n`);

// Recovery belongs to the failed request, so successful tool calls and the outer
// process's deadline, tool limit and cancellation signal remain in force.
export function applyJsonRecovery(ctx, { emit = writeStatus } = {}) {
  const attempts = new WeakMap();
  return ctx.on('agent/request-error', (payload, next) => {
    const { agent, turn, provider, failure, signal } = payload;
    if (signal.aborted) return undefined;
    if (provider !== 'deepseek-official' || !isToolJsonFailure(failure)) return next();
    const previous = attempts.get(agent);
    const used = previous?.turn === turn ? previous.count : 0;
    if (used >= JSON_RECOVERY_LIMIT) return next();
    const retry = used + 1;
    const summary = `工具参数 JSON 格式有误，正在重新生成（${retry}/${JSON_RECOVERY_LIMIT}）`;
    const notice = {
      id: `message-${randomUUID()}`,
      role: 'user',
      source: { kind: 'plugin', plugin: 'workbench-case-assistant-guard', form: 'notice', summary },
      content: [{ type: 'text', text: `${summary}。这是工作台的格式纠错通知，不是新的业务需求。`
        + '刚才这次模型请求中的工具参数不是有效 JSON，工具尚未执行；此前已暂存的用例保持不变。'
        + '请只重新生成失败请求的工具参数，保持用例编号、业务含义、操作步骤和预期不变，不要重写已成功暂存的用例。'
        + '使用 stage_cases 时每次只提交 1 条完整详细用例。正确转义 JSON 字符串内的引号和反斜杠，控件名称可用中文「」。'
        + '不要截断步骤、删减业务内容或猜测补齐资料；需要补充的内容继续明确标记。' }],
    };
    // DSH user-role context carries explicit plugin provenance. The append is
    // durable and reaches this same step's retry; agent.inject waits a new step.
    agent.session.append('user/message', notice, { surfaceOp: 'append' });
    attempts.set(agent, { turn, count: retry });
    if (signal.aborted) return undefined;
    emit({ type: 'status', phase: 'case_assistant_json_retry', retry, max_retries: JSON_RECOVERY_LIMIT });
    return signal.aborted ? undefined : { kind: 'retry' };
  });
}
