export function evaluatePlaywrightReport(report) {
  if (!report || !Array.isArray(report.suites)) return { success: false, reason: 'REPORT_INVALID', testCount: 0 };
  let testCount = 0;
  let passed = 0;
  let skipped = 0;
  let failed = 0;
  const visit = (suite) => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        testCount += 1;
        const results = test.results ?? [];
        const last = results.at(-1);
        if (test.status === 'skipped' || last?.status === 'skipped') skipped += 1;
        else if (test.status === 'expected' && last?.status === 'passed') passed += 1;
        else failed += 1;
      }
    }
    for (const child of suite.suites ?? []) visit(child);
  };
  for (const suite of report.suites) visit(suite);
  const success = testCount > 0 && passed === testCount && skipped === 0 && failed === 0;
  return { success, reason: success ? 'COMPLETE_PASS' : 'TEST_RESULT_INCOMPLETE', testCount, passed, skipped, failed };
}
