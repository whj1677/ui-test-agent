import {types} from 'node:util';
import {structuredAssertion} from '../build/step-observer.mjs';

const supported=new Set(['toHaveText','toHaveValue','toHaveClass','toHaveCount','toBeVisible','toBeEnabled','toBeDisabled']);
function method(object,name){
  if(!object || types.isProxy(object))return null;
  for(let p=object,n=0;p && n++<8;p=Object.getPrototypeOf(p)){
    const d=Object.getOwnPropertyDescriptor(p,name);
    if(d)return typeof d.value==='function'?d.value:null;
  }
  return null;
}

// Public, read-only Locator calls after the original matcher settles. This is
// a separately timestamped DOM observation, never a replacement matcher result.
export async function observeLocatorActual(locator,matcher,args,flags={}){
  if(!supported.has(matcher) || flags.resolves || flags.rejects)return null;
  const evaluateAll=method(locator,'evaluateAll'),toString=method(locator,'toString');
  if(!evaluateAll)return null;
  const started_at=new Date().toISOString();
  let timer;
  try{
    const read=async()=>{
      const data=await evaluateAll.call(locator,(nodes,options)=>{
        const el=nodes[0];
        const sensitive=nodes.some(n=>n.matches?.('input[type=password]') || /password|passwd|secret|token|cookie|authorization|api.?key|credential/i.test(`${n.getAttribute?.('name')||''} ${n.id||''}`));
        if(sensitive)return {sensitive:true};
        const labels=el?.labels?Array.from(el.labels).map(n=>n.textContent.trim()).join(' / '):'';
        const label=el?.getAttribute?.('aria-label') || labels || el?.closest?.('section,form')?.querySelector?.('h2,h3')?.textContent?.trim() || el?.tagName?.toLowerCase() || '页面元素';
        let actual;
        if(options.matcher==='toHaveText'){
          const values=nodes.map(n=>options.innerText?n.innerText:n.textContent);
          actual=options.array?values:values.length===1?values[0]:values;
        }else if(options.matcher==='toHaveValue')actual=nodes.length===1&&'value' in el?el.value:undefined;
        else if(options.matcher==='toHaveClass'){
          const values=nodes.map(n=>n.getAttribute('class')||'');actual=options.array?values:values.length===1?values[0]:values;
        }else if(options.matcher==='toHaveCount')actual=nodes.length;
        return {actual,label:label.slice(0,100),node_count:nodes.length,
          display_value:el?.tagName==='SELECT'?Array.from(el.selectedOptions).map(n=>n.textContent.trim()).join(' / '):null};
      },{matcher,array:Array.isArray(args[0]),innerText:Boolean(args[1]?.useInnerText)});
      if(data.sensitive)return {reason:'SENSITIVE_LOCATOR_VALUE_NOT_CAPTURED'};
      if(matcher==='toBeVisible'){
        const isVisible=method(locator,'isVisible');
        if(!isVisible)return null;
        data.actual=await isVisible.call(locator);
      }
      if(matcher==='toBeEnabled'||matcher==='toBeDisabled'){
        const isEnabled=method(locator,'isEnabled');if(!isEnabled)return null;
        const enabled=await isEnabled.call(locator);data.actual=matcher==='toBeDisabled'?!enabled:enabled;
      }
      const safe=structuredAssertion({matcherResult:{name:matcher,actual:data.actual}});
      if(!safe?.actual_complete)return {reason:'LOCATOR_VALUE_NOT_SAFE_OR_AVAILABLE'};
      const target=toString?toString.call(locator):'Locator';
      return {actual:safe.actual,value_source:'PLAYWRIGHT_LOCATOR_OBSERVATION',
        observed_at:new Date().toISOString(),observation_started_at:started_at,observation_phase:'AFTER_MATCHER',
        target:String(target).slice(0,300),target_label:data.label,node_count:data.node_count,
        ...(data.display_value?{display_value:data.display_value}:{})};
    };
    return await Promise.race([read(),new Promise(resolve=>{timer=setTimeout(()=>resolve({reason:'LOCATOR_OBSERVATION_TIMEOUT'}),500);})]);
  }catch{return {reason:'LOCATOR_OBSERVATION_UNAVAILABLE'};}
  finally{clearTimeout(timer);}
}
