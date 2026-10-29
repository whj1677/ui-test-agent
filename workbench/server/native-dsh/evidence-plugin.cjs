const fs = require('node:fs');
const path = require('node:path');
const { instrumentNativeSource, parseInstrumentedSource } = require('./evidence-transform.cjs');
module.exports = function nativeEvidencePlugin() {
  return { visitor: { Program(program, state) {
    const configPath = process.env.NATIVE_EVIDENCE_CONFIG;
    if (!configPath) return;
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const relative = path.relative(config.snapshot, state.filename).split(path.sep).join('/');
    if (!config.files.some(file => file.path === relative) || !/\.(?:mjs|js|ts)$/i.test(relative)) return;
    // CommonJS compilation cannot safely import this ESM observer. Preserve the
    // original program and report an explicit gap instead of changing semantics.
    if (!relative.endsWith('.mjs')) {
      try { fs.appendFileSync(path.join(config.runDirectory, 'instrumentation-gaps.ndjson'), JSON.stringify({ file: relative, reason: 'NATIVE_EVIDENCE_REQUIRES_ESM_MJS' }) + '\n'); } catch {}
      return;
    }
    const { source } = instrumentNativeSource(state.file.code, relative, { entry: relative === config.entry, steps: config.caseContent.steps || [] });
    const transformed = parseInstrumentedSource(source, state.filename);
    program.node.body = transformed.program.body;
    program.node.directives = transformed.program.directives;
    // Rebuild bindings for the replacement nodes before Babel visits exported
    // classes. Keeping bindings from the old AST produces false duplicates.
    program.scope.crawl();
  } } };
};
