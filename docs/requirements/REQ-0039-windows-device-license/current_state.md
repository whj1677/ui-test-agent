<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0039 当前状态

- 需求标题：Windows完整环境包与主板绑定永久授权

## 元数据

- 需求状态：实现中
- 治理分级：G2
- 当前版本：4
- 最后更新：2026-09-28

## 当前有效用户需求

| UN | 状态 | 内容 |
|---|---|---|
| UN-0039-01 | 已确认 | 提供自带运行环境的Windows便携包，以及主板绑定的离线永久授权；用户首次提交设备申请并导入发行者签发的许可，以后本机自动验证。 |

## 当前有效开发需求

| DR | 状态 | 内容 |
|---|---|---|
| DR-0039-01 | 已确认 | 按白名单打包Node、三组锁定依赖、固定Harness插件与Chromium；不含凭据、工作数据或开发机绝对路径。 |
| DR-0039-02 | 已确认 | 用户填写显示名称并同意后导出设备申请，只持久化产品隔离的主板指纹。 |
| DR-0039-03 | 已确认 | 发行私钥独立保存；永久许可证签名覆盖产品、主体、设备指纹和策略；业务初始化前验证。 |
| DR-0039-04 | 已确认 | 同一4322入口提供激活指引、设备申请下载、许可证导入；成功后本地原子保存并启动；显式重新授权替换。 |
| DR-0039-05 | 已确认 | 优先包内Node/Harness/浏览器，目标路径动态解析，首次用户配置DPAPI模型密钥。 |

## 当前有效设计

| DD | DR | 状态 | 内容 |
|---|---|---|---|
| DD-0039-01 | DR-0039-01 | 已确认 | 完整环境包 |
| DD-0039-02 | DR-0039-02 | 已确认 | 设备申请 |
| DD-0039-03 | DR-0039-03 | 已确认 | 离线签发与启动校验 |
| DD-0039-04 | DR-0039-04 | 已确认 | 激活与持久化 |
| DD-0039-05 | DR-0039-05 | 已确认 | 运行环境适配 |

## 当前有效任务

| TK | DR/DD | 状态 | 内容 |
|---|---|---|---|
| TK-0039-01 | DR-0039-01 / DD-0039-01 | 本机新包核验完成；发布待确认 | 完整环境包 |
| TK-0039-02 | DR-0039-02 / DD-0039-02 | 已完成 | 设备申请 |
| TK-0039-03 | DR-0039-03 / DD-0039-03 | 已完成 | 离线签发与启动校验 |
| TK-0039-04 | DR-0039-04 / DD-0039-04 | 已完成 | 激活与持久化 |
| TK-0039-05 | DR-0039-05 / DD-0039-05 | 已完成 | 运行环境适配 |

## 当前有效验证项

| VT | DR | 状态 | 内容 | 当前证据 |
|---|---|---|---|---|
| VT-0039-01 | DR-0039-01 | 人工待确认 | 完整环境包 | Skills 1.1新包同机有限核验（无单元测试计数）：候选包构建及独立字节核验 exit 0，日志 workbench/qa/20260928-skills11/candidate-build.log、candidate-verify.log，ZIP SHA-256 8a0b41ad5580ca4f355605148efaf10e415ed511f8d7dcd1e9061d959d571457；便携包构建及独立归档核验 exit 0，日志 portable-build.log、portable-archive-independent-verify.log/json，ZIP workbench/qa/20260928-skills11/portable-20260928-skills11.zip，SHA-256 8ddea91fdedcd498c4849ac0277ad2753bff6735591aca9e5a30410182cd9175。PowerShell Expand-Archive 到新中文空格目录 exit 0（expand-archive.log）；包内 Node 执行 workbench/scripts/verify-portable.mjs exit 0（portable-verify-expand-archive.log）；包内 Node 执行 workbench/qa/20260926-portable/verify-installed.mjs，以排除全局Node/Harness的私有PATH和新RuntimeHome离线准备、固定插件解析及Chromium静态页截图/WebM，exit 0（portable-installed.log、portable-installed/result.json）。汇总：workbench/qa/20260928-skills11/packaging-acceptance-summary.json；同机字节及运行时探针，不代表正式工作台产品验收、干净Windows、客户独立安装或实体换板。历史r2证据保留。 |
| VT-0039-02 | DR-0039-02 | 人工待确认 | 设备申请 | 命令：npm --prefix ../device-license test；退出码：0；测试数量：18；失败数量：0；跳过数量：0；证据：../device-license/qa/dll-tests.log |
| VT-0039-03 | DR-0039-03 | 人工待确认 | 离线签发与启动校验 | 正式4322浏览器激活及SDK坏许可保留原文件检查；范围和媒体详见报告；实际证据：workbench/qa/20260926-license-activation/REPORT.md。已执行范围详见总报告；不替代产品发布或干净机验收。 |
| VT-0039-04 | DR-0039-04 | 人工待确认 | 激活与持久化 | 正式4322按原启动器/配置关闭重启后真实浏览器检查；范围和媒体详见报告；实际证据：workbench/qa/20260926-license-activation/REPORT.md。已执行范围详见总报告；不替代产品发布或干净机验收。 |
| VT-0039-05 | DR-0039-05 | 人工待确认 | 运行环境适配 | 包内node运行workbench/qa/20260926-portable/verify-installed.mjs；同机QA解包目录改名并复用私有runtime home；实际证据：workbench/qa/20260926-portable/relocated-environment-r2/result.json。已执行范围详见总报告；不替代产品发布或干净机验收。 |

## 人工待确认项

- [ ] 无阻塞本轮实现的业务输入；干净Windows第二台机器、实体更换主板和客户独立安装证据缺失，保留未验。
- [ ] 本机Python/Node对部分文档读取字节不同，原因未确认；未更改系统保护。

## 本轮禁止实现内容

- 不收集原始硬件序列号到报告/模型/客户申请文件；不把签发私钥或模型凭据入包。
- 不以假指纹模拟当真实换硬件证据；模拟反例与实机采集分列。
