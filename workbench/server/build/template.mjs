import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { sha256File } from '../integrity.mjs';
import { HOLD_Q1_CASE_ID, HOLD_Q1_ENVIRONMENT_ID, loadHoldQ1Source } from './heldout-query.mjs';

export const BUILD_TEMPLATE_ID = 'synthetic-probe-v1';
export const AUTH01_PROJECT_ENVIRONMENT_ID = 'auth01-local-fixture-v1';

function digest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex').toUpperCase();
}

export async function loadBuildTemplate(paths) {
  const fixtureRoot = path.join(paths.repoRoot, 'harness-probe', 'fixture');
  const normalFixture = path.join(fixtureRoot, 'index.html');
  const negativeFixture = path.join(fixtureRoot, 'wrong-output.html');
  await Promise.all([fs.access(normalFixture), fs.access(negativeFixture)]);
  const frozen = {
    template_id: BUILD_TEMPLATE_ID,
    version: '1.0.0',
    title: '无登录合成探针候选',
    summary: '点击“执行探针交互”，断言可见输出等于任务给定值。',
    action: '点击按钮“执行探针交互”',
    expected: 'PROBE-42',
    candidate_contract: {
      url_environment_variable: 'PROBE_URL',
      test_count: 1,
      retries: 0,
      workers: 1,
    },
    allowed_entry: { kind: 'managed-local-fixture', route: '/probe', login_required: false },
    source: { normal_fixture_sha256: await sha256File(normalFixture) },
  };
  return {
    public: { ...frozen, input_sha256: digest(frozen) },
    internal: {
      normalFixture,
      negativeFixture,
      counterexampleActual: 'PROBE-41',
    },
  };
}

export async function loadProjectCaseEnvironment(paths, environmentId) {
  if (environmentId === 'synthetic-probe-normal-v1') {
    const template = await loadBuildTemplate(paths);
    return {
      environment_id: environmentId,
      public: template.public,
      internal: {
        ...template.internal,
        normalRoute: '/probe',
        negativeRoute: '/probe',
        binding: { kind: 'expected-literal', expected_literal: template.public.expected },
        verification: {
          schema: 'workbench/project-case-verification-contract-v2',
          expected_literal: template.public.expected,
          counterexample_actual: template.internal.counterexampleActual,
          detection: { kind: 'literal-assertion-mismatch', expected: template.public.expected, actual: template.internal.counterexampleActual },
        },
      },
    };
  }
  if (environmentId === HOLD_Q1_ENVIRONMENT_ID) {
    const frozen = await loadHoldQ1Source(paths);
    const publicTemplate = {
      template_id: HOLD_Q1_ENVIRONMENT_ID,
      version: '1.0.0',
      title: 'HOLD-Q1 无登录列表查询',
      summary: '按冻结 HOLD-Q1 的 S01-S03 完成默认态、未查询态和联合查询核对。',
      candidate_contract: { url_environment_variable: 'PROBE_URL', test_count: 1, retries: 0, workers: 1 },
      allowed_entry: { kind: 'managed-local-fixture', route: '/probe/q1', login_required: false },
      source: { normal_fixture_sha256: await sha256File(frozen.fixturePath), cases_sha256: frozen.source.cases_sha256 },
    };
    return {
      environment_id: environmentId,
      public: { ...publicTemplate, input_sha256: digest(publicTemplate) },
      internal: {
        normalFixture: frozen.fixturePath,
        negativeFixture: frozen.fixturePath,
        normalRoute: '/probe/q1',
        negativeRoute: '/probe/q2',
        binding: { kind: 'exact-content', case_id: HOLD_Q1_CASE_ID, content_sha256: frozen.content_sha256 },
        verification: {
          schema: 'workbench/project-case-verification-contract-v2',
          detection: { kind: 'assertion-mismatch-at-step', step_marker: 'CASE_STEP_3' },
          frozen_fault: { ...frozen.fault, oracle_sha256: frozen.source.oracle_sha256 },
        },
      },
    };
  }
  const e2eGroups = {
    'test-site-01-query-v1': { source: 'TC-001', paired: 'TC-004', normal: '/ui/a', counterexample: '/ui/b', defect: { kind: 'assertion-mismatch-at-step', step_marker: 'CASE_STEP_3' }, expected: '2 条：DEV-002、DEV-005', actual: '3 条：DEV-002、DEV-004、DEV-005' },
    'test-site-01-sorting-v1': { source: 'TC-002', paired: 'TC-005', normal: '/ui/c', counterexample: '/ui/d', defect: { kind: 'assertion-mismatch-at-step', step_marker: 'CASE_STEP_2' }, expected: '第 2 行 DEV-006，之后 DEV-002', actual: '第 2 行 DEV-002，之后 DEV-006' },
    'test-site-01-detail-v1': { source: 'TC-003', paired: 'TC-006', normal: '/ui/e', counterexample: '/ui/f', defect: { kind: 'assertion-mismatch-at-step', step_marker: 'CASE_STEP_2' }, expected: '220 kW', actual: '320 kW' },
  };
  const e2eGroup = e2eGroups[environmentId];
  if (e2eGroup) {
    const baseUrl = String(process.env.WORKBENCH_TEST_SITE_BASE_URL || 'http://127.0.0.1:4320').replace(/\/$/, '');
    const base = new URL(baseUrl);
    if (base.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(base.hostname) || base.port !== '4320') {
      throw new Error('E2E01_SITE_ORIGIN_NOT_ALLOWED');
    }
    const resources = [e2eGroup.normal, '/app.js', '/styles.css'];
    const observed = [];
    for (const resource of resources) {
      const response = await fetch(new URL(resource, base));
      if (!response.ok) throw new Error(`E2E01_SITE_RESOURCE_UNAVAILABLE:${resource}:${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      observed.push({ path: resource, status: response.status, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex').toUpperCase() });
    }
    for (const route of [e2eGroup.normal, e2eGroup.counterexample]) {
      const response = await fetch(new URL(route, base));
      if (!response.ok) throw new Error(`E2E01_SITE_ROUTE_UNAVAILABLE:${route}:${response.status}`);
    }
    const packagePath = path.join(paths.workbenchRoot, 'examples', 'ui-six-cases', 'UI_TRIAL_6_CASES.workbench.json');
    const sourcePackage = JSON.parse(await fs.readFile(packagePath, 'utf8'));
    const original = sourcePackage.cases.find((item) => item.content?.external_id === e2eGroup.source);
    const paired = sourcePackage.cases.find((item) => item.content?.external_id === e2eGroup.paired);
    if (!original || !paired || JSON.stringify(original.content.steps) !== JSON.stringify(paired.content.steps)) {
      throw new Error('E2E01_SOURCE_CASE_PAIR_INVALID');
    }
    const publicTemplate = {
      template_id: environmentId, version: '1.0.0', title: 'TEST-SITE-01 只读设备台账场景',
      summary: `${e2eGroup.source} 正常页面观察与逐步预期`,
      candidate_contract: { url_environment_variable: 'PROBE_URL', test_count: 1, retries: 0, workers: 1 },
      allowed_entry: { kind: 'registered-local-read-only-trial-site', route: e2eGroup.normal, origin: base.origin, login_required: false, scope: '只读查看设备台账；不修改站点数据' },
      source: { resources: observed },
    };
    return {
      environment_id: environmentId,
      public: { ...publicTemplate, input_sha256: digest(publicTemplate) },
      internal: {
        normalUrl: new URL(e2eGroup.normal, base).href,
        pairedUrl: new URL(e2eGroup.counterexample, base).href,
        pairedExternalId: e2eGroup.paired,
        sourceExternalId: e2eGroup.source,
        pairGroup: environmentId,
        binding: { kind: 'exact-content', case_id: e2eGroup.source, content_sha256: original.content_sha256 || digest(original.content) },
        verification: {
          schema: 'workbench/project-case-verification-contract-v2',
          detection: e2eGroup.defect,
          frozen_fault: { expected: e2eGroup.expected, actual: e2eGroup.actual },
        },
        e2e01: true,
      },
    };
  }
  if (environmentId === AUTH01_PROJECT_ENVIRONMENT_ID) {
    const baseUrl = String(process.env.WORKBENCH_AUTH_FIXTURE_BASE_URL || 'http://127.0.0.1:4330').replace(/\/$/, '');
    const base = new URL(baseUrl);
    if (base.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(base.hostname)) {
      throw new Error('AUTH01_SITE_ORIGIN_NOT_ALLOWED');
    }
    // 只读探测证明对面确实是 AUTH-01 合成站，而不是同名端口的未知服务。
    const loginResponse = await fetch(new URL('/login', base));
    const loginText = loginResponse.ok ? await loginResponse.text() : '';
    if (!loginResponse.ok || !loginText.includes('AUTH-01')) throw new Error('AUTH01_SITE_IDENTITY_MISMATCH:/login');
    const identityResponse = await fetch(new URL('/api/identity', base));
    if (identityResponse.status !== 401) throw new Error('AUTH01_SITE_IDENTITY_MISMATCH:/api/identity');
    const identityBody = await identityResponse.json().catch(() => null);
    if (identityBody?.authenticated !== false) throw new Error('AUTH01_SITE_IDENTITY_MISMATCH:/api/identity');
    const publicTemplate = {
      template_id: environmentId, version: '1.0.0', title: 'AUTH-01 合成站受保护页',
      summary: '操作者在专用浏览器完成登录后，候选只读核对受保护页设备与角色。',
      candidate_contract: { url_environment_variable: 'PROBE_URL', test_count: 1, retries: 0, workers: 1 },
      allowed_entry: { kind: 'registered-local-auth-fixture', route: '/protected', origin: base.origin, login_required: true, scope: '只读查看受保护设备页；不修改站点数据' },
      source: { probed: ['/login', '/api/identity'] },
    };
    return {
      environment_id: environmentId,
      public: { ...publicTemplate, input_sha256: digest(publicTemplate) },
      internal: {
        auth01: true,
        origin: base.origin,
        normalUrl: new URL('/protected', base).href,
        binding: { kind: 'auth-session' },
        verification: {
          schema: 'workbench/project-case-verification-contract-v2',
          detection: { kind: 'auth-protected-observation' },
        },
      },
    };
  }
  throw new Error('CASE_BUILD_ENVIRONMENT_NOT_ALLOWED');
}

export function taskDocument(subject) {
  if (subject?.source?.kind === 'project-case') return subject.input_bundle.task_markdown;
  const template = subject?.template || subject;
  return [
    '# Frozen candidate task',
    '',
    `Task version: ${template.template_id}@${template.version}`,
    `Action: ${template.action}.`,
    `Required expected result supplied by the task: ${template.expected}.`,
    'Create exactly one Playwright Test candidate.',
    `The candidate must navigate to process.env.${template.candidate_contract.url_environment_variable}, perform the action, and assert the visible output equals the literal expected result.`,
    'Do not derive or change the expected value from the page.',
  ].join('\n');
}
