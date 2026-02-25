---
initiative: subphase-patterns
type: project
issue_type: feature
status: approved
priority: medium
github_issue: 18
created: 2026-02-25
updated: 2026-02-25
phases:
  - id: p1
    name: "Subphase patterns config file and loader"
    tasks:
      - "Create batteries/subphase-patterns.yaml with impl-verify pattern"
      - "Add subphase-patterns.yaml to scaffold-batteries.ts copy targets"
      - "Create subphase pattern config loader with 2-tier merge (package → project)"
      - "Move SubphasePattern schema to config module alongside loader"
  - id: p2
    name: "Template reference by name"
    tasks:
      - "Change implementation.md container phase to reference pattern by name"
      - "Update template parser to resolve pattern name → pattern array"
      - "Validate pattern name exists during template phase validation"
  - id: p3
    name: "Consumer migration"
    tasks:
      - "Update enter.ts to load patterns config, resolve string names to SubphasePattern[], pass to builders"
      - "Confirm all subphase_pattern access points in enter.ts use the resolved array"
  - id: p4
    name: "Tests and verification"
    tasks:
      - "Unit tests for subphase pattern loader, merge, and cache clearing"
      - "Verify implementation template parses correctly with name reference"
      - "Build + typecheck pass"
---

# Extractable Subphase Patterns

## Overview

Subphase patterns define what tasks get created inside a container phase during implementation mode. Currently, the pattern (impl → verify) is embedded inline in the implementation template's YAML frontmatter. This makes it impossible to swap patterns without editing the template file, and prevents sharing patterns across templates.

This feature extracts subphase patterns into a standalone config file (`batteries/subphase-patterns.yaml`) following the same architecture as `interviews.yaml`: ships with batteries, project-level override in `.kata/subphase-patterns.yaml`, 2-tier merge, cached loader.

**Why now:** The user wants to experiment with different subphase strategies (e.g., impl/test/verify, impl/review/verify) for the same specs without forking the template.

## Feature Behaviors

### B1: Subphase Patterns Config File Ships with Batteries

**Core:**
- **ID:** pattern-config-file
- **Trigger:** `kata batteries` / `kata setup` copies `batteries/subphase-patterns.yaml` to project
- **Expected:** File exists at `batteries/subphase-patterns.yaml` with named pattern definitions
- **Verify:** File contains at least `impl-verify` pattern matching current inline definition

**Data structure:**
```yaml
# batteries/subphase-patterns.yaml
subphase_patterns:
  impl-verify:
    description: "Implement then verify each spec phase"
    steps:
      - id_suffix: impl
        title_template: "IMPL - {task_summary}"
        todo_template: "Implement {task_summary}"
        active_form: "Implementing {phase_name}"
        labels: [impl]
      - id_suffix: verify
        title_template: "VERIFY - {phase_name}"
        todo_template: "Verify {phase_name} implementation"
        active_form: "Verifying {phase_name}"
        labels: [verify]
        depends_on_previous: true
```

**Project override:**
```yaml
# .kata/subphase-patterns.yaml (or .claude/workflows/subphase-patterns.yaml)
subphase_patterns:
  impl-test-verify:
    description: "Implement, write tests, then verify"
    steps:
      - id_suffix: impl
        title_template: "IMPL - {task_summary}"
        todo_template: "Implement {task_summary}"
        active_form: "Implementing {phase_name}"
        labels: [impl]
      - id_suffix: test
        title_template: "TEST - {phase_name}"
        todo_template: "Write tests for {phase_name}"
        active_form: "Testing {phase_name}"
        labels: [test]
        depends_on_previous: true
      - id_suffix: verify
        title_template: "VERIFY - {phase_name}"
        todo_template: "Verify {phase_name} implementation"
        active_form: "Verifying {phase_name}"
        labels: [verify]
        depends_on_previous: true
```

### B2: Config Loader with 2-Tier Merge

**Core:**
- **ID:** pattern-loader
- **Trigger:** Any code path calls `loadSubphasePatterns()`
- **Expected:** Returns merged config: package defaults + project overrides. Project definitions win on name collision. Results are cached.
- **Verify:** Loading with a project override that redefines `impl-verify` returns the project version

**Module:** `src/config/subphase-patterns.ts` — follows `interviews.ts` structure exactly:
- Zod schema at top (`SubphasePatternConfigSchema`)
- `parseSubphasePatternConfig(path)` — read + validate
- `mergeSubphasePatternConfig(base, overlay)` — spread merge by pattern name
- `loadSubphasePatterns()` — cached 2-tier loader
- `getProjectSubphasePatternsPath()` — resolves `.kata/` or `.claude/workflows/` layout

### B3: Template References Pattern by Name

**Core:**
- **ID:** template-name-ref
- **Trigger:** Template YAML frontmatter uses `subphase_pattern: "impl-verify"` (string) instead of inline array
- **Expected:** `enter.ts` loads pattern config, resolves names to `SubphasePattern[]` before passing to builders. The template parser stays sync — it preserves the raw value (string or array). Resolution happens in `enter.ts` after parsing.
- **Verify:** `buildSpecTasks()` receives the same `SubphasePattern[]` as before; task output is identical

**Resolution flow:**
1. Template parser (`parseAndValidateTemplatePhases`) returns `PhaseDefinition` with `subphase_pattern` as `string | SubphasePattern[]` — no resolution, stays sync
2. `enter.ts` calls `await loadSubphasePatterns()` early (before task creation)
3. `enter.ts` resolves: if `containerPhase.subphase_pattern` is a string, look it up in loaded config; if array, use as-is
4. Resolved `SubphasePattern[]` passed to `buildSpecTasks()` and used in guidance — no downstream changes

**Template change:**
```yaml
# Before (inline):
- id: p2
  name: Implement
  container: true
  subphase_pattern:
    - id_suffix: impl
      ...

# After (reference):
- id: p2
  name: Implement
  container: true
  subphase_pattern: impl-verify
```

**Schema change:** `subphase_pattern` field becomes `z.union([z.string(), z.array(subphasePatternSchema)])` — accepts either a name (string) or inline array (backwards compat). The `PhaseDefinition` TypeScript type reflects the union. Consumers that need the resolved array receive it from `enter.ts`, not from the type directly.

**Supported placeholders:** `{task_summary}`, `{phase_name}`, `{phase_label}` — all three available in templates.

### B4: Validation Catches Missing Pattern Names

**Core:**
- **ID:** pattern-name-validation
- **Trigger:** Template references a pattern name that doesn't exist in config
- **Expected:** Clear error: `Unknown subphase pattern "foo-bar". Available: impl-verify, impl-test-verify`
- **Verify:** Entering a mode with a bad pattern reference fails with actionable error

**Edge cases:**
- Inline arrays are not validated against config — only string names trigger lookup
- Container phase with `subphase_pattern` omitted entirely: continues to produce zero spec tasks (existing behavior, `?? []` fallback preserved)
- Validation happens in `enter.ts` at resolution time, not in the Zod schema or `validatePhases()`

### B5: Batteries Setup Copies Config

**Core:**
- **ID:** batteries-copy
- **Trigger:** `kata batteries` or `kata setup`
- **Expected:** `subphase-patterns.yaml` copied to project alongside `interviews.yaml` and templates
- **Verify:** After setup, `.kata/subphase-patterns.yaml` exists with default patterns

## Non-Goals

- **No per-session pattern override.** Patterns are config-level, not session-level. You change patterns by editing the project YAML, not by passing flags to `kata enter`.
- **No pattern composition.** You can't say "use impl from pattern A and verify from pattern B." Patterns are atomic — define the full sequence.
- **No pattern inheritance.** A project pattern named `impl-verify` fully replaces the package version, it doesn't deep-merge individual steps.
- **No migration of existing inline patterns.** Templates with inline arrays keep working (B3 union schema). We don't force-update existing project templates.
- **No default pattern fallback.** A container phase with `subphase_pattern` omitted gets zero spec tasks — same as today. We don't auto-assign `impl-verify`.

## Implementation Phases

See YAML frontmatter `phases:` for the task breakdown. Summary:

1. **P1: Config file + loader** — Create the YAML file, Zod schema, 2-tier cached loader. Follow `interviews.ts` pattern exactly.
2. **P2: Template reference** — Change schema to accept string or array, update template parser to resolve names, add validation for missing names.
3. **P3: Consumer migration** — Wire the loader into `enter.ts` so it loads patterns before passing to `buildSpecTasks()`. Task-factory and guidance don't change — they already receive `SubphasePattern[]`.
4. **P4: Tests** — Unit tests for loader/merge, template parsing with name refs, build + typecheck.
