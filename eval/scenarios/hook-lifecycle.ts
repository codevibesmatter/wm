/**
 * Hook Lifecycle — verify all kata hooks fire correctly.
 *
 * Tests the full hook lifecycle in a single scenario:
 * 1. SessionStart: fires and logs to hooks.log.jsonl
 * 2. UserPromptSubmit: fires and logs
 * 3. mode-gate (PreToolUse): agent attempts an edit without a mode → denied
 * 4. Agent enters task mode, does work (mode-gate allows after mode entry)
 * 5. stop-conditions (Stop): fires when agent finishes
 *
 * The prompt deliberately asks the agent to edit a file FIRST (before entering
 * a mode) to trigger the mode-gate denial.
 *
 * All assertions use hooks.log.jsonl — no transcript grep.
 */

import type { EvalScenario } from '../harness.js'
import {
  assertSessionInitialized,
  assertCurrentMode,
  assertCleanWorkingTree,
  assertCanExit,
  assertNewCommit,
  assertNoTaskCreateCalls,
  assertAllNativeTasksCompleted,
  assertHookFired,
  assertHookDecision,
  assertModeGateBlocked,
  stopHookPresets,
} from '../assertions.js'

export const hookLifecycleScenario: EvalScenario = {
  id: 'hook-lifecycle',
  name: 'Hook lifecycle: all hooks fire correctly',
  prompt: [
    'IMPORTANT: Follow these steps IN THIS EXACT ORDER:',
    '',
    'Step 1: Try to create a new file src/utils/greet.ts with content `export const greet = (name: string) => `Hello ${name}``.',
    '        Use the Write tool directly. Do NOT enter a mode first.',
    '        (This should be blocked by the mode-gate hook.)',
    '',
    'Step 2: After being blocked, enter task mode by running: kata enter task',
    '',
    'Step 3: Now create the greet.ts file and a simple test for it.',
    '',
    'Step 4: Commit your changes and push to the remote.',
    '',
    'Step 5: Mark all tasks as completed using TaskUpdate.',
  ].join('\n'),
  timeoutMs: 10 * 60 * 1000,
  checkpoints: [
    // Hook 1: SessionStart — fired and logged
    assertSessionInitialized(),
    assertHookFired('session-start'),

    // Hook 2: UserPromptSubmit — fired and logged
    assertHookFired('user-prompt'),

    // Hook 3: mode-gate — denied at least one edit, then allowed after mode entry
    assertModeGateBlocked(),
    assertHookDecision('mode-gate', 'allow'),

    // Agent eventually entered task mode and did work
    assertCurrentMode('task'),
    assertNewCommit(),
    assertNoTaskCreateCalls(),
    assertAllNativeTasksCompleted(),

    // Hook 4: stop-conditions — fired (allow or block)
    assertHookFired('stop-conditions'),

    // Final state
    assertCleanWorkingTree(),
    assertCanExit(),
  ],
}
