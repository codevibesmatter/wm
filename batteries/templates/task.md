---
id: task
name: Task Mode
description: Combined planning + implementation for small tasks, chores, and quick fixes
mode: task
workflow_prefix: "TK"

phases:
  - id: p0
    name: Quick Planning
    task_config:
      title: "P0: Plan - scope, approach, verification plan (5-10 min)"
      labels: [phase, phase-0, planning]
    steps:
      - id: understand-task
        title: "Understand and classify the task"
        instruction: |
          Read the user's request carefully.

          **Classify:**
          - [ ] Chore — refactoring, cleanup, config change, docs
          - [ ] Small feature — < 3 files, < 100 lines
          - [ ] Fix — bug, typo, edge case
          - [ ] Chore with GitHub issue

          **If larger scope detected:** Tell the user and suggest:
          `wm enter planning` for full spec
          `wm enter implementation` if spec exists

          **GitHub issue?**
          ```bash
          gh issue list --search "{task description}" --limit 3
          ```
          Note issue # if found.

      - id: context-search
        title: "Quick context search (3-5 min max)"
        instruction: |
          Find relevant context fast. Search for:
          - Files related to the task (Glob for filenames, Grep for code patterns)
          - Existing patterns to follow (naming, structure, conventions)
          - Rules that may apply: check `.claude/rules/` if it exists

          Document 3-5 findings with file:line references.
          Keep it brief — just enough context to plan the change.

          Then: Mark this task completed via TaskUpdate

      - id: scope-and-approach
        title: "Define scope and approach"
        instruction: |
          Write a brief plan (3-5 lines):

          **Files to change:**
          - {file path}: {what changes}

          **Approach:**
          - Follow pattern from: {file:line reference}
          - Order: {step 1}, {step 2}

          **Out of scope:**
          - {what NOT to do}

          **GitHub:** #{issue-number} or "no issue"

          If GitHub issue found, claim it:
          ```bash
          gh issue edit {N} --remove-label "status:todo" --add-label "status:in-progress"
          ```

          Then: Mark this task completed via TaskUpdate

      - id: write-verification-plan
        title: "Write lightweight verification plan"
        instruction: |
          Write a verification plan file that a **fresh agent** will execute after
          implementation. The plan lives in the workflow directory.

          Create the file at the path shown by `kata status` under workflowDir,
          e.g. `.claude/sessions/{sessionId}/workflow/verify-plan.md`

          Format — use `### VPn:` headings (same format as spec-based VPs):

          ```markdown
          ### VP1: Build passes
          Run the project build command and confirm zero errors.

          ### VP2: Tests pass
          Run the project test suite. All tests must pass.

          ### VP3: {Task-specific check}
          {Concrete verification step — e.g. "Run kata status and confirm
          task mode is listed", or "Grep for the new function and confirm
          it exists in the expected file"}
          ```

          **Rules:**
          - 2-4 VP steps (keep it lightweight — this is task mode, not a full spec)
          - VP1 and VP2 should always be build + tests
          - VP3+ should be task-specific, concrete, and deterministic
          - Write steps a fresh agent can execute without context from this session

          Then: Mark this task completed via TaskUpdate

  - id: p1
    name: Implement
    task_config:
      title: "P1: Implement - make changes, verify as you go"
      labels: [phase, phase-1, implementation]
      depends_on: [p0]
    steps:
      - id: make-changes
        title: "Make the changes"
        instruction: |
          Follow your plan from P0. For each file:
          1. Read the file first
          2. Make minimal, focused changes
          3. Run typecheck/lint after significant edits

          **Keep it simple:**
          - No over-engineering
          - No features beyond scope
          - No unrelated refactoring

      - id: verify-as-you-go
        title: "Verify after each logical change"
        instruction: |
          After each change:
          ```bash
          # Run your project's typecheck command
          # Run relevant tests if they exist
          git diff  # Review what changed
          ```

          If tests exist for this area, run them:
          ```bash
          # Run tests matching the changed area
          ```

          Then: Mark this task completed via TaskUpdate

  - id: p2
    name: Verify
    task_config:
      title: "P2: Verify - run verification plan via fresh agent"
      labels: [orchestration, verify]
      depends_on: [p1]
    steps:
      - id: run-verify
        title: "Run kata verify-run with plan file"
        instruction: |
          Spawn a fresh verification agent to execute your VP steps:
          ```bash
          kata verify-run --plan-file=.claude/sessions/{sessionId}/workflow/verify-plan.md --verbose
          ```

          Use `kata status` to find the exact workflow directory path if needed.

          This runs a separate Claude agent with full tool access that:
          1. Enters verify mode
          2. Executes every VP step from your plan file
          3. Fixes implementation if VP steps fail (repair loop, max 3 cycles)
          4. Writes VP evidence JSON

          **Interpreting results:**
          - Exit 0: all VP steps passed — proceed to next phase
          - Exit 1 with output: verification failed — review failures and fix
          - Exit 1 with no output: spawn failure — see troubleshooting below

          **Troubleshooting silent failures:**
          If verify-run exits 1 with no output or evidence:
          1. First try `--dry-run` to confirm the plan file has valid VP steps
          2. Re-run with `--verbose` to see agent stderr
          3. If still silent, try direct node invocation (bypasses shell wrapper):
             `node <path-to-kata>/dist/index.js verify-run --plan-file=<path> --verbose`
          4. As last resort, use the Task tool to spawn a fresh agent that
             executes the VP steps manually (same fresh-eyes principle)

          Then: Mark this task completed via TaskUpdate

  - id: p3
    name: Complete
    task_config:
      title: "P3: Complete - final checks, commit, push, close issue"
      labels: [phase, phase-3, complete]
      depends_on: [p2]
    steps:
      - id: final-verification
        title: "Final verification"
        instruction: |
          ```bash
          # Run typecheck
          # Run lint
          git status          # Review all changes
          git diff --staged   # Confirm staged changes look right
          ```

      - id: commit-and-push
        title: "Commit, push, close issue"
        instruction: |
          Commit:
          ```bash
          git add {changed files}
          git commit -m "type(scope): description

          {If GitHub issue: Refs #N}"
          git push
          ```

          Commit types: `chore:` `fix:` `feat:` `refactor:` `docs:` `test:`

          **If GitHub issue:**
          ```bash
          gh issue edit {N} --remove-label "status:in-progress" --add-label "status:done"
          gh issue comment {N} --body "Done. Commit: {commit-sha}"
          # Close if fully resolved:
          gh issue close {N} --comment "Resolved in {commit-sha}"
          ```

          Then: Mark this task completed via TaskUpdate

global_conditions:
  - changes_committed
  - changes_pushed

workflow_id_format: "TK-{session_last_4}-{MMDD}"
---

# Task Mode

**For small tasks and chores** — combined planning + implementation in one flow.

## When to Use

- Chores (refactoring, cleanup, config, docs)
- Small features (< 3 files, < ~100 lines)
- Quick fixes (bugs, typos, edge cases)
- Work that doesn't need a full spec

## When NOT to Use

- Features needing full design → `wm enter planning`
- Complex multi-file changes → `wm enter planning`
- Bugs needing systematic investigation → `wm enter debug`
- Work spanning multiple sessions → `wm enter planning`

## Flow

```
P0: Plan (5-10 min)
    ├── Classify: chore / feature / fix
    ├── Quick context search (Explore agent)
    ├── 3-5 line scope + approach
    └── Write lightweight VP (2-4 steps)

P1: Implement
    ├── Make minimal, focused changes
    └── Verify as you go (typecheck, tests)

P2: Verify
    └── kata verify-run — fresh agent executes VP

P3: Complete
    ├── Final checks
    ├── Commit + push
    └── Close GitHub issue (if any)
```

## P2: Verification (kata verify-run)

After implementation, P2 spawns a **fresh agent** that executes the verification
plan you wrote in P0 against the real codebase.

```bash
kata verify-run --plan-file={workflow-dir}/verify-plan.md --verbose
```

### Why a fresh agent?

The implementing agent wrote the code. It has a mental model that may contain
blind spots. A fresh agent executing concrete VP steps catches issues that
in-session checks miss.

### What verify-run does

1. Reads your `verify-plan.md` file
2. Parses all `### VPn:` steps into individual tasks
3. Enters verify mode via `kata enter verify`
4. Executes each VP step literally (no modifications)
5. If any step fails: diagnoses, fixes code, re-runs (max 3 cycles)
6. Writes VP evidence JSON to `.claude/verification-evidence/`

### After verify-run

- Exit code 0 → all VP steps passed, proceed to P3 Complete
- Exit code 1 → verification failed, review output and fix

## Key Principle

**Do less, verify more.** Task mode is for focused, bounded work.
