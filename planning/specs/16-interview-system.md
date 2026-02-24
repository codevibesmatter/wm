---
initiative: interview-system
type: project
issue_type: feature
status: approved
priority: high
github_issue: 16
created: 2026-02-24
updated: 2026-02-25
phases:
  - id: p1
    name: "Interview data file and loading"
    tasks:
      - "Create batteries/interviews.yaml with generic categories"
      - "Add interviews.yaml to scaffold-batteries.ts copy targets"
      - "Create interview config loader with 2-tier merge (package → project)"
      - "Add Zod schema for interview categories and rounds"
  - id: p2
    name: "Planning template integration"
    tasks:
      - "Rewrite batteries/templates/planning.md to include interview phases between Research and Spec Writing"
      - "Interview phases reference categories from interviews.yaml"
      - "Add requirements approval step after interviews, before spec writing"
  - id: p3
    name: "Onboard integration"
    tasks:
      - "Add interview customization step to onboard template custom path"
      - "Step presents default categories, lets user add/remove/modify"
  - id: p4
    name: "Tests and verification"
    tasks:
      - "Unit tests for interview config loader and merge"
      - "Validate planning template parses correctly with new phases"
      - "Build + typecheck pass"
---

# Generalized Interview System

> GitHub Issue: [#16](https://github.com/codevibesmatter/kata-wm/issues/16)

## Overview

The planning template currently jumps from codebase research (P0) straight to spec writing (P1) with no structured user interview. This produces specs based on agent assumptions rather than user requirements. This feature adds a composable, data-driven interview system that **any mode template** can use to gather structured input from the user. Interview categories are defined in a YAML file (`batteries/interviews.yaml`) that ships with batteries and can be customized per-project.

**Pluggable by design:** The interview categories are a reusable question library. Any mode template can include interview steps by adding a phase with steps that reference categories. Planning mode uses the full set; other modes pick what they need:

| Mode | Interview usage |
|------|----------------|
| **planning** | Full set: requirements, architecture, testing, design |
| **task** | None initially (stays question-free) |
| **debug** | Could add: reproduction steps, environment details |
| **implementation** | Could add: clarify ambiguous spec sections mid-impl |
| **research** | Could add: scope and direction before deep dive |

The initial implementation wires interviews into planning mode. Other modes can adopt interview steps later by adding `steps` that reference categories — no code changes needed, just template edits.

## Feature Behaviors

### B1: Interview Data File Ships with Batteries

**Core:**
- **ID:** interview-data-file
- **Trigger:** `kata batteries` or `kata batteries --update` is run on a project
- **Expected:** `batteries/interviews.yaml` is copied to `.kata/interviews.yaml` (or `.claude/workflows/interviews.yaml` for old-layout projects)
- **Verify:** After running `kata batteries`, `.kata/interviews.yaml` exists with default categories

#### UI Layer
N/A — CLI command

#### API Layer
N/A

#### Data Layer
New file: `batteries/interviews.yaml` containing interview category definitions. Structure:

```yaml
interview_categories:
  requirements:
    name: "Requirements"
    description: "User journey, happy path, scope boundaries"
    rounds:
      - header: "Problem"
        question: "What user problem does this solve?"
        options:
          - {label: "User workflow gap", description: "Missing capability in existing flow"}
          - {label: "Performance issue", description: "Current approach too slow/unreliable"}
          - {label: "New capability", description: "Something users can't do at all today"}
      - header: "Happy Path"
        question: "What does the ideal success flow look like?"
        options:
          - {label: "I'll describe it", description: "Free-form description"}
      - header: "Scope OUT"
        question: "What are you explicitly NOT building?"
        options:
          - {label: "I'll list exclusions", description: "Free-form list"}
      - header: "Empty State"
        question: "What happens with zero results or first-time use?"
        options:
          - {label: "Show placeholder", description: "Empty state with guidance"}
          - {label: "Hide section", description: "Don't show until data exists"}
          - {label: "N/A", description: "Not applicable to this feature"}
      - header: "Scale"
        question: "Expected data volume? (affects pagination, caching, indexing)"
        options:
          - {label: "Small (<100)", description: "No pagination needed"}
          - {label: "Medium (100-10K)", description: "Basic pagination"}
          - {label: "Large (10K+)", description: "Virtual scroll, server-side pagination, indexing"}
      - header: "Concurrency"
        question: "What if multiple users edit simultaneously?"
        options:
          - {label: "Last write wins", description: "Simple, no conflict detection"}
          - {label: "Optimistic locking", description: "Detect conflicts, prompt user"}
          - {label: "N/A", description: "Single-user or read-only feature"}

  architecture:
    name: "Architecture"
    description: "Integration points, error handling, performance"
    rounds:
      - header: "Integration"
        question: "What existing systems or APIs does this touch?"
        options:
          - {label: "I'll list them", description: "Free-form list of integration points"}
      - header: "Errors"
        question: "How should errors surface to users?"
        options:
          - {label: "Inline messages", description: "Error text near the action that failed"}
          - {label: "Toast/notification", description: "Temporary popup notification"}
          - {label: "Error page", description: "Full error state with recovery action"}
          - {label: "Silent retry", description: "Auto-retry with fallback"}
      - header: "Performance"
        question: "Any latency or throughput requirements?"
        options:
          - {label: "Standard", description: "No special requirements (<2s page loads)"}
          - {label: "Fast", description: "Sub-second response required (autocomplete, search)"}
          - {label: "Background OK", description: "Can process async (jobs, queues)"}

  testing:
    name: "Testing Strategy"
    description: "Test scenarios planned before implementation"
    rounds:
      - header: "Happy Path"
        question: "What scenarios verify the feature works correctly?"
        options:
          - {label: "CRUD operations", description: "Create, read, update, delete flows"}
          - {label: "User journey", description: "End-to-end workflow completion"}
          - {label: "API responses", description: "Correct data returned for valid inputs"}
      - header: "Error Paths"
        question: "What should fail gracefully?"
        options:
          - {label: "Validation errors", description: "Invalid input handling"}
          - {label: "Permission denied", description: "Unauthorized access attempts"}
          - {label: "Network failures", description: "Timeout and retry behavior"}
      - header: "Test Types"
        question: "What kinds of tests should we write?"
        options:
          - {label: "Unit tests", description: "Isolated function/component tests"}
          - {label: "Integration tests", description: "Cross-module or API tests"}
          - {label: "E2E tests", description: "Full user flow tests"}

  design:
    name: "UI Design"
    description: "Layout, components, visual states"
    rounds:
      - header: "Reference"
        question: "Which existing page or screen is most similar to what you're building?"
        options:
          - {label: "I'll name it", description: "Reference an existing page/screen"}
          - {label: "Nothing similar", description: "This is a new pattern"}
      - header: "Layout"
        question: "What layout pattern fits this feature?"
        options:
          - {label: "List/table", description: "Data listing with sorting/filtering"}
          - {label: "Detail view", description: "Single-item view with sections"}
          - {label: "Form", description: "Input form with validation"}
          - {label: "Dashboard", description: "Multiple cards/panels overview"}
      - header: "Components"
        question: "Which existing components can you reuse?"
        options:
          - {label: "I'll list them", description: "Free-form list of reusable components"}
          - {label: "All new", description: "No existing components apply"}
```

---

### B2: Interview Config Loads with 3-Tier Merge

**Core:**
- **ID:** interview-config-merge
- **Trigger:** `loadInterviewConfig()` is called (by onboard customization step, or future tooling)
- **Expected:** Interview categories are resolved by merging package defaults → project overrides (2-tier: package → project). No user-level tier initially.
- **Verify:** Project `.kata/interviews.yaml` with a custom category appears in the merged config; package defaults are preserved for unoverridden categories

**Note:** The initial planning template has baked-in AskUserQuestion calls (not runtime-generated). The config loader exists so that: (1) onboard mode can read defaults to present for customization, (2) future tooling can generate template content from the config, (3) projects can validate their custom interviews.yaml. A user-level tier (`~/.config/kata/interviews.yaml`) can be added later if needed.

#### UI Layer
N/A

#### API Layer
New function: `loadInterviewConfig()` in `src/config/interviews.ts`
- Returns merged `InterviewConfig` object
- Follows same caching pattern as `loadModesConfig()` but 2-tier (package → project, no user tier initially)

#### Data Layer
New Zod schema: `InterviewCategorySchema`, `InterviewRoundSchema`, `InterviewConfigSchema` in `src/config/interviews.ts`

---

### B3: Planning Template Uses Interview Phases

**Core:**
- **ID:** planning-interview-phases
- **Trigger:** User enters planning mode (`kata enter planning`)
- **Expected:** Planning template now has an interview phase (P1) between Research (P0) and Spec Writing (P2). Each interview category (requirements, architecture, testing, design) becomes a step within the interview phase, plus a requirements-approval step. After all interviews, the approval step compiles answers and asks user to approve before spec writing begins.
- **Verify:** `kata enter planning` creates native tasks including interview steps; task titles reference interview categories

#### UI Layer
Agent presents AskUserQuestion calls for each interview round, following the question/header/options from interviews.yaml.

#### API Layer
N/A — template-level change only. No code changes needed for task creation since interview phases use the existing `steps` mechanism.

#### Data Layer
Modified file: `batteries/templates/planning.md` — new phase structure:

```
P0: Research (existing — clarify scope, codebase search)
P1: Interview
    ├── P1 step: requirements (user journey, scope, edge cases, scale, concurrency)
    ├── P1 step: architecture (integration, errors, performance)
    ├── P1 step: testing (happy path, error paths, test types)
    ├── P1 step: design (layout, components — agent skips if backend-only)
    └── P1 step: requirements-approval (compile summary, get user sign-off)
P2: Spec Writing (existing P1 — create file, write behaviors, extract patterns)
P3: Review (existing P2 — completeness check, review agent)
P4: Finalize (existing P3 — approve, commit, push)
```

The interview step instructions are **hand-authored** in the planning.md template to match the default categories from `batteries/interviews.yaml`. The YAML data source is the canonical definition — when projects customize `.kata/interviews.yaml`, they should also update their local `.kata/templates/planning.md` to match. A future enhancement could auto-generate template content from the YAML, but initially both are maintained by hand.

---

### B4: Onboard Mode Offers Interview Customization

**Core:**
- **ID:** onboard-interview-customize
- **Trigger:** User runs onboard in "custom" path (not quick setup)
- **Expected:** Onboard presents default interview categories and asks if user wants to customize (add project-specific categories, remove irrelevant ones, modify questions)
- **Verify:** After custom onboard, `.kata/interviews.yaml` exists with user's chosen customizations

#### UI Layer
AskUserQuestion during onboard (concrete flow):

**Step 1:** Present default categories for selection:
```
AskUserQuestion(questions=[{
  question: "Which interview categories should planning mode use for this project?",
  header: "Categories",
  options: [
    {label: "Requirements", description: "User journey, happy path, scope, edge cases, scale"},
    {label: "Architecture", description: "Integration points, error handling, performance"},
    {label: "Testing", description: "Test scenarios, error paths, test types"}
  ],
  multiSelect: true
}])
```

**Step 2:** Ask about UI design category separately (since many projects are backend-only):
```
AskUserQuestion(questions=[{
  question: "Does this project have a UI? (enables design interview category)",
  header: "UI Design",
  options: [
    {label: "Yes — include design interviews", description: "Layout, components, visual states"},
    {label: "No — backend only", description: "Skip design category entirely"}
  ],
  multiSelect: false
}])
```

**Step 3:** If user deselected any defaults, write a `.kata/interviews.yaml` that only includes the selected categories. If all defaults kept, skip writing (batteries default is sufficient).

#### API Layer
N/A — template-level change in `templates/onboard.md`

#### Data Layer
Modified file: `templates/onboard.md` — new step in custom setup path

---

### B5: Batteries Scaffold Copies interviews.yaml

**Core:**
- **ID:** batteries-interviews-copy
- **Trigger:** `scaffoldBatteries()` is called (via `kata batteries` or `kata setup --batteries`)
- **Expected:** `batteries/interviews.yaml` is copied to `.kata/interviews.yaml` (or `.claude/workflows/interviews.yaml` for old layout), following the same skip/update semantics as other battery files. Without `--update`, existing file is skipped (preserving customizations). With `--update`, file is overwritten (same behavior as template files — users who customized should back up first).
- **Verify:** After `kata batteries`, interviews.yaml exists in project kata dir. After `kata batteries --update`, file matches package defaults.
- **Source:** `scaffoldBatteries()` in `src/commands/scaffold-batteries.ts`

#### UI Layer
N/A

#### API Layer
Modified function: `scaffoldBatteries()` — add single-file copy for interviews.yaml (same pattern as labels.json copy at line 116-131)

Modified interface: `BatteriesResult` — add `interviews: string[]` field

#### Data Layer
N/A

---

## Non-Goals

- **No new phase type in schema** — interview phases are regular phases with steps. No `type: "interview"` field needed.
- **No gate hook** — the approval step is a regular task in the dependency chain, not a PreToolUse hook.
- **No changes to task mode initially** — task mode stays question-free. Other modes can adopt interview steps later via template edits.
- **No runtime interview config loading during task creation** — the planning template contains baked-in AskUserQuestion calls. The YAML data source is for authoring/customizing the template, not for runtime generation.
- **No ASCII mockup generation** — the old baseplane template had iterative mockup rounds. That's project-specific and can be added as a custom category by projects that need it.
- **No spec-writer agent spawn** — the current planning template writes specs directly. Restoring the orchestrator pattern is a separate concern.

## Open Questions

- [x] Should interview categories live in a separate file or in modes.yaml? **Separate file** — decided in discussion.
- [x] How deep should task mode interviews go? **No change** — task mode stays as-is.
- [x] Should the gate be a hook or a phase? **Phase** — regular task in dependency chain.
- [x] Should projects be able to add custom categories? **Yes** — via `.kata/interviews.yaml` overrides.

## Implementation Phases

See YAML frontmatter `phases:` above.

### Phase 1: Interview Data File and Loading

Tasks:
- Create `batteries/interviews.yaml` with 4 generic categories (requirements, architecture, testing, design)
- Add interviews.yaml single-file copy to `scaffoldBatteries()` in `src/commands/scaffold-batteries.ts`
- Add `interviews: string[]` to `BatteriesResult` interface
- Create `src/config/interviews.ts` with Zod schemas and `loadInterviewConfig()` (2-tier merge: package → project)

test_cases:
- id: tc1
  description: "Interview config loads and validates from batteries YAML"
  command: "npm run build && node -e \"import('./dist/index.js').then(m => console.log('ok'))\""
  expected_exit: 0
- id: tc2
  description: "scaffoldBatteries copies interviews.yaml"
  command: "npm run build && npm test"
  expected_exit: 0

Verification:
- `batteries/interviews.yaml` exists with valid YAML
- `npm run typecheck` passes
- `npm run build && npm test` passes

### Phase 2: Planning Template Integration

Tasks:
- Rewrite `batteries/templates/planning.md` frontmatter to include interview phase (P1) with 4 category steps + approval step
- Each interview step instruction contains AskUserQuestion calls matching the category rounds from interviews.yaml
- Add requirements-approval step as final interview step
- Renumber existing phases: P1→P2 (Spec), P2→P3 (Review), P3→P4 (Finalize)
- Update phase flow diagram in template body

test_cases:
- id: tc1
  description: "Planning template parses and validates with new phases"
  command: "npm run build && npm test"
  expected_exit: 0

Verification:
- `kata enter planning --issue=16` creates tasks including interview steps
- Phase dependency chain is correct (P0 → P1 interviews → P2 spec → P3 review → P4 finalize)
- `npm run typecheck` passes

### Phase 3: Onboard Integration

Tasks:
- Add interview customization step to `templates/onboard.md` in the custom setup path
- Step shows default categories, asks user which to keep/modify
- Write customized `.kata/interviews.yaml` if user makes changes

test_cases:
- id: tc1
  description: "Onboard template parses with new step"
  command: "npm run build && npm test"
  expected_exit: 0

Verification:
- Onboard template validates with new step
- `npm run typecheck` passes

### Phase 4: Tests and Verification

Tasks:
- Add unit tests for interview config Zod schema validation
- Add unit tests for 2-tier config merge (package → project)
- Verify planning template creates correct native tasks with interview steps
- Full build + typecheck + test pass

test_cases:
- id: tc1
  description: "All tests pass including new interview config tests"
  command: "npm run build && npm test"
  expected_exit: 0

Verification:
- `npm run build && npm test` passes
- `npm run typecheck` passes
- No regressions in existing tests
