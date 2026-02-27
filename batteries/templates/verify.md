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
          Parse all `### VPn:` steps — each step has a title, commands to run,
          and expected outcomes to compare against.

          **2. Plan file (if a verify-plan.md exists in the workflow dir):**
          ```bash
          kata status  # check workflowDir
          cat {workflowDir}/verify-plan.md
          ```

          **3. Infer from git diff (default when no issue/plan):**
          ```bash
          git log --oneline -10
          git diff HEAD~1 --stat
          git diff HEAD~1
          ```
          Build VP steps from what changed:
          - VP1: Build/compile passes (run project build command)
          - VP2: Tests pass (run project test command)
          - VP3: Changed files are correct (read each changed file, check for bugs/regressions)
          - VP4: Changes match commit intent (does the diff match what the commit message says?)

          Document which input source you are using and list all VP step titles.
          Then: Mark this task completed via TaskUpdate

      - id: read-verification-tools
        title: "Read verification tools config"
        instruction: |
          Read the project's verification tools config:
          - `.kata/verification-tools.md` (or `.claude/workflows/verification-tools.md`)

          This file has the project's dev server command, API base URL, auth setup,
          database access, and key endpoints. Read it FIRST before executing any VP steps.

          If no verification-tools.md exists, check `wm.yaml` for `dev_server_command`.
          Then: Mark this task completed via TaskUpdate

      - id: start-dev-server
        title: "Start dev server and confirm health"
        instruction: |
          If `dev_server_command` is configured, start the dev server:
          ```bash
          # Example: npm run dev &
          # Wait for health endpoint to respond
          curl -s http://localhost:{PORT}/health || sleep 2 && curl ...
          ```

          Confirm the server is healthy before proceeding.
          If no dev server is needed (e.g., CLI-only or library project), skip and mark complete.
          Then: Mark this task completed via TaskUpdate

  - id: p1
    name: Execute
    container: true
    task_config:
      title: "P1: Execute - run all VP steps"
      labels: [execution, vp-steps]
    steps:
      - id: expand-vp-steps
        title: "Expand VP steps as individual tasks"
        instruction: |
          For each VP step found in P0, create a native task using TaskCreate:

          ```
          TaskCreate(
            subject="VP{N}: {step title}",
            description="Execute VP step {N}: {full step description with expected outcome}",
            activeForm="Running VP{N}: {step title}"
          )
          ```

          Create ALL step tasks before executing any of them.
          Then mark this expand task completed via TaskUpdate.

          Next: Work through each VP{N} task in order:
          1. Read the step's expected commands and outcomes
          2. Run the commands exactly as described
          3. Compare actual vs expected
          4. Record pass/fail with actual output in the task notes
          5. Mark the task completed

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
          Review results from P1. List all VP steps with their pass/fail status.

          If ALL VP steps passed: mark this task complete and proceed to P3.

          If any VP steps failed: proceed to fix-and-reverify below.
          Then: Mark this task completed via TaskUpdate

      - id: fix-and-reverify
        title: "Fix implementation and re-verify (max 3 cycles)"
        instruction: |
          For each failed VP step, run up to 3 fix cycles:

          **Each cycle:**
          1. **Diagnose** — read the error output carefully, identify root cause in implementation code
          2. **Fix** — make the minimal code change to fix the issue (edit implementation, NOT the VP steps)
          3. **Re-run** — re-execute the failed VP step exactly as originally specified
          4. **Record** — note pass/fail for this cycle

          **Hard rules:**
          - Fix the implementation code, NEVER modify VP steps — VP steps are the source of truth
          - Maximum 3 fix cycles per failed step
          - If still failing after 3 cycles: record as PERMANENTLY FAILED with full diagnosis
          - Do not skip steps even if they seem unrelated to the failure

          After fixing: commit code changes before writing evidence.
          ```bash
          git add {changed files}
          git commit -m "fix: {what was fixed to pass VP}"
          ```

          Then: Mark this task completed via TaskUpdate

  - id: p3
    name: Evidence
    task_config:
      title: "P3: Evidence - write VP evidence, commit, report results"
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

      - id: commit-evidence
        title: "Commit evidence and push"
        instruction: |
          Commit the VP evidence file:
          ```bash
          git add .kata/verification-evidence/ .claude/verification-evidence/
          git commit -m "chore(verify): VP evidence for issue #N — {PASSED|FAILED}"
          git push
          ```

          If any VP steps failed, note the failure summary in the commit message.
          Then: Mark this task completed via TaskUpdate

      - id: update-issue
        title: "Update GitHub issue with verification results"
        instruction: |
          If this is issue-based verification, comment on the issue:

          **If all passed:**
          ```bash
          gh issue comment {N} --body "## Verification Plan PASSED

          All VP steps executed and passed.

          | Step | Result |
          |------|--------|
          | VP1  | ✅ Passed |
          | VP2  | ✅ Passed |

          Evidence: \`.kata/verification-evidence/vp-p1-{N}.json\`"
          ```

          **If any failed:**
          ```bash
          gh issue comment {N} --body "## Verification Plan FAILED

          {N}/{total} VP steps failed after 3 fix cycles.

          | Step | Result | Notes |
          |------|--------|-------|
          | VP1  | ✅ Passed | |
          | VP2  | ❌ Failed | {diagnosis} |

          Implementation needs further work before this issue can close."
          ```

          If no issue number (infer/plan-file mode), skip this step.
          Then: Mark this task completed via TaskUpdate

      - id: report-results
        title: "Report verification results"
        instruction: |
          Summarize results to the user:
          - Input source: {issue spec | plan file | inferred from git diff}
          - Total VP steps: {count}
          - Passed: {count}
          - Failed: {count}
          - Fix cycles used: {count}

          **Final verdict:**
          - All passed → "✅ Verification Plan PASSED"
          - Any failed → "❌ Verification Plan FAILED — {list failing steps with diagnosis}"

          Then: Mark this task completed via TaskUpdate

global_conditions:
  - changes_committed
  - changes_pushed
---

# Verify Mode

You are in **verify** mode. Execute a Verification Plan and fix any failures.

## Your Role

- Execute VP steps literally as written — commands, expected outcomes, all of it
- Do NOT modify VP steps — they are the source of truth
- Fix implementation code if VP steps fail (never the VP steps themselves)
- Record all results as evidence and commit it

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
    ├── Expand VP steps as individual tasks
    ├── VP1: {step title}
    ├── VP2: {step title}
    └── ...VPn: {step title}

P2: Fix Loop
    ├── Check for failures from P1
    └── For each failure: diagnose → fix → re-verify (max 3 cycles)

P3: Evidence
    ├── Write VP evidence JSON
    ├── Commit evidence + push
    ├── Update GitHub issue (if issue-based)
    └── Report pass/fail results
```

## VP Step Execution Protocol

For each VP step:

1. **Read** the step instructions carefully — note commands AND expected outcomes
2. **Execute** each command exactly as described — do not "improve" or skip commands
3. **Compare** actual results to expected results — be precise, not approximate
4. **Record** pass/fail with actual output captured

### Rules

- Execute commands EXACTLY as written in the VP
- If a step requires the dev server, ensure it is running before executing
- Record ALL results, even failures — do not stop on first failure, complete all steps
- Never mark a step "passed" without actually running its commands

## Repair-Reverify Loop (P2)

If any VP step fails in P1:

1. **Diagnose** — read the error, identify the root cause in implementation code
2. **Fix** — make the minimal code change to address the root cause
3. **Re-run** — re-execute the failed VP step exactly as originally specified
4. **Max 3 cycles** — if still failing after 3 repair attempts, record as permanently failed

**Critical:** Fix the implementation, never the VP steps. VP steps encode what the feature
is supposed to do — they are correct by definition in this mode.

## Stop Conditions

- All VP steps executed and recorded
- Fix loop complete (all passing or max cycles reached)
- VP evidence file committed and pushed
- Results reported with pass/fail verdict
