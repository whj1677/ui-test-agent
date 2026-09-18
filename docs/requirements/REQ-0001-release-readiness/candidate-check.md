# 当前待验候选包检查

日期：2026-09-18。结论：**交付物一致性及本机隔离HTTP检查完成，PENDING_ACCEPTANCE；不是发布就绪。**

最新源码补充（REQ-0014）：`51d7f75d2bc6b004743742e1ed01d1293ef71680`新增默认关闭的只读意图计划试点，先输入审查/确认，再浅观察、候选语义审查与人工批准，执行时绑定当前详情/标签页目标与正向断言。用户原稿不默认正确，模型建议不自动生效；对象、原预期、操作和批准哈希不被运行绑定改写。核心实现647项工程回归0失败/跳过；末次只修正意图审查展示后，最终构建`542e5c5efe9bea1d6eb0d377d77b3e0e4a0315dc4b41199e31642a948d807aa1`的20项专项复验0失败/跳过，数字不相加。详见[REQ-0014交付证据](../REQ-0014-runtime-binding/delivery_evidence.md)及`validation/REQ-0014-runtime-final.log`、`validation/REQ-0014-binding-final.log`。本机真实Chromium+注入模型回复不等于真实模型或通用UI验收；绑定收据尚非可重放计划。4179未重启、旧ZIP未改变，无新Release。GitHub当前公开状态已核对并取得用户明确推送授权，源码提交与远端SHA一致。以下为历史候选及此前增量，不能当作当前源码安装包。

最新源码补充（REQ-0013）：探索与A规划规则衔接、候选排除诊断、300项内分区采样已分别在`c11fafdbd008950b1e68a2effcc5c517206a345c`、`de2c6c60fca51557f3fdb52178f9561cec920e67`、`8556f082a4c54406d639dde3f5e1540211528ffa`同步。最终源码构建`4f1e07c50a4f7bd903d12fc1811b093d6be5821bdb72e547afe7ba0320281a18`，非暂停工程回归627项0失败/跳过，其中18项专项不重复累计；日志`validation/REQ-0013-runtime-final.log`。控制台375/1280px折叠诊断与轮询稳定性已实际检查。菜单/弹窗到候选计划、UI批准和两条只读执行的本机注入联调完成，真实模型0调用；不视为发布验收。详见[REQ-0013交付证据](../REQ-0013-discovery-observability/delivery_evidence.md)。4179未切换，没有新ZIP或Release，以下739f包不含A方案及本次探索改进。

上一轮A方案源码补充：REQ-0008/A实现已在`e0ca79a8d0c836de8b835563ce7acafa16a2df52`同步，当时源码构建为`97fa6e8a9fc2fe1ed56f5d6b873880e77fb784fa624e2ed2513d4775523d454c`。下述739f包是上一轮保留的待验产物，**不包含新多步表单能力，不代表当前源码**。614项历史工程回归及其中21项专项见REQ-0008交付，不能充当此旧包或真实模型的新增验收。

## 身份与本机产物

- 源码提交：`7e9f3382d51c688d6672a6d310ab20d1a5a2f76e`（经验库实现提交`03f9650`）；本轮只新增验证脚本、更新需求/索引与证据，没有产品修改。
- 版本：`0.4.0-beta.1`。
- 构建：`739f82bac7bad3ead6d81cff2fa39ca344298ffceeafb0fc93ba09355ee68ba2`。
- ZIP：`validation/ui-test-agent-0.4.0-beta.1-739f82bac7ba-pending.zip`，354765字节。
- ZIP SHA256：`5ecb303cbcb6635f00b1f21088c3baf4b2e75757662396ad01c2cacee91b63e5`。
- 原始候选：`validation/REQ-0001-candidate-20260918-739f82ba`。
- 解包根：`validation/REQ-0001-extracted-20260918-739f82ba/REQ-0001-candidate-20260918-739f82ba`。
- 首次成功数据与摘要：`validation/candidate-runtime-7xWBnD`，其中observe/off/assist仅为空任务隔离测试使用。正式collector复验另建数据目录，见交付日志。

以上路径相对仓库根。ZIP和运行日志属于本机忽略产物，不上传GitHub或创建Release。

## 实际执行与结果

1. 运行既有 `node src/distribution.mjs validation/REQ-0001-candidate-20260918-739f82ba`，退出0，源与复制后构建相同。清单包含经验库三个运行模块。
2. PowerShell `Compress-Archive` 创建新ZIP；用 .NET ZipArchive逐项读取字节并计算SHA256，与86项清单及清单本身摘要比较。87项一致，无未知、缺失或重复文件；`ExtractToDirectory` 提取到新目录成功。日志：`validation/REQ-0001-candidate-739f-zip.log`。
3. Node动态导入解包内的 `verifyCandidate` / `readBuildInfo` / `server.start`，断言源构建=包构建=服务构建，解包文件集合与清单精确一致且无符号链接。
4. 解包内 `server.start({port:0, dataDir, headless:true, provider, experienceMode})` 分别以observe/off/assist启动随机端口；provider是未配置且任何模型调用都抛错的本机替身，不读取Key。`/api/config`身份、经验模式及新数据目录摘要一致；三个静态路由均返回200，首页仅允许唯一CSRF占位替换，其余字节及JS/CSS与包内文件一致。任务为空、configured=false、active=null、模型调用0。
5. 每个模式均在`finally`中关闭服务；核对监听器关闭、`.writer.lock`不存在、旧URL连接被拒、没有创建经验文件、包完整性仍一致。未启动目标浏览器或执行业务动作。
6. 可复跑命令：`node tests/release-candidate-runtime.integration.mjs validation/REQ-0001-extracted-20260918-739f82ba/REQ-0001-candidate-20260918-739f82ba`，4TAP（1父项+3模式）0失败/跳过。首份成功日志：`validation/REQ-0001-candidate-739f-runtime-final.log`；不是4条业务用例，不与593项程序回归相加。
7. 首轮脚本把动态首页直接与磁盘模板比较，4项失败记录保留在`validation/REQ-0001-candidate-739f-runtime.log`；查明既有CSRF替换合同后修正测试，未改包、产品或保护。正式检查首轮因验证/模块影响记录尚未回填拒绝，原交付记录保留在`validation/REQ-0001-candidate-739f-checker-first.md`。

日志SHA256：

- 创建日志：`efd3106056285efedc628b26e50549ba7bb95e2acac4600e57cb47aa285f330c`。
- ZIP检查：`6986005f5048f6768f2db11a9b112071bbcd4df5f5c0430451f5d5900cd5f6d4`。
- 首份解包成功日志：`13dcc0d9eae3209365ea6b04e403704c6c10230d9565a6a3bb8e793ae304a978`。

## 数据排除与扫描范围

逐文件核对候选精确清单；没有 `data`、`work`、`validation`、`node_modules`、`.git`、`.env*`、`.browsers`、`.python-venv` 目录或文件。对87文件检查长 `sk-`、GitHub经典token及私钥头模式，0命中。不记录扫描命中的原文，不把有限模式检查称为全面秘密审计。

## 不得推导的结论

- Node依赖从祖先工作区 `node_modules` 解析；未对这个新包重做安装器、Chromium下载或Python导入。不是干净Windows安装验收。
- 593项非暂停工程回归及TTL测试补强后的52项重叠专项来自同产品构建上一轮日志`validation/REQ-0012-delivery-final.log`、`validation/REQ-0012-delivery-scoped.log`；本轮没有重复执行，不与归档文件数或4TAP相加。
- 本轮真实模型调用0。不能证明自主探索、计划、运行效果，也不是两轮24例真实Agent验收。
- 4179旧实例未切换；经验库已有有限工程实现但真实模型收益未验证。此包生成时多步表单A/B尚待选择；随后用户已选A并完成限定工程实现，但不在本包中。
- 真实模型执行策略阻塞、直接file报告打开、干净环境及独立人员验收仍待解决。摘要用于检查交付物字节，不是可信发行方签名。

## 上一候选保留

旧`9b7f132246fa` ZIP、解包和原日志均未覆盖或删除。旧ZIP为345888字节，SHA256 `8026bae30da2c97e78bf32e2b3674caf7eaf46655cc0717e721cebad39b2f6be`；84文件及旧包HTTP验证见`validation/REQ-0001-candidate-zip.log`、`validation/REQ-0001-candidate-runtime.log`。旧包不含经验库，不用于代表当前代码；当时的48项打包器反例检查也不当作本次重跑结果。
