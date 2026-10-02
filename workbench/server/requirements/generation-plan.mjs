// Partition output, never the evidence: both lanes retain the same complete
// source context and scope. No automatic retry or extra request is permitted.
export function standardGenerationInputs(design, input) {
  if (design.scope?.mode !== 'ALL_CURRENT') return [input];
  return ['UI', 'BACKEND'].map((type, index) => ({ ...input,
    generation_partition: { case_type: type, order: index + 1, total: 2 },
    system_prompt: `${input.system_prompt}\n本次全量生成按用例类型分为两个固定请求。你只负责 ${type} 分区；另一个数组必须为空。本分区仍须核对完整选定业务来源，不删规则、不引用另一个分区的候选作为数据前置、不把全量范围缩成少量示例。每条候选独立可读，固定数据按本条实际需求展开。精简重复解释，保留动作、可判定预期和真实引用；没有足够依据的规则明确列为问题，不能编造或默默遗漏。`,
  }));
}
