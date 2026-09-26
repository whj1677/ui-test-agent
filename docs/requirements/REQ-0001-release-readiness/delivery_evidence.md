# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-26T10:31:07+08:00`
- Record: `REQ-0001-release-readiness`
- Change fingerprint: `ad8d282c578b2994518b4c50678edda08e05dd93060fb8bf489b31619c7859b0`
- Verification source: `collector-executed-v1`
- Verification state: `单元测试通过`
- Command: `node --test workbench/tests/execution-media-timing.test.mjs`
- Exit code: `0`
- Test count: `4`
- Failure count: `0`
- Skipped count: `0`
- Log path: `workbench/qa/20260926-timing/governance-verification.log`
- Log SHA-256: `1d7c4a19cee2e5e0589fcc4d4eb9e59bd8cf8635f6b9b15ac3cf636995cb8a73`

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
 M workbench/server/build/development-bundle.mjs
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
?? workbench/qa/20260925-release/auth-after-protection.json
?? workbench/qa/20260925-release/auth-after-replay.json
?? workbench/qa/20260925-release/auth-diagnosis.md
?? workbench/qa/20260925-release/auth-engineering-final.log
?? workbench/qa/20260925-release/authenticated-operations-start.json
?? workbench/qa/20260925-release/authenticated-replay-result.json
?? workbench/qa/20260925-release/authenticated-semantic-review.md
?? workbench/qa/20260925-release/authenticated-start-check.json
?? workbench/qa/20260925-release/case02-task-first.json
?? workbench/qa/20260925-release/case02-task-retry.json
?? workbench/qa/20260925-release/case03-task.json
?? workbench/qa/20260925-release/cases.import.json
?? workbench/qa/20260925-release/delivery-auth-collector.log
?? workbench/qa/20260925-release/delivery-collector.log
?? workbench/qa/20260925-release/delivery-evidence-engineering.md
?? workbench/qa/20260925-release/engineering-delivery.log
?? workbench/qa/20260925-release/engineering-first.log
?? workbench/qa/20260925-release/engineering-fixed.log
?? workbench/qa/20260925-release/engineering-session-protection.log
?? workbench/qa/20260925-release/expired-replay-preflight.json
?? workbench/qa/20260925-release/fixture/SPEC.md
?? workbench/qa/20260925-release/fixture/cases.json
?? workbench/qa/20260925-release/fixture/freeze.json
?? workbench/qa/20260925-release/fixture/index.html
?? workbench/qa/20260925-release/fixture/kimi-exit-code.txt
?? workbench/qa/20260925-release/fixture/kimi-generation-stderr.log
?? workbench/qa/20260925-release/fixture/kimi-prompt.txt
?? workbench/qa/20260925-release/fixture/kimi-raw-output.txt
?? workbench/qa/20260925-release/fixture/server.mjs
?? workbench/qa/20260925-release/governance-auth-final.log
?? workbench/qa/20260925-release/governance-final.log
?? workbench/qa/20260925-release/history-before.json
?? workbench/qa/20260925-release/import-preview.json
?? workbench/qa/20260925-release/import-result.json
?? workbench/qa/20260925-release/install-diagnostic.log
?? workbench/qa/20260925-release/login-final-check.json
?? workbench/qa/20260925-release/login-resume-check-2.json
?? workbench/qa/20260925-release/login-resume-check.json
?? workbench/qa/20260925-release/official-after-protection.json
?? workbench/qa/20260925-release/official-check-final.log
?? workbench/qa/20260925-release/package-build-20260926-01.log
?? workbench/qa/20260925-release/package-build-20260926-02.log
?? workbench/qa/20260925-release/package-candidate-20260926-01.zip
?? workbench/qa/20260925-release/package-candidate-20260926-02.zip
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
?? workbench/qa/20260925-release/package-negative-extra_file-20260926-02.zip
?? workbench/qa/20260925-release/package-negative-path_traversal-20260926-01.zip
?? workbench/qa/20260925-release/package-negative-path_traversal-20260926-02.zip
?? workbench/qa/20260925-release/package-negative-tampered_byte-20260926-01.zip
?? workbench/qa/20260925-release/package-negative-tampered_byte-20260926-02.zip
?? workbench/qa/20260925-release/package-npm-harness-20260926-01.log
?? workbench/qa/20260925-release/package-npm-root-20260926-01.log
?? workbench/qa/20260925-release/package-npm-workbench-20260926-01.log
?? workbench/qa/20260925-release/package-report-20260926-01.md
?? workbench/qa/20260925-release/package-report-20260926-02.md
?? workbench/qa/20260925-release/package-self-verify-20260926-01.log
?? workbench/qa/20260925-release/package-validation-20260926-01.log
?? workbench/qa/20260925-release/package-validation-20260926-01.py
?? workbench/qa/20260925-release/package-validation-20260926-02.log
?? workbench/qa/20260925-release/package-validation-20260926-02.py
?? workbench/qa/20260925-release/project.json
?? workbench/qa/20260925-release/regression-baseline.json
?? workbench/qa/20260925-release/regression-round1-preview.json
?? workbench/qa/20260925-release/regression-round1-result.json
?? workbench/qa/20260925-release/regression-round2-preview.json
?? workbench/qa/20260925-release/regression-round2-result.json
?? workbench/qa/20260925-release/service-after-protection.json
?? workbench/qa/20260925-release/service-before-model.json
?? workbench/qa/20260925-release/supervisor-integrity-auth.json
?? workbench/qa/20260925-release/supervisor-integrity-auth.py
?? workbench/qa/20260925-release/supervisor-integrity.json
?? workbench/qa/20260925-release/trial-16ae0e106017771362a2606c6139d94ac1ab742d.json
?? workbench/qa/20260925-release/trial-412754a6fefcff2cb3f6cb3caa6d26f18bed83d8.json
?? workbench/qa/20260925-release/trial-9151381b55f9745a00a873634799ba43e288fb87.json
?? workbench/qa/20260925-release/trial-a9d5774951a9252158a668d889d7e21145ad1b81.json
?? workbench/qa/20260925-release/trial-c17f41c319910f85941c4602db0eea0467c737db.json
?? workbench/qa/20260925-release/trial-d984ffd689a7227fad8a2c637ab8b5c69725264c.json
?? workbench/qa/20260925-release/ui/authenticated-replay-batch.png
?? workbench/qa/20260925-release/ui/authenticated-replay-batch.txt
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
?? workbench/qa/20260926-timing/CASE-02-rerun.json
?? workbench/qa/20260926-timing/CASE-03-rerun.json
?? workbench/qa/20260926-timing/REPORT.md
?? workbench/qa/20260926-timing/auth-after-rerun.json
?? workbench/qa/20260926-timing/case02-task.json
?? workbench/qa/20260926-timing/engineering-final.log
?? workbench/qa/20260926-timing/engineering-first.log
?? workbench/qa/20260926-timing/engineering-presentation-final.log
?? workbench/qa/20260926-timing/governance-check.log
?? workbench/qa/20260926-timing/governance-collector.log
?? workbench/qa/20260926-timing/governance-sync.log
?? workbench/qa/20260926-timing/governance-verification.log
?? workbench/qa/20260926-timing/history-before.json
?? workbench/qa/20260926-timing/independent-code-review.md
?? workbench/qa/20260926-timing/independent-semantic-review.md
?? workbench/qa/20260926-timing/official-final.log
?? workbench/qa/20260926-timing/original-rejection.json
?? workbench/qa/20260926-timing/package-build-20260926-03.log
?? workbench/qa/20260926-timing/package-build-20260926-04.log
?? workbench/qa/20260926-timing/package-candidate-20260926-03.zip
?? workbench/qa/20260926-timing/package-candidate-20260926-04.zip
?? workbench/qa/20260926-timing/package-extract-20260926-03/candidate-manifest.json
?? workbench/qa/20260926-timing/package-extract-20260926-03/harness-probe/package-lock.json
?? workbench/qa/20260926-timing/package-extract-20260926-03/harness-probe/package.json
?? workbench/qa/20260926-timing/package-extract-20260926-03/harness-probe/src/candidate-verifier.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/harness-probe/src/fixture-server.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/harness-probe/src/harness-runner.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/harness-probe/src/process-control.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/harness-probe/src/redact.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/harness-probe/src/setup-harness.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/harness-probe/src/verify-candidate.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/package-lock.json
?? workbench/qa/20260926-timing/package-extract-20260926-03/package.json
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/config/candidate.playwright.config.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/config/empty-trial.json
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/docs/release-candidate.md
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/examples/M3A_CASE_IMPORT_TEMPLATE_V1.xlsx
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/package-lock.json
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/package.json
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/scripts/check-install.ps1
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/scripts/package-candidate.py
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/scripts/start-workbench.local.json.example
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/scripts/start-workbench.ps1
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/scripts/unfamiliar-site-server.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/app.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/atomic-json.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/auth/catalog.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/auth/session-request-policy.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/auth/session.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/batches.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/adapter.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/assessments.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/browser-semantics.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/candidate-trials.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/caption-video.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/development-authorization.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/development-bundle.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/development-dom-read.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/development-evidence.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/development-feedback.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/development-fidelity.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/development-mcp.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/development-patch.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/development-policy.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/development-session.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/development-task.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/development-tool-guard.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/diagnostic.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/files.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/finalize-lifecycle.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/heldout-query.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/manager.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/project-case.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/report.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/revalidations.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/step-observer.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/step-replay.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/store.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/template.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/timing-evidence.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/timing-obligations.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/timing-observer.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/trial-environment.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/trial-timeline.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/user-workflow.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/cases/excel.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/cases/manager.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/cases/store.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/execution-records.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/executor.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/index.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/integrity.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/paths.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/register-approved.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/register-m2c-revalidation.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/register-m2c-runtime-revalidation.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/register-m2c-wait-fix-validation.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/register-reviewed-asset.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/registry.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/report-snapshots.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/report.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/revalidate-m2c-runtime-fix.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/reviewed-asset.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/script-operations.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/service-identity.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/service-shutdown.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/store.mjs
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/web-v2/api.js
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/web-v2/app.js
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/web-v2/execution-media.js
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/web-v2/history.js
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/web-v2/index.html
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/web-v2/product.css
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/web-v2/reports.js
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/web-v2/script-actions.js
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/web-v2/styles.css
?? workbench/qa/20260926-timing/package-extract-20260926-03/workbench/web-v2/workflow.js
?? workbench/qa/20260926-timing/package-extract-20260926-03/启动.cmd
?? workbench/qa/20260926-timing/package-extract-20260926-03/启动.ps1
?? workbench/qa/20260926-timing/package-extract-20260926-03/安装.cmd
?? workbench/qa/20260926-timing/package-extract-20260926-03/安装.ps1
?? workbench/qa/20260926-timing/package-extract-20260926-03/环境检查.cmd
?? workbench/qa/20260926-timing/package-extract-20260926-03/试用说明.md
?? workbench/qa/20260926-timing/package-extract-20260926-04/workbench/scripts/package-candidate.py
?? workbench/qa/20260926-timing/package-extract-20260926-04/workbench/web-v2/app.js
?? workbench/qa/20260926-timing/package-extract-20260926-04/workbench/web-v2/execution-media.js
?? workbench/qa/20260926-timing/package-negative-extra_file-20260926-03.zip
?? workbench/qa/20260926-timing/package-negative-missing_timing-20260926-03.zip
?? workbench/qa/20260926-timing/package-negative-path_traversal-20260926-03.zip
?? workbench/qa/20260926-timing/package-negative-timing_tamper-20260926-03.zip
?? workbench/qa/20260926-timing/package-node-check-20260926-03.log
?? workbench/qa/20260926-timing/package-node-check-20260926-04.log
?? workbench/qa/20260926-timing/package-report-20260926-03.md
?? workbench/qa/20260926-timing/package-report-20260926-04.md
?? workbench/qa/20260926-timing/package-self-verify-20260926-03.log
?? workbench/qa/20260926-timing/package-self-verify-20260926-04.log
?? workbench/qa/20260926-timing/package-validation-20260926-03.log
?? workbench/qa/20260926-timing/package-validation-20260926-03.py
?? workbench/qa/20260926-timing/package-validation-20260926-04.log
?? workbench/qa/20260926-timing/package-validation-20260926-04.py
?? workbench/qa/20260926-timing/presentation-fix-proposed.patch
?? workbench/qa/20260926-timing/record-delivery.py
?? workbench/qa/20260926-timing/reproduce-original.mjs
?? workbench/qa/20260926-timing/rerun-batch.json
?? workbench/qa/20260926-timing/service-identity-presentation.json
?? workbench/qa/20260926-timing/service-identity.json
?? workbench/qa/20260926-timing/supervisor-integrity.json
?? workbench/qa/20260926-timing/supervisor-integrity.py
?? workbench/qa/20260926-timing/timing-gates-first.log
?? workbench/qa/20260926-timing/ui/final-case02-dom.txt
?? workbench/qa/20260926-timing/ui/final-case02-full.png
?? workbench/qa/20260926-timing/ui/rerun-case02-dom.txt
?? workbench/qa/20260926-timing/ui/rerun-case02-full.png
?? workbench/qa/20260926-timing/ui/rerun-case02.png
?? workbench/scripts/check-install.ps1
?? workbench/scripts/package-candidate.py
?? workbench/scripts/run-unit-checks.mjs
?? workbench/scripts/test-manifest.json
?? workbench/scripts/verify-official-workbench.mjs
?? workbench/server/atomic-json.mjs
?? workbench/server/auth/session-request-policy.mjs
?? workbench/server/build/timing-evidence.mjs
?? workbench/server/build/timing-obligations.mjs
?? workbench/server/build/timing-observer.mjs
?? workbench/server/service-identity.mjs
?? workbench/server/service-shutdown.mjs
?? workbench/tests/auth-concurrency.test.mjs
?? workbench/tests/auth-session-request-policy.test.mjs
?? workbench/tests/development-auth-binding.test.mjs
?? workbench/tests/development-reliability.test.mjs
?? workbench/tests/execution-media-timing.test.mjs
?? workbench/tests/runtime-reliability.test.mjs
?? workbench/tests/supervisor-reliability.test.mjs
?? workbench/tests/timing-gates.test.mjs
?? workbench/tests/timing-obligations.test.mjs
?? workbench/tests/timing-observer.test.mjs
```

### Git Diff Stat

```text
warning: in the working copy of 'README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/ai_engineering/01_architecture.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/ai_engineering/03_interfaces.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/ai_engineering/04_build_test.md', LF will be replaced by CRLF the next time Git touches it
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
warning: in the working copy of 'workbench/server/build/development-bundle.mjs', LF will be replaced by CRLF the next time Git touches it
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
warning: in the working copy of 'workbench/web-v2/script-actions.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of '启动.ps1', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of '安装.ps1', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of '环境检查.cmd', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of '试用说明.md', LF will be replaced by CRLF the next time Git touches it
 README.md                                          |    6 +-
 docs/ai_engineering/01_architecture.md             |    4 +
 docs/ai_engineering/03_interfaces.md               |   12 +
 docs/ai_engineering/04_build_test.md               |   12 +
 docs/modules/test-workbench.md                     |   26 +
 docs/requirements/README.md                        |    2 +-
 .../00_user_requirement.md                         |   18 +
 .../REQ-0001-release-readiness/02_design.md        |    2 +
 .../REQ-0001-release-readiness/03_tasks.md         |    6 +
 .../REQ-0001-release-readiness/04_verification.md  |    9 +
 .../REQ-0001-release-readiness/05_trace.md         |    6 +
 .../REQ-0001-release-readiness/change_log.md       |    4 +
 .../REQ-0001-release-readiness/current_state.md    |   23 +-
 .../delivery_evidence.md                           | 1458 +++++++++++++++++++-
 .../requirement.source.json                        |  279 +++-
 .../00_user_requirement.md                         |   15 +
 .../01_development_requirement.md                  |    3 +
 .../02_design.md                                   |    4 +
 .../03_tasks.md                                    |    4 +
 .../04_verification.md                             |    9 +-
 .../05_trace.md                                    |    4 +
 .../change_log.md                                  |    2 +
 .../current_state.md                               |   20 +-
 .../delivery_evidence.md                           | 1408 +++++++++++++------
 .../requirement.source.json                        |  269 +++-
 harness-probe/src/harness-runner.mjs               |    6 +-
 harness-probe/src/verify-candidate.mjs             |   22 +-
 package.json                                       |   11 +-
 workbench/README.md                                |    4 +
 workbench/config/candidate.playwright.config.mjs   |    4 +-
 workbench/package.json                             |   26 +-
 .../scripts/start-workbench.local.json.example     |    3 +-
 workbench/scripts/start-workbench.ps1              |   98 +-
 workbench/server/app.mjs                           |   28 +-
 workbench/server/auth/catalog.mjs                  |   33 +
 workbench/server/auth/session.mjs                  |  125 +-
 workbench/server/batches.mjs                       |   26 +-
 workbench/server/build/adapter.mjs                 |    9 +-
 workbench/server/build/candidate-trials.mjs        |  125 +-
 workbench/server/build/development-bundle.mjs      |   11 +
 workbench/server/build/development-dom-read.mjs    |    2 +-
 workbench/server/build/development-evidence.mjs    |   13 +-
 workbench/server/build/development-feedback.mjs    |   14 +-
 workbench/server/build/development-fidelity.mjs    |   35 +-
 workbench/server/build/development-patch.mjs       |    7 +-
 workbench/server/build/development-session.mjs     |   69 +-
 workbench/server/build/development-task.mjs        |  111 +-
 workbench/server/build/manager.mjs                 |   28 +-
 workbench/server/build/step-observer.mjs           |   29 +-
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
 workbench/web-v2/app.js                            |   36 +-
 workbench/web-v2/execution-media.js                |   41 +-
 workbench/web-v2/script-actions.js                 |    7 +
 workbench/web-v2/workflow.js                       |    5 +-
 "\345\220\257\345\212\250.ps1"                     |   63 +-
 "\345\256\211\350\243\205.ps1"                     |   45 +-
 ...16\257\345\242\203\346\243\200\346\237\245.cmd" |    4 +-
 ...257\225\347\224\250\350\257\264\346\230\216.md" |   93 +-
 68 files changed, 4120 insertions(+), 872 deletions(-)
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
workbench/qa/20260925-release/auth-after-protection.json
workbench/qa/20260925-release/auth-after-replay.json
workbench/qa/20260925-release/auth-diagnosis.md
workbench/qa/20260925-release/auth-engineering-final.log
workbench/qa/20260925-release/authenticated-operations-start.json
workbench/qa/20260925-release/authenticated-replay-result.json
workbench/qa/20260925-release/authenticated-semantic-review.md
workbench/qa/20260925-release/authenticated-start-check.json
workbench/qa/20260925-release/case02-task-first.json
workbench/qa/20260925-release/case02-task-retry.json
workbench/qa/20260925-release/case03-task.json
workbench/qa/20260925-release/cases.import.json
workbench/qa/20260925-release/delivery-auth-collector.log
workbench/qa/20260925-release/delivery-collector.log
workbench/qa/20260925-release/delivery-evidence-engineering.md
workbench/qa/20260925-release/engineering-delivery.log
workbench/qa/20260925-release/engineering-first.log
workbench/qa/20260925-release/engineering-fixed.log
workbench/qa/20260925-release/engineering-session-protection.log
workbench/qa/20260925-release/expired-replay-preflight.json
workbench/qa/20260925-release/fixture/SPEC.md
workbench/qa/20260925-release/fixture/cases.json
workbench/qa/20260925-release/fixture/freeze.json
workbench/qa/20260925-release/fixture/index.html
workbench/qa/20260925-release/fixture/kimi-exit-code.txt
workbench/qa/20260925-release/fixture/kimi-generation-stderr.log
workbench/qa/20260925-release/fixture/kimi-prompt.txt
workbench/qa/20260925-release/fixture/kimi-raw-output.txt
workbench/qa/20260925-release/fixture/server.mjs
workbench/qa/20260925-release/governance-auth-final.log
workbench/qa/20260925-release/governance-final.log
workbench/qa/20260925-release/history-before.json
workbench/qa/20260925-release/import-preview.json
workbench/qa/20260925-release/import-result.json
workbench/qa/20260925-release/install-diagnostic.log
workbench/qa/20260925-release/login-final-check.json
workbench/qa/20260925-release/login-resume-check-2.json
workbench/qa/20260925-release/login-resume-check.json
workbench/qa/20260925-release/official-after-protection.json
workbench/qa/20260925-release/official-check-final.log
workbench/qa/20260925-release/package-build-20260926-01.log
workbench/qa/20260925-release/package-build-20260926-02.log
workbench/qa/20260925-release/package-candidate-20260926-01.zip
workbench/qa/20260925-release/package-candidate-20260926-02.zip
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
workbench/qa/20260925-release/package-negative-extra_file-20260926-02.zip
workbench/qa/20260925-release/package-negative-path_traversal-20260926-01.zip
workbench/qa/20260925-release/package-negative-path_traversal-20260926-02.zip
workbench/qa/20260925-release/package-negative-tampered_byte-20260926-01.zip
workbench/qa/20260925-release/package-negative-tampered_byte-20260926-02.zip
workbench/qa/20260925-release/package-npm-harness-20260926-01.log
workbench/qa/20260925-release/package-npm-root-20260926-01.log
workbench/qa/20260925-release/package-npm-workbench-20260926-01.log
workbench/qa/20260925-release/package-report-20260926-01.md
workbench/qa/20260925-release/package-report-20260926-02.md
workbench/qa/20260925-release/package-self-verify-20260926-01.log
workbench/qa/20260925-release/package-validation-20260926-01.log
workbench/qa/20260925-release/package-validation-20260926-01.py
workbench/qa/20260925-release/package-validation-20260926-02.log
workbench/qa/20260925-release/package-validation-20260926-02.py
workbench/qa/20260925-release/project.json
workbench/qa/20260925-release/regression-baseline.json
workbench/qa/20260925-release/regression-round1-preview.json
workbench/qa/20260925-release/regression-round1-result.json
workbench/qa/20260925-release/regression-round2-preview.json
workbench/qa/20260925-release/regression-round2-result.json
workbench/qa/20260925-release/service-after-protection.json
workbench/qa/20260925-release/service-before-model.json
workbench/qa/20260925-release/supervisor-integrity-auth.json
workbench/qa/20260925-release/supervisor-integrity-auth.py
workbench/qa/20260925-release/supervisor-integrity.json
workbench/qa/20260925-release/trial-16ae0e106017771362a2606c6139d94ac1ab742d.json
workbench/qa/20260925-release/trial-412754a6fefcff2cb3f6cb3caa6d26f18bed83d8.json
workbench/qa/20260925-release/trial-9151381b55f9745a00a873634799ba43e288fb87.json
workbench/qa/20260925-release/trial-a9d5774951a9252158a668d889d7e21145ad1b81.json
workbench/qa/20260925-release/trial-c17f41c319910f85941c4602db0eea0467c737db.json
workbench/qa/20260925-release/trial-d984ffd689a7227fad8a2c637ab8b5c69725264c.json
workbench/qa/20260925-release/ui/authenticated-replay-batch.png
workbench/qa/20260925-release/ui/authenticated-replay-batch.txt
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
workbench/qa/20260926-timing/CASE-02-rerun.json
workbench/qa/20260926-timing/CASE-03-rerun.json
workbench/qa/20260926-timing/REPORT.md
workbench/qa/20260926-timing/auth-after-rerun.json
workbench/qa/20260926-timing/case02-task.json
workbench/qa/20260926-timing/engineering-final.log
workbench/qa/20260926-timing/engineering-first.log
workbench/qa/20260926-timing/engineering-presentation-final.log
workbench/qa/20260926-timing/governance-check.log
workbench/qa/20260926-timing/governance-collector.log
workbench/qa/20260926-timing/governance-sync.log
workbench/qa/20260926-timing/governance-verification.log
workbench/qa/20260926-timing/history-before.json
workbench/qa/20260926-timing/independent-code-review.md
workbench/qa/20260926-timing/independent-semantic-review.md
workbench/qa/20260926-timing/official-final.log
workbench/qa/20260926-timing/original-rejection.json
workbench/qa/20260926-timing/package-build-20260926-03.log
workbench/qa/20260926-timing/package-build-20260926-04.log
workbench/qa/20260926-timing/package-candidate-20260926-03.zip
workbench/qa/20260926-timing/package-candidate-20260926-04.zip
workbench/qa/20260926-timing/package-extract-20260926-03/candidate-manifest.json
workbench/qa/20260926-timing/package-extract-20260926-03/harness-probe/package-lock.json
workbench/qa/20260926-timing/package-extract-20260926-03/harness-probe/package.json
workbench/qa/20260926-timing/package-extract-20260926-03/harness-probe/src/candidate-verifier.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/harness-probe/src/fixture-server.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/harness-probe/src/harness-runner.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/harness-probe/src/process-control.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/harness-probe/src/redact.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/harness-probe/src/setup-harness.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/harness-probe/src/verify-candidate.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/package-lock.json
workbench/qa/20260926-timing/package-extract-20260926-03/package.json
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/config/candidate.playwright.config.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/config/empty-trial.json
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/docs/release-candidate.md
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/examples/M3A_CASE_IMPORT_TEMPLATE_V1.xlsx
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/package-lock.json
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/package.json
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/scripts/check-install.ps1
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/scripts/package-candidate.py
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/scripts/start-workbench.local.json.example
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/scripts/start-workbench.ps1
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/scripts/unfamiliar-site-server.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/app.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/atomic-json.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/auth/catalog.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/auth/session-request-policy.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/auth/session.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/batches.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/adapter.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/assessments.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/browser-semantics.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/candidate-trials.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/caption-video.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/development-authorization.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/development-bundle.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/development-dom-read.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/development-evidence.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/development-feedback.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/development-fidelity.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/development-mcp.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/development-patch.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/development-policy.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/development-session.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/development-task.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/development-tool-guard.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/diagnostic.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/files.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/finalize-lifecycle.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/heldout-query.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/manager.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/project-case.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/report.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/revalidations.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/step-observer.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/step-replay.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/store.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/template.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/timing-evidence.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/timing-obligations.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/timing-observer.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/trial-environment.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/trial-timeline.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/build/user-workflow.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/cases/excel.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/cases/manager.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/cases/store.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/execution-records.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/executor.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/index.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/integrity.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/paths.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/register-approved.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/register-m2c-revalidation.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/register-m2c-runtime-revalidation.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/register-m2c-wait-fix-validation.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/register-reviewed-asset.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/registry.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/report-snapshots.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/report.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/revalidate-m2c-runtime-fix.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/reviewed-asset.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/script-operations.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/service-identity.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/service-shutdown.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/server/store.mjs
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/web-v2/api.js
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/web-v2/app.js
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/web-v2/execution-media.js
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/web-v2/history.js
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/web-v2/index.html
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/web-v2/product.css
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/web-v2/reports.js
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/web-v2/script-actions.js
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/web-v2/styles.css
workbench/qa/20260926-timing/package-extract-20260926-03/workbench/web-v2/workflow.js
workbench/qa/20260926-timing/package-extract-20260926-03/启动.cmd
workbench/qa/20260926-timing/package-extract-20260926-03/启动.ps1
workbench/qa/20260926-timing/package-extract-20260926-03/安装.cmd
workbench/qa/20260926-timing/package-extract-20260926-03/安装.ps1
workbench/qa/20260926-timing/package-extract-20260926-03/环境检查.cmd
workbench/qa/20260926-timing/package-extract-20260926-03/试用说明.md
workbench/qa/20260926-timing/package-extract-20260926-04/workbench/scripts/package-candidate.py
workbench/qa/20260926-timing/package-extract-20260926-04/workbench/web-v2/app.js
workbench/qa/20260926-timing/package-extract-20260926-04/workbench/web-v2/execution-media.js
workbench/qa/20260926-timing/package-negative-extra_file-20260926-03.zip
workbench/qa/20260926-timing/package-negative-missing_timing-20260926-03.zip
workbench/qa/20260926-timing/package-negative-path_traversal-20260926-03.zip
workbench/qa/20260926-timing/package-negative-timing_tamper-20260926-03.zip
workbench/qa/20260926-timing/package-node-check-20260926-03.log
workbench/qa/20260926-timing/package-node-check-20260926-04.log
workbench/qa/20260926-timing/package-report-20260926-03.md
workbench/qa/20260926-timing/package-report-20260926-04.md
workbench/qa/20260926-timing/package-self-verify-20260926-03.log
workbench/qa/20260926-timing/package-self-verify-20260926-04.log
workbench/qa/20260926-timing/package-validation-20260926-03.log
workbench/qa/20260926-timing/package-validation-20260926-03.py
workbench/qa/20260926-timing/package-validation-20260926-04.log
workbench/qa/20260926-timing/package-validation-20260926-04.py
workbench/qa/20260926-timing/presentation-fix-proposed.patch
workbench/qa/20260926-timing/record-delivery.py
workbench/qa/20260926-timing/reproduce-original.mjs
workbench/qa/20260926-timing/rerun-batch.json
workbench/qa/20260926-timing/service-identity-presentation.json
workbench/qa/20260926-timing/service-identity.json
workbench/qa/20260926-timing/supervisor-integrity.json
workbench/qa/20260926-timing/supervisor-integrity.py
workbench/qa/20260926-timing/timing-gates-first.log
workbench/qa/20260926-timing/ui/final-case02-dom.txt
workbench/qa/20260926-timing/ui/final-case02-full.png
workbench/qa/20260926-timing/ui/rerun-case02-dom.txt
workbench/qa/20260926-timing/ui/rerun-case02-full.png
workbench/qa/20260926-timing/ui/rerun-case02.png
workbench/scripts/check-install.ps1
workbench/scripts/package-candidate.py
workbench/scripts/run-unit-checks.mjs
workbench/scripts/test-manifest.json
workbench/scripts/verify-official-workbench.mjs
workbench/server/atomic-json.mjs
workbench/server/auth/session-request-policy.mjs
workbench/server/build/timing-evidence.mjs
workbench/server/build/timing-obligations.mjs
workbench/server/build/timing-observer.mjs
workbench/server/service-identity.mjs
workbench/server/service-shutdown.mjs
workbench/tests/auth-concurrency.test.mjs
workbench/tests/auth-session-request-policy.test.mjs
workbench/tests/development-auth-binding.test.mjs
workbench/tests/development-reliability.test.mjs
workbench/tests/execution-media-timing.test.mjs
workbench/tests/runtime-reliability.test.mjs
workbench/tests/supervisor-reliability.test.mjs
workbench/tests/timing-gates.test.mjs
workbench/tests/timing-obligations.test.mjs
workbench/tests/timing-observer.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-26T10:31:05+08:00
Command: node --test workbench/tests/execution-media-timing.test.mjs
Exit code: 0
Parsed test count: 4
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: only verified timing is presented as measured against original bounds
ok 1 - only verified timing is presented as measured against original bounds
  ---
  duration_ms: 0.9864
  type: 'test'
  ...
# Subtest: invalid identity cannot turn an untrusted 500 ms value into a measured result
ok 2 - invalid identity cannot turn an untrusted 500 ms value into a measured result
  ---
  duration_ms: 0.7968
  type: 'test'
  ...
# Subtest: out-of-range and missing intervals remain evidence failures without inventing values
ok 3 - out-of-range and missing intervals remain evidence failures without inventing values
  ---
  duration_ms: 0.2233
  type: 'test'
  ...
# Subtest: presentation fallback preserves an existing failure step and never rewrites a passing run
ok 4 - presentation fallback preserves an existing failure step and never rewrites a passing run
  ---
  duration_ms: 0.1067
  type: 'test'
  ...
1..4
# tests 4
# suites 0
# pass 4
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 109.0684
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

本轮呈现反例4项；完整106项及真实CASE02/03链路证据见workbench/qa/20260926-timing/REPORT.md，不自动批准或发布。
