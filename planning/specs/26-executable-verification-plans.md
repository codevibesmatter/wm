---
initiative: executable-verification-plans
type: project
issue_type: feature
status: approved
priority: high
github_issue: 26
created: 2026-02-25
updated: 2026-02-25
phases:
  - id: p1
    name: "Planning template VP section"
    tasks:
      - "Add verification-strategy interview step to planning template"
      - "Add Verification Plan section to spec-writer prompt"
      - "Update spec template: rename ## Verification Strategy to ## Test Infrastructure, add ## Verification Plan stub"
    test_cases:
      - id: "planning-interview-vp-question"
        description: "Planning template interview includes a verification-strategy AskUserQuestion step"
        type: "unit"
      - id: "spec-writer-vp-section"
        description: "Spec-writer agent prompt instructs agent to produce a ## Verification Plan section with executable steps"
        type: "unit"
      - id: "spec-template-vp-stub"
        description: "planning/spec-templates/feature.md contains a ## Verification Plan section with example VP structure"
        type: "unit"
  - id: p2
    name: "Subphase pattern and task-factory VP extraction"
    tasks:
      - "Add impl-test-verify subphase pattern to batteries/subphase-patterns.yaml"
      - "Add {verification_plan} placeholder support to task-factory.ts"
      - "Extract ## Verification Plan section from spec markdown in buildSpecTasks"
    test_cases:
      - id: "subphase-pattern-3-step"
        description: "impl-test-verify pattern has 3 steps: impl, test, verify — with correct dependency chain"
        type: "unit"
      - id: "vp-extraction-present"
        description: "When spec has ## Verification Plan, content is injected into {verification_plan} placeholder in verify task instruction"
        type: "integration"
      - id: "vp-extraction-absent"
        description: "When spec has no ## Verification Plan, {verification_plan} placeholder is replaced with fallback text"
        type: "integration"
  - id: p3
    name: "Implementation template and wm.yaml schema"
    tasks:
      - "Update implementation.md subphase_pattern reference to impl-test-verify"
      - "Add VERIFY protocol section to implementation template body"
      - "Add dev_server_command and dev_server_health fields to WmConfig interface and merge logic"
    test_cases:
      - id: "impl-template-pattern-ref"
        description: "implementation.md frontmatter references impl-test-verify subphase pattern"
        type: "unit"
      - id: "wm-config-dev-server"
        description: "loadWmConfig correctly reads and merges dev_server_command and dev_server_health fields"
        type: "unit"
  - id: p4
    name: "Stop conditions and verify-phase adaptation"
    tasks:
      - "Add verification_plan_executed stop condition type"
      - "Implement VP evidence check in can-exit.ts"
      - "Write VP evidence file format from verification agent results"
    test_cases:
      - id: "vp-evidence-check"
        description: "can-exit blocks when verification_plan_executed is in stop_conditions and no VP evidence exists"
        type: "integration"
      - id: "vp-evidence-pass"
        description: "can-exit passes when VP evidence file exists with all steps passed and fresh timestamp"
        type: "integration"
---

# Executable Verification Plans in Batteries Templates

> GitHub Issue: [#26](https://github.com/codevibesmatter/kata-wm/issues/26)

## Overview

Agent-written unit tests with mocks produce passing tests but non-functional code. The baseplane-dev1 #1533 implementation produced 127 passing tests but 5 integration bugs at component boundaries -- all because unit tests with mocks are self-validating. The current batteries templates leave verification strategy to the implementing agent, which always chooses unit tests with mocks. This feature adds executable Verification Plans to the spec (defined during planning) and a fresh verification agent step to the implementation workflow that runs those plans against the real running system.

## Feature Behaviors

### B1: Planning interview includes verification strategy step

**Core:**
- **ID:** planning-interview-vp-step
- **Trigger:** User enters planning mode and reaches the P1 Interview phase testing step
- **Expected:** The testing interview step includes an additional AskUserQuestion round that asks how the feature should be verified against a real running system -- covering dev server setup, API endpoints to hit, browser pages to navigate, and expected observable responses. The answers feed into the spec's Verification Plan section.
- **Verify:** Read `batteries/templates/planning.md` interview testing step (id: `testing`) and confirm it contains an AskUserQuestion with options for verification approach (API calls, browser navigation, CLI commands, or "not applicable")
- **Source:** `batteries/templates/planning.md:187-226`

#### UI Layer
N/A -- CLI template content only.

#### API Layer
N/A -- no runtime API changes.

#### Data Layer
N/A -- template file change only.

---

### B2: Spec-writer prompt produces Verification Plan section

**Core:**
- **ID:** spec-writer-vp-output
- **Trigger:** Planning mode reaches P2 Spec Writing phase and spawns the spec-writer agent
- **Expected:** The spec-writer agent prompt instructs the agent to produce a `## Verification Plan` section containing subsections (`### VP1:`, `### VP2:`, etc.) with numbered executable steps. Each VP step specifies: (1) the command or navigation to execute, (2) the expected response or observation, (3) the timeout or wait condition. Steps are freeform markdown -- curl commands for API features, browser navigation for UI features, CLI invocations for tool features. The prompt explicitly forbids abstract descriptions like "verify that it works" and requires concrete commands.
- **Verify:** Read `batteries/templates/planning.md` spec-writer prompt (id: `spawn-spec-writer`) and confirm it includes `## Verification Plan` in the required output structure, with instructions for executable steps and an example format
- **Source:** `batteries/templates/planning.md:346-403`

#### UI Layer
N/A

#### API Layer
N/A

#### Data Layer
N/A

---

### B3: Spec template includes Verification Plan stub

**Core:**
- **ID:** spec-template-vp-stub
- **Trigger:** User creates a new spec from the feature template (`planning/spec-templates/feature.md`)
- **Expected:** The spec template's existing `## Verification Strategy` section is renamed to `## Test Infrastructure` (since the VP section now handles verification). A new `## Verification Plan` section is added after `## Test Infrastructure` and before `## Implementation Hints`. The VP stub contains placeholder structure showing the expected format: `### VP1: {Scenario Name}` with numbered `Steps:` and expected outcomes.
- **Verify:** Read `planning/spec-templates/feature.md` and confirm `## Verification Plan` section exists with example structure
- **Source:** `planning/spec-templates/feature.md:98-105`

#### UI Layer
N/A

#### API Layer
N/A

#### Data Layer
N/A

---

### B4: Three-step subphase pattern replaces two-step

**Core:**
- **ID:** impl-test-verify-pattern
- **Trigger:** `kata enter implementation` creates tasks from spec phases using the subphase pattern
- **Expected:** The `impl-test-verify` subphase pattern defines 3 steps: (1) `impl` -- implement the phase tasks, (2) `test` -- run verify-phase process gates (build, typecheck, tests, assertion delta, micro-review), (3) `verify` -- execute the spec's Verification Plan against the real running system. The `test` step depends on `impl`. The `verify` step depends on `test`. The `verify` step has an `instruction` template containing the `{verification_plan}` placeholder. The old `impl-verify` pattern remains in the file for backwards compatibility but is no longer the default.
- **Verify:** Parse `batteries/subphase-patterns.yaml`, confirm `impl-test-verify` has 3 steps with correct `id_suffix` values (`impl`, `test`, `verify`), confirm dependency chain via `depends_on_previous`, confirm `verify` step instruction contains `{verification_plan}`
- **Source:** `batteries/subphase-patterns.yaml:1-23`

#### UI Layer
N/A

#### API Layer
N/A

#### Data Layer
No schema changes. The existing `subphasePatternSchema` in `src/validation/schemas.ts` already supports `instruction: z.string().optional()` -- no Zod changes needed.

---

### B5: Task factory extracts VP from spec and injects into verify task

**Core:**
- **ID:** task-factory-vp-extraction
- **Trigger:** `buildSpecTasks()` processes a spec phase and creates the `verify` subphase task whose instruction template contains `{verification_plan}`
- **Expected:** The function reads the spec markdown file, extracts the content under the `## Verification Plan` heading (from `## Verification Plan` to the next `##` heading), and replaces `{verification_plan}` in the instruction template with the extracted content. If the spec has no `## Verification Plan` section, the placeholder is replaced with: `"No verification plan found in spec. Run process verification only: kata verify-phase {phase_label} --issue={issue}"`.
- **Verify:** Write a test with a mock spec containing a `## Verification Plan` section. Call `buildSpecTasks()` with a subphase pattern that has `{verification_plan}` in the instruction. Confirm the resulting task's `instruction` field contains the extracted VP content. Repeat with a spec missing the VP section and confirm the fallback text appears.
- **Source:** `src/commands/enter/task-factory.ts:33-125`

#### UI Layer
N/A

#### API Layer
N/A

#### Data Layer
N/A -- `buildSpecTasks` signature gains an optional `specContent?: string` parameter (the raw markdown content of the spec file). Callers that don't pass it get the fallback behavior.

---

### B6: Implementation template references new pattern and documents VERIFY protocol

**Core:**
- **ID:** impl-template-verify-protocol
- **Trigger:** Agent reads the implementation template after entering implementation mode
- **Expected:** The implementation template frontmatter `subphase_pattern` field references `impl-test-verify` instead of `impl-verify`. The template body contains a new `## VERIFY Protocol` section (in addition to the existing VERIFY section which becomes the `## TEST Protocol`) that describes the verification agent's role: (1) start the dev server using `dev_server_command` from wm.yaml, (2) wait for `dev_server_health` to respond, (3) execute each VP step literally, (4) report pass/fail with actual vs expected for each step, (5) write evidence file. The existing 4-step verify protocol (build, tests, spec-checklist, hints) is renamed to `## TEST Protocol`.
- **Verify:** Read `batteries/templates/implementation.md`. Confirm frontmatter `subphase_pattern: impl-test-verify`. Confirm body has both `## TEST Protocol` and `## VERIFY Protocol` sections. Confirm VERIFY Protocol references dev server startup and VP execution.
- **Source:** `batteries/templates/implementation.md:82,203-256`

#### UI Layer
N/A

#### API Layer
N/A

#### Data Layer
N/A

---

### B7: WmConfig gains dev server fields

**Core:**
- **ID:** wm-config-dev-server
- **Trigger:** Project configures `dev_server_command` and `dev_server_health` in `wm.yaml`
- **Expected:** The `WmConfig.project` interface adds two optional string fields: `dev_server_command` (shell command to start the dev server, e.g., `"npm run dev"`) and `dev_server_health` (URL to poll for readiness, e.g., `"http://localhost:3000/health"`). Both are `string | null | undefined` (null = explicitly disabled, undefined = not configured). The `mergeWmConfig` function handles these as part of the existing `project` object merge (project-level layer overwrites, no special merge logic needed since `project` is already a nested object that gets replaced by the project layer).
- **Verify:** Create a wm.yaml with `project.dev_server_command: "npm run dev"` and `project.dev_server_health: "http://localhost:3000"`. Call `loadWmConfig()`. Confirm the returned config has both fields.
- **Source:** `src/config/wm-config.ts:8-17`

#### UI Layer
N/A

#### API Layer
N/A

#### Data Layer
No migration needed. `WmConfig` is a TypeScript interface, not a persisted schema. Existing wm.yaml files without these fields work fine (both default to `undefined`).

---

### B8: New stop condition for VP evidence

**Core:**
- **ID:** vp-evidence-stop-condition
- **Trigger:** Agent tries to exit implementation mode (stop hook calls `kata can-exit`)
- **Expected:** A new stop condition `verification_plan_executed` is added to `STOP_CONDITION_TYPES` in `src/state/schema.ts`. When this condition is in the mode's `stop_conditions` array and an issue number is linked, `can-exit` checks for VP evidence files at `.kata/verification-evidence/vp-{phaseId}-{issueNumber}.json` (or the `.claude/` equivalent). Each evidence file must have `allStepsPassed: true` and a `timestamp` newer than the latest commit. If any phase is missing VP evidence or any VP step failed, exit is blocked with a message indicating which phase needs VP execution.
- **Verify:** Set up a session with `verification_plan_executed` in stop conditions. Run `can-exit` without VP evidence files -- confirm exit is blocked. Create VP evidence files with `allStepsPassed: true` and a future timestamp -- confirm exit is allowed.
- **Source:** `src/commands/can-exit.ts:100-219`, `src/state/schema.ts:8-16`

#### UI Layer
N/A

#### API Layer
N/A

#### Data Layer
New evidence file format at `.kata/verification-evidence/vp-{phaseId}-{issueNumber}.json`:
```json
{
  "phaseId": "p1",
  "issueNumber": 26,
  "timestamp": "2026-02-25T12:00:00.000Z",
  "steps": [
    { "id": "VP1", "description": "Health endpoint returns 200", "passed": true, "actual": "200 OK" },
    { "id": "VP2", "description": "List endpoint returns items", "passed": true, "actual": "[{...}]" }
  ],
  "allStepsPassed": true
}
```

---

## Non-Goals

Explicitly out of scope for this feature:

- **Changing existing stop condition hooks** (task-deps, task-evidence enforcement changes) -- the existing advisory/blocking behavior stays as-is
- **Blocking mode switching** (freeform escape hatch remains available) -- R6 from research is a separate feature
- **Command trace verification** (R7 from research) -- verifying that specific commands were executed is a separate feature
- **Making task-evidence blocking** (R3 from research) -- separate feature, independent of VP
- **Changing strict mode default** (R4 from research) -- separate feature
- **Error handling fail-closed** (R5 from research) -- separate feature
- **Changing the spec template file format** -- the VP is freeform markdown in the spec body, not new YAML frontmatter fields
- **Automated dev server lifecycle management** -- the VERIFY step instructions tell the agent to start the server; kata-wm does not manage server processes
- **Browser automation framework integration** -- VP steps that involve browser navigation are described as instructions for the agent, not as Playwright/Cypress scripts

## Open Questions

None -- all questions resolved during research and requirements gathering.

## Implementation Phases

See YAML frontmatter `phases:` above. Each phase should be 1-4 hours of focused work.

## Verification Plan

### VP1: Planning template produces specs with VP sections

Steps:
1. Read `batteries/templates/planning.md` in full
2. Confirm the interview testing step (id: `testing`) contains an AskUserQuestion with verification approach options
3. Confirm the spec-writer prompt (id: `spawn-spec-writer`) includes `## Verification Plan` in its required output structure
4. Confirm the prompt includes an example format showing `### VP1:` with numbered steps, commands, and expected outcomes
5. Expected: All 4 confirmations pass

### VP2: Subphase pattern creates correct task chain

Steps:
1. Run `npm run build`
2. Run `npm test` -- all existing tests pass (no regressions)
3. Read `batteries/subphase-patterns.yaml`
4. Confirm `impl-test-verify` pattern exists with exactly 3 steps
5. Confirm step id_suffixes are `impl`, `test`, `verify` in that order
6. Confirm `test` has `depends_on_previous: true`
7. Confirm `verify` has `depends_on_previous: true`
8. Confirm `verify` step instruction contains `{verification_plan}`
9. Expected: Pattern structure matches spec exactly

### VP3: Task factory injects VP content into verify tasks

Steps:
1. Run `npm run build && npm test`
2. Inspect test output for `task-factory` or `buildSpecTasks` tests
3. Confirm there is a test that creates tasks from a spec with a `## Verification Plan` section and verifies the verify task instruction contains the VP content
4. Confirm there is a test for the fallback case (no VP section in spec)
5. Expected: Both test cases exist and pass

### VP4: Implementation template and wm.yaml changes are correct

Steps:
1. Read `batteries/templates/implementation.md`
2. Confirm frontmatter has `subphase_pattern: impl-test-verify`
3. Confirm body has `## TEST Protocol` section (renamed from old VERIFY)
4. Confirm body has `## VERIFY Protocol` section with dev server and VP execution instructions
5. Run `npm run build && npm test` -- confirm no type errors from WmConfig changes
6. Expected: Template structure and types are correct

### VP5: Stop condition blocks exit without VP evidence

Steps:
1. Run `npm run build && npm test`
2. Confirm `STOP_CONDITION_TYPES` in `src/state/schema.ts` includes `verification_plan_executed`
3. Confirm `can-exit.ts` has a handler for the `verification_plan_executed` condition
4. Inspect test output for can-exit tests covering VP evidence checks
5. Expected: New stop condition is wired end-to-end

## Verification Strategy

### Test Infrastructure
Node's built-in test runner (`node --test`) executes tests from `dist/testing/index.js`. Test files live alongside source with `.test.ts` suffixes. Run `npm run build && npm test` to execute.

### Build Verification
Use `npm run build` (tsup-based, produces ESM output). Then `npm run typecheck` for type checking without emit.

## Implementation Hints

### Dependencies
No new dependencies. All changes use existing `js-yaml`, `zod`, `node:fs`, and `node:path`.

### Key Imports
| Module | Import | Used For |
|--------|--------|----------|
| `src/commands/enter/task-factory.ts` | `buildSpecTasks` | VP extraction and injection into verify task instructions |
| `src/commands/enter/guidance.ts` | `applyPlaceholders` | Template placeholder replacement (already handles `{task_summary}`, `{phase_name}`, `{phase_label}`) |
| `src/config/wm-config.ts` | `WmConfig`, `loadWmConfig` | Reading dev_server_command and dev_server_health |
| `src/state/schema.ts` | `STOP_CONDITION_TYPES`, `StopCondition` | Adding `verification_plan_executed` |
| `src/commands/can-exit.ts` | `validateCanExit` | New VP evidence check |

### Code Patterns

**Extracting a markdown section by heading:**
```typescript
// Pattern from verify-phase.ts getSpecSection() — reuse for VP extraction
function extractVerificationPlan(specContent: string): string | null {
  const vpHeading = /^## Verification Plan\s*$/im
  const match = vpHeading.exec(specContent)
  if (!match || match.index === undefined) return null

  const start = match.index + match[0].length
  const rest = specContent.slice(start)
  const nextHeading = /^## /m.exec(rest)
  const end = nextHeading ? start + nextHeading.index : specContent.length

  return specContent.slice(match.index, end).trim()
}
```

**Adding a new placeholder to buildSpecTasks:**
```typescript
// In the instruction-building section of buildSpecTasks
if (patternItem.instruction) {
  instruction = applyPlaceholders(patternItem.instruction, {
    taskSummary, phaseName, phaseLabel,
  })
    .replace(/{issue}/g, String(issueNum))
    .replace(/{verification_plan}/g, vpContent ?? VP_FALLBACK_TEXT)
}
```

**VP evidence file check (same pattern as checkTestsPass):**
```typescript
function checkVpEvidence(issueNumber: number): { passed: boolean; reason?: string } {
  const projectRoot = findProjectDir()
  const evidenceDir = getVerificationDir(projectRoot)
  const vpFiles = readdirSync(evidenceDir)
    .filter(f => f.startsWith('vp-') && f.endsWith(`-${issueNumber}.json`))
  // Check each file has allStepsPassed: true and fresh timestamp
}
```

**WmConfig interface extension:**
```typescript
project?: {
  // ... existing fields ...
  dev_server_command?: string | null   // e.g., "npm run dev"
  dev_server_health?: string | null    // e.g., "http://localhost:3000/health"
}
```

### Gotchas
- The `applyPlaceholders` function in `guidance.ts` only handles `{task_summary}`, `{phase_name}`, `{phase_label}` -- the `{issue}` and `{verification_plan}` replacements happen as separate `.replace()` calls in `buildSpecTasks`. Keep this pattern rather than adding all placeholders to `applyPlaceholders`.
- The `impl-verify` pattern must remain in `subphase-patterns.yaml` for backwards compatibility with existing project templates that reference it by name. Only the implementation batteries template changes its reference.
- VP content extraction must handle the case where the spec file path is not available to `buildSpecTasks` (the function currently has no file I/O). The spec content should be passed in as an optional parameter by the caller.
- The `WmConfig.project` merge already works by full replacement of the project object from the project layer. Adding `dev_server_command` and `dev_server_health` requires no merge logic changes.
- Evidence file naming uses `vp-` prefix (not `phase-`) to distinguish from verify-phase evidence files written by `verify-phase.ts`.

### Reference Docs
- [Research: Implementation Verification Redesign](/data/projects/kata-wm/planning/research/2026-02-25-implementation-verification-redesign.md) -- full analysis of the problem and recommended approach
- [Claude Code Writer/Reviewer pattern](https://docs.anthropic.com/en/docs/claude-code) -- separation of implementation and verification contexts
- [arXiv 2602.00409](https://arxiv.org/abs/2602.00409) -- empirical study on agent test quality (mocks at 95%)

---
