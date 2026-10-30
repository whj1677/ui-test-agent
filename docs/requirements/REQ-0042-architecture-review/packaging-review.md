# v4 完整重新打包核验

用户要求“重新打包一下”。完整 EXE 和备用便携 ZIP 位于 `outputs/20261029-架构修复完整安装包-v4/`。

- `测试Agent-完整安装包-20261029-v4.exe`：641,818,826 字节，SHA256 `3cff429a1f7d707dba56fb18bef8327de3573484253e1f397e4825b8e09e7b30`。
- `测试Agent-完整便携包-20261029-v4.zip`：733,652,689 字节，SHA256 `006a5ff9e7914d2842d1a14dc125db17aeb3792fa4e77fe3f13d73d381d418a4`。

v4 是打包批次；内部 release 仍为 `0.1.0-native.20261029.office3`。当前源码指纹 `a2c806a36d1fc2998a0ebfbd1cf44022da333fbe263d846aedc0b8d848cb69ad` 与此前正式4322功能测试通过的快照一致，未改应用代码，未新增模型调用。

334 个源码条目全部核对；除明确生成的免设备激活 policy 外，333 个条目与打包前及当前 collect 字节一致，15 个修复文件全部包含。完整 ZIP、原生提取目录及实际安装后均通过 57,368 个文件的完整性校验。实际安装后的 manifest 和334源码再次与 ZIP 逐字节一致。

首次 Python 暂存目录未通过原生读取校验，错误落在依赖许可文本；原失败保留在 `build-portable.log`。从完整校验通过的ZIP由Node提取到新目录，重新全量校验后才编译EXE，没有绕过验证。

实际静默安装到自有新目录；未启动第二个工作台。原安装注册和快捷方式恢复、已记录旧安装数据及配置文件哈希保持，4322监听PID、实例、源码、配置与数据根身份均保持。安装临时目录在交付摘要完成后清理，旧安装和旧交付包保留。

这次证明本机新目录安装及程序字节完整，不代表干净Windows首次安装、Office现场兼容或其他此前未覆盖业务已验收。既有功能测试和候选人工确认边界仍见 `followup-review.md`。

安装器实际退出0且文件全量通过；首次QA末尾误读健康接口为ready布尔值而非status字段，造成检查脚本退出1。保留原脚本、失败回执和日志，修正后仅复验环境保全，未重复安装。最终证据为`full-install-result-architecture-v4-verified.json`，不是覆盖原失败。

证据：`workbench/qa/20261029-three-fixes/packaging/packaging-result.json`、`source-installed-verification.json`、`full-install-result-architecture-v4-verified.json`；本轮打包工程测试及正式检查由 `delivery_evidence.md` 记录。
