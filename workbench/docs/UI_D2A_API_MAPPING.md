# UI-D2A 真实后端映射

UI-D2A 使用与工作台相同的源、端口和安全边界。页面数据只来自现有 `CaseLibraryManager` / `CaseLibraryStore`；浏览器仅保存当前路由、搜索、分页、选择和未提交草稿等界面状态。

| 页面能力 | 现有接口 | 事实与失败边界 |
| --- | --- | --- |
| 项目列表/创建 | `GET/POST /api/case-library/projects` | ID、revision、数量和状态由服务端返回 |
| 项目详情/名称说明修改 | `GET/PATCH /api/case-library/projects/:project_id` | PATCH 携带已读取 revision；409 不静默覆盖 |
| 原始文件上传 | `POST /api/case-library/uploads` | 发送 `.xlsx`/`.json` 原始字节、精确 MIME 与文件名；不接受任意路径 |
| 导入预览 | `POST /api/case-library/projects/:project_id/imports/preview` | 工作表、映射、分类、issues、来源行和预览 revision 均来自服务端 |
| 导入确认 | `POST /api/case-library/projects/:project_id/imports/:preview_id/confirm` | 确认前不写项目；重复确认幂等；冲突仅支持现有明确决策 |
| 用例详情/新版本 | `GET/PATCH /api/case-library/projects/:project_id/cases/:case_id` | 指定内部 ID、版本和项目 revision；历史正文读取 `versions[].content` |
| 正式导出 | `POST /api/case-library/projects/:project_id/export` | 响应原始下载字节；选中和全部是两个明确入口；不在浏览器重建包 |

## 同源静态入口

- `/workspace/`：新墨白真实页面。
- `/workspace/app.js`、`/workspace/api.js`、`/workspace/styles.css`：明确白名单资源。
- `/`：保留旧工作台。

服务没有把 `web-v2`、仓库目录或 `.local` 暴露成通用静态目录；未知路径和越界路径继续失败关闭。状态变更仍受既有本地同源、正文类型和字段校验约束。

## 本阶段未接入

建例任务、候选、脚本审批、执行记录、媒体、批量套件和环境管理没有接入新页面；界面不伪造这些能力，也没有新增写接口。API 请求失败会展示实际错误，不回落演示项目或 `sessionStorage` 数据。
