# Workbench Case Library

## 范围

M3-A 在既有本地工作台内增加项目、用例、Excel 与原生 JSON 用例包的数据管理。M3-B1 将单个已确认版本接入既有 build task 的输入侧并默认保持 `INPUT_ONLY`。M3-B2 只对一条与固定合成环境匹配的项目用例登记单次作用域授权，使同一冻结输入可进入实际 attempt；不批量建例或自动批准。

## 数据与边界

- 私有数据根：`workbench/.local/case-library/`；项目、上传和导入预览分别存储。
- 项目单 JSON 文件包含项目 revision、用例版本和已确认导入记录；修改串行执行并用同目录临时文件安全替换。
- 上传只接受 `.xlsx` 和 `workbench/case-package-v1` JSON，最大 10 MiB；文件名只保留 basename，服务端 ID 随机生成。
- Web 状态变更只接受 `127.0.0.1`/`localhost` 同源请求；没有任意磁盘路径、`.local` 静态目录或代码执行入口。

## 导入流程

文件先登记到私有上传目录。Excel 由用户选择工作表和表头映射，按实际物理行列读取“一行一例”结构；工作表空行可跳过但来源保留原行号，空白列不改变后续表头的真实列位置。步骤与预期两个多行单元格按单元格内原始行位置对应，不自动删除行首数字样文本，也不分别压缩空行。原生包先校验 schema、来源和步骤结构。预览冻结项目 revision，将每项分类为新增、重复、冲突、待澄清或无法导入。确认时 revision 必须仍一致，所有新增和导入记录在一次项目原子替换中提交；相同 preview 重复确认返回已有结果。

公式字段拒绝，宏格式拒绝，外部链接不取值。有动作缺预期时保留动作并强制待确认；有预期缺动作时因归属不明而拒绝该用例。既有项目数据不自动迁移，需从保存的原文件重新预览后由用户确认。

## 导出与版本

导出全部或选中用例，保存业务内容、当前来源版本、根来源和项目 lineage。目标项目生成新内部 ID，后续修改形成新版本且不影响源项目。包不含脚本、批准、执行结果、媒体、Cookie、凭据或绝对路径。

## 单条用例建例输入

详情页只允许选择项目内确切内部 ID 的已保存版本。创建请求同时携带项目 ID、内部用例 ID、版本、内容 SHA-256、固定环境 ID 和幂等 request ID；服务端重新读取版本并复算哈希，拒绝跨项目、过期版本、哈希不符、待确认、缺动作/预期或非法环境。

创建结果仍是现有 `workbench/build-task-v1`。`source` 保存项目、用例、版本、根来源和 lineage，任务目录登记 `input/case-snapshot.json`、`task.md`、`agent-instruction.txt`；后两者逐步展开原动作和预期，不做语义概括。`execution_policy=INPUT_ONLY` 同时控制 Web 和后端启动拒绝。项目页从 task source 派生关联历史，任务页可返回来源用例，避免项目/任务双写；服务重启直接读回原 task。内容确认只说明用例正文可用于创建输入，不代表脚本批准、候选生成或测试通过。

项目用例建例提交的 `request_id` 还绑定 `project_id`、`case_id`、`case_version`、`content_sha256` 与 `environment_id` 五项身份。处理中和落盘后的同键同身份请求返回原任务；同键异身份返回 `CASE_BUILD_REQUEST_KEY_CONFLICT`（HTTP 409），不创建任务、不覆盖输入且不消耗预算。新任务保存请求指纹；既有任务无指纹时从 `source` 和 `environment_ref` 推导，身份字段不全或指纹矛盾时拒绝复用。

## 单条用例真实建例

只有工作台以固定 M3-B2 授权 ID 启动时，本批新任务才使用 `SINGLE_AUTHORIZED_INITIAL`；授权记录冻结五项请求身份，最多一次 Harness 进程创建、30 次工具调用和 600 秒。历史 `INPUT_ONLY` 任务仍由 Web 与后端共同拒绝启动。attempt 从任务根目录按登记 SHA-256 复制 `task.md` 与 `input/case-snapshot.json`，再保存包含实际入口/候选路径的渲染指令；不会读取项目当前最新版覆盖任务快照。

固定合成环境只在项目用例恰有一个步骤包含环境预期值时创建验证契约；不匹配用例拒绝获得本批执行任务。契约保存预期值、反例实际值和全部 `CASE_STEP_<order>` 标记。技术验证要求同一候选正常通过、反例取得确切值差异、候选哈希不变且全部项目步骤在结构化报告中可观察；这些条件最多产生“等待人工核对”，不批准脚本。

## 验证入口

- `cd workbench; npm test`
- `cd workbench; npm run test:m3a-browser`
- `cd workbench; npm run test:m3a-fidelity-browser`
- `cd workbench; npm run test:m3b1-browser`
- `cd workbench; npm run test:m3b2-browser`（零模型，真实 Excel/Web/Playwright）
- `cd workbench; powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-m3b2-real.ps1`（明确授权时的一次真实调用）
- 首版格式：[workbench/docs/M3A_EXCEL_FORMAT_V1.md](../../workbench/docs/M3A_EXCEL_FORMAT_V1.md)
- 验收报告：[workbench/docs/M3A_ACCEPTANCE_REPORT.md](../../workbench/docs/M3A_ACCEPTANCE_REPORT.md)
- Excel 保真修订：[workbench/docs/M3A_EXCEL_FIDELITY_REVISION.md](../../workbench/docs/M3A_EXCEL_FIDELITY_REVISION.md)
- M3-B1 输入接通报告：[workbench/docs/M3B1_CASE_BUILD_INPUT_REPORT.md](../../workbench/docs/M3B1_CASE_BUILD_INPUT_REPORT.md)
- M3-B1 request_id 身份修订：[workbench/docs/M3B1_REQUEST_IDENTITY_REVISION.md](../../workbench/docs/M3B1_REQUEST_IDENTITY_REVISION.md)
- M3-B2 单条真实建例报告：[workbench/docs/M3B2_PROJECT_CASE_REAL_REPORT.md](../../workbench/docs/M3B2_PROJECT_CASE_REAL_REPORT.md)
