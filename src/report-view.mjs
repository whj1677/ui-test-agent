import { escapeHTML as h } from './common.mjs';
import { readFileSync } from 'node:fs';
import { renderSupplement } from './report-supplement.mjs';
import { stepOutcome, renderEvidenceSteps } from '../public/evidence-view.js';

const cleanupLabels = {
  CLEAN: '已清理',
  NOT_REQUIRED: '无需清理',
  CLEANUP_REQUIRED: '待清理',
  FAILED: '清理失败',
};
const evidenceLabels = {
  VERIFIED: '证据完整',
  COMPLETE: '证据完整',
  PARTIAL: '证据不完整',
  NOT_EXECUTED: '无执行证据',
};
const checks = {
  observation: '页面观测',
  visible: '可见',
  unobstructed: '目标当前五点命中无阻挡',
  hidden: '隐藏',
  text: '文本等于',
  contains: '文本包含',
  value: '输入值',
  count: '元素数量',
  row_count: '数据行数',
  focused: '焦点状态',
  has_class: '样式类包含',
  row_sequence: '数据行顺序',
  table_cells: '表格逐字段核对（同一次采样）',
  table_unchanged: '表格与本步骤操作前完整快照一致',
  enabled: '可操作状态',
  selected_label: '选中选项',
  url: '页面地址',
};
const ops = {
  goto: '打开页面',
  click: '点击',
  dismiss_optional: '提示出现时关闭',
  fill: '填写',
  select: '选择',
  check: '勾选',
  uncheck: '取消勾选',
  press: '按键',
  wait: '等待',
  reload: '刷新页面',
};
const value = (v) =>
  v === null || v === undefined
    ? '—'
    : typeof v === 'boolean'
      ? v
        ? '是'
        : '否'
      : typeof v === 'object'
        ? JSON.stringify(v)
        : String(v);
const time = (v) => (v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '—');
const target = (t) =>
  t?.kind === 'case_named'
    ? `审批时尚未观察 · 原步骤 ${t.source_step_id}：${target(t.target)} · ${t.control_type} · ${t.guard?.path} / ${t.guard?.page_heading} / ${t.guard?.step}`
    : ['row', 'cell'].includes(t?.kind)
      ? `${target(t.table)} · ${t.key?.column}=${t.key?.value} · ${t.kind === 'cell' ? t.column : t.target ? target(t.target) : '整行'}`
      : t?.kind === 'within'
        ? `${t.scope?.role} · ${t.scope?.name ?? t.scope?.heading} · ${t.target ? target(t.target) : '整个范围'}`
        : (t?.name ?? t?.value ?? t?.role ?? '当前页面');
const duration = (f) =>
  f?.started_at && f?.finished_at
    ? `${Math.max(0, (Date.parse(f.finished_at) - Date.parse(f.started_at)) / 1000).toFixed(1)} 秒`
    : '—';
const tone = (c) =>
  c.evidence_status === 'PARTIAL' || c.cleanup_status === 'CLEANUP_REQUIRED'
    ? 'warn'
    : c.status === 'PASS_ASSERTIONS'
      ? 'good'
      : c.status === 'FAIL_ASSERTION'
        ? 'bad'
        : 'warn';
const reasonLabels = {
  STEP_DEADLINE_EXCEEDED: '本步骤总预算已耗尽，后续业务操作未执行。',
  CLEANUP_OWNERSHIP_UNVERIFIED: '无法核实待清理数据的归属，未派发清理写操作。',
  INVALID_SCHEMA: '模型返回的计划结构不符合执行协议，未执行。',
  ORACLE_COVERAGE_INCOMPLETE: '计划遗漏了原用例的部分预期，未执行。',
  DISCOVERY_LOOP_DETECTED: '页面探索重复相同操作，已停止。',
  DISCOVERY_LOOP_LIMIT: '页面探索达到次数上限，尚未生成可执行计划。',
};
const blockReason = (r) =>
  reasonLabels[r?.mapping_reason] ||
  r?.mapping_reason ||
  r?.issues
    ?.map((i) => i.reason ?? i.message ?? i.code)
    .filter(Boolean)
    .join('；') ||
  '尚无已验证执行结果，请先处理用例或计划准备状态。';

const repairLabels = {
  INVALID: '计划格式未采纳',
  BLOCKED: '计划受阻',
  AUDIT_REJECTED: '计划语义核验未满足',
  ACCEPTED: '候选计划已通过自检，仍需核对',
  ACCEPT: '本次语义核验未发现问题，仍需核对',
  REPAIR: '计划需要修复',
  NEEDS_CLARIFICATION: '需要澄清用例',
  EXHAUSTED: '已达修复上限，需处理',
  RUNNING: '正在修复',
  STOPPED: '已停止',
  INTERRUPTED: '已中断',
};
function preparationHistory(record) {
  const repair = record?.self_repair,
    input = record?.input_review,
    audit = record?.plan_audit,
    legacy =
      record?.plan && !repair
        ? '<p class="reason">历史/预置计划：未经过新增自动核验，仍需按原流程核对</p>'
        : '';
  if (!repair && !input && !audit) return legacy;
  const issueText = (i) =>
      typeof i === 'string'
        ? i
        : [i.step_id, i.message ?? i.reason ?? i.code].filter(Boolean).join(' · '),
    rounds = repair?.rounds ?? [];
  return `${legacy}<details class="preparation-history"><summary>输入审查与计划自修复 · 已修复 ${h(repair?.repair_count ?? 0)} / ${h(repair?.max_repairs ?? 2)} 次</summary><p>以下是计划准备记录，不计入已执行数量或断言满足数量。候选计划仍需核对后执行；执行结果以本用例的实际观测为准。</p>${input ? `<h4>输入审查</h4><p>${input.issues?.length ? input.issues.map((i) => h(issueText(i))).join('<br>') : '本次未发现输入问题。'}</p>` : ''}${repair ? `<p><strong>本次结果：</strong>${h(repairLabels[repair.outcome] ?? repair.outcome ?? '处理中')}</p><ol>${rounds.map((r, i) => `<li><strong>${r.round === 0 ? '首次计划' : '第 ' + h(r.round ?? i) + ' 次修复'} · ${h(repairLabels[r.status] ?? r.status)}</strong><p>${h(r.reason ?? r.code ?? '未记录补充原因')}</p><small>${h(time(r.at))}</small><details><summary>查看计划版本变化</summary><p>前一计划：${h(rounds[i - 1]?.plan_hash ?? '无')}<br>本次计划：${h(r.plan_hash ?? '未生成有效计划')}</p>${r.code ? `<p>原因代码：${h(r.code)}</p>` : ''}</details></li>`).join('') || '<li>尚无计划尝试记录。</li>'}</ol>` : ''}${audit ? `<h4>最近一次计划语义核验</h4><p>${h(repairLabels[audit.outcome] ?? audit.outcome)}${audit.issues?.length ? ' · ' + audit.issues.map((i) => h(issueText(i))).join('；') : ''}</p><details><summary>查看核验依据</summary><pre>${h(JSON.stringify({ plan_hash: audit.plan_hash, input_hash: audit.input_hash, checks: audit.checks, at: audit.at }, null, 2))}</pre></details>` : ''}</details>`;
}

function adaptiveStepIncomplete(fact, stepId) {
  return stepOutcome(fact, stepId).missingCompletion;
}

function checkpointFacts(fact, stepId) {
  const points = (fact?.checkpoints ?? []).filter((point) => point.step_id === stepId);
  const conditions = (fact?.actions ?? []).filter(
    (a) => a.step_id === stepId && a.operation === 'dismiss_optional',
  );
  const missingCompletion = adaptiveStepIncomplete(fact, stepId);
  const stopCode = missingCompletion
    ? ((fact.adaptive_segments ?? []).findLast(
        (segment) => segment.step_id === stepId && segment.error,
      )?.error ?? fact.error)
    : null;
  const completionText = missingCompletion
    ? `<p class="warn">步骤未完成：${h(reasonLabels[stopCode] ?? stopCode ?? '尚无本步骤的 COMPLETE 完成记录。')} 已匹配字段仅保留为局部观测，不代表原步骤全部预期满足。</p>`
    : '';
  const conditionText =
    completionText +
    conditions
      .map(
        (a) =>
          `<p class="muted">条件提示：${h(a.status === 'SKIPPED_NOT_PRESENT' ? '本次未出现，未派发点击；仍继续验证原预期' : a.status === 'EXECUTED' ? '本次出现，已点击关闭' : '条件关闭未完成')} · ${h(target(a.target))}</p>`,
      )
      .join('');
  if (!points.length) return conditionText;
  const labels = {
    NOT_EXECUTED: '未执行',
    RUNNING: '未完成',
    ASSERTIONS_PASSED: '本点断言满足',
    FAIL_ASSERTION: '本点断言不一致',
    TECHNICAL_FAILED: '本点执行未完成',
  };
  return `${conditionText}<p class="muted">分段观察，各点发生于不同时间。</p><ol>${points.map((point) => `<li><strong>检查点 ${h(point.checkpoint_id)} · ${h(labels[point.status] ?? point.status)}</strong>${point.observed_at ? `<small> · 观察于 ${h(time(point.observed_at))}</small>` : ''}${point.url ? `<p>${h(point.url)}</p>` : ''}${point.error ? `<p>${h(point.error)}</p>` : ''}</li>`).join('')}</ol>`;
}

function tableDifferences(observation) {
  const comparison = observation.table_comparison;
  if (!['table_cells', 'table_unchanged'].includes(observation.check) || !comparison) return '';
  return `<p>本次采样已比对 ${h(comparison.checked_cells)} 个字段；${h(comparison.differences.length)} 项差异。</p>${comparison.differences.length ? `<details><summary>查看具体记录与字段差异</summary><ul>${comparison.differences.map((d) => `<li>${h(d.key ?? '表格')} / ${h(d.column ?? '结构')}：期望 ${h(value(d.expected))}，实际 ${h(value(d.actual))}（${h(d.reason)}）</li>`).join('')}</ul></details>` : ''}`;
}

function stepRows(effective, fact) {
  return effective.steps
    .map((s) => {
      const observed = [
        ...(fact?.assertions ?? []),
        ...(fact?.relational_observations ?? []).map((a) => ({
          ...a,
          oracle_quote: '动作后关系检查：' + (a.oracle_quote ?? '表格与操作前保持一致'),
        })),
      ].filter((a) => a.step_id === s.step_id);
      const status = {
        PASS: '断言满足',
        FAIL: '断言不一致',
        INCOMPLETE: '未完成断言',
        NOT_EXECUTED: '未执行',
      }[stepOutcome(fact, s.step_id).status];
      return `<tr><td class="step-id">${h(s.step_id)}</td><td class="prose">${h(s.action)}</td><td class="prose">${h(s.expected ?? '未填写')}</td><td>${checkpointFacts(fact, s.step_id)}${observed.length ? observed.map((a) => `<div class="observation ${a.passed ? 'good' : 'bad'}"><span>${a.passed ? '✓' : '×'} ${h(a.oracle_quote ?? checks[a.check] ?? a.check)}</span>${tableDifferences(a)}<strong>实际：${h(value(a.actual))}</strong><small>${a.checkpoint_id ? '检查点 ' + h(a.checkpoint_id) + ' · ' : ''}${h(checks[a.check] ?? a.check)}${a.expected !== null && a.expected !== undefined ? ' · 期望 ' + h(value(a.expected)) : ''} · ${h(target(a.target))}</small></div>`).join('') : `<span class="muted">${fact ? '未收录该步骤的断言观测' : '尚未执行，无实际结果'}</span>`}</td><td><span class="pill ${status === '断言满足' ? 'good' : status === '断言不一致' ? 'bad' : 'warn'}">${status}</span></td></tr>`;
    })
    .join('');
}

function renderCase({ c, record, original, effective, attempts, review }, labels) {
  const fact = c.latest,
    kind = tone(c),
    group = kind === 'good' ? 'passed' : 'attention';
  const reason =
    reasonLabels[fact?.error] ??
    fact?.error ??
    (!fact
      ? review?.reviewer_note || blockReason(record)
      : c.evidence_status === 'PARTIAL'
        ? '执行观测已保留，部分证据需补齐。'
        : c.cleanup_status === 'CLEANUP_REQUIRED'
          ? '执行结束，测试数据仍需清理。'
          : '');
  const latestMedia = attempts.find((a) => a.receipt.id === fact?.id)?.media ?? '';
  const observations = fact?.assertions ?? [],
    ok = observations.filter((a) => a.passed).length;
  const actualSummary = fact
    ? observations.length
      ? `${ok}/${observations.length} 项值匹配${observations.some((a) => a.group_passed === false) ? ' · 整组未满足' : ''}${fact.checkpoints?.some((point) => point.status !== 'ASSERTIONS_PASSED') ? ' · 存在未完成检查点' : ''} · ${duration(fact)}`
      : `尚无业务断言观测 · ${duration(fact)}`
    : '未执行 · ' + (record?.mapping_reason ? '计划准备受阻' : '等待准备或计划核对');
  return `<article class="case" data-video="${attempts.some((a) => a.media?.includes('<video'))}" data-status="${h(c.status)}" data-group="${group}" data-priority="${h(original.priority ?? '未标注')}"><details class="case-detail"><summary class="case-row"><span class="case-key"><span class="chevron">›</span><span>${h(c.case_id)}</span></span><h2>${h(original.title)}</h2><span class="priority">${h(original.priority ?? '—')}</span><span class="pill ${kind}">${h(labels[c.status] ?? c.status)}</span><span class="row-actual">${h(actualSummary)}</span><span class="row-evidence">${h(cleanupLabels[c.cleanup_status] ?? c.cleanup_status)}<small>${h(evidenceLabels[c.evidence_status] ?? c.evidence_status)}${attempts.some((a) => a.media?.includes('<video')) ? ' · ▶ 有录像' : ''}</small>${review ? `<small class="${review.passed ? 'good' : 'bad'}">补充复核：${review.passed ? '预期满足' : '发现不一致'}</small>` : ''}</span></summary><div class="case-body">${reason ? `<div class="reason"><strong>${fact ? '需关注' : '未执行原因'}</strong><p>${h(reason)}</p></div>` : ''}${c.issues.length ? `<p class="warning">证据检查：${h(c.issues.map((i) => i.code).join('；'))}</p>` : ''}<div class="case-meta"><div><span>前置条件</span><p>${h(effective.preconditions ?? original.preconditions ?? '未填写')}</p></div><div><span>执行时间</span><p>${fact ? h(time(fact.started_at)) : '尚未执行'}</p></div><div><span>测试数据</span><p>${h(cleanupLabels[c.cleanup_status] ?? c.cleanup_status)}</p></div></div><h3>步骤与结果对照</h3><div class="table-scroll"><table class="steps"><thead><tr><th>步骤</th><th>操作步骤</th><th>${fact?.executed_case ? '执行时已确认预期' : '当前确认预期'}</th><th>实际结果</th><th>步骤结果</th></tr></thead><tbody>${stepRows(effective, fact)}</tbody></table></div>${fact ? `<details class="evidence" open><summary>Agent 执行录像与截图 <span class="muted">${fact.media?.length ?? 0} 个文件 · ${h(evidenceLabels[c.evidence_status] ?? c.evidence_status)}</span></summary><h3>本次用例结果：${h(labels[fact.status] ?? fact.status)}</h3><div class="execution-review"><div class="media-grid execution-media">${latestMedia || '<p>本次没有可用媒体，步骤结果仍可查看。</p>'}</div>${renderEvidenceSteps(fact, effective)}</div></details>` : '<p class="muted">本用例没有 Agent 执行录像或实际结果。</p>'}${fact?.cleanup_actions?.length ? `<details><summary>查看清理过程 · ${h(cleanupLabels[fact.cleanup_status] ?? fact.cleanup_status)}</summary><ol>${fact.cleanup_actions.map((a) => `<li>${h(ops[a.operation] ?? a.operation)} ${h(target(a.target))} · ${h(a.status)}</li>`).join('')}</ol></details>` : ''}${renderSupplement(review)}${preparationHistory(record)}<details class="technical"><summary>原始用例、计划与诊断记录</summary><h4>原始用例（保留输入）</h4>${original.steps.map((s) => `<p>原步骤：${h(s.action)}</p><p>原预期：${h(s.expected ?? '缺失')}</p>`).join('')}<h4>原始测试数据</h4><pre>${h(JSON.stringify({ data: original.data, test_data: original.test_data }, null, 2))}</pre><h4>补充确认记录</h4><pre>${h(JSON.stringify(record?.confirmations ?? [], null, 2))}</pre><h4>执行计划</h4><pre>${h(JSON.stringify(fact?.executed_plan ?? record?.plan ?? null, null, 2))}</pre>${attempts.map((a) => `<details><summary>执行记录 ${h(a.receipt.id.slice(0, 8))} · ${h(a.fact ? (labels[a.fact.status] ?? a.fact.status) : '事实未验证')}</summary>${a.fact ? `<p>开始 ${h(time(a.fact.started_at))} · 结束 ${h(time(a.fact.finished_at))} · SHA-256 ${h(a.receipt.sha256)}</p>${a.fact.id !== fact?.id ? a.media : ''}<pre>${h(JSON.stringify(a.fact, null, 2))}</pre>` : `<p class="warning">${h(a.issue.code)}；该记录不参与断言满足计数。</p>`}</details>`).join('')}</details></div></details></article>`;
}

// Preserve the recording aspect ratio instead of shrinking 900px source text
// into a 500px-high player. Screenshot thumbnails retain their existing limit.
const recordingStyles =
  'figure.recording video{max-height:none}' +
  readFileSync(new URL('../public/evidence.css', import.meta.url), 'utf8');

export function renderReport({ state, baseline, projection, manifest, rows, scopeText, labels }) {
  const n = manifest.counts,
    unexecuted = Math.max(0, n.total - n.attempted),
    rate = projection.scope_valid && n.total ? Math.round((n.attempted / n.total) * 100) : 0;
  const attention = rows.filter((r) => tone(r.c) !== 'good').length;
  const countsText = `原用例 ${baseline.cases.length} · ${projection.scope_valid ? '报告范围 ' + n.total : '本轮分母未验证'} · 产生执行记录 ${n.attempted} · 断言满足 ${n.pass} · 断言不一致 ${n.fail} · 自动化失败 ${n.technical_failed} · 证据不完整 ${n.evidence_incomplete}`;
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${h(state.name)} · UI 测试报告</title><style>${styles}${recordingStyles}</style></head><body><div class="topbar"><strong>UI TEST AGENT <span>/ 测试执行报告</span></strong><button id="print">打印报告</button></div><main><header><div class="eyebrow">测试结果 · ${h(time(manifest.generated_at))}</div><h1>${h(state.name)}</h1><p class="subtitle">${h(state.report_execution_label ?? (state.fixture ? '本机合成站点 · 预制计划验证 · 不代表真实 DeepSeek 或产品验收' : '根据已核对计划的实际执行记录生成'))} · <span class="target">${h(state.target)}</span></p>${state.report_context ? `<p class="reason">${h(state.report_context)}</p>` : ''}<div class="metrics"><div><span>报告用例</span><strong>${projection.scope_valid ? n.total : '—'}</strong><small>原始基线 ${baseline.cases.length} 条</small></div><div><span>已产生尝试记录</span><strong>${n.attempted}<em> / ${n.total}</em></strong><small>尝试覆盖率 ${projection.scope_valid ? rate + '%' : '未验证'}</small></div><div class="good"><span>断言满足</span><strong>${n.pass}</strong><small>已核对断言的执行结果</small></div><div class="bad"><span>断言不一致</span><strong>${n.fail}</strong><small>自动化失败另计 ${n.technical_failed} 条</small></div><div class="warn"><span>尚无尝试记录</span><strong>${unexecuted}</strong><small>不计作产品缺陷</small></div></div><div class="coverage"><div style="width:${rate}%"></div></div><div class="brief"><strong>${unexecuted ? '本轮尚未全部执行' : '本轮执行记录已汇总'}</strong><span>需关注 ${attention} 条 · 待清理 ${n.cleanup_required} 条 · 证据不完整 ${n.evidence_incomplete} 条</span></div></header><section class="workspace"><div class="toolbar"><div class="tabs" role="group" aria-label="快速筛选"><button data-filter="all" class="active" aria-pressed="true">全部 ${n.total}</button><button data-filter="attention" aria-pressed="false">需关注 ${attention}</button><button data-filter="passed" aria-pressed="false">断言满足且证据完整 ${rows.length - attention}</button><button data-filter="video" aria-pressed="false">查看录像 ${rows.filter((r) => r.attempts.some((a) => a.media?.includes('<video'))).length}</button></div><div class="filters"><input id="query" aria-label="查找用例" placeholder="查找编号、标题或步骤"><select id="status" aria-label="结果状态"><option value="">全部状态</option>${[...new Set(rows.map((r) => r.c.status))].map((s) => `<option value="${h(s)}">${h(labels[s] ?? s)}</option>`).join('')}</select><select id="priority" aria-label="优先级"><option value="">全部优先级</option>${[...new Set(rows.map((r) => r.original.priority ?? '未标注'))].map((p) => `<option value="${h(p)}">${h(p)}</option>`).join('')}</select></div></div><div class="list-actions"><span id="visible-count" aria-live="polite">显示 ${n.total} 条</span><div><button id="expand">展开当前用例</button><button id="collapse">收起全部</button><button id="reset">重置筛选</button></div></div><div class="list-head"><span>用例编号</span><span>用例标题</span><span>优先级</span><span>执行结果</span><span>实际概况</span><span>清理 / 证据</span></div>${[
    ...rows,
  ]
    .sort((a, b) => (tone(a.c) === 'good') - (tone(b.c) === 'good'))
    .map((r) => renderCase(r, labels))
    .join(
      '',
    )}<p id="empty" hidden>没有匹配的用例，请调整筛选条件。</p></section><footer><p>“断言满足”表示已核对断言的实际观测满足，不等同于完整产品验收。准备受阻、自动化失败、清理和证据问题分别记录。</p><details><summary>统计口径与报告完整性</summary><p>${h(countsText)}</p><p>${h(scopeText)}</p><p>报告文件完整性：${manifest.delivery_status}（仅表示报告材料组装状态）。媒体缺失不抹去已验证观测；事实未验证不计为断言满足。</p><p>用例基线 SHA-256：${h(state.baseline_sha256)}</p><pre id="report-manifest">${h(JSON.stringify(manifest, null, 2))}</pre></details><details><summary>任务活动日志（供排障）</summary><pre>${h(JSON.stringify(state.events, null, 2))}</pre></details></footer></main><script>${script}</script></body></html>`;
}

const script = `let group='all';const articles=[...document.querySelectorAll('article.case')];function filter(){const q=document.querySelector('#query').value.trim().toLowerCase(),s=document.querySelector('#status').value,p=document.querySelector('#priority').value;let visible=0;for(const a of articles){a.hidden=!((group==='all'||a.dataset.group===group||(group==='video'&&a.dataset.video==='true'))&&(!s||a.dataset.status===s)&&(!p||a.dataset.priority===p)&&a.textContent.toLowerCase().includes(q));if(!a.hidden)visible++;}document.querySelector('#visible-count').textContent='显示 '+visible+' / '+articles.length+' 条';document.querySelector('#empty').hidden=visible!==0;}for(const b of document.querySelectorAll('[data-filter]'))b.onclick=()=>{group=b.dataset.filter;if(group==='video'){for(const q of ['#query','#status','#priority'])document.querySelector(q).value='';for(const a of articles)if(a.dataset.video==='true'){a.querySelector('.case-detail').open=true;for(const e of a.querySelectorAll('details.evidence'))e.open=true;}}for(const x of document.querySelectorAll('[data-filter]')){x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));}filter();if(group==='video')articles.find(a=>!a.hidden)?.querySelector('video')?.scrollIntoView({block:'center'});};document.querySelector('#query').oninput=filter;document.querySelector('#status').onchange=filter;document.querySelector('#priority').onchange=filter;document.querySelector('#expand').onclick=()=>{for(const a of articles)if(!a.hidden)a.querySelector('.case-detail').open=true;};document.querySelector('#collapse').onclick=()=>{for(const a of articles)a.querySelector('.case-detail').open=false;};document.querySelector('#reset').onclick=()=>{for(const q of ['#query','#status','#priority'])document.querySelector(q).value='';document.querySelector('[data-filter="all"]').click();};document.querySelector('#print').onclick=()=>{for(const a of articles)if(!a.hidden)a.querySelector('.case-detail').open=true;window.print();};for(const b of document.querySelectorAll('[data-play-video]'))b.onclick=async()=>{const v=b.closest('figure').querySelector('video');try{if(v.paused){await v.play();b.textContent='暂停录像';}else{v.pause();b.textContent='播放录像';}}catch{b.closest('figure').querySelector('.playback-message').textContent='浏览器未能播放，请下载离线报告后重试。';}v.onended=()=>b.textContent='播放录像';};`;

const styles = `*{box-sizing:border-box}body{margin:0;color:#213047;background:#f3f5f8;font:14px/1.6 "Segoe UI","Microsoft YaHei",sans-serif}button,input,select{font:inherit}button{cursor:pointer;border:1px solid #d9e0e8;background:white;color:#334760;border-radius:7px;padding:7px 12px}button:hover{background:#eef3ff}button:focus-visible,summary:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #8fb7ff;outline-offset:2px}[hidden]{display:none!important}.topbar{background:#172941;color:white;padding:17px 32px;display:flex;justify-content:space-between;align-items:center}.topbar strong{letter-spacing:1px}.topbar span{font-weight:400;color:#c0cfdf;font-size:13px}main{max-width:1560px;margin:28px auto;padding:0 28px}header{background:white;border:1px solid #dfe5ed;padding:28px;border-radius:12px}.eyebrow{font-size:12px;color:#64758b}h1{font-size:26px;margin:8px 0 10px;line-height:1.4}h2{font-size:14px;font-weight:600;margin:0;line-height:1.6}h3{font-size:16px;margin:24px 0 12px}.subtitle{color:#68778b;margin:0}.target{overflow-wrap:anywhere}.metrics{display:grid;grid-template-columns:repeat(5,1fr);gap:16px;margin:26px 0 18px}.metrics>div{padding:16px 20px;background:#f5f7fb;border-radius:8px}.metrics span,.metrics small{display:block;color:#69798e}.metrics strong{font-size:34px;line-height:1.5;display:block;font-weight:650;font-variant-numeric:tabular-nums}.metrics em{font-size:17px;font-style:normal;color:#93a0b3}.metrics .good{background:#eef8f4}.metrics .bad{background:#fff4f3}.metrics .warn{background:#fff8eb}.good{color:#16785b}.bad,.warning{color:#b94444}.warn{color:#966112}.coverage{height:5px;background:#edf0f5;border-radius:8px;overflow:hidden}.coverage>div{height:100%;background:#2c7fcd}.brief{display:flex;justify-content:space-between;gap:10px;margin-top:16px}.brief span{color:#64758b;font-size:13px}.workspace{margin-top:22px;background:white;border:1px solid #dfe5ed;border-radius:12px;overflow:hidden}.toolbar{padding:18px 20px;border-bottom:1px solid #e5eaf1;display:flex;flex-wrap:wrap;justify-content:space-between;gap:15px}.tabs,.filters{display:flex;gap:7px;flex-wrap:wrap}.tabs button{border-color:transparent;background:#f2f5f9}.tabs .active{background:#e9f0ff;color:#245ebe;border-color:#c5d6f6}.filters input,.filters select{padding:8px 10px;border:1px solid #d9e1eb;border-radius:6px;background:white;max-width:100%}.filters input{width:245px}.list-actions{padding:12px 20px;display:flex;justify-content:space-between;align-items:center;color:#738197;font-size:12px}.list-actions button{border:0;padding:4px 8px;font-size:12px}.list-head,.case-row{display:grid;grid-template-columns:145px minmax(210px,1.7fr) 65px 150px minmax(150px,1fr) 125px;gap:14px;align-items:center;padding:15px 20px}.list-head{background:#f5f7fb;font-size:12px;color:#6c7d92}.case{border-top:1px solid #e5eaf1}.case-row{cursor:pointer;list-style:none;min-height:76px}.case-row::-webkit-details-marker{display:none}.case-row:hover{background:#f8faff}.case-key{display:flex;gap:10px;font:12px/1.6 Consolas,monospace;align-items:center;color:#426080}.chevron{font:22px sans-serif;color:#7e94ae}.case-detail[open]>.case-row{background:#edf3fc}.case-detail[open]>.case-row .chevron{transform:rotate(90deg)}.priority{font-size:12px;color:#718299}.pill{display:inline-block;width:fit-content;max-width:100%;padding:3px 9px;border-radius:5px;font-size:12px;font-weight:600;background:#f1f4f8}.pill.good{background:#e9f6ef}.pill.bad{background:#fdeeee}.pill.warn{background:#fff3dd}.row-actual{font-size:12px;color:#62758c}.row-evidence{font-size:12px;color:#4d657b}.row-evidence small{display:block;color:#8592a3}.case-body{padding:6px 24px 24px;border-top:1px solid #e0e7f1}.reason{background:#fff8ec;border:1px solid #f0dfb8;border-left:3px solid #d09b3c;padding:13px 16px;margin:18px 0}.reason p{margin:5px 0 0;white-space:pre-wrap;overflow-wrap:anywhere}.case-meta{display:grid;grid-template-columns:2fr 1fr 1fr;gap:20px;margin-top:18px}.case-meta span{color:#8290a2;font-size:12px}.case-meta p{margin:5px 0;white-space:pre-wrap}.table-scroll{overflow-x:auto}.steps{width:100%;border-collapse:collapse;table-layout:fixed;min-width:780px;font-size:13px}.steps th,.steps td{border:1px solid #e1e7ef;padding:12px;vertical-align:top;text-align:left;overflow-wrap:anywhere}.steps th{background:#f2f5f9;color:#566d87;font-weight:500}.steps th:nth-child(1){width:6%}.steps th:nth-child(2){width:21%}.steps th:nth-child(3){width:28%}.steps th:nth-child(4){width:34%}.steps th:nth-child(5){width:11%}.prose{white-space:pre-wrap}.observation{padding-bottom:10px;margin-bottom:10px;border-bottom:1px solid #eef1f5}.observation:last-child{margin:0;padding:0;border:0}.observation span,.observation strong,.observation small{display:block}.observation span{font-size:12px}.observation strong{font-weight:500;white-space:pre-wrap;color:#25374d}.observation small{color:#8c99a9;font-size:11px}.muted{color:#8290a3}details>summary:not(.case-row){cursor:pointer;padding:13px 0;font-size:13px}details.technical{border-top:1px dashed #dde4ed;margin-top:18px;color:#63778f}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:11px/1.65 Consolas,monospace;background:#f4f6f9;padding:16px;max-height:450px;overflow:auto}.supplement{border-top:2px solid #d9e5f5;margin-top:24px}.media-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:18px}.media-grid figure.recording{grid-column:1/-1;max-width:960px}.recording button{margin-left:12px}.media-grid figure{margin:0;border:1px solid #dfe6ef;background:#f6f8fb;border-radius:7px;overflow:hidden}.media-grid figcaption{padding:9px 12px;font-size:12px;color:#63778f}video,img{display:block;width:100%;height:auto;max-height:500px;object-fit:contain;background:#edf0f5}footer{padding:24px 4px 40px;color:#7e8c9f;font-size:12px}#empty{text-align:center;padding:42px}.technical p{overflow-wrap:anywhere}@media(max-width:1100px){main{padding:0 14px}.list-head,.case-row{grid-template-columns:125px minmax(170px,1fr) 45px 145px;gap:10px}.row-actual,.row-evidence,.list-head span:nth-child(5),.list-head span:nth-child(6){display:none}.metrics{gap:8px}.metrics>div{padding:12px}.metrics strong{font-size:28px}}@media(max-width:700px){.topbar{padding:12px 16px}.topbar span{display:none}main{margin:14px auto}header{padding:18px}h1{font-size:21px}.metrics{grid-template-columns:repeat(2,1fr)}.metrics>div:last-child{grid-column:1/-1}.brief{display:block}.brief span{display:block}.list-head{display:none}.case-row{grid-template-columns:1fr auto;padding:13px 14px}.case-row h2{grid-column:1/-1;grid-row:2}.case-row>.priority{display:none}.case-meta{grid-template-columns:1fr}.case-body{padding:4px 14px 18px}.media-grid{grid-template-columns:1fr}.list-actions{flex-wrap:wrap}}@media print{body{background:white}.topbar,.toolbar,.list-actions,.technical,footer details,.evidence,button{display:none!important}main{max-width:none;padding:0;margin:0}header,.workspace{border:0}.case-body{padding:8px}.steps{min-width:0}.case-row,.list-head{grid-template-columns:110px 1fr 40px 120px}.case-row .row-actual,.case-row .row-evidence,.list-head span:nth-child(5),.list-head span:nth-child(6){display:none}.steps tr{break-inside:avoid}.metrics strong{font-size:24px}article[hidden]{display:none!important}}`;
