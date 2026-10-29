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
  const trustedSource = source => source === 'PLAYWRIGHT_MATCHER_RESULT' || source === 'PLAYWRIGHT_MATCHER_ARGUMENTS' || source === 'PLAYWRIGHT_SOFT_MATCHER_ARGUMENTS' || source === 'PLAYWRIGHT_LOCATOR_OBSERVATION';
  const trusted = error => trustedSource(error?.value_source) && error.actual_present !== false && error.actual_recorded !== false &&
    Object.hasOwn(error, 'actual') && error.actual !== undefined;
  const steps = run.step_replay?.steps?.length ? run.step_replay.steps.map(step =>
    trusted(step)
      ? step : { ...step, actual: '未单独采集可信实际值', actual_recorded: false })
    : run.caption_timeline?.steps?.length ? run.caption_timeline.steps.map(step =>
      trusted(step)
        ? step : { ...step, actual: '未单独采集可信实际值', actual_recorded: false })
    : (run.step_coverage?.items || []).map(item => {
    const source = run.frozen_case_content?.steps?.find(step => step.order === item.order);
    // Locator assertions also carry actual values; their coarse error category
    // must not hide a value that was captured for this particular step.
    const errors = (item.attributed_errors || []).map(entry => entry.error).filter(Boolean);
    const evidence = errors.find(trusted) || errors[0];
    return { step_id: item.marker || item.step_id, order: item.order,
      action: source?.action || '原步骤动作未取得', expected: source?.expected || '原步骤预期未取得',
      execution_status: item.execution_status,
      actual: trusted(evidence) ? evidence.actual : '未单独采集可信实际值',
      actual_recorded: trusted(evidence), value_source: evidence?.value_source || null,
      assertion_expected: trusted(evidence) ? evidence.expected ?? null : null };
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
  if (run.origin === 'NATIVE_DSH') {
    const url = run.files?.find(file => file.file_id === fileId)?.artifact_url || run.files?.find(file => file.file_id === fileId)?.url;
    const prefix = `/api/case-library/projects/${encodeURIComponent(run.project_id)}/native-dsh/tasks/${encodeURIComponent(run.task_id)}/files/`;
    return typeof url === 'string' && url.startsWith(prefix) && !/[<>"\s]/.test(url) ? url : '';
  }
  return run.origin === 'EXPLICIT_CANDIDATE_TRIAL' ? `/api/runs/${encodeURIComponent(run.run_id)}/media/${encodeURIComponent(fileId)}` : `/api/build/tasks/${encodeURIComponent(run.source_build_task_id)}/media/${encodeURIComponent(fileId)}`;
}

export function executionDisplayStatus(run) {
  const lifecycle = run?.execution_status;
  return ['CANCELLED', 'INTERRUPTED', 'AUTH_SESSION_BLOCKED', 'RUNNING', 'QUEUED', 'STOPPING'].includes(lifecycle)
    ? lifecycle : run?.status || 'NOT_RUN';
}

export function executionMediaFiles(run) {
  const files = run?.files || [];
  return {
    window: files.find(file => file.kind === 'trial_window_video'),
    original: files.find(file => file.kind?.endsWith('_video') && !/_caption_video$|_step_replay_video$|_window_video$/.test(file.kind)),
    derived: files.find(file => file.kind?.endsWith('_caption_video')),
    replay: files.find(file => file.kind?.endsWith('_step_replay_video')),
  };
}

export function windowRecordingNoticeHtml(run) {
  const recording = run?.window_recording, file = executionMediaFiles(run).window;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const complete = recording?.status === 'COMPLETE' && Boolean(file);
  const text = complete ? '浏览器录像已采集，包含地址栏、标签页和网页内容。'
    : recording?.status === 'INCOMPLETE' ? '浏览器整窗录像不完整；已有片段可查看，不能作为完整录制证据。'
    : recording?.status === 'UNAVAILABLE' ? '本次未取得可用的浏览器整窗录像。'
    : recording?.status === 'COMPLETE' ? '浏览器整窗录制已登记完成，但录像文件缺失，暂不可播放。'
    : file ? '已取得浏览器录像文件，但未登记完整录制结果，完整性尚未核验。'
    : '此记录未采集浏览器整窗录像；现有网页录像不包含地址栏和标签页。';
  const recovered=recording?.minimization_recoveries?.filter?.(item=>item.status==='RESTORED').length || 0;
  const recoveryNote=recovered?` 录制期间恢复自有窗口 ${recovered} 次；最长采集间隔 ${escape(recording.maximum_capture_gap_ms)} 毫秒，原连续性校验仍适用。`:'';
  return `<p class="notice${complete ? '' : ' warning'}" data-testid="window-recording-notice">${text}${recoveryNote}${!complete && recording?.reason ? ` 原因：${escape(recording.reason)}。` : ''}${complete ? '' : ' 录制完整性与业务用例结果分别核对。'}</p>`;
}

// Browser-window time is independent from the synthetic replay clock. It can
// only be used after both the recording identity and decoded duration agree.
export function verifiedWindowTimeline(run, duration) {
  const timeline = run?.window_timeline;
  const unavailable = reason => ({ status: 'UNAVAILABLE', reason, steps: [] });
  if (timeline?.schema !== 'workbench/window-step-timeline-v1' || timeline.status !== 'VERIFIED') return unavailable('TIMELINE_UNAVAILABLE');
  if (!run.run_id || !run.candidate_sha256 || timeline.run_id !== run.run_id || timeline.candidate_sha256 !== run.candidate_sha256) return unavailable('TIMELINE_IDENTITY_MISMATCH');
  if (!Number.isFinite(timeline.duration_seconds) || timeline.duration_seconds <= 0 || !Number.isFinite(timeline.accuracy_seconds) || timeline.accuracy_seconds <= 0 || timeline.accuracy_seconds > 1.5) return unavailable('TIMELINE_INVALID');
  if (!Number.isFinite(duration) || duration <= 0) return unavailable('VIDEO_DURATION_UNAVAILABLE');
  if (Math.abs(duration - timeline.duration_seconds) > 0.35 + 1e-9) return unavailable('VIDEO_DURATION_MISMATCH');
  const ids = new Set(), recorded = executionSteps(run);
  let previousEnd = 0;
  if (!Array.isArray(timeline.steps) || !timeline.steps.length || timeline.steps.some(step => {
    const matching = recorded.find(item => item.step_id === step.step_id);
    const invalid = !step.step_id || ids.has(step.step_id) || !Number.isInteger(step.order) || step.order < 1 ||
      recorded.length && (!matching || matching.order !== step.order) || step.execution_status === 'NOT_EXECUTED' ||
      ![step.start_seconds, step.action_start_seconds, step.result_start_seconds, step.end_seconds].every(Number.isFinite) ||
      step.start_seconds < previousEnd - 0.001 || step.action_start_seconds < step.start_seconds ||
      step.result_start_seconds < step.action_start_seconds || step.end_seconds < step.result_start_seconds ||
      step.end_seconds <= step.start_seconds || step.end_seconds > timeline.duration_seconds + 0.001;
    ids.add(step.step_id); previousEnd = step.end_seconds;
    return invalid;
  })) return unavailable('TIMELINE_INVALID');
  return { status: 'VERIFIED', reason: null, steps: timeline.steps };
}

export function mediaStepPosition(chapters, time) {
  if (!Number.isFinite(time)) return null;
  const chapter = [...chapters].reverse().find(item => time >= item.start_seconds &&
    (time < item.end_seconds || item === chapters.at(-1) && Math.abs(time - item.end_seconds) < 0.001));
  return chapter ? { step_id: chapter.step_id, phase: time >= chapter.result_start_seconds ? 'result' : 'action' } : null;
}

export function mediaPhaseTime(chapter, phase, replay = false) {
  const start = phase === 'result' ? chapter.result_start_seconds : chapter.action_start_seconds ?? chapter.start_seconds;
  const end = phase === 'result' ? chapter.end_seconds : chapter.result_start_seconds;
  // Enter the requested phase rather than copying seconds between two clocks.
  return start + Math.min(replay ? 0.15 : 0.05, Math.max(0, end - start) / 2);
}

export function enhanceMedia(container, run) {
  const area=container.querySelector('.execution-media');if(!area)return;
  if(area._mediaController)return area._mediaController;
  const handlesSteps=Boolean(run.step_replay || run.window_timeline);
  const files=executionMediaFiles(run), replay=area.querySelector('[data-testid="execution-video"]');
  const addVideo=(file,testid)=>{
    if(!file)return null;
    const video=document.createElement('video');video.dataset.testid=testid;video.controls=true;video.preload='metadata';video.src=executionMediaUrl(run,file.file_id);area.append(video);
    const download=document.createElement('a');download.href=video.src;download.download=file.file_name||'recording.webm';download.textContent=testid==='browser-window-video'?'下载浏览器录像':'下载网页录像';area.append(download);
    return video;
  };
  const windowVideo=area.querySelector('[data-testid="browser-window-video"]')||addVideo(files.window,'browser-window-video');
  const original=area.querySelector('[data-testid="original-video"]')||(files.original && replay?.getAttribute('src')===executionMediaUrl(run,files.original.file_id)?replay:addVideo(files.original,'original-video'));
  const videos=[...new Set([windowVideo,replay,original].filter(Boolean))];
  const views=[...area.children];
  const menu=document.createElement('div');menu.className='media-selector';
  const hasReplay=Boolean(replay && (run.step_replay?.status==='READY' || run.caption_timeline?.status==='VERIFIED' && run.caption_timeline?.schema==='workbench/trial-timeline-v2'));
  menu.innerHTML=`${windowVideo?'<button class="button small" data-media-view="window">浏览器录像</button>':''}<button class="button small" data-media-view="replay">步骤回放</button><button class="button small" data-media-view="original">网页录像</button><button class="button small" data-media-view="images">截图</button><button class="button primary" data-player-fullscreen title="占满屏幕查看，按 Esc 退出">全屏播放</button><button class="button" data-player-expand aria-expanded="false">放大查看</button>`;
  area.prepend(menu);
  const viewport=document.createElement('div');viewport.className='media-video-viewport';viewport.setAttribute('aria-label','录像画面，可滚动查看放大后的细节');
  videos.forEach(video=>viewport.append(video));area.append(viewport);
  const images=document.createElement('div');images.hidden=true;images.dataset.mediaImages='true';
  for(const file of (run.files||[]).filter(f=>f.kind.endsWith('_screenshot'))){
    const a=document.createElement('a');a.href=executionMediaUrl(run,file.file_id);a.target='_blank';a.rel='noreferrer';
    const img=document.createElement('img');img.src=a.href;img.alt='本次运行截图';img.className='execution-media-screenshot';a.append(img);images.append(a);
    const download=document.createElement('a');download.href=a.href;download.download=file.file_name||'screenshot.png';download.textContent='下载本次原图';images.append(download);
  }
  if(!images.childElementCount)images.textContent='本次运行没有可用截图。';area.append(images);
  const controls=document.createElement('div');controls.className='player-controls';controls.innerHTML='<button type="button" data-player-toggle>播放 / 暂停</button><input data-player-seek aria-label="视频播放进度" type="range" min="0" max="100" value="0" step="0.1"><select data-player-speed aria-label="播放速度"><option value="0.25">0.25×</option><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="1.5">1.5×</option><option value="2">2×</option></select><span data-player-time>未播放</span><label>画面缩放 <select data-player-zoom aria-label="录像画面缩放"><option value="fit">适合窗口</option><option value="1">原始大小</option><option value="1.5">放大 150%</option><option value="2">放大 200%</option></select></label><small data-player-resolution>正在读取原始分辨率</small>';
  area.append(controls);
  const navigation=document.createElement('div');navigation.className='media-step-navigation';
  navigation.innerHTML='<p data-player-step role="status" aria-live="polite">播放位置：尚未播放</p><div class="media-step-buttons"><button type="button" data-player-previous>上一步</button><select data-player-step-select aria-label="定位本次运行步骤"><option value="">选择步骤</option></select><button type="button" data-player-next>下一步</button></div>';
  area.append(navigation);
  const steps=executionSteps(run), chapters=run.step_replay?.status==='READY'?(run.step_replay.chapters||[]).filter(chapter=>
    typeof chapter.step_id==='string' && [chapter.start_seconds,chapter.result_start_seconds,chapter.end_seconds].every(Number.isFinite) && chapter.start_seconds>=0 && chapter.result_start_seconds>=chapter.start_seconds && chapter.end_seconds>=chapter.result_start_seconds):[];
  const stepSelect=navigation.querySelector('[data-player-step-select]');
  for(const step of steps){const option=document.createElement('option');option.value=step.step_id||'';option.textContent=`${step.order}. ${step.action||'步骤'}`;stepSelect.append(option);}
  navigation.hidden=!handlesSteps;
  let active=null,activeType='',pendingPosition=null,transitionNote='';
  const zoom=controls.querySelector('[data-player-zoom]');
  const applyZoom=()=>{
    const width=active?.videoWidth,height=active?.videoHeight,known=Number.isFinite(width)&&width>0&&Number.isFinite(height)&&height>0;
    zoom.disabled=!known;
    controls.querySelector('[data-player-resolution]').textContent=known?`原始录像 ${width} × ${height}；放大不改变原文件清晰度`:'原始分辨率尚未读取';
    for(const video of videos){
      const scale=Number(zoom.value),pixels=video===active&&known&&zoom.value!=='fit';
      video.style.width=pixels?`${width*scale}px`:'';video.style.height=pixels?`${height*scale}px`:'';
      video.classList.toggle('media-original-pixels',pixels);
    }
  };
  zoom.onchange=()=>{applyZoom();viewport.scrollTop=0;viewport.scrollLeft=0;};
  const failedVideos=new WeakSet();
  let checkedDuration,checkedWindowTimeline;
  const windowTimeline=()=>{
    if(failedVideos.has(windowVideo))return {status:'UNAVAILABLE',reason:'VIDEO_LOAD_FAILED',steps:[]};
    if(!checkedWindowTimeline||!Object.is(checkedDuration,windowVideo?.duration)){
      checkedDuration=windowVideo?.duration;checkedWindowTimeline=verifiedWindowTimeline(run,checkedDuration);
    }
    return checkedWindowTimeline;
  };
  const replayChapters=()=>hasReplay && !failedVideos.has(replay) && Number.isFinite(replay?.duration) && replay.duration>0 ? chapters:[];
  const timelineFor=video=>video===windowVideo?windowTimeline().steps:video===replay?replayChapters():[];
  const currentPosition=()=>mediaStepPosition(timelineFor(active),active?.currentTime);
  const navigable=step=>step.execution_status!=='NOT_EXECUTED' && Boolean(windowTimeline().steps.find(row=>row.step_id===step.step_id)||replayChapters().find(row=>row.step_id===step.step_id));
  const note=document.createElement('p');note.dataset.viewNote='true';area.append(note);
  const updateNote=()=>{
    const timeline=windowTimeline();
    note.textContent=failedVideos.has(active)?'当前录像加载失败，请切换查看其他录像或截图；业务用例结果未改变。'
      : activeType==='images'?'截图只属于当前运行；点击可查看原图。'
      : activeType==='window'?timeline.status==='VERIFIED'?'浏览器录像已与本次步骤时间轴核验；点击步骤可直接定位，切换步骤回放按相同步骤和动作／结果阶段对应。'
        : `${timeline.reason==='VIDEO_DURATION_UNAVAILABLE'?'正在核验浏览器录像时长':timeline.reason==='VIDEO_DURATION_MISMATCH'?'浏览器录像时长与步骤时间轴不一致':'浏览器录像没有可核验的步骤时间轴'}；步骤定位将切换到步骤回放，不猜测历史录像时间。`
      : activeType==='replay'?active?(run.step_replay?'中文字幕步骤证据回放（由截图和结果合成，非原始连续录像）':'带中文字幕的网页录像（步骤时间轴已核验）'):'本次未采集可用步骤回放，不补造历史素材。'
      : active?(active===replay&&files.derived?'已有字幕网页录像；步骤时间轴未核验。':'网页连续录像，仅包含网页内容，不包含地址栏和标签页；步骤定位使用步骤回放。'):'本次网页录像缺失。';
    if(transitionNote)note.textContent+=' '+transitionNote;
  };
  const updateStep=()=>{
    if(!handlesSteps)return;
    const position=currentPosition(), step=steps.find(item=>item.step_id===position?.step_id);
    const text=position?`播放位置：步骤 ${step?.order ?? ''} · ${position.phase==='result'?'结果':'动作'}${step?.action?' · '+step.action:''}`
      : activeType==='window'&&windowTimeline().status!=='VERIFIED'?'播放位置：浏览器录像时间轴未核验，步骤定位使用步骤回放。'
        : timelineFor(active).length?'播放位置：步骤间':'播放位置：当前视图没有可用步骤时间轴。';
    navigation.querySelector('[data-player-step]').textContent=text;
    const playing=container.querySelector('#execution-playing-step');if(playing)playing.textContent=text;
    container.querySelectorAll('.execution-step').forEach(item=>item.classList.toggle('playing',Boolean(position)&&item.dataset.stepId===position.step_id));
    stepSelect.value=position?.step_id||'';
    for(const option of stepSelect.options)if(option.value)option.disabled=!navigable(steps.find(step=>step.step_id===option.value)||{});
    const available=steps.filter(navigable),index=available.findIndex(item=>item.step_id===position?.step_id);
    navigation.querySelector('[data-player-previous]').disabled=!available.length||index===0;
    navigation.querySelector('[data-player-next]').disabled=!available.length||index===available.length-1;
    stepSelect.disabled=!available.length;
    container.querySelectorAll('[data-step-seek]').forEach(button=>{button.disabled=!navigable(steps.find(step=>step.step_id===button.dataset.stepSeek)||{});});
  };
  const syncControls=()=>{
    const duration=active?.duration, position=active?.currentTime||0;
    controls.querySelector('[data-player-seek]').value=Number.isFinite(duration)&&duration>0?position/duration*100:0;
    controls.querySelector('[data-player-seek]').disabled=!active;
    controls.querySelector('[data-player-time]').textContent=active?`${position.toFixed(1)} / ${Number.isFinite(duration)?duration.toFixed(1):'—'} 秒`:'未播放';
    controls.querySelector('[data-player-toggle]').textContent=active&&!active.paused?'暂停':'播放';
    updateStep();
  };
  const playActive=()=>{const video=active;if(video)void video.play().catch(()=>{});};
  const applyPosition=position=>{
    const chapter=timelineFor(active).find(item=>item.step_id===position?.step_id);
    if(!chapter)return false;
    active.currentTime=mediaPhaseTime(chapter,position.phase,active===replay);return true;
  };
  const select=(type,{position=currentPosition(),continuePlaying=Boolean(active&&!active.paused)}={})=>{
    pendingPosition=null;transitionNote='';
    videos.forEach(video=>video.pause());views.forEach(v=>v.hidden=true);images.hidden=type!=='images';controls.hidden=type==='images';
    const video=type==='window'?windowVideo:type==='replay'?(hasReplay?replay:null):type==='original'?original||(!hasReplay?replay:null):null;active=video;activeType=type;
    viewport.hidden=!video;
    if(video){video.hidden=false;video.playbackRate=Number(controls.querySelector('[data-player-speed]').value);const link=views.filter(v=>v.tagName==='A'&&v.href===video.src);link.forEach(v=>v.hidden=false);}
    applyZoom();
    if(position && video && !applyPosition(position)){
      if((video===windowVideo&&windowTimeline().reason==='VIDEO_DURATION_UNAVAILABLE'||video===replay&&!Number.isFinite(video.duration))&&!failedVideos.has(video))pendingPosition={video,position,continuePlaying};
      else if(type==='window'||type==='replay')transitionNote='当前没有可对应的已核验步骤，保留此录像原来的播放位置。';
    }
    updateNote();
    menu.querySelectorAll('[data-media-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mediaView===type)));
    controls.querySelector('[data-player-toggle]').disabled=!video;
    syncControls();
    if(continuePlaying&&video&&!pendingPosition)playActive();
  };
  menu.querySelectorAll('[data-media-view]').forEach(b=>b.onclick=()=>select(b.dataset.mediaView));
  controls.querySelector('[data-player-toggle]').onclick=()=>{pendingPosition=null;if(active)active.paused?playActive():active.pause();syncControls();};
  controls.querySelector('[data-player-seek]').oninput=e=>{pendingPosition=null;if(active&&Number.isFinite(active.duration)){active.currentTime=active.duration*Number(e.target.value)/100;syncControls();}};
  controls.querySelector('[data-player-speed]').onchange=e=>{if(active)active.playbackRate=Number(e.target.value);};
  for(const v of videos){
    if(handlesSteps)v._executionBindings?.abort();
    v.controlsList?.remove('nofullscreen');v.disablePictureInPicture=true;
    v._mediaViewBindings?.abort();const bindings=new AbortController();v._mediaViewBindings=bindings;
    for(const event of ['timeupdate','seeked','pause'])v.addEventListener(event,()=>{if(active===v)syncControls();},{signal:bindings.signal});
    for(const event of ['loadedmetadata','durationchange'])v.addEventListener(event,()=>{
      if(pendingPosition?.video===v&&active===v){const pending=pendingPosition;
        if(applyPosition(pending.position)||Number.isFinite(v.duration)){pendingPosition=null;if(pending.continuePlaying)playActive();}}
      updateNote();syncControls();applyZoom();
    },{signal:bindings.signal});
    v.addEventListener('play',()=>{if(v!==active){v.pause();return;}for(const other of videos)if(other!==v)other.pause();syncControls();},{signal:bindings.signal});
    v.addEventListener('error',()=>{failedVideos.add(v);if(pendingPosition?.video===v)pendingPosition=null;updateNote();syncControls();if(v===windowVideo){const notice=container.querySelector('[data-testid="window-recording-notice"]');if(notice){notice.className='notice warning';notice.textContent='浏览器录像加载失败，当前无法核验整窗录制；可查看网页录像或步骤回放。业务用例结果未改变。';}}},{signal:bindings.signal});
  }
  // Trace is shared by all views and stays independently downloadable.
  views.filter(v=>v.tagName==='A'&&/Trace/.test(v.textContent)).forEach(v=>area.append(v));
  const trace=views.find(v=>v.tagName==='A'&&/Trace/.test(v.textContent));
  if(trace){const copy=trace.cloneNode(true);area.append(copy);}
  const seekStep=stepId=>{
    const step=steps.find(item=>item.step_id===stepId);if(!step||!navigable(step))return;
    const position={step_id:stepId,phase:step.execution_status==='FAILED'?'result':'action'};
    const inWindow=windowTimeline().steps.some(item=>item.step_id===stepId);
    const type=active===windowVideo&&inWindow?'window':replayChapters().some(item=>item.step_id===stepId)?'replay':inWindow?'window':null;
    if(!type)return;
    select(type,{position});
    container.querySelectorAll('.execution-step').forEach(item=>item.classList.toggle('selected',item.dataset.stepId===stepId));
  };
  container.querySelectorAll('[data-step-seek]').forEach(button=>button.addEventListener('click',()=>{if(handlesSteps)seekStep(button.dataset.stepSeek);else if(hasReplay&&active!==replay)select('replay');}));
  stepSelect.onchange=()=>seekStep(stepSelect.value);
  for(const [selector,direction] of [['[data-player-previous]',-1],['[data-player-next]',1]])navigation.querySelector(selector).onclick=()=>{
    const available=steps.filter(navigable),index=available.findIndex(item=>item.step_id===currentPosition()?.step_id);
    const next=available[index<0?0:Math.max(0,Math.min(available.length-1,index+direction))];if(next)seekStep(next.step_id);
  };
  const fullscreen=menu.querySelector('[data-player-fullscreen]'),expand=menu.querySelector('[data-player-expand]');
  let expanded=false,previousFocus,previousOverflow,expansionObserver;
  const closeExpanded=()=>setExpanded(false);
  const trapFocus=event=>{
    if(!expanded)return;
    if(event.key==='Escape'){event.preventDefault();closeExpanded();return;}
    if(event.key!=='Tab')return;
    const focusable=[...area.querySelectorAll('button,input,select,a[href],video[controls]')].filter(node=>!node.disabled&&node.getClientRects().length);
    const first=focusable[0],last=focusable.at(-1);
    if(event.shiftKey&&(document.activeElement===first||!area.contains(document.activeElement))){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&(document.activeElement===last||!area.contains(document.activeElement))){event.preventDefault();first?.focus();}
  };
  const setExpanded=value=>{
    if(expanded===value)return;expanded=value;area.classList.toggle('is-expanded',value);expand.textContent=value?'退出放大':'放大查看';expand.setAttribute('aria-expanded',String(value));
    if(value){
      previousFocus=document.activeElement;previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
      area.setAttribute('role','dialog');area.setAttribute('aria-modal','true');area.setAttribute('aria-label','录像放大查看');
      document.addEventListener('keydown',trapFocus,true);expand.focus();
      expansionObserver=new MutationObserver(()=>{if(!area.isConnected)closeExpanded();});expansionObserver.observe(document.body,{childList:true,subtree:true});
    }else{
      expansionObserver?.disconnect();document.removeEventListener('keydown',trapFocus,true);
      area.removeAttribute('role');area.removeAttribute('aria-modal');area.removeAttribute('aria-label');
      if(document.body.style.overflow==='hidden')document.body.style.overflow=previousOverflow;
      if(previousFocus?.isConnected)previousFocus.focus();
    }
  };
  expand.onclick=()=>setExpanded(!expanded);
  const updateFullscreen=()=>{fullscreen.textContent=area.contains(document.fullscreenElement)||document.fullscreenElement===area?'退出全屏':'全屏播放';};
  area.addEventListener('fullscreenchange',updateFullscreen);
  fullscreen.onclick=async()=>{try{
    if(area.contains(document.fullscreenElement)||document.fullscreenElement===area)await document.exitFullscreen();
    else{if(typeof area.requestFullscreen!=='function')throw Error('FULLSCREEN_UNAVAILABLE');await area.requestFullscreen();if(expanded)closeExpanded();}
    updateFullscreen();
  }catch{setExpanded(true);transitionNote='浏览器未允许系统全屏，已放大到当前窗口；可用原始大小或画面缩放查看细节，按 Esc 退出。';updateNote();}};
  for(const video of videos)video.addEventListener('dblclick',event=>{event.preventDefault();fullscreen.click();});
  area._mediaController={handlesSteps,seekStep};
  select(windowVideo?'window':hasReplay?'replay':'original',{position:null,continuePlaying:false});
  return area._mediaController;
}
