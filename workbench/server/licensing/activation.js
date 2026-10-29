let csrf = '';
const status = document.querySelector('#status');
function message(text, error = false) { status.textContent = text; status.classList.toggle('error', error); }
const errors = { HARDWARE_CONSENT_REQUIRED:'请先同意读取主板标识。', LICENSE_SUBJECT_INVALID:'请填写使用者或单位名称（1～120个字符）。', LICENSE_BRIDGE_UNAVAILABLE:'设备授权组件或系统环境不可用，请联系软件提供方；尚未写入授权。', HARDWARE_ID_UNAVAILABLE:'无法可靠读取主板标识，请联系软件提供方。', LICENSE_HARDWARE_MISMATCH:'授权与当前主板不匹配，请重新申请。', LICENSE_SIGNATURE_INVALID:'授权签名无效，请使用软件提供方签发的原文件。', LICENSE_PRODUCT_MISMATCH:'此授权不属于测试工作台。', LICENSE_ALREADY_INSTALLED:'已有授权；如需重新授权，请明确选择替换。' };
async function send(url, payload) {
  const response = await fetch(url, { method:'POST', headers:{'content-type':'application/json','x-license-csrf':csrf}, body:JSON.stringify(payload) });
  const result = await response.json();
  if (!response.ok) throw Error(errors[result.error] || `未能完成：${result.error || response.status}`);
  return result;
}
async function action(button, task) { button.disabled = true; try { await task(); } catch(error) { message(error.message, true); } finally {button.disabled = false;} }
document.querySelector('#export-request').onclick = event => action(event.currentTarget, async () => {
  const { request } = await send('/api/activation/request', { displayName:document.querySelector('#display-name').value, consent:document.querySelector('#consent').checked });
  const url = URL.createObjectURL(new Blob([JSON.stringify(request,null,2)],{type:'application/json'}));
  const link = document.createElement('a'); link.href = url; link.download = 'ui-test-agent-device-request.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
  message('设备申请已下载。请交给软件提供方签发，再导入收到的授权文件。');
});
document.querySelector('#import-license').onclick = event => action(event.currentTarget, async () => {
  const file = document.querySelector('#license-file').files[0];
  if (!file || file.size > 24000) throw Error('请选择小于24 KB的授权JSON文件。');
  let license; try { license = JSON.parse(await file.text()); } catch {throw Error('授权文件不是有效JSON。');}
  await send('/api/activation/import', { license, consent:document.querySelector('#consent').checked, replace:document.querySelector('#replace').checked });
  message('授权已保存，正在启动工作台…');
  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise(resolve => setTimeout(resolve,1000));
    try { const response=await fetch('/api/health'); const health=await response.json(); if(response.ok && health.service==='approved-test-workbench' && !health.activation_required) {location.href='/workspace/';return;} } catch {}
  }
  message('授权已保存。工作台未及时就绪，请重新运行启动入口；无需再次导入。',true);
});
fetch('/api/activation/status').then(response=>response.json()).then(value=>{csrf=value.csrf;message('尚未激活或原授权不适用。请导出设备申请并导入签名授权。');}).catch(()=>message('无法连接本机激活服务。',true));
