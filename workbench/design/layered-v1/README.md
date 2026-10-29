# layered-v1 · 分层方案骨架

本目录是 [`../DESIGN.md`](../DESIGN.md) 的接口骨架，用来把方案讲清楚、并给出可评审的形状。
**它不是可直接运行的完整实现**：`registry.pointer()` 与 `case-runner` 的指针解析器需要由执行器注入；
L1 的 `probe()` 大部分是"必须在目标页确认"的占位，需要真实探测任务填实。

## 目录

```
layered-v1/
  DESIGN.md                                  方案正文（分层原则、机制、任务模型、失败码、迁移路径）
  packages/
    ui-automation-core/
      status.mjs                             L0 · 状态与失败码（含"不可当作业务结论"的集合）
      registry.mjs                           L1 框架 · 标定/前置/动作三件套 + probeAll/runPrimitive
    ui-automation-web-adapters/
      visibility.mjs                         L1 · 可见性（可标定，禁止写死 offsetParent / display）
      virtual-select.mjs                     L1 · 虚拟列表下拉（无搜索框时键盘导航）
      overlay.mjs                            L1 · 弹层（最上层判定 + 优先取消按钮，不默认 Escape）
      drag-track.mjs                         L1 · 区间拖拽几何（轨道尺寸每次现算）
  workspace/
    modules/control-electricity-price-template/module-profile.json   L2 示例（带实测回执与已知陷阱）
    gates/profile-admission.mjs             门禁 1：替代 page-facts.md 存在性检查
    gates/case-preflight.mjs                门禁 2：零模型前置检查（会话/可达/入口/target 复核）
```

## 与现状的对应关系

| 现状 | 本方案的位置 | 变化 |
|---|---|---|
| `page-facts.md`（模型写的散文）+ `fs.stat` 门禁 | `module-profile.json` + `gates/profile-admission.mjs` | 从"文件存在"变成"回执可校验、多匹配必须收敛" |
| `tests/lib/price-template.mjs` 里的页面原语 | `ui-automation-web-adapters/*`（L1）+ `module-profile.json`（L2） | 框架假设进 L1 并带 `assumes` 标签；选择器进 L2 并带回执 |
| 库内两套相反的可见性判据 | `visibility.mjs` 单一标定入口 | 全库一套判据，且判据由标定决定 |
| 探索与用例共用一个任务和预算 | 四种任务类型（见 DESIGN.md §3） | 探索成本只付一次，且可单独计费 |

## 怎么用它做一次对照验证

最小验证（不需要改产品代码）：

1. 在目标页跑 `probeAll(page, {assumesTags:['antd-modal','antd-select','virtual-list','custom-timeline']})`，
   看四个适配器能否标定成功，把结果写进 `module-profile.json` 的 `calibration`。
2. 跑 `validateProfile(profile)`：
   - 现在这个示例 profile 应当**通过**（每条 target 有 pointer/assumes/回执，名称输入框那条靠 `known_trap` 收敛）；
   - 把 `name_input_in_modal` 的 `known_trap` 删掉再跑一次，应当报 `SELECTOR_NOT_UNIQUE`——
     这正是 008/009 失败的那个缺陷被拦住的时刻。
3. 跑 `preflight({...})`，确认未登录、目标不可达、target 变多/变少三种情况都返回对应阻塞码，
   而不是变成一个 30 秒超时。

## 尚未实现（明确的缺口）

- `registry.pointer()`：需要执行器提供受控的指针解析（把 L2 里的表达式安全地变成 Locator），
  当前是 `NOT_IMPLEMENTED` 占位。
- L1 的 `probe()`：除 `visibility` 有真实标定逻辑外，其余三个返回的是"必须在目标页确认"的占位。
- 证据层与指纹计算：`DESIGN.md` 已定义形状，本骨架未包含实现。
- `case-runner`：任务类型调度、预算分离、结果落盘。
