# Kata Manager: Standalone Project for Multi-Project Management

**Date**: 2026-02-25
**Workflow**: RE-e2c4-0225
**Status**: Research findings
**Builds on**: [Config Traceability Audit](./2026-02-25-config-traceability-refactor.md)

## Core Idea

When you `kata setup`, instead of just configuring the current project, you also establish (or connect to) a **standalone manager project** — a kata-enabled project that acts as the control plane for all your kata projects. It provides the "3rd party perspective" for analyzing, upgrading, and maintaining consistency across projects.

The manager is not inside any code project. It's infrastructure.

---

## 1. Why a Manager Project

### Problem: Config power without config management

kata-wm has 6 config files, 3-tier merging, custom modes, custom templates, custom interviews, custom subphase patterns. This is powerful for individual projects but creates problems at scale:

- **No visibility**: "What modes are my 8 projects using? Are any on old templates?"
- **No consistency**: Each project's config drifts independently
- **Manual upgrades**: `kata batteries --update` must be run per-project
- **No golden config**: Teams can't define "our standard setup" and push it to projects
- **No audit trail**: Config changes happen silently with no cross-project view

### Solution: A kata project that manages kata projects

The manager project uses kata's own mode/template system to run management workflows. It's not a separate tool — it's kata managing itself.

---

## 2. Where It Lives

```
~/.config/kata/manager/
├── .kata/
│   ├── wm.yaml                # Manager project config
│   ├── modes.yaml              # Manager-specific modes (audit, upgrade, etc.)
│   ├── templates/              # Manager workflow templates
│   ├── sessions/               # Manager session state
│   └── projects-index.json     # Discovered project registry (cached)
├── .claude/
│   └── settings.json           # Manager hooks
├── golden/                     # Golden config templates
│   ├── wm.yaml                 # Recommended project config
│   ├── modes.yaml              # Recommended mode overrides
│   └── templates/              # Recommended templates
└── reports/                    # Audit/analysis output
    └── 2026-02-25-audit.md
```

**Key decisions**:
- Lives at `~/.config/kata/manager/` — user-level, not tied to any code project
- Has its own `.kata/` — it IS a kata project, uses kata modes
- Has its own `.claude/settings.json` — hooks fire when Claude opens it
- `golden/` directory holds the team's preferred config (can be version-controlled separately)

---

## 3. Project Discovery

### Auto-discovery from Claude Code's registry

Claude Code already tracks every project you've opened at `~/.claude/projects/`. Directory names are canonicalized paths:

```
~/.claude/projects/
├── -data-projects-baseplane/        → /data/projects/baseplane
├── -data-projects-kata-wm/          → /data/projects/kata-wm
├── -data-projects-my-app/           → /data/projects/my-app
└── ...
```

**Discovery algorithm**:

```
1. Scan ~/.claude/projects/ directory names
2. De-canonicalize each name → filesystem path
3. For each path that exists:
   a. Check for .kata/ or .claude/workflows/wm.yaml → is kata-enabled?
   b. If yes:
      - Read wm.yaml → extract project name, version, commands
      - Read modes.yaml → extract active modes, overrides
      - Find most recent session → extract last mode, timestamp
      - Read template versions → compare to package versions
4. Cache results in projects-index.json
5. On subsequent queries, use cache; refresh stale entries on demand
```

### Manual registration

```bash
kata projects add /path/to/project          # Explicit registration
kata projects add /path/to/project --alias=api  # With alias
kata projects remove api                     # Unregister
```

### Registry schema

```typescript
// projects-index.json
interface ProjectsIndex {
  version: 1
  updated_at: string                // ISO-8601
  projects: ProjectEntry[]
}

interface ProjectEntry {
  path: string                      // Absolute filesystem path
  alias?: string                    // Short name for CLI
  name: string                      // From wm.yaml project.name
  wm_version: string                // From wm.yaml wm_version
  kata_layout: '.kata' | '.claude'  // Which layout detected

  // Snapshot (refreshed on demand)
  modes: string[]                   // Active mode names (built-in + overrides)
  custom_modes: string[]            // Project-level mode overrides only
  template_versions: Record<string, string>  // template name → hash/timestamp
  last_session?: {
    id: string
    mode: string
    timestamp: string
    status: 'active' | 'completed' | 'abandoned'
  }

  // Drift detection
  config_drift?: {
    wm_fields_overridden: string[]
    modes_overridden: string[]
    custom_templates: string[]
    outdated_templates: string[]
  }
}
```

---

## 4. Manager Commands

### Project listing and status

```bash
kata projects list                    # Table: name, path, version, last mode, drift
kata projects list --json             # Machine-readable
kata projects status                  # Detailed status of all projects
kata projects status api              # Status of one project (by alias)
```

**Example output**:
```
Project          Version   Last Mode     Drift    Path
─────────────────────────────────────────────────────────
baseplane        1.0.5     planning      none     /data/projects/baseplane
my-app           1.0.3     task          2 old    /data/projects/my-app
kata-wm          1.0.5     research      none     /data/projects/kata-wm
```

### Health checks

```bash
kata projects doctor                  # Run doctor on all projects
kata projects doctor api              # Doctor one project
kata projects doctor --fix            # Auto-fix across all
```

**Cross-project checks**:
- Version consistency (all projects on same wm_version?)
- Template freshness (any using outdated templates?)
- Config drift from golden config
- Dead sessions (stale session state files)
- Hook registration health (settings.json intact?)

### Upgrades

```bash
kata projects upgrade                 # Upgrade all projects to current package version
kata projects upgrade api             # Upgrade one project
kata projects upgrade --dry-run       # Preview what would change
kata projects upgrade --templates     # Only update templates
kata projects upgrade --config        # Only update wm.yaml defaults
```

**What upgrade does per project**:
1. Run `kata batteries --update --cwd=<project-path>`
2. Merge any new default config fields into wm.yaml (preserving overrides)
3. Report what changed

### Audit and analysis

```bash
kata projects audit                   # Compare all projects against golden config
kata projects audit --diff            # Show config diffs
kata projects audit --report          # Generate markdown report
```

**Audit output**:
```
Config Drift Report — 2026-02-25

baseplane:
  ✓ modes.yaml matches golden
  ✓ templates up to date
  ⚠ wm.yaml: spec_path overridden (planning/specs → docs/specs)

my-app:
  ✗ 2 templates outdated (planning.md, implementation.md)
  ✗ modes.yaml: custom mode 'deploy' not in golden
  ⚠ wm.yaml: missing verify_command
```

### Golden config management

```bash
kata projects golden init             # Create golden/ from current best project
kata projects golden push             # Push golden config to all projects
kata projects golden push api         # Push to one project
kata projects golden diff api         # Show how project differs from golden
```

---

## 5. Manager as a Kata Mode

The manager project itself runs kata modes. Its modes are management workflows:

```yaml
# ~/.config/kata/manager/.kata/modes.yaml
modes:
  audit:
    name: "Project Audit"
    description: "Analyze all managed projects for drift and issues"
    template: "audit.md"
    stop_conditions: [tasks_complete, committed]
    issue_handling: none

  upgrade:
    name: "Project Upgrade"
    description: "Upgrade managed projects to latest kata version"
    template: "upgrade.md"
    stop_conditions: [tasks_complete, committed]
    issue_handling: none

  onboard:
    name: "Onboard Project"
    description: "Add a new project to the management registry"
    template: "onboard-project.md"
    stop_conditions: [tasks_complete]
    issue_handling: none
```

This means the manager gets all of kata's workflow guarantees — phases, tasks, stop conditions, session tracking. Managing projects IS a workflow.

---

## 6. Integration with `kata setup`

### First-time setup (no manager exists)

```bash
$ kata setup --batteries
# ... normal project setup ...

Kata Manager: No manager project found at ~/.config/kata/manager/
Initialize manager? [Y/n] y

✓ Created manager project at ~/.config/kata/manager/
✓ Registered /data/projects/my-app as managed project
✓ Golden config seeded from this project's config

Manage all your kata projects:
  kata projects list       # See registered projects
  kata projects doctor     # Health check all projects
  kata projects upgrade    # Bulk upgrade
```

### Subsequent setup (manager exists)

```bash
$ kata setup --batteries
# ... normal project setup ...

✓ Registered /data/projects/new-app in kata manager
✓ Applied golden config defaults
```

### Setup without manager

```bash
$ kata setup --batteries --no-manager
# Standalone project, not registered
```

---

## 7. Implementation Phases

### Phase 1: Discovery + Registry (foundation)

- `kata projects list` — scan ~/.claude/projects/, filter kata-enabled, display
- `projects-index.json` — cached registry with refresh
- De-canonicalize Claude Code's directory names → paths
- Read each project's wm.yaml and modes.yaml for metadata

### Phase 2: Doctor + Audit (read-only analysis)

- `kata projects doctor` — run per-project checks across all projects
- `kata projects audit` — compare configs, detect drift
- Report generation (markdown output to reports/)
- Version comparison (template hashes, wm_version)

### Phase 3: Golden Config + Upgrade (write operations)

- `golden/` directory with recommended configs
- `kata projects golden init` — seed from best project
- `kata projects upgrade` — bulk `batteries --update`
- `kata projects golden push` — sync golden to projects

### Phase 4: Manager Modes (full workflow)

- Manager-specific templates (audit.md, upgrade.md, onboard-project.md)
- Manager as a proper kata project with sessions, phases, tasks
- `kata setup` integration — auto-register, offer manager init

---

## 8. Design Constraints

### Must preserve project autonomy

Each project remains fully functional standalone. The manager coordinates but doesn't control:
- Projects work without a manager
- Manager reads project config but doesn't own it
- `golden push` is explicit, not automatic
- No implicit config injection

### Must be optional

- `--no-manager` flag on setup
- Projects can exist outside the registry
- Manager commands gracefully handle unregistered projects

### Must use kata's own primitives

- Manager is a kata project (has .kata/, runs modes)
- Management workflows use templates, phases, tasks
- No special-case code — just modes.yaml + templates

### Must piggyback on Claude Code

- Discovery uses `~/.claude/projects/` — no separate scanning
- Manager project itself is a Claude Code project
- Can open manager in Claude Code and run `kata enter audit`

---

## 9. What This Replaces in the Config Complexity Story

The earlier research (config-traceability-refactor.md) proposed Options A-D for simplifying config. The manager project changes the calculus:

| Earlier Option | Still needed? | Why |
|---|---|---|
| **A: Surgical fixes** | **Yes** | Stop condition enum, dead fields — these are code quality regardless |
| **B: Validation layer** | **Partially** | `kata doctor --config` becomes `kata projects doctor` in the manager. PhaseId utility still useful. |
| **C: Config registry** | **Replaced** | Provenance tracking moves to the manager's audit. Cross-reference validation moves to `kata projects doctor`. |
| **D: Schema redesign** | **No** | Config stays multi-file. Manager provides the unified view without restructuring. |

**Net recommendation**: Do Option A (surgical fixes) + build the manager. Skip B/C/D — the manager provides the "unified view" without touching the config architecture.

---

## 10. Open Questions

1. **Git-backed golden config?** Should `~/.config/kata/manager/golden/` be its own git repo for version-controlled team config? Or is it local-only?

2. **Team sharing?** Could teams share a manager config via a shared repo? (e.g., `company/kata-golden` repo that team members clone to `~/.config/kata/manager/golden/`)

3. **CI integration?** Should `kata projects doctor` have a CI-friendly exit code for enforcing golden config compliance?

4. **Cross-project workflows?** Should the manager be able to trigger modes in child projects? (e.g., "run `kata enter upgrade` in all projects") Or is that out of scope for v1?

5. **Manager location flexibility?** Always `~/.config/kata/manager/` or should teams be able to put it in a shared location?
