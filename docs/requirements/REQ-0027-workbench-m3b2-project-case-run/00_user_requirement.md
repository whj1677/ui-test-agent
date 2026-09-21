<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0027 用户需求

## 原始输入

> 从5e2a2d8基线在现有工作台中选择一条真实Excel导入的已确认合成用例，明确启动最多一次Harness，由固定deepseek-v4-pro生成新候选，使用同一候选完成正常与独立反例验证，并从项目页面查看结果、截图、录像和Trace入口；停在等待人工核对或具体失败。

## 结构化理解

| UN | 状态 | 目标 | 约束 | 成功标准 |
|---|---|---|---|---|
| UN-0027-01 | 已确认 | 完成项目单条用例从真实Web导入、冻结、明确启动、Harness建例、独立验证到项目页面结果和媒体读回的闭环。 | 本批最多1次初始Harness启动，30次工具调用/600秒；不修订、不重试、不批量、不自动批准；历史INPUT_ONLY任务、M1/M2资产和批准脚本不变。 | 所选项目用例冻结输入实际进入attempt工作目录并由Harness读取；产生新候选后，同一哈希在正常页通过且反例取得与该用例绑定的期望/实际差异；Web、后台、报告和媒体一致，重启可读。 |

## 已确认事实

- 基线5e2a2d83b269fa516fbaba8a29abeba84913e293已建立独立分支codex/test-workbench-m3b2-project-case-run。
- 锁定依赖为dsh 0.1.6-alpha.2、deepseek-official/deepseek-v4-pro和Playwright Test 1.62.1；本批不升级。
- M3-B1项目用例任务已冻结task.md、input/case-snapshot.json和Agent指令模板，但统一为INPUT_ONLY；M3-B2只能授权本批新任务。
- 真实调用在操作员确认误暴露的旧凭据已撤销并替换后，通过遮蔽输入前台窗口提供；公开文件、提示词和普通日志未保存明文。
- 真实任务build-20260921120911-48d7c545生成候选4B183AD25305913547C309A86F273DAAB861004313385A5DEF3094385F3B0730，正常通过、反例取得PROBE-42/PROBE-41差异并停在WAITING_HUMAN_REVIEW。
- 唯一授权已按Harness process_spawn消耗为1/1；外层Web选择器修复后的同任务零模型读回没有增加启动次数。
- 正式工程验证命令npm --prefix workbench test在仓库根目录执行，退出码0，60项测试、0失败、0跳过；日志为docs/requirements/REQ-0027-workbench-m3b2-project-case-run/logs/workbench-tests.log。

## 推断与待确认

- 供应商接口未返回底层请求数、token usage或货币成本，均保持未知。
