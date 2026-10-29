export async function backendRoute({request,response,url,manager,sendJson,readJsonBody,trustedMutation}) {
  const match=url.pathname.match(/^\/api\/case-library\/projects\/([^/]+)\/backend(?:\/(environments|plans|preparation|generation-batches)(?:\/((?:plan|generation)-[a-f0-9-]{36})(?:\/(confirm|cancel))?)?)?$/);
  if(!match||!manager)return false;
  const [project,kind,id,action]=match.slice(1).map(x=>x&&decodeURIComponent(x));
  try {
    if(request.method==='GET'){sendJson(response,200,kind==='preparation'?await manager.preparation(project,{protocol_source_id:url.searchParams.get('protocol_source_id')||undefined}):kind==='generation-batches'?(id?await manager.generationBatches.get(project,id):{batches:await manager.generationBatches.list(project)}):id?await manager.get(project,id):await manager.list(project,url.searchParams.get('case_id')));return true;}
    if(request.method!=='POST'){sendJson(response,405,{error:'METHOD_NOT_ALLOWED'});return true;}
    if(!trustedMutation(request)){sendJson(response,403,{error:'UNTRUSTED_LOCAL_ORIGIN'});return true;}
    const body=await readJsonBody(request,256*1024);
    const result=kind==='generation-batches'?(action==='cancel'?await manager.generationBatches.cancel(project,id):!id?await manager.generationBatches.create(project,body):null):kind==='environments'?await manager.registerEnvironment(project,body):kind==='plans'&&!id?await manager.create(project,body):action==='confirm'?await manager.confirm(project,id,body):action==='cancel'?await manager.cancel(project,id):null;
    if(!result)throw Error('BACKEND_ROUTE_INVALID');sendJson(response,200,result);
  }catch(e){sendJson(response,/CONFLICT|BUSY/.test(e.message)?409:422,{error:e.message});}
  return true;
}
