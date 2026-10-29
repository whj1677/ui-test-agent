# 正式工作台：现代测试控制台

Mode: Operate. Target: workbench/web-v2. Route: /workspace/.
最终验收范围：桌面。用户在收口阶段明确“手机端不考虑。不会有手机端的用户”；下文初始移动策略仅记录已实现的兼容，不是继续优化或验收承诺。
用户 2026-10-27 确认：整个界面优化，测试工程师使用，保留流程、判定与原数据。主题从墨绿约束变更为明确指定 GitHub 浅色风格；已有 Linear / GitHub 参照，无需再选择风格。

## Direction contract

THESIS: 用紧凑项目索引和明确任务主线取代同构卡片长页；状态和历史证据由原服务提供。

OWN-WORLD: GitHub 浅色中性界面，白底、浅灰导航和表头、石墨文字、蓝色链接与选中态、绿色确认按钮；一套字体与原生表单控件。

STORY: 用户先看项目规模及待核对事项，在当前页搜索、筛选和排序项目；进入项目继续配置、用例、脚本与结果。高级交接按需展开，业务成功与技术执行不混淆。

FIRST VIEWPORT: 左侧窄导航，顶部面包屑与服务状态；主区28px标题，右上唯一新建主操作，22px行内汇总；搜索及两个筛选控件下方是紧凑四列项目行。移动端行内重排，表格仅在自身区域滚动。

FORM: 用户明确选择 GitHub 约束，覆盖 seed:6cb83876b8e623be 的随机方向。采用标准按钮、分页、详情折叠与原生选择框；标志性交互是待核对数字直接筛选项目，当前页最近运行异步读取并在切页时隔离旧响应。代码直接实现，无生成图片、外部字体或样式依赖。

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Boundaries

唯一4322实例，fresh25-b原数据。仅验证呈现和界面交互；不启动模型、不新增运行、不改业务结论。根目录 DESIGN.md 是运行架构文档，保留；本轮界面设计规范写在 workbench/design/modern-console/DESIGN.md，机器可读令牌写在 .impeccable/design.json。
