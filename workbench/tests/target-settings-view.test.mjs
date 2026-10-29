import test from 'node:test';
import assert from 'node:assert/strict';
import { scriptEnvironments } from '../server/build/user-workflow.mjs';
import { targetCatalogMarkup } from '../web-v2/project-target-access.js';

test('project settings catalog shows recorded origin and preserves missing provenance honestly', async () => {
  const manager = {
    generationDisabled: true,
    developmentEnvironments: [
      { id: 'registered', name: '借阅台', project_id: 'project-a', user_registered_target: true,
        normal_url: 'https://example.test/books', validation_mode: 'normal-only',
        target_scope: { origin: 'https://example.test', path_prefix: '/books' },
        operator: '核对人甲', registered_at: '2026-09-29T00:00:00.000Z' },
      { id: 'startup', name: '库存台', normal_url: 'http://127.0.0.1:4381/workspace',
        auth_requirement: { environment_id: 'startup', role: 'inspector' }, validation_mode: 'normal-only' },
      { id: 'automatic', name: '本机样例', validation_mode: 'normal-only' },
      { id: 'other-project', project_id: 'project-b', user_registered_target: true },
    ],
    candidateTrialEnvironments: [{ id: 'registered', configurationIdentity: { kind: 'registered-user-target',
      origin: 'https://example.test', path_prefix: '/books' }, check: async () => {} },
      { id: 'automatic', configurationIdentity: { kind: 'registered-static-html' }, check: async () => {} }],
    authSessions: { environment: () => ({ origin: 'http://127.0.0.1:4381' }) },
  };
  const { environments } = await scriptEnvironments(manager, 'project-a');
  assert.equal(environments.length, 3);
  assert.equal(environments[0].source, 'PROJECT_UI_REGISTRATION');
  assert.equal(environments[0].operator, '核对人甲');
  assert.equal(environments[1].source, 'STARTUP_CONFIGURATION');
  assert.equal(environments[2].source, 'LOCAL_AUTO_PREPARATION');
  assert.equal(environments[2].entry_url, null);
  const html = targetCatalogMarkup(environments);
  assert.match(html, /借阅台/);
  assert.match(html, /https:\/\/example\.test\/books/);
  assert.match(html, /项目内登记/);
  assert.match(html, /核对人甲/);
  assert.match(html, /启动配置接入/);
  assert.match(html, /登记时间：未记录 · 登记人：未记录/);
  assert.match(html, /需要登录（角色：inspector）/);
  assert.match(html, /本机自动准备/);
  assert.match(html, /运行时自动准备本机被测页面（无固定地址）/);
  assert.doesNotMatch(html, /other-project/);
});

test('project catalog distinguishes a registered HTTP target from UI targets', () => {
  const html = targetCatalogMarkup([{ id: 'env-backend', name: '查询接口', entry_url: 'https://api.example.test',
    purpose: '后端 HTTP/JSON 只读 GET', source: 'PROJECT_UI_REGISTRATION',
    allowed_path_prefixes: ['/api/books/'], operator: '自填核对人', registered_at: '2026-09-29T01:00:00Z',
    auth_label: '无需登录', ready: true },
    { id: 'env-synthetic', name: '合成接口', purpose: '后端合成 namespace',
      source: 'PROJECT_UI_REGISTRATION', auth_label: '合成角色请求头（非人工登录）' }]);
  assert.match(html, /后端 HTTP\/JSON 只读 GET/);
  assert.match(html, /https:\/\/api\.example\.test/);
  assert.match(html, /允许路径：\/api\/books\//);
  assert.match(html, /自填的核对人文本，并非已验证的账号身份/);
  assert.match(html, /登录要求：无需登录/);
  assert.match(html, /合成角色请求头（非人工登录）/);
});
