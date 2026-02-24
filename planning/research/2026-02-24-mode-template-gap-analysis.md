---
date: 2026-02-24
topic: Mode template gap analysis — old baseplane vs current kata-wm
status: complete
github_issue: null
---

# Research: Mode Template Gap Analysis

## Context

kata-wm was extracted from baseplane's `@baseplane/wm` package and genericized. During the transition, mode templates were stripped down significantly. This research compares the old baseplane mode templates (`reference/workflow-management/templates/`) with the current kata-wm batteries (`batteries/templates/`) to identify what was lost and what should be restored.

## Reference Files

| Old (baseplane) | Current (kata-wm) |
|---|---|
| `reference/workflow-management/templates/planning-feature.md` | `batteries/templates/planning.md` |
| `reference/workflow-management/templates/implementation-feature.md` | `batteries/templates/implementation.md` |
| `reference/workflow-management/templates/implementation-bugfix.md` | `batteries/templates/debug.md` |
| `reference/workflow-management/templates/research.md` | `batteries/templates/research.md` |
| `reference/workflow-management/templates/task.md` | `batteries/templates/task.md` |
| `reference/workflow-management/modes.yaml` | `modes.yaml` |
| `reference/baseplane-config/.claude/templates/` | `planning/spec-templates/` |

## Findings

### 1. Planning Mode — Interview System (CRITICAL GAP)

The old planning template had **9+ phases with 3 dedicated interview rounds**. The current has 4 phases with no structured interviews.

**Old phases (planning-feature.md, ~800+ lines of YAML frontmatter):**

| Phase | Description |
|-------|-------------|
| P0: Issue Creation | Conditional — AskUserQuestion for issue type/title, creates via CLI |
| P1: Research | Spawns agent for deep codebase search (similar code, rules, episodic memory, primitives audit, gap analysis) |
| **P1.5: Interview — Requirements** | Multi-round AskUserQuestion: user journey, happy path, scope IN/OUT, empty state, scale (10K records), concurrent edits |
| **P1.6: Interview — Architecture** | Multi-round AskUserQuestion: notifications, real-time sync, permissions, loading states, error handling, component location, backend ownership, DB changes |
| **P1.7: Interview — Design & Testing** | Multi-round AskUserQuestion: test scenarios (happy path, error paths, edge cases, UI testing), design system (reference page, layout component, reused components), ASCII mockups (4 states minimum), iterative mockup review (2-4 iterations per state) |
| **P1.8: GATE — Requirements Approval** | Compiles summary, waits for explicit user "approve" before proceeding |
| P2: Spec Writing | Spawns `spec-writer` agent — orchestrator does NOT write spec itself |
| P2.4: Theory & Primitives Impact | Spawns Explore agent to cross-reference spec against project doctrine. User decides: update now / defer / cherry-pick |
| P3: Review | Quality gate review, thoroughness check, human approval |
| P4: Breakdown | Task generation from spec |

**Current phases (planning.md, ~280 lines total):**

| Phase | Description |
|-------|-------------|
| P0: Research | AskUserQuestion (feature type + GitHub issue), spawns Explore agent |
| P1: Spec Writing | Create spec file, write behaviors, extract patterns, link issue |
| P2: Review | Completeness checklist, spawn review agent |
| P3: Finalize | Mark approved, commit, push |

**What's missing:**
- The entire interview system (P1.5, P1.6, P1.7) — 3 phases of structured AskUserQuestion rounds
- Requirements approval gate (P1.8) — explicit user sign-off before spec writing
- Orchestrator pattern — old spawned a spec-writer agent; current writes directly
- ASCII mockup generation with iterative user review
- Theory/primitives impact assessment (baseplane-specific concept, but the generic idea of cross-referencing against project docs is valuable)

**Why it matters:** Without the interview phases, the agent skips from codebase research straight to spec writing. The spec ends up reflecting the agent's assumptions rather than the user's actual requirements. The interviews forced the agent to ask about edge cases, scale, error handling, and UX before writing anything.

### 2. Implementation Mode — Quality Gates (SIGNIFICANT GAP)

**Old subphase pattern:** IMPL → CODEX → VERIFY (3 steps per spec phase)
**Current subphase pattern:** IMPL → VERIFY (2 steps per spec phase)

The CODEX step was a quality review between implementation and verification. This is baseplane-specific (used their Codex CLI), but the *concept* of a review gate between impl and verify is generic.

**Anti-cheat verification (completely generic, dropped):**

The old template required these checks before completing any task:

```
1. git status → "nothing to commit, working tree clean"
2. git log --oneline -5 → recent commits exist
3. git status -sb → no "ahead" message (pushed)
4. pnpm typecheck → no errors
```

This prevented the agent from marking tasks done without actually committing work. The current template has no equivalent enforcement.

**Old also had:**
- Baseline screenshots before changes (project-specific)
- Doc sync phase after implementation (project-specific)
- Spawned impl-agent for code work; orchestrator only coordinated (architectural choice)

### 3. Debug/Bugfix Mode — Deprecated But Template Exists (CONTRADICTORY)

`batteries/templates/debug.md` exists and is well-designed (hypothesis-driven, 4 phases: reproduce → investigate → fix → verify). However, `modes.yaml` marks the mode as:

```yaml
debug:
  deprecated: true
  redirect_to: "research"
```

This is contradictory — the debug template has a completely different workflow from research. Research is about exploration and documenting findings. Debug is about reproducing, root-causing, and fixing.

**Old bugfix template had additional depth:**

| Feature | Old | Current debug.md |
|---------|-----|-------------------|
| Context search (episodic memory, git history, related issues) | P0 — mandatory first step | Not present |
| "Understand system" phase — read full code paths before fixing | P1 — explicit phase | Folded into P1 investigate |
| TDD enforcement — RED/GREEN explicit steps | P3 — write failing test, then fix | P2 — mentioned but not structured as TDD steps |
| Anti-patterns table — blocked behaviors with correct alternatives | Full table in template body | Not present |
| Primitives check — "can config change fix this?" | P3 — explicit step | Not present (baseplane-specific) |

### 4. Research Mode — Translated Well

Old and current are structurally similar: clarify → scope → codebase (parallel agents) → external → synthesize → present. The old had an episodic memory search agent as an extra step. Current is slightly cleaner. **No significant gaps.**

### 5. Task Mode — Translated Well

Old and current are structurally similar: quick plan → implement → complete. The old referenced episodic memory and project-specific commands. Current is appropriately generic. **No significant gaps.**

### 6. modes.yaml — Consolidation Losses

**15 active modes → 6 core + 12 deprecated redirects.**

The consolidation was mostly appropriate (doctrine, feature-clarification, micro-planning, strategic were baseplane-specific). But two modes shouldn't have been deprecated:

| Mode | Redirected to | Why it should be first-class |
|------|---------------|------------------------------|
| `debug` | research | Completely different workflow — reproduce/investigate/fix vs explore/synthesize |
| `bugfix` | implementation | Investigation-first flow with TDD — not just "execute a spec" |

**Also stripped from modes.yaml:**
- `context_signals` — project-specific path references, but the mechanism itself is generic
- `red_flags` section — entirely generic ("This is simple, I don't need a mode" → "Enter mode anyway")
- Richer `never_ask` entries — e.g., "Are you sure you want to implement?" → "Yes, that's why they said implement"

### 7. Spec Templates — Adequate But Less Structured

kata-wm has 3 spec templates (`planning/spec-templates/`): feature.md, epic.md, bug.md.
Baseplane had 7 (`reference/baseplane-config/.claude/templates/`): full-stack.md, backend-only.md, frontend-only.md, infrastructure.md, epic.md, milestone.md, research.md.

The kata feature.md covers the core structure (behaviors with trigger/expected/verify, UI/API/Data layers, phases with test_cases). What's missing vs baseplane's full-stack.md:

- **Similar Feature Analysis** per section — "find the most similar existing feature" before designing new
- **Verification gates per phase** — structured checklists gating phase transitions
- **TDD dependency graphs** — visual BASELINE → TEST → IMPL → VERIFY per phase
- **Infrastructure template** — CI/CD, migration, rollback plans (completely generic)
- **Milestone template** — release/sprint grouping epics (completely generic)

## Recommendations

### Priority 1: Restore interview system to planning template

Add P1.5/P1.6/P1.7-style interview phases to `batteries/templates/planning.md`. Make them generic (not baseplane-specific):

- **Requirements interview:** problem statement, happy path, scope boundaries, edge cases (empty state, scale, concurrency)
- **Architecture interview:** integration points, error handling, performance expectations, technical decisions
- **Design & testing interview:** test scenarios, UI reference pages, mockup iterations
- **Requirements approval gate** before spec writing begins

These should use AskUserQuestion with generic options (not baseplane-specific like "VibeGrid" or "orgProcedure").

### Priority 2: Un-deprecate debug mode

Remove `deprecated: true` and `redirect_to: "research"` from the `debug` entry in `modes.yaml`. The template already exists at `batteries/templates/debug.md` and is good. Just needs to be a first-class mode.

Consider also un-deprecating `bugfix` as a separate mode from debug (debug = investigation only, bugfix = investigate + fix), or merging the concepts into a single `debug` mode that includes the fix phase (which the current template already does).

### Priority 3: Add anti-cheat verification to implementation template

Add explicit git-status / git-log / typecheck checks before task completion in `batteries/templates/implementation.md`. This is completely generic:

```yaml
- id: anti-cheat
  title: "Verify before completing"
  instruction: |
    BEFORE completing any IMPL task:
    1. git status → working tree clean (changes committed)
    2. git log --oneline -3 → commits exist for this work
    3. Run project build/typecheck command → passes

    Do NOT mark task complete without evidence.
```

### Priority 4: Add REVIEW subphase to implementation

Restore the 3-step pattern: IMPL → REVIEW → VERIFY. The REVIEW step doesn't need to be Codex-specific — it can be a self-review or spawned review agent checking code quality before behavioral verification.

### Priority 5: Restore red_flags to modes.yaml

Generic, universally useful:

```yaml
red_flags:
  - pattern: "This is simple, I don't need a mode"
    correction: "Enter mode anyway"
  - pattern: "I'll just answer quickly"
    correction: "Mode first"
  - pattern: "The user didn't ask for a mode"
    correction: "YOU decide based on intent"
```

### Priority 6: Add infrastructure and milestone spec templates

Both are completely generic, no project-specific content:
- `planning/spec-templates/infrastructure.md` — CI/CD, migrations, rollback, secrets, staging verification
- `planning/spec-templates/milestone.md` — release/sprint grouping multiple epics

### Priority 7: Add PreCompact hooks for context preservation

Long sessions lose mode context after compaction. Two hooks needed:
- **save-notes** — persist key findings/decisions to a session notes file before compaction wipes context
- **context re-injection** — re-inject current mode, phase, and workflow state into the post-compaction context

These are entirely generic and critical for session reliability. Without them, an agent working through a 10-phase implementation can forget what phase it's on after compaction.

### Priority 8: Add TDD enforcement hook

PreToolUse hook on Edit|Write during implementation phases. Before allowing edits to non-test files, check that corresponding test files exist or that tests were written first in the current phase. Configurable — could be opt-in via a `tdd_enforcement: true` field in modes.yaml or wm.yaml.

### Lower Priority

- Add "Similar Feature Analysis" prompts to feature spec template
- Add verification gate checklists to spec template phases
- Restore `context_signals` mechanism to modes.yaml (genericized)
- Consider adding a generic "review gate" concept (quality check between phases, not Codex-specific)
- Add PostToolUse tracker for session analytics and anti-cheat support
- Add SubagentStop review hook for quality-checking spawned agent output
- Add SessionEnd cleanup hook for state hygiene

### 8. Hook Architecture — Missing Enforcement Layers (SIGNIFICANT GAP)

kata-wm registers 4 hook events by default (6 with `--strict`). Baseplane registered 8 hook events with ~12 individual hook handlers. The mode-gate hook exists in kata-wm and works correctly — it blocks Edit/Write/NotebookEdit when no mode is entered. But several other enforcement hooks were dropped.

**Baseplane hooks (`reference/baseplane-config/.claude/settings.json`):**

| Hook Event | Handlers | Description |
|------------|----------|-------------|
| SessionStart | 2: session-start, startup-context | Init session + inject mode context |
| UserPromptSubmit | 1: user-prompt | Detect mode intent, suggest entering |
| PreToolUse | 4: mode-gate, TDD (Edit\|Write), task-deps (TaskUpdate), task-evidence (TaskUpdate) | Enforce mode entry, TDD discipline, task dependency ordering, evidence gathering |
| PostToolUse | 1: tracker | Track tool usage patterns across session |
| PreCompact | 2: save-notes, startup-context | Save episodic notes before compaction, re-inject startup context |
| Stop | 2: workflow-verify, episodic-sync | Verify workflow complete, sync episodic memory |
| SubagentStop | 1: review | Review subagent work quality |
| SessionEnd | 1: cleanup | Session cleanup and sync |

**kata-wm hooks (`src/commands/setup.ts` + `src/commands/hook.ts`):**

| Hook Event | Handlers | Description |
|------------|----------|-------------|
| SessionStart | 1: session-start | Init session, inject mode context |
| UserPromptSubmit | 1: user-prompt | Detect mode intent, suggest entering |
| PreToolUse | 1: mode-gate (default); +2 with `--strict`: task-deps, task-evidence | Block edits without mode; strict adds task ordering + evidence |
| Stop | 1: stop-conditions | Check native task completion + stop conditions |

**What's missing from kata-wm:**

| Hook | Genericizable? | Value |
|------|---------------|-------|
| **TDD enforcement** (PreToolUse on Edit\|Write) | Yes — check that tests exist/pass before allowing non-test file edits | Forces test-first discipline during implementation |
| **PostToolUse tracker** | Yes — log tool usage to session state | Enables session analytics, anti-cheat (verify work was done) |
| **PreCompact save-notes** | Yes — persist key findings before context compaction | Prevents knowledge loss on long sessions |
| **PreCompact context re-injection** | Yes — re-inject mode context after compaction | Prevents mode amnesia on long sessions |
| **SubagentStop review** | Yes — quality check spawned agent output | Catches low-quality subagent work before it's accepted |
| **SessionEnd cleanup** | Yes — cleanup temp files, sync state | Prevents state rot across sessions |
| **Stop workflow-verify** | Partially covered — kata's stop-conditions check native tasks but not full workflow verification | Old had more thorough exit checks |

**Most impactful missing hooks:**
1. **PreCompact context re-injection** — Without this, long sessions lose mode context after compaction. The agent "forgets" what mode it's in and what phase it's on. This is a reliability issue for any non-trivial session.
2. **TDD enforcement** — The old system blocked non-test edits during impl phases if tests weren't written first. This was a core quality mechanism.
3. **PostToolUse tracker** — Enables the anti-cheat verification pattern (Priority 3 in recommendations). Without tracking, you can't verify work was actually done.

**Note:** The mode-gate hook IS present and working in kata-wm. It correctly blocks Edit/Write/NotebookEdit when `state.currentMode === 'default'` or undefined. Registered as a default PreToolUse hook (not behind `--strict`).

## Open Questions

- Should the interview rounds be mandatory or skippable? Old system made them mandatory with a gate. Could add `gate: false` for lighter projects.
- Should implementation spawn impl-agents or do work directly? Old used orchestrator pattern; current does work directly. Both are valid — orchestrator is safer but slower.
- Should we add a generic "project doctrine" concept (equivalent to baseplane's theory/primitives) that the planning template cross-references? Or is that too opinionated for a generic tool?
- Should TDD enforcement be default or opt-in? Baseplane made it mandatory. For a generic tool, `tdd_enforcement: true` in wm.yaml might be better than forcing it on all projects.
- How should PreCompact context re-injection work? The old system re-ran the startup-context hook. kata-wm could either re-run session-start or have a dedicated compact hook that reads session state and re-injects the mode/phase/task context.
