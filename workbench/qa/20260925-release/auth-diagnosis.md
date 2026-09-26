# 合成夹具登录后仍显示待登录：只读诊断

## 范围与当前证据

本记录仅针对正式工作台 4322 中项目 `project-93d8424d-0576-4c76-b18e-2157f823d8f8`、环境 `kimi-release-auth-20260925` 的认证检查，以及 4381 合成夹具。用户两次确认已在工作台专用 Edge 窗口登录；两份现有检查记录 `login-resume-check.json`、`login-resume-check-2.json` 均返回 `AWAITING_LOGIN / LOGIN_REQUIRED`，且 `session_version` 未变化。没有读取或记录 Cookie、令牌、浏览器配置文件、CDP 地址或会话存储，也没有启动、停止服务或执行模型。

## 已验证的代码事实

- `server/auth/session.mjs` 的 `open` 为该项目、环境、角色创建并保存一个内存中的 Playwright BrowserContext 和 Page。`check` 用 `item.context.request.get(environment.identity_url, { maxRedirects: 0 })` 检查身份。Playwright 的 [APIRequestContext 文档](https://playwright.dev/docs/api/class-apirequestcontext)明确说明 `browserContext.request` 与该 BrowserContext 共用 Cookie 存储，因此不能仅凭这两次 401 判定为“检查请求没有带上同一窗口的 Cookie”。
- `check` 在首次成功验证前收到 401 时保持 `AWAITING_LOGIN` 并标记 `LOGIN_REQUIRED`；该状态也可能覆盖用户已登录、随后服务端会话失效的情形。版本未变化说明两次记录针对同一内存 scope 的版本，不能证明该窗口从未登录。
- 合成夹具 `qa/20260925-release/fixture/server.mjs` 在同源 `POST /api/login` 设置 `sid` 会话 Cookie；`GET /api/identity` 仅在服务端内存会话有效时返回身份，否则返回 401。服务端会话有效期为 30 分钟，过期后会删除。`fixture/index.html` 登录成功后进入 `/workspace`，初始化时读取身份；已显示的工作区页面本身不会定时验证会话是否仍有效。因此仅看见工作区页面，不能证明检查时身份仍有效。
- `web-v2/app.js` 的认证面板默认选择环境列表第一项，而不是当前项目绑定的环境；操作时按面板当前选中的环境和角色构造 scope。列表中本地 AUTH-01 环境排在新登记环境之前。这里存在可证实的 UI 默认环境歧义：用户可能在不同环境的窗口中操作，但目前没有证据证明本次确实选错。建议面板明确显示并默认选中当前项目绑定环境。
- 现有进程元数据表明两次检查期间 4381 服务未发生进程重启；这不能排除服务内部会话过期或状态变化。首次记录与专用 Edge 窗口启动相隔已超过 30 分钟，但没有可用的无敏感信息证据确认最后一次登录时间，不能把过期认定为唯一根因。

## 尚未证实与有界下一步

目前不能区分以下原因：用户登录的实际窗口与该内存 scope 不同、面板选择了别的环境或角色、4381 会话在检查前过期，或其他请求路径异常。没有证据证明通用 SSO、Cookie 同步或 Playwright 共享机制失效。

下一步先核对正式 4322 面板当前环境和角色，并在同一个专用窗口观察公开可见的页面 URL、账号及角色；主管已向用户请求这些非敏感事实。若该窗口刷新后仍显示 `inspector` 的受保护工作区，而同一 Kimi scope 随即返回 401，再做仅记录非敏感状态码、scope 标识与时间的定点诊断。避免要求用户盲目反复登录，也不读取浏览器 Cookie、配置文件或会话存储。
