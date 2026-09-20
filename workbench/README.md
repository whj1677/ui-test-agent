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

当前可用只读接口：`GET /api/health`、`GET /api/assets`、`GET /api/assets/:asset_id`、`GET /api/runs`。执行入口和中文页面在 T2–T3 补齐。

## 架构与隔离边界

- 复用：批准脚本的原始字节、冻结用例事实、固定 Playwright 参数与 heldout 合成站点。
- 隔离：独立依赖、端口、数据目录、运行进程、报告和媒体；不加载旧 Controller、Store 或浏览器执行主循环。
- 禁止：任意脚本/命令/文件/URL、跨域状态变更、外部监听、模型密钥或会话继承。

当前阶段只验证基础工程启动；不得据此宣称业务脚本、产品发布或通用平台通过。
