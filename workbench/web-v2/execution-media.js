// Presentation only: preserve recorded outcomes and never infer a missing value.
const timingFailureReasons = {
  TIMING_EVIDENCE_MISSING_OR_INVALID: '来源身份或记录完整性未通过核验',
  TIMING_OBSERVATION_CONTEXT_LOST: '页面跳转导致观测上下文丢失',
  TIMING_TARGET_NOT_UNIQUE: '目标提示缺失或重复',
  TIMING_TARGET_ALREADY_VISIBLE: '步骤开始时提示已显示',
  TIMING_TARGET_REPLACED: '观测期间提示元素被替换',
  TIMING_INTERVAL_NOT_ENDED: '提示显示后未结束',
  TIMING_REQUIRES_ONE_COMPLETE_CYCLE: '未取得唯一完整显示周期',
  TIMING_OUT_OF_FROZEN_RANGE: '提示可见时长超出原范围',
};

export function executionSteps(run) {
  const steps = run.step_replay?.steps?.length ? run.step_replay.steps
    : run.caption_timeline?.steps?.length ? run.caption_timeline.steps
    : (run.step_coverage?.items || []).map(item => {
    const source = run.frozen_case_content?.steps?.find(step => step.order === item.order);
    // Locator assertions also carry actual values; their coarse error category
    // must not hide a value that was captured for this particular step.
    const errors = (item.attributed_errors || []).map(entry => entry.error).filter(Boolean);
    const evidence = errors.find(error => error.actual != null) || errors[0];
    return { step_id: item.marker || item.step_id, order: item.order,
      action: source?.action || '原步骤动作未取得', expected: source?.expected || '原步骤预期未取得',
      execution_status: item.execution_status,
      actual: evidence?.actual ?? '未单独采集实际值', assertion_expected: evidence?.expected ?? null };
  });
  if (!run.timing_validation?.observations?.length) return steps;
  return steps.map(step => {
    const timing = (run.timing_validation?.observations || []).filter(item => item.step === step.order);
    if (!timing.length) return step;
    const actual = timing.map(item => {
      const target = `“${item.target || '加载提示'}”`;
      if (item.status !== 'PASSED' || !Number.isFinite(item.observed_duration_ms))
        return `${target}：计时证据未通过核验；原因：${timingFailureReasons[item.reason] || item.reason || '缺少有效观测值'}`;
      return `${target}：实测 ${item.observed_duration_ms.toFixed(1)} ms；原要求 ${item.min_ms}–${item.max_ms} ms；时间要求满足`;
    }).join('\n');
    return { ...step, actual: [step.actual, actual].filter(Boolean).join('\n'),
      ...(timing.some(item => item.status !== 'PASSED') ? { execution_status: 'FAILED' } : {}) };
  });
}

// View-only fallback: the Playwright report can pass while independent timing
// evidence fails. Keep the stored run and its business verdict unchanged.
export function displayFailureStep(run) {
  if (run.failure_step) return run.failure_step;
  if (run.status !== 'FAILED') return null;
  const timing = run.timing_validation?.observations?.find(item =>
    item.status === 'FAILED' && Number.isInteger(item.step) && item.step > 0);
  return timing ? `CASE_STEP_${timing.step}` : null;
}

export function stepResultLabel(step, run) {
  if (step.execution_status === 'PASSED') return run.status === 'FAILED' ? '本步骤通过（整例仍失败）' : '本步骤通过';
  if (step.execution_status === 'FAILED') return '本步骤失败';
  if (step.execution_status === 'NOT_EXECUTED') return '未执行';
  if (step.execution_status === 'MISSING') return '未采集执行证据';
  return null;
}

export function stepOutcomeNotice(run, steps) {
  if (run.status !== 'FAILED') return '';
  const failed = steps.filter(s => s.execution_status === 'FAILED').map(s => s.order);
  const passed = steps.filter(s => s.execution_status === 'PASSED').length;
  const notRun = steps.filter(s => s.execution_status === 'NOT_EXECUTED').length;
  return `本用例执行失败。${failed.length ? `第 ${failed.join('、')} 步失败；` : ''}${passed} 个步骤单独通过，${notRun} 个步骤未执行。后续步骤通过不会抵消本用例的失败；未执行步骤不计通过。`;
}

export function executionMediaUrl(run, fileId) {
  return run.origin === 'EXPLICIT_CANDIDATE_TRIAL' ? `/api/runs/${encodeURIComponent(run.run_id)}/media/${encodeURIComponent(fileId)}` : `/api/build/tasks/${encodeURIComponent(run.source_build_task_id)}/media/${encodeURIComponent(fileId)}`;
}

export function enhanceMedia(container, run) {
  const area=container.querySelector('.execution-media');if(!area||area.querySelector('.media-selector'))return;
  const replay=area.querySelector('[data-testid="execution-video"]'),original=area.querySelector('[data-testid="original-video"]');
  const views=[...area.children];
  const menu=document.createElement('div');menu.className='media-selector';
  const hasReplay=Boolean(run.step_replay && replay);
  menu.innerHTML=`<button class="button small" data-media-view="replay">步骤回放</button><button class="button small" data-media-view="original">原始录像</button><button class="button small" data-media-view="images">截图</button>`;
  area.prepend(menu);
  const images=document.createElement('div');images.hidden=true;images.dataset.mediaImages='true';
  for(const file of run.files.filter(f=>f.kind.endsWith('_screenshot'))){
    const a=document.createElement('a');a.href=executionMediaUrl(run,file.file_id);a.target='_blank';a.rel='noreferrer';
    const img=document.createElement('img');img.src=a.href;img.alt='本次运行截图';img.style.width='100%';a.append(img);images.append(a);
    const download=document.createElement('a');download.href=a.href;download.download=file.file_name||'screenshot.png';download.textContent='下载本次原图';images.append(download);
  }
  if(!images.childElementCount)images.textContent='本次运行没有可用截图。';area.append(images);
  const controls=document.createElement('div');controls.className='player-controls';controls.innerHTML='<button type="button" data-player-toggle>播放 / 暂停</button><input data-player-seek aria-label="视频播放进度" type="range" min="0" max="100" value="0" step="0.1"><select data-player-speed aria-label="播放速度"><option value="1">1×</option><option value="1.5">1.5×</option><option value="2">2×</option></select><span data-player-time>未播放</span>';
  area.append(controls);let active=hasReplay?replay:original||replay;
  const select=type=>{
    active?.pause();views.forEach(v=>v.hidden=true);images.hidden=type!=='images';controls.hidden=type==='images';
    const video=type==='replay'?(hasReplay?replay:null):original||(!hasReplay?replay:null);active=video;
    if(video){video.hidden=false;const link=views.filter(v=>v.tagName==='A'&&v.href===video.src);link.forEach(v=>v.hidden=false);}
    let note=area.querySelector('[data-view-note]');if(!note){note=document.createElement('p');note.dataset.viewNote='true';area.append(note);}
    note.textContent=type==='images'?'截图只属于当前运行；点击可查看原图。':video?type==='replay'?'中文字幕步骤证据回放（非原始连续录像）':(video===replay&&run.files.some(f=>f.kind.endsWith('_caption_video'))?'已有字幕录像；步骤时间轴未核验。':'原始连续录像（无中文步骤字幕）。步骤结果列在下方，未采集可靠时间轴，不能精确定位。')+(!run.recording?' 本记录未登记录制尺寸。':''):type==='replay'?'本次未采集可用步骤回放，不补造历史素材。':'本次原始录像缺失。';
    menu.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mediaView===type)));
    controls.querySelector('[data-player-toggle]').disabled=!video;
  };
  menu.querySelectorAll('button').forEach(b=>b.onclick=()=>select(b.dataset.mediaView));
  controls.querySelector('[data-player-toggle]').onclick=()=>{if(active)active.paused?void active.play().catch(()=>{}):active.pause();};
  controls.querySelector('[data-player-seek]').oninput=e=>{if(active&&Number.isFinite(active.duration))active.currentTime=active.duration*Number(e.target.value)/100;};
  controls.querySelector('[data-player-speed]').onchange=e=>{if(active)active.playbackRate=Number(e.target.value);};
  for(const v of [replay,original].filter(Boolean))v.addEventListener('timeupdate',()=>{if(active!==v)return;controls.querySelector('[data-player-seek]').value=Number.isFinite(v.duration)?v.currentTime/v.duration*100:0;controls.querySelector('[data-player-time]').textContent=`${v.currentTime.toFixed(1)} / ${Number.isFinite(v.duration)?v.duration.toFixed(1):'—'} 秒`;});
  // Trace is shared by all views and stays independently downloadable.
  views.filter(v=>v.tagName==='A'&&/Trace/.test(v.textContent)).forEach(v=>area.append(v));
  const trace=views.find(v=>v.tagName==='A'&&/Trace/.test(v.textContent));
  if(trace){const copy=trace.cloneNode(true);area.append(copy);}
  select(hasReplay?'replay':'original');
  container.querySelectorAll('[data-step-seek]').forEach(button=>button.addEventListener('click',()=>{if(hasReplay&&active!==replay)select('replay');}));
}
