<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0039 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0039-01 | DR-0039-01 | 已确认 | 人工待确认 | 完整环境包 | 源闭包、依赖版本、精确清单和摘要可检查；离线准备无需npm或浏览器下载。 | Skills 1.1新包同机有限核验（无单元测试计数）：候选包构建及独立字节核验 exit 0，日志 workbench/qa/20260928-skills11/candidate-build.log、candidate-verify.log，ZIP SHA-256 8a0b41ad5580ca4f355605148efaf10e415ed511f8d7dcd1e9061d959d571457；便携包构建及独立归档核验 exit 0，日志 portable-build.log、portable-archive-independent-verify.log/json，ZIP workbench/qa/20260928-skills11/portable-20260928-skills11.zip，SHA-256 8ddea91fdedcd498c4849ac0277ad2753bff6735591aca9e5a30410182cd9175。PowerShell Expand-Archive 到新中文空格目录 exit 0（expand-archive.log）；包内 Node 执行 workbench/scripts/verify-portable.mjs exit 0（portable-verify-expand-archive.log）；包内 Node 执行 workbench/qa/20260926-portable/verify-installed.mjs，以排除全局Node/Harness的私有PATH和新RuntimeHome离线准备、固定插件解析及Chromium静态页截图/WebM，exit 0（portable-installed.log、portable-installed/result.json）。汇总：workbench/qa/20260928-skills11/packaging-acceptance-summary.json；同机字节及运行时探针，不代表正式工作台产品验收、干净Windows、客户独立安装或实体换板。历史r2证据保留。 | - | - | - | - | - | - |
| VT-0039-02 | DR-0039-02 | 已确认 | 人工待确认 | 设备申请 | 主板字段不可用或占位值拒绝，不降级绑定CPU、硬盘、MAC或账户。 | 命令：npm --prefix ../device-license test；退出码：0；测试数量：18；失败数量：0；跳过数量：0；证据：../device-license/qa/dll-tests.log | npm --prefix ../device-license test | 0 | 18 | 0 | 0 | ../device-license/qa/dll-tests.log |
| VT-0039-03 | DR-0039-03 | 已确认 | 人工待确认 | 离线签发与启动校验 | 缺失、篡改、错产品、错主板或无可信公钥时不初始化业务数据、不开放业务API。 | 正式4322浏览器激活及SDK坏许可保留原文件检查；范围和媒体详见报告；实际证据：workbench/qa/20260926-license-activation/REPORT.md。已执行范围详见总报告；不替代产品发布或干净机验收。 | - | - | - | - | - | - |
| VT-0039-04 | DR-0039-04 | 已确认 | 人工待确认 | 激活与持久化 | 正常重启自动验证，重复导入幂等，错误文件不覆盖原有效许可。 | 正式4322按原启动器/配置关闭重启后真实浏览器检查；范围和媒体详见报告；实际证据：workbench/qa/20260926-license-activation/REPORT.md。已执行范围详见总报告；不替代产品发布或干净机验收。 | - | - | - | - | - | - |
| VT-0039-05 | DR-0039-05 | 已确认 | 人工待确认 | 运行环境适配 | 开发机路径不进入用户配置，缺全局Harness仍可执行本地自检；诊断区分授权、运行时、插件、浏览器、模型凭据。 | 包内node运行workbench/qa/20260926-portable/verify-installed.mjs；同机QA解包目录改名并复用私有runtime home；实际证据：workbench/qa/20260926-portable/relocated-environment-r2/result.json。已执行范围详见总报告；不替代产品发布或干净机验收。 | - | - | - | - | - | - |

## 本轮命令与环境

- 工作目录：D:\01_AI工程\01_工程项目\ui-test-agent
- 命令：npm --prefix workbench test
- 命令：node --test workbench/tests/portable-package.test.mjs
- 命令：python workbench/scripts/package-portable.py --TrustFile ../device-license/public/ui-test-agent-trust.json <本轮r2构建参数，见脚本与build-r2.log>
- 命令：python workbench/qa/20260926-portable/verify-archive.py --archive <r2完整ZIP> --output <archive-verification-r2.json>
- 命令：包内node verify-installed.mjs <中文空格解包根> <证据目录> <私有runtime home>
- 命令：PowerShell Expand-Archive（新Skills 1.1便携ZIP→同机中文空格新目录；命令与exit 0见workbench/qa/20260928-skills11/expand-archive.log及packaging-acceptance-summary.json）
- 命令：包内Node workbench/scripts/verify-portable.mjs（exit 0，见workbench/qa/20260928-skills11/portable-verify-expand-archive.log）
- 命令：包内Node workbench/qa/20260926-portable/verify-installed.mjs（私有PATH/RuntimeHome，exit 0，见workbench/qa/20260928-skills11/portable-installed.log）
- 环境：Windows / PowerShell5.1；唯一正式4322，原fresh-b/fresh25-b及原配置不变；无另一工作台。
- 环境：目标Windows10/11 x64与系统.NET Framework4.8；客户不用编译器/全局Node/Harness，包内Node与浏览器；AI请求另外需要用户Key及网络。
- 环境：包环境验收仅本机新路径和真实重定位，子进程PATH排除全局Node/Harness；独立DLL机制与正式业务工作台分别取证。

## 结论

- 完整r2候选及本机运行环境核验已执行，正式4322设备申请/导入/拒绝/重启持久化已执行，详细证据workbench/qa/20260926-packaged-license/REPORT.md。
- 工程实现任务已完成，五项完整产品VT保持人工待确认；干净Windows/第二实体主板/普通用户独立安装/受保护客户文档仍未验，不判产品发布通过。
- 最终受控工程233项成功、0失败/跳过（测试退出0）；与独立DLL18项不能相加作为产品覆盖率。治理检查非零：历史REQ0015两处及本轮两个明确REQ同时变更，未为过门禁改需求或历史。
- Skills 1.1新候选ZIP与便携ZIP已在同机完成独立字节核验；PowerShell新中文空格路径解压、包内Node自检、私有PATH/RuntimeHome离线准备、Chromium静态页截图与WebM探针均实际退出0。证据workbench/qa/20260928-skills11/packaging-acceptance-summary.json；不是正式工作台业务验收，也不是干净Windows或第二实体主板验收。
