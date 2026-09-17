import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, fail, escapeHTML as h, safeId } from './common.mjs';
import { effectiveCase } from './store.mjs';
import { renderReport } from './report-view.mjs';
import { loadReportSupplement } from './report-supplement.mjs';
export const labels = {
  NEEDS_REVIEW: '待审查确认',
  NEEDS_MAPPING: '待生成计划',
  BLOCKED_MAPPING: '页面或计划待补充',
  BLOCKED_BUDGET: '本批预算待续跑',
  PLAN_REVIEW: '待确认计划',
  READY: '可执行',
  RUNNING: '执行中',
  NOT_EXECUTED: '尚未执行',
  PASS_ASSERTIONS: '已核对断言满足',
  FAIL_ASSERTION: '断言不一致',
  AUTH_REQUIRED: '等待恢复登录',
  SESSION_UNVERIFIED: '登录状态未核实',
  BLOCKED_DATA: '前置条件不满足',
  BLOCKED_WRITE: '写入未授权',
  STOPPED: '已停止',
  TECHNICAL_FAILED: '自动化执行失败',
  CLEANUP_REQUIRED: '清理待处理',
  INTERRUPTED: '执行中断',
  EVIDENCE_INCOMPLETE: '执行事实未验证',
};

async function verifiedMedia(store, id, runId, media) {
  const file = media.file;
  if (typeof file !== 'string' || path.basename(file) !== file || file === '.' || file === '..')
    fail('MEDIA_NOT_FOUND', 404);
  const bytes = await fs.readFile(path.join(store.dir(id), 'runs', safeId(runId), file));
  if (hash(bytes) !== media.sha256) fail('MEDIA_CHANGED', 409);
  return bytes;
}
export async function mediaBytes(store, id, runId, file) {
  const state = await store.read(id),
    receipt = state.cases.flatMap((c) => c.attempts ?? []).find((a) => a.id === runId);
  if (!receipt) fail('MEDIA_NOT_FOUND', 404);
  const fact = await store.facts(id, receipt),
    media = (fact.media ?? []).find((m) => m.file === file);
  if (!media) fail('MEDIA_NOT_FOUND', 404);
  return verifiedMedia(store, id, runId, media);
}
export async function report(store, id, { allScopes = false } = {}) {
  const state = await store.read(id),
    baseline = await store.baseline(id),
    projection = await store.executionProjection(id, state, { allScopes });
  let embedded = 0;
  const rows = [],
    issues = [...projection.issues];
  const supplement = await loadReportSupplement(store, id, state, baseline);
  for (const c of projection.cases) {
    const record = state.cases.find((x) => x.case_id === c.case_id),
      original = baseline.cases.find((x) => x.case_id === c.case_id),
      effective =
        c.latest?.executed_case ?? effectiveCase(original, record ?? { confirmations: [] });
    const attempts = [];
    for (const a of c.attempts) {
      if (!a.fact) {
        attempts.push(a);
        continue;
      }
      const fact = a.fact;
      let media = '';
      for (const m of [...(fact.media ?? [])].sort(
        (a, b) => (b.type === 'video') - (a.type === 'video'),
      )) {
        try {
          const bytes = await verifiedMedia(store, id, a.receipt.id, m);
          if (embedded + bytes.length > 150 * 1024 * 1024) fail('REPORT_MEDIA_LIMIT');
          embedded += bytes.length;
          const data = bytes.toString('base64');
          media +=
            m.type === 'video'
              ? `<figure class="recording"><figcaption>Agent 执行录像 <button type="button" data-play-video>播放录像</button><span class="playback-message" role="status"></span></figcaption><video controls preload="metadata" src="data:video/webm;base64,${data}"></video></figure>`
              : `<figure><figcaption>${h(m.step_id ?? '失败现场')}${m.checkpoint_id ? ' / 检查点 ' + h(m.checkpoint_id) : ''} · 截图</figcaption><img loading="lazy" alt="${h(m.step_id ?? '失败现场')}" src="data:image/png;base64,${data}"></figure>`;
        } catch (e) {
          const issue = {
            code: e.code ?? 'MEDIA_UNREADABLE',
            case_id: c.case_id,
            attempt_id: a.receipt.id,
            file: m.file,
          };
          issues.push(issue);
          c.evidence_status = 'PARTIAL';
          media += `<p class="warning">媒体证据不可用：${h(m.file)}（${h(issue.code)}）</p>`;
        }
      }
      if (fact.media_warning) {
        issues.push({
          code: 'MEDIA_WARNING',
          case_id: c.case_id,
          attempt_id: a.receipt.id,
          detail: fact.media_warning,
        });
        c.evidence_status = 'PARTIAL';
      }
      attempts.push({ ...a, media });
    }
    rows.push({
      c,
      record,
      original,
      effective,
      attempts,
      review: supplement?.cases.find((r) => r.case_id === c.case_id),
    });
  }
  const uniqueIssues = [...new Map(issues.map((i) => [JSON.stringify(i), i])).values()];
  const manifest = {
    schema_version: 'ui-agent-report/v2',
    generated_at: new Date().toISOString(),
    task_id: id,
    baseline_sha256: state.baseline_sha256,
    scope_source: projection.scope_source,
    scope_valid: projection.scope_valid,
    scope: projection.scope,
    delivery_status: uniqueIssues.length ? 'PARTIAL' : 'COMPLETE',
    counts: {
      ...projection.counts,
      evidence_incomplete: projection.cases.filter((c) => c.evidence_status === 'PARTIAL').length,
    },
    cases: projection.cases.map((c) => ({
      case_id: c.case_id,
      status: c.status,
      business_status: c.business_status,
      cleanup_status: c.cleanup_status,
      evidence_status: c.evidence_status,
    })),
    issues: uniqueIssues,
  };
  const count = manifest.counts,
    scopeText =
      projection.scope_source === 'ALL_TASK_SCOPES'
        ? '本报告汇总该任务全部已校验批次，按原 Case ID 去重，以完整原始基线为分母；每份执行事实仍核对其所属冻结批次。'
        : projection.scope_source === 'LEGACY_BASELINE'
          ? '历史数据没有冻结批次范围；本报告以完整原始基线为分母。'
          : projection.scope_valid
            ? `本轮范围已冻结，批次 ${projection.scope.id}；统计只包含该批次的选中用例及绑定事实。`
            : '本轮范围证据未验证；以下原始基线仅供查看，不能作为可信本轮执行分母。';
  if (supplement) {
    manifest.supplemental_review = { ...supplement.summary, source_sha256: supplement.sha256 };
    state.report_context = `本报告统一展示 Agent 执行结果、录像和浏览器补充复核。Agent 已执行 ${count.attempted}/${count.total} 条。补充复核 ${supplement.summary.total} 条：${supplement.summary.pass} 条满足原预期、${supplement.summary.fail} 条发现不一致；补充复核不增加 Agent 已执行数量。`;
  }
  return renderReport({ state, baseline, projection, manifest, rows, scopeText, labels });
}
