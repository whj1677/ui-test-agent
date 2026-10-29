# 通用执行底座 API

本模块只负责连接已登录原页、执行记录、证据和清理；不包含云平台选择器、业务答案或共享操作实现。人工用例仍是业务预期来源。`check` 记录通过只能证明该回调没有失败，不能证明模型完整翻译了预期；原用例各项预期仍须逐项写成真实断言。

## 环境与入口

- Node ESM，设置 `WORKBENCH_PACKAGE` 为现有工作台 `package.json` 的绝对路径，仅复用已安装的 Playwright，不访问工作台服务。
- `PILOT_CDP` 指向现有已授权浏览器；`TARGET_URL` 必须与原标签 `page.url()` 完全相同，包含必要的 hash/query。不存在或有多个同 URL 标签时标记 `BLOCKED`，不新建标签、浏览器或登录会话。
- 底座不读取 Cookie/storage，不关闭用户 browser/context/page。脚本保存报告后主动退出自己的 Node 进程，释放 CDP 客户端连接。
- 所有调用均应 `await`。请勿在底座外自行吞掉异常、修改页面函数、mock 接口或提前调用 `process.exit()`。

```js
import { runCase, expect } from './runtime.mjs';

const result = await runCase({
  caseFile: './cases.json',       // 单条对象或数组；数组多条必须指定 externalId
  externalId: 'CASE-001',
  scriptFile: import.meta.filename,
  outputDir: './results/CASE-001',
  attempt: Number(process.argv.find(a => a.startsWith('--attempt='))?.split('=')[1] ?? 1),
  dependencyDirs: ['./shared'],   // 可选；动态计算的本地依赖须包含在此目录
  execute: async ctx => {
    const { page } = ctx;
    ctx.cleanup(async () => {
      // 清理本用例自己创建的临时UI状态/监听器，并断言清理完成。
      // 只读用例也须显式检查结束状态；不得删除既有业务数据。
      await expect(page.getByRole('dialog')).toHaveCount(0);
    });
    await ctx.step(1, async () => {
      await ctx.check('original-step-1-visible-heading', async () => {
        await expect(page.getByRole('heading', { name: '原用例指定标题', exact: true })).toBeVisible();
      });
    });
  },
});
console.log(JSON.stringify({ status: result.status, failure_kind: result.failure_kind }));
process.exit(result.status === 'PASSED' ? 0 : 1);
```

相对文件路径按当前进程 cwd 解析。每次 `attempt-NNN` 目录只允许新建；同编号再次运行会在操作页面之前拒绝，不覆盖历史。运行前自动留存原始 case 文件、入口、递归本地字面量 import/require 依赖、运行器与 `dependencyDirs` 内 `.js/.mjs/.cjs/.json/.md` 文件，保存 SHA-256。运行后检查原文件与依赖没有变化。不要将凭据、环境配置或无关数据放入共享依赖目录。

## ctx

- `page`：精确选中的原始 Playwright Page。
- `frozenCase`：递归冻结的原用例对象。报告分别记录原文件字节哈希、内容 JSON 哈希和输入声明的内容哈希；声明哈希不会被冒充已按上游算法验证。
- `step(order, async fn)`：按原用例顺序执行所有步骤，不可并行、跳步、重复。成功步骤自动截图，失败步骤自动失败截图。
- `check(id, async fn)`：只能在步骤内使用，ID 全用例唯一。每一步至少一个 check，覆盖的语义由原用例决定。使用 `expect` 或显式抛错做断言；返回 false 同样失败。即便调用方 catch 失败，报告仍然失败。
- `cleanup(async fn)`：执行前或执行过程中注册，结束时逆序运行。所有已注册清理都会尝试，失败落盘和截图。成功执行至少需要一项显式清理/结束状态检查，缺少或失败不能标 PASSED。
- `screenshot(label)`：保存额外证据，文件名由底座产生。截图失败属于运行器证据错误，不隐藏。
- `blocked(reason)`：前置不满足时抛错并记录 BLOCKED。仅在尚未执行步骤的前置检查阶段阻塞时允许没有清理。

## 被动请求证据

```js
const watcher = await ctx.watchRequests({
  urlPattern: /\/api\/items\/(?:save|update|delete)$/,
  methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
  probePattern: '/api/items/page',
  probeMethods: ['POST'],
  probe: async () => { await ctx.page.getByRole('button', { name: '查询', exact: true }).click(); },
  probeTimeoutMs: 2000,
});
const marker = watcher.mark(); // 要在被验证的提交动作之前标记
await ctx.step(2, async () => {
  await ctx.page.getByRole('button', { name: '确认', exact: true }).click();
  await ctx.check('specific-visible-error', async () => {
    await expect(ctx.page.getByText('原用例指定的明确错误信息', { exact: true })).toBeVisible();
  });
  await ctx.check('no-write', () => watcher.assertNoneSince(marker, { observationMs: 500 }));
});
```

使用 `CDP Network.requestWillBeSent` 捕获开始事件，因此包括未完成请求和相同 URL 重复请求。底座不替换页面业务函数，不使用 ResourceTiming 判定零请求，不采集请求/响应 body、headers、Cookie 或 URL query。正则匹配去除 query 的完整 URL；字符串匹配去除 query 的完整 URL 或 pathname。

`probe` 须是实际页面触发的已知非写入操作；必须观察到 `probePattern`/方法匹配事件，才能声明通道有效。探针通过只证明事件通道有效，不证明业务查询成功；业务成功需要另作真实响应断言。先在不会被弹窗遮挡的位置验证探针。`assertNoneSince` 等待窗口后核验，从 marker 到 execute 结束再次核验迟到请求，且确认 CDP 连接仍有效。清理阶段请求不纳入该提交窗口。监听器最后自动解绑并 detach 会话。

## 输出与限制

`result.json` 包含原步骤/预期、各 check、清理、截图、去敏请求事件、失败原因与源文件快照。状态为 `PASSED`、`FAILED`（断言或脚本失败）、`BLOCKED`（前置缺失）、`ERROR`（运行器证据/完整性/清理错误）。所有问题均保留在 `faults`；不要用最终状态覆盖最初失败证据。

底座提供完整性机械检查，不做业务语义审核。错误的选择器、写错预期、空洞断言、页面外直接操作和进程被强制终止仍需实验评估；不得宣称该模块自动证明用例语义完整。最终实际复跑必须独立记录。离线测试只覆盖运行器逻辑，不等同云平台真实验证。

离线测试：`node --test skills/dsh-ui-runner/tests/runtime.test.mjs`。测试注入假 Page/CDP，不启动浏览器或工作台，也不访问真实目标。
