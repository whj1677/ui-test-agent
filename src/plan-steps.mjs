// These views preserve references and ordering. They never rewrite a frozen plan.
export function stepCheckpoints(step) {
  return step.checkpoints ?? [step];
}

export function stepActions(step) {
  return stepCheckpoints(step).flatMap((point) => point.actions);
}

export function stepAssertions(step) {
  return stepCheckpoints(step).flatMap((point) => point.assertions);
}

export function assertionIndex(step) {
  return stepCheckpoints(step).flatMap((point) =>
    point.assertions.map((assertion, index) => ({
      checkpoint_id: point.checkpoint_id ?? null,
      local_index: index,
      assertion,
    })),
  );
}
