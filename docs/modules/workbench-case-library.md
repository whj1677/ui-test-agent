# Workbench Case Library

## 范围

M3-A 在既有本地工作台内增加项目、用例、Excel 与原生 JSON 用例包的数据管理。模块不启动 Harness，不调用模型，不生成、批准或执行业务脚本。

## 数据与边界

- 私有数据根：`workbench/.local/case-library/`；项目、上传和导入预览分别存储。
- 项目单 JSON 文件包含项目 revision、用例版本和已确认导入记录；修改串行执行并用同目录临时文件安全替换。
- 上传只接受 `.xlsx` 和 `workbench/case-package-v1` JSON，最大 10 MiB；文件名只保留 basename，服务端 ID 随机生成。
- Web 状态变更只接受 `127.0.0.1`/`localhost` 同源请求；没有任意磁盘路径、`.local` 静态目录或代码执行入口。

## 导入流程

文件先登记到私有上传目录。Excel 由用户选择工作表和表头映射，按“一行一例、步骤/预期两个多行单元格逐行对应”解析；原生包先校验 schema、来源和步骤结构。预览冻结项目 revision，将每项分类为新增、重复、冲突、待澄清或无法导入。确认时 revision 必须仍一致，所有新增和导入记录在一次项目原子替换中提交；相同 preview 重复确认返回已有结果。

公式字段拒绝，宏格式拒绝，外部链接不取值。缺少预期的用例强制保持内容待确认。

## 导出与版本

导出全部或选中用例，保存业务内容、当前来源版本、根来源和项目 lineage。目标项目生成新内部 ID，后续修改形成新版本且不影响源项目。包不含脚本、批准、执行结果、媒体、Cookie、凭据或绝对路径。

## 验证入口

- `cd workbench; npm test`
- `cd workbench; npm run test:m3a-browser`
- 首版格式：[workbench/docs/M3A_EXCEL_FORMAT_V1.md](../../workbench/docs/M3A_EXCEL_FORMAT_V1.md)
- 验收报告：[workbench/docs/M3A_ACCEPTANCE_REPORT.md](../../workbench/docs/M3A_ACCEPTANCE_REPORT.md)
