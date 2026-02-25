---
id: implementation
name: "Feature Implementation"
description: "Execute approved spec — claim branch, implement, review, close with PR"
mode: implementation
phases:
  - id: p0
    name: Baseline
    task_config:
      title: "P0: Baseline - verify environment, read spec, confirm approach"
      labels: [orchestration, baseline]
    steps:
      - id: read-spec
        title: "Read and understand the spec"
        instruction: |
          Find and read the approved spec:
          ```bash
          ls planning/specs/ | grep "{issue-number or keyword}"
          ```

          Read the spec IN FULL. Understand:
          - All behaviors (B1, B2, ...) and their acceptance criteria
          - All implementation phases and their tasks
          - Non-goals (what NOT to do)

          If no spec exists, ask user for the spec file location.
          Then: Mark this task completed via TaskUpdate

      - id: verify-environment
        title: "Verify dev environment is working"
        instruction: |
          Run sanity checks before making any changes:
          ```bash
          # Check types pass on clean tree
          # (use your project's typecheck command)
          git status  # Should be clean
          git log --oneline -3  # Confirm you're on the right branch
          ```

          Document: current branch, any pre-existing issues.
          Then: Mark this task completed via TaskUpdate

  - id: p1
    name: Claim
    task_config:
      title: "P1: Claim - create branch, link GitHub issue"
      labels: [orchestration, claim]
      depends_on: [p0]
    steps:
      - id: create-branch
        title: "Create feature branch"
        instruction: |
          Create a branch for this work:
          ```bash
          git checkout -b feature/{issue-number}-{slug}
          git push -u origin feature/{issue-number}-{slug}
          ```

          Or if already on a feature branch, confirm it's up to date:
          ```bash
          git fetch origin
          git status
          ```

          Then: Mark this task completed via TaskUpdate

      - id: claim-github-issue
        title: "Claim GitHub issue"
        instruction: |
          If GitHub issue exists, claim it:
          ```bash
          gh issue edit {N} --remove-label "status:todo" --remove-label "approved" --add-label "status:in-progress"
          gh issue comment {N} --body "Starting implementation on branch: feature/{issue-number}-{slug}"
          ```

          If no GitHub issue, skip this step.
          Then: Mark this task completed via TaskUpdate

  - id: p2
    name: Implement
    container: true
    subphase_pattern: impl-test-verify

  - id: p3
    name: Close
    task_config:
      title: "P3: Close - final checks, commit, PR, close issue"
      labels: [orchestration, close]
      depends_on: [p2]
    steps:
      - id: final-checks
        title: "Run final checks"
        instruction: |
          Before closing:
          ```bash
          git status          # All changes staged?
          git diff --staged   # Review what's being committed
          ```

          Run your project's test and typecheck commands.
          Fix any remaining issues.
          Then: Mark this task completed via TaskUpdate

      - id: commit-and-push
        title: "Commit and push all changes"
        instruction: |
          Commit all implementation work:
          ```bash
          git add {changed files}
          git commit -m "feat({scope}): {description}

          Implements #{github-issue-number}"
          git push
          ```

          Then: Mark this task completed via TaskUpdate

      - id: create-pr
        title: "Create pull request"
        instruction: |
          Create a PR:
          ```bash
          gh pr create \
            --title "feat: {feature title} (#N)" \
            --body "## Summary
          - {bullet 1}
          - {bullet 2}

          ## Changes
          - {file/component}: {what changed}

          Closes #{N}" \
            --base main
          ```

          Note the PR URL. Move issue to in-review:
          ```bash
          gh issue edit {N} --remove-label "status:in-progress" --add-label "status:in-review"
          ```

          Then: Mark this task completed via TaskUpdate

      - id: close-issue
        title: "Update GitHub issue"
        instruction: |
          If GitHub issue exists:
          ```bash
          gh issue comment {N} --body "Implementation complete. PR: {pr-url}"
          ```

          The issue will auto-close when PR is merged ("Closes #N" in PR body).
          On merge, add status:done:
          ```bash
          gh issue edit {N} --remove-label "status:in-review" --add-label "status:done"
          ```
          Then: Mark this task completed via TaskUpdate

global_conditions:
  - changes_committed
  - changes_pushed
---

# Implementation Mode

You are in **implementation** mode. Execute the approved spec phase by phase.

## Your Role

- Read and understand the spec before writing any code
- Implement each spec phase completely before moving to the next
- Verify after each phase (typecheck, tests, git status)
- Track progress via task updates (TaskUpdate)

## Phase Flow

```
P0: Baseline
    ├── Read spec IN FULL
    └── Verify environment is clean

P1: Claim
    ├── Create feature branch
    └── Claim GitHub issue

P2: Implement (per-spec-phase)
    ├── IMPL: implement the phase tasks
    ├── TEST: run process gates (build, typecheck, tests)
    └── VERIFY: execute spec's Verification Plan against real services

P3: Close
    ├── Final typecheck + tests
    ├── Commit + push
    ├── Create PR
    └── Comment on GitHub issue
```

## Key Rules

- **Read spec first** — understand ALL phases before writing code
- **One phase at a time** — complete IMPL + TEST + VERIFY before moving on
- **No scope creep** — spec's non-goals are off-limits
- **Commit per phase** — smaller commits, easier review

## TEST Protocol

Each TEST sub-phase follows this exact sequence. These are **process gates** —
deterministic checks that the code compiles, tests pass, and the spec checklist
is satisfied. Do NOT skip steps or reorder.

### Step 1: Build verification

Run the project's **build command** (e.g. `npm run build`), not bare
`tsc --noEmit`. Projects with build-time codegen (route types, schema
generation) need the full pipeline. If the build fails, fix and re-run
before proceeding.

### Step 2: Run tests

Run the project's test command. If the spec phase has `test_cases:` in
its YAML, verify each one:

```
For each test_case in the spec phase:
  - Does a test exist that covers this case?
  - If not, write the test BEFORE marking TEST complete.
  - Run the test and confirm it passes.
```

If no test infrastructure exists, check the spec's Test Infrastructure
section for setup instructions.

### Step 3: Spec-checklist review

For each behavior (B1, B2...) covered by this phase, answer:

```
- [ ] Trigger: Does the code handle the specified trigger?
- [ ] Expected: Does the output match what the spec says?
- [ ] Verify: Can the verification method described in the spec confirm it works?
```

Keep this simple. Do NOT write elaborate self-review prompts — simple
"does X satisfy Y?" checks are more reliable than complex analysis.

### Step 4: Check for implementation hints

Re-read the spec's Implementation Hints section. Verify:
- Correct imports used (not guessed from node_modules exploration)
- Initialization follows documented patterns
- Known gotchas addressed

### Retry limits

If a build or test fails:
- Fix the issue using the error output (not blind retry)
- Maximum 3 fix attempts per failure before escalating to user
- Never silence errors, skip tests, or weaken assertions to pass

## VERIFY Protocol

Each VERIFY sub-phase executes the spec's **Verification Plan** against the
real running system. This is done by a **fresh agent** that has no knowledge
of the implementation — only the VP steps from the spec.

### Why a fresh agent?

The implementing agent wrote the code AND the unit tests. It has a mental model
that may contain blind spots. A fresh agent executing concrete VP steps against
real services catches integration bugs that unit tests with mocks cannot.

### Step 1: Start dev server

If `dev_server_command` is configured in `wm.yaml`, start the dev server:
```bash
# Example: npm run dev &
# Wait for health endpoint to respond
```

If the VP steps include server startup instructions, follow those instead.

### Step 2: Execute VP steps

Run each VP step from the spec's `## Verification Plan` section literally:

```
For each VP step:
  1. Execute the command (curl, browser navigation, CLI invocation)
  2. Compare actual output to expected output
  3. Record: step ID, pass/fail, actual output, expected output
```

**Rules:**
- Execute commands EXACTLY as written — do not modify or "improve" them
- If a step fails, record the failure and continue (don't stop on first failure)
- If a command requires the dev server, ensure it's running first

### Step 3: Write VP evidence

Write a VP evidence file at `.kata/verification-evidence/vp-{phaseId}-{issueNumber}.json`:

```json
{
  "phaseId": "p1",
  "issueNumber": 123,
  "timestamp": "2026-02-25T12:00:00.000Z",
  "steps": [
    {"id": "VP1", "description": "...", "passed": true, "actual": "..."},
    {"id": "VP2", "description": "...", "passed": false, "actual": "...", "expected": "..."}
  ],
  "allStepsPassed": false
}
```

### Step 4: Handle failures

If any VP step failed:
- Fix the implementation (not the VP steps — those are the source of truth)
- Re-run the failed VP steps
- Maximum 3 fix attempts before escalating to user
- Update the evidence file with final results

## Stop Conditions

- All spec phases implemented, tested, and verified (VP evidence files exist)
- Changes committed and pushed
- PR created (or explicitly skipped)
