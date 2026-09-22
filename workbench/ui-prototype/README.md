# UI-D1 测试工作台交互原型

这是与正式 `workbench/web`、`workbench/server` 完全分离的纯前端原型。六个核心界面和所有媒体均使用合成演示数据；任何点击都不会调用正式 API、Harness、模型或业务脚本。

## 启动

在仓库根目录运行：

```powershell
node workbench/ui-prototype/serve.mjs 4311
```

浏览器打开 <http://127.0.0.1:4311/#/projects>。服务只监听 `127.0.0.1`，无需安装新依赖。点击右上角“重置演示”可恢复内置数据；这会清除当前标签页会话中的演示修改。

## 六个核心界面

1. 项目列表：`#/projects`
2. 项目用例库：`#/projects/demo-project-inspection/cases`
3. Excel／原生包导入向导：从用例库点击“导入用例”
4. 用例详情：`#/projects/demo-project-inspection/cases/demo-case-query`
5. 建例任务详情：`#/projects/demo-project-inspection/builds/demo-build-scope`
6. 执行结果详情：`#/projects/demo-project-inspection/runs/demo-run-counterexample`

## 三条可点击流程

- A：新建项目 → Excel演示导入 → 五类预览 → 确认 → JSON包追加 → 同包重复预览 → 回到用例库 → 选择部分用例导出。
- B：打开用例v1 → 创建“尚未启动”任务 → 查看冻结快照 → 查看“要求待确认”任务 → 返回来源用例 → 编辑形成v2 → 验证旧任务仍绑定v1。
- C：打开适用于当前用例版本的已首审脚本 → 明确创建演示运行 → 查看正常和断言不符记录 → 切换步骤 → 查看截图并操作原生录像。

演示导入使用确定性内置夹具，不声称解析了任意用户文件；导出的 JSON 明确包含 `demo_only: true`。录像没有步骤时间戳，因此步骤切换不会伪造视频定位。

用例的前置条件、测试数据和步骤均按版本保存；建例任务创建后保存独立冻结快照，后续形成新版本不会改变旧任务。JSON下载由同一原型服务的受控`/demo-download`端点返回附件，该端点只接受当前页面生成且带`workbench/case-package-v1`与`demo_only=true`的演示包，不写入服务器文件。

## 文件

- `demo-data.js`：合成项目、用例、任务、脚本和运行数据。
- `app.js`、`styles.css`：hash 路由、交互与用户选定的“01 墨白极简”视觉层。
- `assets/`：公开合成媒体，不是真实测试证据。
- `screenshots/`：六张独立核心界面截图。
- `API_MAPPING.md`：现有能力与正式接入缺口。
- `DESIGN_NOTES.md`：页面、状态和交互设计说明。
- `UI_D1_ACCEPTANCE_REPORT.md`：工程和浏览器验收记录。
- `UI_D1_CONSISTENCY_REVISION.md`：版本快照、阶段条和真实JSON下载的后续修订验证。
- `UI_D1_VISUAL_REFRESH.md`：冷白／靛蓝重设计说明、验证范围与六张新版截图。
- `UI_D1_MONOCHROME.md`：后续选定墨白方案的六屏应用与验证记录。
- `directions.html`：历史三种视觉方向对比；仅切换样稿，不修改主原型。

停止点：原型待用户核对；不自动替换正式 UI。
