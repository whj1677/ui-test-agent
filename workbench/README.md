# 批准脚本测试工作台（第一阶段）

这是独立于原产品的本地单用户子工程。它只负责登记已批准资产、从固定入口启动 Playwright、持久化运行事实并在中文 Web 中展示结果；不生成或修改业务脚本，也不调用任何模型、Harness 或 healer。

## 安装、登记与启动

```powershell
cd workbench
npm ci
node node_modules/@playwright/test/cli.js install chromium
npm test
npm run register:approved
npm start
```

默认只监听 `http://127.0.0.1:4210`。受控登记命令从仓库真实文件读取用例、批准依据、配置和依赖锁，只有脚本 SHA-256 精确等于批准值才写入 catalog；重复登记同一事实是幂等操作，冲突内容会被拒绝。

运行数据、报告和媒体写入被 Git 忽略的 `workbench/.local/`。JSON 使用串行写入和同目录临时文件替换；每次运行使用独立目录。服务启动会把遗留的排队、启动、运行或停止中记录标为 `INTERRUPTED`，但不会自动重放，也不会尝试接管旧 PID。

当前接口：`GET /api/health`、`GET /api/assets`、`GET /api/assets/:asset_id`、`GET /api/runs`、`GET /api/runs/:run_id`、`POST /api/runs` 和 `POST /api/runs/:run_id/stop`。状态变更只接受同源本地 JSON 请求，正文只允许固定字段。

执行前会确认 4198 的 `/healthz` 精确标识冻结 heldout 站点并检查入口可用性；不匹配时拒绝运行，不关闭或替换未知进程。后端只从已登记资产映射入口，以参数数组启动本地锁定的 `@playwright/test`，显式使用 `workers=1`、`retries=0`，不通过 shell 或 `npx` 下载。批准脚本按原始字节复制到本次运行目录，来源和副本在运行前后分别核验哈希。

同一时间最多一个活动运行。停止只接受当前服务持有的活动 `run_id`，Windows 上仅对该子进程 PID 调用进程树终止；已结束、旧服务遗留或其他 PID 不会被处理。子进程仅继承 Playwright 运行需要的系统路径/临时目录变量，不继承模型 Key、Cookie 或任意完整 `process.env`。

## 结果判定与 Web

打开 `http://127.0.0.1:4210`，可查看批准资产、选择正常/故障入口、启动或停止当前任务、浏览运行历史、步骤错误及媒体。页面每秒读取一次真实后端状态；轮询只负责刷新，不制造进度或结果。

- `execution_status` 只描述进程和工作台生命周期；`report_status` 描述 JSON 报告是否完整；`test_status` 保留 Playwright 的通过、失败、跳过或未运行；`evidence_status` 单独描述截图、视频和 Trace 是否齐全。
- 只有退出码为 0、报告有效、恰好运行一个目标测试、没有跳过且登记步骤全部实际通过，`summary.complete_pass` 才为真。
- 断言错误保留原消息、期望值、实际值和 `PENDING_ANALYSIS` 归因；即使包含等待期限，只要确认发生值比较，仍分类为 `ASSERTION_MISMATCH`。没有执行的登记步骤显示 `NOT_EXECUTED`。
- 媒体 API 只按本运行记录中的 `media_id` 读取，并复核真实路径仍在 run 目录和文件大小未变化。截图与视频可在页面本地查看；Trace 下载后可执行：

```powershell
node node_modules/@playwright/test/cli.js show-trace <下载的-trace.zip>
```

T3 工程验证包含 18 项 Node 测试和一次真实 Chromium 工作台操作流；它不代替 T4 的批准脚本正常/故障真实组合。

## 架构与隔离边界

- 复用：批准脚本的原始字节、冻结用例事实、固定 Playwright 参数与 heldout 合成站点。
- 隔离：独立依赖、端口、数据目录、运行进程、报告和媒体；不加载旧 Controller、Store 或浏览器执行主循环。
- 禁止：任意脚本/命令/文件/URL、跨域状态变更、外部监听、模型密钥或会话继承。

当前阶段只验证基础工程启动；不得据此宣称业务脚本、产品发布或通用平台通过。
