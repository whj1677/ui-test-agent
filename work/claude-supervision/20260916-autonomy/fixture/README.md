# 独立中文费率测试站

本目录实现冻结任务中的本地合成站点和 Chromium 软件自测；站点自测不代表 Agent 自主验收。

## 范围与启动

使用项目已有 Node.js 和 Playwright，无新增依赖、外部资源或真实业务。服务仅监听 `127.0.0.1`，会话保存在当前服务内存中，重启即失效。

在项目根目录启动自己的临时端口实例：

```powershell
node work/claude-supervision/20260916-autonomy/fixture/server.mjs --port 0 --mode normal --auto-login-ms 0
```

stdout 返回实际地址。手动使用合成账号 `tester`、合成密码 `demo-only` 登录，进入工作台；展开“资产运营”，点击“计费中心”，进入“费率目录”。第二个模块“报表中心 → 用量报表”、工作台导航和退出登录均可使用。

`--mode obstacle` 为障碍模式。CLI 也支持 `--port 4188`（默认值），仅在端口空闲且属于自己时使用。本轮 4179 和 4188 均归主管所有，不操作它们；本目录自测固定使用临时端口。按 Ctrl+C 关闭自己启动的实例。

## 冻结行为

- 目录五列、两行。日间方案为 `08:00—22:00 / 0.68元/度 / 启用`；夜间方案为 `22:00—08:00 / 0.23元/度 / 启用`。各行详情显示所选对象的名称、时段、单价，关闭后留在目录。
- `cases.json` 是三条人工业务用例，schema 为 `case-import/v1`，不含技术定位器、导航 URL、计划或故障答案。LOCAL-003 预期固定为 `0.32元/度`，与站点实际 `0.23元/度` 不符。自测确认差异保留，不能把 LOCAL-003 记为业务通过。
- `normal` 无使用提示。`obstacle` 每个登录会话首次请求目录时显示原生模态使用提示，阻挡详情操作。“知道了”只关闭页面弹层，不发送业务写请求。刷新、重新导航和同会话新标签页不重现；退出后新登录会话会再出现。
- 登录走真实表单 POST；错误凭据返回 401，正确登录落工作台；随机会话 cookie 为 HttpOnly / SameSite=Strict。业务页检查会话，退出删除服务端会话并清除 cookie。`/health` 仅返回 `{mode, ready}`。

## 可选测试驱动登录

`--auto-login-ms 600` 在本地登录页延迟代填合成凭据并提交同一登录表单，默认 0 关闭。人工操作表单会取消自动计时，仍可手动登录。

该选项只模拟操作者一次登录，不展开菜单、不导航业务页、不关闭弹层，不代表 Agent 自动认证能力。

## 模块调用与实际自测

```javascript
import { startFixture } from './server.mjs';
const fixture = await startFixture({ port: 0, mode: 'obstacle', autoLoginDelayMs: 0 });
try {
  console.log(fixture.url);
  // 仅使用自己启动的本地实例。
} finally {
  await fixture.close();
}
```

导入模块不启动服务。返回 `{server, url, close}`；文件 URL 转换兼容 Windows 中文路径。

```powershell
node --check work/claude-supervision/20260916-autonomy/fixture/server.mjs
node --check work/claude-supervision/20260916-autonomy/fixture/smoke.mjs
node work/claude-supervision/20260916-autonomy/fixture/smoke.mjs
```

自测使用已有 headless Chromium，覆盖未登录保护、错误与正确登录、首页、会话属性、二级导航、五列两行、两个详情、normal 无提示、obstacle 实际点击拦截和关闭后恢复、会话内不重现及新会话重现、退出失效、自动登录边界、三条冻结用例。`finally` 关闭自己创建的浏览器和全部临时服务，不结束其他进程。

每次运行在 `evidence/<UTC时间>/` 保存 `smoke-result.json` 和代表截图，不覆盖旧运行；stdout 输出同一 JSON。结果包含实际检查、浏览器版本、输入 SHA-256、价格差异、截图和资源关闭状态。退出 0 只表示这些站点软件检查通过；失败退出 1。自测不保存密码、cookie 值、token、请求正文或认证状态文件。源码中的合成登录常量仅供本地测试。

`evidence/host-initialization.json` 保留宿主沙箱初始化错误及审批恢复说明，不属于站点自测结果。真实模型执行和 Agent 自主验收由主管独立完成。
