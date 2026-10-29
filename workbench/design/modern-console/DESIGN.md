---
name: 测试工作台 · Modern test console
description: 面向桌面测试工程师的 GitHub 浅色工作台视觉系统
colors:
  canvas: "#fff"
  sidebar: "#f6f8fa"
  surface: "#fff"
  soft: "#f6f8fa"
  hover: "#f0f3f6"
  line: "#d1d9e0"
  line-strong: "#8c959f"
  ink: "#1f2328"
  muted: "#59636e"
  accent: "#0969da"
  accent-soft: "#ddf4ff"
  primary: "#1f883d"
  primary-hover: "#1a7f37"
  success: "#1a7f37"
  success-soft: "#dafbe1"
  warning: "#7d4e00"
  warning-soft: "#fff8c5"
  danger: "#cf222e"
  danger-soft: "#ffebe9"
  nav-active: "#e8edf2"
typography:
  headline:
    fontFamily: '"Segoe UI","Microsoft YaHei UI","Microsoft YaHei",sans-serif'
    fontSize: "28px"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  title:
    fontFamily: '"Segoe UI","Microsoft YaHei UI","Microsoft YaHei",sans-serif'
    fontSize: "16px"
    fontWeight: 650
  body:
    fontFamily: '"Segoe UI","Microsoft YaHei UI","Microsoft YaHei",sans-serif'
    fontSize: "14px"
    lineHeight: 1.6
    letterSpacing: "0"
  label:
    fontFamily: '"Segoe UI","Microsoft YaHei UI","Microsoft YaHei",sans-serif'
    fontSize: "13px"
    fontWeight: 600
  metadata:
    fontFamily: '"Segoe UI","Microsoft YaHei UI","Microsoft YaHei",sans-serif'
    fontSize: "12px"
    lineHeight: 1.6
  mono:
    fontFamily: "ui-monospace,SFMono-Regular,Consolas,monospace"
    fontSize: "12px"
rounded:
  badge: "5px"
  control: "6px"
  panel: "8px"
  modal: "12px"
spacing:
  control-gap: "8px"
  compact: "12px"
  group: "16px"
  row: "20px"
  section: "24px"
  major: "28px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "6px 13px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.surface}"
  button-secondary:
    backgroundColor: "{colors.soft}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "6px 13px"
  button-link:
    backgroundColor: "transparent"
    textColor: "{colors.accent}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "6px 13px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "8px 10px"
  navigation-active:
    backgroundColor: "{colors.nav-active}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 11px"
  badge-success:
    backgroundColor: "{colors.success-soft}"
    textColor: "{colors.success}"
    rounded: "{rounded.badge}"
    padding: "2px 8px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "22px"
---

# Design System: 测试工作台

## Overview

**Creative North Star: "GitHub 浅色测试控制台"**

正式工作台使用用户已确认的 GitHub 浅色方向：白色工作区、浅灰导航与表头、石墨文字、蓝色链接及选中提示、少量绿色确认操作。保留测试工具的信息密度，用排版、分隔线和留白建立层级。

本规范记录 `workbench/web-v2` 的共享视觉语言，适用入口为 `/workspace/`。以 `workspace-v2.css` 末尾 Modern test console 覆盖和后续局部修正为主要依据，`project-setup.css` 提供配置页差异，`styles.css` 提供字体与基础输入内边距。`index.html` 的加载顺序决定覆盖关系。根目录 `DESIGN.md` 是运行机制文档，本文件不替代它。

当前设计与验收仅面向桌面。已有窄屏兼容保持现状，不构成手机端优化或验收承诺。本文件只约束视觉与呈现，不定义业务判定、权限或执行流程。

**Key Characteristics:**
- 浅色中性底与紧凑信息密度。
- 蓝色指引导航和链接，绿色突出确认操作。
- 行与表格支持扫描，技术详情按需展开。
- 文字、图形与颜色共同表达状态。

## Colors

前置令牌是规范值；颜色沿用源码名称，避免建立另一套调色板。

### Primary

- **确认绿**（`primary`、`primary-hover`）：确认类主按钮的默认与悬停色；成功状态另用 `success` 语义。
- **链接蓝**（`accent`、`accent-soft`）：链接、键盘焦点、选中导航侧边提示、选中页签及选择控件。

### Neutral

- **工作纸白**（`canvas`、`surface`）：页面和主要内容面。
- **工具浅灰**（`sidebar`、`soft`、`hover`）：导航、表头、次按钮和轻量分组。
- **石墨文字**（`ink`、`muted`）：主要信息与辅助说明。
- **边界灰**（`line`、`line-strong`）：分隔线、输入边框及交互边界。
- **导航选中灰**（`nav-active`）：当前导航底色，配合蓝色左侧标记。

### Status

- `success` / `success-soft` 用于成功呈现；`warning` / `warning-soft` 用于警告、阻塞与未运行等现有提示；`danger` / `danger-soft` 用于失败与错误提示。这里记录源码的颜色映射，不推导业务结论。
- 通用状态徽标同时包含文字与圈形、勾形、感叹提示或叉形；不要仅依赖红绿区分。

**The Separate Accent Rule.** 蓝色承担链接、选择和焦点，绿色主按钮承担确认操作；不要把所有可点击元素涂绿。

## Typography

界面共享系统字体栈，中文回退到微软雅黑；无外部字体。技术文本使用 `mono`。不设置营销式 display 字级。

### Hierarchy

- `headline`：页面主标题。桌面常规标题使用前置令牌，保持紧凑行距。
- `title`：普通面板标题；配置分组标题为源码已有的较大变体（18px），项目行标题为较小变体（15px、600）。
- `body`：正文和输入内容；说明段落可采用源码已有行距（1.7）及阅读宽度（70–72ch）。
- `label`：表单标签与按钮。元信息、表头和状态采用 `metadata`；时间等次要字段可使用已有小字（11px）。
- 汇总数字使用等宽数字。项目汇总数字（22px）和通用汇总数字（20px）不竞争主标题。

## Layout

桌面使用左导航与右工作区：常规导航宽度（216px），顶部栏最小高度（58px）。主内容最大宽度（1600px），常规内边距（34px 36px 48px）；超宽屏在既有断点（1600px）增加水平留白（48px）。

紧凑桌面（761–1180px）保留四列项目索引，列轨道为 `minmax(140px,1fr) 46px 120px 128px`，间距（14px）；导航在已有规则中缩为（192px）。常规四列为 `minmax(180px,1fr) 64px 148px 140px`，列间距（24px）。项目名允许换行，说明可省略显示，近期活动和时间保持次级层级。

配置页最大宽度（1180px），表单与帮助区使用 `minmax(0,1fr) 264px` 双栏及间距（48px）；帮助区用左边界和内边距分隔。已有断点（1100px）将帮助区置于下方。表格应在自身容器内横向滚动；避免通过整页横向滚动容纳宽表。

已有窄屏断点（900px、760px、650px）及 step-pair 兼容修正属于已实现兼容，不再增加手机设计目标。

## Elevation & Depth

以色面和细边界分组，普通按钮、面板和项目行不使用浮起阴影；嵌套面板去掉重复外框。模态层使用源码 `--shadow`，导航使用蓝色内侧标记表达当前位置。侧栏、表头与工作区的轻微色差构成主要层级。

**The Flat Surface Rule.** 普通工作面保持平面，模态层才使用共享浮层阴影。

## Shapes

控件、提示和导航采用 `control` 圆角；状态徽标采用 `badge`；外部面板与项目列表轮廓采用 `panel`；模态使用 `modal`。分组内部保持直线分隔，避免每个字段再套独立圆角卡片。品牌标记保留源码已有的小方形轮廓（7px 圆角），步骤序号保留圆形。

## Components

### Buttons

紧凑、明确。常规按钮最小高度（36px），小按钮（30px）；配置页提交按钮（40px）。次按钮使用浅灰背景与边界，链接按钮用蓝色文字。主按钮使用确认绿；准备链接区域保留源码已有的中性变体。禁用按钮降低透明度（0.52），不改变业务可用性判断。

悬停只改变背景和边界，过渡（0.15s ease-out）。键盘焦点使用蓝色轮廓（2px）和偏移（3px）。

### Inputs / Fields

白色输入面、细边框和 `control` 圆角。通用控件最小高度（36px），配置字段（40px）；标签保持可见并位于字段上方，辅助说明使用次级文字。焦点边界与轮廓均使用链接蓝。保留原生 select 和 checkbox 外观及语义。

### Navigation

桌面侧栏保持固定信息位置，浅灰底，紧凑导航行。当前项使用选中灰背景、加粗文字与蓝色内侧标记，并保留 `aria-current="page"`。悬停使用 `hover`；项目分组标题和次级导航降低字级。顶部面包屑与服务状态使用元信息层级，允许文本自然换行。

### Chips / Status

徽标采用紧凑内边距与 `badge` 圆角；状态图形位于文字之前。保留语义文字，浅色底只作辅助编码。执行列表继续沿用源码中的现有状态映射。

### Cards / Containers

外层面板用白底、细边和 `panel` 圆角；浅灰标题条与正文通过分隔线相连，正文常规内边距（22px）。嵌套区块与配置表单通过标题、留白和边界线组织；不要逐层复制完整卡片边框。

### Tables / Project Index

表头浅灰、元信息字级、加粗，常规表头高度（42px）；表格正文（13px）与单元内边距（14px 12px）。项目索引共享四列轨道，标题、状态、用例数、近期活动和更新时间保持对齐。分页与每页数量放在索引下方。悬停以浅底色提示，不放大行或制造卡片漂浮。

### Advanced Progressive Disclosure

技术详情使用原生 `details` / `summary`，平时保留可识别标题与次级说明。配置高级项通过顶部边界、留白及展开箭头表达可展开性，展开后沿用同一套表单样式。技术内容保持可访问，不抢占日常主操作。

## Do's and Don'ts

### Do:

- **Do** 复用共享令牌，让项目、配置与业务页保持同一浅色语言。
- **Do** 用文字、图形和颜色共同表达状态，并保留清晰键盘焦点。
- **Do** 保持桌面项目四列对齐，让宽表在自身区域滚动。
- **Do** 用原生折叠区保留高级技术详情的可达性。

### Don't:

- **Don't** 将链接蓝和确认绿混成同一个交互语义。
- **Don't** 为普通面板、项目行和嵌套分组增加浮起阴影或重复卡片外框。
- **Don't** 引入外部字体、生成插画或以装饰取代信息层级。
- **Don't** 将已有窄屏兼容描述成手机端设计或验收承诺。
