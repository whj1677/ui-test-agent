# 任务内共享操作

`scripts/shared.mjs` 只存技术操作，不存业务预期。当前目录由启动者通过 `SHARED_ROOT` 传入。不得把账号、Cookie、token、客户数据写入共享文件。

```js
// shared/controls.mjs
export async function verifySearch(page) {
  return await page.getByRole('button', {name: '查询', exact: true}).count() === 1;
}
export async function search(page) {
  await page.getByRole('button', {name: '查询', exact: true}).click();
}
```

探索者实际验证操作后，在与 guard 对应的页面状态发布：

```js
await publishShared({page,root:process.env.SHARED_ROOT,entries:[
  {id:'search',file:'controls.mjs',operation:'search',verify:'verifySearch'}
]});
```

使用者在同一页面状态调用：

```js
const ops = await useShared({page,root:process.env.SHARED_ROOT,ids:['search']});
await ops.search();
```

`publishShared` 运行每个 live guard 并保存页面完整 URL（包括查询参数和 hash 路由）、源码摘要和时间；guard 必须返回 `true`，不可无条件返回。它检查适用性，不自动证明任意操作效果。探索者需实际运行操作并留下探测结果，不能仅发布不存在的经验。

`useShared` 在取用以及每次实际调用操作前校验摘要、完整页面 URL 和当前 guard。guard 应只读、无业务变更；涉及弹窗内控件的操作在弹窗打开后才取用，可按操作逐项取用。页面 URL 改变后需要为新的明确范围重新验证发布。guard 失败会拒绝复用并给出具体 id；由编写者修复该操作并重新验证发布，其他未失效操作保留。

共享入口仅支持 `.mjs`、`.js`；本地依赖仅支持共享目录内被摘要追踪的 `.mjs`、`.js`、`.json`。`import`、`export ... from` 和字面量动态 `import('./helper.mjs')` 都会检查依赖；禁止跨目录、第三方包、未追踪类型、带查询/hash的导入地址、非字面量动态导入和 `require`。允许 Node 内置模块。共享源码自身不读别组、源码或秘密配置，不使用反射或自建模块加载器；这些检查用于正常共享代码的依赖追踪，不是任意恶意 JavaScript 的执行沙箱。

一个进程已经加载共享源码后，源码或本地依赖的任何变化都返回 `SHARED_SOURCE_CHANGED_RESTART_PROCESS_REQUIRED`。请在新 Node 进程中重新发布并运行，以免 Node 的传递依赖缓存执行旧代码；这里仅指当前脚本进程，不重启工作台或用户浏览器。全新进程发现源码与已发布摘要不一致时仍需先重新发布，不能静默接受变更。

依赖扫描使用已有 `acorn`。启动者设置 `WORKBENCH_PACKAGE` 为现有 workbench `package.json` 的绝对路径，脚本通过该路径解析依赖；未设置时从脚本所在位置解析。当前工程已提供 acorn，不另安装；以后对外分发 Skill 时，接收方须提供包含 acorn 的 Node 依赖环境。

用例的业务断言在自己的脚本中完成。用例入口将共享目录传入 `runCase` 的 `dependencyDirs`，使运行记录包含实际使用版本。
