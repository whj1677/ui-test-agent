import { randomUUID } from 'node:crypto';
import { redact } from './common.mjs';

// Presentation holds belong outside the action-to-assertion observation window.
export const RECORDING_HOLD_MS = 1800;
const FIELD_PAGE_SIZE = 140;
const OPERATION_LABELS = {
  click: '点击',
  dismiss_optional: '提示出现时关闭',
  fill: '输入',
  select: '选择',
  press: '按键',
  check: '勾选',
  uncheck: '取消勾选',
  hover: '悬停',
  navigate: '跳转',
  reload: '刷新',
  wait: '等待',
};

export function recordingPages(value, size = FIELD_PAGE_SIZE) {
  const characters = Array.from(redact(value).replace(/\s+/gu, ' ').trim() || '未提供');
  const pages = [];
  for (let start = 0; start < characters.length; start += size) {
    pages.push(characters.slice(start, start + size).join(''));
  }
  return pages;
}

export function observationCaption(observations) {
  return observations
    .map((item) => {
      const actual = typeof item.actual === 'string' ? item.actual : JSON.stringify(item.actual);
      const status =
        !item.window_observed && item.window_observed !== undefined
          ? '超出观察窗口'
          : item.passed
            ? '该项匹配'
            : '该项不匹配';
      return `${item.oracle_quote || item.check}：${actual ?? '未取得实际值'}（${status}）`;
    })
    .join('；');
}

// This function runs in the page. Closed shadow content is excluded from
// Playwright text/role locators, body.innerText and the runner's DOM observer.
// No style, attribute, input value or focus is changed on a product element.
function installRecordingDocument({ key, binding, restore = true }) {
  if (window !== window.top || window[key]) return;
  if (!document.documentElement) {
    document.addEventListener(
      'DOMContentLoaded',
      () => installRecordingDocument({ key, binding, restore }),
      { once: true },
    );
    return;
  }
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.inert = true;
  host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none';
  const shadow = host.attachShadow({ mode: 'closed' });
  const layer = document.createElement('div');
  const style = document.createElement('style');
  style.textContent = `
    * { box-sizing: border-box; }
    section { position: fixed; width: 560px; max-width: calc(100vw - 32px);
      padding: 16px 18px; border-radius: 10px;
      color: #fff; background: #12263af5; border: 2px solid #63c7ff;
      font: 20px/1.55 "Microsoft YaHei", sans-serif; white-space: pre-wrap;
      overflow-wrap: anywhere; box-shadow: 0 5px 24px #0005; }
    header { font-size: 17px; color: #91dcff; margin-bottom: 8px; }
    p { margin: 6px 0; }
    .box { position: fixed; border: 3px solid #ffb000; border-radius: 4px; }
    .click { position: fixed; width: 22px; height: 22px; border-radius: 50%;
      border: 3px solid white; background: #ff354fcc; box-shadow: 0 0 0 3px #f33455; }
  `;
  const panel = document.createElement('section');
  const highlight = document.createElement('div');
  highlight.className = 'box';
  const pointer = document.createElement('div');
  pointer.className = 'click';
  layer.append(panel, highlight, pointer);
  shadow.append(style, layer);
  document.documentElement.append(host);
  const state = { cue: null, layer, panel, render: null };
  state.render = (cue) => {
    state.cue = cue;
    // Never display an execution caption over an authentication form.
    layer.style.display =
      !cue || document.querySelector('input[type="password"]') ? 'none' : 'block';
    if (!cue) return;
    panel.replaceChildren();
    const heading = document.createElement('header');
    heading.textContent = `${cue.caseId} · ${cue.title}\n${cue.stepLabel} · ${cue.phase}${cue.pageLabel}`;
    panel.append(heading);
    for (const [label, text] of [
      ['操作', cue.action],
      ['预期', cue.expected],
      ['实际', cue.actual],
    ]) {
      const row = document.createElement('p');
      row.textContent = `${label}：${text}`;
      panel.append(row);
    }
    const samePage = !cue.pathname || cue.pathname === location.pathname;
    const box = samePage ? cue.box : null;
    highlight.style.display = box ? 'block' : 'none';
    if (box)
      Object.assign(highlight.style, {
        left: `${box.x}px`,
        top: `${box.y}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
      });
    pointer.style.display = samePage && cue.click ? 'block' : 'none';
    if (cue.click)
      Object.assign(pointer.style, {
        left: `${cue.click.x - 11}px`,
        top: `${cue.click.y - 11}px`,
      });
    panel.style.width = '560px';
    let rect = panel.getBoundingClientRect();
    if (rect.height > innerHeight * 0.8 - 16) {
      panel.style.width = `${Math.min(840, innerWidth - 32)}px`;
      rect = panel.getBoundingClientRect();
    }
    // Native playback controls cover the bottom of the recorded pixels. Prefer
    // the top; lower alternatives reserve 20% of the source viewport. This is
    // presentation only, not a claim about arbitrary browser control geometry.
    const bottom = innerHeight * 0.8 - rect.height;
    const positions = [
      [innerWidth - rect.width - 16, 16],
      [16, 16],
      [innerWidth - rect.width - 16, bottom],
      [16, bottom],
    ];
    const avoidsTarget = ([x, y]) =>
      !box ||
      x + rect.width < box.x ||
      x > box.x + box.width ||
      y + rect.height < box.y ||
      y > box.y + box.height;
    const fitsViewport = ([x, y]) =>
      x >= 0 && y >= 0 && x + rect.width <= innerWidth && y + rect.height <= innerHeight * 0.8;
    const [x, y] =
      positions.find((position) => fitsViewport(position) && avoidsTarget(position)) ||
      positions.find(fitsViewport) ||
      positions[0];
    panel.style.left = `${Math.max(0, x)}px`;
    panel.style.top = `${Math.max(0, y)}px`;
  };
  window[key] = state;
  document.addEventListener(
    'pointerdown',
    (event) => {
      const cue = state.cue;
      if (!event.isTrusted || !cue?.actionId || !cue.box) return;
      const click = { x: event.clientX, y: event.clientY };
      const target = state.target;
      if (!target || !target.contains(event.target)) return;
      const rect = target.getBoundingClientRect();
      const box = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      state.render({ ...cue, click });
      void window[binding]({
        kind: 'pointer',
        actionId: cue.actionId,
        ...click,
        box,
        trusted: true,
      }).catch(() => {});
    },
    true,
  );
  document.addEventListener(
    'focusin',
    (event) => {
      if (!event.isTrusted || event.target !== state.target || !state.cue?.actionId) return;
      void window[binding]({
        kind: 'focus',
        actionId: state.cue.actionId,
        trusted: true,
        tag: event.target.tagName.toLowerCase(),
      }).catch(() => {});
    },
    true,
  );
  if (restore)
    void window[binding]({ kind: 'restore' })
      .then(state.render)
      .catch(() => {});
}

export class RecordingEvidence {
  constructor(page, testCase, result) {
    this.page = page;
    this.testCase = testCase;
    this.result = result;
    this.startedAt = Date.now();
    this.key = `__recording_${randomUUID().replaceAll('-', '')}`;
    this.binding = `${this.key}_events`;
    this.current = null;
    this.step = null;
    this.fact = result.recording = {
      schema_version: 'ui-agent-recording/v1',
      hold_ms: RECORDING_HOLD_MS,
      visual_review: 'PENDING',
      timeline: [],
      issues: [],
    };
  }

  async safely(operation) {
    try {
      return await operation();
    } catch {
      // A broken caption must not overwrite a business failure or replay a write.
      this.result.evidence_status = 'PARTIAL';
      if (!this.fact.issues.includes('RECORDING_CUE_UNAVAILABLE')) {
        this.fact.issues.push('RECORDING_CUE_UNAVAILABLE');
      }
      return null;
    }
  }

  async install() {
    return this.safely(async () => {
      await this.page.exposeBinding(this.binding, ({ frame }, message) => {
        if (frame !== this.page.mainFrame()) return null;
        if (message.kind === 'restore') return this.current;
        if (
          message.kind === 'focus' &&
          message.trusted &&
          message.actionId === this.current?.actionId
        ) {
          this.fact.timeline.push({
            kind: 'focus',
            action_id: message.actionId,
            at_ms: Date.now() - this.startedAt,
            tag: message.tag,
            trusted_event: true,
          });
          return null;
        }
        if (
          message.kind !== 'pointer' ||
          !message.trusted ||
          message.actionId !== this.current?.actionId ||
          !this.current.box
        )
          return null;
        const { x, y } = message;
        const box = message.box;
        if (!box || ![x, y, box.x, box.y, box.width, box.height].every(Number.isFinite))
          return null;
        const inside =
          x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;
        this.current.click = { x, y };
        this.fact.timeline.push({
          kind: 'pointer',
          action_id: message.actionId,
          at_ms: Date.now() - this.startedAt,
          x,
          y,
          trusted_event: true,
          inside_target: inside,
          target_bbox: box,
        });
        return null;
      });
      await this.page.addInitScript(installRecordingDocument, {
        key: this.key,
        binding: this.binding,
      });
    });
  }

  cue(phase, action, expected, actual, extras = {}) {
    return {
      caseId: redact(this.testCase.case_id),
      title: recordingPages(this.testCase.title, 60)[0],
      stepLabel: this.step
        ? `步骤 ${this.step.index + 1}/${this.testCase.steps.length} · ${this.step.step_id}${this.checkpoint ? ` · 检查点 ${this.checkpoint.index + 1}/${this.checkpoint.total} ${this.checkpoint.checkpoint_id}` : ''}`
        : '执行准备',
      phase,
      action,
      expected,
      actual,
      pageLabel: '',
      ...extras,
    };
  }

  async render(cue) {
    this.current = cue;
    await this.page.evaluate(installRecordingDocument, {
      key: this.key,
      binding: this.binding,
      restore: false,
    });
    return this.page.evaluate(
      ({ key, cue }) => {
        window[key].render(cue);
        const panel = window[key].panel;
        const rect = panel.getBoundingClientRect();
        return {
          visible: window[key].layer.style.display !== 'none',
          fits:
            rect.left >= 0 &&
            rect.top >= 0 &&
            rect.right <= innerWidth &&
            rect.bottom <= innerHeight * 0.8,
        };
      },
      { key: this.key, cue },
    );
  }

  async show(phase, action, expected, actual, extras = {}) {
    return this.safely(async () => {
      const fields = [action, expected, actual, this.testCase.title].map((text) =>
        recordingPages(text),
      );
      const count = Math.max(...fields.map((pages) => pages.length));
      for (let index = 0; index < count; index++) {
        const cue = this.cue(
          phase,
          ...fields.slice(0, 3).map((pages) => pages[index] ?? '（本栏已显示完）'),
          {
            ...extras,
            title: fields[3][index] ?? fields[3][0],
            pageLabel: count > 1 ? ` · 字幕 ${index + 1}/${count}` : '',
          },
        );
        const layout = await this.render(cue);
        const from = Date.now();
        await new Promise((resolve) => setTimeout(resolve, RECORDING_HOLD_MS + 50));
        this.fact.timeline.push({
          kind: 'caption',
          step_id: this.step?.step_id ?? null,
          checkpoint_id: this.checkpoint?.checkpoint_id ?? null,
          phase,
          from_ms: from - this.startedAt,
          to_ms: Date.now() - this.startedAt,
          action: cue.action,
          expected: cue.expected,
          actual: cue.actual,
          title: cue.title,
          page: index + 1,
          pages: count,
          ...layout,
        });
        if (!layout.visible || !layout.fits) {
          this.result.evidence_status = 'PARTIAL';
          this.fact.issues.push('RECORDING_CUE_NOT_READABLE');
        }
      }
    });
  }

  async beginStep(step, index) {
    this.checkpoint = null;
    this.step = { ...step, index };
    return this.show('准备操作', step.source_action, step.source_expected, '尚未执行，尚未判断');
  }

  async beginCheckpoint(point, index, total) {
    this.checkpoint = { checkpoint_id: point.checkpoint_id, index, total };
    const quotes = [...new Set(point.assertions.map((assertion) => assertion.oracle_quote))];
    return this.show(
      '准备分段检查',
      this.step.source_action,
      quotes.join('；'),
      '本检查点尚未执行；各检查点分别观察',
    );
  }

  async beforeAction(action, target) {
    return this.safely(async () => {
      if (target) await target.scrollIntoViewIfNeeded();
      const box = target ? await target.boundingBox() : null;
      const cue = this.cue(
        `${OPERATION_LABELS[action.op] ?? action.op} · ${action.action_id}`,
        recordingPages(this.step?.source_action ?? '执行精确清理')[0],
        recordingPages(this.step?.source_expected ?? '恢复本轮测试数据')[0],
        '操作中，尚未判断',
        { actionId: action.action_id, box },
      );
      cue.pathname = new URL(this.page.url()).pathname;
      await this.render(cue);
      await this.page.evaluate(
        ({ key, target }) => {
          window[key].target = target;
        },
        { key: this.key, target },
      );
      // Keep the actual target visible before dispatch, never between the last
      // completed action and its assertion deadline.
      const from = Date.now();
      await new Promise((resolve) => setTimeout(resolve, RECORDING_HOLD_MS + 50));
      this.fact.timeline.push({
        kind: 'action_target',
        step_id: this.step?.step_id ?? null,
        checkpoint_id: this.checkpoint?.checkpoint_id ?? null,
        action_id: action.action_id,
        operation: action.op,
        target_bbox: box,
        from_ms: from - this.startedAt,
        to_ms: Date.now() - this.startedAt,
      });
    });
  }

  async observed(observations, { cleanup = false } = {}) {
    const passed = observations.every((item) => item.passed && item.group_passed !== false);
    return this.show(
      cleanup ? '清理结果' : passed ? '断言满足' : '断言未满足',
      cleanup ? '精确清理本轮测试数据' : this.step.source_action,
      cleanup ? '已确认的清理断言全部满足' : this.step.source_expected,
      observationCaption(observations),
      {
        box: this.current?.box ?? null,
        click: this.current?.click ?? null,
        pathname: this.current?.pathname,
      },
    );
  }

  async beginCleanup() {
    this.step = null;
    this.checkpoint = null;
    return this.show(
      '数据清理',
      '精确清理本轮测试数据',
      '先核实资源归属，再执行已批准清理',
      '清理尚未完成',
    );
  }

  async failure(code, phase) {
    return this.show(
      '执行停止',
      this.step?.source_action ?? '执行前置检查',
      this.step?.source_expected ?? '具备执行条件',
      `错误：${code}；阶段：${phase}。未完成的预期尚未判断。`,
    );
  }

  async screenshot(options) {
    await this.safely(() =>
      this.page.evaluate((key) => {
        if (window[key]) window[key].layer.style.visibility = 'hidden';
      }, this.key),
    );
    try {
      return await this.page.screenshot(options);
    } finally {
      await this.safely(() =>
        this.page.evaluate((key) => {
          if (window[key]) window[key].layer.style.visibility = '';
        }, this.key),
      );
    }
  }
}
