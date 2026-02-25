---
initiative: kata-manager-project
type: project
issue_type: feature
status: approved
priority: medium
github_issue: 23
created: 2026-02-25
updated: 2026-02-25
phases:
  - id: p1
    name: "Surgical fixes — stop condition enum, dead fields, hardcoded mode names"
    tasks:
      - "Create STOP_CONDITION_TYPES const array in src/state/schema.ts and validate in ModeConfigSchema"
      - "Remove micro_planning from ModeConfigSchema"
      - "Fix workflow_prefix fallback in enter.ts to read from config, not slice mode name"
      - "Export VALID_CATEGORIES from schema.ts; update init-mode.ts and register-mode.ts to import it"
      - "Add notes_file_template and issue_label fields to ModeConfigSchema and modes.yaml"
      - "Replace any remaining hardcoded mode-name checks in enter.ts and suggest.ts with config field lookups"
    test_cases:
      - id: "stop-condition-enum-validates"
        description: "ModeConfigSchema rejects unknown stop condition strings"
        type: "unit"
      - id: "micro-planning-removed"
        description: "ModeConfigSchema no longer accepts micro_planning field (passthrough still safe for legacy YAML)"
        type: "unit"
      - id: "categories-exported"
        description: "VALID_CATEGORIES is importable from schema.ts and matches the enum in ModeConfigSchema"
        type: "unit"
      - id: "build-typecheck"
        description: "npm run build && npm run typecheck pass after all changes"
        type: "smoke"
  - id: p2
    name: "Manager foundation — init, discovery, registry, list"
    tasks:
      - "Create src/manager/paths.ts with MANAGER_ROOT, ensureManagerDir(), getProjectsIndexPath()"
      - "Create src/manager/discovery.ts with scanClaudeProjects(), decanonPath(), isKataEnabled()"
      - "Create src/manager/registry.ts with ProjectsIndex schema, readIndex(), writeIndex(), addProject(), removeProject(), refreshProject()"
      - "Create src/commands/projects.ts dispatcher that routes kata projects <sub> to handlers"
      - "Implement kata projects init-manager in src/commands/projects/init-manager.ts"
      - "Implement kata projects list in src/commands/projects/list.ts"
      - "Implement kata projects add / remove in src/commands/projects/add.ts and remove.ts"
      - "Register projects subcommand in src/index.ts help and dispatch"
    test_cases:
      - id: "decanon-paths"
        description: "decanonPath correctly converts -data-projects-foo to /data/projects/foo"
        type: "unit"
      - id: "discovery-filters-kata"
        description: "scanClaudeProjects only returns directories that have .kata/ or .claude/workflows/wm.yaml"
        type: "unit"
      - id: "registry-crud"
        description: "addProject/removeProject correctly update projects-index.json"
        type: "unit"
      - id: "list-output"
        description: "kata projects list prints table with name, path, version columns"
        type: "integration"
      - id: "init-manager-creates-structure"
        description: "kata projects init-manager creates ~/.kata/manager/.kata/ with expected files"
        type: "integration"
  - id: p3
    name: "Project management — init from manager, doctor, upgrade"
    tasks:
      - "Implement kata projects init /path in src/commands/projects/init.ts (external project setup)"
      - "Implement kata projects doctor in src/commands/projects/doctor.ts with health check runners"
      - "Create src/manager/health-checks.ts with individual check functions (version, templates, hooks, config)"
      - "Implement kata projects upgrade in src/commands/projects/upgrade.ts (bulk batteries --update)"
    test_cases:
      - id: "init-creates-project"
        description: "kata projects init /tmp/test creates valid .kata/ structure at target path"
        type: "integration"
      - id: "doctor-detects-outdated"
        description: "Doctor reports outdated templates when project templates differ from package"
        type: "integration"
      - id: "doctor-detects-missing-hooks"
        description: "Doctor reports missing hook registration in settings.json"
        type: "unit"
      - id: "upgrade-dry-run"
        description: "kata projects upgrade --dry-run reports changes without modifying projects"
        type: "integration"
  - id: p4
    name: "Config operations — compare, sync, backup"
    tasks:
      - "Create src/manager/config-diff.ts with diffWmYaml(), diffModesYaml(), diffTemplates()"
      - "Implement kata projects compare in src/commands/projects/compare.ts"
      - "Implement kata projects sync in src/commands/projects/sync.ts with --wm-yaml, --modes, --templates flags"
      - "Implement kata projects backup in src/commands/projects/backup.ts with timestamped snapshots"
    test_cases:
      - id: "compare-shows-diffs"
        description: "compare correctly identifies differing fields between two project configs"
        type: "unit"
      - id: "sync-copies-selective"
        description: "sync with --wm-yaml copies only wm.yaml, leaves modes.yaml untouched"
        type: "integration"
      - id: "backup-creates-snapshot"
        description: "backup creates timestamped directory with copies of wm.yaml, modes.yaml, and templates"
        type: "integration"
  - id: p5
    name: "Tests and verification"
    tasks:
      - "Unit tests for all manager modules (discovery, registry, config-diff, health-checks)"
      - "Integration tests with temp .kata/ directories for init-manager, list, doctor, upgrade"
      - "Integration tests for compare, sync, backup with two temp projects"
      - "Build + typecheck pass"
      - "Manual smoke test: kata projects list discovers kata-wm project itself"
    test_cases:
      - id: "full-build"
        description: "npm run build && npm test passes with all new tests"
        type: "smoke"
      - id: "self-discovery"
        description: "kata projects list includes the kata-wm project when run from this repo"
        type: "smoke"
---

# Kata Manager Project

> GitHub Issue: [#23](https://github.com/codevibesmatter/kata-wm/issues/23)

## Overview

kata-wm has grown to support rich per-project configuration (wm.yaml, modes.yaml, templates, interviews, subphase patterns) with 3-tier merging, but offers no way to manage multiple kata-enabled projects from a single vantage point. When you maintain 5+ projects, keeping configs consistent, upgrading templates, and diagnosing issues becomes manual and error-prone.

This feature introduces a standalone manager project at `~/.kata/manager/` that acts as a control plane for all kata-enabled projects, exposed through a first-class `kata projects` subcommand tree. It also bundles surgical code-quality fixes (stop condition enum, dead field removal, hardcoded mode-name elimination) that clean up the config layer before building on top of it.

## Feature Behaviors

### B1: Manager Initialization

**Core:**
- **ID:** init-manager
- **Trigger:** User runs `kata projects init-manager`
- **Expected:** Creates `~/.kata/manager/` directory with `.kata/` structure (wm.yaml, sessions/, projects-index.json). Auto-discovers existing kata projects from `~/.claude/projects/` and populates the initial registry. Configures agent paths for external agent access and stores system-wide metadata.
- **Verify:** After running, `~/.kata/manager/.kata/projects-index.json` exists and contains entries for every kata-enabled project discoverable from `~/.claude/projects/`.

#### UI Layer

N/A — CLI tool.

#### API Layer

```
kata projects init-manager [--force]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--force` | `false` | Re-initialize even if manager already exists (preserves existing registry entries) |

**Exit codes:**
- `0` — Manager initialized successfully
- `1` — Manager already exists (without `--force`)
- `1` — Cannot create directory (permissions)

**Stdout:** JSON summary `{ "manager_path": "...", "projects_discovered": N }`
**Stderr:** Progress messages during discovery

#### Data Layer

**Created directory structure:**
```
~/.kata/manager/
├── .kata/
│   ├── wm.yaml                # Manager project config (minimal)
│   ├── sessions/               # Manager session state (for future manager modes)
│   └── projects-index.json     # Discovered project registry
└── backups/                    # Config backup snapshots (B10)
```

**`projects-index.json` schema:**
```typescript
interface ProjectsIndex {
  version: 1
  updated_at: string              // ISO-8601
  projects: ProjectEntry[]
}

interface ProjectEntry {
  path: string                    // Absolute filesystem path
  alias?: string                  // Short name for CLI
  name: string                    // From wm.yaml project.name (or dirname)
  wm_version?: string             // From wm.yaml wm_version
  kata_layout: '.kata' | '.claude'  // Which layout detected
  discovered_from: 'auto' | 'manual'  // How this entry was added
  added_at: string                // ISO-8601
  last_checked_at?: string        // ISO-8601, updated on refresh

  // Snapshot (populated on refresh/doctor)
  modes?: string[]                // Active mode names
  custom_modes?: string[]         // Project-level mode overrides only
  last_session?: {
    id: string
    mode: string
    timestamp: string
  }
}
```

---

### B2: Project Auto-Discovery

**Core:**
- **ID:** auto-discovery
- **Trigger:** `kata projects init-manager` or `kata projects list --refresh`
- **Expected:** Scans `~/.claude/projects/` directory names, de-canonicalizes paths (e.g., `-data-projects-foo` to `/data/projects/foo`), checks each path for kata enablement (`.kata/` dir or `.claude/workflows/wm.yaml`), and adds discovered projects to the registry.
- **Verify:** Given `~/.claude/projects/-data-projects-kata-wm/` exists and `/data/projects/kata-wm/.kata/` exists, the registry includes an entry with `path: "/data/projects/kata-wm"` and `discovered_from: "auto"`.

#### UI Layer

N/A — CLI tool.

#### API Layer

Discovery is an internal function called by `init-manager` and `list --refresh`. No standalone CLI command.

**Programmatic API (exported from `src/manager/discovery.ts`):**
```typescript
function decanonPath(dirName: string): string
function scanClaudeProjects(): ProjectEntry[]
function isKataEnabled(projectPath: string): { enabled: boolean; layout: '.kata' | '.claude' }
```

#### Data Layer

**De-canonicalization algorithm:**
1. Replace leading `-` with `/`
2. Replace all remaining `-` with `/`
3. Handle platform edge cases: on macOS, `/Users/...`; on Linux, `/home/...` or `/data/...`
4. Validate the resulting path exists on the filesystem
5. Skip entries where the path does not exist (stale Claude Code projects)

**Note:** Claude Code's canonicalization replaces `/` with `-`. The reverse is ambiguous for paths containing literal hyphens (e.g., `/data/my-project`). The de-canonicalization tries the most specific path first (longest existing prefix wins) to handle this correctly.

---

### B3: Project Registration (add/remove)

**Core:**
- **ID:** project-registration
- **Trigger:** User runs `kata projects add /path/to/project` or `kata projects remove <alias-or-path>`
- **Expected:** `add` validates the path exists and is kata-enabled, creates a `ProjectEntry` with `discovered_from: "manual"`, and writes to registry. `remove` finds the entry by alias or path and removes it.
- **Verify:** After `kata projects add /tmp/test --alias=test`, `projects-index.json` contains an entry with `alias: "test"` and `path: "/tmp/test"`. After `kata projects remove test`, the entry is gone.
- **Source:** NEW `src/commands/projects/add.ts`, `src/commands/projects/remove.ts`

#### UI Layer

N/A — CLI tool.

#### API Layer

```
kata projects add <path> [--alias=<name>]
kata projects remove <alias-or-path>
```

**add exit codes:**
- `0` — Project added
- `1` — Path does not exist
- `1` — Path is not kata-enabled (no `.kata/` or `.claude/workflows/wm.yaml`)
- `1` — Project already registered (use `--alias` to update alias)

**remove exit codes:**
- `0` — Project removed
- `1` — No project found matching the argument

**Stdout:** JSON `{ "action": "added"|"removed", "path": "...", "alias": "..." }`

#### Data Layer

Modifies `~/.kata/manager/.kata/projects-index.json`. No schema changes beyond the `ProjectEntry` defined in B1.

---

### B4: Project Listing

**Core:**
- **ID:** project-list
- **Trigger:** User runs `kata projects list`
- **Expected:** Reads registry, optionally refreshes stale entries, outputs a table with columns: Name, Path, Version, Last Mode, Layout. Supports `--json` for machine-readable output.
- **Verify:** Running `kata projects list` after `init-manager` shows at least the kata-wm project with correct path and layout.

#### UI Layer

N/A — CLI tool.

#### API Layer

```
kata projects list [--json] [--refresh]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--json` | `false` | Output as JSON array instead of table |
| `--refresh` | `false` | Re-scan `~/.claude/projects/` and refresh project metadata before listing |

**Table output format:**
```
Name             Version   Last Mode     Layout   Path
───────────────────────────────────────────────────────────────
kata-wm          1.0.5     planning      .kata    /data/projects/kata-wm
baseplane        1.0.3     task          .claude  /data/projects/baseplane
```

**JSON output format:**
```json
[
  {
    "name": "kata-wm",
    "path": "/data/projects/kata-wm",
    "wm_version": "1.0.5",
    "last_mode": "planning",
    "kata_layout": ".kata"
  }
]
```

#### Data Layer

Reads `~/.kata/manager/.kata/projects-index.json`. When `--refresh` is passed, also reads each project's `wm.yaml` and most recent session state to update snapshot fields.

---

### B5: Project Init from Manager

**Core:**
- **ID:** project-init-from-manager
- **Trigger:** User runs `kata projects init /path/to/project`
- **Expected:** Creates `.kata/` structure at the target path (equivalent to `kata setup --batteries` but executed externally), registers the project in the manager. This avoids the chicken-and-egg problem where hooks fire during partial setup inside the project.
- **Verify:** After `kata projects init /tmp/test-project`, the path has `.kata/wm.yaml`, `.kata/templates/`, `.claude/settings.json` with hooks, and the project appears in `kata projects list`.
- **Source:** NEW `src/commands/projects/init.ts`

#### UI Layer

N/A — CLI tool.

#### API Layer

```
kata projects init <path> [--alias=<name>] [--no-batteries]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--alias` | (none) | Short name for the project in the registry |
| `--no-batteries` | `false` | Skip copying battery templates (minimal setup) |

**Exit codes:**
- `0` — Project initialized and registered
- `1` — Path does not exist or is not writable
- `1` — Project already has `.kata/` (use `kata batteries --update` instead)

**Behavior:**
1. Create `.kata/` directory with `wm.yaml`, `sessions/`, `templates/`
2. Create `.claude/settings.json` with hook registrations
3. If `--no-batteries` is not set, copy battery templates to `.kata/templates/`
4. Register the project in the manager's `projects-index.json`

#### Data Layer

Creates the standard `.kata/` layout at the target path. Same structure as `kata setup --batteries` produces but driven externally. See CLAUDE.md "Runtime data layout" for the full file listing.

---

### B6: Cross-Project Doctor

**Core:**
- **ID:** cross-project-doctor
- **Trigger:** User runs `kata projects doctor [project-alias-or-path]`
- **Expected:** Runs health checks across all registered projects (or a single project if specified). Checks include: kata version consistency, template freshness (compare to package versions), hook registration health (settings.json intact), config validation (stop conditions reference valid types, template references resolve, modes reference existing templates). Reports per-project health. `--fix` auto-repairs what it can.
- **Verify:** Running `kata projects doctor` on a project with an outdated template reports "template X is N versions behind". Running with `--fix` updates it.
- **Source:** NEW `src/commands/projects/doctor.ts`, `src/manager/health-checks.ts`

#### UI Layer

N/A — CLI tool.

#### API Layer

```
kata projects doctor [<project>] [--fix] [--json]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--fix` | `false` | Auto-repair detected issues (updates templates, fixes hooks) |
| `--json` | `false` | Output results as JSON |

**Health check categories:**

| Check | Severity | Auto-fixable | Description |
|-------|----------|-------------|-------------|
| `version-consistency` | warning | no | All projects should be on the same wm_version |
| `template-freshness` | warning | yes | Project templates match current package versions |
| `hook-registration` | error | yes | `.claude/settings.json` has required hook entries |
| `config-validation` | error | no | stop_conditions use valid types, templates exist |
| `stale-sessions` | info | yes | Session state files older than 30 days |
| `layout-consistency` | info | no | Projects using `.kata/` vs `.claude/` layout |

**Output format (human-readable):**
```
kata-wm (/data/projects/kata-wm)
  [ok]   version-consistency: 1.0.5
  [ok]   template-freshness: all current
  [ok]   hook-registration: 4/4 hooks registered
  [warn] stale-sessions: 3 sessions older than 30 days

baseplane (/data/projects/baseplane)
  [err]  template-freshness: planning.md outdated (package: abc123, project: def456)
  [ok]   hook-registration: 4/4 hooks registered

Summary: 2 projects checked, 1 warning, 1 error
```

#### Data Layer

Reads each project's `.kata/` (or `.claude/`) directory. Compares template file contents against package `batteries/templates/` using content hashing. Health check results are not persisted (stateless command) unless `--json` output is redirected.

---

### B7: Bulk Upgrade

**Core:**
- **ID:** bulk-upgrade
- **Trigger:** User runs `kata projects upgrade [project]`
- **Expected:** Runs the equivalent of `kata batteries --update` for all registered projects (or a single project). Reports per-project what changed (templates updated, config fields added). `--dry-run` previews without modifying.
- **Verify:** After upgrading a project with outdated templates, `kata projects doctor` reports all templates current.
- **Source:** NEW `src/commands/projects/upgrade.ts`

#### UI Layer

N/A — CLI tool.

#### API Layer

```
kata projects upgrade [<project>] [--dry-run] [--templates] [--config]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--dry-run` | `false` | Show what would change without modifying anything |
| `--templates` | upgrade all | Only update templates |
| `--config` | upgrade all | Only update config files (wm.yaml defaults) |

**Output format:**
```
Upgrading kata-wm (/data/projects/kata-wm)
  [skip] templates: already current
  [skip] config: already current

Upgrading baseplane (/data/projects/baseplane)
  [updated] templates: planning.md, implementation.md
  [skip]    config: already current

Summary: 2 projects, 1 upgraded, 2 templates updated
```

**Exit codes:**
- `0` — All upgrades successful (or dry-run)
- `1` — One or more projects failed to upgrade (partial success still upgrades what it can)

#### Data Layer

Modifies template files and potentially wm.yaml in target projects. Same files that `kata batteries --update` touches. Does not modify the manager's own `projects-index.json` (though `last_checked_at` gets updated as a side effect of reading project config).

---

### B8: Config Comparison

**Core:**
- **ID:** config-compare
- **Trigger:** User runs `kata projects compare [project-a] [project-b]`
- **Expected:** Diffs wm.yaml and modes.yaml between two projects. Shows fields that differ, fields unique to each, and shared values. If only one project is specified, compares against package defaults. If no projects specified, shows a matrix of all registered projects.
- **Verify:** Comparing two projects where one has a custom `spec_path` override shows the difference clearly.
- **Source:** NEW `src/commands/projects/compare.ts`, `src/manager/config-diff.ts`

#### UI Layer

N/A — CLI tool.

#### API Layer

```
kata projects compare [<project-a>] [<project-b>] [--json] [--wm-yaml] [--modes]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--json` | `false` | Output as structured JSON diff |
| `--wm-yaml` | compare all | Only compare wm.yaml |
| `--modes` | compare all | Only compare modes.yaml |

**Output format (two-project diff):**
```
Comparing: kata-wm vs baseplane

wm.yaml:
  spec_path:
    kata-wm:   planning/specs
    baseplane:  docs/specs

modes.yaml:
  custom modes in kata-wm only: eval
  custom modes in baseplane only: deploy
  shared custom modes: (none)
```

#### Data Layer

**`src/manager/config-diff.ts` functions:**
```typescript
function diffWmYaml(a: WmConfig, b: WmConfig): ConfigDiff
function diffModesYaml(a: ModesConfig, b: ModesConfig): ModesDiff
function diffTemplates(pathA: string, pathB: string): TemplateDiff[]

interface ConfigDiff {
  shared: Record<string, unknown>      // Same key, same value
  different: Record<string, { a: unknown; b: unknown }>  // Same key, different value
  only_a: Record<string, unknown>      // Only in project A
  only_b: Record<string, unknown>      // Only in project B
}
```

Read-only — does not modify any project files.

---

### B9: Config Sync

**Core:**
- **ID:** config-sync
- **Trigger:** User runs `kata projects sync <source> <target>`
- **Expected:** Copies selected config files from source project to target project. Selective flags `--wm-yaml`, `--modes`, `--templates` control what gets copied. `--dry-run` previews the operation. Without selective flags, copies all config.
- **Verify:** After `kata projects sync kata-wm baseplane --modes`, baseplane's modes.yaml matches kata-wm's.
- **Source:** NEW `src/commands/projects/sync.ts`

#### UI Layer

N/A — CLI tool.

#### API Layer

```
kata projects sync <source> <target> [--wm-yaml] [--modes] [--templates] [--dry-run]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--wm-yaml` | sync all | Only sync wm.yaml |
| `--modes` | sync all | Only sync modes.yaml |
| `--templates` | sync all | Only sync templates directory |
| `--dry-run` | `false` | Show what would be copied without modifying target |

**Exit codes:**
- `0` — Sync completed
- `1` — Source or target not found in registry
- `1` — Target path not writable

**Safety:** Always creates a backup of overwritten files (see B10) before syncing.

#### Data Layer

Copies files between project directories. Respects layout differences: if source uses `.kata/` and target uses `.claude/`, the sync maps paths correctly using `resolveKataPath()` logic.

---

### B10: Config Backup

**Core:**
- **ID:** config-backup
- **Trigger:** User runs `kata projects backup [project]` or triggered automatically before sync/upgrade operations
- **Expected:** Creates a timestamped snapshot of a project's config files (wm.yaml, modes.yaml, templates/) in the manager's `backups/` directory. If no project specified, backs up all registered projects.
- **Verify:** After `kata projects backup kata-wm`, `~/.kata/manager/backups/kata-wm/2026-02-25T120000Z/` contains copies of wm.yaml, modes.yaml, and templates/.
- **Source:** NEW `src/commands/projects/backup.ts`

#### UI Layer

N/A — CLI tool.

#### API Layer

```
kata projects backup [<project>] [--list] [--restore=<timestamp>]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--list` | `false` | List existing backups instead of creating one |
| `--restore=<ts>` | (none) | Restore a specific backup to the project |

**Backup directory structure:**
```
~/.kata/manager/backups/
└── kata-wm/
    ├── 2026-02-25T120000Z/
    │   ├── wm.yaml
    │   ├── modes.yaml
    │   └── templates/
    │       ├── planning.md
    │       └── implementation.md
    └── 2026-02-24T090000Z/
        └── ...
```

**Exit codes:**
- `0` — Backup created (or listed)
- `1` — Project not found

#### Data Layer

Creates directories under `~/.kata/manager/backups/<project-name>/<ISO-timestamp>/`. Files are plain copies (not compressed). Backup retention is unbounded in v1 — no automatic pruning.

---

### B11: Stop Condition Enum (bundled fix)

**Core:**
- **ID:** stop-condition-enum
- **Trigger:** Loading or validating `modes.yaml` via `ModeConfigSchema`
- **Expected:** `stop_conditions` field validates against a const array of known types instead of accepting arbitrary strings. Invalid values produce a clear Zod validation error.
- **Verify:** A modes.yaml with `stop_conditions: ["tasks_complete", "bogus"]` fails schema validation with an error mentioning "bogus" is not a valid stop condition.
- **Source:** `src/state/schema.ts:170`

#### UI Layer

N/A — CLI tool.

#### API Layer

No CLI changes. Schema validation is internal.

#### Data Layer

**New const in `src/state/schema.ts`:**
```typescript
export const STOP_CONDITION_TYPES = [
  'tasks_complete',
  'committed',
  'pushed',
  'verification',
  'tests_pass',
  'feature_tests_added',
] as const

export type StopCondition = typeof STOP_CONDITION_TYPES[number]
```

**Schema change:**
```typescript
// Before:
stop_conditions: z.array(z.string()).optional()

// After:
stop_conditions: z.array(z.enum(STOP_CONDITION_TYPES)).optional()
```

---

### B12: Remove Hardcoded Mode Names (bundled fix)

**Core:**
- **ID:** remove-hardcoded-modes
- **Trigger:** Any code path in `enter.ts` or `suggest.ts` that currently checks mode names as strings
- **Expected:** Add `notes_file_template` field (string template for generating notes file paths, e.g., `"planning/research/{date}-{slug}.md"`) and `issue_label` field (GitHub label to apply, e.g., `"feature"`, `"research"`) to `ModeConfigSchema`. Replace hardcoded mode name checks with lookups against these config fields.
- **Verify:** Adding a custom mode with `issue_label: "experiment"` in project modes.yaml causes `suggest.ts` to use that label. No string comparison against `"planning"` or `"research"` remains in TypeScript source.
- **Source:** `src/state/schema.ts:149`, `src/commands/enter.ts`, `src/commands/suggest.ts`

#### UI Layer

N/A — CLI tool.

#### API Layer

No CLI changes. Config schema gains two optional fields.

#### Data Layer

**New fields in `ModeConfigSchema`:**
```typescript
notes_file_template: z.string().optional(),  // e.g., "planning/research/{date}-{slug}.md"
issue_label: z.string().optional(),          // e.g., "feature", "bug", "research"
```

**modes.yaml additions (examples):**
```yaml
planning:
  issue_label: "feature"
  notes_file_template: "planning/specs/{issue}-{slug}.md"

research:
  issue_label: "research"
  notes_file_template: "planning/research/{date}-{slug}.md"

implementation:
  issue_label: "feature"
```

---

### B13: Dead Field Cleanup (bundled fix)

**Core:**
- **ID:** dead-field-cleanup
- **Trigger:** Schema validation of mode config
- **Expected:** Remove `micro_planning` field from `ModeConfigSchema` (no mode uses it; the schema has `passthrough()` on `SessionState` so existing YAML files with the field won't hard-break). Fix `workflow_prefix` fallback in `enter.ts` line 599: currently uses `canonical.toUpperCase().slice(0, 2)` as fallback, which should instead read from config (already done for modes that set it, but the fallback should be explicit about being derived from mode name). Export `VALID_CATEGORIES` from `schema.ts` so `init-mode.ts` and `register-mode.ts` import it instead of defining their own local copies.
- **Verify:** `grep -r "micro_planning" src/` returns zero matches in TypeScript (YAML files may still have it for deprecated modes). `VALID_CATEGORIES` is defined only in `schema.ts`.
- **Source:** `src/state/schema.ts:168`, `src/commands/enter.ts:599`, `src/commands/init-mode.ts:17`, `src/commands/register-mode.ts:17`

#### UI Layer

N/A — CLI tool.

#### API Layer

No CLI changes.

#### Data Layer

**Removed from `ModeConfigSchema`:**
```typescript
// DELETE:
micro_planning: z.boolean().optional(),
```

**Exported from `schema.ts`:**
```typescript
export const VALID_CATEGORIES = [
  'planning',
  'implementation',
  'investigation',
  'management',
  'special',
  'system',
] as const
```

**Note:** The `category` enum in `ModeConfigSchema` already lists these values. `VALID_CATEGORIES` should be derived from or kept in sync with that enum definition.

---

## Non-Goals

Explicitly out of scope for this feature:

- **No "golden config" concept.** The research doc explored a `golden/` directory for team-recommended config. User interviews rejected this in favor of direct project-to-project compare/sync. No golden config seeding or pushing.
- **No cross-project workflow orchestration.** The manager does not trigger modes in child projects (e.g., no "run `kata enter upgrade` in all projects"). It reads and modifies config, but does not start kata sessions in other projects.
- **No web UI or dashboard.** All interaction is through `kata projects` CLI subcommands.
- **No CI integration.** Doctor and audit do not produce CI-friendly exit codes or GitHub Actions integration. This can be added later.
- **No manager-specific kata modes.** The research doc proposed audit/upgrade/onboard modes that run inside the manager project. These are deferred to v2. The manager is just a `.kata/` structure for the registry — no custom modes or templates ship with it.
- **No automatic manager initialization.** `kata setup` does not prompt to create the manager. It must be explicitly created with `kata projects init-manager`.
- **No backup pruning.** Backups accumulate without automatic cleanup. A `--prune` flag can be added later.

## Open Questions

- [ ] **De-canonicalization ambiguity:** Claude Code's path canonicalization (`/data/my-project` becomes `-data-my-project`) is ambiguous for paths with hyphens. Should we store a reverse-mapping file in `~/.claude/projects/` metadata, or is the "longest existing prefix" heuristic sufficient?
- [ ] **Manager location:** The research doc proposed `~/.config/kata/manager/`. User interviews said `~/.kata/manager/`. Which one? (Spec uses `~/.kata/manager/` per interview decision.)
- [ ] **Cross-layout sync safety:** When syncing config between a `.kata/` project and a `.claude/` project, should sync automatically remap paths or require both projects to use the same layout?
- [ ] **Registry staleness:** How long before a project entry is considered stale? Should `kata projects list` automatically prune entries whose paths no longer exist?

## Implementation Phases

See YAML frontmatter `phases:` for the full task breakdown. Summary:

1. **P1: Surgical fixes** — Stop condition enum, dead field removal, hardcoded mode-name elimination. Cleans up the config layer before building new features on top. This phase modifies `src/state/schema.ts`, `src/commands/enter.ts`, `src/commands/suggest.ts`, `src/commands/init-mode.ts`, `src/commands/register-mode.ts`, and `modes.yaml`.

2. **P2: Manager foundation** — Create `src/manager/` module with discovery, registry, and path utilities. Implement `kata projects init-manager`, `kata projects list`, `kata projects add`, `kata projects remove`. Register the `projects` subcommand in `src/index.ts`.

3. **P3: Project management** — Implement `kata projects init` (external project setup), `kata projects doctor` (cross-project health checks), `kata projects upgrade` (bulk batteries update). Create `src/manager/health-checks.ts` with composable check functions.

4. **P4: Config operations** — Implement `kata projects compare`, `kata projects sync`, `kata projects backup`. Create `src/manager/config-diff.ts` for structured config comparison.

5. **P5: Tests and verification** — Unit tests for all manager modules, integration tests with temp directories, build/typecheck verification, manual smoke tests.

## Verification Strategy

### Test Infrastructure

Node's built-in test runner (`node --test`) via `dist/testing/index.js`. Test files live alongside source with `.test.ts` suffixes. Integration tests will use `mkdtempSync` to create temporary `.kata/` directories, simulating multi-project setups without touching real user config.

Key testing patterns:
- **Discovery tests:** Create mock `~/.claude/projects/` directory structures in temp dirs, override the scan path via a parameter
- **Registry tests:** Create temp `projects-index.json`, exercise CRUD operations
- **Doctor/upgrade tests:** Create two temp projects with different template versions, verify detection and fix
- **Config-diff tests:** Create two `WmConfig` objects with known differences, assert diff output

### Build Verification

`npm run build && npm test` — the standard build-then-test flow. `npm run typecheck` for type-only verification without emitting. All must pass after each phase.

## Implementation Hints

### Dependencies

No new dependencies. The feature uses only existing dependencies:
- `zod` — schema validation for ProjectsIndex, health check results
- `js-yaml` — YAML parsing for reading project configs
- `node:fs`, `node:path`, `node:os` — filesystem operations, home directory resolution

### Key Imports

| Module | Import | Used For |
|--------|--------|----------|
| `src/session/lookup.ts` | `{ getKataDir, findProjectDir }` | Detect project layout when scanning |
| `src/config/wm-config.ts` | `{ loadWmConfig }` | Read project wm.yaml for metadata |
| `src/config/cache.ts` | `{ loadModesConfig }` | Read project modes.yaml for mode listing |
| `src/commands/batteries.ts` | `{ batteries }` | Reuse for upgrade command (run per-project) |
| `src/state/schema.ts` | `{ STOP_CONDITION_TYPES, VALID_CATEGORIES }` | New exports from P1 |

### Code Patterns

**De-canonicalization (discovery):**
```typescript
function decanonPath(dirName: string): string {
  // Claude Code canonicalization: replace / with -
  // Reverse: replace leading - with /, then try path segments
  const candidate = '/' + dirName.slice(1).replace(/-/g, '/')
  if (existsSync(candidate)) return candidate

  // Ambiguity handling: try shorter segments
  // e.g., -data-my-project could be /data/my-project or /data/my/project
  // Use longest-existing-prefix heuristic
  const parts = dirName.slice(1).split('-')
  for (let i = parts.length; i >= 1; i--) {
    const prefix = '/' + parts.slice(0, i).join('/')
    if (existsSync(prefix)) {
      const rest = parts.slice(i).join('-')
      const full = rest ? join(prefix, rest) : prefix
      if (existsSync(full)) return full
    }
  }
  return candidate // Best guess
}
```

**Health check composability (doctor):**
```typescript
interface HealthCheck {
  id: string
  severity: 'error' | 'warning' | 'info'
  fixable: boolean
  run(project: ProjectEntry): HealthResult
  fix?(project: ProjectEntry): void
}

interface HealthResult {
  status: 'ok' | 'warn' | 'error'
  message: string
}
```

**Subcommand dispatcher (projects.ts):**
```typescript
const SUBCOMMANDS: Record<string, (args: string[]) => Promise<void>> = {
  'init-manager': initManager,
  'list': listProjects,
  'add': addProject,
  'remove': removeProject,
  'init': initProject,
  'doctor': doctorProjects,
  'upgrade': upgradeProjects,
  'compare': compareProjects,
  'sync': syncProjects,
  'backup': backupProjects,
}

export async function projects(args: string[]): Promise<void> {
  const sub = args[0]
  const handler = SUBCOMMANDS[sub]
  if (!handler) {
    printUsage()
    process.exit(1)
  }
  await handler(args.slice(1))
}
```

### Gotchas

- **De-canonicalization is lossy.** Claude Code's `-` replacement means `/data/my-project` and `/data/my/project` produce the same canonicalized name. The heuristic works for typical project paths but can fail for unusual directory structures.
- **Layout differences between projects.** When reading config from discovered projects, always use `getKataDir()` to detect which layout is in use. Never assume `.kata/`.
- **Manager is not inside a git repo.** `~/.kata/manager/` is a standalone directory, not a git repository. This means `findProjectDir()` (which walks up to `.git`) will not find it. Manager commands must accept an explicit path or use a dedicated `getManagerDir()` function.
- **Stop condition enum is a breaking change for invalid configs.** Any project with a typo in `stop_conditions` (e.g., `"commited"`) will fail validation after P1. The doctor command (P3) should detect and suggest fixes for this before users hit it.
- **`batteries --update` must work with `--cwd`.** The upgrade command needs to run batteries update against a different project directory. Verify that `batteries` supports `--cwd` or pass the project root explicitly.

### Reference Docs

- [kata-wm CLAUDE.md](/data/projects/kata-wm/CLAUDE.md) — Architecture overview, runtime data layout, hook architecture
- [Config traceability research](/data/projects/kata-wm/planning/research/2026-02-25-config-traceability-refactor.md) — Predecessor research on config complexity, Options A-D analysis
- [Manager project research](/data/projects/kata-wm/planning/research/2026-02-25-kata-manager-project.md) — Full design exploration that led to this spec
- [Subphase patterns spec](/data/projects/kata-wm/planning/specs/18-subphase-patterns.md) — Example of config extraction pattern (batteries YAML, 2-tier merge, cached loader)
