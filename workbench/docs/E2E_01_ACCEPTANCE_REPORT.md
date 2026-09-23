# E2E-01 六用例工作台自动建例与执行闭环：实际验证

日期：2026-09-23。状态：**技术验证通过，等待人工核对**。三份产品候选均由新墨白工作台调用锁定的 DSH `0.1.6-alpha.2` / `deepseek-official` / `deepseek-flash` Harness 会话生成；没有登记人工首审或批准资产。工程参考脚本和工程预检均不计入下表。

工作台：<http://127.0.0.1:4322/workspace/>。项目：**E2E-01 六用例工作台自动建例闭环**，ID `project-61579c25-2833-4c41-b592-357e1b306026`。独立数据目录：`workbench/.local/six-case-e2e`。TEST-SITE-01：<http://127.0.0.1:4320/ui/a>。

## 故障根因与修复

先前两次初稿在约 0.3 秒退出，均只有 1,914 字节 stderr。补充脱敏诊断后，第三次同症状复现明确报 `ENOENT`：工作台将相对于 `workbench` 的 `../harness-probe/config/browser-flash.cordis.yml` 原样传给 DSH，DSH 却从每次建例的深层 attempt 目录解析该路径。修复后，工作台在启动任务前将 patch 路径解析为绝对路径。受控复验中 DSH 实际完成浏览器观察、生成候选和正常页试跑。

修复期间还发现 Playwright 的数组文本差异被报告解析器误判为定位失败。原始 TC-005 运行在第 2 步失败，原报告和媒体保留；解析器现从原始差异重建完整的预期/实际设备顺序，且零元素定位仍不能算指定缺陷。使用原候选、原入口和原预期再试跑一次，新的 TC-005 记录如实标记指定缺陷。没有修改候选或原始 Playwright 报告。

工作台只在同哈希正常运行完整通过、配对运行保持原始 `FAILED / complete_pass=false` 且检出指定差异、两边媒体齐全时，才将任务置为 `TECHNICAL_VALIDATION_PASSED / WAITING_REVIEW`。三个现有任务从已保存的运行事实校正状态，候选 `approved=false`；没有重放或改写既有运行。

## 六条产品运行

| 用例 | 对应工作台任务 / 候选 | 实际运行 ID | 原始状态 | 关键步骤和预期/实际 | 媒体 |
|---|---|---|---|---|---|
| TC-001 查询正常 | `build-20260923025026-03dfb09e` / v2 | `run-91f7c675-239d-4736-8f10-43e9e1d46525` | PASSED；complete_pass=true | CASE_STEP_1～3 均通过 | 截图、录像、Trace 各 1 |
| TC-002 排序正常 | `build-20260923025157-98c45421` / v1 | `run-0271a569-5ac4-46d0-b6a6-2892c57cbc9a` | PASSED；complete_pass=true | CASE_STEP_1～2 均通过 | 截图、录像、Trace 各 1 |
| TC-003 详情正常 | `build-20260923025549-922a763f` / v1 | `run-181fe9f3-5c98-4426-bfd9-96ba54210031` | PASSED；complete_pass=true | CASE_STEP_1～3 均通过 | 截图、录像、Trace 各 1 |
| TC-004 查询故障 | TC-001 同一候选 v2 | `run-c0dffdf4-5953-4c38-b6b2-71be1c43d04e` | FAILED；complete_pass=false；检出指定缺陷 | CASE_STEP_3：期望“共2条”，实际“共3条” | 截图、录像、Trace 各 1 |
| TC-005 排序故障 | TC-002 同一候选 v1 | `run-f08aadb1-4ae7-40e8-aa40-3b5e9e88fc2c` | FAILED；complete_pass=false；检出指定缺陷 | CASE_STEP_2：期望 DEV-005、DEV-006、DEV-002、DEV-004、DEV-001、DEV-003；实际 DEV-005、DEV-002、DEV-006、DEV-004、DEV-001、DEV-003 | 截图、录像、Trace 各 1 |
| TC-006 详情故障 | TC-003 同一候选 v1 | `run-0d50b295-883d-4454-ab25-ad62375033df` | FAILED；complete_pass=false；检出指定缺陷 | CASE_STEP_2：期望 220 kW，实际 320 kW；CASE_STEP_3 为 NOT_EXECUTED | 截图、录像、Trace 各 1 |

三份候选的文件 SHA-256 与记录相符，同组正常/故障记录的候选哈希一致：TC-001/004 `A82F9A7BF5B3D464E7FF8B65EBCF760757CC9E812863122E77CA21697DDBD255`；TC-002/005 `EE472C0293CC4DCD35C881BBBC8D360E71ABCE069615D03844255ABC4A407E93`；TC-003/006 `1F1C3CD75E2BAAC6338B1C86273C32D52D2B848852B903D2F05E5A1E862B6A04`。人工核对时仍需审阅候选内容和交互体验。

项目执行记录目前共 **8** 条，另外两条也保留：TC-001 首稿正常页因错误表格定位而失败，随后工作台 Harness 按正常页反馈生成 v2；TC-005 在解析修复前的原始失败记录 `run-d59a52e9-bf00-4acb-a3c3-0b7218160147` 当时显示 `specified_defect_detected=false`，没有倒填或删除。六条目标记录按上表 ID 识别。

## 来源、预算与读回

六用例官方 JSON 包经新页面预览并导入：新增 6、重复 0、冲突 0、不可导入 0。建例器仅收到相应正常用例、正常入口和必要页面观察；故障入口及已知差异仅保存在执行绑定。TC-001 的 v2 是工作台调用的 Harness 修订，反馈只包含正常页定位失败。未使用 `trial-site/reference` 参考脚本作为产品候选，未改六条源用例、被测页面或历史资产。

工作台授权账本保留最初六条进程启动：前三条为 patch 路径错误，其中两条为先前 UI 任务，一条为错误定位复现；修复后的 TC-001/002/003 首稿为后三条。用户放宽额度后，另记一次从 6 到 7 的恢复授权，用于 TC-001 的正常页反馈修订；当前为 **7/7**，原 claims 未清零。每次产品 Harness 会话仍限 30 次工具调用、600 秒；四次成功会话分别观察到 16、17、15、14 次工具调用。此前独立文本/浏览器诊断不计产品候选；供应商底层请求数、usage、费用未返回，均记未知。Codex 具体子型号及推理档位不可取得，记未知。

服务重启后，项目记录 API 仍返回 8 条历史运行和上述六条目标结果，三条任务均为 `WAITING_HUMAN_REVIEW / TECHNICAL_VALIDATION_PASSED / WAITING_REVIEW`，候选均未批准。六条目标记录的 18 个媒体入口分别以正确类型返回 HTTP 206 分段读取；浏览器项目执行记录页显示 8 行、8 个录像控件，六条目标用例均可见。页面截图留在独立本地目录 `workbench/.local/six-case-e2e/e2e01-result-workspace.png`，不随 Git 提交。操作入口和旧记录辨认方法见 [用户指南](E2E_01_USER_GUIDE.md)。

工程验证：受影响的诊断、建例管理、报告解析、恢复账本及完成状态测试 19/19 通过；`npm test` 全量 89/89，通过、失败 0、跳过 0；`node tests/e2e01-preflight.integration.mjs` 退出 0，但该临时脚本仅是接线工程预检，不计六条产品结果。正式门禁结果见本次提交及 REQ-0033 证据记录。
