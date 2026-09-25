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
    note.textContent=type==='images'?'截图只属于当前运行；点击可查看原图。':video?type==='replay'?'中文字幕步骤证据回放（非原始连续录像）':'原始连续录像；没有可靠时标时不提供精确步骤定位。'+(!run.recording?' 历史录制清晰度有限。':' 采集尺寸：1280×720。'):type==='replay'?'本次未采集可用步骤回放，不补造历史素材。':'本次原始录像缺失。';
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
