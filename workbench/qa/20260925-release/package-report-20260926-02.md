# Windows 发布候选 02 打包核验

状态：**候选字节与文件闭包核验通过；认证保护功能及正式发布验收以各自独立证据为准**。本报告仅核对源码冻结后生成的 ZIP，不把 01 的运行结果当作 02 的功能结果。

## 候选

- 归档：`package-candidate-20260926-02.zip`，348560 字节，98 个源文件加 1 个 `candidate-manifest.json`。
- ZIP SHA-256：`0ad03d40c87ecd846ed4360c8c0327b6942909601f4ca48c2f16ad2c4f7bca15`。
- manifest 内容清单 SHA-256：`a00f061b8d73b894c6c7f542247d2d58991ac4406a55077f667242cc41ae2f8b`。
- 相比 01 唯一新增路径为 `workbench/server/auth/session-request-policy.mjs`，位于打包器收集的 `workbench/server` 内。另有 9 个已有文件字节变化，包括认证 catalog/session、候选试跑和开发任务流程、Harness 候选核验及发布说明；没有移除文件。
- 包内不含 `.local`、`node_modules`、`.git` 目录项；打包器按其密钥形态规则扫描内容。manifest 提供字节完整性核对，**不提供发布者数字签名**。

## 本轮命令与结果

| 步骤 | 命令 | 结果 | 原始输出 |
| --- | --- | --- | --- |
| 冻结后构建 | `python workbench/scripts/package-candidate.py --output workbench/qa/20260925-release/package-candidate-20260926-02.zip` | 退出 0；98 源文件 | `package-build-20260926-02.log` |
| 文件集、哈希、源码一致性、锁文件与反例 | `python workbench/qa/20260925-release/package-validation-20260926-02.py` | 退出 0；98 个归档源文件与当前源码逐字节一致，三份锁文件与 01 一致 | `package-validation-20260926-02.log` |

三个保留的反例 ZIP 分别对 helper 篡改 1 字节、添加未列文件、添加 `../` 路径穿越文件。验证器分别返回 `PACKAGE_FILE_DIGEST_MISMATCH`、`PACKAGE_FILE_SET_MISMATCH`、`PACKAGE_UNSAFE_OR_DUPLICATE_ENTRY`。反例文件 `package-negative-*20260926-02.zip` 只作校验证据，不可交付。

三份锁文件 `package-lock.json`、`workbench/package-lock.json`、`harness-probe/package-lock.json` 的 SHA-256 均与 01 manifest 相同。因此 **02 未重新执行 `npm ci`，也未重新运行包内 `check-install.ps1`**；01 包在无祖先 `node_modules` 的新目录中完成的三组离线安装和静态诊断只支持“依赖声明未变”这一工程判断，不能代替 02 的完整安装器或功能验证。01 对应原始日志见 `package-npm-root-20260926-01.log`、`package-npm-workbench-20260926-01.log`、`package-npm-harness-20260926-01.log`、`package-check-install-20260926-01.log`。

本轮未启动、重启或结束正式 4322 工作台，也未启动候选包服务、被测站点或模型。干净 Windows、另一名测试人员独立操作、真实客户登录、供应商费用和操作系统级隔离仍不由打包核验覆盖。认证保护仅按配置中明确列出的精确请求方法与路径生效，不能推断为所有副作用请求均已隔离。
