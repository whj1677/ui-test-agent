
import test from 'node:test';
import assert from 'node:assert/strict';
import { assembleProjectCaseInput } from '../server/build/project-case.mjs';
import { inspectWorkbook, parseWorksheet } from '../server/cases/excel.mjs';
import { fileURLToPath } from 'node:url';
test('historical spreadsheet fields stay out of frozen model input without changing case oracle', () => {
 const item={case_id:'case-qa',root_source:{type:'csv',stable_id:'csv:sha:sheet:2',source_fields:{'实际结果':'HISTORICAL_PASS_ONLY','测试步骤':'旧动作'}},lineage:[]};
 const content={external_id:'QA-1',title:'QA',preconditions:'',module:'',test_data:'',status:'CONFIRMED',steps:[{order:1,action:'点击查询',expected:'显示确认的预期'}]};
 const result=assembleProjectCaseInput({project:{project_id:'project-qa',name:'QA'},item,versionRecord:{version:1,content_sha256:'A'.repeat(64),content},environmentDefinition:{environment_id:'qa',public:{template_id:'qa',version:1,allowed_entry:{kind:'registered-user-target'},candidate_contract:{test_count:1}},internal:{binding:{kind:'registered-user-target'},verification:{}}},frozenAt:'2026-10-09T00:00:00Z'});
 assert.deepEqual(result.input_bundle.snapshot.content,content);
 assert.equal(result.source.root_source.stable_id,item.root_source.stable_id);
 assert.equal(result.source.root_source.source_fields,undefined);
 assert.equal(item.root_source.source_fields['实际结果'],'HISTORICAL_PASS_ONLY');
 assert.doesNotMatch(result.initial_files.map(f=>f.content).join('\n'),/HISTORICAL_PASS_ONLY|source_fields/);
});
test('engineer template is readable with a blank main sheet and complete automatic mapping',async()=>{
 const file=fileURLToPath(new URL('../web-v2/test-case-template.xlsx',import.meta.url));
 const {sheets}=await inspectWorkbook(file);
 assert.equal(sheets[0].name,'用例填写');assert.equal(sheets[0].row_count,0);
 assert.equal(sheets[0].headers.length,12);assert.deepEqual(sheets[0].mapping_issues,[]);
 assert.equal(sheets[0].suggested_mapping.expected,'预期结果');
 assert.equal(sheets[0].suggested_mapping.status,'内容状态');
 assert.equal(sheets[0].suggested_mapping.case_type,'用例层级');
 const parsed=await parseWorksheet(file,{sheet_name:sheets[0].name,mapping:sheets[0].suggested_mapping,upload_sha256:'A'.repeat(64),file_name:'测试用例模板.xlsx'});
 assert.deepEqual(parsed.rows,[]);
});

