---
initiative: workflow-history
type: project
issue_type: feature
status: draft
priority: medium
github_issue: 22
created: 2026-02-25
updated: 2026-02-25
phases:
  - id: p1
    name: "Session enumeration and data model"
    tasks:
      - "Create src/session/list.ts with listSessions() that scans sessions dir, reads state.json, returns typed array"
      - "Add HistoryEntry and HistoryFilter types to session/list.ts"
      - "Support both .kata/ and .claude/ layouts via existing getSessionsDir()"
      - "Unit tests for listSessions with mock session directories"
  - id: p2
    name: "kata history command"
    tasks:
      - "Create src/commands/history.ts with arg parsing and display logic"
      - "Register in src/index.ts dispatch and help text"
      - "Human-readable table output (default) and --json output"
      - "Filtering: --mode=, --issue=, --since=, --limit="
      - "Unit tests for arg parsing, filtering, and output formatting"
  - id: p3
    name: "Cross-project and detail views"
    tasks:
      - "Add --cwd=PATH support for inspecting other projects"
      - "Add --verbose flag showing modeHistory, phases, ledger, editedFiles"
      - "Add --session=ID for single-session deep view"
      - "Correlate verification evidence when --verbose is set"
  - id: p4
    name: "Tests and verification"
    tasks:
      - "Build + typecheck pass"
      - "All unit tests pass"
      - "Manual smoke test: run kata history in kata-wm project itself"
---

# Workflow History and Analytics

## Overview

Session state files contain rich timeline, phase completion, and work-scope data, but nothing reads it back for review. Users cannot answer "what workflows have I run?", "how long did planning take on issue #12?", or "which sessions are abandoned?". This feature adds a `kata history` command that enumerates, filters, and displays past workflow sessions.

**Why now:** As kata-wm is used across projects, the ability to inspect past workflows is essential for understanding work patterns and debugging stuck sessions.

## Feature Behaviors

### B1: Session Enumeration

**Core:**
- **ID:** session-enumeration
- **Trigger:** `kata history` (no filters)
- **Expected:** Lists all sessions in the project, sorted by most-recent first, showing: workflow ID, mode, issue number, status, start time, duration
- **Verify:** Run in kata-wm project root, see all past sessions listed

**Data Layer:**
- Scan `getSessionsDir(projectRoot)` with `readdirSync`
- For each UUID directory, read and parse `state.json` via `SessionStateSchema`
- Gracefully skip unparseable or missing state files (warn, don't crash)
- Use `statSync` mtime as fallback when `startedAt` is missing

### B2: Filtering

**Core:**
- **ID:** session-filtering
- **Trigger:** `kata history --mode=planning --issue=12 --since=2026-02-01 --limit=5`
- **Expected:** Returns only sessions matching all specified filters, ANDed together
- **Verify:** Filter by mode returns only sessions with that currentMode; filter by issue returns only matching issueNumber

**Filters:**
- `--mode=NAME` — match `currentMode` field
- `--issue=N` — match `issueNumber` field
- `--since=DATE` — sessions with `startedAt` >= date (ISO 8601 or YYYY-MM-DD)
- `--limit=N` — max results (default 20, 0 = unlimited)
- `--status=STATUS` — match derived status: active, completed, abandoned (from `modeState`)

### B3: Human-Readable Output

**Core:**
- **ID:** human-output
- **Trigger:** `kata history` (no --json flag)
- **Expected:** Compact table with columns: ID (truncated), Workflow, Mode, Issue, Status, Started, Duration
- **Verify:** Output is scannable in a terminal, durations are human-friendly ("2h 15m", "3d")

**UI Layer:**
```
ID        Workflow  Mode            Issue  Status     Started              Duration
28caca20  GH#22    planning        #22    active     2026-02-25 16:56     12m
a1b2c3d4  GH#18    implementation  #18    completed  2026-02-25 14:30     2h 15m
f5e6d7c8  FF-abc   freeform        —      abandoned  2026-02-24 10:00     45m
```

### B4: JSON Output

**Core:**
- **ID:** json-output
- **Trigger:** `kata history --json`
- **Expected:** Array of session objects with all filterable fields, suitable for piping to jq
- **Verify:** Output is valid JSON, parseable by `jq`

**API Layer:**
```json
{
  "sessions": [
    {
      "sessionId": "28caca20-...",
      "workflowId": "GH#22",
      "currentMode": "planning",
      "issueNumber": 22,
      "issueTitle": "Workflow history and analytics",
      "status": "active",
      "currentPhase": "p1",
      "completedPhases": ["p0"],
      "phases": ["p0", "p1", "p2", "p3"],
      "startedAt": "2026-02-25T16:56:24Z",
      "updatedAt": "2026-02-25T17:08:00Z",
      "workflowCompletedAt": null,
      "durationMs": 720000,
      "editedFiles": 3,
      "branch": "feat/history"
    }
  ],
  "total": 1,
  "filtered": 1
}
```

### B5: Cross-Project Inspection

**Core:**
- **ID:** cross-project
- **Trigger:** `kata history --cwd=/path/to/other/project`
- **Expected:** Lists sessions from the specified project instead of cwd
- **Verify:** Run from kata-wm, inspect sessions in a different kata project

**Implementation:**
- Reuse `--cwd=PATH` pattern from `batteries.ts`, `setup.ts`, `teardown.ts`
- Override `findProjectDir()` result with explicit path
- Validate target has `.kata/` or `.claude/sessions/` layout

### B6: Verbose Detail View

**Core:**
- **ID:** verbose-detail
- **Trigger:** `kata history --verbose` or `kata history --session=ID`
- **Expected:** Shows full session detail: all modeHistory entries with timestamps, phase list, edited files, ledger entries, verification evidence (if exists)
- **Verify:** Single-session view shows complete timeline of mode transitions

**UI Layer (single session):**
```
Session: 28caca20-0fe7-479d-a7c9-d537502895c1
Workflow: GH#22 — Workflow history and analytics (#22)
Mode: planning (active)
Branch: feat/history

Timeline:
  16:56:24  Entered planning
  16:56:24  Phase p0 started
  17:02:00  Phase p0 completed
  17:02:01  Phase p1 started (current)

Phases: p0 ✓  p1 ◉  p2 ○  p3 ○

Edited files (3):
  src/commands/history.ts
  src/session/list.ts
  src/index.ts

Ledger:
  Decisions: (none)
  Discoveries: (none)
```

## Non-Goals

- **Real-time monitoring** — no watch mode or live dashboard
- **Cross-project aggregation** — `--cwd` inspects one project at a time, no multi-project rollup
- **Session modification** — history is read-only, no editing/deleting sessions
- **Performance optimization** — no caching or indexing; direct file reads are fine for expected session counts (tens to low hundreds)
- **Export formats** — no CSV, HTML, or chart generation; `--json` + `jq` covers programmatic use

## Implementation Phases

Defined in frontmatter `phases` field above. Summary:

- **P1**: Core data layer — `listSessions()` in `src/session/list.ts`, types, both layouts, tests
- **P2**: Command — `src/commands/history.ts`, CLI dispatch, table + JSON output, filtering, tests
- **P3**: Cross-project + detail — `--cwd`, `--verbose`, `--session=ID`, verification correlation
- **P4**: Verification — build, typecheck, all tests, manual smoke test
