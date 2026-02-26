---
id: verify
name: "Verification Plan Execution"
description: "Execute spec VP steps against real running system with repair loop"
mode: verify
workflow_prefix: "VF"

phases:
  - id: p0
    name: Setup
    task_config:
      title: "P0: Setup - read verification tools, start dev server, confirm health"
      labels: [orchestration, setup]
    steps:
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
    name: Evidence
    task_config:
      title: "P2: Evidence - write VP evidence, report results"
      labels: [orchestration, evidence]
      depends_on: [p1]
    steps:
      - id: write-evidence
        title: "Write VP evidence file"
        instruction: |
          Write VP evidence to `.kata/verification-evidence/vp-{issueNumber}.json`
          (or `.claude/verification-evidence/` for old layout):

          ```json
          {
            "issueNumber": {N},
            "timestamp": "{ISO-8601}",
            "steps": [
              {"id": "VP1", "description": "...", "passed": true, "actual": "..."},
              {"id": "VP2", "description": "...", "passed": false, "actual": "...", "expected": "..."}
            ],
            "allStepsPassed": true
          }
          ```

          Then: Mark this task completed via TaskUpdate

      - id: report-results
        title: "Report verification results"
        instruction: |
          Summarize results:
          - Total VP steps: {count}
          - Passed: {count}
          - Failed: {count}

          If all passed: "Verification Plan PASSED"
          If any failed: "Verification Plan FAILED" with failure details

          Then: Mark this task completed via TaskUpdate

global_conditions:
  - verification_plan_executed
---

# Verify Mode

You are in **verify** mode. Execute the spec's Verification Plan against the real running system.

## Your Role

- You are a **fresh agent** with no knowledge of the implementation
- Execute VP steps literally as written in the spec
- Do NOT modify VP steps — they are the source of truth
- Fix implementation code if VP steps fail (not the VP steps themselves)

## Phase Flow

```
P0: Setup
    ├── Read verification-tools.md
    └── Start dev server, confirm health

P1: Execute (per VP step)
    ├── VP1: {step title}
    ├── VP2: {step title}
    └── ...VPn: {step title}

P2: Evidence
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

## Repair-Reverify Loop

If any VP step fails:

1. **Diagnose** — read the error, identify the root cause in implementation code
2. **Fix** — make the minimal code change to fix the issue
3. **Re-run** — re-execute the failed VP step(s)
4. **Max 3 cycles** — if still failing after 3 repair attempts, report failure

**Important:** Fix the implementation, never the VP steps. VP steps are the spec's
source of truth for expected behavior.

## Stop Conditions

- All VP steps executed
- VP evidence file written
- Results reported (pass or fail with details)
