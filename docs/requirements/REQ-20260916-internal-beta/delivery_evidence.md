# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-17T11:39:33+08:00`
- Record: `REQ-20260916-internal-beta`
- Change fingerprint: `ae6086deb1c1042a2101c33e4ae7fc6a9394fa156c2a74f3439e30ad817c2be6`
- Verification source: `collector-executed-v1`
- Verification state: `静态检查`
- Command: `node work/optional-dialog-20260917/verify-live.mjs`
- Exit code: `0`
- Test count: `未解析`
- Failure count: `0`
- Skipped count: `未解析`
- Log path: `validation/optional-live-readback-20260917.log`
- Log SHA-256: `0c4e0efbbafeb205c348e1ef9b144a60dd0bc99bddc8c9f33b6a4f94e70512ac`

### Git Status

```text
 M .gitignore
 M README.md
 M optimization/apo_deepseek.py
 M optimization/dataset.mjs
 M optimization/evaluate.mjs
 M optimization/test_apo_bridge.py
 M package-lock.json
 M package.json
 M public/app.js
 M src/browser.mjs
 M src/common.mjs
 M src/controller.mjs
 M src/deepseek.mjs
 M src/demo.mjs
 M src/discovery-browser.mjs
 M src/discovery-memory.mjs
 M src/discovery.mjs
 M src/importer.mjs
 M src/input-review.mjs
 M src/plan-quality.mjs
 M src/plan-repair.mjs
 M src/planning-input.mjs
 M src/plans.mjs
 M src/report-supplement.mjs
 M src/report-view.mjs
 M src/report.mjs
 M src/server.mjs
 M src/store.mjs
 M src/telemetry.mjs
 M tests/browser.integration.mjs
 M tests/console.integration.mjs
 M tests/controller-diagnostics.test.mjs
 M tests/controller-lifecycle.test.mjs
 M tests/core.test.mjs
 M tests/diagnostics.integration.mjs
 M tests/discovery-browser.integration.mjs
 M tests/discovery-controller.test.mjs
 M tests/discovery-controls.test.mjs
 M tests/discovery-memory.test.mjs
 M tests/discovery.integration.mjs
 M tests/discovery.test.mjs
 M tests/evidence-v2.test.mjs
 M tests/examples-repair.test.mjs
 M tests/fixture-model.mjs
 M tests/input-review.test.mjs
 M tests/live-repair.test.mjs
 M tests/model-flow.integration.mjs
 M tests/optimization.test.mjs
 M tests/plan-quality.test.mjs
 M tests/plans-v2.test.mjs
 M tests/reliability.integration.mjs
 M tests/repair-presentation.test.mjs
 M tests/self-repair.test.mjs
 M tests/telemetry.test.mjs
 M 任务说明.md
 M 启动.ps1
?? .prettierignore
?? .prettierrc.json
?? AGENTS.md
?? CLAUDE.md
?? docs/ai_engineering/00_project_brief.md
?? docs/ai_engineering/01_architecture.md
?? docs/ai_engineering/02_rules.md
?? docs/ai_engineering/03_interfaces.md
?? docs/ai_engineering/04_build_test.md
?? docs/ai_engineering/05_decisions_log.md
?? docs/ai_engineering/06_known_issues.md
?? docs/ai_engineering/07_code_model.md
?? docs/ai_engineering/08_ai_workflow.md
?? docs/ai_engineering/README.md
?? docs/changes/README.md
?? docs/changes/_quick_fix_template.md
?? docs/modules/README.md
?? docs/modules/_module_template.md
?? docs/modules/release_runtime.md
?? docs/requirements/README.md
?? docs/requirements/REQ-0000-template/00_user_requirement.md
?? docs/requirements/REQ-0000-template/01_development_requirement.md
?? docs/requirements/REQ-0000-template/02_design.md
?? docs/requirements/REQ-0000-template/03_tasks.md
?? docs/requirements/REQ-0000-template/04_verification.md
?? docs/requirements/REQ-0000-template/05_trace.md
?? docs/requirements/REQ-0000-template/change_log.md
?? docs/requirements/REQ-0000-template/current_state.md
?? docs/requirements/REQ-0000-template/requirement.source.json
?? docs/requirements/REQ-20260916-checkpoints/00_user_requirement.md
?? docs/requirements/REQ-20260916-checkpoints/01_development_requirement.md
?? docs/requirements/REQ-20260916-checkpoints/02_design.md
?? docs/requirements/REQ-20260916-checkpoints/03_tasks.md
?? docs/requirements/REQ-20260916-checkpoints/04_verification.md
?? docs/requirements/REQ-20260916-checkpoints/05_trace.md
?? docs/requirements/REQ-20260916-checkpoints/change_log.md
?? docs/requirements/REQ-20260916-checkpoints/current_state.md
?? docs/requirements/REQ-20260916-internal-beta/00_user_requirement.md
?? docs/requirements/REQ-20260916-internal-beta/01_development_requirement.md
?? docs/requirements/REQ-20260916-internal-beta/02_design.md
?? docs/requirements/REQ-20260916-internal-beta/03_tasks.md
?? docs/requirements/REQ-20260916-internal-beta/04_verification.md
?? docs/requirements/REQ-20260916-internal-beta/05_trace.md
?? docs/requirements/REQ-20260916-internal-beta/change_log.md
?? docs/requirements/REQ-20260916-internal-beta/current_state.md
?? docs/requirements/REQ-20260916-internal-beta/delivery_evidence.md
?? docs/requirements/_change_template.md
?? docs/requirements/_requirement_template.md
?? docs/requirements/inbox.md
?? docs/reusable/README.md
?? docs/reusable/_reusable_template.md
?? docs/reusable/solution_ai_engineering_context_migration.md
?? optimization/prepare-evaluation.mjs
?? requirements-import.txt
?? scripts/ai_context_change_records.py
?? scripts/check_ai_context.py
?? scripts/collect_delivery_evidence.py
?? scripts/create_requirement.py
?? scripts/requirement_source.py
?? scripts/sync_requirement_status.py
?? src/adapter-program.mjs
?? src/adapter-runtime.mjs
?? src/adapter-worker.mjs
?? src/autonomous-recovery.mjs
?? src/block-audit.mjs
?? src/build-info.mjs
?? src/case-entry-url.mjs
?? src/data-maintenance.mjs
?? src/distribution.mjs
?? src/installation.mjs
?? src/model-transport.mjs
?? src/optional-dialog.mjs
?? src/plan-feedback.mjs
?? src/plan-semantics.mjs
?? src/plan-staged.mjs
?? src/plan-steps.mjs
?? src/recording-evidence.mjs
?? src/recovery-gap.mjs
?? src/row-locator.mjs
?? src/step-budget.mjs
?? tests/adapter-program.test.mjs
?? tests/auth-menu-observation.integration.mjs
?? tests/autonomous-evidence.test.mjs
?? tests/autonomous-preparation.integration.mjs
?? tests/block-audit.test.mjs
?? tests/case-entry-url.integration.mjs
?? tests/case-entry-url.test.mjs
?? tests/checkpoints.test.mjs
?? tests/discovery-redirects.integration.mjs
?? tests/evaluation-preparation.test.mjs
?? tests/fixture-recording.mjs
?? tests/fixture-writer.mjs
?? tests/installation.test.mjs
?? tests/launcher.integration.mjs
?? tests/model-transport.test.mjs
?? tests/optional-dialog-flow.integration.mjs
?? tests/optional-dialog.integration.mjs
?? tests/optional-dialog.test.mjs
?? tests/plan-staged.test.mjs
?? tests/recording-evidence.test.mjs
?? tests/recording-isolation.integration.mjs
?? tests/recording.integration.mjs
?? tests/release-boundaries.test.mjs
?? tests/repair-contracts.test.mjs
?? tests/row-locator.integration.mjs
?? tests/runtime-regression.mjs
?? work/claude-supervision/20260916-autonomy/agent-pilot.mjs
?? work/claude-supervision/20260916-autonomy/auth-repro.mjs
?? work/claude-supervision/20260916-autonomy/auth-reproduction.json
?? work/claude-supervision/20260916-autonomy/claude-generation.json
?? work/claude-supervision/20260916-autonomy/fixture/README.md
?? work/claude-supervision/20260916-autonomy/fixture/cases.json
?? work/claude-supervision/20260916-autonomy/fixture/evidence/2026-09-16T14-14-52-480Z/auto-login-dashboard-only.png
?? work/claude-supervision/20260916-autonomy/fixture/evidence/2026-09-16T14-14-52-480Z/normal-dashboard.png
?? work/claude-supervision/20260916-autonomy/fixture/evidence/2026-09-16T14-14-52-480Z/normal-day-detail.png
?? work/claude-supervision/20260916-autonomy/fixture/evidence/2026-09-16T14-14-52-480Z/normal-directory.png
?? work/claude-supervision/20260916-autonomy/fixture/evidence/2026-09-16T14-14-52-480Z/normal-night-detail.png
?? work/claude-supervision/20260916-autonomy/fixture/evidence/2026-09-16T14-14-52-480Z/obstacle-dismissed-directory.png
?? work/claude-supervision/20260916-autonomy/fixture/evidence/2026-09-16T14-14-52-480Z/obstacle-first-notice.png
?? work/claude-supervision/20260916-autonomy/fixture/evidence/2026-09-16T14-14-52-480Z/smoke-result.json
?? work/claude-supervision/20260916-autonomy/fixture/evidence/host-initialization.json
?? work/claude-supervision/20260916-autonomy/fixture/server.mjs
?? work/claude-supervision/20260916-autonomy/fixture/smoke.mjs
?? work/claude-supervision/20260916-autonomy/normal-diagnostics.json
?? work/claude-supervision/20260916-autonomy/normal-facts.json
?? work/claude-supervision/20260916-autonomy/normal-operator-capture.json
?? work/claude-supervision/20260916-autonomy/normal-report.html
?? work/claude-supervision/20260916-autonomy/normal-state.json
?? work/claude-supervision/20260916-autonomy/optional-dialog-20260917/normal-diagnostics.json
?? work/claude-supervision/20260916-autonomy/optional-dialog-20260917/normal-facts.json
?? work/claude-supervision/20260916-autonomy/optional-dialog-20260917/normal-report.html
?? work/claude-supervision/20260916-autonomy/optional-dialog-20260917/normal-state.json
?? work/claude-supervision/20260916-autonomy/optional-dialog-20260917/pilot-tasks.json
?? work/claude-supervision/20260916-autonomy/pilot-tasks.json
?? work/claude-supervision/20260916-autonomy/postfix-495afc/normal-diagnostics.json
?? work/claude-supervision/20260916-autonomy/postfix-495afc/normal-facts.json
?? work/claude-supervision/20260916-autonomy/postfix-495afc/normal-report.html
?? work/claude-supervision/20260916-autonomy/postfix-495afc/normal-state.json
?? work/claude-supervision/20260916-autonomy/postfix-495afc/pilot-tasks.json
?? work/claude-supervision/20260916-autonomy/postfix-495afc/verified-summary.json
?? work/claude-supervision/20260916-autonomy/postfix-495afc/verify-evidence.mjs
?? work/claude-supervision/20260916-autonomy/postfix-495afc/真实模型复测结论.md
?? work/claude-supervision/20260916-autonomy/postfix-observation/catalog.png
?? work/claude-supervision/20260916-autonomy/postfix-observation/homepage.png
?? work/claude-supervision/20260916-autonomy/postfix-observation/summary.json
?? work/claude-supervision/20260916-autonomy/postfix-service.json
?? work/claude-supervision/20260916-autonomy/repair-validation.mjs
?? work/claude-supervision/20260916-autonomy/row-repair-20260917/normal-diagnostics.json
?? work/claude-supervision/20260916-autonomy/row-repair-20260917/normal-facts.json
?? work/claude-supervision/20260916-autonomy/row-repair-20260917/normal-report.html
?? work/claude-supervision/20260916-autonomy/row-repair-20260917/normal-state.json
?? work/claude-supervision/20260916-autonomy/row-repair-20260917/pilot-tasks.json
?? work/claude-supervision/20260916-autonomy/service-switch.mjs
?? work/claude-supervision/20260916-autonomy/supervisor-check.log
?? work/claude-supervision/20260916-autonomy/supervisor-check.mjs
?? work/claude-supervision/20260916-autonomy/supervisor-home.png
?? work/claude-supervision/20260916-autonomy/supervisor-list.png
?? work/claude-supervision/20260916-autonomy/task.md
?? work/claude-supervision/20260916-autonomy/修复与入口URL验证.md
?? work/claude-supervision/20260916-autonomy/试跑结论.md
?? work/claude-supervision/20260917-kimi-repair/prompt-1.md
?? work/claude-supervision/20260917-kimi-repair/prompt-2.md
?? work/claude-supervision/20260917-kimi-repair/reply-1.md
?? work/claude-supervision/20260917-kimi-repair/reply-2.md
?? work/claude-supervision/20260917-kimi-repair/会诊结论与修改方案.md
?? work/luna-supervision/20260916-autonomy/L1/task.md
?? work/luna-supervision/20260916-autonomy/kimi-consult.md
?? work/luna-supervision/20260916-autonomy/supervisor-status.md
?? work/optional-dialog-20260917/align-prompts.mjs
?? work/optional-dialog-20260917/fixture.stderr.log
?? work/optional-dialog-20260917/fixture.stdout.log
?? work/optional-dialog-20260917/service-after.json
?? work/optional-dialog-20260917/service-before.json
?? work/optional-dialog-20260917/verified-live-summary.json
?? work/optional-dialog-20260917/verify-live.mjs
?? work/optional-dialog-20260917/verify-service.mjs
?? work/optional-dialog-20260917/修复验收.md
?? work/repair-loop-20260917/before/public/app.js
?? work/repair-loop-20260917/before/src/autonomous-recovery.mjs
?? work/repair-loop-20260917/before/src/browser.mjs
?? work/repair-loop-20260917/before/src/case-entry-url.mjs
?? work/repair-loop-20260917/before/src/controller.mjs
?? work/repair-loop-20260917/before/src/discovery-browser.mjs
?? work/repair-loop-20260917/before/src/discovery.mjs
?? work/repair-loop-20260917/before/src/plan-quality.mjs
?? work/repair-loop-20260917/before/src/plan-repair.mjs
?? work/repair-loop-20260917/before/src/planning-input.mjs
?? work/repair-loop-20260917/before/src/plans.mjs
?? work/repair-loop-20260917/before/src/server.mjs
?? work/repair-loop-20260917/frozen-candidates-result.json
?? work/repair-loop-20260917/frozen-candidates.mjs
?? work/repair-loop-20260917/service-after-final.json
?? work/repair-loop-20260917/service-after.json
?? work/repair-loop-20260917/service-before.json
?? work/repair-loop-20260917/service-check.mjs
?? work/repair-loop-20260917/verified-live-summary.json
?? work/repair-loop-20260917/verify-live.mjs
?? work/repair-loop-20260917/修复验收.md
?? 停止.cmd
?? 停止.ps1
?? 备份数据.cmd
?? 备份数据.ps1
?? 安装.cmd
?? 安装.ps1
?? 恢复启动.cmd
?? 恢复启动.ps1
?? 环境检查.cmd
?? 环境检查.ps1
?? 试用说明.md
```

### Git Diff Stat

```text
warning: in the working copy of '.gitignore', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'optimization/apo_deepseek.py', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'optimization/dataset.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'optimization/evaluate.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'optimization/test_apo_bridge.py', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'package-lock.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'package.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'public/app.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/browser.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/common.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/controller.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/deepseek.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/demo.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/discovery-browser.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/discovery-memory.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/discovery.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/importer.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/input-review.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/plan-quality.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/plan-repair.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/planning-input.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/plans.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/report-supplement.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/report-view.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/report.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/server.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/store.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/telemetry.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/browser.integration.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/console.integration.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/controller-diagnostics.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/controller-lifecycle.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/core.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/diagnostics.integration.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/discovery-browser.integration.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/discovery-controller.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/discovery-controls.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/discovery-memory.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/discovery.integration.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/discovery.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/evidence-v2.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/examples-repair.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/fixture-model.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/input-review.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/live-repair.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/model-flow.integration.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/optimization.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/plan-quality.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/plans-v2.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/reliability.integration.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/repair-presentation.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/self-repair.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/telemetry.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of '任务说明.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of '启动.ps1', LF will be replaced by CRLF the next time Git touches it
 .gitignore                                         |    1 +
 README.md                                          |   36 +-
 optimization/apo_deepseek.py                       |    6 +
 optimization/dataset.mjs                           |  265 ++-
 optimization/evaluate.mjs                          |  259 ++-
 optimization/test_apo_bridge.py                    |   19 +
 package-lock.json                                  |   48 +-
 package.json                                       |   19 +-
 public/app.js                                      | 1138 +++++++++++--
 src/browser.mjs                                    | 1749 ++++++++++++++++---
 src/common.mjs                                     |  108 +-
 src/controller.mjs                                 | 1797 ++++++++++++++++----
 src/deepseek.mjs                                   |  264 ++-
 src/demo.mjs                                       |  259 ++-
 src/discovery-browser.mjs                          | 1275 +++++++++++---
 src/discovery-memory.mjs                           |  196 ++-
 src/discovery.mjs                                  |  191 ++-
 src/importer.mjs                                   |  148 +-
 src/input-review.mjs                               |  280 +--
 src/plan-quality.mjs                               |  252 ++-
 src/plan-repair.mjs                                |  597 +++++--
 src/planning-input.mjs                             |  171 +-
 src/plans.mjs                                      |  565 ++++--
 src/report-supplement.mjs                          |   99 +-
 src/report-view.mjs                                |  236 ++-
 src/report.mjs                                     |  173 +-
 src/server.mjs                                     |  472 +++--
 src/store.mjs                                      |  728 ++++++--
 src/telemetry.mjs                                  |  225 ++-
 tests/browser.integration.mjs                      |  141 +-
 tests/console.integration.mjs                      |  197 ++-
 tests/controller-diagnostics.test.mjs              |  540 ++++--
 tests/controller-lifecycle.test.mjs                |  245 ++-
 tests/core.test.mjs                                |  542 +++++-
 tests/diagnostics.integration.mjs                  |  448 +++--
 tests/discovery-browser.integration.mjs            |  538 ++++--
 tests/discovery-controller.test.mjs                |  563 ++++--
 tests/discovery-controls.test.mjs                  |  386 +++--
 tests/discovery-memory.test.mjs                    |  480 ++++--
 tests/discovery.integration.mjs                    |  733 ++++++--
 tests/discovery.test.mjs                           |  214 ++-
 tests/evidence-v2.test.mjs                         |  461 +++--
 tests/examples-repair.test.mjs                     |  242 ++-
 tests/fixture-model.mjs                            |  113 +-
 tests/input-review.test.mjs                        |  349 +++-
 tests/live-repair.test.mjs                         |  163 +-
 tests/model-flow.integration.mjs                   |  259 ++-
 tests/optimization.test.mjs                        |  175 +-
 tests/plan-quality.test.mjs                        |  382 ++++-
 tests/plans-v2.test.mjs                            |  366 ++--
 tests/reliability.integration.mjs                  |  432 ++++-
 tests/repair-presentation.test.mjs                 |  217 ++-
 tests/self-repair.test.mjs                         |  976 ++++++++---
 tests/telemetry.test.mjs                           |  452 ++++-
 ...273\273\345\212\241\350\257\264\346\230\216.md" |   92 +
 "\345\220\257\345\212\250.ps1"                     |   48 +-
 56 files changed, 16941 insertions(+), 4389 deletions(-)
```

### Untracked Files

```text
.prettierignore
.prettierrc.json
AGENTS.md
CLAUDE.md
docs/ai_engineering/00_project_brief.md
docs/ai_engineering/01_architecture.md
docs/ai_engineering/02_rules.md
docs/ai_engineering/03_interfaces.md
docs/ai_engineering/04_build_test.md
docs/ai_engineering/05_decisions_log.md
docs/ai_engineering/06_known_issues.md
docs/ai_engineering/07_code_model.md
docs/ai_engineering/08_ai_workflow.md
docs/ai_engineering/README.md
docs/changes/README.md
docs/changes/_quick_fix_template.md
docs/modules/README.md
docs/modules/_module_template.md
docs/modules/release_runtime.md
docs/requirements/README.md
docs/requirements/REQ-0000-template/00_user_requirement.md
docs/requirements/REQ-0000-template/01_development_requirement.md
docs/requirements/REQ-0000-template/02_design.md
docs/requirements/REQ-0000-template/03_tasks.md
docs/requirements/REQ-0000-template/04_verification.md
docs/requirements/REQ-0000-template/05_trace.md
docs/requirements/REQ-0000-template/change_log.md
docs/requirements/REQ-0000-template/current_state.md
docs/requirements/REQ-0000-template/requirement.source.json
docs/requirements/REQ-20260916-checkpoints/00_user_requirement.md
docs/requirements/REQ-20260916-checkpoints/01_development_requirement.md
docs/requirements/REQ-20260916-checkpoints/02_design.md
docs/requirements/REQ-20260916-checkpoints/03_tasks.md
docs/requirements/REQ-20260916-checkpoints/04_verification.md
docs/requirements/REQ-20260916-checkpoints/05_trace.md
docs/requirements/REQ-20260916-checkpoints/change_log.md
docs/requirements/REQ-20260916-checkpoints/current_state.md
docs/requirements/REQ-20260916-internal-beta/00_user_requirement.md
docs/requirements/REQ-20260916-internal-beta/01_development_requirement.md
docs/requirements/REQ-20260916-internal-beta/02_design.md
docs/requirements/REQ-20260916-internal-beta/03_tasks.md
docs/requirements/REQ-20260916-internal-beta/04_verification.md
docs/requirements/REQ-20260916-internal-beta/05_trace.md
docs/requirements/REQ-20260916-internal-beta/change_log.md
docs/requirements/REQ-20260916-internal-beta/current_state.md
docs/requirements/REQ-20260916-internal-beta/delivery_evidence.md
docs/requirements/_change_template.md
docs/requirements/_requirement_template.md
docs/requirements/inbox.md
docs/reusable/README.md
docs/reusable/_reusable_template.md
docs/reusable/solution_ai_engineering_context_migration.md
optimization/prepare-evaluation.mjs
requirements-import.txt
scripts/ai_context_change_records.py
scripts/check_ai_context.py
scripts/collect_delivery_evidence.py
scripts/create_requirement.py
scripts/requirement_source.py
scripts/sync_requirement_status.py
src/adapter-program.mjs
src/adapter-runtime.mjs
src/adapter-worker.mjs
src/autonomous-recovery.mjs
src/block-audit.mjs
src/build-info.mjs
src/case-entry-url.mjs
src/data-maintenance.mjs
src/distribution.mjs
src/installation.mjs
src/model-transport.mjs
src/optional-dialog.mjs
src/plan-feedback.mjs
src/plan-semantics.mjs
src/plan-staged.mjs
src/plan-steps.mjs
src/recording-evidence.mjs
src/recovery-gap.mjs
src/row-locator.mjs
src/step-budget.mjs
tests/adapter-program.test.mjs
tests/auth-menu-observation.integration.mjs
tests/autonomous-evidence.test.mjs
tests/autonomous-preparation.integration.mjs
tests/block-audit.test.mjs
tests/case-entry-url.integration.mjs
tests/case-entry-url.test.mjs
tests/checkpoints.test.mjs
tests/discovery-redirects.integration.mjs
tests/evaluation-preparation.test.mjs
tests/fixture-recording.mjs
tests/fixture-writer.mjs
tests/installation.test.mjs
tests/launcher.integration.mjs
tests/model-transport.test.mjs
tests/optional-dialog-flow.integration.mjs
tests/optional-dialog.integration.mjs
tests/optional-dialog.test.mjs
tests/plan-staged.test.mjs
tests/recording-evidence.test.mjs
tests/recording-isolation.integration.mjs
tests/recording.integration.mjs
tests/release-boundaries.test.mjs
tests/repair-contracts.test.mjs
tests/row-locator.integration.mjs
tests/runtime-regression.mjs
work/claude-supervision/20260916-autonomy/agent-pilot.mjs
work/claude-supervision/20260916-autonomy/auth-repro.mjs
work/claude-supervision/20260916-autonomy/auth-reproduction.json
work/claude-supervision/20260916-autonomy/claude-generation.json
work/claude-supervision/20260916-autonomy/fixture/README.md
work/claude-supervision/20260916-autonomy/fixture/cases.json
work/claude-supervision/20260916-autonomy/fixture/evidence/2026-09-16T14-14-52-480Z/auto-login-dashboard-only.png
work/claude-supervision/20260916-autonomy/fixture/evidence/2026-09-16T14-14-52-480Z/normal-dashboard.png
work/claude-supervision/20260916-autonomy/fixture/evidence/2026-09-16T14-14-52-480Z/normal-day-detail.png
work/claude-supervision/20260916-autonomy/fixture/evidence/2026-09-16T14-14-52-480Z/normal-directory.png
work/claude-supervision/20260916-autonomy/fixture/evidence/2026-09-16T14-14-52-480Z/normal-night-detail.png
work/claude-supervision/20260916-autonomy/fixture/evidence/2026-09-16T14-14-52-480Z/obstacle-dismissed-directory.png
work/claude-supervision/20260916-autonomy/fixture/evidence/2026-09-16T14-14-52-480Z/obstacle-first-notice.png
work/claude-supervision/20260916-autonomy/fixture/evidence/2026-09-16T14-14-52-480Z/smoke-result.json
work/claude-supervision/20260916-autonomy/fixture/evidence/host-initialization.json
work/claude-supervision/20260916-autonomy/fixture/server.mjs
work/claude-supervision/20260916-autonomy/fixture/smoke.mjs
work/claude-supervision/20260916-autonomy/normal-diagnostics.json
work/claude-supervision/20260916-autonomy/normal-facts.json
work/claude-supervision/20260916-autonomy/normal-operator-capture.json
work/claude-supervision/20260916-autonomy/normal-report.html
work/claude-supervision/20260916-autonomy/normal-state.json
work/claude-supervision/20260916-autonomy/optional-dialog-20260917/normal-diagnostics.json
work/claude-supervision/20260916-autonomy/optional-dialog-20260917/normal-facts.json
work/claude-supervision/20260916-autonomy/optional-dialog-20260917/normal-report.html
work/claude-supervision/20260916-autonomy/optional-dialog-20260917/normal-state.json
work/claude-supervision/20260916-autonomy/optional-dialog-20260917/pilot-tasks.json
work/claude-supervision/20260916-autonomy/pilot-tasks.json
work/claude-supervision/20260916-autonomy/postfix-495afc/normal-diagnostics.json
work/claude-supervision/20260916-autonomy/postfix-495afc/normal-facts.json
work/claude-supervision/20260916-autonomy/postfix-495afc/normal-report.html
work/claude-supervision/20260916-autonomy/postfix-495afc/normal-state.json
work/claude-supervision/20260916-autonomy/postfix-495afc/pilot-tasks.json
work/claude-supervision/20260916-autonomy/postfix-495afc/verified-summary.json
work/claude-supervision/20260916-autonomy/postfix-495afc/verify-evidence.mjs
work/claude-supervision/20260916-autonomy/postfix-495afc/真实模型复测结论.md
work/claude-supervision/20260916-autonomy/postfix-observation/catalog.png
work/claude-supervision/20260916-autonomy/postfix-observation/homepage.png
work/claude-supervision/20260916-autonomy/postfix-observation/summary.json
work/claude-supervision/20260916-autonomy/postfix-service.json
work/claude-supervision/20260916-autonomy/repair-validation.mjs
work/claude-supervision/20260916-autonomy/row-repair-20260917/normal-diagnostics.json
work/claude-supervision/20260916-autonomy/row-repair-20260917/normal-facts.json
work/claude-supervision/20260916-autonomy/row-repair-20260917/normal-report.html
work/claude-supervision/20260916-autonomy/row-repair-20260917/normal-state.json
work/claude-supervision/20260916-autonomy/row-repair-20260917/pilot-tasks.json
work/claude-supervision/20260916-autonomy/service-switch.mjs
work/claude-supervision/20260916-autonomy/supervisor-check.log
work/claude-supervision/20260916-autonomy/supervisor-check.mjs
work/claude-supervision/20260916-autonomy/supervisor-home.png
work/claude-supervision/20260916-autonomy/supervisor-list.png
work/claude-supervision/20260916-autonomy/task.md
work/claude-supervision/20260916-autonomy/修复与入口URL验证.md
work/claude-supervision/20260916-autonomy/试跑结论.md
work/claude-supervision/20260917-kimi-repair/prompt-1.md
work/claude-supervision/20260917-kimi-repair/prompt-2.md
work/claude-supervision/20260917-kimi-repair/reply-1.md
work/claude-supervision/20260917-kimi-repair/reply-2.md
work/claude-supervision/20260917-kimi-repair/会诊结论与修改方案.md
work/luna-supervision/20260916-autonomy/L1/task.md
work/luna-supervision/20260916-autonomy/kimi-consult.md
work/luna-supervision/20260916-autonomy/supervisor-status.md
work/optional-dialog-20260917/align-prompts.mjs
work/optional-dialog-20260917/fixture.stderr.log
work/optional-dialog-20260917/fixture.stdout.log
work/optional-dialog-20260917/service-after.json
work/optional-dialog-20260917/service-before.json
work/optional-dialog-20260917/verified-live-summary.json
work/optional-dialog-20260917/verify-live.mjs
work/optional-dialog-20260917/verify-service.mjs
work/optional-dialog-20260917/修复验收.md
work/repair-loop-20260917/before/public/app.js
work/repair-loop-20260917/before/src/autonomous-recovery.mjs
work/repair-loop-20260917/before/src/browser.mjs
work/repair-loop-20260917/before/src/case-entry-url.mjs
work/repair-loop-20260917/before/src/controller.mjs
work/repair-loop-20260917/before/src/discovery-browser.mjs
work/repair-loop-20260917/before/src/discovery.mjs
work/repair-loop-20260917/before/src/plan-quality.mjs
work/repair-loop-20260917/before/src/plan-repair.mjs
work/repair-loop-20260917/before/src/planning-input.mjs
work/repair-loop-20260917/before/src/plans.mjs
work/repair-loop-20260917/before/src/server.mjs
work/repair-loop-20260917/frozen-candidates-result.json
work/repair-loop-20260917/frozen-candidates.mjs
work/repair-loop-20260917/service-after-final.json
work/repair-loop-20260917/service-after.json
work/repair-loop-20260917/service-before.json
work/repair-loop-20260917/service-check.mjs
work/repair-loop-20260917/verified-live-summary.json
work/repair-loop-20260917/verify-live.mjs
work/repair-loop-20260917/修复验收.md
停止.cmd
停止.ps1
备份数据.cmd
备份数据.ps1
安装.cmd
安装.ps1
恢复启动.cmd
恢复启动.ps1
环境检查.cmd
环境检查.ps1
试用说明.md
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-17T11:39:32+08:00
Command: node work/optional-dialog-20260917/verify-live.mjs
Exit code: 0
Parsed test count: unavailable
Parsed failure count: 0
Parsed skipped count: unavailable

--- command output ---
{
  "at": "2026-09-17T03:39:32.762Z",
  "scope": "original synthetic LOCAL-002 on frozen runtime; readback only, no new model call or browser execution",
  "build_id": "21732433cbf299061f2901b2b91bf1b2573153a1a6829574ba782be5422d7ee5",
  "task_id": "c824e77f-285a-46d4-8ac6-dd5ed726deab",
  "run_id": "e4225630-5a0a-4bc0-8f92-46894c0693a7",
  "prepare_jobs": 1,
  "model_requests": 9,
  "token_usage": {
    "prompt_tokens": 99529,
    "completion_tokens": 4774,
    "known_prompt_calls": 9,
    "known_completion_calls": 9,
    "unknown_calls": 0
  },
  "automatic_repairs": 2,
  "manual_plan_feedback": 0,
  "manual_browser_navigation": 0,
  "approval": "main-agent independent review then existing approval endpoint",
  "executed_cases": 1,
  "steps": 8,
  "assertions": 10,
  "executed_clicks": 4,
  "conditional_branch": "ABSENT",
  "conditional_click_dispatched": false,
  "obstruction_target": {
    "kind": "row",
    "table": {
      "kind": "role",
      "role": "table",
      "name": "费率目录",
      "exact": true
    },
    "key": {
      "column": "方案名称",
      "value": "工业日间方案"
    },
    "target": {
      "kind": "role",
      "role": "button",
      "name": "查看详情",
      "exact": true
    }
  },
  "obstruction_sample": {
    "scope": "target_visible_viewport_five_points",
    "onscreen": true,
    "modal_blocked": false,
    "inert_or_disabled": false,
    "transparent": false,
    "points": [
      {
        "x": 1167.6,
        "y": 390,
        "receives_events": true,
        "hit_tag": "BUTTON"
      },
      {
        "x": 1144.2,
        "y": 380,
        "receives_events": true,
        "hit_tag": "BUTTON"
      },
      {
        "x": 1191,
        "y": 380,
        "receives_events": true,
        "hit_tag": "BUTTON"
      },
      {
        "x": 1144.2,
        "y": 400,
        "receives_events": true,
        "hit_tag": "BUTTON"
      },
      {
        "x": 1191,
        "y": 400,
        "receives_events": true,
        "hit_tag": "BUTTON"
      }
    ]
  },
  "verified_media": 9,
  "media_visual_review": "representative screenshots reviewed separately; video playback not claimed",
  "other_cases": "LOCAL-001 and LOCAL-003 NOT_EXECUTED this round; historical results not reused",
  "old_evidence_unchanged": true,
  "active_job": false,
  "limits": "present branch has fixed-browser engineering evidence, not this real-model run; not real business or full release acceptance"
}
```

### Sync Record Status

```text
DRY-RUN: no derived changes for REQ-20260916-internal-beta; explicit implementation states retained, never inferred from verification.
```

### Check AI Context

- Exit code: `1`

```text
FAIL ai-engineering-context checks

1. docs\requirements\REQ-20260916-internal-beta\current_state.md
   Problem: Document claims tests/build passed while failure, skipped-test, timeout, or non-zero evidence is present.
   Fix: Downgrade verification to `无法运行` / `未运行` / `仅静态检查` / failure, and keep the original command output.
2. docs
   Problem: Code/test/config changes are linked to multiple or mixed governance records.
   Fix: Keep one changed FIX or one changed real REQ for this delivery, or split the work. Changed records: REQ-20260916-checkpoints, REQ-20260916-internal-beta
```

### Notes

本命令仅回读已执行的原合成LOCAL-002证据，无新增模型调用或浏览器执行；1次准备/9次请求、2次内部修复、8步骤/10断言，条件未出现分支。工程与真实模型证据分层，其他两例本轮未执行，非完整发布验收。
