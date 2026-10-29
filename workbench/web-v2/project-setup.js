import { api } from './api.js';
import { renderFrontendHandoffs } from './frontend-handoffs.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const post = value => ({method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value)});
const uiKeys = ['ui_enabled','base_url','login_required','path_prefix','name'];
const backendKeys = ['backend_enabled','backend_url','backend_mode','allowed_path_prefixes'];
const sameFields = (a,b,keys) => keys.every(key => JSON.stringify(a[key]) === JSON.stringify(b[key]));

export function setupValues(project, environment, targets = []) {
  const ui = environment.ui, backend = environment.backend;
  const registered = targets.find(item => item.environment_id === environment.ui_environment_id);
  const hasUiCases = project.cases.some(item => item.versions?.find(v => v.version === item.current_version)?.content.case_type !== 'BACKEND');
  const hasBackendCases = project.cases.some(item => item.versions?.find(v => v.version === item.current_version)?.content.case_type === 'BACKEND');
  return {
    ui_enabled: Boolean(ui || hasUiCases || !project.cases.length),
    backend_enabled: Boolean(backend || hasBackendCases),
    base_url: ui?.entry_url || registered?.entry_url || (/^https?:\/\//.test(ui?.entry || '') ? ui.entry : ''),
    name: (ui?.name || `${project.name} · 测试环境`).slice(0,100),
    path_prefix: registered?.path_prefix || ui?.target_scope?.path_prefix || '/',
    login_required: Boolean(ui?.auth_required),
    login_url: registered?.login_url || '', identity_url: registered?.identity_url || '',
    role: registered?.role || ui?.auth_role || 'tester',
    backend_url: backend?.base_url || '',
    backend_mode: backend?.mode || (backend?.namespace ? 'synthetic-namespace' : 'http-json-readonly'),
    allowed_path_prefixes: backend?.allowed_path_prefixes || [],
    read_only_post_queries: backend?.read_only_post_queries || [],
    run_id_prefix: backend?.namespace?.run_id_prefix || '',
    operator: registered?.operator || backend?.reviewer || '',
  };
}

export function setupRequests(values, initial, environment) {
  if (!values.ui_enabled && !values.backend_enabled) throw Error('请选择至少一种测试用途。');
  const comparedUiKeys = values.login_required ? [...uiKeys,'login_url','identity_url','role'] : uiKeys;
  const uiChanged = values.ui_enabled && (!environment.ui_environment_id || !sameFields(values,initial,comparedUiKeys));
  const comparedBackendKeys = values.backend_mode === 'synthetic-namespace' ? [...backendKeys,'run_id_prefix'] : backendKeys;
  const backendChanged = values.backend_enabled && (!environment.backend_environment_id || !sameFields(values,initial,comparedBackendKeys));
  if ((uiChanged || backendChanged) && !values.operator.trim()) throw Error('请填写本机操作者，作为本次环境授权记录。');
  if ((uiChanged || backendChanged) && !values.authorized) throw Error('请确认已获准测试此非生产环境。');
  if (uiChanged && !values.base_url.trim()) throw Error('请填写前端 Base URL。');
  if (backendChanged && !values.backend_url.trim()) throw Error('请填写后端 Base URL。');
  if (backendChanged && values.backend_mode === 'http-json-readonly' && !values.allowed_path_prefixes.length) throw Error('请填写接口允许路径，例如 /api/；它用于限定本项目的请求范围。');
  const runPrefix = (values.run_id_prefix || '').trim();
  if (backendChanged && values.backend_mode === 'synthetic-namespace' && runPrefix && !/^[a-z0-9](?:[a-z0-9-]{0,24}[a-z0-9])?$/.test(runPrefix)) throw Error('运行编号前缀限 1–26 位小写字母、数字或连字符，首尾须为字母或数字。');
  return {
    ui: uiChanged ? {name:values.name.trim(),entry_url:values.base_url.trim(),path_prefix:values.path_prefix.trim(),operator:values.operator.trim(),confirm_non_production:true,
      login_required:values.login_required,...(values.login_required?{login_url:values.login_url.trim() || values.base_url.trim(),role:values.role.trim() || 'tester',
        ...(values.identity_url.trim() && values.base_url.trim()===initial.base_url.trim()?{identity_url:values.identity_url.trim()}:{} )}:{})} : null,
    backend: backendChanged ? {name:`${values.name.trim()} · HTTP`,base_url:values.backend_url.trim(),mode:values.backend_mode,allowed_path_prefixes:values.allowed_path_prefixes,
      ...(values.backend_mode==='http-json-readonly' && values.backend_url.trim()===initial.backend_url.trim() && initial.read_only_post_queries?.length
        ? {read_only_post_queries:structuredClone(initial.read_only_post_queries)} : {}),
      ...(values.backend_mode==='synthetic-namespace' && runPrefix?{run_id_prefix:runPrefix}:{}),
      reviewer:values.operator.trim(),non_production:true,authorized:true} : null,
    binding: {revision:environment.revision,ui_environment_id:values.ui_enabled?environment.ui_environment_id:null,backend_environment_id:values.backend_enabled?environment.backend_environment_id:null},
  };
}

const errors = {
  PROJECT_ENVIRONMENT_REVISION_CONFLICT:'环境已在其他页面修改。当前输入保留，请刷新核对后再保存。',
  PROJECT_ENVIRONMENT_BUSY:'有任务正在使用环境。请等任务结束后再保存，当前输入已保留。',
  PROJECT_TARGET_AUTH_ORIGIN_INVALID:'登录页面需与 Base URL 同源；支持 HTTPS、本机和内网 IP 的 HTTP 地址。',
  PROJECT_TARGET_ENTRY_URL_INVALID:'请填写有效的 HTTP(S) 地址，地址中不能含账号或密码。',
  PROJECT_TARGET_UNREACHABLE:'目标暂时无法访问，请确认被测系统已启动。',
  GENERATION_TARGET_UNREACHABLE:'工作台未能连通被测地址。请在这台电脑上直接打开前端 Base URL，检查地址、端口、内网/VPN及被测服务；如果会跳转登录页，请选择需要登录后重新保存。当前输入已保留。',
  BACKEND_ENVIRONMENT_INVALID:'后端 Base URL 应是 HTTP(S) 根地址，例如 http://127.0.0.1:4401。',
  BACKEND_ENVIRONMENT_SCOPE_INVALID:'请填写有效的接口路径前缀，例如 /api/，每行一个。',
  BACKEND_NAMESPACE_PREFIX_INVALID:'运行编号前缀限 1–26 位小写字母、数字或连字符，首尾须为字母或数字。',
};

export function projectSetupHtml(project, environment, v) {
  const pid=encodeURIComponent(project.project_id), configured=Boolean(environment.ui_environment_id || environment.backend_environment_id);
  return `<div class="project-setup-page"><div class="page-heading"><div><h1>${configured?'项目设置':'配置测试环境'}</h1><p>设置一次，后续生成与运行沿用本项目环境。</p></div><a class="button" data-nav href="#/projects/${pid}">返回工作台</a></div>
    <ol class="setup-steps" aria-label="项目测试流程"><li aria-current="step"><span>1</span>配置环境</li><li><span>2</span>准备测试用例</li><li><span>3</span>生成脚本</li><li><span>4</span>运行与结果</li></ol>
    ${configured?`<section class="panel setup-saved" aria-label="已保存的项目环境"><h2>当前项目环境</h2><p>已保存 · 下方修改仅在保存后生效</p><dl>${environment.ui_environment_id?`<div><dt>前端 Base URL</dt><dd>${esc(v.base_url || '运行时准备，详见高级环境设置')}</dd></div>`:''}${environment.backend_environment_id?`<div><dt>后端 Base URL</dt><dd>${esc(v.backend_url)}</dd></div>`:''}<div><dt>登录方式</dt><dd>${environment.ui_environment_id?(v.login_required?'由你在被测系统中登录，状态待检查':'当前前端环境无需登录'):'未配置前端环境'}</dd></div></dl></section>`:''}
    <div class="setup-layout"><section class="panel project-setup"><div class="panel-body"><form id="project-setup-form">
      <h2>基本设置</h2>
      <label class="field setup-name"><span>环境名称</span><input name="name" maxlength="100" value="${esc(v.name.slice(0,100))}"></label>
      <fieldset class="setup-scope"><legend>本项目测试什么</legend><label><input type="checkbox" name="ui_enabled" ${v.ui_enabled?'checked':''}> 前端页面</label><label><input type="checkbox" name="backend_enabled" ${v.backend_enabled?'checked':''}> 后端接口</label></fieldset>
      <div data-setup-ui class="form-grid">
        <label class="field wide"><span>前端 Base URL</span><input name="base_url" type="url" maxlength="2048" value="${esc(v.base_url)}" placeholder="https://test.example.com" autocomplete="url"><small>被测前端页面所在的地址。</small></label>
        <label class="field wide"><span>访问前端系统需要登录吗？</span><select name="login_required"><option value="no" ${v.login_required?'':'selected'}>无需登录</option><option value="yes" ${v.login_required?'selected':''}>需要登录</option></select></label>
        <div class="wide form-grid setup-auth-fields" data-setup-auth>
          <label class="field wide"><span>登录页面</span><input name="login_url" type="url" value="${esc(v.login_url)}" placeholder="https://test.example.com/login"><small>填写与 Base URL 同源的完整地址；留空则从 Base URL 打开。</small></label>
          <p class="muted wide">无需提供登录校验接口。在专用浏览器完成登录后，点击“我已登录，检查页面”，工作台会检查测试入口能否访问。保存环境并不代表已经登录。</p>
        </div>
      </div>
      <div data-setup-backend class="form-grid setup-backend-fields">
        <label class="field wide"><span>后端 Base URL</span><input name="backend_url" type="url" value="${esc(v.backend_url)}" placeholder="http://127.0.0.1:4401"></label>
        <label class="field"><span>接口环境类型</span><select name="backend_mode"><option value="http-json-readonly" ${v.backend_mode==='http-json-readonly'?'selected':''}>普通 HTTP/JSON · 只读查询</option><option value="synthetic-namespace" ${v.backend_mode==='synthetic-namespace'?'selected':''}>练习台账 · 独立命名空间</option></select></label>
        <label class="field" data-setup-paths><span>接口允许路径</span><textarea name="allowed_path_prefixes" rows="2" placeholder="/api/">${esc(v.allowed_path_prefixes.join('\n'))}</textarea></label>
        <p class="muted wide">普通接口支持 GET 和项目已登记的只读 POST 查询${v.read_only_post_queries?.length?`（已登记 ${v.read_only_post_queries.length} 个）`:''}；练习台账支持独立数据的初始化、写入和清理。其他协议或鉴权需求会列为待补充/暂不支持。</p>
      </div>
      <details class="setup-advanced"><summary>高级操作与记录</summary><div class="form-grid"><label class="field wide"><span>页面允许路径</span><input name="path_prefix" value="${esc(v.path_prefix)}"></label><label class="field wide" data-setup-namespace><span>测试运行编号前缀（可选）</span><input name="run_id_prefix" maxlength="26" value="${esc(v.run_id_prefix || '')}" placeholder="backend-run"><small>仅用于练习台账；每次会追加唯一编号。留空使用默认前缀。</small></label></div><p><a data-nav href="#/projects/${pid}/environment-advanced">已登记环境、历史配置与登录会话</a></p><p><a data-nav href="#/projects/${pid}/cases">人工示范与浏览器跟踪：切换工作台的“用例”页签选择用例</a></p><p><a data-nav href="#/projects/${pid}/execution-records">查看测试记录与技术日志</a></p></details>
      <div class="form-grid setup-authorization"><label class="field wide"><span>本机操作者</span><input name="operator" maxlength="100" value="${esc(v.operator)}" placeholder="用于环境授权记录"><small>登记或修改环境时必填，用于记录本次测试授权。</small></label><label class="setup-consent wide"><input name="authorized" type="checkbox"> 我确认已获准测试此非生产环境及上面的访问范围。</label></div>
      <p id="project-setup-status" role="status" aria-live="polite"></p>
      <div class="setup-footer"><span class="muted">保存后在工作台继续准备测试用例</span><button class="button primary" type="submit">保存并继续 →</button></div>
    </form></div></section>
    <aside class="panel setup-account"><div class="panel-body"><span class="setup-account-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></span><h2>账号由你登录</h2><p>需要登录时，在工作台打开专用浏览器，由你完成账号、密码、验证码或多因素认证，再回到工作台检查登录。</p><p class="muted">这里不收集账号或密码。</p><h3>环境准备情况</h3><dl><div><dt>项目环境</dt><dd id="setup-binding-status">${configured?'已保存':'尚未保存'}</dd></div><div><dt>已保存环境的前端登录</dt><dd id="setup-auth-status">${!environment.ui_environment_id?'未配置前端':v.login_required?'待检查':'无需登录'}</dd></div></dl><p class="muted">环境保存和登录验证分别检查。生成或运行时仍以当前环境与登录检查结果为准。</p></div></aside></div>
    <details class="setup-handoffs"><summary><span><strong>前端技术交接资料</strong><small>可选：导入页面定位、控件和等待条件</small></span><span class="setup-handoff-action">展开高级设置</span></summary><section id="project-frontend-handoffs"></section></details></div>`;
}

export async function renderProjectSetup({project,showPage,go,isCurrent=()=>true,onDirty=()=>{}}) {
  const pid=encodeURIComponent(project.project_id), base=`/api/case-library/projects/${pid}`;
  const [environment, targetData] = await Promise.all([api(`${base}/environment`),api(`${base}/targets`)]);
  if (!isCurrent()) return;
  const initial=setupValues(project,environment,targetData.targets || []);
  showPage(projectSetupHtml(project,environment,initial));
  const handoffs = document.querySelector('#project-frontend-handoffs');
  const handoffDetails = document.querySelector('.setup-handoffs');
  let handoffsLoaded = false;
  handoffDetails?.addEventListener('toggle', () => {
    if (!handoffDetails.open || handoffsLoaded || !isCurrent()) return;
    handoffsLoaded = true;
    void renderFrontendHandoffs({projectId:project.project_id,container:handoffs,isCurrent});
  });
  const form=document.querySelector('#project-setup-form');
  if (!form) return;
  const input=name=>form.elements.namedItem(name);
  const refresh=()=>{
    form.querySelector('[data-setup-ui]').hidden=!input('ui_enabled').checked;
    form.querySelector('[data-setup-auth]').hidden=input('login_required').value!=='yes';
    form.querySelector('[data-setup-backend]').hidden=!input('backend_enabled').checked;
    form.querySelector('[data-setup-paths]').hidden=input('backend_mode').value!=='http-json-readonly';
    const namespace=form.querySelector('[data-setup-namespace]');
    if(namespace)namespace.hidden=!input('backend_enabled').checked || input('backend_mode').value!=='synthetic-namespace';
    for (const section of form.querySelectorAll('[data-setup-ui],[data-setup-backend]'))
      for (const control of section.querySelectorAll('input,select,textarea')) control.disabled=Boolean(control.closest('[hidden]'));
  };
  const changed=()=>{onDirty(true);refresh();const saved=document.querySelector('#setup-binding-status');if(saved)saved.textContent='有未保存修改';};
  form.addEventListener('input',changed); form.addEventListener('change',changed); refresh();
  // Keep successfully registered immutable targets if a later request fails,
  // so retrying this form does not create duplicate environments.
  const registered=new Map();
  const registerOnce=async(kind,body)=>{
    if (!isCurrent() || !form.isConnected) throw Error('页面已切换，本次未继续保存。');
    const key=JSON.stringify([kind,body]);
    if (!registered.has(key)) registered.set(key,await api(`${base}/${kind==='ui'?'targets':'backend/environments'}`,post(body)));
    return registered.get(key);
  };
  let saving=false;
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if (saving || !isCurrent() || !form.isConnected) return;
    const status=form.querySelector('#project-setup-status'), submit=form.querySelector('[type=submit]');
    const data=new FormData(form), values={...initial};
    for (const key of ['base_url','name','path_prefix','login_url','identity_url','role','backend_url','backend_mode','run_id_prefix','operator']) if(data.has(key)) values[key]=String(data.get(key)||'').trim();
    for (const key of ['ui_enabled','backend_enabled','authorized']) values[key]=data.has(key);
    values.login_required=data.get('login_required')==='yes';
    // Disabled mode-specific fields are absent from FormData, not cleared by the user.
    if(data.has('allowed_path_prefixes')) values.allowed_path_prefixes=String(data.get('allowed_path_prefixes')||'').split(/\r?\n/).map(value=>value.trim()).filter(Boolean);
    saving=true;for(const control of form.querySelectorAll('input,select,textarea,button'))control.disabled=true;
    status.textContent='正在保存项目环境…';
    try {
      const plan=setupRequests(values,initial,environment);
      if (plan.ui) plan.binding.ui_environment_id=(await registerOnce('ui',plan.ui)).environment_id;
      if (!isCurrent()) return;
      if (plan.backend) plan.binding.backend_environment_id=(await registerOnce('backend',plan.backend)).environment_id;
      if (!isCurrent()) return;
      if (plan.binding.ui_environment_id !== environment.ui_environment_id || plan.binding.backend_environment_id !== environment.backend_environment_id)
        await api(`${base}/environment`,post(plan.binding));
      onDirty(false);if (isCurrent()) go(`#/projects/${pid}`);
    } catch(error) {
      status.textContent=errors[error.code || error.message] || error.message || '保存失败，请核对后重试。';
      status.className='notice danger';
    } finally {saving=false;for(const control of form.querySelectorAll('input,select,textarea,button'))control.disabled=false;refresh();}
  });
  return ()=>onDirty(false);
}
