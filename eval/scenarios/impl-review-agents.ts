/**
 * Implementation Review Agents — review-agent runs during each REVIEW step
 *
 * Tests that the default impl-test-review pattern actually invokes review-agent
 * during each REVIEW sub-phase step (p2.1:review, p2.2:review). Extends the
 * impl-task-gen-default scenario with a transcript check for review-agent spawning.
 *
 * Uses tanstack-start fixture with pre-seeded spec at
 * planning/specs/100-health-endpoint.md (2 phases: health endpoint + uptime).
 *
 * Asserts:
 * 1. Standard workflow checks (mode, commit, clean tree, can-exit)
 * 2. Task discipline (pre-created tasks used, all completed, order respected)
 * 3. Subphase pattern expanded: p2.1:impl, p2.1:test, p2.1:review, p2.2:impl, p2.2:test, p2.2:review
 * 4. review-agent was actually spawned (transcript contains "review-agent")
 */

import type { EvalScenario } from '../harness.js'
import {
  workflowPresets,
  taskDisciplinePresets,
  implReviewAgentsPresets,
} from '../assertions.js'

export const implReviewAgentsScenario: EvalScenario = {
  id: 'impl-review-agents',
  name: 'Implementation: review-agent runs during REVIEW steps',
  templatePath: '.claude/workflows/templates/implementation.md',
  fixture: 'tanstack-start',
  prompt:
    'Implement the health endpoint feature from the approved spec at planning/specs/100-health-endpoint.md. ' +
    'The issue number is 100. Follow all phases in the spec.',
  timeoutMs: 20 * 60 * 1000,
  checkpoints: [
    ...workflowPresets('implementation'),
    ...taskDisciplinePresets(),
    ...implReviewAgentsPresets(),
  ],
}
