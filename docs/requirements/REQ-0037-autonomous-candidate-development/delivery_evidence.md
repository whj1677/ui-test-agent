# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-25T22:42:52+08:00`
- Record: `REQ-0037-autonomous-candidate-development`
- Change fingerprint: `63076db4e5297658e53ae8d203cee71fe536205506827490d77986e1fe885fcf`
- Verification source: `collector-executed-v1`
- Verification state: `单元测试通过`
- Command: `npm test`
- Exit code: `0`
- Test count: `65`
- Failure count: `0`
- Skipped count: `0`
- Log path: `workbench/qa/20260925-independent-ui/supervisor/engineering-tests-final.log`
- Log SHA-256: `5f917037c86ff918e4adb80baa6b339a81e874c654bb31d78496b3ad5bfbc3a9`

### Git Status

```text
 M README.md
 M docs/ai_engineering/01_architecture.md
 M docs/ai_engineering/03_interfaces.md
 M docs/ai_engineering/04_build_test.md
 M docs/modules/test-workbench.md
 M docs/requirements/README.md
 M docs/requirements/REQ-0037-autonomous-candidate-development/00_user_requirement.md
 M docs/requirements/REQ-0037-autonomous-candidate-development/01_development_requirement.md
 M docs/requirements/REQ-0037-autonomous-candidate-development/02_design.md
 M docs/requirements/REQ-0037-autonomous-candidate-development/03_tasks.md
 M docs/requirements/REQ-0037-autonomous-candidate-development/04_verification.md
 M docs/requirements/REQ-0037-autonomous-candidate-development/05_trace.md
 M docs/requirements/REQ-0037-autonomous-candidate-development/change_log.md
 M docs/requirements/REQ-0037-autonomous-candidate-development/current_state.md
 M docs/requirements/REQ-0037-autonomous-candidate-development/delivery_evidence.md
 M docs/requirements/REQ-0037-autonomous-candidate-development/requirement.source.json
 M harness-probe/src/harness-runner.mjs
 M package.json
 M workbench/README.md
 M workbench/package.json
 M workbench/scripts/start-workbench.ps1
 M workbench/server/app.mjs
 M workbench/server/auth/session.mjs
 M workbench/server/batches.mjs
 M workbench/server/build/adapter.mjs
 M workbench/server/build/candidate-trials.mjs
 M workbench/server/build/development-dom-read.mjs
 M workbench/server/build/development-feedback.mjs
 M workbench/server/build/development-fidelity.mjs
 M workbench/server/build/development-session.mjs
 M workbench/server/build/development-task.mjs
 M workbench/server/build/manager.mjs
 M workbench/server/build/store.mjs
 M workbench/server/execution-records.mjs
 M workbench/server/executor.mjs
 M workbench/server/index.mjs
 M workbench/server/report-snapshots.mjs
 M workbench/server/script-operations.mjs
 M workbench/server/store.mjs
 M workbench/tests/development-session.test.mjs
 M workbench/tests/product-v21.test.mjs
 M workbench/web-v2/app.js
 M workbench/web-v2/execution-media.js
 M workbench/web-v2/workflow.js
?? docs/reviews/2026-09-25-agent-diagnosis/REPORT.md
?? docs/reviews/2026-09-25-agent-diagnosis/STATE.md
?? docs/reviews/2026-09-25-agent-diagnosis/auth-live-dom.txt
?? docs/reviews/2026-09-25-agent-diagnosis/boundary-probes.json
?? docs/reviews/2026-09-25-agent-diagnosis/boundary-probes.mjs
?? docs/reviews/2026-09-25-agent-diagnosis/engineering-checks.log
?? docs/reviews/2026-09-25-agent-diagnosis/health-end.json
?? docs/reviews/2026-09-25-agent-diagnosis/health.json
?? docs/reviews/2026-09-25-agent-diagnosis/historical-count-check.json
?? docs/reviews/2026-09-25-agent-diagnosis/kc10-live-dom.txt
?? docs/reviews/2026-09-25-agent-diagnosis/probe-data-SjD9oj/draft/candidate.spec.mjs
?? docs/reviews/2026-09-25-agent-diagnosis/probe-data-SjD9oj/run-1/candidate.spec.mjs
?? docs/reviews/2026-09-25-agent-diagnosis/source-manifest.json
?? docs/需求/02-case-library.png
?? docs/需求/04-case-evidence.png
?? docs/需求/ALL_SCREENS.png
?? docs/需求/CODEX_IMPLEMENTATION.md
?? docs/需求/DESIGN_OVERVIEW.png
?? docs/需求/UI_DESIGN_SPEC_V2.md
?? docs/需求/index.html
?? workbench/docs/ui-workflow-proposal/01-case-library.png
?? workbench/docs/ui-workflow-proposal/02-case-detail.png
?? workbench/docs/ui-workflow-proposal/03-rerun-confirm.png
?? workbench/docs/ui-workflow-proposal/04-batch-results.png
?? workbench/docs/ui-workflow-proposal/05-script-panel.png
?? workbench/docs/ui-workflow-proposal/README.md
?? workbench/docs/ui-workflow-proposal/index.html
?? workbench/qa/20260925-independent-ui/REPORT.md
?? workbench/qa/20260925-independent-ui/STATE.md
?? workbench/qa/20260925-independent-ui/agent/01-case-list.png
?? workbench/qa/20260925-independent-ui/agent/01-case-list.txt
?? workbench/qa/20260925-independent-ui/agent/02-cross-page-page2-settled.txt
?? workbench/qa/20260925-independent-ui/agent/02-cross-page-page2.txt
?? workbench/qa/20260925-independent-ui/agent/03-filter-hidden-selection-settled.txt
?? workbench/qa/20260925-independent-ui/agent/03-filter-hidden-selection.txt
?? workbench/qa/20260925-independent-ui/agent/04-clear-selection-settled.txt
?? workbench/qa/20260925-independent-ui/agent/04-clear-selection.txt
?? workbench/qa/20260925-independent-ui/agent/05-current-list.txt
?? workbench/qa/20260925-independent-ui/agent/05-kc05-filter-initial.txt
?? workbench/qa/20260925-independent-ui/agent/05-kc05-filter.txt
?? workbench/qa/20260925-independent-ui/agent/06-kc05-detail-initial.txt
?? workbench/qa/20260925-independent-ui/agent/06-kc05-detail.txt
?? workbench/qa/20260925-independent-ui/agent/07-kc05-s3-selected.png
?? workbench/qa/20260925-independent-ui/agent/07-kc05-s3-selected.txt
?? workbench/qa/20260925-independent-ui/agent/08-kc05-script-tab-settled.txt
?? workbench/qa/20260925-independent-ui/agent/08-kc05-script-tab.txt
?? workbench/qa/20260925-independent-ui/agent/09-return-list-settled.txt
?? workbench/qa/20260925-independent-ui/agent/09-return-list.txt
?? workbench/qa/20260925-independent-ui/agent/10-mixed-selected-settled.txt
?? workbench/qa/20260925-independent-ui/agent/10-mixed-selected.txt
?? workbench/qa/20260925-independent-ui/agent/11-mixed-confirm-filled.png
?? workbench/qa/20260925-independent-ui/agent/11-mixed-confirm-filled.txt
?? workbench/qa/20260925-independent-ui/agent/11-mixed-confirm-ready.txt
?? workbench/qa/20260925-independent-ui/agent/11-mixed-confirm.txt
?? workbench/qa/20260925-independent-ui/agent/12-mixed-running.png
?? workbench/qa/20260925-independent-ui/agent/12-mixed-running.txt
?? workbench/qa/20260925-independent-ui/agent/12-mixed-start.txt
?? workbench/qa/20260925-independent-ui/agent/13-mixed-progress.txt
?? workbench/qa/20260925-independent-ui/agent/14-mixed-complete.png
?? workbench/qa/20260925-independent-ui/agent/14-mixed-complete.txt
?? workbench/qa/20260925-independent-ui/agent/15-kc02-result-initial.txt
?? workbench/qa/20260925-independent-ui/agent/15-kc02-result.png
?? workbench/qa/20260925-independent-ui/agent/15-kc02-result.txt
?? workbench/qa/20260925-independent-ui/agent/16-kc02-step2.png
?? workbench/qa/20260925-independent-ui/agent/16-kc02-step2.txt
?? workbench/qa/20260925-independent-ui/agent/17-kc02-playing-later.txt
?? workbench/qa/20260925-independent-ui/agent/17-kc02-playing.txt
?? workbench/qa/20260925-independent-ui/agent/18-return-batch-settled.txt
?? workbench/qa/20260925-independent-ui/agent/18-return-batch.txt
?? workbench/qa/20260925-independent-ui/agent/19-kc08-from-batch.txt
?? workbench/qa/20260925-independent-ui/agent/19-kc08-result.txt
?? workbench/qa/20260925-independent-ui/agent/20-kc08-generation-confirm.png
?? workbench/qa/20260925-independent-ui/agent/20-kc08-generation-confirm.txt
?? workbench/qa/20260925-independent-ui/agent/21-kc08-generation-page.txt
?? workbench/qa/20260925-independent-ui/agent/21-kc08-generation-start.png
?? workbench/qa/20260925-independent-ui/agent/21-kc08-generation-start.txt
?? workbench/qa/20260925-independent-ui/agent/22-batch-report.png
?? workbench/qa/20260925-independent-ui/agent/22-batch-report.txt
?? workbench/qa/20260925-independent-ui/agent/23-batch-report-preview.png
?? workbench/qa/20260925-independent-ui/agent/23-batch-report-preview.txt
?? workbench/qa/20260925-independent-ui/agent/24-generation-progress.txt
?? workbench/qa/20260925-independent-ui/agent/25-generation-build-initial.txt
?? workbench/qa/20260925-independent-ui/agent/25-generation-build.png
?? workbench/qa/20260925-independent-ui/agent/25-generation-build.txt
?? workbench/qa/20260925-independent-ui/agent/26-build-technical.txt
?? workbench/qa/20260925-independent-ui/agent/27-build-after-reload-settled.txt
?? workbench/qa/20260925-independent-ui/agent/27-build-after-reload.txt
?? workbench/qa/20260925-independent-ui/agent/28-build-progress-detail-settled.txt
?? workbench/qa/20260925-independent-ui/agent/28-build-progress-detail.txt
?? workbench/qa/20260925-independent-ui/agent/28-build-progress.txt
?? workbench/qa/20260925-independent-ui/agent/29-build-technical-current.txt
?? workbench/qa/20260925-independent-ui/agent/30-build-postverify.png
?? workbench/qa/20260925-independent-ui/agent/30-build-postverify.txt
?? workbench/qa/20260925-independent-ui/agent/31-build-final-detail.txt
?? workbench/qa/20260925-independent-ui/agent/32-return-after-build-settled.txt
?? workbench/qa/20260925-independent-ui/agent/32-return-after-build.txt
?? workbench/qa/20260925-independent-ui/agent/33-kc08-new-version-initial.txt
?? workbench/qa/20260925-independent-ui/agent/33-kc08-new-version.txt
?? workbench/qa/20260925-independent-ui/agent/34-kc08-s2-selected.txt
?? workbench/qa/20260925-independent-ui/agent/35-kc08-s2-confirm-filled.txt
?? workbench/qa/20260925-independent-ui/agent/35-kc08-s2-confirm-ready.png
?? workbench/qa/20260925-independent-ui/agent/35-kc08-s2-confirm-ready.txt
?? workbench/qa/20260925-independent-ui/agent/35-kc08-s2-run-confirm.txt
?? workbench/qa/20260925-independent-ui/agent/36-kc08-s2-run-start.txt
?? workbench/qa/20260925-independent-ui/agent/36-kc08-s2-running.txt
?? workbench/qa/20260925-independent-ui/agent/37-kc08-s2-batch-init.txt
?? workbench/qa/20260925-independent-ui/agent/37-kc08-s2-batch.png
?? workbench/qa/20260925-independent-ui/agent/37-kc08-s2-batch.txt
?? workbench/qa/20260925-independent-ui/agent/38-cancel-list-settled.txt
?? workbench/qa/20260925-independent-ui/agent/38-cancel-return-list.txt
?? workbench/qa/20260925-independent-ui/agent/39-cancel-selected-settled.txt
?? workbench/qa/20260925-independent-ui/agent/39-cancel-selected.txt
?? workbench/qa/20260925-independent-ui/agent/40-cancel-confirm-filled.txt
?? workbench/qa/20260925-independent-ui/agent/40-cancel-confirm-ready.txt
?? workbench/qa/20260925-independent-ui/agent/40-cancel-confirm.txt
?? workbench/qa/20260925-independent-ui/agent/41-cancel-batch-running-settled.txt
?? workbench/qa/20260925-independent-ui/agent/41-cancel-batch-running.png
?? workbench/qa/20260925-independent-ui/agent/41-cancel-batch-running.txt
?? workbench/qa/20260925-independent-ui/agent/42-cancel-action.txt
?? workbench/qa/20260925-independent-ui/agent/43-cancel-complete.png
?? workbench/qa/20260925-independent-ui/agent/43-cancel-complete.txt
?? workbench/qa/20260925-independent-ui/agent/44-canceled-kc02-detail.png
?? workbench/qa/20260925-independent-ui/agent/44-canceled-kc02-detail.txt
?? workbench/qa/20260925-independent-ui/agent/44-canceled-kc02-initial.txt
?? workbench/qa/20260925-independent-ui/agent/45-cancel-run-after-fix-initial.txt
?? workbench/qa/20260925-independent-ui/agent/45-cancel-run-after-fix.png
?? workbench/qa/20260925-independent-ui/agent/45-cancel-run-after-fix.txt
?? workbench/qa/20260925-independent-ui/agent/46-cancel-batch-after-fix-initial.txt
?? workbench/qa/20260925-independent-ui/agent/46-cancel-batch-after-fix.png
?? workbench/qa/20260925-independent-ui/agent/46-cancel-batch-after-fix.txt
?? workbench/qa/20260925-independent-ui/agent/47-mixed-after-fix-initial.txt
?? workbench/qa/20260925-independent-ui/agent/47-mixed-after-fix.png
?? workbench/qa/20260925-independent-ui/agent/47-mixed-after-fix.txt
?? workbench/qa/20260925-independent-ui/agent/48-cancel-run-final-initial.txt
?? workbench/qa/20260925-independent-ui/agent/48-cancel-run-final.png
?? workbench/qa/20260925-independent-ui/agent/48-cancel-run-final.txt
?? workbench/qa/20260925-independent-ui/agent/49-cancel-run-final-reload-initial.txt
?? workbench/qa/20260925-independent-ui/agent/49-cancel-run-final-reload.png
?? workbench/qa/20260925-independent-ui/agent/49-cancel-run-final-reload.txt
?? workbench/qa/20260925-independent-ui/agent/round2-ui-brief.md
?? workbench/qa/20260925-independent-ui/collector-initial-format-rejected.log
?? workbench/qa/20260925-independent-ui/collector.log
?? workbench/qa/20260925-independent-ui/context-check-before-collector.log
?? workbench/qa/20260925-independent-ui/context-check.log
?? workbench/qa/20260925-independent-ui/history-after.json
?? workbench/qa/20260925-independent-ui/history-before.json
?? workbench/qa/20260925-independent-ui/preserve-history.mjs
?? workbench/qa/20260925-independent-ui/supervisor/baseline.patch
?? workbench/qa/20260925-independent-ui/supervisor/cancel-after.txt
?? workbench/qa/20260925-independent-ui/supervisor/cancel-before.txt
?? workbench/qa/20260925-independent-ui/supervisor/cancel-steps-after.txt
?? workbench/qa/20260925-independent-ui/supervisor/cancel-steps-final.txt
?? workbench/qa/20260925-independent-ui/supervisor/engineering-tests-final.log
?? workbench/qa/20260925-independent-ui/supervisor/engineering-tests.log
?? workbench/qa/20260925-independent-ui/supervisor/fresh-kc08-candidate.mjs
?? workbench/qa/20260925-independent-ui/supervisor/fresh-kc08-task.json
?? workbench/qa/20260925-independent-ui/supervisor/health-after.json
?? workbench/qa/20260925-independent-ui/supervisor/health-before.json
?? workbench/qa/20260925-independent-ui/supervisor/kc01-blocked-confirm.txt
?? workbench/qa/20260925-independent-ui/supervisor/kc02-failure-ui.txt
?? workbench/qa/20260925-independent-ui/supervisor/kc08-original-ui.txt
?? workbench/qa/20260925-independent-ui/supervisor/mixed-batch-ui.txt
?? workbench/qa/20260925-independent-ui/supervisor/mixed-report-ui.txt
?? workbench/qa/20260925-independent-ui/supervisor/mixed-report.html
?? workbench/qa/20260925-independent-ui/supervisor/official-readiness-final.log
?? workbench/qa/20260925-independent-ui/supervisor/official-readiness.log
?? workbench/qa/20260925-independent-ui/supervisor/original-case-inputs.json
?? workbench/qa/20260925-independent-ui/supervisor/post-reload-integrity.json
?? workbench/qa/20260925-independent-ui/supervisor/semantic-review.md
?? workbench/qa/20260925-independent-ui/supervisor/step3-media-position.json
?? workbench/qa/20260925-independent-ui/supervisor/trial-12d38ecb9df671211ac9d27a94319247a22c8d08.json
?? workbench/qa/20260925-independent-ui/supervisor/trial-32533f98868dd9c09674ff3a53baa0051d60f625.json
?? workbench/qa/20260925-independent-ui/supervisor/trial-6d7ab6a079f6252583c53ff1c0968a927f2e860d.json
?? workbench/qa/20260925-independent-ui/supervisor/trial-9e0be1ee280daf1516938327f1f23dfdca29040a.json
?? workbench/qa/20260925-independent-ui/supervisor/verification.log
?? workbench/qa/20260925-independent-ui/supervisor/verified-results.json
?? workbench/qa/20260925-independent-ui/sync.log
?? workbench/qa/20260925-independent-ui/verify-round2.mjs
?? workbench/qa/20260925-reliability/REPORT.md
?? workbench/qa/20260925-reliability/STATE.md
?? workbench/qa/20260925-reliability/active-cancel.json
?? workbench/qa/20260925-reliability/before-reload-health.json
?? workbench/qa/20260925-reliability/collector.log
?? workbench/qa/20260925-reliability/context-check.log
?? workbench/qa/20260925-reliability/engineering-tests-final.log
?? workbench/qa/20260925-reliability/engineering-tests.log
?? workbench/qa/20260925-reliability/export-recovery-report.mjs
?? workbench/qa/20260925-reliability/finalize-requirement.py
?? workbench/qa/20260925-reliability/fresh-candidate.mjs
?? workbench/qa/20260925-reliability/fresh-preflight.txt
?? workbench/qa/20260925-reliability/fresh-result-ui.txt
?? workbench/qa/20260925-reliability/fresh-task.json
?? workbench/qa/20260925-reliability/history-after.json
?? workbench/qa/20260925-reliability/history-before.json
?? workbench/qa/20260925-reliability/media-playback.json
?? workbench/qa/20260925-reliability/model-results.json
?? workbench/qa/20260925-reliability/official-auth-lifecycle.json
?? workbench/qa/20260925-reliability/official-batch-final.json
?? workbench/qa/20260925-reliability/official-batch-report.html
?? workbench/qa/20260925-reliability/official-batch.json
?? workbench/qa/20260925-reliability/official-batch.txt
?? workbench/qa/20260925-reliability/official-eperm-health.json
?? workbench/qa/20260925-reliability/official-eperm-ui.txt
?? workbench/qa/20260925-reliability/official-readiness-final.json
?? workbench/qa/20260925-reliability/official-readiness.json
?? workbench/qa/20260925-reliability/official-results.json
?? workbench/qa/20260925-reliability/preserve-history.mjs
?? workbench/qa/20260925-reliability/recovery-candidate.mjs
?? workbench/qa/20260925-reliability/recovery-preflight.txt
?? workbench/qa/20260925-reliability/recovery-report-verification.json
?? workbench/qa/20260925-reliability/recovery-report.html
?? workbench/qa/20260925-reliability/recovery-result-ui.txt
?? workbench/qa/20260925-reliability/recovery-task.json
?? workbench/qa/20260925-reliability/report-preview.txt
?? workbench/qa/20260925-reliability/supervisor-tests.log
?? workbench/qa/20260925-reliability/update-requirement.py
?? workbench/qa/20260925-reliability/verify-active-cancel.mjs
?? workbench/qa/20260925-reliability/verify-model-results.mjs
?? workbench/qa/20260925-reliability/verify-official-results.mjs
?? workbench/qa/20260925-v21/engineer-batch-evidence.html
?? workbench/qa/20260925-v21/engineer-report-package.zip
?? workbench/qa/20260925-v21/user-trial-kit/12条原用例-导入练习.xlsx
?? workbench/qa/20260925-v21/user-trial-kit/KC-02-后续步骤画面.png
?? workbench/qa/20260925-v21/user-trial-kit/KC-02-失败画面.png
?? workbench/qa/20260925-v21/user-trial-kit/KC-02-新采集链路工程复验.webm
?? workbench/qa/20260925-v21/user-trial-kit/KC-02-本轮正式字幕画面.png
?? workbench/qa/20260925-v21/user-trial-kit/KC-11-本次批次报告.html
?? workbench/qa/20260925-v21/user-trial-kit/manifest.json
?? workbench/qa/20260925-v21/user-trial-kit/开始使用.md
?? workbench/qa/20260925-v21/user-trial-kit/当前12条用例包.json
?? workbench/qa/20260925-v21/user-trial-kit/本轮复测报告-KC02与KC11.html
?? workbench/qa/20260925-v21/自己体验工作台-20260925.zip
?? workbench/scripts/run-unit-checks.mjs
?? workbench/scripts/test-manifest.json
?? workbench/scripts/verify-official-workbench.mjs
?? workbench/server/atomic-json.mjs
?? workbench/server/service-identity.mjs
?? workbench/server/service-shutdown.mjs
?? workbench/tests/auth-concurrency.test.mjs
?? workbench/tests/development-reliability.test.mjs
?? workbench/tests/runtime-reliability.test.mjs
?? workbench/tests/supervisor-reliability.test.mjs
```

### Git Diff Stat

```text
warning: in the working copy of 'README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/ai_engineering/01_architecture.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/ai_engineering/03_interfaces.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/ai_engineering/04_build_test.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/modules/test-workbench.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0037-autonomous-candidate-development/00_user_requirement.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0037-autonomous-candidate-development/01_development_requirement.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0037-autonomous-candidate-development/02_design.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0037-autonomous-candidate-development/03_tasks.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0037-autonomous-candidate-development/04_verification.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0037-autonomous-candidate-development/05_trace.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0037-autonomous-candidate-development/change_log.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0037-autonomous-candidate-development/current_state.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0037-autonomous-candidate-development/delivery_evidence.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'harness-probe/src/harness-runner.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'package.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/package.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/scripts/start-workbench.ps1', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/app.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/auth/session.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/batches.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/build/adapter.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/build/candidate-trials.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/build/development-dom-read.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/build/development-feedback.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/build/development-fidelity.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/build/development-session.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/build/development-task.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/build/manager.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/build/store.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/execution-records.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/executor.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/index.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/script-operations.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/store.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/tests/development-session.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/tests/product-v21.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/web-v2/app.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/web-v2/execution-media.js', LF will be replaced by CRLF the next time Git touches it
 README.md                                          |    6 +-
 docs/ai_engineering/01_architecture.md             |    4 +
 docs/ai_engineering/03_interfaces.md               |    2 +
 docs/ai_engineering/04_build_test.md               |    4 +
 docs/modules/test-workbench.md                     |   10 +
 docs/requirements/README.md                        |    2 +-
 .../00_user_requirement.md                         |   15 +
 .../01_development_requirement.md                  |    3 +
 .../02_design.md                                   |    4 +
 .../03_tasks.md                                    |    4 +
 .../04_verification.md                             |    9 +-
 .../05_trace.md                                    |    4 +
 .../change_log.md                                  |    2 +
 .../current_state.md                               |   20 +-
 .../delivery_evidence.md                           | 1419 ++++++++++++++------
 .../requirement.source.json                        |  269 +++-
 harness-probe/src/harness-runner.mjs               |    4 +-
 package.json                                       |   11 +-
 workbench/README.md                                |    2 +
 workbench/package.json                             |   26 +-
 workbench/scripts/start-workbench.ps1              |   21 +-
 workbench/server/app.mjs                           |   28 +-
 workbench/server/auth/session.mjs                  |   92 +-
 workbench/server/batches.mjs                       |   26 +-
 workbench/server/build/adapter.mjs                 |    9 +-
 workbench/server/build/candidate-trials.mjs        |   55 +-
 workbench/server/build/development-dom-read.mjs    |    2 +-
 workbench/server/build/development-feedback.mjs    |   13 +-
 workbench/server/build/development-fidelity.mjs    |   32 +-
 workbench/server/build/development-session.mjs     |   46 +-
 workbench/server/build/development-task.mjs        |   51 +-
 workbench/server/build/manager.mjs                 |   10 +
 workbench/server/build/store.mjs                   |    1 +
 workbench/server/execution-records.mjs             |    3 +
 workbench/server/executor.mjs                      |   89 +-
 workbench/server/index.mjs                         |   39 +-
 workbench/server/report-snapshots.mjs              |    7 +-
 workbench/server/script-operations.mjs             |   28 +-
 workbench/server/store.mjs                         |    1 +
 workbench/tests/development-session.test.mjs       |    7 +-
 workbench/tests/product-v21.test.mjs               |   21 +-
 workbench/web-v2/app.js                            |   26 +-
 workbench/web-v2/execution-media.js                |    1 +
 workbench/web-v2/workflow.js                       |    2 +-
 44 files changed, 1828 insertions(+), 602 deletions(-)
```

### Untracked Files

```text
docs/reviews/2026-09-25-agent-diagnosis/REPORT.md
docs/reviews/2026-09-25-agent-diagnosis/STATE.md
docs/reviews/2026-09-25-agent-diagnosis/auth-live-dom.txt
docs/reviews/2026-09-25-agent-diagnosis/boundary-probes.json
docs/reviews/2026-09-25-agent-diagnosis/boundary-probes.mjs
docs/reviews/2026-09-25-agent-diagnosis/engineering-checks.log
docs/reviews/2026-09-25-agent-diagnosis/health-end.json
docs/reviews/2026-09-25-agent-diagnosis/health.json
docs/reviews/2026-09-25-agent-diagnosis/historical-count-check.json
docs/reviews/2026-09-25-agent-diagnosis/kc10-live-dom.txt
docs/reviews/2026-09-25-agent-diagnosis/probe-data-SjD9oj/draft/candidate.spec.mjs
docs/reviews/2026-09-25-agent-diagnosis/probe-data-SjD9oj/run-1/candidate.spec.mjs
docs/reviews/2026-09-25-agent-diagnosis/source-manifest.json
docs/需求/02-case-library.png
docs/需求/04-case-evidence.png
docs/需求/ALL_SCREENS.png
docs/需求/CODEX_IMPLEMENTATION.md
docs/需求/DESIGN_OVERVIEW.png
docs/需求/UI_DESIGN_SPEC_V2.md
docs/需求/index.html
workbench/docs/ui-workflow-proposal/01-case-library.png
workbench/docs/ui-workflow-proposal/02-case-detail.png
workbench/docs/ui-workflow-proposal/03-rerun-confirm.png
workbench/docs/ui-workflow-proposal/04-batch-results.png
workbench/docs/ui-workflow-proposal/05-script-panel.png
workbench/docs/ui-workflow-proposal/README.md
workbench/docs/ui-workflow-proposal/index.html
workbench/qa/20260925-independent-ui/REPORT.md
workbench/qa/20260925-independent-ui/STATE.md
workbench/qa/20260925-independent-ui/agent/01-case-list.png
workbench/qa/20260925-independent-ui/agent/01-case-list.txt
workbench/qa/20260925-independent-ui/agent/02-cross-page-page2-settled.txt
workbench/qa/20260925-independent-ui/agent/02-cross-page-page2.txt
workbench/qa/20260925-independent-ui/agent/03-filter-hidden-selection-settled.txt
workbench/qa/20260925-independent-ui/agent/03-filter-hidden-selection.txt
workbench/qa/20260925-independent-ui/agent/04-clear-selection-settled.txt
workbench/qa/20260925-independent-ui/agent/04-clear-selection.txt
workbench/qa/20260925-independent-ui/agent/05-current-list.txt
workbench/qa/20260925-independent-ui/agent/05-kc05-filter-initial.txt
workbench/qa/20260925-independent-ui/agent/05-kc05-filter.txt
workbench/qa/20260925-independent-ui/agent/06-kc05-detail-initial.txt
workbench/qa/20260925-independent-ui/agent/06-kc05-detail.txt
workbench/qa/20260925-independent-ui/agent/07-kc05-s3-selected.png
workbench/qa/20260925-independent-ui/agent/07-kc05-s3-selected.txt
workbench/qa/20260925-independent-ui/agent/08-kc05-script-tab-settled.txt
workbench/qa/20260925-independent-ui/agent/08-kc05-script-tab.txt
workbench/qa/20260925-independent-ui/agent/09-return-list-settled.txt
workbench/qa/20260925-independent-ui/agent/09-return-list.txt
workbench/qa/20260925-independent-ui/agent/10-mixed-selected-settled.txt
workbench/qa/20260925-independent-ui/agent/10-mixed-selected.txt
workbench/qa/20260925-independent-ui/agent/11-mixed-confirm-filled.png
workbench/qa/20260925-independent-ui/agent/11-mixed-confirm-filled.txt
workbench/qa/20260925-independent-ui/agent/11-mixed-confirm-ready.txt
workbench/qa/20260925-independent-ui/agent/11-mixed-confirm.txt
workbench/qa/20260925-independent-ui/agent/12-mixed-running.png
workbench/qa/20260925-independent-ui/agent/12-mixed-running.txt
workbench/qa/20260925-independent-ui/agent/12-mixed-start.txt
workbench/qa/20260925-independent-ui/agent/13-mixed-progress.txt
workbench/qa/20260925-independent-ui/agent/14-mixed-complete.png
workbench/qa/20260925-independent-ui/agent/14-mixed-complete.txt
workbench/qa/20260925-independent-ui/agent/15-kc02-result-initial.txt
workbench/qa/20260925-independent-ui/agent/15-kc02-result.png
workbench/qa/20260925-independent-ui/agent/15-kc02-result.txt
workbench/qa/20260925-independent-ui/agent/16-kc02-step2.png
workbench/qa/20260925-independent-ui/agent/16-kc02-step2.txt
workbench/qa/20260925-independent-ui/agent/17-kc02-playing-later.txt
workbench/qa/20260925-independent-ui/agent/17-kc02-playing.txt
workbench/qa/20260925-independent-ui/agent/18-return-batch-settled.txt
workbench/qa/20260925-independent-ui/agent/18-return-batch.txt
workbench/qa/20260925-independent-ui/agent/19-kc08-from-batch.txt
workbench/qa/20260925-independent-ui/agent/19-kc08-result.txt
workbench/qa/20260925-independent-ui/agent/20-kc08-generation-confirm.png
workbench/qa/20260925-independent-ui/agent/20-kc08-generation-confirm.txt
workbench/qa/20260925-independent-ui/agent/21-kc08-generation-page.txt
workbench/qa/20260925-independent-ui/agent/21-kc08-generation-start.png
workbench/qa/20260925-independent-ui/agent/21-kc08-generation-start.txt
workbench/qa/20260925-independent-ui/agent/22-batch-report.png
workbench/qa/20260925-independent-ui/agent/22-batch-report.txt
workbench/qa/20260925-independent-ui/agent/23-batch-report-preview.png
workbench/qa/20260925-independent-ui/agent/23-batch-report-preview.txt
workbench/qa/20260925-independent-ui/agent/24-generation-progress.txt
workbench/qa/20260925-independent-ui/agent/25-generation-build-initial.txt
workbench/qa/20260925-independent-ui/agent/25-generation-build.png
workbench/qa/20260925-independent-ui/agent/25-generation-build.txt
workbench/qa/20260925-independent-ui/agent/26-build-technical.txt
workbench/qa/20260925-independent-ui/agent/27-build-after-reload-settled.txt
workbench/qa/20260925-independent-ui/agent/27-build-after-reload.txt
workbench/qa/20260925-independent-ui/agent/28-build-progress-detail-settled.txt
workbench/qa/20260925-independent-ui/agent/28-build-progress-detail.txt
workbench/qa/20260925-independent-ui/agent/28-build-progress.txt
workbench/qa/20260925-independent-ui/agent/29-build-technical-current.txt
workbench/qa/20260925-independent-ui/agent/30-build-postverify.png
workbench/qa/20260925-independent-ui/agent/30-build-postverify.txt
workbench/qa/20260925-independent-ui/agent/31-build-final-detail.txt
workbench/qa/20260925-independent-ui/agent/32-return-after-build-settled.txt
workbench/qa/20260925-independent-ui/agent/32-return-after-build.txt
workbench/qa/20260925-independent-ui/agent/33-kc08-new-version-initial.txt
workbench/qa/20260925-independent-ui/agent/33-kc08-new-version.txt
workbench/qa/20260925-independent-ui/agent/34-kc08-s2-selected.txt
workbench/qa/20260925-independent-ui/agent/35-kc08-s2-confirm-filled.txt
workbench/qa/20260925-independent-ui/agent/35-kc08-s2-confirm-ready.png
workbench/qa/20260925-independent-ui/agent/35-kc08-s2-confirm-ready.txt
workbench/qa/20260925-independent-ui/agent/35-kc08-s2-run-confirm.txt
workbench/qa/20260925-independent-ui/agent/36-kc08-s2-run-start.txt
workbench/qa/20260925-independent-ui/agent/36-kc08-s2-running.txt
workbench/qa/20260925-independent-ui/agent/37-kc08-s2-batch-init.txt
workbench/qa/20260925-independent-ui/agent/37-kc08-s2-batch.png
workbench/qa/20260925-independent-ui/agent/37-kc08-s2-batch.txt
workbench/qa/20260925-independent-ui/agent/38-cancel-list-settled.txt
workbench/qa/20260925-independent-ui/agent/38-cancel-return-list.txt
workbench/qa/20260925-independent-ui/agent/39-cancel-selected-settled.txt
workbench/qa/20260925-independent-ui/agent/39-cancel-selected.txt
workbench/qa/20260925-independent-ui/agent/40-cancel-confirm-filled.txt
workbench/qa/20260925-independent-ui/agent/40-cancel-confirm-ready.txt
workbench/qa/20260925-independent-ui/agent/40-cancel-confirm.txt
workbench/qa/20260925-independent-ui/agent/41-cancel-batch-running-settled.txt
workbench/qa/20260925-independent-ui/agent/41-cancel-batch-running.png
workbench/qa/20260925-independent-ui/agent/41-cancel-batch-running.txt
workbench/qa/20260925-independent-ui/agent/42-cancel-action.txt
workbench/qa/20260925-independent-ui/agent/43-cancel-complete.png
workbench/qa/20260925-independent-ui/agent/43-cancel-complete.txt
workbench/qa/20260925-independent-ui/agent/44-canceled-kc02-detail.png
workbench/qa/20260925-independent-ui/agent/44-canceled-kc02-detail.txt
workbench/qa/20260925-independent-ui/agent/44-canceled-kc02-initial.txt
workbench/qa/20260925-independent-ui/agent/45-cancel-run-after-fix-initial.txt
workbench/qa/20260925-independent-ui/agent/45-cancel-run-after-fix.png
workbench/qa/20260925-independent-ui/agent/45-cancel-run-after-fix.txt
workbench/qa/20260925-independent-ui/agent/46-cancel-batch-after-fix-initial.txt
workbench/qa/20260925-independent-ui/agent/46-cancel-batch-after-fix.png
workbench/qa/20260925-independent-ui/agent/46-cancel-batch-after-fix.txt
workbench/qa/20260925-independent-ui/agent/47-mixed-after-fix-initial.txt
workbench/qa/20260925-independent-ui/agent/47-mixed-after-fix.png
workbench/qa/20260925-independent-ui/agent/47-mixed-after-fix.txt
workbench/qa/20260925-independent-ui/agent/48-cancel-run-final-initial.txt
workbench/qa/20260925-independent-ui/agent/48-cancel-run-final.png
workbench/qa/20260925-independent-ui/agent/48-cancel-run-final.txt
workbench/qa/20260925-independent-ui/agent/49-cancel-run-final-reload-initial.txt
workbench/qa/20260925-independent-ui/agent/49-cancel-run-final-reload.png
workbench/qa/20260925-independent-ui/agent/49-cancel-run-final-reload.txt
workbench/qa/20260925-independent-ui/agent/round2-ui-brief.md
workbench/qa/20260925-independent-ui/collector-initial-format-rejected.log
workbench/qa/20260925-independent-ui/collector.log
workbench/qa/20260925-independent-ui/context-check-before-collector.log
workbench/qa/20260925-independent-ui/context-check.log
workbench/qa/20260925-independent-ui/history-after.json
workbench/qa/20260925-independent-ui/history-before.json
workbench/qa/20260925-independent-ui/preserve-history.mjs
workbench/qa/20260925-independent-ui/supervisor/baseline.patch
workbench/qa/20260925-independent-ui/supervisor/cancel-after.txt
workbench/qa/20260925-independent-ui/supervisor/cancel-before.txt
workbench/qa/20260925-independent-ui/supervisor/cancel-steps-after.txt
workbench/qa/20260925-independent-ui/supervisor/cancel-steps-final.txt
workbench/qa/20260925-independent-ui/supervisor/engineering-tests-final.log
workbench/qa/20260925-independent-ui/supervisor/engineering-tests.log
workbench/qa/20260925-independent-ui/supervisor/fresh-kc08-candidate.mjs
workbench/qa/20260925-independent-ui/supervisor/fresh-kc08-task.json
workbench/qa/20260925-independent-ui/supervisor/health-after.json
workbench/qa/20260925-independent-ui/supervisor/health-before.json
workbench/qa/20260925-independent-ui/supervisor/kc01-blocked-confirm.txt
workbench/qa/20260925-independent-ui/supervisor/kc02-failure-ui.txt
workbench/qa/20260925-independent-ui/supervisor/kc08-original-ui.txt
workbench/qa/20260925-independent-ui/supervisor/mixed-batch-ui.txt
workbench/qa/20260925-independent-ui/supervisor/mixed-report-ui.txt
workbench/qa/20260925-independent-ui/supervisor/mixed-report.html
workbench/qa/20260925-independent-ui/supervisor/official-readiness-final.log
workbench/qa/20260925-independent-ui/supervisor/official-readiness.log
workbench/qa/20260925-independent-ui/supervisor/original-case-inputs.json
workbench/qa/20260925-independent-ui/supervisor/post-reload-integrity.json
workbench/qa/20260925-independent-ui/supervisor/semantic-review.md
workbench/qa/20260925-independent-ui/supervisor/step3-media-position.json
workbench/qa/20260925-independent-ui/supervisor/trial-12d38ecb9df671211ac9d27a94319247a22c8d08.json
workbench/qa/20260925-independent-ui/supervisor/trial-32533f98868dd9c09674ff3a53baa0051d60f625.json
workbench/qa/20260925-independent-ui/supervisor/trial-6d7ab6a079f6252583c53ff1c0968a927f2e860d.json
workbench/qa/20260925-independent-ui/supervisor/trial-9e0be1ee280daf1516938327f1f23dfdca29040a.json
workbench/qa/20260925-independent-ui/supervisor/verification.log
workbench/qa/20260925-independent-ui/supervisor/verified-results.json
workbench/qa/20260925-independent-ui/sync.log
workbench/qa/20260925-independent-ui/verify-round2.mjs
workbench/qa/20260925-reliability/REPORT.md
workbench/qa/20260925-reliability/STATE.md
workbench/qa/20260925-reliability/active-cancel.json
workbench/qa/20260925-reliability/before-reload-health.json
workbench/qa/20260925-reliability/collector.log
workbench/qa/20260925-reliability/context-check.log
workbench/qa/20260925-reliability/engineering-tests-final.log
workbench/qa/20260925-reliability/engineering-tests.log
workbench/qa/20260925-reliability/export-recovery-report.mjs
workbench/qa/20260925-reliability/finalize-requirement.py
workbench/qa/20260925-reliability/fresh-candidate.mjs
workbench/qa/20260925-reliability/fresh-preflight.txt
workbench/qa/20260925-reliability/fresh-result-ui.txt
workbench/qa/20260925-reliability/fresh-task.json
workbench/qa/20260925-reliability/history-after.json
workbench/qa/20260925-reliability/history-before.json
workbench/qa/20260925-reliability/media-playback.json
workbench/qa/20260925-reliability/model-results.json
workbench/qa/20260925-reliability/official-auth-lifecycle.json
workbench/qa/20260925-reliability/official-batch-final.json
workbench/qa/20260925-reliability/official-batch-report.html
workbench/qa/20260925-reliability/official-batch.json
workbench/qa/20260925-reliability/official-batch.txt
workbench/qa/20260925-reliability/official-eperm-health.json
workbench/qa/20260925-reliability/official-eperm-ui.txt
workbench/qa/20260925-reliability/official-readiness-final.json
workbench/qa/20260925-reliability/official-readiness.json
workbench/qa/20260925-reliability/official-results.json
workbench/qa/20260925-reliability/preserve-history.mjs
workbench/qa/20260925-reliability/recovery-candidate.mjs
workbench/qa/20260925-reliability/recovery-preflight.txt
workbench/qa/20260925-reliability/recovery-report-verification.json
workbench/qa/20260925-reliability/recovery-report.html
workbench/qa/20260925-reliability/recovery-result-ui.txt
workbench/qa/20260925-reliability/recovery-task.json
workbench/qa/20260925-reliability/report-preview.txt
workbench/qa/20260925-reliability/supervisor-tests.log
workbench/qa/20260925-reliability/update-requirement.py
workbench/qa/20260925-reliability/verify-active-cancel.mjs
workbench/qa/20260925-reliability/verify-model-results.mjs
workbench/qa/20260925-reliability/verify-official-results.mjs
workbench/qa/20260925-v21/engineer-batch-evidence.html
workbench/qa/20260925-v21/engineer-report-package.zip
workbench/qa/20260925-v21/user-trial-kit/12条原用例-导入练习.xlsx
workbench/qa/20260925-v21/user-trial-kit/KC-02-后续步骤画面.png
workbench/qa/20260925-v21/user-trial-kit/KC-02-失败画面.png
workbench/qa/20260925-v21/user-trial-kit/KC-02-新采集链路工程复验.webm
workbench/qa/20260925-v21/user-trial-kit/KC-02-本轮正式字幕画面.png
workbench/qa/20260925-v21/user-trial-kit/KC-11-本次批次报告.html
workbench/qa/20260925-v21/user-trial-kit/manifest.json
workbench/qa/20260925-v21/user-trial-kit/开始使用.md
workbench/qa/20260925-v21/user-trial-kit/当前12条用例包.json
workbench/qa/20260925-v21/user-trial-kit/本轮复测报告-KC02与KC11.html
workbench/qa/20260925-v21/自己体验工作台-20260925.zip
workbench/scripts/run-unit-checks.mjs
workbench/scripts/test-manifest.json
workbench/scripts/verify-official-workbench.mjs
workbench/server/atomic-json.mjs
workbench/server/service-identity.mjs
workbench/server/service-shutdown.mjs
workbench/tests/auth-concurrency.test.mjs
workbench/tests/development-reliability.test.mjs
workbench/tests/runtime-reliability.test.mjs
workbench/tests/supervisor-reliability.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-25T22:42:48+08:00
Command: npm test
Exit code: 0
Parsed test count: 65
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---

> deepseek-ui-test-agent@0.4.0-beta.1 test
> npm --prefix workbench test


> ui-test-approved-workbench@0.1.0 test
> node scripts/run-unit-checks.mjs

TAP version 13
# Subtest: same-scope concurrent opens share one launch and one session
ok 1 - same-scope concurrent opens share one launch and one session
  ---
  duration_ms: 17.9312
  type: 'test'
  ...
# Subtest: clear and close wait for a preparing browser and leave no session
ok 2 - clear and close wait for a preparing browser and leave no session
  ---
  duration_ms: 13.4905
  type: 'test'
  ...
# Subtest: clear waits for identity check, notifies invalidation once, and prevents stale VALID state
ok 3 - clear waits for identity check, notifies invalidation once, and prevents stale VALID state
  ---
  duration_ms: 6.9143
  type: 'test'
  ...
# Subtest: Harness stderr diagnostic keeps error context and redacts credentials
ok 4 - Harness stderr diagnostic keeps error context and redacts credentials
  ---
  duration_ms: 3.0301
  type: 'test'
  ...
# Subtest: stored DSH credential is redacted even without a sk prefix
ok 5 - stored DSH credential is redacted even without a sk prefix
  ---
  duration_ms: 13.1157
  type: 'test'
  ...
# Subtest: normal-only requires explicit registration and never invents a fault lane
ok 6 - normal-only requires explicit registration and never invents a fault lane
  ---
  duration_ms: 2.4272
  type: 'test'
  ...
# Subtest: paired default still requires fault, and semantic remains explicit
ok 7 - paired default still requires fault, and semantic remains explicit
  ---
  duration_ms: 0.4404
  type: 'test'
  ...
# Subtest: exploratory budget is explicit, bounded and does not inflate standard receipts
ok 8 - exploratory budget is explicit, bounded and does not inflate standard receipts
  ---
  duration_ms: 0.7598
  type: 'test'
  ...
# Subtest: first recovery execution snapshots authorized complete package despite native file edits
ok 9 - first recovery execution snapshots authorized complete package despite native file edits
  ---
  duration_ms: 56.9368
  type: 'test'
  ...
# Subtest: same failed bundle needs a new observation or revision before another execution
ok 10 - same failed bundle needs a new observation or revision before another execution
  ---
  duration_ms: 20.7594
  type: 'test'
  ...
# Subtest: ready submission rejects a finite known obligation gap while review stays unapproved
ok 11 - ready submission rejects a finite known obligation gap while review stays unapproved
  ---
  duration_ms: 27.8057
  type: 'test'
  ...
# Subtest: submission persists hash-bound frozen-action review with observed execution
ok 12 - submission persists hash-bound frozen-action review with observed execution
  ---
  duration_ms: 25.9838
  type: 'test'
  ...
# Subtest: budget feedback and narrow DOM read capability remain bounded
ok 13 - budget feedback and narrow DOM read capability remain bounded
  ---
  duration_ms: 2.9531
  type: 'test'
  ...
# Subtest: DSH tool call/result projection keeps only correlation and success metadata
ok 14 - DSH tool call/result projection keeps only correlation and success metadata
  ---
  duration_ms: 1.9994
  type: 'test'
  ...
# Subtest: finite pre-step review catches historical changed-list examples without case-ID rules
ok 15 - finite pre-step review catches historical changed-list examples without case-ID rules
  ---
  duration_ms: 33.0934
  type: 'test'
  ...
# Subtest: pinned DSH MCP client receives fixture executor failure, continues repair and freezes only newly tested bytes
ok 16 - pinned DSH MCP client receives fixture executor failure, continues repair and freezes only newly tested bytes
  ---
  duration_ms: 191.0628
  type: 'test'
  ...
# Subtest: self-test limit is cumulative and further edits cannot create an unverified final version
ok 17 - self-test limit is cumulative and further edits cannot create an unverified final version
  ---
  duration_ms: 49.5412
  type: 'test'
  ...
# Subtest: cancellation reaches an active execution and later tools stop
ok 18 - cancellation reaches an active execution and later tools stop
  ---
  duration_ms: 10.9974
  type: 'test'
  ...
# Subtest: wall budget terminates before another tool or executor admission
ok 19 - wall budget terminates before another tool or executor admission
  ---
  duration_ms: 3.9334
  type: 'test'
  ...
# Subtest: from-scratch null CAS accepts ESM draft; rejected require does not create or execute a candidate
ok 20 - from-scratch null CAS accepts ESM draft; rejected require does not create or execute a candidate
  ---
  duration_ms: 30.2342
  type: 'test'
  ...
# Subtest: task guard denies arbitrary commands, filesystem, code and alternate navigation
ok 21 - task guard denies arbitrary commands, filesystem, code and alternate navigation
  ---
  duration_ms: 3.4218
  type: 'test'
  ...
# Subtest: report snapshots freeze exact run, escape content, redact fields and embed verified media
ok 22 - report snapshots freeze exact run, escape content, redact fields and embed verified media
  ---
  duration_ms: 31.2884
  type: 'test'
  ...
# Subtest: report missing/tampered media remains missing and blocked batch items stay in denominator
ok 23 - report missing/tampered media remains missing and blocked batch items stay in denominator
  ---
  duration_ms: 17.435
  type: 'test'
  ...
# Subtest: report cancellation prevents snapshot commit and pending conflicting request is rejected
ok 24 - report cancellation prevents snapshot commit and pending conflicting request is rejected
  ---
  duration_ms: 22.3313
  type: 'test'
  ...
# Subtest: generation preflight has real authorization boundary, separates revision input, no task on rejection
ok 25 - generation preflight has real authorization boundary, separates revision input, no task on rejection
  ---
  duration_ms: 8.3856
  type: 'test'
  ...
# Subtest: invalid revision seed cannot consume an existing authorization
ok 26 - invalid revision seed cannot consume an existing authorization
  ---
  duration_ms: 6.9251
  type: 'test'
  ...
# Subtest: generation queue freezes each input, preserves mode, is idempotent and does not create grants (coordinator unit double)
ok 27 - generation queue freezes each input, preserves mode, is idempotent and does not create grants (coordinator unit double)
  ---
  duration_ms: 25.3068
  type: 'test'
  ...
# Subtest: revision passes verified complete bundle and selected feedback; cancellation is durable and restart does not replay (unit double)
ok 28 - revision passes verified complete bundle and selected feedback; cancellation is durable and restart does not replay (unit double)
  ---
  duration_ms: 62.1954
  type: 'test'
  ...
# Subtest: explicit user generation confirms bounded new receipt without resetting consumed grants; preflight is read-only
ok 29 - explicit user generation confirms bounded new receipt without resetting consumed grants; preflight is read-only
  ---
  duration_ms: 35.89
  type: 'test'
  ...
# Subtest: user-confirmed revision receipt persists UTF-8 seed and whole bundle without approving script
ok 30 - user-confirmed revision receipt persists UTF-8 seed and whole bundle without approving script
  ---
  duration_ms: 27.1357
  type: 'test'
  ...
# Subtest: original TC-005 raw report maps multiline values and the same failed step offline
ok 31 - original TC-005 raw report maps multiline values and the same failed step offline
  ---
  duration_ms: 13.1717
  type: 'test'
  ...
# Subtest: string
ok 32 - string
  ---
  duration_ms: 0.5849
  type: 'test'
  ...
# Subtest: ansi
ok 33 - ansi
  ---
  duration_ms: 0.1743
  type: 'test'
  ...
# Subtest: missing
ok 34 - missing
  ---
  duration_ms: 0.2166
  type: 'test'
  ...
# Subtest: strict
ok 35 - strict
  ---
  duration_ms: 0.3335
  type: 'test'
  ...
# Subtest: single side
ok 36 - single side
  ---
  duration_ms: 0.1176
  type: 'test'
  ...
# Subtest: timeout
ok 37 - timeout
  ---
  duration_ms: 0.3935
  type: 'test'
  ...
# Subtest: truncated array
ok 38 - truncated array
  ---
  duration_ms: 0.4845
  type: 'test'
  ...
# Subtest: truncated diff
ok 39 - truncated diff
  ---
  duration_ms: 0.4728
  type: 'test'
  ...
# Subtest: array
ok 40 - array
  ---
  duration_ms: 0.6215
  type: 'test'
  ...
# Subtest: structured matcher data precedes text without inventing single-sided actual
ok 41 - structured matcher data precedes text without inventing single-sided actual
  ---
  duration_ms: 0.4025
  type: 'test'
  ...
# Subtest: real KC-02 self-tests retain failure, continued steps and captured locator actual
ok 42 - real KC-02 self-tests retain failure, continued steps and captured locator actual
  ---
  duration_ms: 16.9872
  type: 'test'
  ...
# Subtest: only attributed evidence is displayed; zero and false are not missing
ok 43 - only attributed evidence is displayed; zero and false are not missing
  ---
  duration_ms: 0.5697
  type: 'test'
  ...
# Subtest: recorded replay steps remain authoritative and successful run has no failure notice
ok 44 - recorded replay steps remain authoritative and successful run has no failure notice
  ---
  duration_ms: 0.2514
  type: 'test'
  ...
# {"type":"build_storage_failure","code":"EIO","operation":"trial_stop_update","at":"2026-09-25T14:42:50.517Z"}
# {"type":"build_storage_failure","code":"EIO","operation":"trial_stop_read","at":"2026-09-25T14:42:50.518Z"}
# {"type":"build_storage_failure","code":"EIO","operation":"trial_stop_update","at":"2026-09-25T14:42:50.519Z"}
# Subtest: terminal candidate trial stop is idempotent while active cleanup is pending
ok 45 - terminal candidate trial stop is idempotent while active cleanup is pending
  ---
  duration_ms: 1.5703
  type: 'test'
  ...
# Subtest: queued stop updater cannot turn a concurrent terminal write back into STOPPING
ok 46 - queued stop updater cannot turn a concurrent terminal write back into STOPPING
  ---
  duration_ms: 0.4513
  type: 'test'
  ...
# Subtest: stop queued behind a pending terminal write preserves FINISHED
ok 47 - stop queued behind a pending terminal write preserves FINISHED
  ---
  duration_ms: 0.4049
  type: 'test'
  ...
# Subtest: candidate stop persistence failure degrades manager and rejects new work
ok 48 - candidate stop persistence failure degrades manager and rejects new work
  ---
  duration_ms: 1.2494
  type: 'test'
  ...
# Subtest: candidate stop read failure still aborts the captured owned task
ok 49 - candidate stop read failure still aborts the captured owned task
  ---
  duration_ms: 0.4829
  type: 'test'
  ...
# Subtest: candidate stop never aborts a replacement active task
ok 50 - candidate stop never aborts a replacement active task
  ---
  duration_ms: 0.6454
  type: 'test'
  ...
# Subtest: script and batch reserve mutually exclusive preparation windows
ok 51 - script and batch reserve mutually exclusive preparation windows
  ---
  duration_ms: 19.5288
  type: 'test'
  ...
# {"type":"build_storage_failure","code":"EEXIST","operation":"generation_save","at":"2026-09-25T14:42:50.542Z"}
# {"type":"build_storage_failure","code":"EEXIST","operation":"batch_save","at":"2026-09-25T14:42:50.543Z"}
# Subtest: script and batch persistence failures report storage fault
ok 52 - script and batch persistence failures report storage fault
  ---
  duration_ms: 6.8155
  type: 'test'
  ...
# Subtest: batch and script save retry a transient Windows rename error without degrading
ok 53 - batch and script save retry a transient Windows rename error without degrading
  ---
  duration_ms: 13.1695
  type: 'test'
  ...
# {"type":"build_storage_failure","code":"EPERM","operation":"batch_save","at":"2026-09-25T14:42:50.564Z"}
# {"type":"build_storage_failure","code":"EPERM","operation":"generation_save","at":"2026-09-25T14:42:50.572Z"}
# Subtest: batch and script save exhaust rename retries, preserve old JSON, and lock storage
ok 54 - batch and script save exhaust rename retries, preserve old JSON, and lock storage
  ---
  duration_ms: 16.2765
  type: 'test'
  ...
# {"type":"build_storage_failure","code":"EIO","operation":"trial_result_update","at":"2026-09-25T14:42:50.589Z"}
# Subtest: background terminal write failure remains visible as degraded without a false FINISHED state
ok 55 - background terminal write failure remains visible as degraded without a false FINISHED state
  ---
  duration_ms: 16.2789
  type: 'test'
  ...
# Subtest: health remains inspectable after storage read failure and rejects new writes
ok 56 - health remains inspectable after storage read failure and rejects new writes
  ---
  duration_ms: 3.4623
  type: 'test'
  ...
# Subtest: generation ownership blocks new work but allows owned candidate cancellation
ok 57 - generation ownership blocks new work but allows owned candidate cancellation
  ---
  duration_ms: 1.158
  type: 'test'
  ...
# Subtest: preparing build prevents approved run entry before active is assigned
ok 58 - preparing build prevents approved run entry before active is assigned
  ---
  duration_ms: 0.7402
  type: 'test'
  ...
# Subtest: shutdown refuses admission first, stops both executors, drains and closes auth once
ok 59 - shutdown refuses admission first, stops both executors, drains and closes auth once
  ---
  duration_ms: 1.5306
  type: 'test'
  ...
# Subtest: service identity changes with source and new records retain captured identity
ok 60 - service identity changes with source and new records retain captured identity
  ---
  duration_ms: 42.2681
  type: 'test'
  ...
# Subtest: approved executor keeps ownership through failed finalization and rejects the completion
ok 61 - approved executor keeps ownership through failed finalization and rejects the completion
  ---
  duration_ms: 5.7204
  type: 'test'
  ...
# Subtest: approved executor start guard includes peer preparation and shutdown
ok 62 - approved executor start guard includes peer preparation and shutdown
  ---
  duration_ms: 1.0844
  type: 'test'
  ...
# Subtest: offline report carries the captured execution identity and escaped fidelity materials
ok 63 - offline report carries the captured execution identity and escaped fidelity materials
  ---
  duration_ms: 0.9337
  type: 'test'
  ...
# Subtest: failed STOPPING persistence still cancels owned child and latches fault
ok 64 - failed STOPPING persistence still cancels owned child and latches fault
  ---
  duration_ms: 0.5524
  type: 'test'
  ...
# Subtest: shutdown timeout is bounded, closes auth and never reports drained success
ok 65 - shutdown timeout is bounded, closes auth and never reports drained success
  ---
  duration_ms: 57.6137
  type: 'test'
  ...
1..65
# tests 65
# suites 0
# pass 65
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1423.4548
```

### Sync Record Status

```text
DRY-RUN: no derived changes for REQ-0037-autonomous-candidate-development; explicit implementation states retained, never inferred from verification.
```

### Check AI Context

- Exit code: `1`

```text
FAIL ai-engineering-context checks

1. docs\requirements\REQ-0015-manual-complex-lab\04_verification.md
   Problem: Document claims tests/build passed while failure, skipped-test, timeout, or non-zero evidence is present.
   Fix: Downgrade verification to `无法运行` / `未运行` / `仅静态检查` / failure, and keep the original command output.
2. docs\requirements\REQ-0015-manual-complex-lab\current_state.md
   Problem: Document claims tests/build passed while failure, skipped-test, timeout, or non-zero evidence is present.
   Fix: Downgrade verification to `无法运行` / `未运行` / `仅静态检查` / failure, and keep the original command output.
```

### Notes

正式UI13场景、1次真实建例与5组对象核验见本轮REPORT及VT-0037-10；本命令只提供65项工程证据，不把KC02业务失败或取消算为业务通过。
