/**
 * Implementation impl-test + verify-run — 2-step per phase + final VP execution
 *
 * End-to-end test of the implementation flow:
 * - P2.X: IMPL + TEST per spec phase (process gates via kata check-phase)
 * - P3: VERIFY — fresh agent executes full Verification Plan via kata verify-run
 *
 * Uses tanstack-start fixture with pre-seeded spec at
 * planning/specs/100-health-endpoint.md (2 phases, with VP section).
 *
 * fixtureSetup writes a project-specific verification-tools.md
 * (dev server config, API base URL) that the verify agent reads.
 *
 * Asserts:
 * 1. Standard workflow checks (mode, commit, clean tree, can-exit)
 * 2. Task discipline (pre-created tasks used, all completed, order respected)
 * 3. 2-step pattern expanded: p2.1:impl, p2.1:test per phase
 * 4. Test task instructions contain check-phase
 * 5. P3 verify task references verify-run
 */

import type { EvalScenario } from '../harness.js'
import {
  workflowPresets,
  taskDisciplinePresets,
  implTaskGenPresets,
  assertNativeTaskHasInstruction,
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

export const impl3StepVerifyScenario: EvalScenario = {
  id: 'impl-3step-verify',
  name: 'Implementation impl-test + verify-run with VP',
  templatePath: '.claude/workflows/templates/implementation.md',
  fixture: 'tanstack-start',
  fixtureSetup: [
    // Write project-specific verification-tools.md (overrides the generic template from batteries)
    `cat > .claude/workflows/verification-tools.md << 'EOF'\n${VERIFICATION_TOOLS_MD}\nEOF`,
  ],
  prompt:
    'Implement the health endpoint feature from the approved spec at planning/specs/100-health-endpoint.md. ' +
    'The issue number is 100. Follow all phases in the spec.',
  timeoutMs: 20 * 60 * 1000,
  checkpoints: [
    ...workflowPresets('implementation'),
    ...taskDisciplinePresets(),
    ...implTaskGenPresets(),
    // Test task should reference check-phase
    assertNativeTaskHasInstruction(/check-phase/),
    // P3 verify task should reference verify-run
    assertNativeTaskHasInstruction(/verify-run/),
  ],
}
