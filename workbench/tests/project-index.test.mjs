import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source = await fs.readFile(new URL('../web-v2/app.js',import.meta.url),'utf8');
const start = source.indexOf('function projectContentState(');
const end = source.indexOf('function renderProjects(',start);
const scope = vm.createContext({});
vm.runInContext(source.slice(start,end),scope);
const select = (projects, options = {}) => scope.selectProjectPage(projects,{query:'',filter:'all',sort:'updated',page:1,pageSize:10,...options});
const projects = Array.from({length:62},(_,i)=>({project_id:`p-${String(i).padStart(2,'0')}`,name:`测试项目${i}`,description:i===61?'跨页关键词':'',updated_at:'2026-10-27',cases:i===0?[]:[{status:i%2?'CONFIRMED':'PENDING_CONFIRMATION'}]}));

test('pagination has no omissions or duplicates with equal update times, without changing the source order',()=>{
  const before = JSON.stringify(projects);
  const ids = Array.from({length:7},(_,i)=>select(projects,{page:i+1}).items).flat().map(p=>p.project_id);
  assert.equal(ids.length,62); assert.equal(new Set(ids).size,62);
  assert.equal(JSON.stringify(projects),before);
  assert.equal(select(projects,{page:7}).items.length,2);
});
test('search covers projects outside the current page and clamps stale pagination after filtering',()=>{
  const result = select(projects,{query:'  跨页关键词  ',page:7});
  assert.equal(result.total,1); assert.equal(result.page,1); assert.equal(result.items[0].project_id,'p-61');
  const missing = select(projects,{query:'不存在',page:7});
  assert.equal(missing.total,0); assert.equal(missing.page,1); assert.equal(missing.pages,1);
});
test('content filters keep empty projects distinct from pending confirmation and preserve all projects',()=>{
  const groups = ['empty','pending','confirmed'].map(filter=>select(projects,{filter,pageSize:100}).items);
  assert.equal(groups[0].length,1); assert.equal(groups.flat().length,62);
  assert.equal(new Set(groups.flat().map(p=>p.project_id)).size,62);
  assert.ok(groups[1].every(p=>p.cases.some(c=>c.status!=='CONFIRMED')));
});
