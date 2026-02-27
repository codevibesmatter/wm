---
id: verify
name: "Verification Plan Execution"
description: "Standalone VP execution with repair loop — run after implementation or task mode"
mode: verify
workflow_prefix: "VF"

phases:
  - id: p0
    name: Setup
    task_config:
      title: "P0: Setup - determine VP source, read verification tools, prepare environment"
      labels: [orchestration, setup]
    steps:
      - id: determine-input
        title: "Determine VP input source"
        instruction: |
          Determine where the Verification Plan comes from. Check in order:

          **1. Issue spec (if --issue=N was provided):**
          ```bash
          ls planning/specs/ | grep "{issue-number}"
          ```
          Read the spec and extract the `## Verification Plan` section.
          Parse all `### VPn:` steps.

          **2. Plan file (if a verify-plan.md exists in the workflow dir):**
          ```bash
          kata status  # check workflowDir
          cat {workflowDir}/verify-plan.md
          ```

          **3. Infer from git diff (default):**
          ```bash
          git log --oneline -10
          git diff HEAD~1 --stat
          git diff HEAD~1
          ```
          Build VP steps from what changed:
          - VP1: Build passes
          - VP2: Tests pass
          - VP3: Changed files are correct (read each, check for bugs)
          - VP4: Changes match commit intent

          Document which input source you're using.
          Then: Mark this task completed via TaskUpdate

      - id: read-verification-tools
        title: "Read verification tools config"
        instruction: |
          Read the project's verification tools config:
          - `.kata/verification-tools.md` (or `.claude/workflows/verification-tools.md`)

          This file has the project's dev server command, API base URL, auth setup,
          database access, and key endpoints. Read it FIRST.

          If no verification-tools.md exists, check `wm.yaml` for `dev_server_command`.
          Then: Mark this task completed via TaskUpdate

      - id: start-dev-server
        title: "Start dev server and confirm health"
        instruction: |
          If `dev_server_command` is configured, start the dev server:
          ```bash
          # Example: npm run dev &
          # Wait for health endpoint to respond
          ```

          Confirm the server is healthy before proceeding.
          If no dev server is needed (e.g., CLI-only project), skip and mark complete.
          Then: Mark this task completed via TaskUpdate

  - id: p1
    name: Execute
    container: true
    task_config:
      title: "P1: Execute - run all VP steps"
      labels: [execution, vp-steps]

  - id: p2
    name: Fix Loop
    task_config:
      title: "P2: Fix Loop - repair failures and re-verify"
      labels: [execution, fix-loop]
      depends_on: [p1]
    steps:
      - id: check-failures
        title: "Check for VP failures"
        instruction: |
          Review results from P1. If all VP steps passed, mark this task complete
          and skip to P3.

          If any VP steps failed, proceed to the fix loop below.
          Then: Mark this task completed via TaskUpdate

      - id: fix-and-reverify
        title: "Fix implementation and re-verify (max 3 cycles)"
        instruction: |
          For each failed VP step:

          **Cycle 1-3:**
          1. **Diagnose** — read the error output, identify root cause in implementation code
          2. **Fix** — make the minimal code change to fix the issue
          3. **Re-run** — re-execute the failed VP step(s) exactly as before
          4. **Record** — note pass/fail for the re-run

          **Rules:**
          - Fix the implementation, NEVER the VP steps (they are the source of truth)
          - Maximum 3 fix cycles per failure
          - If still failing after 3 cycles, record as FAILED with diagnosis

          Then: Mark this task completed via TaskUpdate

  - id: p3
    name: Evidence
    task_config:
      title: "P3: Evidence - write VP evidence, report results"
      labels: [orchestration, evidence]
      depends_on: [p2]
    steps:
      - id: write-evidence
        title: "Write VP evidence file"
        instruction: |
          Write VP evidence to `.kata/verification-evidence/` (or `.claude/verification-evidence/` for old layout).

          Filename convention (the `can-exit` check requires `vp-*-{issueNumber}.json`):
          - Issue-based: `vp-p{N}-{issueNumber}.json` (e.g. `vp-p1-42.json`)
          - Plan-file: `vp-task-{plan-name}.json`
          - Infer mode: `vp-infer-{HEAD-short-hash}.json`

          ```json
          {
            "issueNumber": {N},
            "timestamp": "{ISO-8601}",
            "mode": "issue | plan-file | infer",
            "steps": [
              {"id": "VP1", "description": "...", "passed": true, "actual": "..."},
              {"id": "VP2", "description": "...", "passed": false, "actual": "...", "expected": "..."}
            ],
            "fixCycles": 0,
            "allStepsPassed": true
          }
          ```

          Then: Mark this task completed via TaskUpdate

      - id: report-results
        title: "Report verification results"
        instruction: |
          Summarize results:
          - Input source: {issue spec | plan file | inferred from git diff}
          - Total VP steps: {count}
          - Passed: {count}
          - Failed: {count}
          - Fix cycles used: {count}

          If all passed: "Verification Plan PASSED"
          If any failed: "Verification Plan FAILED" with failure details

          Then: Mark this task completed via TaskUpdate

global_conditions:
  - verification_plan_executed
---

# Verify Mode

You are in **verify** mode. Execute a Verification Plan and fix any failures.

## Your Role

- Execute VP steps literally as written
- Do NOT modify VP steps — they are the source of truth
- Fix implementation code if VP steps fail (not the VP steps themselves)
- Record all results as evidence

## Input Sources

Verify mode supports three input sources (checked in order):

1. **Issue spec** — `kata enter verify --issue=N` extracts VP from the spec's `## Verification Plan`
2. **Plan file** — reads `### VPn:` steps from a standalone markdown file
3. **Infer** — builds VP from git diff + commit messages (build, tests, code review, intent matching)

## Phase Flow

```
P0: Setup
    ├── Determine VP input source (issue / plan-file / infer)
    ├── Read verification-tools.md
    └── Start dev server, confirm health

P1: Execute (per VP step)
    ├── VP1: {step title}
    ├── VP2: {step title}
    └── ...VPn: {step title}

P2: Fix Loop
    ├── Check for failures from P1
    └── For each failure: diagnose → fix → re-verify (max 3 cycles)

P3: Evidence
    ├── Write VP evidence JSON
    └── Report pass/fail results
```

## VP Step Execution Protocol

For each VP step:

1. **Read** the step instructions carefully
2. **Execute** each command/check exactly as described
3. **Compare** actual results to expected results
4. **Record** pass/fail with actual output

### Rules

- Execute commands EXACTLY as written — do not modify or "improve" them
- If a step requires the dev server, ensure it's running
- Record ALL results, even failures — do not stop on first failure

## Repair-Reverify Loop (P2)

If any VP step fails in P1:

1. **Diagnose** — read the error, identify the root cause in implementation code
2. **Fix** — make the minimal code change to fix the issue
3. **Re-run** — re-execute the failed VP step(s)
4. **Max 3 cycles** — if still failing after 3 repair attempts, report failure

**Important:** Fix the implementation, never the VP steps. VP steps are the spec's
source of truth for expected behavior.

## Stop Conditions

- All VP steps executed
- Fix loop complete (all passing, or max cycles reached)
- VP evidence file written
- Results reported (pass or fail with details)
