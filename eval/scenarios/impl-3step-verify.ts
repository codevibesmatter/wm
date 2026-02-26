/**
 * Implementation 3-Step Verify — impl-test-verify with Verification Plan
 *
 * End-to-end test of the 3-step implementation flow:
 * - IMPL: implement spec phase tasks
 * - TEST: run kata verify-phase (process gates)
 * - VERIFY: fresh agent executes Verification Plan against real services
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
 * 3. 3-step pattern expanded: p2.1:impl, p2.1:test, p2.1:verify per phase
 * 4. Verify task instructions contain VP content from spec
 * 5. Test task instructions contain verify-phase
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
  name: 'Implementation 3-step verify: impl-test-verify with VP',
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
    // VP content should be injected into verify task instructions
    assertNativeTaskHasInstruction(/Verification Plan/),
    // Test task should reference verify-phase
    assertNativeTaskHasInstruction(/verify-phase/),
  ],
}
