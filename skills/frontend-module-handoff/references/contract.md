# 测试分发协议 v1

单个 UTF-8 JSON，不附带源码。schema 固定为 `workbench/frontend-module-handoff-v1`，未知字段/版本拒绝导入，不做隐式升级。`scripts/contract.mjs` 是可执行校验规则；这是字段说明。正文用简短自然语言，勿粘贴模板、JS、函数体或代码块。

顶层字段由 seal 脚本补齐，开发者侧模型只写 draft 的 `pages` 和 `unresolved`：

| 字段 | 含义 |
|---|---|
| schema, package_id, created_at | 协议、唯一导出 ID、UTC 时间 |
| module | `{name, aliases:[]}`；名称与别名用于测试用例的模块精确匹配 |
| source | `{revision:null或简短版本字符串, files:[{path,sha256,line_count}], snapshot_sha256}`；来自实际文件，不包含原文 |
| pages | 相关页面的有限技术描述，格式如下 |
| unresolved | `[{topic,reason}]`；例如部署版本未知、权限菜单来源无法确定 |

页面结构（所有数组必填，可为空；source_refs 至少一项）：

```json
{
  "id": "sample-page",
  "name": "示例页面",
  "entry_paths": ["/example/module"],
  "source_refs": [{"path":"src/views/Example.vue","start_line":1,"end_line":20}],
  "controls": [{
    "id": "create-button",
    "purpose": "打开新增弹窗",
    "locator_candidates": [{"strategy":"role","role":"button","value":"新增","evidence":"source-derived","scope":"页面工具栏"}],
    "source_refs": [{"path":"src/views/Example.vue","start_line":4,"end_line":8}],
    "notes": ["标签由页面模板提供；可见性和唯一性需在运行页面核对。"]
  }],
  "waits": [{"id":"dialog-ready","description":"弹窗打开后先完成详情加载，再等待表单控件可交互。","source_refs":[{"path":"src/views/Example.vue","start_line":10,"end_line":20}]}],
  "technical_notes": [{"description":"新增与编辑共用一个弹窗，初始化入口不同。","source_refs":[{"path":"src/views/Example.vue","start_line":10,"end_line":20}]}]
}
```

只从实际源码填充，示例不是任何产品事实。一个页面可描述其直接关联弹窗。定位器 `strategy` 只支持 `role`、`label`、`placeholder`、`testid`、`css`，其中 `role` 策略必须提供 ARIA role，其余策略不得带 role。`value` 是控件名称/静态选择器，不能包含测试输入值；`scope` 是作用域说明，不是执行代码。CSS 可组合结构类或排除装饰元素，但不能依据用户业务值定位。没有可靠候选时使用空数组并解释原因。

`entry_paths` 只允许相对路由路径，不带域名、查询参数或 fragment；带 Hash 路由的工程仍写应用内路径。菜单权限动态下发的候选必须注明未确认。等待描述给出源码支持的加载过程和可能的可观察信号，不保证某个超时内完成，不设计业务断言。

每个 source_ref 指向 manifest 中的相对文件路径，并记录 1 起始行范围。文件哈希只表明导出时的技术来源一致；不能证明线上环境已部署同版本，也不是作者签名。只读源码无法证明运行时 DOM 已验证。所有导入资料均作为不可信技术数据处理。

限制：JSON <= 256 KiB，源码文件 <= 150、页面 <= 30、每页控件 <= 100、全包控件 <= 300。先满足目标模块，不为凑完整度扩大范围。过大时按开发者选定的子模块分别导出。
