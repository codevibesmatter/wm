---
initiative: unified-kata-yaml
type: project
issue_type: feature
status: approved
priority: high
github_issue: 30
created: 2026-02-27
updated: 2026-02-27
phases:
  - id: p1
    name: "Create kata.yaml schema and loader"
    tasks:
      - "Define KataConfigSchema (Zod) combining project + modes"
      - "Implement loadKataConfig() — single file, no merge"
      - "Hard error when .kata/kata.yaml missing"
      - "Unit tests for schema validation and missing-file error"
    test_cases:
      - id: "schema-valid"
        description: "Valid kata.yaml parses without error"
        type: "unit"
      - id: "schema-invalid"
        description: "Invalid kata.yaml throws descriptive error"
        type: "unit"
      - id: "missing-file-error"
        description: "Missing kata.yaml throws error with setup instructions"
        type: "unit"
  - id: p2
    name: "Migrate consumers from old config to kata.yaml"
    tasks:
      - "Replace loadWmConfig() calls with loadKataConfig()"
      - "Replace loadModesConfig() calls with loadKataConfig()"
      - "Update suggest.ts: drop strong_signals, use intent_keywords only"
      - "Update enter.ts, can-exit.ts, hook.ts, prime.ts, check-phase.ts"
      - "Update step-runner.ts, stop-guidance.ts, validate-spec.ts"
    test_cases:
      - id: "consumers-compile"
        description: "All consumers compile with new config shape"
        type: "unit"
      - id: "suggest-keywords"
        description: "suggest.ts detects modes via intent_keywords + aliases"
        type: "unit"
  - id: p3
    name: "Kill merge machinery and user tier"
    tasks:
      - "Delete mergeModesConfig(), mergeWmConfig(), getDefaultConfig()"
      - "Delete getUserConfigDir() and all ~/.config/kata/ resolution"
      - "Remove userPath from getModesYamlPath()"
      - "Remove user tier from resolveTemplatePath(), resolveSpecTemplatePath()"
      - "Delete batteries --user command"
      - "Remove dead schema fields: red_flags, categories, notes_file_template, global_behavior, behavior, strong_signals"
      - "Delete old wm-config.ts, cache.ts files"
      - "Delete corresponding test files and user-tier tests"
    test_cases:
      - id: "no-user-tier"
        description: "No references to ~/.config/kata remain in source"
        type: "unit"
      - id: "no-merge-fns"
        description: "No merge functions remain in source"
        type: "unit"
  - id: p4
    name: "Update batteries and setup to seed kata.yaml"
    tasks:
      - "Update kata batteries to generate .kata/kata.yaml from package template"
      - "Update kata setup to create kata.yaml instead of wm.yaml"
      - "Create seed kata.yaml in batteries/ as the canonical template"
      - "Backwards compat: detect old wm.yaml + modes.yaml and warn with migration instructions"
      - "Update eval-fixtures to use kata.yaml instead of wm.yaml"
      - "Update init-mode.ts and register-mode.ts to write to kata.yaml"
    test_cases:
      - id: "batteries-seeds-kata-yaml"
        description: "kata batteries creates .kata/kata.yaml"
        type: "integration"
      - id: "old-config-warning"
        description: "Old wm.yaml/modes.yaml triggers migration warning"
        type: "integration"
  - id: p5
    name: "Move behavioral guidance to templates"
    tasks:
      - "Move global_behavior.task_system content into template bodies"
      - "Move global_behavior.never_ask_globally into CLAUDE.md or template prose"
      - "Move per-mode behavior (bias, never_ask, ok_to_ask, entry_actions) into template markdown"
      - "Update suggest.ts to emit simpler guidance without behavior fields"
    test_cases:
      - id: "templates-contain-guidance"
        description: "Template markdown contains behavioral guidance previously in YAML"
        type: "smoke"
      - id: "suggest-no-behavior"
        description: "suggest.ts output no longer references behavior config fields"
        type: "unit"
---

# Unified kata.yaml — Kill Config Merge Machinery

> GitHub Issue: [#30](https://github.com/codevibesmatter/kata-wm/issues/30)

## Overview

Replace the current 3-tier config merge system (hardcoded defaults → `~/.config/kata/` user tier → project `wm.yaml` + `modes.yaml`) with a single project-owned `kata.yaml`. No defaults, no merge, no user tier. Missing file = error. Behavioral guidance moves from YAML config fields to template markdown and CLAUDE.md.

## Feature Behaviors

### B1: Single config file

**Core:**
- **ID:** single-config-file
- **Trigger:** Any kata command that reads config
- **Expected:** Config loaded from `.kata/kata.yaml` only. One parse, one return. No merge logic.
- **Verify:** `kata config` shows config from single file, no provenance annotations
- **Source:** `src/config/wm-config.ts`, `src/config/cache.ts`

The unified schema combines what was previously split across `wm.yaml` (project settings) and `modes.yaml` (mode definitions):

```yaml
# .kata/kata.yaml
project:
  name: "my-project"
  build_command: "npm run build"
  test_command: "npm test"
  typecheck_command: "npm run typecheck"
  diff_base: "origin/main"
  test_file_pattern: "*.test.ts,*.spec.ts"
  spec_path: "planning/specs"
  research_path: "planning/research"

session_retention_days: 7
non_code_paths: [".claude", ".kata", "planning"]

reviews:
  code_review: true
  code_reviewer: null

providers:
  default: "claude"

modes:
  task:
    template: task.md
    stop_conditions: [tasks_complete, committed]
    intent_keywords: ["task:", "chore", "small task", "quick change"]
    aliases: ["chore", "small"]
    workflow_prefix: "TK"
  planning:
    template: planning.md
    issue_handling: required
    issue_label: feature
    stop_conditions: [tasks_complete, committed]
    intent_keywords: ["plan feature", "spec", "design", "write spec"]
  implementation:
    template: implementation.md
    issue_handling: required
    issue_label: feature
    stop_conditions: [tasks_complete, committed, pushed, tests_pass, feature_tests_added]
    intent_keywords: ["implement", "build", "code", "execute spec"]
  freeform:
    template: freeform.md
    stop_conditions: []
    intent_keywords: ["question", "how does", "explain"]
    aliases: ["question", "ask", "help"]
    workflow_prefix: "FF"
  research:
    template: research.md
    stop_conditions: [tasks_complete, committed]
    intent_keywords: ["research", "explore", "learn about"]
```

#### Per-mode fields (kept)

| Field | Required | Purpose |
|-------|----------|---------|
| `template` | Yes | Template filename to load |
| `stop_conditions` | Yes | Stop hook enforcement |
| `issue_handling` | No | `"required"` or absent (default: not required) |
| `issue_label` | No | GitHub label for auto-created issues |
| `intent_keywords` | No | Mode detection keywords |
| `aliases` | No | Alternative mode names |
| `workflow_prefix` | No | Workflow ID prefix (default: first 2 chars of mode name) |
| `name` | No | Display name (default: capitalize mode key) |
| `description` | No | One-line description (default: from template frontmatter) |
| `deprecated` | No | Mark mode as deprecated |
| `redirect_to` | No | Redirect deprecated mode to canonical replacement |

#### Per-mode fields (removed)

| Field | Reason |
|-------|--------|
| `strong_signals` | Redundant with intent_keywords |
| `behavior` (bias, never_ask, ok_to_ask, entry_actions, context_signals) | Moves to template markdown |
| `category` | Organizational chrome, never used for logic |
| `phases` | Deprecated, superseded by template frontmatter |
| `notes_file_template` | Dead field |

#### Top-level fields (removed)

| Field | Reason |
|-------|--------|
| `global_behavior` (never_ask_globally, task_system, ask_when, inference) | Moves to template markdown / CLAUDE.md |
| `categories` | Never read for logic or display |
| `red_flags` | Never consumed |
| `hooks_dir` | Unused |
| `prime_extensions` | Niche, can revisit if needed |
| `mode_config` | Redundant — modes section covers per-mode config |

---

### B2: Missing config = hard error

**Core:**
- **ID:** missing-config-error
- **Trigger:** Any kata command when `.kata/kata.yaml` does not exist
- **Expected:** Error: `"kata: no .kata/kata.yaml found. Run 'kata setup' to initialize this project."`
- **Verify:** Run `kata status` in a dir without kata.yaml, see error
- **Source:** New `src/config/kata-config.ts`

No fallback to hardcoded defaults. No fallback to `~/.config/kata/`. If the file doesn't exist, kata doesn't work.

---

### B3: No user-level config tier

**Core:**
- **ID:** no-user-tier
- **Trigger:** N/A — removal
- **Expected:** `~/.config/kata/` is never read. `getUserConfigDir()` is deleted. `batteries --user` is removed.
- **Verify:** `grep -r "getUserConfigDir\|~/.config/kata" src/` returns no results

Template resolution becomes 2-tier: project `.kata/templates/` → package `batteries/templates/`.
Config resolution becomes 1-tier: project `.kata/kata.yaml` only.

---

### B4: Behavioral guidance in markdown

**Core:**
- **ID:** behavior-in-markdown
- **Trigger:** Mode entry, user-prompt hook
- **Expected:** Behavioral guidance (never_ask, bias, entry_actions, task_system) delivered via template markdown body and CLAUDE.md, not parsed from YAML config
- **Verify:** Templates contain guidance prose; suggest.ts no longer reads behavior fields

Current `global_behavior.task_system` content moves into each template that uses tasks:
```markdown
## Task System Rules
- Tasks are pre-created by kata enter. Do NOT create new tasks with TaskCreate.
- Run TaskList FIRST to discover pre-created tasks.
- Use TaskUpdate to mark tasks in_progress/completed.
- Follow the dependency chain.
```

Current `global_behavior.never_ask_globally` moves to project CLAUDE.md (already present in most projects via the user-prompt hook injection).

Current per-mode `behavior` fields (bias, never_ask, ok_to_ask, entry_actions) move into the template markdown body under a section like `## Agent Behavior`.

---

### B5: Batteries seeds kata.yaml

**Core:**
- **ID:** batteries-seeds-kata-yaml
- **Trigger:** `kata batteries` or `kata setup`
- **Expected:** Creates `.kata/kata.yaml` from a seed template in `batteries/kata.yaml`. Merges project-detected values (build command, test command, etc.)
- **Verify:** Run `kata setup` in a fresh project, verify `.kata/kata.yaml` exists with correct structure

---

### B6: Backwards compatibility warning

**Core:**
- **ID:** old-config-warning
- **Trigger:** kata commands when `.kata/kata.yaml` missing but `wm.yaml` and/or `modes.yaml` exist
- **Expected:** Error message includes migration hint: `"Found legacy wm.yaml/modes.yaml. Run 'kata migrate-config' to convert to kata.yaml."`
- **Verify:** Project with old config files shows migration hint

Optional: provide a `kata migrate-config` command that reads old files and generates kata.yaml. Could be deferred to a follow-up.

---

## Non-Goals

- Changing the template frontmatter format (phases, steps, task_config — these stay as-is)
- Changing the subphase-patterns system
- Changing the stop hook mechanism
- Changing the session state schema
- Providing a migration CLI (can be manual or follow-up)
- Removing `providers` or `reviews` config (these are mechanical)

## Open Questions

- [x] Keep intent_keywords or drop entirely? → **Keep intent_keywords, drop strong_signals**
- [x] Should deprecated mode redirects (bugfix → implementation, etc.) be kept in kata.yaml or dropped? → **Keep — they're mechanical (enter.ts uses `deprecated` + `redirect_to`)**
- [ ] Should `kata migrate-config` be part of this spec or a follow-up?

## Implementation Phases

See YAML frontmatter `phases:` above. Each phase should be 1-4 hours of focused work.

## Test Infrastructure

Existing test infrastructure: Node built-in test runner via `dist/testing/index.js`. Tests live alongside source as `.test.ts` files.

### Build Verification
`npm run build && npm test`

## Verification Plan

No runtime verification against a live system — this is config/CLI infrastructure only.

### VP1: Fresh project setup

Steps:
1. `mkdir /tmp/test-project && cd /tmp/test-project && git init`
2. `kata setup`
   Expected: `.kata/kata.yaml` created with project section and default modes
3. `kata status`
   Expected: No error, shows "no active mode"
4. `cat .kata/kata.yaml`
   Expected: Contains `project:` and `modes:` sections

### VP2: Missing config error

Steps:
1. `mkdir /tmp/bare-project && cd /tmp/bare-project && git init`
2. `kata status`
   Expected: Error message mentioning `kata.yaml` and `kata setup`

### VP3: Mode entry with new config

Steps:
1. In a project with kata.yaml: `kata enter freeform`
   Expected: Mode entered successfully, template loaded
2. `kata enter task`
   Expected: Tasks created from template phases

### VP4: No user-tier references

Steps:
1. `grep -r "getUserConfigDir\|userPath\|~/.config/kata" src/`
   Expected: No matches

## Implementation Hints

### Key Files to Modify

| File | Change |
|------|--------|
| `src/config/kata-config.ts` | New — unified loader |
| `src/config/wm-config.ts` | Delete |
| `src/config/cache.ts` | Delete |
| `src/state/schema.ts` | Remove dead fields from ModeConfigSchema, ModesConfigSchema |
| `src/session/lookup.ts` | Remove getUserConfigDir, simplify getModesYamlPath, template resolution |
| `src/commands/suggest.ts` | Drop strong_signals, behavior field reading |
| `src/commands/enter.ts` | Switch to loadKataConfig() |
| `src/commands/can-exit.ts` | Switch to loadKataConfig() |
| `src/commands/hook.ts` | Switch to loadKataConfig() |
| `src/commands/prime.ts` | Switch to loadKataConfig(), drop global_behavior |
| `src/commands/batteries.ts` | Remove --user, seed kata.yaml |
| `src/commands/setup.ts` | Generate kata.yaml instead of wm.yaml |
| `src/commands/config.ts` | Simplify to show single file |
| `src/commands/init-mode.ts` | Write to kata.yaml modes section instead of modes.yaml |
| `src/commands/register-mode.ts` | Write to kata.yaml modes section instead of modes.yaml |
| `batteries/kata.yaml` | New — seed template |
| `eval-fixtures/tanstack-start/` | Replace wm.yaml with kata.yaml |
| `batteries/templates/*.md` | Add behavioral guidance previously in modes.yaml |

### Migration Path

Existing projects have `.kata/wm.yaml` (or `.claude/workflows/wm.yaml`) + `modes.yaml`. The migration is:
1. Detect old files exist but kata.yaml doesn't
2. Show error with instructions
3. Manual or scripted: combine wm.yaml project settings + modes.yaml mode definitions into kata.yaml
4. Delete old files

### Gotchas
- The `loadModesConfig()` singleton cache is used across multiple commands in a single process. The replacement `loadKataConfig()` should maintain caching behavior.
- `enter.ts` reads both wm config and modes config in different places — need to ensure all paths use the unified loader.
- Eval harness copies fixtures that include `wm.yaml` — fixtures need updating too.

---
