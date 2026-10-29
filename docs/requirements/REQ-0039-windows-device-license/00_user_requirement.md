<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0039 用户需求

## 原始输入

> 现在还有点额度，你直接把剩下的事情给干干吧。然后我们这个程序你想想怎么把整个程序给打包。然后我们还要做一个组件就是先采集使用者的硬件信息，我们有一个密钥生成，我们先拿到一个用户信息然后生成一个密钥，密钥输出一次以后永久保存再使用者的电脑，如果程序换了硬件环境我们程序就起不来。补充：绑定主板身份；换主板需重新授权，升级内存、硬盘不影响。考虑DeepSeek/Harness有无安装及路径不同；所需环境一起打包，包大没关系。

## 结构化理解

| UN | 状态 | 目标 | 约束 | 成功标准 |
|---|---|---|---|---|
| UN-0039-01 | 已确认 | 提供自带运行环境的Windows便携包，以及主板绑定的离线永久授权；用户首次提交设备申请并导入发行者签发的许可，以后本机自动验证。 | 仅主板绑定；不将开发机模型密钥、用户资料、签发私钥和绝对路径打包；正式功能测试只用4322原工作台。 | 自带Node/Harness/插件/浏览器；无全局Node/Harness依赖；本机授权后重启可用，换主板/篡改/缺授权业务不可启动；真实界面及产物检查证据明确。 |

## 已确认事实

- 用户同意主板身份绑定，升级内存或硬盘不锁定，换主板由拥有者重新签发。
- 授权永久有效，仅本地校验；DeepSeek调用仍需使用者自己的API密钥和网络。
- 现有source-only打包器不是完整环境包，当前源码资源闭包须修复。
- 剩余DOCX内嵌PNG/JPEG补齐归REQ-0038，不将客户资料缺失伪装成产品验证。
- 用户要求授权模块作为独立组件供其他Agent链接复用；独立工程device-license，不把通用实现埋入本工作台。
- 用户进一步明确DLL形式独立组件；采用.NET Framework DLL，Node通过本地进程桥直接加载，不需要授权服务器。
- 已构建完整Windows x64便携r2候选：573128787字节，SHA256 706857c5de4d7552a927026a4277aceea9e3e1327c6b77c142ce7b27f145db84。Node22.19.0、三组602条锁定依赖、Harness固定插件、Chromium151与录像工具齐全；30587文件摘要及排密独立检查一致，包内固定required:true公开信任根。
- 本机实际包内Node/PATH排除全局Node及Harness，在中文空格新目录与同副本改名后两次执行完整性诊断、离线profile初始化、插件解析、真实Chromium截图和录像；未启动第二个工作台或业务模型。证据workbench/qa/20260926-portable/node-environment-r2/result.json与relocated-environment-r2/result.json。
- 正式4322真实浏览器完成同意采集、设备申请、坏签名拒绝、生产密钥签发导入、错误替换保留原许可、原配置重启自动授权。主管独立四项只读检查确认源码与独立SDK十文件摘要、原配置/数据根与10项目；该证据不等于客户便携包跨机业务验收。
- 独立device-license组件0.2.0实际.NET Framework托管DLL与本地Bridge，RSA3072/exponent65537/SHA256-PKCS1；18项实际DLL机制检查成功，包括真实主板与C#直接引用。错主板是签名合法的模拟摘要反例，不是实体换板。私钥为发行方DPAPI保护且不入包，客户只带公钥。
- Windows PowerShell5.1读取Node UTF-8中文路径的编码缺陷已修复，新增实际回归；包装机制7项成功、0失败跳过。原候选Python写盘后跨进程字节不同的诊断失败保留，根因未确认；原ZIP的唯一Node对照后完整摘要一致，r2沿用同方法，未改变系统保护或放宽完整性规则。
- 本轮DOCX正式浏览器仅1次deepseek-flash请求4412tokens，0次Harness；JPEG观察与追溯正常，但候选提前校验句没有原文依据，保留待审未确认，详见REQ0038 v12及DOCX报告。
- 最终collector实际运行npm --prefix workbench test，233项成功、0失败跳过，测试退出0；collector因治理检查返回1。检查仍含REQ0015两处历史矛盾及本次REQ0038/0039混合需求规则，未改历史/门禁或合并范围。证据workbench/qa/20260926-packaged-license/unit-tests.log与本REQ delivery_evidence.md。git diff --check实际退出0。
- 2026-09-27首次路径复核：单独调用ensureHarnessRuntime且profile未准备时存在pnpm分支，但正式portable启动和启用模型入口均先调用setup-runtime.ps1，离线声明两插件并创建指向包内依赖的受管junction。旧verify-installed实际执行该入口准备并核对插件解析路径。因此此前“默认客户首次需要pnpm”的阶段性判断不成立，已叫停额外bootstrap改造；本轮须用新Skills包复验原路径。
- 2026-09-28新Skills 1.1包本机有限核验：冻结源码指纹9345b221c1e270935d54a20865200800b926c0a2f325683ff40c1cd4e965ba23，候选ZIP和Windows便携ZIP构建及独立字节核验退出0；普通PowerShell Expand-Archive解压到新中文空格目录退出0，包内Node完整性核验退出0；私有PATH与新RuntimeHome离线准备、固定插件解析、包内Chromium静态页截图和WebM探针退出0。证据workbench/qa/20260928-skills11/packaging-acceptance-summary.json；同机证据，不等于产品发布或干净Windows验收。

## 推断与待确认

- 纯软件离线校验限制复制和误用，不宣称抵抗管理员改码、固件伪造或虚拟机克隆。
- 本机解包/独立Node路径验收与干净Windows第二台机器验收分开，当前没有另一台机器。
- 客户资源管理器解压、干净Windows第二台机器和实体换主板尚未验；Node解包成功不代表本机跨进程文件保护差异根治。
