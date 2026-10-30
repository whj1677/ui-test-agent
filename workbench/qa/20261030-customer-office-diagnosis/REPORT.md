# 2026-10-30 客户机 WPS 与 Node 现场错误诊断

状态：诊断工具已验证；客户机根因与修复仍待现场补采，不是新应用安装包或全功能验收通过。

## 已有现场证据

- 首份导出日志 1467 事件。wps3 三次 Office 读取失败，08:17:44、08:27:53、08:28:15 UTC；`read.rejected` 仅有 provider=auto、REQUIREMENT_OFFICE_OPEN_FAILED，无 phase/HRESULT/attempts。不能据此认定文件权限错误。
- 当前 native helper 的正常 Read 失败会包含 phase/HRESULT；外层 Main catch 返回裸失败码。诊断副本为此外层补充阶段、异常链类型和 HRESULT，并保留注册表探测。客户机实际 helper 摘要仍需核验。
- 三次早期 DSH 启动 NATIVE_DSH_HOME_BUSY，尚不能认定陈旧锁或直接删除锁。
- 第二份导出日志 3008 事件。08:55:01 UTC DSH 启动完成；导出快照 native_dsh.available=true、runtime_state=RUNNING。早期 HOME_BUSY 不代表最新导出时仍不可用。
- 09:00:43 UTC 工具错误找不到 curl.exe；09:01:18 找不到 cmd；09:01:30 诊断试跑 AUTH_SESSION_NOT_VALID，purpose=diagnostic、counts_for_case=false。09:01:33 用户中止该轮。诊断失败不计业务用例失败。
- 最新截图为 node.exe 0xc0000142。Microsoft NTSTATUS 定义为 STATUS_DLL_INIT_FAILED；现有导出没有失败模块或子进程退出上下文，尚不能确定具体 DLL、PATH、沙箱或企业策略为根因。
- 该轮权限元数据为 workspace-write + ask；未更改或绕过其沙箱设置。

输入为用户明确提供的两份诊断日志及截图，未额外读取客户机文件。Microsoft 定义：https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-erref/596a1078-e883-4972-9bbc-49e60bebca55

## 操作与范围

修改前远端归档：`33315ca46263951155efd25605200a0d608af78d`，分支 `codex/archive-before-customer-office-diagnosis-20261030`。本轮工具和证据在此 QA 目录；未改生产读取器、DSH runtime 或安装器。

诊断副本由 build.mjs 按精确源码片段构建，不覆盖生产 exe。读取所选 DOCX 的临时副本，不把原件交给 Office；不导出 segments/文档正文/异常消息。保留阶段、类型、HRESULT、有限技术栈、文件摘要和进程归属。只对原工作台4322做GET，不启停服务、不读取凭据、不调用模型、不删DSH锁、不终止DSH进程。Office 清理沿用生产 helper 的严格所有权机制。

collect-system.ps1 补采沙箱外 PATH 布尔项、cmd/curl/node 查找分类及近两小时有限 Windows Application 事件；不导出完整事件消息、命令行或转储。此结果不能替代沙箱内环境验证。Node 无法启动时仍可写 PowerShell 元数据报告。

## 实际验证

`test-combined.log`：6/6通过、0失败/跳过，约29.98秒。覆盖原版裸错误与诊断版阶段/HRESULT、注册表两视图、正式4322及实际锁路径/CIM、合成 DOCX 临时副本读取与正文/密钥不外泄、生产 helper 4文件及2个宿主锁前后同字节、PowerShell入口合并系统信息和自带Node摘要。未对客户业务文档或目标执行测试。

最终 ZIP 用 Python 生成，再由原生 Node/unzipper 独立校验压缩包与全部7条目摘要、UTF8与PS5 BOM；由 Node 从包内解压后，实际调用其中 collect.ps1 + D:/UAWps3Native 自带 Node 成功生成 delivered-combined-probe.json，日志 delivered-combined.log。

初始 TXT 说明在不同进程读取时字节视图不一致，未交付；最终改为 MD 并校验包内文本和解压入口。旧初始候选保留，不作为本次交付。

## 交付与待办

交付：`outputs/20261030-现场WPS诊断-v1/测试Agent-现场诊断包-v1.zip`，22671字节。

SHA256：`d41488a7189bc3db3e49c50f521ecc142f0fffbadf7e3f22bd09f2975c9be0b8`。

需用户电脑解压、双击诊断、选择失败 DOCX 并回传现场诊断 JSON；可取消文档选择只采集系统信息。补采仍可能未获Windows故障模块，必须按实际结果继续判断。当前不能声称WPS或Node问题已修复，不重打应用安装包。本轮模型调用为0；未重跑整产品全功能测试，因为生产代码未变且客户机故障尚未复现。
