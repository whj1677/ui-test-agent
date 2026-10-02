"""Render scoped local review documents from this task's actual audit artifacts."""
import collections
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent


def load(name):
    return json.loads((OUT/name).read_text(encoding='utf-8-sig'))


def write(name, text):
    (OUT/name).write_text(text.rstrip()+'\n',encoding='utf-8')


inventory = load('required-file-inventory.json')
gates = load('governance-statements-v39.json')
now_gates = load('governance-statements.json')
mixed = load('mixed-50-file-review.json')
before_status = json.loads((ROOT/'.git/release-engineering-20261002/before.json').read_text(encoding='utf-8'))
delivery = ROOT/'docs/requirements/REQ-0038-requirements-and-protocol-test-input/delivery_evidence.md'

lines = ['# 五项原拒绝的精确范围', '',
         '审计快照：原 HEAD 54b7d0a；REQ0015 v2，REQ0038 v39。当前事实更正为 REQ0038 v40。原五项拒绝日志 `.git/trim-contains-governance-final.log` 保留。', '',
         '检查器不变。`check_pass_claim_text` 第1278行将“有效文档中任一成功断言”与“有效文档中任一失败词”做全文合取；不按 VT、命令、版本或运行配对。`actual_verification_text` 第1299行选择实际部分或按预期标记过滤。原文、精确列号、原始文件SHA和来源字段见 governance-statements-v39.json；v40见 governance-statements.json。', '',
         '| 拒绝 | 原文件 / 版本 | 成功命中行 | 失败命中行与词 |', '|---|---|---|---|']
for i,d in enumerate(gates['documents'],1):
    positive=', '.join(str(r['line'])+((' '+r['verification_id']) if r['verification_id'] else '') for r in d['asserted_pass_rows'])
    negative=', '.join(str(r['line'])+' '+('/'.join(m['term'] for m in r['matches'])) for r in d['failure_term_rows'])
    lines.append(f"| {i} | {d['path']} / v{d['source_version']} | {positive} | {negative} |")
lines += ['', '## 原始命令与范围', '',
          'REQ0015：第12–14行 / current_state第51–53行的状态“集成测试通过”对应 `node --test --test-reporter=tap manual-lab/verify.test.mjs`。原日志 validation/REQ-0015-lab-second.log 为26项、26成功、0失败、0跳过；源码实际使用 Chromium，覆盖旧合成站、输入包和展示。不是生成Agent的24例。', '',
          '同包第15行 / current_state第54行命中原句“退出码：1；测试数量：24；失败数量：12”。对应 `node workbench/qa/20260925-kimi-complex/verify.mjs`、2026-09-25T03-04-13-091Z/results.json。主管解析原JSON实际24条，12 PASSED、12 FAILED。它是新Kimi复杂页面执行，文档已明确保留失败。进程exit 1来自原v2事实源记录；本轮没有重新执行旧命令，也不补猜当时未记录的软件版本。', '',
          'REQ0038：v39第17行原句“VT-0038-06 … 集成测试通过”是v29最新报告范围；第18行VT07同状态覆盖的声明包含单目标简化选择，但原 REPORT.md 明确“单选项自动选择/隐藏分支仅代码核对”。此处存在范围过宽，按真实源更正为“人工待确认”，附“部分验收”范围说明，原证据逐字保留。', '',
          '第15行“错误断言/500/超时/取消”、第16行“协议定义的异步超时/清理”是故障验证类别；第37行VT26的“500/超时/取消与延迟后精确清理”是被执行的注入故障验证，不能据失败词把它等同产品意外故障，也不能删去该类别逃避门禁。', '',
          '第30行VT19原句“900秒超时，未完成同hash复审/独立验证；不确认、不借旧审查”是真实未完成任务。namespace-skills13-current.json 的 generation_session.status=FAILED、error=BACKEND_HARNESS_TIMED_OUT，started_at=07:54:21.864Z、finished_at=08:09:22.626Z，间隔900.762秒。两次自测成功不能代替末次候选的同SHA审查和独立验证。', '',
          '第34行VT23保留同一旧P3超时；第38行VT27记录10次正式运行中1次超时；第64行保留旧299项首轮298成功/1失败，backend-dsh-config-response-unit.log 的TAP确为299/298/1/0，后续backend-dsh-config-response-recheck.log为299/299/0/0。首次失败未删除，后续成功不覆盖首次。第80、81行是v34/v35历史叙述，包含注入超时和上述实际生成超时；不把当前v40当作当时产物版本。', '',
          '结构化验证日志的每个路径、实际SHA、TAP计数见 governance-statements-v39.json / original-timeout-proofs.json；其中558项日志只复用 unit-delivery-closeout.log，未再执行。', '',
          '## 第五项：混合归属', '',
          'checker第529–536行在发现 record_count > 1 时拒绝；命中记录原句为“Changed records: REQ-0037-autonomous-candidate-development, REQ-0038-requirements-and-protocol-test-input, REQ-0039-windows-device-license, REQ-0040-managed-workbench-restart”。', '',
          '50文件原清单逐项复用，并在 mixed-50-file-review.json 增补当前SHA、HEAD→磁盘精确hunk和本机完整patch路径。其中46项仍与原清单字节一致，4项只增加本轮REQ0038的已证明事实更正。4个REQ的完整历史归属尚未确认；源码/ZIP的字节一致不证明代码作者或授权归属。', '',
          'REQ0015当前没有证明需改变的事实：本轮对其的最小实际diff为0。需要治理责任方确认如何独立表达上述两个历史范围；仅加范围说明仍会触发全文合取，不能承诺可消除拒绝。本轮不改其真实源、视图或checker。', '',
          'REQ0038本轮实际diff只有 REQ0038-v39-to-v40.patch；不是HEAD→当前完整REQ的差异。后者含大量此前工作，不能把它与本轮事实更正一起整文件入库。', '',
          '## 收集器边界', '',
          f'现有REQ0038 delivery_evidence.md 为 {delivery.stat().st_size} 字节，SHA {hashlib.sha256(delivery.read_bytes()).hexdigest()}。collect_delivery_evidence.py第406–409行对REQ整文件原子重写，会替换当前混合证据。为遵守保留原文件、失败和他人修改，本轮未运行该写入收集器；不是正式交付链完成。sync已限定REQ0038执行，视图与事实源一致；check直接只读执行。', '',
          '首份更正稿使用了不在现有枚举中的详细状态，governance-before-archive.log另记录该拒绝和本轮未归档文件拒绝；已用既有“人工待确认”枚举，将部分范围说明放回证据字段。该失败日志保留，不修改状态枚举。']
write('五项门禁追溯.md','\n'.join(lines))

lines=['# 必要文件的逐项审阅清单','',
       f"快照HEAD：{inventory['head']}。已知必要集合为{len(inventory['files'])}个项目内文件：候选显式/静态导入闭包229项、服务fingerprint项目内输入249项、现有558工程清单77项及其文件引用/构建入口。维度重叠，不相加。外部授权组件10项及674个lock条目单独列出。",'',
       '静态集合不等于已证实全部动态运行依赖。干净检出已遇到实际缺失模块，未安装依赖或开启第二工作台，不能据清单宣称整机可运行。完整SHA、角色、来源和单文件patch路径见 required-file-inventory.json。', '',
       '| 文件 | Git状态 | 归属证据 | 磁盘SHA前12位 |', '|---|---|---|---|']
for r in inventory['files']:
    lines.append(f"| {r['path']} | {r['state']} | {r.get('authorship','未知')} | {r.get('disk_sha256','')[:12]} |")
lines += ['', 'IN_HEAD_CHECKOUT_EOL_DIFFERENCE 表示Git语义未修改、原blob与Windows工作区换行不同；它不计入67项业务修改。隔离检出中197项字节不同亦含正常换行转换，不能全部称产品代码修改。', '',
          '153项不在HEAD，67项是Git实际修改。缺失典型项：quality-review.mjs、backend/execution.mjs、requirements/manager.mjs、portable构建器、WindowsCredential.cs；修改典型项：正式启动脚本、server/index.mjs、package/lock、batches、workflow等。不能仅纳入主入口忽略其依赖。', '',
          '三份lock原样列出674条依赖声明（包含不同安装根和dev条目，不能当独立依赖或已安装数）；根lock通过 file:../device-license 依赖外部组件。本轮没有npm安装。外部组件四个构建输入的当前SHA在 external-component-inputs.json；组件自身非Git仓库，现有SDK/DLL哈希一致不等于其完整源码版本已交付。', '',
          '敏感内容筛查覆盖集合中每个文件：未命中API key形状或完整私钥块。7个测试文件命中credential_assignment；已限定为合成凭据/脱敏哨兵及stub上下文，均属于未确认归属集合，本轮不提交它们。此筛查不是全产品凭据安全验收。配置、会话、真实业务数据、.local、依赖树及573MB候选ZIP不入提交。', '',
          'R4的20文件增量中，仅 generation-plan.mjs 的“R4_ADDITION_NOT_PRESENT_PRE_R4”能证明整个文件是当前REQ新增；其SHA与原169归档after一致，已单文件归档67ead28。其余19文件只证明当前增量；更早正文或closeout前测试正文归属不明，保留而不纳入。']
write('必要文件逐项审阅.md','\n'.join(lines))

write('剩余范围与确认项.md','''# 精确剩余输入

本轮不会继续扩功能、模型调用或治理修改。

1. 当前必要集合中的153项缺失和67项修改：需要旧实现负责人逐组确认基线、作者/来源及对应REQ；精确路径/SHA/patch位于必要文件逐项审阅.md和required-file-inventory.json。确认前不整文件入库。50项治理文档同样需分离REQ0037/0038/0039/0040；本轮4个事实更正不授权覆盖旧历史。
2. 治理责任方需明确既有成功记录、注入故障测试和独立历史失败如何按验证范围治理。当前checker使用全文合取，五项拒绝保留；本轮没有获准修改checker，也不把抹去历史或全量降级成未运行作为方案。REQ0015本轮事实diff为0。
3. 干净Git复现还需要可版本化提供@offline/device-license 0.2.0 / 1.0.0-rsa的完整SDK、DLL、构建源和公共信任资料；根lock的../device-license不是随本项目检出自动获得的依赖。不得提供发行者私钥或用户凭据。包内已有依赖不能证明源码构建闭环。
4. stage跨进程读取差异根因仍未知。只复用协调器1797/2821字节证据，不改安全软件、代理、权限，不猜产品根因；ZIP一致不算stage修复。
5. 原生URL识别停止仍未验；需要可可信识别专用业务窗口的获准工具/环境再验，不绕过。第二台干净Windows当前不存在，安装、密钥和授权客户机验收继续NOT_RUN。

真实模型语义效果也仍未验；本轮用户明确禁止重跑模型，因此不将6项纯离线模块检查、旧558项、归档校验或源码/ZIP对应称作模型语义验收。
''')
print('rendered three bounded review documents; original REQ0015 and delivery evidence not written')
