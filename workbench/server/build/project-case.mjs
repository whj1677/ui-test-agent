import path from 'node:path';
import { createHash } from 'node:crypto';
import { PROJECT_CASE_STEP_TITLE_RULE_VERSION } from './report.mjs';

export const PROJECT_CASE_ENVIRONMENT_ID = 'synthetic-probe-normal-v1';
export const PROJECT_CASE_TEMPLATE_ID = 'project-case-input-v1';

export function bindProjectCaseVerification(content, environmentDefinition) {
  const binding = environmentDefinition.internal.binding;
  if (binding.kind === 'expected-literal') {
    const matches = content.steps.filter((step) => step.expected.includes(binding.expected_literal));
    if (matches.length !== 1) return null;
  } else if (binding.kind === 'exact-content') {
    if (content.external_id !== binding.case_id) return null;
  } else return null;
  return {
    ...structuredClone(environmentDefinition.internal.verification),
    step_title_rule_version: PROJECT_CASE_STEP_TITLE_RULE_VERSION,
    required_step_markers: content.steps.map((step) => `CASE_STEP_${step.order}`),
  };
}

function hashText(value) {
  return createHash('sha256').update(value).digest('hex').toUpperCase();
}

function jsonLiteral(value) { return JSON.stringify(value); }

export function projectCaseTaskDocument(snapshot) {
  const lines = [
    '# Frozen project case candidate task',
    '',
    `Source project: ${snapshot.source.project_id}`,
    `Source internal case: ${snapshot.source.case_id}`,
    `External case number: ${snapshot.source.external_id}`,
    `Case version: v${snapshot.source.case_version}`,
    `Content SHA-256: ${snapshot.source.content_sha256}`,
    `Environment reference: ${snapshot.environment_ref.environment_id}`,
    '',
    '## Case content (verbatim JSON strings)',
    '',
    `Title: ${jsonLiteral(snapshot.content.title)}`,
    `Module: ${jsonLiteral(snapshot.content.module)}`,
    `Preconditions: ${jsonLiteral(snapshot.content.preconditions)}`,
    `Test data: ${jsonLiteral(snapshot.content.test_data)}`,
    '',
    '## Ordered steps and expected results',
    '',
  ];
  for (const step of snapshot.content.steps) {
    const marker = snapshot.candidate_requirements.required_step_markers.find((item) => item.order === step.order)?.marker;
    lines.push(`### Step ${step.order}`, `Marker: ${marker}`, `Action: ${jsonLiteral(step.action)}`, `Expected: ${jsonLiteral(step.expected)}`, '');
  }
  lines.push(
    `Step title rule: ${snapshot.candidate_requirements.step_title_rule.version}`,
    `Allowed step titles: ${snapshot.candidate_requirements.step_title_rule.allowed_forms.join(' | ')}`,
    '',
    'Use every step and its paired expected result exactly as supplied.',
    'Do not summarize, merge, delete, reorder, infer, or rewrite business expectations.',
    '',
  );
  return lines.join('\n');
}

export function projectCaseAgentInstructionTemplate() {
  return [
    'Create one Playwright Test candidate from the frozen project case in this dedicated task workspace.',
    'Read only task.md and input/case-snapshot.json as task inputs.',
    'Use the Playwright MCP browser tools to open exactly {{ENTRY_URL}}.',
    'Perform every ordered action from task.md and preserve each paired expected result exactly.',
    'Wrap each ordered case step in test.step and place that step\'s action and checks inside it.',
    'The title must be either the bare CASE_STEP_<order> marker or start with that marker followed by one allowed separator and a non-empty description.',
    'Allowed separators are: one or more spaces or tabs; colon ":"; Chinese colon "："; or a spaced hyphen/dash " - ", " – ", " — ". Other fuzzy containment is invalid.',
    'Write exactly one Playwright Test candidate to {{CANDIDATE_PATH}}.',
    'The candidate must use process.env.PROBE_URL; do not hard-code or infer another URL.',
    'Do not derive expectations from page content, skip steps, swallow errors, remove assertions, or add unrelated actions.',
    'Do not inspect parent directories, other repository files, accounts, external sites, company systems, historical candidates, or counterexample implementations.',
    'Do not create other files. Return completion only after the candidate file is present.',
  ].join('\n');
}

export function renderProjectCaseAgentInstruction(template, { entryUrl, candidatePath }) {
  return template.replaceAll('{{ENTRY_URL}}', entryUrl).replaceAll('{{CANDIDATE_PATH}}', candidatePath);
}

export function assembleProjectCaseInput(options) {
  const { project, item, versionRecord, environmentTemplate, counterexampleActual, frozenAt } = options;
  let environmentDefinition = options.environmentDefinition;
  if (!environmentDefinition && environmentTemplate) {
    environmentDefinition = {
      environment_id: PROJECT_CASE_ENVIRONMENT_ID,
      public: environmentTemplate,
      internal: {
        binding: { kind: 'expected-literal', expected_literal: environmentTemplate.expected },
        verification: {
          schema: 'workbench/project-case-verification-contract-v2',
          expected_literal: environmentTemplate.expected,
          counterexample_actual: counterexampleActual,
          detection: { kind: 'literal-assertion-mismatch', expected: environmentTemplate.expected, actual: counterexampleActual },
        },
      },
    };
  }
  const publicTemplate = environmentDefinition.public;
  const source = {
    kind: 'project-case',
    project_id: project.project_id,
    project_name: project.name,
    case_id: item.case_id,
    external_id: versionRecord.content.external_id,
    case_version: versionRecord.version,
    content_sha256: versionRecord.content_sha256,
    root_source: structuredClone(item.root_source),
    lineage: structuredClone(item.lineage),
  };
  const environmentRef = {
    environment_id: environmentDefinition.environment_id,
    template_id: publicTemplate.template_id,
    template_version: publicTemplate.version,
    allowed_entry: structuredClone(publicTemplate.allowed_entry),
    candidate_contract: structuredClone(publicTemplate.candidate_contract),
  };
  const binding = environmentDefinition.internal.binding;
  if (binding.kind === 'exact-content' && versionRecord.content_sha256 !== binding.content_sha256) {
    throw new Error('CASE_BUILD_ENVIRONMENT_CASE_MISMATCH');
  }
  const verificationContract = bindProjectCaseVerification(versionRecord.content, environmentDefinition);
  const candidateRequirements = {
    schema: 'workbench/project-case-candidate-requirements-v2',
    required_step_markers: versionRecord.content.steps.map((step) => ({
      order: step.order,
      marker: `CASE_STEP_${step.order}`,
    })),
    step_title_rule: {
      version: PROJECT_CASE_STEP_TITLE_RULE_VERSION,
      allowed_forms: [
        'CASE_STEP_<order>',
        'CASE_STEP_<order> <description>',
        'CASE_STEP_<order>: <description>',
        'CASE_STEP_<order>：<description>',
        'CASE_STEP_<order> - <description>',
        'CASE_STEP_<order> – <description>',
        'CASE_STEP_<order> — <description>',
      ],
    },
    deliverable: {
      kind: 'playwright-test-candidate',
      relative_path: 'output/candidate.spec.mjs',
      test_count: publicTemplate.candidate_contract.test_count,
    },
  };
  const snapshot = {
    schema: 'workbench/project-case-build-input-v2',
    frozen_at: frozenAt,
    source,
    content: structuredClone(versionRecord.content),
    environment_ref: environmentRef,
    candidate_requirements: candidateRequirements,
  };
  const snapshotText = `${JSON.stringify(snapshot, null, 2)}\n`;
  const taskMarkdown = projectCaseTaskDocument(snapshot);
  const agentInstructionTemplate = projectCaseAgentInstructionTemplate();
  const files = [
    ['build-input-snapshot', 'task_input_snapshot', 'input/case-snapshot.json', 'application/json; charset=utf-8', snapshotText],
    ['build-input-task-md', 'task_document', 'task.md', 'text/markdown; charset=utf-8', taskMarkdown],
    ['build-input-agent-instruction', 'agent_instruction', 'agent-instruction.txt', 'text/plain; charset=utf-8', agentInstructionTemplate],
  ].map(([fileId, kind, relativePath, contentType, content]) => ({
    file_id: fileId,
    attempt_id: null,
    kind,
    web_visible: true,
    content_type: contentType,
    file_name: path.basename(relativePath),
    relative_path: relativePath,
    bytes: Buffer.byteLength(content),
    sha256: hashText(content),
    content,
  }));
  const snapshotSha256 = hashText(snapshotText);
  return {
    source,
    environment_ref: environmentRef,
    input_bundle: {
      schema: 'workbench/project-case-build-bundle-v2',
      snapshot,
      snapshot_sha256: snapshotSha256,
      task_markdown: taskMarkdown,
      task_markdown_sha256: hashText(taskMarkdown),
      agent_instruction_template: agentInstructionTemplate,
      agent_instruction_sha256: hashText(agentInstructionTemplate),
      verification_contract: verificationContract,
    },
    public_template: {
      template_id: PROJECT_CASE_TEMPLATE_ID,
      version: '1.0.0',
      title: `${versionRecord.content.external_id} · ${versionRecord.content.title}`,
      summary: `项目“${project.name}”用例 v${versionRecord.version} 的冻结建例输入`,
      candidate_contract: structuredClone(publicTemplate.candidate_contract),
      allowed_entry: structuredClone(publicTemplate.allowed_entry),
      input_sha256: snapshotSha256,
    },
    initial_files: files,
  };
}
