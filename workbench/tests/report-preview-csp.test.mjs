import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import { renderReport } from '../server/report-layout.mjs';

// Browser-only engineering fixture: every request is fulfilled in memory. No
// workbench, listening HTTP server, project data, or model is used.
const origin='https://report-preview.test';
const reportPath='/api/case-library/projects/project-preview/reports/report-preview';
const app=await fs.readFile(new URL('../server/app.mjs',import.meta.url),'utf8');
const csp=app.match(/'content-security-policy': "([^"]+)"/)?.[1];
const modules=new Map(await Promise.all(['reports.js','api.js','workflow.js'].map(async name=>
  [`/workspace/${name}`,await fs.readFile(new URL(`../web-v2/${name}`,import.meta.url),'utf8')])));
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jzL8AAAAASUVORK5CYII=','base64');
const trace=Buffer.from('504b0506000000000000000000000000000000000000','hex');
const imageUrl=`data:image/png;base64,${png.toString('base64')}`;
const videoUrl='data:video/webm;base64,GkXfow=='; // Transport/controls fixture; playback is not asserted.
const snapshot={project:{project_id:'project-preview',name:'报告 CSP 回归'},report_id:'report-preview',
  scope:'project_latest',group_key:'latest_per_case',created_at:'2026-10-29T00:00:00Z',case_count:1,entry_count:1,
  counts:{requested:1,executed:1,passed:0,failed:1,not_run:0},entries:[{
    case_id:'case-preview',external_id:'UI-1',title:'保留报告样式与附件',case_version:1,case_type:'UI',
    state:'FAILED',result:'FAILED',evidence_status:'COMPLETE',
    content:{steps:[{order:1,action:'读取页面',expected:'保留原始证据'}]},
    steps:[{order:1,status:'FAILED',actual:'回归夹具'}],media:[
      {kind:'image',included:true,name:'preview.png',data_url:imageUrl},
      {kind:'video',included:true,name:'browser-window.webm',data_url:videoUrl},
      {kind:'trace',included:true,name:'trace.zip',data_url:`data:application/zip;base64,${trace.toString('base64')}`},
    ],
  }]};
const html=renderReport(snapshot).replace('</head>',
  '<style media="screen">body{--preview-media:screen;color:rgb(1,2,3)}</style>'+ 
  '<style media="screen">body{color:rgb(23,45,67)}</style>'+ 
  '<style media="print">body{--preview-media:print}</style></head>');
const htmlBytes=Buffer.from(html),beforeHash=createHash('sha256').update(htmlBytes).digest('hex');

async function fixture(browser){
  const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[],requests=[],unexpected=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  page.on('requestfailed',request=>errors.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`));
  await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());requests.push({method:request.method(),path:url.pathname,search:url.search});
    if(url.origin!==origin||request.method()!=='GET'){unexpected.push(request.url());await route.abort();return;}
    if(url.pathname==='/workspace/'){
      await route.fulfill({contentType:'text/html',headers:{'content-security-policy':csp},body:'<!doctype html><html lang="zh-CN"><head><link rel="stylesheet" href="/fixture.css"></head><body><div id="page"></div></body></html>'});return;
    }
    if(url.pathname==='/fixture.css'){await route.fulfill({contentType:'text/css',body:'iframe{width:100%;height:900px}'});return;}
    if(modules.has(url.pathname)){await route.fulfill({contentType:'text/javascript',body:modules.get(url.pathname)});return;}
    if(url.pathname===reportPath){await route.fulfill({contentType:'application/json',body:JSON.stringify(snapshot)});return;}
    if(url.pathname===reportPath+'/html'){
      await route.fulfill({contentType:'text/html',headers:url.searchParams.has('download')?{'content-disposition':'attachment; filename="report.html"'}:{},body:htmlBytes});return;
    }
    unexpected.push(request.url());await route.abort();
  });
  await page.goto(origin+'/workspace/');
  return {page,errors,requests,unexpected};
}
async function downloadedBytes(download){
  assert.equal(await download.failure(),null,download.url());
  const chunks=[];for await(const chunk of await download.createReadStream())chunks.push(chunk);
  return Buffer.concat(chunks);
}

test('report preview avoids inherited CSP violations and preserves styles, media, links, downloads and accessible controls',async()=>{
  assert.match(csp,/style-src 'self'/);assert.doesNotMatch(csp,/unsafe-inline|nonce-/);
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  try {
    // Negative control proves this browser/policy observes the original bug.
    const original=await fixture(browser);
    const violation=original.page.waitForEvent('console',{predicate:message=>message.type()==='error'&&/inline style.*Content Security Policy/i.test(message.text())});
    await original.page.evaluate(source=>{
      const frame=document.createElement('iframe');frame.setAttribute('sandbox','allow-same-origin allow-downloads');document.body.append(frame);
      const doc=frame.contentDocument;doc.open();doc.write(source);doc.close();
    },html);
    await violation;await original.page.close();

    const {page,errors,requests,unexpected}=await fixture(browser);
    await page.evaluate(async()=>{
      const {renderReports}=await import('/workspace/reports.js');
      window.disposeReport=await renderReports({project:{project_id:'project-preview'},query:new URLSearchParams('report_id=report-preview'),
        showPage:value=>{document.querySelector('#page').innerHTML=value;},go:()=>{}});
    });
    await page.getByRole('status').filter({hasText:'报告预览已加载'}).waitFor();
    assert.equal(await page.locator('.report-preview').getAttribute('sandbox'),'allow-same-origin allow-downloads');
    assert.equal(await page.locator('.report-preview').getAttribute('title'),'固定快照报告预览');
    assert.equal(await page.locator('.report-preview').getAttribute('src'),null);
    assert.equal(await page.getByRole('status').getAttribute('aria-live'),'polite');
    assert.equal(await page.getByRole('button',{name:'重试加载预览'}).isVisible(),false);
    // Inspect through the same-origin parent, as the product does. Playwright's
    // injected frame helpers would themselves attempt scripts in this sandbox.
    const previewState=await page.evaluate(()=>{
      const frame=document.querySelector('.report-preview'),doc=frame.contentDocument;
      const style=selector=>frame.contentWindow.getComputedStyle(doc.querySelector(selector));
      return {lang:doc.documentElement.lang,title:doc.title,styles:doc.querySelectorAll('style').length,
        csp:doc.querySelector('meta[http-equiv="Content-Security-Policy"]').content,
        grid:style('.metrics').display,font:style('h1').fontSize,color:style('body').color,
        media:style('body').getPropertyValue('--preview-media').trim()};
    });
    assert.equal(previewState.lang,'zh-CN');assert.match(previewState.title,/报告 CSP 回归/);
    assert.equal(previewState.styles,0);assert.match(previewState.csp,/default-src 'none'/);
    assert.equal(previewState.grid,'grid');assert.equal(previewState.font,'30px');
    assert.equal(previewState.color,'rgb(23, 45, 67)');assert.equal(previewState.media,'screen');
    await page.emulateMedia({media:'print'});
    assert.deepEqual(await page.evaluate(()=>{
      const frame=document.querySelector('.report-preview'),doc=frame.contentDocument;
      return [frame.contentWindow.getComputedStyle(doc.body).getPropertyValue('--preview-media').trim(),frame.contentWindow.getComputedStyle(doc.querySelector('.report-nav')).display];
    }),['print','none']);
    await page.emulateMedia({media:'screen'});

    assert.ok(await page.evaluate(()=>{
      const frame=document.querySelector('.report-preview');frame.contentDocument.querySelector('.report-nav a[href="#cases"]').click();return frame.contentWindow.scrollY>0;
    }));
    assert.equal(page.url(),origin+'/workspace/');
    const imageState=await page.evaluate(async()=>{
      const doc=document.querySelector('.report-preview').contentDocument;
      doc.querySelector('details.media > summary').click();doc.querySelector('details.other-screenshots > summary').click();
      const image=doc.querySelector('.shot-preview img');await image.decode();
      const button=doc.querySelector('.shot-preview');button.click();
      return {src:image.src,alt:image.alt,label:button.getAttribute('aria-label'),open:Boolean(doc.querySelector('[popover]:popover-open'))};
    });
    assert.equal(imageState.src,imageUrl);assert.ok(imageState.alt);assert.equal(imageState.label,'放大：UI-1 · preview.png');assert.equal(imageState.open,true);
    const imageDownload=page.waitForEvent('download');await page.evaluate(()=>document.querySelector('.report-preview').contentDocument.querySelector('[popover] a[download]').click());
    const downloadedImage=await imageDownload;assert.equal(downloadedImage.suggestedFilename(),'preview.png');assert.deepEqual(await downloadedBytes(downloadedImage),png);
    const mediaState=await page.evaluate(()=>{
      const doc=document.querySelector('.report-preview').contentDocument;
      doc.querySelector('[popover]:popover-open .shot-close').click();const video=doc.querySelector('video');
      return {popover:Boolean(doc.querySelector('[popover]:popover-open')),src:video.src,preload:video.preload,controls:video.controls,label:video.getAttribute('aria-label')};
    });
    assert.deepEqual(mediaState,{popover:false,src:videoUrl,preload:'none',controls:true,label:'浏览器窗口录像'});
    const traceDownload=page.waitForEvent('download');await page.evaluate(()=>{
      const link=document.querySelector('.report-preview').contentDocument.querySelector('a[download="trace.zip"]');
      for(let parent=link.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;
      link.click();
    });
    assert.deepEqual(await downloadedBytes(await traceDownload),trace);

    assert.equal(await page.getByRole('link',{name:'在新标签页打开报告',exact:true}).getAttribute('href'),reportPath+'/html');
    const reportLink=page.getByRole('link',{name:'下载离线 HTML 报告',exact:true});
    assert.equal(await reportLink.getAttribute('href'),reportPath+'/html?download=1');
    assert.equal(await reportLink.getAttribute('download'),'');
    // A network attachment download cannot be fulfilled reliably by this offline
    // route fixture. Check its unchanged endpoint/bytes here; the official 4322
    // driver performs the real HTML download separately.
    const downloadedReport=Buffer.from(await reportLink.evaluate(async link=>Array.from(new Uint8Array(await (await fetch(link.href)).arrayBuffer()))));
    assert.deepEqual(downloadedReport,htmlBytes);assert.equal(createHash('sha256').update(downloadedReport).digest('hex'),beforeHash);
    assert.equal(requests.filter(request=>request.path===reportPath+'/html').length,2);
    assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);
    await page.evaluate(()=>window.disposeReport());await page.close();
  } finally {await browser.close();}
});
