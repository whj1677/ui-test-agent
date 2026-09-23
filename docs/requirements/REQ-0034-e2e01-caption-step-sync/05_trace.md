<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0034 追踪

## 当前有效链路

| UN | DR | DD | TK | VT | 状态 |
|---|---|---|---|---|---|
| UN-0034-02 | DR-0034-02 | DD-0034-02 | TK-0034-02 | VT-0034-02 | 工程回放验证通过；目标服务策略阻断新版加载，产品六条未执行 |
| UN-0034-01 | DR-0034-01 | DD-0034-01 | TK-0034-01 | VT-0034-01 | 开发未完成，详情组产品时间映射缺证，其余组暂停 |

## 历史链路

| 版本 | 链路 | 状态 | 说明 |
|---:|---|---|---|
| 7 | workbench/docs/E2E_01_CAPTION_SELF_TEST.md | 开发未完成，产品六条步骤证据回放未验证 | 执行时有序采图和中文回放工程验证完成；目标服务正常切换命令被执行策略拒绝，保留v3服务与31条历史记录，新产品运行0次。 |
| 6 | workbench/docs/E2E_01_CAPTION_SELF_TEST.md | 开发未完成，详情组产品时间映射缺证 | v2详情组实际运行2次且业务结果保留；两条无法精确定位，新增v3重复画面锚安全拒绝并在重启后加载；其余4条未重录。 |
| 5 | workbench/docs/E2E_01_CAPTION_SELF_TEST.md | 开发自测部分完成，产品时间映射未完成 | 目标4322服务空闲且项目/授权身份核对一致；受控重启被执行策略拒绝，产品重录为0；未强停服务或并发共享数据目录。 |
| 4 | workbench/docs/E2E_01_CAPTION_SELF_TEST.md | 开发自测部分完成，产品时间映射未完成 | 无效run_id串记录已修复；增加动态视觉校准标记后独立WebM校准通过；历史六条保留字幕和结果但均无精确跳转，未重录。 |
| 3 | workbench/docs/E2E_01_CAPTION_SELF_TEST.md | 开发自测部分完成，产品时间映射未完成 | 无效run_id串记录已修复；独立WebM校准完成；历史六条保留字幕和结果但均无精确跳转，未重录。 |
| 1 | workbench/docs/E2E_01_CAPTION_SELF_TEST.md | 实施登记 | 新建需求包并冻结自测清单 |
| 2 | workbench/docs/E2E_01_CAPTION_SELF_TEST.md | 开发自测通过，待用户体验确认 | 六条真实运行、媒体与浏览器异常自测记录；候选未批准 |
