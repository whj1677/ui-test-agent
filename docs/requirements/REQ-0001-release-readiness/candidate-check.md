# 当前待验候选包检查

日期：2026-09-18。结论：**交付物一致性及本机隔离HTTP检查完成，PENDING_ACCEPTANCE；不是发布就绪。**

## 身份与本机产物

- 源码提交：`bc9b14d2c3f635f7b9547aeaf7586d258c94a93b`；此后本轮只更新需求与证据文档。
- 版本：`0.4.0-beta.1`。
- 构建：`9b7f132246fa2cc5a17a0d286abc508c5325d57e26adb0ab0216d52d94c058f2`。
- ZIP：`validation/ui-test-agent-0.4.0-beta.1-9b7f132246fa-pending.zip`，345888字节。
- ZIP SHA256：`8026bae30da2c97e78bf32e2b3674caf7eaf46655cc0717e721cebad39b2f6be`。
- 原始候选：`validation/REQ-0001-candidate-20260918-9b7f1322`。
- 解包根：`validation/REQ-0001-extracted-20260918-9b7f1322/REQ-0001-candidate-20260918-9b7f1322`。
- 数据目录：`validation/REQ-0001-package-runtime-L5Cnt6`，仅本次空任务测试使用。

以上路径相对仓库根。ZIP和运行日志属于本机忽略产物，不上传GitHub或创建Release。

## 实际执行与结果

1. 运行既有 `node src/distribution.mjs validation/REQ-0001-candidate-20260918-9b7f1322`，退出0，源与复制后构建相同。
2. PowerShell `Compress-Archive` 创建新ZIP；用 .NET ZipArchive逐项读取字节并计算SHA256，与83项清单及清单本身摘要比较。84项一致，无未知、缺失或重复文件；`ExtractToDirectory` 提取到新目录成功。日志：`validation/REQ-0001-candidate-zip.log`。
3. Node动态导入解包内的 `verifyCandidate` / `readBuildInfo` / `server.start`，断言源构建=包构建=服务构建，解包文件集合与清单精确一致且无符号链接。
4. 解包内 `server.start({port:0, dataDir, headless:true, provider})` 启动随机端口；provider显式空Key、注入拒绝联网的fetch。`/api/config` 身份及新数据目录摘要一致；`/`、`/app.js`、`/styles.css` 返回200，后两者响应字节与包内文件SHA相同。任务目录为空、configured=false、active=null、模型调用计数0。
5. `finally` 中关闭隔离服务；核对监听器关闭、`.writer.lock` 不存在、包完整性仍一致。日志：`validation/REQ-0001-candidate-runtime.log`。没有启动目标浏览器或执行业务动作。
6. 正式collector实际执行 `node --test tests/release-integrity.test.mjs`：48个TAP条目、0失败/跳过，退出0；包括清单损坏、文件缺失、重复/非法路径和链接反例。日志：`validation/REQ-0001-candidate-integrity.log`。它验证打包器既有行为，不是48条真实业务用例，也不与前轮570项相加。

日志SHA256：

- ZIP检查：`e3dee02a474de7fde86816245f6bec0c08852352c544b9c3c8fbbf3cf55eaa25`。
- 解包运行：`f1c3a795e6c25946ab00e0602a0b987d20315a2af1854ceee9260d30c320058a`。
- 完整性专项：`ae0b734a44c3a5ddf5cc0d05532ee497369bc34f9a59cfefd35321e92be38ba5`。

## 数据排除与扫描范围

逐文件核对候选精确清单；没有 `data`、`work`、`validation`、`node_modules`、`.git`、`.env*`、`.browsers`、`.python-venv` 目录或文件。对84文件检查长 `sk-`、GitHub经典token及私钥头模式，0命中。不记录扫描命中的原文，不把有限模式检查称为全面秘密审计。

## 不得推导的结论

- Node依赖从祖先工作区 `node_modules` 解析；未对这个新包重做安装器、Chromium下载或Python导入。不是干净Windows安装验收。
- 570项非暂停工程回归来自同一产品构建的上一轮日志 `validation/REQ-0011-runtime.log`；本轮没有重复执行，不与归档文件数相加。
- 本轮真实模型调用0。不能证明自主探索、计划、运行效果，也不是两轮24例真实Agent验收。
- 4179旧实例未切换；当前知识库尚未实现，多步表单A/B审批选择未确认。
- 真实模型执行策略阻塞、直接file报告打开、干净环境及独立人员验收仍待解决。摘要用于检查交付物字节，不是可信发行方签名。
