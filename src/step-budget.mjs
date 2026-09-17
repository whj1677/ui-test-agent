import { fail } from './common.mjs';

// One clock per original v3 step, including actions, observations and evidence.
// v2 keeps its existing post-action observation window and has no step deadline.
export class StepBudget {
  constructor(timeout, clock = Date.now) {
    this.clock = clock;
    this.deadline = timeout === undefined ? Infinity : clock() + timeout;
  }

  remaining(limit = 8000) {
    const left = this.deadline - this.clock();
    if (left <= 0) fail('STEP_DEADLINE_EXCEEDED');
    return Math.min(limit, left);
  }

  observationDeadline(lastActionAt, within) {
    return Math.min(this.deadline, lastActionAt + within);
  }
}
