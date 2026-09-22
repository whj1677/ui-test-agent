export const DEMO_STORAGE_KEY = 'ui-d1:sandstone-clay:v2';

const querySteps = [
  { order: 1, action: '打开设备列表，保持默认筛选状态。', expected: '默认标题、计数器与初始记录完整显示。' },
  { order: 2, action: '选择“西站”和“检修”，暂不点击查询。', expected: '筛选控件值改变，表格仍保持查询前的完整状态。' },
  { order: 3, action: '点击查询并核对结果集。', expected: '结果数量、顺序及编号、站点、类型、功率均符合确认要求。' },
];

const simpleSteps = (index) => [
  { order: 1, action: `打开演示功能 ${index}。`, expected: '页面可用且默认状态符合用例要求。' },
  { order: 2, action: '执行主要操作并保存。', expected: '结果提示与保存后的数据显示正确。' },
];

function makeFeaturedCases(projectId) {
  return [
    {
      id: 'demo-case-query', projectId, externalId: 'DEMO-Q-001', title: '列表查询核对', module: '列表查询',
      contentStatus: '内容已确认', automationStatus: '待人工核对', recentStatus: '断言不符', recentTime: '2026-09-22 10:31',
      currentVersion: 1, sourceType: '平台用例包', sourceBatch: 'demo-json-seed', highlighted: false,
      preconditions: '使用无登录合成页面；新建独立浏览器上下文。', testData: '站点：西站\n任务类型：检修\n期望记录：3条',
      versions: [{ version: 1, contentHash: 'DEMO-Q-001-V1-A3F991', createdAt: '2026-09-22 09:12', steps: querySteps }],
    },
    {
      id: 'demo-case-reviewed', projectId, externalId: 'DEMO-S-001', title: '设备排序与分页', module: '列表排序',
      contentStatus: '内容已确认', automationStatus: '已有适用脚本', recentStatus: '通过', recentTime: '2026-09-22 10:42',
      currentVersion: 1, sourceType: 'Excel', sourceBatch: 'demo-excel-seed', highlighted: false,
      preconditions: '设备列表含6条固定演示数据。', testData: '排序：创建时间降序\n每页：3条',
      versions: [{ version: 1, contentHash: 'DEMO-S-001-V1-22B7CE', createdAt: '2026-09-22 08:45', steps: [
        { order: 1, action: '打开设备列表。', expected: '默认显示6条记录和第一页3条数据。' },
        { order: 2, action: '按创建时间降序排序。', expected: '第一页记录顺序与冻结数据一致。' },
        { order: 3, action: '切换到第二页。', expected: '显示余下3条且没有重复或缺失记录。' },
      ] }],
      scripts: [{ id: 'demo-asset-reviewed-v1', version: 1, caseVersion: 1, reviewScope: '仅适用于砂岩陶土原型的无登录合成场景', status: '已首审且适用', hash: '9E2A…74C1', lastRun: '2026-09-22 10:42' }],
    },
    {
      id: 'demo-case-versioned', projectId, externalId: 'DEMO-V-002', title: '告警确认流程', module: '告警处理',
      contentStatus: '内容已确认', automationStatus: '脚本版本不匹配', recentStatus: '未运行', recentTime: '未运行',
      currentVersion: 2, sourceType: 'Excel', sourceBatch: 'demo-excel-v2', highlighted: false,
      preconditions: '存在一条未确认告警。', testData: '告警级别：一般',
      versions: [
        { version: 1, contentHash: 'DEMO-V-002-V1-6B5F10', createdAt: '2026-09-20 14:10', steps: simpleSteps('V-002') },
        { version: 2, contentHash: 'DEMO-V-002-V2-A9921C', createdAt: '2026-09-22 09:05', steps: [...simpleSteps('V-002'), { order: 3, action: '刷新告警列表。', expected: '已确认告警不再出现在待处理列表。' }] },
      ],
      scripts: [{ id: 'demo-asset-old-v1', version: 1, caseVersion: 1, reviewScope: '仅适用于用例v1', status: '版本不匹配', hash: '63F1…0DA2', lastRun: '2026-09-20 15:21' }],
    },
    {
      id: 'demo-case-clarify', projectId, externalId: 'DEMO-C-004', title: '任务名称字段范围确认', module: '列表查询',
      contentStatus: '存在待澄清项', automationStatus: '验收范围待确认', recentStatus: '未运行', recentTime: '未运行',
      currentVersion: 1, sourceType: 'Excel', sourceBatch: 'demo-excel-review', highlighted: false,
      preconditions: '测试负责人确认验收字段范围。', testData: '字段：编号、名称、站点',
      versions: [{ version: 1, contentHash: 'DEMO-C-004-V1-E4A210', createdAt: '2026-09-22 09:18', steps: [{ order: 1, action: '查询目标记录。', expected: '' }] }],
    },
    {
      id: 'demo-case-generating', projectId, externalId: 'DEMO-G-005', title: '筛选条件组合', module: '列表查询',
      contentStatus: '内容已确认', automationStatus: '生成中', recentStatus: '未运行', recentTime: '未运行',
      currentVersion: 1, sourceType: '平台用例包', sourceBatch: 'demo-json-seed', highlighted: false,
      preconditions: '合成页面可访问。', testData: '站点：东站\n类型：巡检',
      versions: [{ version: 1, contentHash: 'DEMO-G-005-V1-C8B509', createdAt: '2026-09-22 09:25', steps: simpleSteps('G-005') }],
    },
    {
      id: 'demo-case-evidence', projectId, externalId: 'DEMO-E-006', title: '媒体证据缺失提示', module: '结果证据',
      contentStatus: '内容已确认', automationStatus: '待处理', recentStatus: '未完成', recentTime: '2026-09-21 18:12',
      currentVersion: 1, sourceType: 'Excel', sourceBatch: 'demo-excel-seed', highlighted: false,
      preconditions: '存在中断运行记录。', testData: '证据要求：截图、录像、Trace',
      versions: [{ version: 1, contentHash: 'DEMO-E-006-V1-149B30', createdAt: '2026-09-21 17:50', steps: simpleSteps('E-006') }],
    },
  ];
}

function makeBulkCases(projectId, count, prefix = 'DEMO-B') {
  return Array.from({ length: count }, (_, offset) => {
    const number = String(offset + 7).padStart(3, '0');
    return {
      id: `${projectId}-case-${number}`, projectId, externalId: `${prefix}-${number}`, title: `合成设备检查 ${number}`, module: offset % 3 === 0 ? '设备列表' : offset % 3 === 1 ? '告警处理' : '报表核对',
      contentStatus: offset % 17 === 0 ? '内容待确认' : '内容已确认', automationStatus: offset % 11 === 0 ? '待处理' : '未建例', recentStatus: offset % 13 === 0 ? '运行异常' : '未运行', recentTime: offset % 13 === 0 ? '2026-09-21 16:20' : '未运行',
      currentVersion: 1, sourceType: offset % 2 ? 'Excel' : '平台用例包', sourceBatch: offset % 2 ? 'demo-excel-bulk' : 'demo-json-bulk', highlighted: false,
      preconditions: '使用合成演示数据。', testData: `设备编号：EQ-${number}`,
      versions: [{ version: 1, contentHash: `${prefix}-${number}-V1-DEMO`, createdAt: '2026-09-20 10:00', steps: simpleSteps(number) }],
    };
  });
}

function makeProjectCases(projectId, count, prefix) {
  return makeBulkCases(projectId, count, prefix).map((item, index) => ({ ...item, externalId: index === 0 ? 'DEMO-Q-001' : item.externalId }));
}

export function createDemoState() {
  const inspection = 'demo-project-inspection';
  const projects = [
    { id: inspection, name: '设备巡检演示', description: '120条合成用例，用于验证高密度项目工作区', lastActivity: '2026-09-22 10:42' },
    { id: 'demo-project-alerts', name: '告警中心演示', description: '告警确认与版本关系演示', lastActivity: '2026-09-22 09:36' },
    { id: 'demo-project-imports', name: '导入格式验证', description: 'Excel与平台原生JSON包往返演示', lastActivity: '2026-09-21 16:20' },
    { id: 'demo-project-empty', name: '空项目示例', description: '用于核对空态和首次导入入口', lastActivity: '尚无活动' },
  ];
  const cases = [
    ...makeFeaturedCases(inspection),
    ...makeBulkCases(inspection, 114),
    ...makeProjectCases('demo-project-alerts', 8, 'DEMO-A'),
    ...makeProjectCases('demo-project-imports', 4, 'DEMO-I'),
  ];
  for (const testCase of cases) {
    for (const version of testCase.versions) {
      version.preconditions ??= testCase.preconditions;
      version.testData ??= testCase.testData;
    }
  }
  const builds = [
    { id: 'demo-build-scope', projectId: inspection, caseId: 'demo-case-query', caseVersion: 1, createdAt: '2026-09-22 09:40', status: '要求待确认', generation: '候选已生成', normal: '通过', counterexample: '断言不符', mapping: '已完成', businessReview: '检查范围待确认', humanReview: '范围待确认', registration: '未登记', candidate: '候选脚本 v1', candidateHash: 'CA38…6914', currentIssue: 'S03中的名称字段是否属于本轮必验范围，等待测试负责人确认。', attempts: 1 },
    { id: 'demo-build-generating', projectId: inspection, caseId: 'demo-case-generating', caseVersion: 1, createdAt: '2026-09-22 10:44', status: '生成中', generation: '正在生成候选', normal: '未运行', counterexample: '未运行', mapping: '未运行', businessReview: '未进行', humanReview: '未进行', registration: '未登记', candidate: '尚未生成', candidateHash: '未记录', currentIssue: '演示状态：没有真实模型任务正在运行。', attempts: 1 },
    { id: 'demo-build-error', projectId: inspection, caseId: 'demo-case-evidence', caseVersion: 1, createdAt: '2026-09-21 18:06', status: '生成异常', generation: '进程中断', normal: '未运行', counterexample: '未运行', mapping: '未运行', businessReview: '未进行', humanReview: '未进行', registration: '未登记', candidate: '文件不完整', candidateHash: '未记录', currentIssue: '进程退出且候选文件不完整；已保存生命周期记录，原因待分析。', attempts: 1 },
    { id: 'demo-build-reviewed', projectId: inspection, caseId: 'demo-case-reviewed', caseVersion: 1, createdAt: '2026-09-22 08:58', status: '待人工核对', generation: '候选已生成', normal: '通过', counterexample: '断言不符', mapping: '已完成', businessReview: '已完成', humanReview: '待核对', registration: '尚未登记', candidate: '候选脚本 v1', candidateHash: '9E2A…74C1', currentIssue: '技术验证已经完成，等待人工核对；不自动登记为批准资产。', attempts: 1 },
  ];
  for (const build of builds) {
    const sourceCase = cases.find((item) => item.projectId === build.projectId && item.id === build.caseId);
    const sourceVersion = sourceCase?.versions.find((item) => item.version === build.caseVersion);
    build.inputSnapshot = sourceCase && sourceVersion
      ? freezeCaseVersion(sourceCase, sourceVersion, 'demo-env-synthetic')
      : null;
  }
  const runs = [
    { id: 'demo-run-pass', projectId: inspection, caseId: 'demo-case-reviewed', caseVersion: 1, scriptVersion: 1, mode: '正常回归', createdAt: '2026-09-22 10:42', status: '通过', execution: '进程已结束', report: '报告完整', evidence: '证据齐全', duration: '18.4秒', screenshot: '/assets/result-normal.svg', video: '/assets/demo-normal.webm', trace: false, steps: [
      { order: 1, label: '打开设备列表', status: '通过', expected: '默认显示6条记录和第一页3条数据。', actual: '完整显示6条记录，当前为第1/2页。' },
      { order: 2, label: '按创建时间降序', status: '通过', expected: '第一页记录顺序与冻结数据一致。', actual: '顺序：EQ-106、EQ-104、EQ-102。' },
      { order: 3, label: '切换到第二页', status: '通过', expected: '余下3条无重复或缺失。', actual: '显示EQ-099、EQ-095、EQ-091，共3条。' },
    ] },
    { id: 'demo-run-counterexample', projectId: inspection, caseId: 'demo-case-reviewed', caseVersion: 1, scriptVersion: 1, mode: '受控反例验收', createdAt: '2026-09-22 10:31', status: '断言不符', execution: '进程已结束', report: '报告完整', evidence: '证据齐全', duration: '12.7秒', screenshot: '/assets/result-failed.svg', video: '/assets/demo-failed.webm', trace: false, steps: [
      { order: 1, label: '打开设备列表', status: '通过', expected: '默认显示6条记录和第一页3条数据。', actual: '完整显示6条记录，当前为第1/2页。' },
      { order: 2, label: '按创建时间降序', status: '断言不符', expected: '第一页顺序：EQ-106、EQ-104、EQ-102。', actual: '第一页顺序：EQ-102、EQ-104、EQ-106。', error: 'Expected EQ-106 first · Received EQ-102 first' },
      { order: 3, label: '切换到第二页', status: '未执行', expected: '余下3条无重复或缺失。', actual: '上一步失败后未执行。' },
    ] },
    { id: 'demo-run-interrupted', projectId: inspection, caseId: 'demo-case-evidence', caseVersion: 1, scriptVersion: '未登记', mode: '正常回归', createdAt: '2026-09-21 18:12', status: '运行异常', execution: '运行中断', report: '报告缺失', evidence: '证据缺失', duration: '6.1秒', screenshot: null, video: null, trace: false, steps: [{ order: 1, label: '打开媒体页面', status: '运行异常', expected: '页面加载成功。', actual: '浏览器进程意外退出，原因待分析。' }, { order: 2, label: '读取证据', status: '未执行', expected: '登记截图和录像。', actual: '前一步中断后未执行。' }] },
    { id: 'demo-run-evidence-missing', projectId: inspection, caseId: 'demo-case-query', caseVersion: 1, scriptVersion: '候选v1', mode: '技术试跑', createdAt: '2026-09-22 09:58', status: '未完成', execution: '进程已结束', report: '报告完整', evidence: '证据缺失', duration: '10.2秒', screenshot: null, video: null, trace: false, steps: querySteps.map((step) => ({ ...step, label: step.action, status: '通过', actual: '业务检查通过，但截图与录像未登记。' })) },
  ];
  return {
    schema: 'ui-d1-sandstone-demo-v1', demoClock: '2026-09-22 14:00', projects, cases, builds, runs,
    ui: { currentProjectId: null, projectSearch: '', caseFilters: {}, casePage: {}, selectedCaseIds: {}, highlightedCaseIds: {}, importDrafts: {}, selectedRunStep: {}, editingCase: null },
  };
}

export function currentCaseVersion(testCase) {
  return testCase.versions.find((item) => item.version === testCase.currentVersion);
}

export function freezeCaseVersion(testCase, version, environmentRef) {
  return structuredClone({
    projectId: testCase.projectId,
    caseId: testCase.id,
    externalId: testCase.externalId,
    title: testCase.title,
    module: testCase.module,
    caseVersion: version.version,
    contentHash: version.contentHash,
    sourceType: testCase.sourceType,
    sourceBatch: testCase.sourceBatch,
    preconditions: version.preconditions,
    testData: version.testData,
    steps: version.steps,
    environmentRef,
  });
}

export function appendCaseVersion(testCase, draft, createdAt) {
  const next = testCase.currentVersion + 1;
  const version = structuredClone({
    version: next,
    contentHash: `${testCase.externalId}-V${next}-DEMO`,
    createdAt,
    preconditions: draft.preconditions,
    testData: draft.testData,
    steps: draft.steps,
  });
  testCase.versions.push(version);
  testCase.currentVersion = next;
  testCase.preconditions = version.preconditions;
  testCase.testData = version.testData;
  return version;
}

const phase = (state, label) => ({ state, label });

export function generationPhase(value) {
  if (value === '未开始') return phase('pending', '待开始');
  if (value === '正在生成候选' || value === '生成中') return phase('active', '进行中');
  if (value === '候选已生成' || value === '已生成') return phase('done', '已完成');
  if (value === '生成异常' || value === '进程中断' || value === '文件不完整') return phase('error', '错误');
  return phase('unknown', '未知');
}

export function technicalValidationPhase(build) {
  const values = [build.normal, build.counterexample, build.mapping, build.businessReview];
  if (values.every((value) => value === '未运行' || value === '未进行')) return phase('pending', '待开始');
  if (values.some((value) => /失败|异常|缺失|中断/.test(value))) return phase('error', '错误');
  if (values.some((value) => !['通过', '断言不符', '已完成', '未运行', '未进行', '检查范围待确认'].includes(value))) return phase('unknown', '未知');
  if (build.normal === '通过' && build.counterexample === '断言不符' && build.mapping === '已完成' && build.businessReview === '已完成') return phase('done', '已完成');
  return phase('active', '进行中');
}

export function humanReviewPhase(value) {
  if (value === '已核对') return phase('done', '已完成');
  if (value === '待核对' || value === '范围待确认') return phase('active', '进行中');
  if (value === '未进行') return phase('pending', '待开始');
  return phase('unknown', '未知');
}

export function registrationPhase(value) {
  if (value === '已登记') return phase('done', '已完成');
  if (value === '未登记' || value === '尚未登记') return phase('pending', '待开始');
  return phase('unknown', '未知');
}

export function makeCasePackage(project, selectedCases) {
  return {
    schema: 'workbench/case-package-v1', demo_only: true, exported_at: '2026-09-22T14:00:00+08:00',
    source_project: { id: project.id, name: project.name },
    cases: selectedCases.map((item) => {
      const version = currentCaseVersion(item);
      return {
        source_identity: `${item.projectId}/${item.id}`, external_id: item.externalId, title: item.title, module: item.module,
        content_status: item.contentStatus, current_version: item.currentVersion, preconditions: version.preconditions, test_data: version.testData,
        steps: version.steps.map((step) => ({ order: step.order, action: step.action, expected: step.expected })),
      };
    }),
  };
}
