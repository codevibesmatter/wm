---
id: implementation
name: "Feature Implementation"
description: "Execute approved spec — claim branch, implement, test, verify, close with PR"
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
    subphase_pattern: impl-test

  - id: p3
    name: Verify
    task_config:
      title: "P3: Verify - run full Verification Plan via fresh agent"
      labels: [orchestration, verify]
      depends_on: [p2]
    steps:
      - id: run-verify
        title: "Run kata verify-run"
        instruction: |
          Spawn a fresh verification agent to execute ALL VP steps from the spec:
          ```bash
          kata verify-run --issue={issue-number} --verbose
          ```

          This runs a separate Claude agent with full tool access that:
          1. Enters verify mode
          2. Executes every VP step from the spec
          3. Fixes implementation if VP steps fail (repair loop, max 3 cycles)
          4. Writes VP evidence JSON

          **Interpreting results:**
          - Exit 0: all VP steps passed — proceed to next phase
          - Exit 1 with output: verification failed — review failures and fix
          - Exit 1 with no output: spawn failure — see troubleshooting below

          **Troubleshooting silent failures:**
          If verify-run exits 1 with no output or evidence:
          1. First try `--dry-run` to confirm the spec has valid VP steps
          2. Re-run with `--verbose` to see agent stderr
          3. If still silent, try direct node invocation (bypasses shell wrapper):
             `node <path-to-kata>/dist/index.js verify-run --issue={N} --verbose`
          4. As last resort, use the Task tool to spawn a fresh agent that
             executes the VP steps manually (same fresh-eyes principle)

          Then: Mark this task completed via TaskUpdate

  - id: p4
    name: Close
    task_config:
      title: "P4: Close - final checks, commit, PR, close issue"
      labels: [orchestration, close]
      depends_on: [p3]
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
    └── TEST: run process gates (build, typecheck, tests)

P3: Verify (once, after all phases)
    └── kata verify-run — fresh agent executes full VP

P4: Close
    ├── Final typecheck + tests
    ├── Commit + push
    ├── Create PR
    └── Comment on GitHub issue
```

## Key Rules

- **Read spec first** — understand ALL phases before writing code
- **One phase at a time** — complete IMPL + TEST before moving on
- **No scope creep** — spec's non-goals are off-limits
- **Commit per phase** — smaller commits, easier review

## CHECK Protocol

Each CHECK sub-phase follows this exact sequence. Run deterministic checks
first, then do a spec-checklist review. Do NOT skip steps or reorder.

### Step 1: Build check

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
  - If not, write the test BEFORE marking CHECK complete.
  - Run the test and confirm it passes.
```

If no test infrastructure exists, check the spec's Verification Strategy
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

## P3: Full Verification (kata verify-run)

After all implementation phases are complete, P3 spawns a **fresh agent**
that executes the spec's entire Verification Plan against the real system.

```bash
kata verify-run --issue={N} --verbose
```

### Why a fresh agent?

The implementing agent wrote the code AND the unit tests. It has a mental model
that may contain blind spots. A fresh agent executing concrete VP steps against
real services catches integration bugs that unit tests with mocks cannot.

### What verify-run does

1. Reads the spec's `## Verification Plan` section
2. Parses all `### VPn:` steps into individual tasks
3. Enters verify mode via `kata enter verify --issue=N`
4. Executes each VP step literally (no modifications)
5. If any step fails: diagnoses, fixes code, re-runs (max 3 cycles)
6. Writes VP evidence JSON to `.kata/verification-evidence/`

### After verify-run

- Exit code 0 → all VP steps passed, proceed to P4 Close
- Exit code 1 → verification failed, review output and fix

## Stop Conditions

- All spec phases implemented and tested
- Verification Plan executed (VP evidence exists)
- Changes committed and pushed
- PR created (or explicitly skipped)
