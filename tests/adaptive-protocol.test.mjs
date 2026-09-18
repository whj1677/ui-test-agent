import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adaptiveProtocolInput,
  compileAdaptiveReply,
  ADAPTIVE_REFERENCE_PROMPT,
} from '../src/adaptive-protocol.mjs';
import { createAdaptivePlan, validateAdaptiveFragment } from '../src/adaptive-plan.mjs';
import { semanticHash } from '../src/common.mjs';

const base = 'http://127.0.0.1:4888/';
const role = (role, name) => ({ kind: 'role', role, name, exact: true });
const clone = (value) => structuredClone(value);
const code = (expected) => (error) => error.code === expected;
const fragment = (actions = [], assertions = [], complete = false) => ({
  actions,
  assertions,
  complete,
  within_ms: 5000,
  reason: '当前原步骤短段。',
});
function fixture() {
  const original = {
    case_id: 'LAB-V01',
    data: { id: 'D009', frequency: 50 },
    steps: [
      {
        step_id: 'S1',
        action: '打开 /assets，输入 D009 查询，查看 D009 详情。',
        expected: '设备编号为D009；频率为50',
        obligations: [
          { id: 'S1-O1', text: '设备编号为D009' },
          { id: 'S1-O2', text: '频率为50' },
        ],
      },
      {
        step_id: 'S2',
        action: '关闭详情',
        expected: '详情已关闭',
        obligations: [{ id: 'S2-O1', text: '详情已关闭' }],
      },
    ],
  };
  const contract = createAdaptivePlan(original, '/');
  return {
    original,
    contract,
    step: contract.steps[0],
    previous: [],
    current: {
      url: base,
      text: '资产设备 D009 50',
      controls: [
        { role: 'button', name: '查询', enabled: true, locator: role('button', '查询') },
        {
          role: 'textbox',
          name: '设备编号',
          locator: { kind: 'label', value: '设备编号', exact: true },
        },
        { role: 'heading', name: 'D009', locator: role('heading', 'D009') },
        { role: 'textbox', name: '频率', locator: { kind: 'label', value: '频率', exact: true } },
      ],
    },
  };
}
function refAssertion(input, index = 2, source = 'S1-O1') {
  return {
    target_ref: adaptiveProtocolInput(input).targets[index].ref,
    check: 'text',
    expected: 'D009',
    source_refs: [source],
  };
}
function strict(reply, input) {
  const compiled = compileAdaptiveReply(reply, input);
  return validateAdaptiveFragment(compiled, {
    c: input.original,
    plan: input.contract,
    step: input.step,
    previous: input.previous,
    base,
  });
}

test('directory binds refs to current observed facts, exposes only current original sources and preserves input', () => {
  const input = fixture(),
    before = clone(input),
    view = adaptiveProtocolInput(input);
  assert.equal(
    view.observation_hash,
    semanticHash({
      url: input.current.url,
      controls: input.current.controls,
      text: input.current.text,
    }),
  );
  assert.deepEqual(view.sources, [
    { ref: 'S1-O1', text: '设备编号为D009' },
    { ref: 'S1-O2', text: '频率为50' },
  ]);
  assert.equal(view.targets[0].role, 'button');
  assert.equal(view.targets[0].name, '查询');
  assert.equal(view.targets[0].enabled, true);
  assert.ok(view.targets.every((target) => target.ref.includes(view.observation_hash)));
  assert.deepEqual(
    view.targets.map((target) => target.locator),
    input.current.controls.map((control) => control.locator),
  );
  assert.deepEqual(adaptiveProtocolInput(input), view);
  view.current.controls[0].name = '伪造';
  view.targets[0].locator.name = '伪造';
  view.sources[0].text = '伪造';
  assert.deepEqual(input, before);
});

test('V01 kind:button response is invalid, whereas a ref compiles the exact observed role locator', () => {
  const input = fixture(),
    view = adaptiveProtocolInput(input);
  const oldBad = fragment([
    { action_id: 'old-A1', op: 'click', target: { kind: 'button', name: '查询', exact: true } },
  ]);
  assert.throws(() => strict(oldBad, input), code('INVALID_LOCATOR'));
  const reply = fragment([{ op: 'click', target_ref: view.targets[0].ref }]);
  const compiled = strict(reply, input);
  assert.deepEqual(compiled.actions[0].target, input.current.controls[0].locator);
  assert.match(compiled.actions[0].action_id, /^ad-S1-[a-f0-9]{12}-s1-a1$/);
  assert.equal('target_ref' in compiled.actions[0], false);
});

test('V02 action quote is never silently fixed in legacy mode; source refs generate expectation-only quote', () => {
  const input = fixture();
  const old = {
    target: role('heading', 'D009'),
    check: 'text',
    expected: 'D009',
    oracle_quote: input.original.steps[0].action,
    obligation_ids: ['S1-O1'],
  };
  assert.throws(() => strict(fragment([], [old]), input), code('ASSERTION_ORACLE_QUOTE_REQUIRED'));
  const reply = fragment([], [refAssertion(input)]),
    before = clone(reply);
  const compiled = strict(reply, input);
  assert.equal(compiled.assertions[0].oracle_quote, input.original.steps[0].expected);
  assert.notEqual(compiled.assertions[0].oracle_quote, input.original.steps[0].action);
  assert.notEqual(compiled.assertions[0].oracle_quote, input.current.text);
  assert.deepEqual(compiled.assertions[0].obligation_ids, ['S1-O1']);
  assert.deepEqual(reply, before);
});

test('action IDs depend on step and successful segment count, not rejected proposals or observed DOM', () => {
  const input = fixture(),
    proposal = fragment([{ op: 'navigate', value: '/assets' }]);
  const first = compileAdaptiveReply(proposal, input).actions[0].action_id;
  input.failures = [{ error: 'INVALID_LOCATOR' }];
  input.current.text = '新观察';
  assert.equal(compileAdaptiveReply(proposal, input).actions[0].action_id, first);
  input.previous = [
    fragment(
      [],
      [
        {
          target: role('heading', 'D009'),
          check: 'text',
          expected: 'D009',
          oracle_quote: '设备编号为D009',
          obligation_ids: ['S1-O1'],
        },
      ],
    ),
  ];
  const second = compileAdaptiveReply(proposal, input).actions[0].action_id;
  assert.notEqual(second, first);
  assert.match(second, /-s2-a1$/);
  input.step = input.contract.steps[1];
  input.previous = [];
  assert.notEqual(compileAdaptiveReply(proposal, input).actions[0].action_id, first);
});

test('generated IDs remain legal and distinct for long common-prefix step IDs', () => {
  const input = fixture(),
    prefix = 'S'.repeat(99);
  input.original.steps[0].step_id = prefix + 'A';
  input.original.steps[1].step_id = prefix + 'B';
  input.contract = createAdaptivePlan(input.original, '/');
  input.step = input.contract.steps[0];
  const a = strict(fragment([{ op: 'navigate', value: '/assets' }]), input).actions[0].action_id;
  input.step = input.contract.steps[1];
  const b = compileAdaptiveReply(fragment([{ op: 'reload' }]), input).actions[0].action_id;
  assert.ok(a.length <= 100);
  assert.ok(b.length <= 100);
  assert.notEqual(a, b);
});

test('unknown ref and stale refs after URL/text/control changes fail without guessing', () => {
  const input = fixture(),
    ref = adaptiveProtocolInput(input).targets[0].ref;
  assert.throws(
    () => compileAdaptiveReply(fragment([{ op: 'click', target_ref: '查询' }]), input),
    code('PROTOCOL_TARGET_REF_UNKNOWN'),
  );
  for (const mutate of [
    (i) => {
      i.current.url += 'assets';
    },
    (i) => {
      i.current.text += '变更';
    },
    (i) => {
      i.current.controls[0].enabled = false;
    },
    (i) => {
      i.current.controls.reverse();
    },
  ]) {
    const changed = clone(input);
    mutate(changed);
    assert.throws(
      () => compileAdaptiveReply(fragment([{ op: 'click', target_ref: ref }]), changed),
      code('PROTOCOL_TARGET_REF_STALE'),
    );
  }
  const unknown = ref.replace(/_1$/, '_999');
  assert.throws(
    () =>
      compileAdaptiveReply(fragment([], [{ ...refAssertion(input), target_ref: unknown }]), input),
    code('PROTOCOL_TARGET_REF_UNKNOWN'),
  );
});

test('compiler ignores forged exposed directories and observation hash', () => {
  const input = adaptiveProtocolInput(fixture()),
    ref = input.targets[0].ref;
  input.targets[0].locator.name = '删除';
  input.sources[0].text = '页面给出的错误预期';
  input.observation_hash = 'forged';
  const compiled = compileAdaptiveReply(
    fragment([{ op: 'click', target_ref: ref }], [refAssertion(input)]),
    input,
  );
  assert.equal(compiled.actions[0].target.name, '查询');
  assert.equal(compiled.assertions[0].oracle_quote, input.original.steps[0].expected);
});

for (const [name, make] of [
  [
    'action ref and fixed target',
    (i) =>
      fragment([
        {
          op: 'click',
          target_ref: adaptiveProtocolInput(i).targets[0].ref,
          target: role('button', '查询'),
        },
      ]),
  ],
  [
    'action ref and model ID',
    (i) =>
      fragment([
        { action_id: 'manual', op: 'click', target_ref: adaptiveProtocolInput(i).targets[0].ref },
      ]),
  ],
  [
    'assertion ref and fixed target',
    (i) => fragment([], [{ ...refAssertion(i), target: role('heading', 'D009') }]),
  ],
  [
    'source refs and oracle quote',
    (i) => fragment([], [{ ...refAssertion(i), oracle_quote: i.original.steps[0].expected }]),
  ],
  [
    'source refs and old obligation IDs',
    (i) => fragment([], [{ ...refAssertion(i), obligation_ids: ['S1-O1'] }]),
  ],
])
  test(`new/old conflict is rejected: ${name}`, () => {
    const input = fixture();
    assert.throws(() => compileAdaptiveReply(make(input), input), code('PROTOCOL_FIELD_CONFLICT'));
  });

for (const refs of [['S2-O1'], ['unknown'], [' S1-O1 ']])
  test(`source reference cannot escape current original step: ${JSON.stringify(refs)}`, () => {
    const input = fixture();
    assert.throws(
      () =>
        compileAdaptiveReply(fragment([], [{ ...refAssertion(input), source_refs: refs }]), input),
      code('PROTOCOL_SOURCE_REF_UNKNOWN'),
    );
  });

for (const refs of [[], ['S1-O1', 'S1-O1'], 'S1-O1', [1], [null]])
  test(`source_refs shape rejected: ${JSON.stringify(refs)}`, () => {
    const input = fixture();
    assert.throws(
      () =>
        compileAdaptiveReply(fragment([], [{ ...refAssertion(input), source_refs: refs }]), input),
      code('PROTOCOL_SOURCE_REFS_INVALID'),
    );
  });

for (const [name, mutate] of [
  [
    'extra top-level field',
    (r) => {
      r.plan = {};
    },
  ],
  [
    'absent actions',
    (r) => {
      delete r.actions;
    },
  ],
  [
    'actions object',
    (r) => {
      r.actions = {};
    },
  ],
  [
    'two actions',
    (r) => {
      r.actions = [{ op: 'reload' }, { op: 'reload' }];
    },
  ],
  [
    'assertions not array',
    (r) => {
      r.assertions = null;
    },
  ],
  [
    'too many assertions',
    (r) => {
      r.assertions = Array(21).fill({});
    },
  ],
  [
    'nonboolean complete',
    (r) => {
      r.complete = 'true';
    },
  ],
  [
    'short timeout',
    (r) => {
      r.within_ms = 99;
    },
  ],
  [
    'fractional timeout',
    (r) => {
      r.within_ms = 101.5;
    },
  ],
  [
    'empty reason',
    (r) => {
      r.reason = '';
    },
  ],
  [
    'action kind instead of op',
    (r) => {
      r.actions = [{ kind: 'click' }];
    },
  ],
  [
    'target absent for click',
    (r) => {
      r.actions = [{ op: 'click' }];
    },
  ],
  [
    'assertion check type',
    (r) => {
      r.assertions = [{ check: 2 }];
    },
  ],
])
  test(`illegal transport shape rejected: ${name}`, () => {
    const reply = fragment([{ op: 'reload' }]);
    mutate(reply);
    assert.throws(
      () => compileAdaptiveReply(reply, fixture()),
      (error) => {
        assert.equal(error.code, 'PROTOCOL_SCHEMA_INVALID');
        assert.ok(error.plan_feedback.field_path.startsWith('reply'));
        return true;
      },
    );
  });

test('blocked is preserved verbatim for the executor, never converted to success or sanitized into valid shape', () => {
  const blocked = { blocked: true, reason: '缺少当前对象证据' };
  assert.equal(compileAdaptiveReply(blocked, fixture()), blocked);
  const malformedBlocked = { ...blocked, complete: true };
  assert.equal(compileAdaptiveReply(malformedBlocked, fixture()), malformedBlocked);
  assert.throws(() => strict(blocked, fixture()), code('INVALID_SCHEMA'));
});

test('legacy fixed fragment preserves IDs, quote, values, order and optional expected omission', () => {
  const input = fixture(),
    reply = fragment(
      [{ action_id: 'legacy-7', op: 'click', target: role('button', '查询') }],
      [
        {
          target: role('heading', 'D009'),
          check: 'visible',
          oracle_quote: '设备编号为D009',
          obligation_ids: ['S1-O1'],
        },
      ],
    );
  const compiled = strict(reply, input);
  assert.equal(
    compileAdaptiveReply(reply, {}),
    reply,
    'legacy transport must return the original object without requiring a directory',
  );
  assert.deepEqual(compiled, reply);
  assert.notEqual(compiled, reply);
  assert.equal('expected' in compiled.assertions[0], false);
});

test('prototype and built-in property names never resolve as target references', () => {
  const input = fixture();
  for (const target_ref of ['__proto__', 'constructor', 'prototype', 'toString'])
    assert.throws(
      () => compileAdaptiveReply(fragment([{ op: 'click', target_ref }]), input),
      code('PROTOCOL_TARGET_REF_UNKNOWN'),
    );
  const inherited = Object.create({ target_ref: adaptiveProtocolInput(input).targets[0].ref });
  inherited.op = 'click';
  assert.throws(
    () => compileAdaptiveReply(fragment([inherited]), input),
    code('PROTOCOL_SCHEMA_INVALID'),
  );
  const inheritedTarget = Object.create({ target: role('button', '查询') });
  inheritedTarget.op = 'click';
  inheritedTarget.action_id = 'legacy';
  assert.throws(
    () => compileAdaptiveReply(fragment([inheritedTarget]), input),
    code('PROTOCOL_SCHEMA_INVALID'),
  );
  const polluted = JSON.parse('{"op":"click","__proto__":{"target_ref":"invented"}}');
  assert.throws(
    () => compileAdaptiveReply(fragment([polluted]), input),
    code('PROTOCOL_SCHEMA_INVALID'),
  );
  const inheritedStop = Object.create({ blocked: true });
  assert.throws(() => compileAdaptiveReply(inheritedStop, input), code('PROTOCOL_SCHEMA_INVALID'));
});

test('unknown new or legacy fields are rejected rather than silently stripped', () => {
  const input = fixture();
  const replies = [
    fragment([
      { op: 'click', target_ref: adaptiveProtocolInput(input).targets[0].ref, force: true },
    ]),
    fragment([{ action_id: 'old', op: 'click', target: role('button', '查询'), force: true }]),
    fragment([], [{ ...refAssertion(input), tolerance: 100 }]),
    fragment(
      [],
      [
        {
          target: role('heading', 'D009'),
          check: 'visible',
          oracle_quote: '设备编号为D009',
          obligation_ids: ['S1-O1'],
          optional: true,
        },
      ],
    ),
  ];
  for (const reply of replies)
    assert.throws(() => compileAdaptiveReply(reply, input), code('PROTOCOL_SCHEMA_INVALID'));
});

test('compiler preserves optional expected JSON verbatim, including falsy and matrix values', () => {
  const input = fixture();
  const values = [
    0,
    false,
    '',
    ['D009'],
    {
      key_column: '编号',
      rows: [{ key: 'D009', cells: [{ column: '频率', check: 'number', expected: 50 }] }],
      ordered: false,
      exact_rows: false,
    },
  ];
  for (const expected of values) {
    const assertion = { ...refAssertion(input), expected };
    const reply = fragment([], [assertion]);
    assert.deepEqual(compileAdaptiveReply(reply, input).assertions[0].expected, expected);
    assert.deepEqual(reply.assertions[0].expected, expected);
  }
});

test('non-JSON replies and malformed observed locators produce protocol-prefixed errors', () => {
  const input = fixture(),
    reply = fragment([{ op: 'reload' }]);
  reply.reason = undefined;
  assert.throws(() => compileAdaptiveReply(reply, input), code('PROTOCOL_SCHEMA_INVALID'));
  input.current.controls[0].locator = { kind: 'button', name: '查询' };
  assert.throws(() => adaptiveProtocolInput(input), code('PROTOCOL_INPUT_INVALID'));
  assert.throws(
    () => compileAdaptiveReply(fragment([{ op: 'navigate', value: '/assets' }]), input),
    code('PROTOCOL_INPUT_INVALID'),
  );
});

test('explicit /assets navigation needs no DOM link; action-only and fixed table/scope escapes retain strict gates', () => {
  const input = fixture();
  input.current.controls = [];
  assert.deepEqual(adaptiveProtocolInput(input).targets, []);
  assert.equal(
    strict(fragment([{ op: 'navigate', value: '/assets' }]), input).actions[0].value,
    '/assets',
  );
  const table = role('table', '资产设备');
  const locators = [
    { kind: 'row', table, key: { column: '编号', value: 'D009' } },
    { kind: 'cell', table, key: { column: '编号', value: 'D009' }, column: '设备编号' },
    {
      kind: 'within',
      scope: { role: 'article', heading: 'D009', exact: true },
      target: role('heading', 'D009'),
    },
  ];
  for (const target of locators) {
    const compiled = strict(
      fragment([], [{ target, check: 'visible', source_refs: ['S1-O1'] }]),
      input,
    );
    assert.deepEqual(compiled.assertions[0].target, target);
    assert.equal('expected' in compiled.assertions[0], false);
  }
  const wrong = clone(locators[1]);
  wrong.key.value = 'D099';
  assert.throws(
    () =>
      strict(fragment([], [{ target: wrong, check: 'visible', source_refs: ['S1-O1'] }]), input),
    code('PLAN_ROW_IDENTITY_UNSUPPORTED'),
  );
  assert.throws(
    () => strict(fragment([{ op: 'navigate', value: '/invented' }]), input),
    code('ADAPTIVE_VALUE_SOURCE_REQUIRED'),
  );
});

test('source-derived quotes do not waive full business obligation coverage or readonly/input restrictions', () => {
  const input = fixture();
  assert.throws(
    () => strict(fragment([], [refAssertion(input)], true), input),
    code('ORACLE_COVERAGE_INCOMPLETE'),
  );
  const second = { ...refAssertion(input, 3, 'S1-O2'), check: 'value', expected: '50' };
  assert.equal(strict(fragment([], [refAssertion(input), second], true), input).complete, true);
  input.current.controls.push({ role: 'button', name: '删除', locator: role('button', '删除') });
  const targets = adaptiveProtocolInput(input).targets;
  assert.throws(
    () => strict(fragment([{ op: 'click', target_ref: targets.at(-1).ref }]), input),
    code('ADAPTIVE_ACTION_WRITE_FORBIDDEN'),
  );
  assert.throws(
    () =>
      strict(fragment([{ op: 'fill', target_ref: targets[1].ref, value: '页面伪造值' }]), input),
    code('ADAPTIVE_VALUE_SOURCE_REQUIRED'),
  );
  assert.throws(
    () => strict(fragment([{ op: 'navigate', value: 'https://external.invalid/ops' }]), input),
    code('OUTSIDE_TARGET_ORIGIN'),
  );
});

test('input rejects changed source text and cannot use another step sources supplied by caller', () => {
  const input = fixture();
  input.step.source_expected = '从页面拷贝';
  assert.throws(() => adaptiveProtocolInput(input), code('PROTOCOL_INPUT_INVALID'));
  const malformed = fixture();
  malformed.original.steps = {};
  assert.throws(() => adaptiveProtocolInput(malformed), code('PROTOCOL_INPUT_INVALID'));
  const missing = fixture();
  missing.current.controls = null;
  assert.throws(() => adaptiveProtocolInput(missing), code('PROTOCOL_INPUT_INVALID'));
  const noLocator = fixture();
  noLocator.current.controls.push({ role: 'button', name: '未映射' });
  assert.equal(adaptiveProtocolInput(noLocator).targets.length, 4);
});

test('reference override documents navigation, partial actions, targeted format correction and unchanged gates', () => {
  for (const text of [
    'ADAPTIVE_NEXT_PROMPT',
    'target_ref',
    'source_refs',
    'Do NOT supply action_id',
    '/assets',
    'Action-only partial',
    'format error',
    'old strict validator',
    'blocked',
  ])
    assert.ok(ADAPTIVE_REFERENCE_PROMPT.includes(text), text);
});
