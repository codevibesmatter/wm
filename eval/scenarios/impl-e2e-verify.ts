/**
 * E2E Implementation + Verify — full run with LLM judge evaluation
 *
 * End-to-end test of the complete implementation pipeline:
 * - P2.X: IMPL + TEST per spec phase (process gates via kata check-phase)
 * - P3: VERIFY — fresh agent executes full Verification Plan via kata verify-run
 * - LLM-as-judge evaluates the complete transcript
 *
 * Uses tanstack-start fixture with pre-seeded spec at
 * planning/specs/100-health-endpoint.md (2 phases, with VP section).
 *
 * Asserts:
 * 1. Standard workflow checks (mode, commit, clean tree, can-exit)
 * 2. Task discipline (pre-created tasks used, all completed, order respected)
 * 3. Verify subagent was invoked (verify-run ran)
 * 4. Verification evidence files written
 * 5. LLM judge passes (agent and system scores >= 70)
 */

import type { EvalScenario } from '../harness.js'
import {
  workflowPresets,
  taskDisciplinePresets,
  assertNativeTaskHasInstruction,
  assertVerifySubagentRan,
  assertVerifyEvidenceExists,
  assertJudgePasses,
} from '../assertions.js'

const VERIFICATION_TOOLS_MD = `# Verification Tools

## Dev Server
- **Start:** \`npm run dev\`
- **URL:** http://localhost:3000
- **Health:** http://localhost:3000 (check for 200)

## API
- **Base URL:** http://localhost:3000
- **Auth:** None required for health endpoint

## Key Endpoints
- GET /api/health — health check (status, timestamp, uptime_seconds)
`

export const implE2eVerifyScenario: EvalScenario = {
  id: 'impl-e2e-verify',
  name: 'E2E implementation + verify with LLM judge',
  templatePath: '.claude/workflows/templates/implementation.md',
  fixture: 'tanstack-start',
  fixtureSetup: [
    `cat > .claude/workflows/verification-tools.md << 'EOF'\n${VERIFICATION_TOOLS_MD}\nEOF`,
  ],
  prompt:
    'Implement the health endpoint feature from the approved spec at planning/specs/100-health-endpoint.md. ' +
    'The issue number is 100. Follow all phases in the spec.',
  timeoutMs: 25 * 60 * 1000,
  checkpoints: [
    // Deterministic: workflow basics
    ...workflowPresets('implementation'),
    // Deterministic: task discipline
    ...taskDisciplinePresets(),
    // Deterministic: verify subagent was invoked
    assertNativeTaskHasInstruction(/verify-run/),
    assertVerifySubagentRan(),
    // Deterministic: evidence files written
    assertVerifyEvidenceExists(100),
    // LLM judge: evaluate complete transcript
    assertJudgePasses({
      templatePath: '.claude/workflows/templates/implementation.md',
      minAgentScore: 70,
      minSystemScore: 70,
    }),
  ],
}
