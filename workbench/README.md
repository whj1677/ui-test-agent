# 批准脚本测试工作台（第一阶段）

这是独立于原产品的本地单用户子工程。它只负责登记已批准资产、从固定入口启动 Playwright、持久化运行事实并在中文 Web 中展示结果；不生成或修改业务脚本，也不调用任何模型、Harness 或 healer。

第一阶段原始 normal/fault 组合、运行 ID、三方一致性、重启证据和边界见 [集成验收报告](docs/ACCEPTANCE_REPORT.md)。2026-09-21 的三项代码复审修复、修前/修后证据和新运行 ID 见 [M1 复审修复报告](docs/REVIEW_FIX_REPORT.md)；原报告没有改写。

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

环境选择由明确的前端状态保存。轮询即使重建选项也会恢复仍在资产允许列表中的用户选择；资产不再允许该值时才回退到首个允许环境。启动请求读取该状态，不从刚重建的 DOM 猜测入口。

- `execution_status` 只描述进程和工作台生命周期；`report_status` 描述 JSON 报告是否完整；`test_status` 保留 Playwright 的通过、失败、跳过或未运行；`evidence_status` 单独描述截图、视频和 Trace 是否齐全。
- 原始 Playwright 结果保留在 `test_status`、`summary.playwright_status` 和 `summary.playwright_pass`；整体有效通过另记为 `summary.complete_pass`。只有工作台终态为 `PROCESS_ENDED`、退出码为 0、报告有效、恰好运行一个目标测试、没有跳过且登记步骤全部实际通过，整体才为真。哈希异常、取消、中断、进程或报告异常不会被原始绿色结果覆盖。
- 错误保留原消息、已确定的期望值/实际值和 `PENDING_ANALYSIS` 归因。只有同时取得具体 `Expected` 与 `Received` 值才分类为 `ASSERTION_MISMATCH`；缺元素或严格匹配冲突为 `LOCATOR_OR_TARGET`，只有单侧值或普通 expect 文本为 `ASSERTION_UNRESOLVED`，纯超时保留 `TIMEOUT`。包含超时文字但已取得 H111/H106 两值的真实比较仍是值不符。没有执行的登记步骤显示 `NOT_EXECUTED`。
- 媒体 API 只按本运行记录中的 `media_id` 读取，并复核真实路径仍在 run 目录和文件大小未变化。截图与视频可在页面本地查看；Trace 下载后可执行：

```powershell
node node_modules/@playwright/test/cli.js show-trace <下载的-trace.zip>
```

原 T3 工程验证包含 18 项 Node 测试和一次真实 Chromium 工作台操作流；本次复审修复后完整集合为 21 项 Node 测试，并再次执行真实 Chromium 工作台流。工程测试不代替批准脚本正常/故障真实组合。

## 验收命令

先在独立终端运行冻结站点和工作台：

```powershell
npm run lab
npm start
```

完成工程测试后，使用真实 Web 组合和重启验证：

```powershell
npm run test:real
# 正常停止并重新 npm start 后
npm run test:restart
```

`test:real` 会真实新增 normal/fault 运行，不能用作无改动反复碰运气。公开报告已记录本轮实际 ID；不要用旧成绩替代新的授权验收。

## 架构与隔离边界

- 复用：批准脚本的原始字节、冻结用例事实、固定 Playwright 参数与 heldout 合成站点。
- 隔离：独立依赖、端口、数据目录、运行进程、报告和媒体；不加载旧 Controller、Store 或浏览器执行主循环。
- 禁止：任意脚本/命令/文件/URL、跨域状态变更、外部监听、模型密钥或会话继承。

当前状态为 M1 第一阶段集成验证及三项代码复审修复完成。该状态仅证明受控批准资产在本机工作台中的执行、记录和追溯闭环，不重新宣称业务脚本首次验收，也不代表产品发布、陌生页面泛化、多人服务或通用平台完成。
