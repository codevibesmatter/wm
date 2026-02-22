/**
 * Stop Hook Test — dedicated mode that exercises each stop condition.
 *
 * Uses the stop-hook-test mode which creates 4 trivial tasks with explicit
 * "STOP after this step" instructions. The stop hook should fire and block
 * between steps because:
 *   - After write: uncommitted changes + tasks pending
 *   - After commit: unpushed + tasks pending
 *   - After push: tasks still pending
 *   - After all tasks: allowed
 *
 * Requires --project flag pointing to a real, configured kata project
 * (needs a real git remote for push assertions).
 *
 * Asserts:
 * 1. Session initialized in stop-hook-test mode
 * 2. Stop hook blocked at least once
 * 3. Stop hook blocked for pending tasks
 * 4. Stop hook eventually allowed exit
 * 5. All native tasks completed
 * 6. No TaskCreate calls
 * 7. Clean working tree (revert phase cleans up)
 * 8. kata can-exit passes
 */

import type { EvalScenario } from '../harness.js'
import {
  assertSessionInitialized,
  assertCurrentMode,
  assertCleanWorkingTree,
  assertCanExit,
  assertNoTaskCreateCalls,
  assertAllNativeTasksCompleted,
  assertNativeTaskCount,
  assertTaskDependencyOrderRespected,
  stopHookPresets,
} from '../assertions.js'

export const stopHookTestScenario: EvalScenario = {
  id: 'stop-hook-test',
  name: 'Stop hook test: exercises each stop condition',
  prompt: [
    'Enter stop-hook-test mode by running: kata enter stop-hook-test',
    '',
    'Then follow the pre-created tasks exactly. Each task has specific instructions.',
    'Use TaskList to see tasks, TaskGet to read instructions, and TaskUpdate to complete them.',
    '',
    'CRITICAL: After completing each task, STOP and end your response.',
    'Do NOT continue to the next task in the same response.',
    'Wait for the system to unblock you before proceeding.',
  ].join('\n'),
  timeoutMs: 10 * 60 * 1000,
  checkpoints: [
    assertSessionInitialized(),
    assertCurrentMode('stop-hook-test'),
    assertNativeTaskCount(4),
    assertNoTaskCreateCalls(),
    assertAllNativeTasksCompleted(),
    assertTaskDependencyOrderRespected(),
    ...stopHookPresets(),
    assertCleanWorkingTree(),
    assertCanExit(),
  ],
}
