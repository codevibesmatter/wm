/**
 * Implementation Review Agents — review-agent + gemini + codex run during each REVIEW step
 *
 * Tests that the REVIEW sub-phase step runs all three reviewers sequentially:
 * 1. review-agent (built-in, always)
 * 2. kata review --provider=gemini
 * 3. kata review --provider=codex
 *
 * Uses tanstack-start fixture with fixtureSetup to enable both external providers
 * alongside the built-in review-agent in kata.yaml.
 *
 * Uses pre-seeded spec at planning/specs/100-health-endpoint.md (2 phases).
 *
 * Asserts:
 * 1. Standard workflow checks (mode, commit, clean tree, can-exit)
 * 2. Task discipline (pre-created tasks used, all completed, order respected)
 * 3. Subphase pattern expanded with REVIEW tasks per phase (p2.1:review, p2.2:review)
 * 4. review-agent spawned (transcript contains "review-agent")
 * 5. gemini review ran (transcript contains "--provider=gemini")
 * 6. codex review ran (transcript contains "--provider=codex")
 */

import type { EvalScenario } from '../harness.js'
import {
  workflowPresets,
  taskDisciplinePresets,
  implReviewAgentsPresets,
  assertTranscriptContains,
} from '../assertions.js'

export const implReviewAgentsScenario: EvalScenario = {
  id: 'impl-review-agents',
  name: 'Implementation: review-agent + gemini + codex run during REVIEW steps',
  templatePath: '.claude/workflows/templates/implementation.md',
  fixture: 'tanstack-start',
  fixtureSetup: [
    // Enable all three reviewers: review-agent (always), gemini, codex
    `python3 -c "
import sys
with open('.claude/workflows/kata.yaml', 'r') as f:
    content = f.read()
content = content.replace('code_review: false', 'code_review: true')
content = content.replace('code_reviewer: null', 'code_reviewers: [gemini, codex]')
with open('.claude/workflows/kata.yaml', 'w') as f:
    f.write(content)
print('kata.yaml patched: code_reviewers = [gemini, codex]')
"`,
  ],
  prompt:
    'Implement the health endpoint feature from the approved spec at planning/specs/100-health-endpoint.md. ' +
    'The issue number is 100. Follow all phases in the spec.',
  timeoutMs: 25 * 60 * 1000,
  checkpoints: [
    ...workflowPresets('implementation'),
    ...taskDisciplinePresets(),
    ...implReviewAgentsPresets(),
    assertTranscriptContains('--provider=gemini', 'gemini review ran'),
    assertTranscriptContains('--provider=codex', 'codex review ran'),
  ],
}
