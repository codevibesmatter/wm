---
id: micro-planning
name: Micro-Planning Mode
description: Lightweight planning for tasks/chores - context search → quick spec (10-15 min)
mode: micro-planning
workflow_prefix: MP

phases:
  # Phase 0: Context Search (quick research)
  - id: p0
    name: Context Search
    task_config:
      title: "P0: Context - Gemini :explore or quick search"
      labels: [phase, phase-0, context, micro-planning]
    todoActiveForm: "Searching for context"
    steps:
      - id: quick-research
        title: "Quick context search"
        instruction: |
          **Option A: Gemini CLI (recommended)**
          ```bash
          pnpm at gemini :explore "{task_description}"
          ```
          Returns: similar code, rules, episodic memory in ~30 sec.

          **Option B: Manual quick search**
          - Check episodic memory: `pnpm at em search "{keywords}"`
          - Grep for similar patterns: `Grep("pattern", path="apps/")`

          **Skip if:** Task is obvious, you know exactly what to do.

          Then: Mark this task completed via TodoWrite

  # Phase 1: Quick Questions (1-2 max, often skip)
  - id: p1
    name: Quick Questions
    task_config:
      title: "P1: Questions - 1-2 max if genuinely unclear"
      labels: [phase, phase-1, questions, micro-planning]
      depends_on: [p0]
    todoActiveForm: "Asking quick clarifications"
    optional: true
    steps:
      - id: ask-if-needed
        title: "Ask ONLY if genuinely unclear"
        instruction: |
          **Most tasks don't need questions. Skip if clear.**

          Only ask if:
          - Multiple valid approaches exist
          - Scope is ambiguous
          - Missing critical context

          **If asking, 1-2 questions MAX:**
          ```
          AskUserQuestion(questions=[
            {question: "...", header: "Approach", options: [...]}
          ])
          ```

          Then: Mark this task completed via TodoWrite

  # Phase 2: Quick Spec (YOU write directly)
  - id: p2
    name: Quick Spec
    task_config:
      title: "P2: Spec - write quick spec directly (NO agent spawn)"
      labels: [phase, phase-2, spec, micro-planning]
      depends_on: [p1]
    todoActiveForm: "Writing quick spec"
    evidence:
      - type: file_exists
        pattern: 'planning/specs/*-*.md'
        message: "Spec file not created"
    steps:
      - id: write-spec
        title: "Write quick spec (YOU do this)"
        instruction: |
          ✅ For micro-planning, YOU write the spec directly.
          ⛔ Do NOT spawn spec-writer agent.

          **Create spec file:**
          ```bash
          ISSUE_NUM=$(pnpm wm link --show 2>/dev/null | grep -o '#[0-9]*' | tr -d '#' || echo "000")
          SLUG=$(echo "{task_title}" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | cut -c1-40)
          cp planning/templates/spec/quick-task.template.md "planning/specs/${ISSUE_NUM}-${SLUG}.md"
          ```

          **Fill template (~30 lines):**

          ## What
          [1-2 sentences: what needs to be done]

          ## Why
          [1 sentence: why this is needed]

          ## Implementation Steps
          1. [ ] Step 1: [Specific action with file path]
          2. [ ] Step 2: [Specific action with file path]
          3. [ ] Step 3: [Specific action with file path]

          ## Acceptance Criteria
          - [ ] [Observable outcome 1]
          - [ ] [Observable outcome 2]

          ## Verification
          ```bash
          pnpm typecheck
          # Manual check: [what to look for]
          ```

          ## Files to Change
          | File | Change |
          |------|--------|
          | `path/to/file.ts` | [What to change] |

          Then: Mark this task completed via TodoWrite

  # Phase 3: Sync
  - id: p3
    name: Sync
    task_config:
      title: "P3: Sync - commit and push"
      labels: [phase, phase-3, sync, micro-planning]
      depends_on: [p2]
    todoActiveForm: "Syncing changes"
    steps:
      - id: sync-changes
        title: "Commit and push"
        instruction: |
          ```bash
          git add planning/specs/*.md
          git commit -m "docs: add quick spec for {task}"
          git push
          ```

          Optional: Comment on GitHub issue
          ```bash
          gh issue comment {issue} --body "Quick spec: planning/specs/{file}.md"
          ```

          Then: Mark this task completed via TodoWrite

global_conditions:
  - changes_committed
  - changes_pushed

---

# Micro-Planning Mode

Lightweight planning for tasks, chores, and small changes. Use instead of full planning when:
- Task is well-understood
- Single file or small scope
- Clear requirements
- < 1 day estimated work

## What's Different from Full Planning

| Full Planning | Micro-Planning |
|---------------|----------------|
| 6 interview rounds | 1-2 questions max |
| Spawn spec-writer agent | Write spec yourself |
| Codex review gate | Skip Codex |
| ~1 hour | ~10-15 min |

## Native Tasks

**Tasks are auto-created when you enter micro-planning mode via `pnpm wm enter micro-planning`.**

Native tasks use Claude Code's built-in task system at `~/.claude/tasks/{session-id}/`.

**Check tasks:**
```bash
# Use TaskList tool to see all tasks
# Use TaskGet to get task details
# Use TaskUpdate to mark tasks in_progress or completed
```

## When to Use

| Signal | Micro-Planning | Full Planning |
|--------|----------------|---------------|
| Issue type: task/chore | ✅ | |
| Issue type: feature/epic | | ✅ |
| "Fix X", "Add Y to Z" | ✅ | |
| "Build new X system" | | ✅ |
| < 1 day | ✅ | |
| > 1 day | | ✅ |

## Commands

```bash
pnpm wm enter micro-planning    # or just: pnpm wm enter micro
pnpm wm status               # Check current mode and phase
pnpm wm can-exit             # Check stop conditions
```
