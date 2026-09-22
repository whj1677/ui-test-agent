# UI-D2A 墨白真实用例库体验指南

## 1. 启动

在仓库根目录打开 PowerShell：

```powershell
npm --prefix workbench ci
$env:WORKBENCH_DATA_DIR = [IO.Path]::GetFullPath('.\workbench\.local\ui-d2a-trial')
$env:WORKBENCH_PORT = '4210'
npm --prefix workbench start
```

浏览器打开：

- 新墨白真实页面：<http://127.0.0.1:4210/workspace/#/projects>
- 保留的旧工作台：<http://127.0.0.1:4210/>

服务只监听 `127.0.0.1`。`WORKBENCH_DATA_DIR` 是本次体验的独立私有数据目录；关闭再启动服务时继续使用同一路径，即可读回项目、版本和导入记录。

## 2. 真实样例

样例均为公开合成数据：

| 文件 | 用途 | SHA-256 |
| --- | --- | --- |
| `workbench/examples/ui-d2a/UI_D2A_CASES_A.xlsx` | 项目 A 首次导入；3 条用例，含多步骤、逐步预期、中文、多行文本、数字样文本和 1 条待澄清 | `B0723B4C82A7A931B5DC9906D3A19F3A4CCF581BF49D78F684981F41C8AC48EC` |
| `workbench/examples/ui-d2a/UI_D2A_CASES_B.xlsx` | 项目 B 自有来源；1 条用例 | `48836A47CEC2487B797FF51BFDBF2480D4B8DCF94DDE104037741E17FE861998` |
| `workbench/examples/ui-d2a/UI_D2A_NATIVE_SAMPLE.json` | 由现有后端正式导出并通过正式导入解析器复核的 `workbench/case-package-v1` 包 | `FC2B8B3C2525417759BB941B5EC615832E599356E1E2D0F9E10E7AC600C6A707` |

需要重建合成样例时：

```powershell
npm --prefix workbench run generate:ui-d2a-samples
npm --prefix workbench run generate:ui-d2a-native-sample
```

## 3. 推荐体验步骤

1. 在“项目”页创建“体验项目 A”。
2. 进入 A，点击“导入用例”，选择 `UI_D2A_CASES_A.xlsx`。
3. 选择工作表并核对字段映射；进入预览后确认：2 条新增、1 条待确认/待澄清，确认前项目仍没有新用例。
4. 确认导入。回到用例库，查看三条用例，打开 `UI-D2A-001` 核对三组动作与逐步预期。
5. 勾选部分用例并点击“导出选中”；再点击“导出全部”。两者下载的都是真实 JSON 用例包，空选择不会自动退化成导出全部。
6. 创建“体验项目 B”，先导入 `UI_D2A_CASES_B.xlsx`，再导入刚从 A 下载的 JSON 包。
7. 再导入一次同一 JSON 包，预览会把同一来源、同一版本且内容相同的记录列为重复并默认跳过。
8. 在 B 编辑一条从 A 导入的用例，修改前置条件、测试数据或某一步，保存为 v2；切换 v1/v2 核对历史正文。A 中的源用例不会变化。
9. 停止服务，再用第 1 节的同一数据目录重启；项目、用例、版本和导入记录仍可读取。

## 4. 当前边界

- 本页面只接入项目和用例管理。侧栏“建例任务”和“执行记录”明确显示本阶段未接入。
- 内容“已确认”只表示用例正文确认，不等于脚本批准、执行通过或整体验收通过。
- 首版只支持既有 Excel 一行一用例格式和 `workbench/case-package-v1` JSON 包；不执行宏、外部链接或缺少缓存值的公式。
- 本体验不会启动 Harness、模型、Playwright 业务脚本，也不会更改批准资产或历史结果。
