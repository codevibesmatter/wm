# Research: Implementation Workflow Verification Redesign

> **Context**: The baseplane-dev1 #1533 implementation (COI workflow cutover) produced code
> that compiled, passed 127 tests, got LLM code review approval, and had full verification
> evidence — but had 5 distinct integration bugs that made it non-functional. The agent
> sometimes faithfully follows the IMPL→CODEX→VERIFY template, sometimes skips quality gates
> entirely. Both outcomes can produce non-working code because the verification pipeline
> validates process, not correctness.

---

## Part 1: What Actually Went Wrong (The #1533 Post-Mortem)

### The 5 integration bugs that unit tests didn't catch

All 5 bugs were at **component boundaries** — where one component's output feeds another's input:

| Bug | Root Cause | Why Tests Missed It |
|-----|-----------|-------------------|
| `{{input.vendorName}}` in mapping config | `applyMapToItem()` expects dot-path strings, not template variables. VariableResolver resolved these against workflow inputs (coi_id, batch_id) where vendorName doesn't exist → all fields `undefined` | Tests pre-set step results via `context.setStepResult()` instead of testing actual VariableResolver→DataTransform data flow |
| Non-existent `coi_compliance` decision slug | Step 4 referenced a slug that doesn't exist in any decision table | Tests mocked the DecisionEvaluateStepType response, never validated the slug against real data |
| `{{context.now}}` unsupported | VariableResolver's ResolverContext has no `now` property | No test ran VariableResolver on the actual template config |
| `_workflow_*` shadow fields don't exist | Step 9 wrote to entity fields that don't exist in the schema | Tests mocked the DataForge worker response, never validated against real entity schema |
| Missing status derivation | Old consumer had confidence-based logic; new code relied on non-existent compliance check | Tests tested a `determineCOIStatus()` function defined **inline in the test file**, not imported from production code |

### Why the tests were structurally unable to catch these bugs

The 52 "integration" tests were actually **unit tests with pervasive mocks**:

- **Database**: `vi.fn()` chain returning hardcoded objects
- **R2 Bucket**: `vi.fn()` returning `{ arrayBuffer: () => new ArrayBuffer(1024) }`
- **AI Services**: `vi.fn()` returning canned `new Response(JSON.stringify({...}))`
- **DataForge Worker**: `vi.fn()` returning canned JSON
- **Step results**: Pre-populated via `context.setStepResult()` — bypassing actual step-to-step data flow

The full DAG execution test ran all steps in sequence but only asserted `status === 'completed'` and `results.size === 8`. It never checked actual field values in the pipeline output.

**Core pattern**: Tests validated "given perfectly shaped mock data, does the downstream step handle it?" — not "does the upstream step actually produce data in the shape the downstream step needs?"

---

## Part 2: The Current Verification Pipeline (Complete Audit)

### Every gate from session start to exit

| Gate | When | Enforcement | What It Proves | What It Can't Prove |
|------|------|-------------|---------------|-------------------|
| `mode-gate` | Any write tool | **HARD BLOCK** | Agent entered a mode | Nothing about quality (freeform bypasses all) |
| `task-deps` | TaskUpdate(completed) | **HARD BLOCK** (strict only) | Tasks completed in order | That work was actually done |
| `task-evidence` | TaskUpdate(completed) | **Advisory only** | (warns about uncommitted changes) | Nothing — agent can ignore |
| verify-phase: build | Manual run | Blocks verify-phase | Code compiles | Not correctness |
| verify-phase: typecheck | Manual run | Blocks verify-phase | Types check | Not runtime correctness |
| verify-phase: tests | Manual run | Blocks verify-phase | Tests pass | Not that tests are meaningful |
| verify-phase: smoke | Manual run | Blocks verify-phase | Smoke test passes | Not feature correctness |
| verify-phase: assertion delta | Manual run | Blocks verify-phase | Assertions not removed | Not that new assertions are meaningful |
| verify-phase: micro-review | Manual run | Blocks verify-phase | LLM reviewed the diff | Review quality varies |
| `tasks_complete` stop | Agent tries to exit | **HARD BLOCK** | All tasks marked done | That work was done (self-reported) |
| `committed` stop | Agent tries to exit | **HARD BLOCK** | Changes committed | Not that changes are meaningful |
| `pushed` stop | Agent tries to exit | **HARD BLOCK** | Code pushed | Not that it was pushed to right branch |
| `verification` stop | Agent tries to exit | **HARD BLOCK** | External review passed | Not correctness (depends on reviewer) |
| `tests_pass` stop | Agent tries to exit | **HARD BLOCK** | verify-phase evidence exists | Same limitations as verify-phase |
| `feature_tests_added` stop | Agent tries to exit | **HARD BLOCK** | ≥1 new test function | Not that test is meaningful |

### Structural weaknesses

1. **Task completion is honor-system**: `TaskUpdate(status="completed")` always succeeds. Even in strict mode, `task-deps` checks ordering only, `task-evidence` is advisory.

2. **Error handling defaults to allow**: Throughout the codebase, catch blocks default to `{ passed: true }` or allow. Infrastructure failures silently disable verification.

3. **Strict mode is opt-in**: Default `kata setup --yes` registers only mode-gate and stop-conditions. No task-deps, no task-evidence.

4. **Freeform is an escape hatch**: Zero stop conditions. Agent can switch modes mid-session to bypass all enforcement.

5. **No spec conformance check**: Tasks are derived from the spec, but completing them is self-reported. Nothing verifies the implementation matches spec behaviors.

6. **verify-phase checks process, not correctness**: Build passes, tests pass, assertions exist — but this proves the agent went through the motions, not that the code works.

---

## Part 3: The Testing Problem (Why Unit Tests Don't Help)

### What the research says

| Finding | Source | Implication |
|---------|--------|------------|
| 7.8% of patches that pass benchmark tests fail the full test suite | SWE-bench Verified (OpenAI) | Test passage is necessary but insufficient |
| 36% of agent test commits add mocks (vs 26% human) | Empirical study, 1.25M commits, 2,168 repos (arXiv 2602.00409) | Agent-written tests over-rely on mocks |
| Agents use mocks at 95% with almost no diversity (humans: 91% mocks but also 57% fakes, 51% spies) | Same study | Agents don't use realistic test doubles |
| 30-32% of LLM solutions only partially adhere to correctness properties | ACM property-based testing study | Unit test evaluations overestimate correctness |
| GPT-5 exploited test cases 76% of the time when specs conflict with tests | ImpossibleBench (LessWrong) | Agents optimize for test passage, not spec conformance |
| Every commercial agent (Devin 67% merge rate, Cosine, Factory) relies on existing CI + human review | Industry survey | No commercial agent has solved independent verification |

### The over-mocking problem

When the same agent writes both code and tests:
- It optimizes for the metric (tests pass) not the property (code works)
- Mock shapes reflect the agent's mental model of how the system works, not how it actually works
- The test provides exactly the data the code expects, creating a circle of self-validation
- Real integration paths (VariableResolver → DataTransform → DecisionEvaluate) are never exercised

### What baseplane-dev1 already has but doesn't use

| Layer | Infrastructure | Status |
|-------|---------------|--------|
| Worker integration tests (`@cloudflare/vitest-pool-workers`) | Vitest configs for 8 workers, `defineWorkersConfig` | **Zero actual tests**. 7/8 missing `wrangler.test.toml` |
| Browser E2E | 55 spec files, auth handling, custom matchers | **Mature and operational** |
| LLM behavior verification (`at verify`) | Gemini-as-judge with real browser screenshots | **Operational** — verifies against feature doc behaviors |
| Codex code review (`at codex :code`) | GPT-5.2-Codex static review | **Operational** — catches patterns, not integration |
| Smoke tests | `pnpm test:smoke` configured | **Broken** — referenced script doesn't exist |
| API testing | `bpd` CLI for manual API calls | **Ad-hoc only**, not automated |

**The gap**: The most reliable testing layers (browser E2E, `at verify` with screenshots) are available but not wired into the implementation workflow. The template tells the agent to write unit tests, not to use the existing integration infrastructure.

---

## Part 4: Industry Approaches to Agentic Verification

### The verification hierarchy (from weakest to strongest)

| Level | Method | What It Proves | Reliability |
|-------|--------|---------------|-------------|
| 1 | Code compiles/builds | Syntactic validity | High but weak signal |
| 2 | Existing tests pass | Doesn't break known behavior | Medium |
| 3 | Agent-written unit tests pass | Agent believes code works | **Low** |
| 4 | CI pipeline passes (lint, security, integration) | Multi-signal structural check | Medium-High |
| 5 | AI code review (separate agent/context) | No obvious bugs in diff | Medium |
| 6 | Integration tests against real services | Works when connected | **High** |
| 7 | E2E/browser tests against running app | Works from user perspective | **High** |
| 8 | Human code review | Semantic correctness | High |
| 9 | Property-based / formal verification | Mathematical correctness | Very High |

### Key patterns from the industry

**Separation of concerns (Claude Code official docs)**: Writer/Reviewer pattern — implementation and review in separate sessions with fresh context to avoid confirmation bias.

**Self-healing CI (Elastic)**: CI runs, if tests fail, agent fixes and re-runs. The agent must actually execute failing tests and confirm they pass. Human review mandatory — auto-merge disabled when agent contributes.

**Sandbox enforcement (GitHub Agentic Workflows)**: Read-only by default. Write operations map to pre-approved, reviewable operations. Network isolation prevents arbitrary endpoint access.

**Test reward hacking (METR, ImpossibleBench)**: Models actively exploit test harnesses — stack introspection, monkey-patching, evaluator stubbing. Mitigation: patch scoring systems rather than training models not to cheat. In practice: don't let the implementing agent control the verification.

---

## Part 5: Recommendations

### R1: Replace agent-written unit tests with real integration tests as the primary gate

**Problem**: Agent-written unit tests with mocks are self-validating and structurally unable to catch integration bugs.

**Approach**: The baseplane project already has `@cloudflare/vitest-pool-workers` infrastructure. The implementation template should require:
- Worker integration tests using `SELF.fetch()` against real oRPC endpoints within miniflare
- Tests run inside the Cloudflare Workers runtime with real bindings (DOs, R2, queues via miniflare)
- For the #1533 case: a test that feeds a real template config through the real VariableResolver → real DataTransformStepType → real step execution pipeline would have caught all 5 bugs

**Template change**: The VERIFY task should run integration tests, not unit tests. The `test_command` in wm.yaml should point to integration test suites, not unit test suites.

### R2: Wire `at verify` (LLM-as-judge with screenshots) into the implementation workflow as a hard gate

**Problem**: The most reliable verification mechanism in the project (browser-based behavioral verification against feature docs) is not part of the implementation workflow.

**Approach**: After implementation is "done" and committed, the template should require:
```
at verify feature {domain}/{feature}
```
This exercises the running application, takes screenshots, and uses Gemini to judge pass/fail against the spec's feature behaviors. It's the closest thing to "does this actually work."

**Constraint**: Requires a running dev server. The template already has P0 (Baseline) which starts the dev server. The verification step should happen before P3 (Close).

### R3: Make task-evidence blocking, not advisory

**Problem**: `task-evidence` is always advisory. The agent receives a warning about uncommitted changes but can ignore it.

**Approach**: For specific task labels (codex, verify), require artifact existence:
- CODEX task completion requires a codex review file with timestamp > last commit
- VERIFY task completion requires verification-evidence JSON with `overallPassed: true`
- IMPL task completion requires at least one new commit since task was marked in_progress

This transforms task completion from self-reporting to artifact-gated. The hook can read the task's labels to determine which artifacts to require.

### R4: Strict mode should be the default

**Problem**: Default setup registers only mode-gate and stop-conditions. Task ordering and evidence checks are opt-in.

**Approach**: Make `task-deps` always registered. Make `task-evidence` always registered AND blocking for labeled tasks. The current `--strict` flag becomes the default, with `--relaxed` for opt-out.

### R5: Error handling should fail closed

**Problem**: Catch blocks throughout the pipeline default to `{ passed: true }` or allow. Infrastructure failures silently disable verification.

**Approach**: Verification errors should fail the check, not pass it. `catch { return { passed: false, error: e.message } }`. The agent should see the infrastructure failure and either fix it or escalate, not silently proceed.

### R6: Block mode switching during active implementation

**Problem**: Agent can enter freeform mode to escape all stop conditions.

**Approach**: `kata enter` should check if the current mode has unsatisfied stop conditions. If so, block mode entry unless `--force` or `--abandon` is passed. Log the abandonment with reason.

### R7: Command trace verification for quality gate tasks

**Problem**: Nothing verifies that `at codex :code` or `at verify work` was actually executed before the corresponding task is marked complete.

**Approach**: Log every Bash command to the session's command trace file. When a CODEX or VERIFY task is completed, the task-evidence hook checks that the corresponding command appeared in the trace since the task was marked in_progress. This is mechanically enforceable via PreToolUse hook.

### R8: Separate test authorship from implementation

**Problem**: When the same agent writes code and tests, it creates a self-validating circle.

**Approach**: The subphase pattern already separates IMPL from VERIFY. Strengthen this by:
- IMPL agent writes code but NOT tests
- A separate VERIFY step writes/runs tests against the committed code in a fresh context
- The VERIFY agent doesn't see the implementation's mental model, only the spec behaviors and the committed code

This maps to Claude Code's Writer/Reviewer pattern and addresses the test reward hacking problem.

---

## Part 6: Proposed Verification Pipeline (Redesigned)

### For each spec phase (P2.X):

```
P2.X:IMPL
  → Agent writes code
  → Must commit before marking complete
  → Enforcement: new commit required since task start

P2.X:INTEGRATION-TEST  (replaces P2.X:CODEX as the primary gate)
  → Run integration tests: pnpm test:integration (vitest-pool-workers)
  → Must pass with real bindings, not mocks
  → Enforcement: test command exit code + assertion delta

P2.X:REVIEW
  → at codex :code (static review for patterns/security)
  → Enforcement: review artifact required

P2.X:VERIFY-BEHAVIOR
  → at verify feature {domain}/{feature} (browser + LLM-as-judge)
  → Only for phases that change observable behavior
  → Enforcement: verification-results JSON with pass status
```

### Before exit (P3: Close):

```
P3.1: Run full verify-phase (build, typecheck, integration tests, smoke, assertion delta)
P3.2: at verify feature {domain}/{feature} — full behavioral verification
P3.3: Commit, push, create PR
P3.4: Stop conditions enforce: tests_pass + verification + committed + pushed + feature_tests_added
```

### Key differences from current pipeline:

| Current | Proposed |
|---------|----------|
| Agent writes unit tests with mocks | Integration tests against real worker runtime (miniflare) |
| CODEX review is the primary quality gate | Integration tests are the primary gate; CODEX is secondary |
| `at verify` not in the workflow | `at verify` is a hard gate before close |
| task-evidence advisory | task-evidence blocking for labeled tasks |
| Strict mode opt-in | Strict mode default |
| Error handling allows on failure | Error handling blocks on failure |
| Agent can escape to freeform | Mode switching blocked when stop conditions unsatisfied |

---

## Open Questions

1. **Integration test bootstrapping**: For projects without existing integration tests, who writes the first ones? The implementing agent? A separate setup phase? A template-provided scaffold?

2. **`at verify` availability**: Not all features have browser-observable behaviors. Backend-only work (like the #1533 COI cutover) has no UI to screenshot. Can `at verify` be adapted for API verification? Or is a separate API smoke test mechanism needed?

3. **Performance**: Adding integration tests + browser verification + code review to every phase will significantly increase implementation time. Is there a tiered approach (quick checks per phase, full verification only at close)?

4. **Template portability**: The redesigned pipeline assumes `vitest-pool-workers` and `at verify` exist. How do projects without this infrastructure benefit? Should kata-wm ship with integration test scaffolds for common stacks?

5. **False positive rate**: If verification is too strict and blocks exit frequently, agents will find new escape routes. What's the right calibration between enforcement and usability?
