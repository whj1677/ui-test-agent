import fs from 'node:fs';
import path from 'node:path';

function reportedStep(step) {
  return { title: step.title, category: step.category, duration_ms: step.duration,
    started_at: step.startTime?.toISOString(), location: step.location ? { file: step.location.file, line: step.location.line, column: step.location.column } : null,
    status: step.error ? 'FAILED' : 'PASSED', steps: (step.steps || []).map(reportedStep) };
}

// Runner-owned evidence metadata. Model messages cannot turn an unfinished run into PASS.
export default class NativeExecutionReporter {
  constructor(options) {
    this.outputFile = options.outputFile;
    this.report = { schema: 'native-playwright-report-v1', case_id: options.caseId, started_at: new Date().toISOString(), finished_at: null, status: 'running', tests: [], errors: [] };
  }
  write() {
    const temporary = this.outputFile + '.tmp';
    fs.writeFileSync(temporary, JSON.stringify(this.report, null, 2));
    fs.renameSync(temporary, this.outputFile);
  }
  onBegin(config, suite) {
    this.root = path.dirname(this.outputFile);
    this.report.discovered_tests = suite.allTests().length;
    this.write();
  }
  onTestBegin(test) {
    process.stdout.write('NATIVE_EXECUTION_EVENT ' + JSON.stringify({ type: 'test_started', title: test.title, at: new Date().toISOString() }) + '\n');
  }
  onTestEnd(test, result) {
    this.report.tests.push({ id: test.id, title: test.title, title_path: test.titlePath(), status: result.status, expected_status: test.expectedStatus,
      duration_ms: result.duration, retry: result.retry, errors: (result.errors || []).map(error => error.message || error.value || String(error)),
      steps: (result.steps || []).map(reportedStep),
      attachments: result.attachments.filter(item => item.path).map(item => ({ name: item.name, content_type: item.contentType, path: path.relative(this.root, item.path).split(path.sep).join('/') })) });
    this.write();
    process.stdout.write('NATIVE_EXECUTION_EVENT ' + JSON.stringify({ type: 'test_finished', title: test.title, status: result.status }) + '\n');
  }
  onError(error) { this.report.errors.push(error.message || error.value || String(error)); this.write(); }
  onEnd(result) { this.report.status = result.status; this.report.finished_at = new Date().toISOString(); this.write(); }
}
