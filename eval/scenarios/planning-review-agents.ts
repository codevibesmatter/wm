/**
 * Planning Review Agents — review-agent + gemini + codex spawn simultaneously in P3
 *
 * Tests that the P3 spec review step spawns all three reviewers in a single parallel
 * message (run_in_background=true) rather than running them sequentially.
 *
 * Uses tanstack-start fixture with fixtureSetup to enable both external spec reviewers
 * alongside the built-in review-agent in kata.yaml.
 *
 * Asserts:
 * 1. Standard planning workflow checks (mode, commit, clean tree, can-exit, spec approved)
 * 2. review-agent spawned (transcript contains "review-agent")
 * 3. gemini spec review ran (transcript contains "--provider=gemini")
 * 4. codex spec review ran (transcript contains "--provider=codex")
 * 5. Reviewers were spawned with run_in_background (transcript contains "run_in_background")
 */

import type { EvalScenario } from '../harness.js'
import {
  planningPresets,
  assertTranscriptContains,
} from '../assertions.js'

export const planningReviewAgentsScenario: EvalScenario = {
  id: 'planning-review-agents',
  name: 'Planning: review-agent + gemini + codex spawn simultaneously in P3',
  fixture: 'tanstack-start',
  fixtureSetup: [
    // Add spec_review: true and spec_reviewers list to the reviews block in kata.yaml
    "sed -i '/^reviews:/a\\  spec_review: true' .claude/workflows/kata.yaml",
    "sed -i '/^  spec_review: true/a\\  spec_reviewers:' .claude/workflows/kata.yaml",
    "sed -i '/^  spec_reviewers:/a\\    - codex' .claude/workflows/kata.yaml",
    "sed -i '/^  spec_reviewers:/a\\    - gemini' .claude/workflows/kata.yaml",
  ],
  prompt:
    'Plan a dark mode toggle feature for this app. ' +
    'Research the codebase, write a spec, get it reviewed, and produce an approved spec committed to planning/specs/.',
  timeoutMs: 20 * 60 * 1000,
  checkpoints: [
    ...planningPresets(),
    assertTranscriptContains('review-agent', 'review-agent spawned in transcript'),
    assertTranscriptContains('--provider=gemini', 'gemini spec review ran'),
    assertTranscriptContains('--provider=codex', 'codex spec review ran'),
    assertTranscriptContains('run_in_background', 'reviewers spawned with run_in_background (parallel)'),
  ],
}
