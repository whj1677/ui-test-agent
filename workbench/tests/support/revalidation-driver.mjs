export async function waitForTerminal(page, taskId, timeout = 660_000) {
  const terminals = ['WAITING_HUMAN_REVIEW', 'CANDIDATE_VALIDATION_FAILED', 'FAILED', 'CANCELLED', 'INTERRUPTED'];
  await page.waitForFunction(({ states, taskId: expectedTaskId }) => {
    const card = document.querySelector(`#build-history button[data-task-id="${CSS.escape(expectedTaskId)}"] strong`);
    const value = card?.textContent || '';
    return states.some((state) => value.includes(state));
  }, { states: terminals, taskId }, { timeout });
}

export async function waitForAuthorizedTask(buildStore, authorizationId, timeout = 10_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const task = (await buildStore.listTasks()).find((item) => item.authorization?.authorization_id === authorizationId);
    if (task) return task;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('M2C_REVALIDATION_TASK_NOT_CREATED');
}
