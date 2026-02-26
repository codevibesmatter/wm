---
initiative: verify-mode
type: project
issue_type: feature
status: approved
priority: high
github_issue: 28
created: 2026-02-26
updated: 2026-02-26
phases:
  - id: p1
    name: "Provider system: full-agent support"
    tasks:
      - "Extend AgentRunOptions with allowedTools, maxTurns, permissionMode, settingSources, canUseTool fields"
      - "Update claudeProvider.run() to pass extended options through to Agent SDK query()"
      - "Preserve backwards compat: current text-only callers continue working (defaults to allowedTools: [], maxTurns: 3)"
    test_cases:
      - id: "provider-text-only-compat"
        description: "claudeProvider.run() with no new options still works as text-only judge (maxTurns: 3, no tools)"
        type: "unit"
      - id: "provider-full-agent"
        description: "claudeProvider.run() with allowedTools, maxTurns, permissionMode creates full-agent session"
        type: "unit"
  - id: p2
    name: "VP step parser and verify mode"
    tasks:
      - "Add parseVpSteps() to task-factory.ts — splits ### VPn: sections into individual steps with id, title, instruction"
      - "Add verify mode to modes.yaml (issue_handling: none, stop_conditions: [tasks_complete, verification_plan_executed])"
      - "Create batteries/templates/verify.md — setup, container phase with vp-steps subphase pattern, evidence phase"
      - "Add vp-steps subphase pattern to batteries/subphase-patterns.yaml — dynamic task generation from VP steps"
      - "Add --phase flag to kata enter for verify mode"
    test_cases:
      - id: "parse-vp-steps-basic"
        description: "parseVpSteps extracts ### VP1:, ### VP2: etc into array of {id, title, steps}"
        type: "unit"
      - id: "parse-vp-steps-empty"
        description: "parseVpSteps returns empty array when no ### VPn: sections exist"
        type: "unit"
      - id: "verify-mode-task-gen"
        description: "kata enter verify --issue=N --phase=pX creates setup + per-VP-step + evidence tasks"
        type: "integration"
  - id: p3
    name: "kata verify-run command"
    tasks:
      - "Create src/commands/verify-run.ts — CLI command that spawns fresh Claude agent via claudeProvider"
      - "Agent prompt: enter verify mode, execute VP steps, handle repair loop, write evidence"
      - "Register verify-run in CLI dispatcher (src/index.ts)"
      - "Update VERIFY instruction in subphase-patterns.yaml to call kata verify-run"
    test_cases:
      - id: "verify-run-invocation"
        description: "kata verify-run --issue=N --phase=pX spawns agent and returns pass/fail"
        type: "integration"
      - id: "verify-run-evidence"
        description: "After verify-run completes, VP evidence JSON exists with valid structure"
        type: "integration"
  - id: p4
    name: "Implementation template: impl-test + final VERIFY"
    tasks:
      - "Add impl-test subphase pattern (2-step: impl, test) to batteries/subphase-patterns.yaml"
      - "Update implementation.md: P2 uses impl-test, new P3 VERIFY phase calls kata verify-run"
      - "Renumber P3 Close to P4"
      - "Update stop conditions: implementation mode still requires verification_plan_executed"
    test_cases:
      - id: "impl-test-pattern"
        description: "impl-test pattern has 2 steps: impl and test with correct dependency chain"
        type: "unit"
      - id: "impl-template-verify-phase"
        description: "implementation.md has P3 VERIFY phase that invokes kata verify-run"
        type: "unit"
  - id: p5
    name: "Eval scenario and integration"
    tasks:
      - "Update impl-3step-verify eval scenario to test new flow (impl-test per phase + final verify-run)"
      - "Update implTaskGenPresets for 2-step pattern"
      - "Add assertion for VP evidence written by verify-run agent"
    test_cases:
      - id: "eval-impl-verify"
        description: "Eval scenario passes: impl-test per phase, then verify-run writes VP evidence"
        type: "integration"
---

# Dedicated Verify Mode with SDK Agent Runner

> GitHub Issue: [#28](https://github.com/codevibesmatter/kata-wm/issues/28)

## Overview

The current VERIFY sub-phase is markdown instructions that the implementing agent (with implementation bias) follows poorly. VP steps test the whole feature — running them per-phase when the feature is half-built is pointless. This feature adds a dedicated `verify` mode entered by a fresh Claude Agent SDK process, with structured tasks parsed from VP steps, a repair-reverify loop for failures, and proper stop hook enforcement.

**Why now:** The impl-test-verify 3-step pattern (issue #26) proved VP execution works but is fragile — the implementing agent may skip steps, carry bias, or fail to spawn a fresh agent. A dedicated mode with a real SDK agent runner makes verification structural.

## Feature Behaviors

### B1: Provider system supports full-agent sessions

**Core:**
- **ID:** provider-full-agent
- **Trigger:** `claudeProvider.run(prompt, { allowedTools: [...], maxTurns: 50, permissionMode: 'bypassPermissions', settingSources: ['project'] })`
- **Expected:** Agent SDK `query()` is called with the extended options, producing a full-agent session with tool access, not just a text-only judge query
- **Verify:** Unit test confirms query options are forwarded; integration test confirms agent can use tools
- **Source:** `src/providers/types.ts`, `src/providers/claude.ts`

#### API Layer

Extended `AgentRunOptions`:
```typescript
export interface AgentRunOptions {
  cwd: string
  model?: string
  env?: Record<string, string>
  timeoutMs?: number
  // New fields:
  allowedTools?: string[]           // Default: [] (text-only)
  maxTurns?: number                 // Default: 3 (judge mode)
  permissionMode?: string           // Default: 'bypassPermissions'
  settingSources?: string[]         // Default: [] (no project settings)
  canUseTool?: (tool: unknown) => unknown  // PreToolUse hook
  abortController?: AbortController
  onMessage?: (message: unknown) => void   // Streaming callback for full-agent sessions
}
```

The `run()` method signature stays `Promise<string>` — for full-agent sessions the return value is the final agent text, and `onMessage` provides real-time streaming. This avoids a second method while preserving backwards compat.
```

---

### B2: VP steps parsed into individual tasks

**Core:**
- **ID:** vp-step-parsing
- **Trigger:** `kata enter verify --issue=N --phase=pX` when spec has `## Verification Plan` with `### VPn:` subsections
- **Expected:** Each `### VPn: {title}` section becomes a separate native task with the VP step's content as its instruction. Tasks are: Setup → VP1 → VP2 → ... → VPn → Evidence.
- **Verify:** Unit test with mock spec confirms correct task count and instruction content
- **Source:** `src/commands/enter/task-factory.ts`

#### API Layer

New function:
```typescript
interface VpStep {
  id: string        // "VP1", "VP2", etc.
  title: string     // Title after "### VPn: "
  instruction: string  // Full content of the VP step section
}

function parseVpSteps(vpContent: string): VpStep[]
```

---

### B3: Verify mode with structured task flow

**Core:**
- **ID:** verify-mode
- **Trigger:** `kata enter verify --issue=N --phase=pX`
- **Expected:** Session enters verify mode with tasks: P0 (Setup: read verification-tools.md, start dev server, confirm health), P1 (Execute: one task per VP step), P2 (Evidence: write VP evidence JSON, report results). Repair-reverify loop: if VP steps fail, agent diagnoses, fixes code, re-runs failed steps (max 3 cycles).
- **Verify:** Integration test confirms task generation, stop hook enforcement
- **Source:** `batteries/templates/verify.md`, `modes.yaml`

#### Data Layer

Verify mode in `modes.yaml`:
```yaml
verify:
  name: Verify
  description: "Execute Verification Plan steps against real running system"
  issue_handling: none
  stop_conditions:
    - tasks_complete
    - verification_plan_executed
  template: verify.md
  workflow_prefix: VF
```

---

### B4: kata verify-run spawns fresh agent

**Core:**
- **ID:** verify-run-command
- **Trigger:** `kata verify-run --issue=N --phase=pX` (called from implementation VERIFY phase)
- **Expected:** Spawns fresh Claude agent via `claudeProvider.run()` with full tool access. Agent enters verify mode, executes VP steps with repair loop, writes VP evidence, exits. Command returns 0 on success, 1 on failure. Streams agent output to stderr for visibility.
- **Verify:** Integration test confirms evidence file written with correct structure
- **Source:** `src/commands/verify-run.ts`

---

### B5: Implementation template uses impl-test + final VERIFY

**Core:**
- **ID:** impl-test-verify-flow
- **Trigger:** `kata enter implementation --issue=N` for a spec with VP section
- **Expected:** P2 phases use `impl-test` subphase pattern (2-step: implement, then process gates). New P3 VERIFY phase runs `kata verify-run --issue={N}` once all implementation phases complete. P4 (formerly P3) is Close.
- **Verify:** Implementation template frontmatter shows impl-test for P2, VERIFY phase for P3
- **Source:** `batteries/templates/implementation.md`, `batteries/subphase-patterns.yaml`

---

## Non-Goals

- Per-phase VP filtering (VP steps test the whole feature, run all steps every time)
- Multi-provider verify-run (only claudeProvider for now; codex/gemini can be added later)
- Custom repair strategies (the verify agent uses its own judgment to fix; no pluggable repair)
- Verify mode for non-implementation workflows (research, planning don't need VP)

## Open Questions

- [x] Should VP run per-phase or once at the end? → Once at the end
- [x] Who fixes failures — verify agent or hand back? → Verify agent fixes
- [x] How to spawn the agent — Task tool, CLI mode, or SDK process? → SDK process via claudeProvider
- [x] Per-VP-step tasks or single execution task? → Per-VP-step tasks

## Implementation Phases

See YAML frontmatter `phases:` above.

## Test Infrastructure

Node's built-in test runner (`node --test`) executes tests from `dist/testing/index.js`. Test files live alongside source with `.test.ts` suffixes. Run `npm run build && npm test` to execute. Eval scenarios use `@anthropic-ai/claude-agent-sdk` to drive agents.

### Build Verification
Use `npm run build` (tsup-based, produces ESM output). Then `npm run typecheck` for type checking without emit.

## Verification Plan

### VP1: Provider accepts full-agent options

Steps:
1. Read `src/providers/types.ts`
2. Confirm `AgentRunOptions` has `allowedTools`, `maxTurns`, `permissionMode`, `settingSources` fields
3. Read `src/providers/claude.ts`
4. Confirm `claudeProvider.run()` forwards these fields to `query()` options
5. Confirm default behavior unchanged: no allowedTools → `[]`, no maxTurns → `3`
Expected: Extended options are defined and forwarded, defaults preserve text-only behavior

### VP2: parseVpSteps extracts VP sections correctly

Steps:
1. `npm run build && npm test`
2. Check test output for `parseVpSteps` tests
3. Confirm tests exist for: basic extraction (### VP1:, ### VP2:), empty input, malformed VP
Expected: Parser correctly splits VP markdown into structured VpStep array

### VP3: Verify mode creates correct tasks

Steps:
1. Read `batteries/templates/verify.md`
2. Confirm frontmatter has phases: Setup, Execute (container), Evidence
3. Read `modes.yaml` — confirm verify mode exists with correct stop_conditions
4. Read `batteries/subphase-patterns.yaml` — confirm vp-steps pattern or verify template's container phase generates tasks from VP content
Expected: Verify mode template and config are correctly structured

### VP4: kata verify-run spawns agent and writes evidence

Steps:
1. Read `src/commands/verify-run.ts`
2. Confirm it uses `claudeProvider.run()` with full tool options (allowedTools, maxTurns, permissionMode)
3. Confirm the agent prompt includes `kata enter verify --issue=N --phase=pX`
4. Read `src/index.ts` — confirm verify-run is registered in CLI dispatcher
Expected: Command exists, uses provider system, spawns full-agent session

### VP5: Implementation template uses new flow

Steps:
1. Read `batteries/templates/implementation.md`
2. Confirm P2 has `subphase_pattern: impl-test` (2-step, not 3-step)
3. Confirm P3 is VERIFY phase that calls `kata verify-run --issue={N}`
4. Confirm P4 is Close (renumbered from old P3)
5. Read `batteries/subphase-patterns.yaml` — confirm `impl-test` pattern exists with 2 steps: impl, test
Expected: Implementation flow is impl-test per phase + final verify-run

## Implementation Hints

### Dependencies
No new dependencies. `@anthropic-ai/claude-agent-sdk` is already a devDependency.

### Key Imports
| Module | Import | Used For |
|--------|--------|----------|
| `src/providers/claude.ts` | `claudeProvider` | Spawning verify agent with full tool access |
| `src/providers/types.ts` | `AgentRunOptions` | Extended options interface |
| `src/commands/enter/task-factory.ts` | `extractVerificationPlan`, `parseVpSteps` | VP extraction and step parsing |
| `src/config/wm-config.ts` | `loadWmConfig` | Reading dev_server_command for verify setup |

### Code Patterns

**Extending AgentRunOptions (backwards compat):**
```typescript
// In claudeProvider.run():
const queryOpts: Record<string, unknown> = {
  maxTurns: options.maxTurns ?? 3,
  allowedTools: options.allowedTools ?? [],
  permissionMode: options.permissionMode ?? 'bypassPermissions',
  allowDangerouslySkipPermissions: true,
  cwd: options.cwd,
  env,
  ...(options.model ? { model: options.model } : {}),
  ...(options.settingSources ? { settingSources: options.settingSources } : {}),
  ...(options.canUseTool ? { canUseTool: options.canUseTool } : {}),
  ...(options.abortController ? { abortController: options.abortController } : {}),
}
```

**Parsing VP steps from markdown:**
```typescript
function parseVpSteps(vpContent: string): VpStep[] {
  const steps: VpStep[] = []
  const pattern = /^### (VP\d+):\s*(.+)$/gm
  let match: RegExpExecArray | null
  const positions: Array<{ id: string; title: string; start: number }> = []

  while ((match = pattern.exec(vpContent)) !== null) {
    positions.push({ id: match[1], title: match[2].trim(), start: match.index })
  }

  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].start
    const end = i + 1 < positions.length ? positions[i + 1].start : vpContent.length
    steps.push({
      id: positions[i].id,
      title: positions[i].title,
      instruction: vpContent.slice(start, end).trim(),
    })
  }
  return steps
}
```

**verify-run prompt construction:**
```typescript
const prompt = [
  `Enter verify mode for issue #${issue}, phase ${phase}:`,
  `kata enter verify --issue=${issue} --phase=${phase}`,
  '',
  'Then follow all tasks to completion.',
  'If any VP step fails: diagnose the failure, fix the code, re-run the failed step.',
  'Maximum 3 repair cycles before reporting failure.',
  'Write VP evidence when done.',
].join('\n')
```

### Gotchas
- `claudeProvider.run()` currently returns text only. For verify-run we need the full message stream (tool calls, results). The `onMessage` callback in extended options handles this.
- The verify agent needs `CLAUDE_PROJECT_DIR` set correctly (same as eval harness pattern).
- `settingSources: ['project']` is critical — it loads `.claude/settings.json` so hooks fire naturally in the verify session.
- The `impl-test` pattern replaces `impl-test-verify` as the default. Existing projects referencing `impl-test-verify` in their templates need backwards compat (keep the old pattern in subphase-patterns.yaml).

---
