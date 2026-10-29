import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import {execFile} from 'node:child_process';
import {nativeDshPackage,NATIVE_DSH_VERSION} from '../scripts/native-dsh-package.mjs';
const root=path.resolve(fileURLToPath(new URL('../..',import.meta.url))),exec=promisify(execFile);

test('packaged CMD entries parse after codepage switching for LF, BOM and repeated CR input',async t=>{
  const dir=await temporary(t);
  const source=String.raw`import importlib.util,os,re,subprocess,sys
from pathlib import Path
p=Path('workbench/scripts/package-candidate.py');s=importlib.util.spec_from_file_location('candidate',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
content=m.collect()
for name in ['配置模型密钥.cmd','启用模型工作台.cmd','启动.cmd','诊断模型启动.cmd']:
 data=content[name]
 assert not data.startswith(b'\xef\xbb\xbf') and not re.search(rb'(?<!\r)\n',data),name
 raw=Path(name).read_bytes().replace(b'\r\n',b'\n')
 for index,variant in enumerate([raw,b'\xef\xbb\xbf'+raw,raw.replace(b'\n',b'\r\r\n')]):
  normalized=m.windows_cmd_bytes(variant)
  assert not normalized.startswith(b'\xef\xbb\xbf') and not re.search(rb'(?<!\r)\n',normalized)
  text=normalized.decode('utf-8')
  text,count=re.subn(r'^"%AGENT_NODE%"[^\r\n]+', 'echo CMD_ENTRY_OK',text,flags=re.M)
  assert count==1,name
  text=text.replace('pause','rem pause disabled for parsing probe')
  file=Path(sys.argv[1])/('解析 '+str(index)+'.cmd');file.write_bytes(text.encode('utf-8'))
  result=subprocess.run([os.environ['COMSPEC'],'/d','/c',str(file)],capture_output=True,timeout=10)
  assert result.returncode==0 and b'CMD_ENTRY_OK' in result.stdout and not result.stderr,(name,index,result.returncode,result.stderr)
print('12 CMD parsing probes passed; no credential or service process launched')`;
  const result=await exec('python',['-B','-X','utf8','-c',source,dir],{cwd:root,timeout:60000});
  assert.match(result.stdout,/12 CMD parsing probes passed/);
});
async function temporary(t){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'native-install-delivery-'));t.after(async()=>{assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('native-install-delivery-'));await fs.rm(dir,{recursive:true,force:true});});return dir;}
test('native package identity is pinned in its independent local lock and runs offline',async()=>{
  const identity=await nativeDshPackage(root);assert.equal(identity.version,NATIVE_DSH_VERSION);assert.equal(identity.binary,path.join(root,'workbench/native/node_modules/@deepseek-ai/dsh/lib/bin.js'));
  const result=await exec(process.execPath,[identity.binary,'--version'],{timeout:15000,windowsHide:true});assert.match(result.stdout,/0\.2\.0-rc\.2/);
});
test('a missing or mismatched package fails without finding a user private CLI',async t=>{
  const dir=await temporary(t);await assert.rejects(nativeDshPackage(dir),/NOT_INSTALLED/);
  const own=path.join(dir,'workbench/native'),installed=path.join(own,'node_modules/@deepseek-ai/dsh');await fs.mkdir(path.join(installed,'lib'),{recursive:true});
  for(const name of ['package.json','package-lock.json'])await fs.copyFile(path.join(root,'workbench/native',name),path.join(own,name));
  await fs.writeFile(path.join(installed,'package.json'),JSON.stringify({name:'@deepseek-ai/dsh',version:'0.1.6-alpha.2',bin:{dsh:'lib/bin.js'}}));await fs.writeFile(path.join(installed,'lib/bin.js'),'synthetic');
  await assert.rejects(nativeDshPackage(dir),/VERSION_MISMATCH/);
  const lock=JSON.parse(await fs.readFile(path.join(own,'package-lock.json'),'utf8'));lock.packages['node_modules/@deepseek-ai/dsh'].version='0.1.6-alpha.2';await fs.writeFile(path.join(own,'package-lock.json'),JSON.stringify(lock));
  await assert.rejects(nativeDshPackage(dir),/LOCK_MISMATCH/);
  lock.packages['node_modules/@deepseek-ai/dsh'].version=NATIVE_DSH_VERSION;lock.packages['node_modules/private-workspace']={link:true,resolved:'../..'};await fs.writeFile(path.join(own,'package-lock.json'),JSON.stringify(lock));
  await assert.rejects(nativeDshPackage(dir),/LOCK_MISMATCH/);
});
test('source candidate binds release version, required native files and excludes private data',async t=>{
  const dir=await temporary(t),archive=path.join(dir,'candidate.zip');
  const result=await exec('python',['-B','-X','utf8','workbench/scripts/package-candidate.py','--output',archive],{cwd:root,timeout:60000});
  const checked=JSON.parse(result.stdout),release=JSON.parse(await fs.readFile(path.join(root,'workbench/release.json'),'utf8'));assert.equal(checked.release_version,release.version);
  const source=`import json,sys,zipfile\nwith zipfile.ZipFile(sys.argv[1]) as z:\n m=json.loads(z.read('candidate-manifest.json'));names=set(z.namelist())\n assert m['release']==json.loads(z.read('workbench/release.json'))\n for n in ['workbench/native/package.json','workbench/native/package-lock.json','workbench/scripts/native-dsh-package.mjs','workbench/server/native-dsh/imported-source.mjs']:assert n in names,n\n assert not any('/.local/' in n or '/node_modules/' in n or n.startswith(('workbench/qa/','docs/requirements/')) or n.endswith('.dpapi') for n in names)\n print(len(names))`;
  const files=await exec('python',['-B','-c',source,archive],{cwd:root});assert.ok(Number(files.stdout)>100);
  const dependencyCheck=`import json,sys,zipfile\nfrom pathlib import Path\nwith zipfile.ZipFile(sys.argv[1]) as z:\n assert z.read('workbench/web-v2/test-case-template.xlsx')==Path('workbench/web-v2/test-case-template.xlsx').read_bytes()\n p=json.loads(z.read('package.json'));assert p['dependencies']['@offline/device-license']=='file:vendor/device-license'\n assert json.loads(z.read('vendor/device-license/package.json'))['version']=='0.2.0'\n for n in ['core/verify.mjs','bin/DeviceLicense.dll','bin/DeviceLicense.Bridge.exe']:assert z.read('vendor/device-license/'+n)==Path('vendor/device-license',n).read_bytes()\n`;
  await exec('python',['-B','-c',dependencyCheck,archive],{cwd:root});
});

test('candidate local dependency validation rejects missing, external and mismatched archive links',async()=>{
  const source=`import importlib.util,json\nfrom pathlib import Path\np=Path('workbench/scripts/package-candidate.py');s=importlib.util.spec_from_file_location('candidate',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)\nbase=m.collect();m.validate_local_dependencies(base)\nfor mode in ['outside','missing','version','template']:\n c=dict(base)\n if mode=='outside':\n  p=json.loads(c['package.json']);p['dependencies']['@offline/device-license']='file:../device-license';c['package.json']=json.dumps(p).encode()\n if mode=='missing':del c['vendor/device-license/package.json']\n if mode=='version':\n  p=json.loads(c['vendor/device-license/package.json']);p['version']='wrong';c['vendor/device-license/package.json']=json.dumps(p).encode()\n if mode=='template':del c['workbench/web-v2/test-case-template.xlsx']\n try:m.validate_local_dependencies(c)\n except ValueError as e:assert str(e).startswith('PACKAGE_'),str(e)\n else:raise AssertionError(mode+' accepted')\nprint('4 dependency boundaries rejected')`;
  const result=await exec('python',['-B','-c',source],{cwd:root,timeout:60000});assert.match(result.stdout,/4 dependency boundaries rejected/);
});
test('source candidate rejects conflicting release metadata even when its source records match',async t=>{
  const dir=await temporary(t),archive=path.join(dir,'candidate.zip'),bad=path.join(dir,'bad.zip');
  await exec('python',['-B','workbench/scripts/package-candidate.py','--output',archive],{cwd:root,timeout:60000});
  const change=`import json,sys,zipfile\nwith zipfile.ZipFile(sys.argv[1]) as a,zipfile.ZipFile(sys.argv[2],'x') as b:\n for n in a.namelist():\n  data=a.read(n)\n  if n=='candidate-manifest.json':\n   m=json.loads(data);m['release']['version']='wrong-version';data=json.dumps(m).encode()\n  b.writestr(n,data)`;
  await exec('python',['-B','-c',change,archive,bad],{cwd:root});
  await assert.rejects(exec('python',['-B','workbench/scripts/package-candidate.py','--verify',bad],{cwd:root}),error=>error.stderr.includes('PACKAGE_RELEASE_MISMATCH'));
});
test('portable dependency copier preserves native runtime bytes, rejects version drift and omits nested modules',async t=>{
  const dir=await temporary(t);
  const source=`import importlib.util,json,sys\nfrom pathlib import Path\np=Path('workbench/scripts/package-portable.py');s=importlib.util.spec_from_file_location('portable',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)\nbase=Path(sys.argv[1]);root=base/'fixture';stage=base/'stage';own=root/'workbench/native';pkg=own/'node_modules/@deepseek-ai/dsh';(pkg/'lib').mkdir(parents=True)\nmanifest=pkg/'package.json';manifest.write_text(json.dumps({'name':'@deepseek-ai/dsh','version':'0.2.0-rc.2'}))\n(pkg/'lib/bin.js').write_bytes(b'controlled native executable fixture')\n(pkg/'node_modules/ignored').mkdir(parents=True);(pkg/'node_modules/ignored/file').write_bytes(b'not copied')\n(own/'package-lock.json').write_text(json.dumps({'packages':{'node_modules/@deepseek-ai/dsh':{'version':'0.2.0-rc.2','integrity':'fixture'}}}))\nrecords,components=m.copy_dependencies(stage,root,'workbench/native')\nassert records==[{'path':'workbench/native/node_modules/@deepseek-ai/dsh','version':'0.2.0-rc.2','lock_integrity':'fixture'}]\nassert (stage/'workbench/native/node_modules/@deepseek-ai/dsh/lib/bin.js').read_bytes()==(pkg/'lib/bin.js').read_bytes()\nassert not (stage/'workbench/native/node_modules/@deepseek-ai/dsh/node_modules').exists()\nassert not components\nmanifest.write_text(json.dumps({'name':'@deepseek-ai/dsh','version':'wrong'}))\ntry:m.copy_dependencies(base/'rejected',root,'workbench/native')\nexcept ValueError as e:assert 'VERSION_MISMATCH' in str(e)\nelse:raise AssertionError('version drift accepted')\nprint(json.dumps({'dependencies':len(records)}))`;
  const result=await exec('python',['-B','-X','utf8','-c',source,dir],{cwd:root,timeout:30000,maxBuffer:1024*1024});assert.equal(JSON.parse(result.stdout).dependencies,1);
});
