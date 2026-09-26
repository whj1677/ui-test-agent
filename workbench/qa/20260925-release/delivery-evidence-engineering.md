# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-26T08:53:52+08:00`
- Record: `REQ-0001-release-readiness`
- Change fingerprint: `946b52149e6648e611e310c9ed3a6e7594b3b73d75a068d73ac61c55052f912c`
- Verification source: `collector-executed-v1`
- Verification state: `单元测试通过`
- Command: `npm test`
- Exit code: `0`
- Test count: `74`
- Failure count: `0`
- Skipped count: `0`
- Log path: `workbench/qa/20260925-release/engineering-delivery.log`
- Log SHA-256: `d39a50e05cf4f552e4080a9def7435011e938815afa3c3b347233a097a1ee52a`

### Git Status

```text
 M README.md
 M docs/ai_engineering/01_architecture.md
 M docs/ai_engineering/03_interfaces.md
 M docs/ai_engineering/04_build_test.md
 M docs/modules/test-workbench.md
 M docs/requirements/README.md
 M docs/requirements/REQ-0001-release-readiness/00_user_requirement.md
 M docs/requirements/REQ-0001-release-readiness/02_design.md
 M docs/requirements/REQ-0001-release-readiness/03_tasks.md
 M docs/requirements/REQ-0001-release-readiness/04_verification.md
 M docs/requirements/REQ-0001-release-readiness/05_trace.md
 M docs/requirements/REQ-0001-release-readiness/change_log.md
 M docs/requirements/REQ-0001-release-readiness/current_state.md
 M docs/requirements/REQ-0001-release-readiness/delivery_evidence.md
 M docs/requirements/REQ-0001-release-readiness/requirement.source.json
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
 M harness-probe/src/verify-candidate.mjs
 M package.json
 M workbench/README.md
 M workbench/config/candidate.playwright.config.mjs
 M workbench/package.json
 M workbench/scripts/start-workbench.local.json.example
 M workbench/scripts/start-workbench.ps1
 M workbench/server/app.mjs
 M workbench/server/auth/catalog.mjs
 M workbench/server/auth/session.mjs
 M workbench/server/batches.mjs
 M workbench/server/build/adapter.mjs
 M workbench/server/build/candidate-trials.mjs
 M workbench/server/build/development-dom-read.mjs
 M workbench/server/build/development-evidence.mjs
 M workbench/server/build/development-feedback.mjs
 M workbench/server/build/development-fidelity.mjs
 M workbench/server/build/development-patch.mjs
 M workbench/server/build/development-session.mjs
 M workbench/server/build/development-task.mjs
 M workbench/server/build/manager.mjs
 M workbench/server/build/step-observer.mjs
 M workbench/server/build/store.mjs
 M workbench/server/build/trial-environment.mjs
 M workbench/server/build/user-workflow.mjs
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
 M workbench/web-v2/script-actions.js
 M workbench/web-v2/workflow.js
 M 启动.ps1
 M 安装.ps1
 M 环境检查.cmd
 M 试用说明.md
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
?? workbench/config/empty-trial.json
?? workbench/docs/release-candidate.md
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
?? workbench/qa/20260925-release/REPORT.md
?? workbench/qa/20260925-release/auth-diagnosis.md
?? workbench/qa/20260925-release/auth-engineering-final.log
?? workbench/qa/20260925-release/cases.import.json
?? workbench/qa/20260925-release/delivery-collector.log
?? workbench/qa/20260925-release/engineering-delivery.log
?? workbench/qa/20260925-release/engineering-first.log
?? workbench/qa/20260925-release/engineering-fixed.log
?? workbench/qa/20260925-release/fixture/SPEC.md
?? workbench/qa/20260925-release/fixture/cases.json
?? workbench/qa/20260925-release/fixture/freeze.json
?? workbench/qa/20260925-release/fixture/index.html
?? workbench/qa/20260925-release/fixture/kimi-exit-code.txt
?? workbench/qa/20260925-release/fixture/kimi-generation-stderr.log
?? workbench/qa/20260925-release/fixture/kimi-prompt.txt
?? workbench/qa/20260925-release/fixture/kimi-raw-output.txt
?? workbench/qa/20260925-release/fixture/server.mjs
?? workbench/qa/20260925-release/history-before.json
?? workbench/qa/20260925-release/import-preview.json
?? workbench/qa/20260925-release/import-result.json
?? workbench/qa/20260925-release/install-diagnostic.log
?? workbench/qa/20260925-release/login-resume-check-2.json
?? workbench/qa/20260925-release/login-resume-check.json
?? workbench/qa/20260925-release/package-build-20260926-01.log
?? workbench/qa/20260925-release/package-candidate-20260926-01.zip
?? workbench/qa/20260925-release/package-check-install-20260926-01.log
?? workbench/qa/20260925-release/package-extract-20260926-01/candidate-manifest.json
?? workbench/qa/20260925-release/package-extract-20260926-01/harness-probe/package-lock.json
?? workbench/qa/20260925-release/package-extract-20260926-01/harness-probe/package.json
?? workbench/qa/20260925-release/package-extract-20260926-01/harness-probe/src/candidate-verifier.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/harness-probe/src/fixture-server.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/harness-probe/src/harness-runner.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/harness-probe/src/process-control.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/harness-probe/src/redact.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/harness-probe/src/setup-harness.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/harness-probe/src/verify-candidate.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/package-lock.json
?? workbench/qa/20260925-release/package-extract-20260926-01/package.json
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/config/candidate.playwright.config.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/config/empty-trial.json
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/docs/release-candidate.md
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/examples/M3A_CASE_IMPORT_TEMPLATE_V1.xlsx
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/package-lock.json
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/package.json
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/scripts/check-install.ps1
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/scripts/package-candidate.py
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/scripts/start-workbench.local.json.example
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/scripts/start-workbench.ps1
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/scripts/unfamiliar-site-server.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/app.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/atomic-json.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/auth/catalog.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/auth/session.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/batches.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/adapter.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/assessments.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/browser-semantics.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/candidate-trials.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/caption-video.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/development-authorization.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/development-bundle.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/development-dom-read.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/development-evidence.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/development-feedback.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/development-fidelity.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/development-mcp.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/development-patch.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/development-policy.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/development-session.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/development-task.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/development-tool-guard.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/diagnostic.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/files.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/finalize-lifecycle.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/heldout-query.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/manager.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/project-case.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/report.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/revalidations.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/step-observer.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/step-replay.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/store.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/template.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/trial-environment.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/trial-timeline.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/user-workflow.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/cases/excel.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/cases/manager.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/cases/store.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/execution-records.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/executor.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/index.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/integrity.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/paths.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/register-approved.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/register-m2c-revalidation.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/register-m2c-runtime-revalidation.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/register-m2c-wait-fix-validation.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/register-reviewed-asset.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/registry.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/report-snapshots.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/report.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/revalidate-m2c-runtime-fix.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/reviewed-asset.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/script-operations.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/service-identity.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/service-shutdown.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/store.mjs
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/web-v2/api.js
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/web-v2/app.js
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/web-v2/execution-media.js
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/web-v2/history.js
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/web-v2/index.html
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/web-v2/product.css
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/web-v2/reports.js
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/web-v2/script-actions.js
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/web-v2/styles.css
?? workbench/qa/20260925-release/package-extract-20260926-01/workbench/web-v2/workflow.js
?? workbench/qa/20260925-release/package-extract-20260926-01/启动.cmd
?? workbench/qa/20260925-release/package-extract-20260926-01/启动.ps1
?? workbench/qa/20260925-release/package-extract-20260926-01/安装.cmd
?? workbench/qa/20260925-release/package-extract-20260926-01/安装.ps1
?? workbench/qa/20260925-release/package-extract-20260926-01/环境检查.cmd
?? workbench/qa/20260925-release/package-extract-20260926-01/试用说明.md
?? workbench/qa/20260925-release/package-isolated-extract-20260926-01.log
?? workbench/qa/20260925-release/package-isolated-extract-20260926-01.py
?? workbench/qa/20260925-release/package-negative-extra_file-20260926-01.zip
?? workbench/qa/20260925-release/package-negative-path_traversal-20260926-01.zip
?? workbench/qa/20260925-release/package-negative-tampered_byte-20260926-01.zip
?? workbench/qa/20260925-release/package-npm-harness-20260926-01.log
?? workbench/qa/20260925-release/package-npm-root-20260926-01.log
?? workbench/qa/20260925-release/package-npm-workbench-20260926-01.log
?? workbench/qa/20260925-release/package-report-20260926-01.md
?? workbench/qa/20260925-release/package-self-verify-20260926-01.log
?? workbench/qa/20260925-release/package-validation-20260926-01.log
?? workbench/qa/20260925-release/package-validation-20260926-01.py
?? workbench/qa/20260925-release/project.json
?? workbench/qa/20260925-release/regression-baseline.json
?? workbench/qa/20260925-release/regression-round1-preview.json
?? workbench/qa/20260925-release/regression-round1-result.json
?? workbench/qa/20260925-release/regression-round2-preview.json
?? workbench/qa/20260925-release/regression-round2-result.json
?? workbench/qa/20260925-release/service-before-model.json
?? workbench/qa/20260925-release/supervisor-integrity.json
?? workbench/qa/20260925-release/trial-16ae0e106017771362a2606c6139d94ac1ab742d.json
?? workbench/qa/20260925-release/trial-9151381b55f9745a00a873634799ba43e288fb87.json
?? workbench/qa/20260925-release/trial-a9d5774951a9252158a668d889d7e21145ad1b81.json
?? workbench/qa/20260925-release/trial-d984ffd689a7227fad8a2c637ab8b5c69725264c.json
?? workbench/qa/20260925-release/ui/login-required.txt
?? workbench/qa/20260925-release/ui/regression-round1-detail.png
?? workbench/qa/20260925-release/ui/regression-round1-detail.txt
?? workbench/qa/20260925-release/ui/regression-round1.png
?? workbench/qa/20260925-release/ui/regression-round1.txt
?? workbench/qa/20260925-release/unauthenticated-preflight.json
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
?? workbench/scripts/check-install.ps1
?? workbench/scripts/package-candidate.py
?? workbench/scripts/run-unit-checks.mjs
?? workbench/scripts/test-manifest.json
?? workbench/scripts/verify-official-workbench.mjs
?? workbench/server/atomic-json.mjs
?? workbench/server/service-identity.mjs
?? workbench/server/service-shutdown.mjs
?? workbench/tests/auth-concurrency.test.mjs
?? workbench/tests/development-auth-binding.test.mjs
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
warning: in the working copy of 'docs/requirements/REQ-0001-release-readiness/00_user_requirement.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0001-release-readiness/02_design.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0001-release-readiness/03_tasks.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0001-release-readiness/04_verification.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0001-release-readiness/05_trace.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0001-release-readiness/change_log.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0001-release-readiness/current_state.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0001-release-readiness/delivery_evidence.md', LF will be replaced by CRLF the next time Git touches it
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
warning: in the working copy of 'harness-probe/src/verify-candidate.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'package.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/config/candidate.playwright.config.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/package.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/scripts/start-workbench.local.json.example', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/scripts/start-workbench.ps1', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/app.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/auth/catalog.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/auth/session.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/batches.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/build/adapter.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/build/candidate-trials.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/build/development-dom-read.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/build/development-evidence.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/build/development-feedback.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/build/development-fidelity.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/build/development-patch.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/build/development-session.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/build/development-task.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/build/manager.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/build/step-observer.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/build/store.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/build/trial-environment.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/build/user-workflow.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/execution-records.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/executor.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/index.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/store.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/tests/development-session.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/tests/product-v21.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/web-v2/execution-media.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/web-v2/script-actions.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of '启动.ps1', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of '安装.ps1', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of '环境检查.cmd', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of '试用说明.md', LF will be replaced by CRLF the next time Git touches it
 README.md                                          |    6 +-
 docs/ai_engineering/01_architecture.md             |    4 +
 docs/ai_engineering/03_interfaces.md               |    9 +
 docs/ai_engineering/04_build_test.md               |   10 +
 docs/modules/test-workbench.md                     |   18 +
 docs/requirements/README.md                        |    2 +-
 .../00_user_requirement.md                         |    9 +
 .../REQ-0001-release-readiness/02_design.md        |    1 +
 .../REQ-0001-release-readiness/03_tasks.md         |    5 +
 .../REQ-0001-release-readiness/04_verification.md  |    5 +
 .../REQ-0001-release-readiness/05_trace.md         |    5 +
 .../REQ-0001-release-readiness/change_log.md       |    2 +
 .../REQ-0001-release-readiness/current_state.md    |   20 +-
 .../delivery_evidence.md                           | 1516 +++++++++++++++++++-
 .../requirement.source.json                        |  202 ++-
 .../00_user_requirement.md                         |   15 +
 .../01_development_requirement.md                  |    3 +
 .../02_design.md                                   |    4 +
 .../03_tasks.md                                    |    4 +
 .../04_verification.md                             |    9 +-
 .../05_trace.md                                    |    4 +
 .../change_log.md                                  |    2 +
 .../current_state.md                               |   20 +-
 .../delivery_evidence.md                           | 1408 ++++++++++++------
 .../requirement.source.json                        |  269 +++-
 harness-probe/src/harness-runner.mjs               |    6 +-
 harness-probe/src/verify-candidate.mjs             |    3 +-
 package.json                                       |   11 +-
 workbench/README.md                                |    4 +
 workbench/config/candidate.playwright.config.mjs   |    4 +-
 workbench/package.json                             |   26 +-
 .../scripts/start-workbench.local.json.example     |    3 +-
 workbench/scripts/start-workbench.ps1              |   98 +-
 workbench/server/app.mjs                           |   28 +-
 workbench/server/auth/catalog.mjs                  |   30 +
 workbench/server/auth/session.mjs                  |  101 +-
 workbench/server/batches.mjs                       |   26 +-
 workbench/server/build/adapter.mjs                 |    9 +-
 workbench/server/build/candidate-trials.mjs        |  112 +-
 workbench/server/build/development-dom-read.mjs    |    2 +-
 workbench/server/build/development-evidence.mjs    |    1 +
 workbench/server/build/development-feedback.mjs    |   13 +-
 workbench/server/build/development-fidelity.mjs    |   32 +-
 workbench/server/build/development-patch.mjs       |    7 +-
 workbench/server/build/development-session.mjs     |   53 +-
 workbench/server/build/development-task.mjs        |  105 +-
 workbench/server/build/manager.mjs                 |   14 +
 workbench/server/build/step-observer.mjs           |   11 +-
 workbench/server/build/store.mjs                   |    1 +
 workbench/server/build/trial-environment.mjs       |   19 +
 workbench/server/build/user-workflow.mjs           |   29 +-
 workbench/server/execution-records.mjs             |    3 +
 workbench/server/executor.mjs                      |   89 +-
 workbench/server/index.mjs                         |   47 +-
 workbench/server/report-snapshots.mjs              |    7 +-
 workbench/server/script-operations.mjs             |   30 +-
 workbench/server/store.mjs                         |    1 +
 workbench/tests/development-session.test.mjs       |    7 +-
 workbench/tests/product-v21.test.mjs               |   21 +-
 workbench/web-v2/app.js                            |   30 +-
 workbench/web-v2/execution-media.js                |    1 +
 workbench/web-v2/script-actions.js                 |    7 +
 workbench/web-v2/workflow.js                       |    5 +-
 "\345\220\257\345\212\250.ps1"                     |   63 +-
 "\345\256\211\350\243\205.ps1"                     |   45 +-
 ...16\257\345\242\203\346\243\200\346\237\245.cmd" |    4 +-
 ...257\225\347\224\250\350\257\264\346\230\216.md" |   93 +-
 67 files changed, 3891 insertions(+), 862 deletions(-)
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
workbench/config/empty-trial.json
workbench/docs/release-candidate.md
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
workbench/qa/20260925-release/REPORT.md
workbench/qa/20260925-release/auth-diagnosis.md
workbench/qa/20260925-release/auth-engineering-final.log
workbench/qa/20260925-release/cases.import.json
workbench/qa/20260925-release/delivery-collector.log
workbench/qa/20260925-release/engineering-delivery.log
workbench/qa/20260925-release/engineering-first.log
workbench/qa/20260925-release/engineering-fixed.log
workbench/qa/20260925-release/fixture/SPEC.md
workbench/qa/20260925-release/fixture/cases.json
workbench/qa/20260925-release/fixture/freeze.json
workbench/qa/20260925-release/fixture/index.html
workbench/qa/20260925-release/fixture/kimi-exit-code.txt
workbench/qa/20260925-release/fixture/kimi-generation-stderr.log
workbench/qa/20260925-release/fixture/kimi-prompt.txt
workbench/qa/20260925-release/fixture/kimi-raw-output.txt
workbench/qa/20260925-release/fixture/server.mjs
workbench/qa/20260925-release/history-before.json
workbench/qa/20260925-release/import-preview.json
workbench/qa/20260925-release/import-result.json
workbench/qa/20260925-release/install-diagnostic.log
workbench/qa/20260925-release/login-resume-check-2.json
workbench/qa/20260925-release/login-resume-check.json
workbench/qa/20260925-release/package-build-20260926-01.log
workbench/qa/20260925-release/package-candidate-20260926-01.zip
workbench/qa/20260925-release/package-check-install-20260926-01.log
workbench/qa/20260925-release/package-extract-20260926-01/candidate-manifest.json
workbench/qa/20260925-release/package-extract-20260926-01/harness-probe/package-lock.json
workbench/qa/20260925-release/package-extract-20260926-01/harness-probe/package.json
workbench/qa/20260925-release/package-extract-20260926-01/harness-probe/src/candidate-verifier.mjs
workbench/qa/20260925-release/package-extract-20260926-01/harness-probe/src/fixture-server.mjs
workbench/qa/20260925-release/package-extract-20260926-01/harness-probe/src/harness-runner.mjs
workbench/qa/20260925-release/package-extract-20260926-01/harness-probe/src/process-control.mjs
workbench/qa/20260925-release/package-extract-20260926-01/harness-probe/src/redact.mjs
workbench/qa/20260925-release/package-extract-20260926-01/harness-probe/src/setup-harness.mjs
workbench/qa/20260925-release/package-extract-20260926-01/harness-probe/src/verify-candidate.mjs
workbench/qa/20260925-release/package-extract-20260926-01/package-lock.json
workbench/qa/20260925-release/package-extract-20260926-01/package.json
workbench/qa/20260925-release/package-extract-20260926-01/workbench/config/candidate.playwright.config.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/config/empty-trial.json
workbench/qa/20260925-release/package-extract-20260926-01/workbench/docs/release-candidate.md
workbench/qa/20260925-release/package-extract-20260926-01/workbench/examples/M3A_CASE_IMPORT_TEMPLATE_V1.xlsx
workbench/qa/20260925-release/package-extract-20260926-01/workbench/package-lock.json
workbench/qa/20260925-release/package-extract-20260926-01/workbench/package.json
workbench/qa/20260925-release/package-extract-20260926-01/workbench/scripts/check-install.ps1
workbench/qa/20260925-release/package-extract-20260926-01/workbench/scripts/package-candidate.py
workbench/qa/20260925-release/package-extract-20260926-01/workbench/scripts/start-workbench.local.json.example
workbench/qa/20260925-release/package-extract-20260926-01/workbench/scripts/start-workbench.ps1
workbench/qa/20260925-release/package-extract-20260926-01/workbench/scripts/unfamiliar-site-server.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/app.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/atomic-json.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/auth/catalog.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/auth/session.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/batches.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/adapter.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/assessments.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/browser-semantics.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/candidate-trials.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/caption-video.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/development-authorization.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/development-bundle.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/development-dom-read.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/development-evidence.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/development-feedback.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/development-fidelity.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/development-mcp.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/development-patch.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/development-policy.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/development-session.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/development-task.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/development-tool-guard.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/diagnostic.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/files.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/finalize-lifecycle.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/heldout-query.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/manager.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/project-case.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/report.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/revalidations.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/step-observer.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/step-replay.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/store.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/template.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/trial-environment.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/trial-timeline.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/build/user-workflow.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/cases/excel.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/cases/manager.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/cases/store.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/execution-records.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/executor.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/index.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/integrity.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/paths.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/register-approved.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/register-m2c-revalidation.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/register-m2c-runtime-revalidation.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/register-m2c-wait-fix-validation.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/register-reviewed-asset.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/registry.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/report-snapshots.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/report.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/revalidate-m2c-runtime-fix.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/reviewed-asset.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/script-operations.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/service-identity.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/service-shutdown.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/server/store.mjs
workbench/qa/20260925-release/package-extract-20260926-01/workbench/web-v2/api.js
workbench/qa/20260925-release/package-extract-20260926-01/workbench/web-v2/app.js
workbench/qa/20260925-release/package-extract-20260926-01/workbench/web-v2/execution-media.js
workbench/qa/20260925-release/package-extract-20260926-01/workbench/web-v2/history.js
workbench/qa/20260925-release/package-extract-20260926-01/workbench/web-v2/index.html
workbench/qa/20260925-release/package-extract-20260926-01/workbench/web-v2/product.css
workbench/qa/20260925-release/package-extract-20260926-01/workbench/web-v2/reports.js
workbench/qa/20260925-release/package-extract-20260926-01/workbench/web-v2/script-actions.js
workbench/qa/20260925-release/package-extract-20260926-01/workbench/web-v2/styles.css
workbench/qa/20260925-release/package-extract-20260926-01/workbench/web-v2/workflow.js
workbench/qa/20260925-release/package-extract-20260926-01/启动.cmd
workbench/qa/20260925-release/package-extract-20260926-01/启动.ps1
workbench/qa/20260925-release/package-extract-20260926-01/安装.cmd
workbench/qa/20260925-release/package-extract-20260926-01/安装.ps1
workbench/qa/20260925-release/package-extract-20260926-01/环境检查.cmd
workbench/qa/20260925-release/package-extract-20260926-01/试用说明.md
workbench/qa/20260925-release/package-isolated-extract-20260926-01.log
workbench/qa/20260925-release/package-isolated-extract-20260926-01.py
workbench/qa/20260925-release/package-negative-extra_file-20260926-01.zip
workbench/qa/20260925-release/package-negative-path_traversal-20260926-01.zip
workbench/qa/20260925-release/package-negative-tampered_byte-20260926-01.zip
workbench/qa/20260925-release/package-npm-harness-20260926-01.log
workbench/qa/20260925-release/package-npm-root-20260926-01.log
workbench/qa/20260925-release/package-npm-workbench-20260926-01.log
workbench/qa/20260925-release/package-report-20260926-01.md
workbench/qa/20260925-release/package-self-verify-20260926-01.log
workbench/qa/20260925-release/package-validation-20260926-01.log
workbench/qa/20260925-release/package-validation-20260926-01.py
workbench/qa/20260925-release/project.json
workbench/qa/20260925-release/regression-baseline.json
workbench/qa/20260925-release/regression-round1-preview.json
workbench/qa/20260925-release/regression-round1-result.json
workbench/qa/20260925-release/regression-round2-preview.json
workbench/qa/20260925-release/regression-round2-result.json
workbench/qa/20260925-release/service-before-model.json
workbench/qa/20260925-release/supervisor-integrity.json
workbench/qa/20260925-release/trial-16ae0e106017771362a2606c6139d94ac1ab742d.json
workbench/qa/20260925-release/trial-9151381b55f9745a00a873634799ba43e288fb87.json
workbench/qa/20260925-release/trial-a9d5774951a9252158a668d889d7e21145ad1b81.json
workbench/qa/20260925-release/trial-d984ffd689a7227fad8a2c637ab8b5c69725264c.json
workbench/qa/20260925-release/ui/login-required.txt
workbench/qa/20260925-release/ui/regression-round1-detail.png
workbench/qa/20260925-release/ui/regression-round1-detail.txt
workbench/qa/20260925-release/ui/regression-round1.png
workbench/qa/20260925-release/ui/regression-round1.txt
workbench/qa/20260925-release/unauthenticated-preflight.json
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
workbench/scripts/check-install.ps1
workbench/scripts/package-candidate.py
workbench/scripts/run-unit-checks.mjs
workbench/scripts/test-manifest.json
workbench/scripts/verify-official-workbench.mjs
workbench/server/atomic-json.mjs
workbench/server/service-identity.mjs
workbench/server/service-shutdown.mjs
workbench/tests/auth-concurrency.test.mjs
workbench/tests/development-auth-binding.test.mjs
workbench/tests/development-reliability.test.mjs
workbench/tests/runtime-reliability.test.mjs
workbench/tests/supervisor-reliability.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-26T08:53:42+08:00
Command: npm test
Exit code: 0
Parsed test count: 74
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
  duration_ms: 33.6083
  type: 'test'
  ...
# Subtest: clear and close wait for a preparing browser and leave no session
ok 2 - clear and close wait for a preparing browser and leave no session
  ---
  duration_ms: 24.0928
  type: 'test'
  ...
# Subtest: clear waits for identity check, notifies invalidation once, and prevents stale VALID state
ok 3 - clear waits for identity check, notifies invalidation once, and prevents stale VALID state
  ---
  duration_ms: 11.2566
  type: 'test'
  ...
# Subtest: Harness stderr diagnostic keeps error context and redacts credentials
ok 4 - Harness stderr diagnostic keeps error context and redacts credentials
  ---
  duration_ms: 5.7903
  type: 'test'
  ...
# Subtest: stored DSH credential is redacted even without a sk prefix
ok 5 - stored DSH credential is redacted even without a sk prefix
  ---
  duration_ms: 20.6384
  type: 'test'
  ...
# Subtest: pre-registered generation cannot advertise an expired authenticated session as ready
ok 6 - pre-registered generation cannot advertise an expired authenticated session as ready
  ---
  duration_ms: 21.0608
  type: 'test'
  ...
# Subtest: explicit auth catalog accepts registered same-origin HTTPS and rejects unsafe targets
ok 7 - explicit auth catalog accepts registered same-origin HTTPS and rejects unsafe targets
  ---
  duration_ms: 2.4894
  type: 'test'
  ...
# Subtest: identity redirect fails closed without following a cross-origin or downgraded Location
ok 8 - identity redirect fails closed without following a cross-origin or downgraded Location
  ---
  duration_ms: 3.2236
  type: 'test'
  ...
# Subtest: development auth binds the registered target, fixed role and valid session without anonymous fetch
ok 9 - development auth binds the registered target, fixed role and valid session without anonymous fetch
  ---
  duration_ms: 2.3369
  type: 'test'
  ...
# Subtest: auth development patch retains MCP guard and switches browser to memory attachment
ok 10 - auth development patch retains MCP guard and switches browser to memory attachment
  ---
  duration_ms: 0.9615
  type: 'test'
  ...
# Subtest: self-test receives authentication only through verifier input and persists no state
ok 11 - self-test receives authentication only through verifier input and persists no state
  ---
  duration_ms: 47.743
  type: 'test'
  ...
# Subtest: registered auth trial target uses the existing target and has no negative lane
ok 12 - registered auth trial target uses the existing target and has no negative lane
  ---
  duration_ms: 1.2227
  type: 'test'
  ...
# Subtest: authenticated development evidence is complete without a network trace
ok 13 - authenticated development evidence is complete without a network trace
  ---
  duration_ms: 1.6141
  type: 'test'
  ...
# Subtest: authenticated candidate cannot be mapped to another project session
ok 14 - authenticated candidate cannot be mapped to another project session
  ---
  duration_ms: 2.1902
  type: 'test'
  ...
# Subtest: normal-only requires explicit registration and never invents a fault lane
ok 15 - normal-only requires explicit registration and never invents a fault lane
  ---
  duration_ms: 3.6507
  type: 'test'
  ...
# Subtest: paired default still requires fault, and semantic remains explicit
ok 16 - paired default still requires fault, and semantic remains explicit
  ---
  duration_ms: 0.716
  type: 'test'
  ...
# Subtest: exploratory budget is explicit, bounded and does not inflate standard receipts
ok 17 - exploratory budget is explicit, bounded and does not inflate standard receipts
  ---
  duration_ms: 1.0892
  type: 'test'
  ...
# Subtest: first recovery execution snapshots authorized complete package despite native file edits
ok 18 - first recovery execution snapshots authorized complete package despite native file edits
  ---
  duration_ms: 101.9623
  type: 'test'
  ...
# Subtest: same failed bundle needs a new observation or revision before another execution
ok 19 - same failed bundle needs a new observation or revision before another execution
  ---
  duration_ms: 49.2931
  type: 'test'
  ...
# Subtest: ready submission rejects a finite known obligation gap while review stays unapproved
ok 20 - ready submission rejects a finite known obligation gap while review stays unapproved
  ---
  duration_ms: 51.2645
  type: 'test'
  ...
# Subtest: submission persists hash-bound frozen-action review with observed execution
ok 21 - submission persists hash-bound frozen-action review with observed execution
  ---
  duration_ms: 49.9894
  type: 'test'
  ...
# Subtest: budget feedback and narrow DOM read capability remain bounded
ok 22 - budget feedback and narrow DOM read capability remain bounded
  ---
  duration_ms: 3.1922
  type: 'test'
  ...
# Subtest: DSH tool call/result projection keeps only correlation and success metadata
ok 23 - DSH tool call/result projection keeps only correlation and success metadata
  ---
  duration_ms: 2.7608
  type: 'test'
  ...
# Subtest: finite pre-step review catches historical changed-list examples without case-ID rules
ok 24 - finite pre-step review catches historical changed-list examples without case-ID rules
  ---
  duration_ms: 56.4404
  type: 'test'
  ...
# Subtest: pinned DSH MCP client receives fixture executor failure, continues repair and freezes only newly tested bytes
ok 25 - pinned DSH MCP client receives fixture executor failure, continues repair and freezes only newly tested bytes
  ---
  duration_ms: 334.1
  type: 'test'
  ...
# Subtest: self-test limit is cumulative and further edits cannot create an unverified final version
ok 26 - self-test limit is cumulative and further edits cannot create an unverified final version
  ---
  duration_ms: 86.2848
  type: 'test'
  ...
# Subtest: cancellation reaches an active execution and later tools stop
ok 27 - cancellation reaches an active execution and later tools stop
  ---
  duration_ms: 18.0027
  type: 'test'
  ...
# Subtest: wall budget terminates before another tool or executor admission
ok 28 - wall budget terminates before another tool or executor admission
  ---
  duration_ms: 5.7778
  type: 'test'
  ...
# Subtest: from-scratch null CAS accepts ESM draft; rejected require does not create or execute a candidate
ok 29 - from-scratch null CAS accepts ESM draft; rejected require does not create or execute a candidate
  ---
  duration_ms: 47.9832
  type: 'test'
  ...
# Subtest: task guard denies arbitrary commands, filesystem, code and alternate navigation
ok 30 - task guard denies arbitrary commands, filesystem, code and alternate navigation
  ---
  duration_ms: 4.7325
  type: 'test'
  ...
# Subtest: report snapshots freeze exact run, escape content, redact fields and embed verified media
ok 31 - report snapshots freeze exact run, escape content, redact fields and embed verified media
  ---
  duration_ms: 52.9402
  type: 'test'
  ...
# Subtest: report missing/tampered media remains missing and blocked batch items stay in denominator
ok 32 - report missing/tampered media remains missing and blocked batch items stay in denominator
  ---
  duration_ms: 25.3563
  type: 'test'
  ...
# Subtest: report cancellation prevents snapshot commit and pending conflicting request is rejected
ok 33 - report cancellation prevents snapshot commit and pending conflicting request is rejected
  ---
  duration_ms: 11.212
  type: 'test'
  ...
# Subtest: generation preflight has real authorization boundary, separates revision input, no task on rejection
ok 34 - generation preflight has real authorization boundary, separates revision input, no task on rejection
  ---
  duration_ms: 12.6461
  type: 'test'
  ...
# Subtest: invalid revision seed cannot consume an existing authorization
ok 35 - invalid revision seed cannot consume an existing authorization
  ---
  duration_ms: 12.1586
  type: 'test'
  ...
# Subtest: generation queue freezes each input, preserves mode, is idempotent and does not create grants (coordinator unit double)
ok 36 - generation queue freezes each input, preserves mode, is idempotent and does not create grants (coordinator unit double)
  ---
  duration_ms: 44.3773
  type: 'test'
  ...
# Subtest: revision passes verified complete bundle and selected feedback; cancellation is durable and restart does not replay (unit double)
ok 37 - revision passes verified complete bundle and selected feedback; cancellation is durable and restart does not replay (unit double)
  ---
  duration_ms: 72.1207
  type: 'test'
  ...
# Subtest: explicit user generation confirms bounded new receipt without resetting consumed grants; preflight is read-only
ok 38 - explicit user generation confirms bounded new receipt without resetting consumed grants; preflight is read-only
  ---
  duration_ms: 47.3944
  type: 'test'
  ...
# Subtest: user-confirmed revision receipt persists UTF-8 seed and whole bundle without approving script
ok 39 - user-confirmed revision receipt persists UTF-8 seed and whole bundle without approving script
  ---
  duration_ms: 44.742
  type: 'test'
  ...
# Subtest: original TC-005 raw report maps multiline values and the same failed step offline
ok 40 - original TC-005 raw report maps multiline values and the same failed step offline
  ---
  duration_ms: 27.1368
  type: 'test'
  ...
# Subtest: string
ok 41 - string
  ---
  duration_ms: 1.9738
  type: 'test'
  ...
# Subtest: ansi
ok 42 - ansi
  ---
  duration_ms: 1.2317
  type: 'test'
  ...
# Subtest: missing
ok 43 - missing
  ---
  duration_ms: 0.715
  type: 'test'
  ...
# Subtest: strict
ok 44 - strict
  ---
  duration_ms: 0.9056
  type: 'test'
  ...
# Subtest: single side
ok 45 - single side
  ---
  duration_ms: 1.1971
  type: 'test'
  ...
# Subtest: timeout
ok 46 - timeout
  ---
  duration_ms: 2.2421
  type: 'test'
  ...
# Subtest: truncated array
ok 47 - truncated array
  ---
  duration_ms: 0.9944
  type: 'test'
  ...
# Subtest: truncated diff
ok 48 - truncated diff
  ---
  duration_ms: 1.2436
  type: 'test'
  ...
# Subtest: array
ok 49 - array
  ---
  duration_ms: 1.4774
  type: 'test'
  ...
# Subtest: structured matcher data precedes text without inventing single-sided actual
ok 50 - structured matcher data precedes text without inventing single-sided actual
  ---
  duration_ms: 0.9236
  type: 'test'
  ...
# Subtest: real KC-02 self-tests retain failure, continued steps and captured locator actual
ok 51 - real KC-02 self-tests retain failure, continued steps and captured locator actual
  ---
  duration_ms: 22.8575
  type: 'test'
  ...
# Subtest: only attributed evidence is displayed; zero and false are not missing
ok 52 - only attributed evidence is displayed; zero and false are not missing
  ---
  duration_ms: 0.8161
  type: 'test'
  ...
# Subtest: recorded replay steps remain authoritative and successful run has no failure notice
ok 53 - recorded replay steps remain authoritative and successful run has no failure notice
  ---
  duration_ms: 0.403
  type: 'test'
  ...
# {"type":"build_storage_failure","code":"EIO","operation":"trial_stop_update","at":"2026-09-26T00:53:48.788Z"}
# {"type":"build_storage_failure","code":"EIO","operation":"trial_stop_read","at":"2026-09-26T00:53:48.791Z"}
# {"type":"build_storage_failure","code":"EIO","operation":"trial_stop_update","at":"2026-09-26T00:53:48.792Z"}
# Subtest: terminal candidate trial stop is idempotent while active cleanup is pending
ok 54 - terminal candidate trial stop is idempotent while active cleanup is pending
  ---
  duration_ms: 3.7591
  type: 'test'
  ...
# Subtest: queued stop updater cannot turn a concurrent terminal write back into STOPPING
ok 55 - queued stop updater cannot turn a concurrent terminal write back into STOPPING
  ---
  duration_ms: 0.9374
  type: 'test'
  ...
# Subtest: stop queued behind a pending terminal write preserves FINISHED
ok 56 - stop queued behind a pending terminal write preserves FINISHED
  ---
  duration_ms: 1.0151
  type: 'test'
  ...
# Subtest: candidate stop persistence failure degrades manager and rejects new work
ok 57 - candidate stop persistence failure degrades manager and rejects new work
  ---
  duration_ms: 3.5844
  type: 'test'
  ...
# Subtest: candidate stop read failure still aborts the captured owned task
ok 58 - candidate stop read failure still aborts the captured owned task
  ---
  duration_ms: 0.7436
  type: 'test'
  ...
# Subtest: candidate stop never aborts a replacement active task
ok 59 - candidate stop never aborts a replacement active task
  ---
  duration_ms: 0.6326
  type: 'test'
  ...
# Subtest: script and batch reserve mutually exclusive preparation windows
ok 60 - script and batch reserve mutually exclusive preparation windows
  ---
  duration_ms: 40.2581
  type: 'test'
  ...
# {"type":"build_storage_failure","code":"EEXIST","operation":"generation_save","at":"2026-09-26T00:53:48.839Z"}
# {"type":"build_storage_failure","code":"EEXIST","operation":"batch_save","at":"2026-09-26T00:53:48.840Z"}
# Subtest: script and batch persistence failures report storage fault
ok 61 - script and batch persistence failures report storage fault
  ---
  duration_ms: 12.3947
  type: 'test'
  ...
# Subtest: batch and script save retry a transient Windows rename error without degrading
ok 62 - batch and script save retry a transient Windows rename error without degrading
  ---
  duration_ms: 20.1694
  type: 'test'
  ...
# {"type":"build_storage_failure","code":"EPERM","operation":"batch_save","at":"2026-09-26T00:53:48.874Z"}
# {"type":"build_storage_failure","code":"EPERM","operation":"generation_save","at":"2026-09-26T00:53:48.880Z"}
# Subtest: batch and script save exhaust rename retries, preserve old JSON, and lock storage
ok 63 - batch and script save exhaust rename retries, preserve old JSON, and lock storage
  ---
  duration_ms: 21.2464
  type: 'test'
  ...
# {"type":"build_storage_failure","code":"EIO","operation":"trial_result_update","at":"2026-09-26T00:53:48.904Z"}
# Subtest: background terminal write failure remains visible as degraded without a false FINISHED state
ok 64 - background terminal write failure remains visible as degraded without a false FINISHED state
  ---
  duration_ms: 22.3432
  type: 'test'
  ...
# Subtest: health remains inspectable after storage read failure and rejects new writes
ok 65 - health remains inspectable after storage read failure and rejects new writes
  ---
  duration_ms: 8.3624
  type: 'test'
  ...
# Subtest: generation ownership blocks new work but allows owned candidate cancellation
ok 66 - generation ownership blocks new work but allows owned candidate cancellation
  ---
  duration_ms: 1.5472
  type: 'test'
  ...
# Subtest: preparing build prevents approved run entry before active is assigned
ok 67 - preparing build prevents approved run entry before active is assigned
  ---
  duration_ms: 1.5525
  type: 'test'
  ...
# Subtest: shutdown refuses admission first, stops both executors, drains and closes auth once
ok 68 - shutdown refuses admission first, stops both executors, drains and closes auth once
  ---
  duration_ms: 3.6804
  type: 'test'
  ...
# Subtest: service identity changes with source and new records retain captured identity
ok 69 - service identity changes with source and new records retain captured identity
  ---
  duration_ms: 79.8878
  type: 'test'
  ...
# Subtest: approved executor keeps ownership through failed finalization and rejects the completion
ok 70 - approved executor keeps ownership through failed finalization and rejects the completion
  ---
  duration_ms: 6.8632
  type: 'test'
  ...
# Subtest: approved executor start guard includes peer preparation and shutdown
ok 71 - approved executor start guard includes peer preparation and shutdown
  ---
  duration_ms: 2.1872
  type: 'test'
  ...
# Subtest: offline report carries the captured execution identity and escaped fidelity materials
ok 72 - offline report carries the captured execution identity and escaped fidelity materials
  ---
  duration_ms: 1.6842
  type: 'test'
  ...
# Subtest: failed STOPPING persistence still cancels owned child and latches fault
ok 73 - failed STOPPING persistence still cancels owned child and latches fault
  ---
  duration_ms: 0.9095
  type: 'test'
  ...
# Subtest: shutdown timeout is bounded, closes auth and never reports drained success
ok 74 - shutdown timeout is bounded, closes auth and never reports drained success
  ---
  duration_ms: 49.3576
  type: 'test'
  ...
1..74
# tests 74
# suites 0
# pass 74
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2600.0592
```

### Sync Record Status

```text
DRY-RUN: no derived changes for REQ-0001-release-readiness; explicit implementation states retained, never inferred from verification.
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
3. docs
   Problem: Code/test/config changes are linked to multiple or mixed governance records.
   Fix: Keep one changed FIX or one changed real REQ for this delivery, or split the work. Changed records: REQ-0001-release-readiness, REQ-0037-autonomous-candidate-development
```

### Notes

2026-09-26发布收口固定工程清单；认证真实模型未运行、正式发布未验收。两轮4322复跑及包证据另见REPORT.md。
