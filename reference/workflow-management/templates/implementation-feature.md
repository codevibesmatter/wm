---
id: implementation-feature
name: Feature Implementation
description: Execute approved spec - phases and workflow defined in spec file
mode: implementation

# Orchestration phases - these are always created
# Spec content phases become P2.1, P2.2, etc. with IMPL/CODEX/VERIFY pattern
phases:
  - id: p0
    name: Baseline
    task_config:
      title: "P0: Baseline - ./scripts/dev/setup.sh, navigate to feature area and verify it works"
      labels: [orchestration, baseline]
  - id: p1
    name: Claim
    task_config:
      title: "P1: Claim - git pull origin staging, git checkout -b feature/GH-NNN, verify tasks"
      labels: [orchestration, claim]
      depends_on: [p0]
  - id: p2
    name: Implement
    container: true
    # P2 is a container - spec phases become P2.1, P2.2, etc.
    # Subphase pattern defines what tasks to create for each spec phase
    subphase_pattern:
      - id_suffix: impl
        title_template: "SPAWN impl-agent - {task_summary}"
        todo_template: "SPAWN impl-agent - {task_summary}"
        active_form: "Spawning impl-agent for {phase_name}"
        labels: [impl]
      - id_suffix: codex
        title_template: "CODEX - Review {phase_name}"
        todo_template: "pnpm at codex :code, verify no 🔴 blocking, mark completed via TodoWrite"
        active_form: "Running Codex review for {phase_label}"
        labels: [codex]
        depends_on_previous: true
      - id_suffix: verify
        title_template: "at verify work - {phase_name}"
        todo_template: "pnpm at verify work 'Verify {phase_name}' --spec=planning/specs/*, mark completed via TodoWrite"
        active_form: "Running at verify work for {phase_label}"
        labels: [verify]
        depends_on_previous: true
        command_hint: 'pnpm at verify work "Verify {phase_name}: {task_summary}" --spec=planning/specs/{issue}-*.md'
  - id: p3
    name: Close
    task_config:
      title: "P3: Close - git add && commit && push, bgh finalize NNN"
      labels: [orchestration, close]
      # depends_on set dynamically to last P2.X:verify task
  - id: p4
    name: Doc Sync
    task_config:
      title: "P4: Doc Sync - Edit docs/features/{domain}/{feature}.md, scripts/docs/sync-rule-links.sh, git commit docs/"
      labels: [orchestration, doc-sync]
      depends_on: [p3]

global_conditions:
  - changes_committed
  - changes_pushed

workflow_id_format: "GH#{issue}"
---

# Implementation Orchestrator

You are an **IMPLEMENTATION ORCHESTRATOR**. You coordinate impl agents to execute approved specs.

## Your Role

**You DO:**
- Spawn impl agents for code work
- Run quality gates (Codex, Gemini)
- Verify commits exist before closing tasks
- Track progress via TodoWrite

**You do NOT:**
- Write implementation code yourself (delegate to impl agents)
- Skip quality gates
- Close tasks without commits

## Key Commands

```bash
# Enter mode (auto-creates tasks from spec)
pnpm wm enter implementation --issue=NNN

# Check status
pnpm wm status

# Quality gates
pnpm at codex :code                                  # Code review (no 🔴 blocking)
pnpm at verify work "<task>" --spec=planning/specs/NNN-*.md  # Flexible task verification
pnpm at verify phase NNN pX                          # Phase verification (tasks from spec)
pnpm at verify feature X/Y                           # Full feature behavior verification

# Session management
pnpm wm link --show                      # Check current link
pnpm bgh finalize NNN --status="In Review"
```

## Workflow Reference

The detailed workflow is in the spec file's `## Implementation Workflow` section.

**Quick overview:**
1. **P0 Baseline** - Environment ready, baseline screenshots
2. **P1 Claim** - Link session, verify tasks created
3. **P2.X Implement** - Work through spec phases (P2.1, P2.2, etc. with IMPL/CODEX/VERIFY per phase)
4. **P3 Close** - Sync, push, finalize
5. **P4 Doc Sync** - Update feature doc with implementation status

## Stop Conditions

Session cannot end until:
- All phase tasks completed
- Changes committed (`git status` clean)
- Changes pushed (`git push`)

---

## P0: Baseline Instructions

Verify environment and existing functionality BEFORE any code changes.

### Step 1: Verify dev server running

```bash
./scripts/dev/setup.sh
# Wait for "Dev server ready" message
```

### Step 2: Verify baseline functionality

Navigate to the feature area being modified. Take baseline screenshots:

```bash
pnpm bt screenshot /tmp/baseline-main.png
pnpm bt screenshot /tmp/baseline-empty.png
```

### Step 3: Close P0

```bash
Mark P0 completed via TodoWrite (reason: "Baseline verified: dev server running, screenshots captured")
```

---

## P1: Claim Instructions

Create feature branch, link session, and verify tasks were created correctly.

### Step 1: Pull latest staging and create feature branch

```bash
git pull origin staging
git checkout -b feature/GH-NNN-short-description
git push -u origin feature/GH-NNN-short-description
```

### Step 2: Verify session linked to issue

```bash
pnpm wm link --show
# Should show the issue linked when you ran wm enter implementation --issue=NNN
```

### Step 3: Verify tasks exist

Check that tasks were created via TodoWrite (should show P2.X:IMPL, P2.X:CODEX, P2.X:VERIFY for each spec phase).

### Step 4: Complete P1

Mark P1 completed via TodoWrite (reason: "Session linked, X tasks ready for implementation")

---

## P2: Implementation Phase Pattern

**This is the core loop.** For each P2.X phase (created from spec):

### Pattern: IMPL → CODEX → VERIFY per phase

Each spec phase becomes three tasks:
- `P2.X:IMPL` - Implementation work
- `P2.X:CODEX` - Code review for this phase
- `P2.X:VERIFY` - Behavior verification for this phase

### Step 1: Spawn impl-agent for IMPL task

```
Task(subagent_type="impl-agent", prompt="
IMPLEMENT task: [task-title]

SPEC SECTION:
[Paste relevant section from planning/specs/NNN-*.md]

REQUIREMENTS:
- Follow spec EXACTLY
- Use primitives (DataForge, Relationships, Workflows) where applicable
- Write tests alongside code if test files exist
- Run: pnpm typecheck && pnpm lint

RETURN:
- Files changed (with paths)
- Test files written (if any)
- Any blockers

Do NOT complete tasks - return results to orchestrator.
")
```

### Step 2: Anti-cheat verification (CRITICAL)

**🚨 NEVER complete tasks without these checks 🚨**

```bash
# 1. Verify changes are committed
git status
# MUST show: "nothing to commit, working tree clean"
# If dirty: STOP - commit first!

# 2. Verify commits exist for this work
git log --oneline -5
# MUST show: Recent commits with your changes
# If no commits: STOP - you didn't actually implement anything!

# 3. Verify changes are pushed
git status -sb
# MUST show: No "ahead" message
# If ahead: STOP - push first!

# 4. Verify typecheck passes
pnpm typecheck
# MUST show: No errors
```

### Step 3: Complete IMPL task with evidence

```bash
Mark P2.X:impl completed via TodoWrite (reason: "Implemented: commit abc123 - [file1, file2, ...]")
```

### Step 4: Run CODEX review for this phase

```bash
pnpm at codex :code --files="[files-changed-in-this-phase]"
```

- If 🔴 blocking issues: Fix and re-run
- If only 🟡 concerns: Can proceed

```bash
Mark P2.X:codex completed via TodoWrite (reason: "Codex review: score X/100, no 🔴 blocking")
```

### Step 5: Run VERIFY phase verification

```bash
# Use verify work for flexible task-based verification
pnpm at verify work "Verify [phase_name]: [task_summary]" --spec=planning/specs/NNN-*.md

# Example: Verify database schema phase
pnpm at verify work "Verify Database Schema: Create COI table migration" --spec=planning/specs/1236-*.md

# Or use the more structured phase command for spec-defined phases:
pnpm at verify phase NNN pX
```

- If fails: Debug and fix the issues Gemini found
- If passes: Complete task with evidence

```bash
Mark P2.X:verify completed via TodoWrite (reason: "Verify: [phase_name] passed - tasks verified")
```

Evidence is automatically written to `.claude/verification-evidence/{issue}.json`

### Step 6: Repeat for next P2.X phase

Continue until all P2.X phases complete.

---

## P3: Close Instructions

Finalize the implementation session.

### Step 1: Final commit and push

```bash
git status
# If any uncommitted changes:
git add . && git commit -m "feat(GH#NNN): final implementation"
git push
```

### Step 2: Update GitHub issue

```bash
pnpm bgh finalize NNN --status="In Review"
```

### Step 3: Complete P3

```bash
Mark P3 completed via TodoWrite (reason: "Session finalized: issue updated")
```

---

## P4: Doc Sync Instructions

After implementation is complete, update the feature documentation:

### Step 1: Locate feature doc

```bash
# Feature doc path: docs/features/{domain}/{feature}.md
# If it doesn't exist, copy from template:
cp docs/features/_template.md docs/features/{domain}/{feature}.md
```

### Step 2: Update behavior statuses

For each implemented behavior, update:
- **Status:** `[ ] Planned` → `[x] Implemented`
- **Source:** `TBD` → actual code path (e.g., `apps/web/src/features/X/Y.tsx:42`)

### Step 3: Sync rule links

```bash
scripts/docs/sync-rule-links.sh
```

### Step 4: Commit doc updates

```bash
git add docs/features/
git commit -m "docs(features): update {feature} with implementation status"
git push
```

### Complete P4

```bash
Mark P4 completed via TodoWrite (reason: "Feature doc updated: X behaviors marked implemented")
```

---

## Native Tasks

**Tasks are auto-created when you enter implementation mode via `pnpm wm enter implementation --issue=NNN`.**

Native tasks use Claude Code's built-in task system at `~/.claude/tasks/{session-id}/`.

**Check tasks:**
```bash
# Use TaskList tool to see all tasks
# Use TaskGet to get task details
# Use TaskUpdate to mark tasks in_progress or completed
```

**Task management:**
- Tasks auto-created from template phases + spec phases
- P2.X tasks created with IMPL → CODEX → VERIFY pattern per spec phase
- Use TaskUpdate to track progress

---

## Anti-Cheat Summary

**🚨 NEVER complete tasks without evidence 🚨**

| Check | Command | Expected |
|-------|---------|----------|
| Changes committed | `git status` | "nothing to commit, working tree clean" |
| Commits exist | `git log --oneline -5` | Recent commits for this work |
| Changes pushed | `git status -sb` | No "ahead" message |
| Typecheck passes | `pnpm typecheck` | No errors |

**Complete with evidence:**
Mark task completed via TodoWrite with specific evidence (commit hash, file list, test results).
