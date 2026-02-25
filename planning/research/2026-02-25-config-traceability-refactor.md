# Config & Pluggable Steps: Traceability Audit and Refactor Options

**Date**: 2026-02-25
**Workflow**: RE-e2c4-0225
**Status**: Research findings

## Executive Summary

kata-wm has 6 YAML config surfaces, 6 hook types, 6 stop condition types, 2 task factory paths, and a 3-tier template resolution system. The config architecture is sound in principle (data-driven from modes.yaml, multi-tier merge) but has accumulated traceability gaps: hardcoded mode names, unvalidated string references, duplicated conventions, and dead fields. None are bugs today, but they create maintenance risk as modes/conditions grow.

---

## 1. Config Surface Inventory

| Config | Files | Tiers | Schema Location | Merge Strategy |
|--------|-------|-------|----------------|----------------|
| **modes.yaml** | package / user / project | 3 | `state/schema.ts:149-210` (Zod) | Per-mode overlay |
| **wm.yaml** | defaults / user / project | 3 | `config/wm-config.ts:6-46` (TS interface) | Scalar replace, nested shallow-merge |
| **Template frontmatter** | package / user / project `.md` | 3 (via resolution) | `validation/schemas.ts:66-91` (Zod) | First-found wins |
| **interviews.yaml** | package / project | 2 | `config/interviews.ts:11-30` (Zod) | Per-category overlay |
| **subphase-patterns.yaml** | package / project | 2 | `config/subphase-patterns.ts:17-24` (Zod) | Per-pattern overlay |
| **state.json** | per-session | 1 | `state/schema.ts:7-107` (Zod) | N/A (single file) |

**Additional inputs**: `CLAUDE_PROJECT_DIR` env var, `XDG_CONFIG_HOME`, 15+ CLI flags across commands.

### Observation: Inconsistent schema approaches

- modes.yaml and templates use **Zod schemas** with runtime validation
- wm.yaml uses a **TypeScript interface** with no Zod validation — values pass through unchecked
- All loaders cache independently with no shared lifecycle

---

## 2. Pluggable Extension Points

### 2.1 Hook System (6 types)

| Hook | Event | Input | Decision | Key Logic |
|------|-------|-------|----------|-----------|
| `session-start` | SessionStart | `{session_id}` | Context injection | init + prime |
| `user-prompt` | UserPromptSubmit | `{session_id, user_message}` | Context injection | Mode detection via suggest.ts |
| `mode-gate` | PreToolUse | `{tool_name, tool_input}` | allow/deny | Block writes in default mode, inject --session |
| `task-deps` | PreToolUse | `{tool_input.taskId}` | allow/deny | Block task completion if deps incomplete |
| `task-evidence` | PreToolUse | `{session_id}` | advisory | Warn about uncommitted changes |
| `stop-conditions` | Stop | `{session_id}` | block/allow | Evaluate mode's stop_conditions array |

**Data flow**: All hooks read stdin JSON → execute logic → output hook JSON to stdout. Registered in `.claude/settings.json`.

### 2.2 Stop Conditions (6 types)

| Condition String | Check | Implementation |
|-----------------|-------|----------------|
| `tasks_complete` | Native tasks all done? | `countPendingNativeTasks()` |
| `committed` | No tracked file changes? | `git status --porcelain` |
| `pushed` | HEAD on remote? | `git branch -r --contains HEAD` |
| `verification` | Code review passed? | Read verification-evidence JSON |
| `tests_pass` | Phase tests passed? | Read phase test result JSONs |
| `feature_tests_added` | New test functions in diff? | Regex on `git diff` |

### 2.3 Task Factory (2 paths)

- **Template-based** (`buildPhaseTasks`): One task per phase/step, deps from YAML `depends_on`
- **Spec-based** (`buildSpecTasks`): Spec phases × subphase patterns, dynamic task generation

### 2.4 Template Resolution

```
Project .kata/templates/{name}.md
  → User ~/.config/kata/templates/{name}.md
    → Package batteries/templates/{name}.md
```

First-found wins. No validation that referenced template exists until `kata enter` runtime.

---

## 3. Traceability Problems Found

### HIGH: Hardcoded mode names bypass data-driven design

**Locations**:
- `enter.ts:213-226` — Special file creation for `feature-documentation` and `doctrine` modes
- `enter.ts:699-710` — Same check duplicated
- `suggest.ts:296` — `mode === 'bugfix'` for GitHub label selection

**Why it matters**: CLAUDE.md says "No hardcoded mode names in logic." These violate the core principle. Adding similar interview-context persistence for a new mode requires code changes.

**Fix direction**: Add `enter_side_effects` or `notes_file` field to modes.yaml. Move label mapping to `issue_label` field.

### HIGH: Stop condition strings are unvalidated magic strings

**Problem**: `stop_conditions: [tasks_complete, committed]` in modes.yaml are plain strings matched by `checks.has('tasks_complete')` in can-exit.ts. No central enum. A typo like `task_complete` silently becomes a no-op.

**Evidence**: `can-exit.ts:286` creates `new Set<string>()` from the array, then does string comparisons at lines 289, 305, 329, 337, 348.

**Fix direction**: Create a `StopConditionType` enum/const, validate in ModeConfigSchema.

### MEDIUM: Phase naming convention duplicated in 3+ files

**Locations**:
- `validation/schemas.ts:67` — regex `/^p\d+(\.\d+)?$/`
- `task-factory.ts:48,68` — string concatenation `p${num}.${subnum}`
- `guidance.ts:66,90` — `parseInt(p.id.replace('p', ''))`

**Fix direction**: Extract `PhaseId` utility (parse, format, validate) used everywhere.

### MEDIUM: VALID_CATEGORIES duplicated

- `register-mode.ts:17` — hardcoded array
- `state/schema.ts:157-163` — Zod enum

Both must stay in sync manually.

**Fix direction**: Single source in schema, import everywhere.

### MEDIUM: wm.yaml has no Zod validation

Unlike modes.yaml and templates, `wm.yaml` config passes through `loadWmConfig()` with only a TypeScript interface, no runtime validation. Invalid fields silently pass through.

### MEDIUM: Template existence not validated on config load

`modes.yaml` references `template: "research.md"` but nothing validates the file exists until `kata enter` is called. Same for `subphase_pattern` references.

### LOW: Dead schema fields

- `micro_planning` in ModeConfigSchema — defined, never consumed
- `workflow_prefix` in ModeConfigSchema — defined, but `enter.ts:153` uses `modeName.slice(0,2)` instead

### LOW: Cross-cutting fields lack impact documentation

`issue_handling` affects suggest.ts and prime.ts. `category` affects prime.ts and register-mode.ts. No way to discover all consumers of a field without grepping.

---

## 4. Refactor Options

### Option A: Surgical Fixes (Low effort, high ROI)

**Scope**: Fix the worst traceability gaps without restructuring.

1. **Stop condition enum** — Create `STOP_CONDITION_TYPES` const array, use in ModeConfigSchema validation and can-exit.ts. ~30 lines changed.
2. **Remove hardcoded mode names** — Add `notes_file_template` field to ModeConfig for interview context persistence. Add `issue_label` field for suggest.ts. ~50 lines.
3. **Use workflow_prefix from config** — `enter.ts:153` should read `modeConfig.workflow_prefix` instead of slicing. ~5 lines.
4. **Delete dead fields** — Remove `micro_planning` from schema. ~3 lines.
5. **Export VALID_CATEGORIES from schema** — Single source of truth. ~10 lines.

**Estimated total**: ~100 lines changed across 6 files. No architectural changes.

### Option B: Validation Layer (Medium effort)

**Scope**: Add config validation that catches errors at load time, not runtime.

1. Everything in Option A, plus:
2. **Zod schema for wm.yaml** — Replace TypeScript interface with Zod schema matching modes.yaml pattern. Validate on load.
3. **Config validator command** — `kata doctor --config` that validates:
   - All template files referenced in modes.yaml exist
   - All subphase_pattern references resolve
   - All stop_conditions are valid enum values
   - Phase IDs in templates match convention
4. **PhaseId utility** — `parsePhaseId()`, `formatPhaseId()`, `isSubphase()` used by task-factory, guidance, validation.

**Estimated total**: ~300 lines new code, ~100 lines refactored.

### Option C: Config Registry (Higher effort, structural)

**Scope**: Unify all config loading behind a single registry with dependency tracking.

1. Everything in Options A and B, plus:
2. **ConfigRegistry class** — Single entry point that loads all configs, validates cross-references, caches results:
   ```typescript
   const config = await loadConfig(projectDir)
   config.modes      // ModesConfig (validated)
   config.wm         // WmConfig (validated)
   config.templates   // Map<string, TemplateYaml> (pre-loaded)
   config.interviews  // InterviewConfig
   config.subphasePatterns // SubphasePatternConfig
   ```
3. **Cross-reference validation** — Registry validates that modes reference existing templates, templates reference existing subphase patterns, etc.
4. **Provenance tracking** — Each config value knows which tier it came from (package/user/project), visible via `kata config --show`.
5. **Lifecycle management** — Single cache invalidation point instead of 5 independent caches.

**Estimated total**: ~500 lines new code, ~200 lines refactored. Breaking change to config loading API.

### Option D: Schema-first redesign (Highest effort)

**Scope**: Single unified YAML schema that replaces the current 5-file split.

This is likely overkill — the current multi-file approach has good separation of concerns. Listed for completeness but **not recommended**.

---

## 5. Recommendation

**Start with Option A** (surgical fixes). It addresses the highest-severity issues with minimal risk:
- Stop condition enum prevents the worst class of silent failures
- Removing hardcoded mode names aligns with the stated design principle
- Dead field cleanup reduces confusion

**Follow with Option B** if the project continues growing modes. The validation layer pays for itself when 3rd-party modes or user-defined modes enter the picture.

**Option C** is worth considering if config debugging becomes a regular pain point. The provenance tracking (`kata config --show` telling you "this value came from ~/.config/kata/wm.yaml") would be valuable but isn't urgent.

---

## 6. Quick Reference: Where Config Flows

```
modes.yaml ──→ ModeConfigSchema ──→ loadModesConfig() ──→ cache.ts
    │                                      │
    ├── template field ──→ resolveTemplatePath() ──→ template.ts
    ├── stop_conditions ──→ can-exit.ts validateCanExit()
    ├── issue_handling ──→ suggest.ts, prime.ts
    ├── intent_keywords ──→ suggest.ts mode detection
    └── behavior ──→ guidance.ts (entry_actions, never_ask)

wm.yaml ──→ loadWmConfig() ──→ wm-config.ts
    ├── project.* ──→ various commands
    ├── spec_path ──→ spec resolution, assertions
    ├── reviews.* ──→ review command
    └── providers.* ──→ provider selection

template.md frontmatter ──→ parseTemplateYaml() ──→ template.ts
    ├── phases ──→ task-factory.ts buildPhaseTasks()
    ├── phases[].steps ──→ task-factory.ts (per-step tasks)
    ├── phases[].container ──→ task-factory.ts buildSpecTasks()
    ├── phases[].subphase_pattern ──→ subphase-patterns.ts
    └── global_conditions ──→ can-exit.ts (merged with stop_conditions)
```
