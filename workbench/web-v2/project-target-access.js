import { esc } from './workflow.js';

const post = body => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const authorizationErrors = {
  PROJECT_ENVIRONMENT_NOT_CONFIGURED: '项目尚未配置测试环境，请在本页选择或登记环境后保存。',
  PROJECT_ENVIRONMENT_MISMATCH: '项目环境与当前资源不一致；历史资源不会自动切换，请检查本页绑定。',
  PROJECT_ENVIRONMENT_CONFIGURATION_CHANGED: '项目测试环境配置已变化，请刷新并重新核对。',
  PROJECT_ENVIRONMENT_BUSY: '运行任务正在使用项目测试环境，暂不能更改绑定。',
  PROJECT_ENVIRONMENT_REVISION_CONFLICT: '项目测试环境修订已变化，请刷新本页后重试。',
  PROJECT_TRIAL_SELECTION_INVALID: '候选身份字段不完整或不匹配，请刷新用例后重新选择。',
  PROJECT_TRIAL_CANDIDATE_EXPIRED: '候选已过期；新候选不继承旧授权，请刷新并选择最新候选。',
  PROJECT_TARGET_CONFIGURATION_CHANGED: '环境配置已变化；请重新登记环境并单独授权新候选。',
  PROJECT_TRIAL_ENVIRONMENT_NOT_USER_REGISTERED: '此候选不属于本项目登记的环境，不能在此授权。',
  CASE_CONTENT_NOT_CONFIRMED: '此版本的业务用例尚未确认，不能授权试跑。',
  PROJECT_TRIAL_CASE_VERSION_EXPIRED: '用例已有新版本，请刷新并基于当前版本重新生成和授权。',
};

export function targetCatalogMarkup(environments = []) {
  const source = { PROJECT_UI_REGISTRATION: '项目内登记', STARTUP_CONFIGURATION: '启动配置接入', LOCAL_AUTO_PREPARATION: '本机自动准备' };
  const status = env => env.status_label || (env.ready ? env.auth_required ? '目标配置就绪，登录状态另查' : '准备就绪' : ({ GENERATION_TARGET_UNREACHABLE: '目标暂时无法访问，请检查被测系统是否已启动', AUTH_SESSION_REQUIRED: '请先完成人工登录', PROJECT_TARGET_CONFIGURATION_CHANGED: '配置已变化，请重新核对登记信息' })[env.reason] || '当前不可用，请查看配置诊断');
  return `<section class="panel settings-card"><div class="panel-header"><h2>本项目可见的被测系统配置</h2></div><div class="panel-body">
    <p>这里保存测试脚本访问的网站或接口地址、允许范围与登录要求；登记配置不会部署服务器。项目管理资料、用例和报告；被测系统配置决定向哪里测试。重新登录或重跑已有脚本无需新建配置；首次接入新目标、换地址或更改允许范围时再登记。</p>
    ${environments.map(env => `<article class="preview-item"><h3>${esc(env.name || env.id)}</h3>
      <p>用途：${esc(env.purpose || '前端 UI 测试')} · 地址：${esc(env.entry_url || (env.source === 'LOCAL_AUTO_PREPARATION' ? '运行时自动准备本机被测页面（无固定地址）' : '未记录'))}</p>
      <p>登录要求：${env.auth_label ? esc(env.auth_label) : env.auth_required ? `需要登录${env.auth_role ? `（角色：${esc(env.auth_role)}）` : ''}` : env.user_registered_target || env.source === 'LOCAL_AUTO_PREPARATION' ? '无需登录' : '未登记登录要求'} · 状态：${esc(status(env))}</p>
      <p>来源：${esc(source[env.source] || '未记录')} · 登记时间：${esc(env.registered_at || '未记录')} · 登记人：${esc(env.operator || '未记录')}</p>
      <p>配置归属：${env.source === 'PROJECT_UI_REGISTRATION' ? '当前项目' : ['STARTUP_CONFIGURATION','LOCAL_AUTO_PREPARATION'].includes(env.source) ? '本机共享配置，多个项目可见' : '未记录'}</p>
      ${env.operator ? '<p class="muted">登记人是本机操作者自填的核对人文本，并非已验证的账号身份。</p>' : ''}
      ${env.target_scope ? `<p>允许范围：${esc(env.target_scope.origin)}${esc(env.target_scope.path_prefix)}</p>` : ''}${env.allowed_path_prefixes?.length ? `<p>允许路径：${env.allowed_path_prefixes.map(prefix => esc(prefix)).join('、')}</p>` : ''}
      <details><summary>配置标识与诊断</summary><code>${esc(env.id)}</code>${env.reason ? `<p>诊断代码：${esc(env.reason)}</p>` : ''}</details></article>`).join('') || '<p>尚无可见的被测系统配置。</p>'}
    <p class="muted">当前自助登记仅支持无需登录的非生产 HTTP(S) 目标；已有需登录系统按现有登录配置使用，自助登记不支持任意 SSO 或接口鉴权。已有配置和历史绑定继续保留。</p>
  </div></section>`;
}

export function projectTargetsMarkup(targets = []) {
  return `<section class="panel settings-card"><div class="panel-header"><h2>登记本项目的非生产被测系统</h2></div><div class="panel-body">
    <p>仅支持无需登录的 HTTP(S) 目标。工作台地址及含用户名/密码的 URL 不允许登记，入口查询参数可用于搜索；普通 HTTP/JSON 接口目前不支持写入、登录或密钥鉴权。UI 试跑严格绑定已确认用例和本次精确候选；运行时浏览器限制到登记的同源和路径前缀，跨域跳转及范围外资源会被阻止；WebSocket 当前不支持，所有连接均会被阻止。</p>
    <form id="project-target-form" class="form-grid">
      <label class="field"><span>被测系统名称</span><input name="name" maxlength="120" required placeholder="例如：图书借阅台本机测试站点"></label>
      <label class="field"><span>入口 URL</span><input name="entry_url" maxlength="2048" required placeholder="http://127.0.0.1:4462"></label>
      <label class="field"><span>允许路径前缀</span><input name="path_prefix" required value="/" placeholder="/ 或 /books"></label>
      <label class="field"><span>核对人（本机操作者）</span><input name="operator" maxlength="120" required></label>
      <label class="notice wide"><input type="checkbox" name="confirm_non_production" required>我确认已获准测试此非生产目标，目标无需登录，且我核对了入口与允许路径范围。</label>
      <div class="actions wide"><button class="button primary" type="submit">创建并设为项目 UI 环境</button><span id="project-target-form-status" role="status"></span></div>
    </form>
    <div class="target-registration-list">${targets.map(target => `<article class="preview-item"><h3>${esc(target.name)}</h3><p>${esc(target.entry_url)}</p><p>范围：${esc(target.origin)}${esc(target.path_prefix)} · 状态：${target.ready ? '可用' : esc(target.reason || '待处理')}</p><p>核对人：${esc(target.operator)} · 配置修订：r${target.revision}</p><details><summary>配置哈希与登记时间</summary><code>${esc(target.configuration_sha256)}</code><p>${esc(target.registered_at)}</p></details></article>`).join('') || '<p>当前项目尚未登记自助被测系统。</p>'}</div>
    <p class="muted">改变入口或路径范围需要重新登记；新登记会形成独立环境身份，旧候选和授权不会转移。该登记只表示本机操作者已确认，不代表多人审批或业务批准。</p>
  </div></section>`;
}

export function bindProjectTargets(project, onChanged) {
  const form = document.querySelector('#project-target-form');
  if (!form) return;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('[type=submit]');
    const status = document.querySelector('#project-target-form-status');
    button.disabled = true;
    const data = new FormData(form);
    const body = { name: String(data.get('name')), entry_url: String(data.get('entry_url')),
      path_prefix: String(data.get('path_prefix')), operator: String(data.get('operator')),
      confirm_non_production: data.get('confirm_non_production') === 'on' };
    try {
      const result = await fetch(`/api/case-library/projects/${encodeURIComponent(project.project_id)}/targets`, post(body));
      const value = await result.json();
      if (!result.ok) throw Error(value.error || 'PROJECT_TARGET_REGISTRATION_FAILED');
      status.textContent = `${value.name} 已登记并通过入口可达性检查；正在设为项目当前 UI 环境…`;
      const settingUrl = `/api/case-library/projects/${encodeURIComponent(project.project_id)}/environment`;
      let bound = false;
      try {
        const currentResponse = await fetch(settingUrl);
        const current = await currentResponse.json();
        if (!currentResponse.ok) throw Error(current.error || 'PROJECT_ENVIRONMENT_READ_FAILED');
        const savedResponse = await fetch(settingUrl, post({ revision: current.revision, ui_environment_id: value.environment_id, backend_environment_id: current.backend_environment_id ?? null }));
        const saved = await savedResponse.json();
        if (!savedResponse.ok) throw Error(saved.error || 'PROJECT_ENVIRONMENT_BINDING_FAILED');
        bound = true;
        status.textContent = `${value.name} 已登记并设为项目当前 UI 环境。`;
      } catch (error) {
        status.textContent = `${value.name} 已登记，但尚未设为项目当前环境（${authorizationErrors[error.message] || error.message}）；刷新后在上方选择并保存。`;
      }
      if (bound) await onChanged();
    } catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
  });
}

export async function requestCandidateTrialAuthorization({ project, selection, candidate, onAuthorized, isCurrent=()=>true }) {
  const currentHash=()=>globalThis.location?.hash ?? window.location?.hash;
  const openedHash=currentHash(), routeCurrent=()=>isCurrent()&&currentHash()===openedHash;
  if(!routeCurrent())return;
  const root = document.querySelector('#modal-root');
  const required = ['project_id','case_id','case_version','content_sha256','source_task_id','candidate_version','bundle_sha256','environment_id'];
  if (!selection || required.some(key => selection[key] === undefined) || selection.project_id !== project.project_id ||
      selection.case_id !== candidate.case_id || selection.case_version !== candidate.case_version ||
      selection.source_task_id !== candidate.source_task_id || selection.candidate_version !== candidate.candidate_version ||
      selection.bundle_sha256 !== candidate.bundle_sha256) throw Error('PROJECT_TRIAL_SELECTION_INVALID');
  const operatorDefault = document.querySelector('#project-target-form [name=operator]')?.value || '';
  root.innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-label="授权本次技术试跑"><header><h2>授权本次技术试跑</h2><button class="icon-button" data-close aria-label="关闭">×</button></header><div class="modal-body">
    <p>这只授权下面列出的冻结候选在登记的非生产环境中运行。它不会批准业务结果或脚本，也不会调用模型。运行仍需从当前候选明确发起。</p>
    <dl class="target-scope-summary"><dt>项目</dt><dd>${esc(project.name)}</dd><dt>用例</dt><dd>${esc(candidate.external_id || selection.case_id)} · v${selection.case_version}</dd><dt>候选</dt><dd>v${selection.candidate_version} · ${esc(selection.source_task_id)}</dd><dt>候选包哈希</dt><dd><code>${esc(selection.bundle_sha256)}</code></dd><dt>环境</dt><dd>${esc(selection.environment_id)}</dd><dt>预算</dt><dd>模型调用 0；每批次 1 个精确候选、正常车道；同一冻结候选可再次明确选择运行。</dd></dl>
    <label class="field"><span>本机操作者</span><input id="trial-operator" maxlength="120" required value="${esc(operatorDefault)}"></label>
    <label class="notice"><input id="trial-confirm" type="checkbox">我确认授权此精确候选仅作非生产技术试跑。</label><p id="trial-auth-error" role="alert"></p>
  </div><footer><button class="button" data-close>取消</button><button class="button primary" id="trial-authorize" disabled>明确授权</button></footer></section></div>`;
  const dialog = root.firstElementChild;
  let closed=false,pending=false;
  const ownsDialog=()=>root.firstElementChild===dialog&&dialog.isConnected!==false;
  const live=()=>!closed&&routeCurrent()&&ownsDialog();
  // The caller may read automation before opening the next dialog. Keep this
  // guard valid during that read, even after our own dialog has been removed.
  const followupCurrent=()=>!closed&&routeCurrent()&&(!root.firstElementChild||root.firstElementChild===dialog);
  const onKey=event=>{if(event.key==='Escape')close();};
  const close = () => {
    closed=true;
    window.removeEventListener('hashchange',close);
    document.removeEventListener('keydown',onKey);
    if(ownsDialog())dialog.remove();
  };
  window.addEventListener('hashchange',close);
  document.addEventListener('keydown',onKey);
  dialog.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', close));
  const confirm = dialog.querySelector('#trial-confirm'), operator = dialog.querySelector('#trial-operator'), submit = dialog.querySelector('#trial-authorize');
  const update = () => { if(live())submit.disabled = pending || !confirm.checked || !operator.value.trim(); };
  confirm.addEventListener('change', update); operator.addEventListener('input', update);
  submit.addEventListener('click', async () => {
    if(!live()||pending||!confirm.checked||!operator.value.trim())return;
    pending=true;
    submit.disabled = true;
    let authorized;
    try {
      const response = await fetch(`/api/case-library/projects/${encodeURIComponent(project.project_id)}/trial-authorizations`, post({
        selection, operator: operator.value.trim(), confirm_technical_trial: confirm.checked,
      }));
      const value = await response.json();
      if(!live()){close();return;}
      if (!response.ok) throw Error(value.error || 'PROJECT_TRIAL_AUTHORIZATION_FAILED');
      authorized = value;
    } catch (error) {
      if(!live()){close();return;}
      pending=false;dialog.querySelector('#trial-auth-error').textContent = authorizationErrors[error.message] || error.message;update();return;
    }
    dialog.remove();
    try {if(followupCurrent())await onAuthorized(authorized,{isCurrent:followupCurrent});}
    catch(error){if(followupCurrent())throw error;}
    finally{close();}
  });
  return close;
}
