---
id: orchestrator
name: Multi-Agent Orchestrator
description: Coordinate multiple Claude Code sessions across worktrees via CC Gateway
mode: orchestrator
standalone: true

phases:
  - id: p0
    name: Setup
    task_config:
      title: "P0: SETUP - verify gateway, identify worktrees"
      labels: [phase, phase-0, setup]
      blocking: true
    conditions:
      - gateway_healthy
      - worktrees_identified

  - id: p1
    name: Spawn
    task_config:
      title: "P1: SPAWN - create sessions on target worktrees"
      labels: [phase, phase-1, spawn]
      depends_on: [p0]
    conditions: []

  - id: p2
    name: Collect
    task_config:
      title: "P2: COLLECT - gather results from sessions"
      labels: [phase, phase-2, collect]
      depends_on: [p1]
    conditions:
      - all_sessions_complete

  - id: p3
    name: Cleanup
    task_config:
      title: "P3: CLEANUP - delete finished sessions"
      labels: [phase, phase-3, cleanup]
      depends_on: [p2]
    conditions:
      - sessions_cleaned

global_conditions:
  - all_sessions_complete

workflow_id_format: "OR-{session_last_4}-{MMDD}"
---

# Multi-Agent Orchestrator

Coordinate multiple Claude Code sessions across worktrees via the CC Gateway API.

## Commands

All orchestration uses `pnpm at cc`:

```bash
pnpm at cc status                         # Gateway health + worktree availability
pnpm at cc worktrees                      # List worktrees (idle/busy)
pnpm at cc run <worktree> "prompt"        # Create session, stream output
pnpm at cc sessions [--running]           # List sessions
pnpm at cc session <id>                   # Session details (short IDs ok)
pnpm at cc resume <id> "prompt"           # Resume with new prompt
pnpm at cc abort <id>                     # Abort running session
pnpm at cc delete <id>                    # Delete finished session
```

Run options: `--model=M`, `--max-turns=N`, `--max-budget=USD`, `--quiet`

## Phase 0: Setup

Verify gateway and pick worktrees:

```bash
pnpm at cc status
pnpm at cc worktrees
```

## Phase 1: Spawn

**Sequential cascade** — output feeds the next:
```bash
pnpm at cc run dev3 "Review MODULE-coi.md against the framework checklist. Output gaps."
# read result, then:
pnpm at cc run dev1 "Fix these gaps: [gaps]. Create a PR."
pnpm at cc run dev2 "Review PR #NNN. Run tests. Report pass/fail."
```

**Parallel fan-out** — independent tasks across worktrees:
```bash
pnpm at cc run dev1 "implement auth migration in gateway" &
pnpm at cc run dev2 "update integration tests for new auth" &
pnpm at cc run dev3 "update documentation for auth changes" &
wait
```

## Phase 2: Collect

```bash
pnpm at cc sessions
pnpm at cc session <id1>
pnpm at cc session <id2>

# Follow up if needed
pnpm at cc resume <id> "now fix the failing test"
```

## Phase 3: Cleanup

```bash
pnpm at cc delete <id>
```

## Patterns

| Pattern | Description | Example |
|---------|-------------|---------|
| Sequential Cascade | One session's output triggers the next | Compiler → Impl → Test → Docs |
| Parallel Fan-Out | Single trigger, multiple worktrees | Decision → dev1, dev2, dev3 in parallel |
| Watch + React | Monitor, spawn on events | New bug → `at cc run dev6 "investigate #N"` |

## Constraints

- One active session per worktree (gateway-enforced)
- 8 worktrees: baseplane, dev1-dev6, baseplane-infra
- Use `--max-budget` for unattended sessions
- Gateway must be running (systemd `baseplane-cc-gateway`, port 9877)

## Stop Condition

Session cannot end until all spawned sessions are completed or aborted.
