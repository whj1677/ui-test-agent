# 批准脚本测试工作台（第一阶段）

这是独立于原产品的本地单用户子工程。它只负责登记已批准资产、从固定入口启动 Playwright、持久化运行事实并在中文 Web 中展示结果；不生成或修改业务脚本，也不调用任何模型、Harness 或 healer。

## 安装、登记与启动

```powershell
cd workbench
npm ci
npm test
npm run register:approved
npm start
```

默认只监听 `http://127.0.0.1:4210`。受控登记命令从仓库真实文件读取用例、批准依据、配置和依赖锁，只有脚本 SHA-256 精确等于批准值才写入 catalog；重复登记同一事实是幂等操作，冲突内容会被拒绝。

运行数据、报告和媒体写入被 Git 忽略的 `workbench/.local/`。JSON 使用串行写入和同目录临时文件替换；每次运行使用独立目录。服务启动会把遗留的排队、启动、运行或停止中记录标为 `INTERRUPTED`，但不会自动重放，也不会尝试接管旧 PID。

当前接口：`GET /api/health`、`GET /api/assets`、`GET /api/assets/:asset_id`、`GET /api/runs`、`GET /api/runs/:run_id`、`POST /api/runs` 和 `POST /api/runs/:run_id/stop`。状态变更只接受同源本地 JSON 请求，正文只允许固定字段。

执行前会确认 4198 的 `/healthz` 精确标识冻结 heldout 站点并检查入口可用性；不匹配时拒绝运行，不关闭或替换未知进程。后端只从已登记资产映射入口，以参数数组启动本地锁定的 `@playwright/test`，显式使用 `workers=1`、`retries=0`，不通过 shell 或 `npx` 下载。批准脚本按原始字节复制到本次运行目录，来源和副本在运行前后分别核验哈希。

同一时间最多一个活动运行。停止只接受当前服务持有的活动 `run_id`，Windows 上仅对该子进程 PID 调用进程树终止；已结束、旧服务遗留或其他 PID 不会被处理。子进程仅继承 Playwright 运行需要的系统路径/临时目录变量，不继承模型 Key、Cookie 或任意完整 `process.env`。

结构化结果解析和中文页面在 T3 补齐。

## 架构与隔离边界

- 复用：批准脚本的原始字节、冻结用例事实、固定 Playwright 参数与 heldout 合成站点。
- 隔离：独立依赖、端口、数据目录、运行进程、报告和媒体；不加载旧 Controller、Store 或浏览器执行主循环。
- 禁止：任意脚本/命令/文件/URL、跨域状态变更、外部监听、模型密钥或会话继承。

当前阶段只验证基础工程启动；不得据此宣称业务脚本、产品发布或通用平台通过。
