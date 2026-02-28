# @baseplane/workflow-management

Workflow management CLI for Claude Code sessions. Provides mode-based workflows with phase tracking, bead creation, and template-driven guidance.

## Installation

Available via pnpm from the monorepo root:

```bash
pnpm wm <command>
```

## Quick Start

```bash
# Enter a workflow mode
pnpm wm enter task              # Small tasks (plan → implement → complete)
pnpm wm enter planning          # Feature planning (research → spec → review)
pnpm wm enter implementation    # Issue-backed work (requires GitHub issue)
pnpm wm enter bugfix            # Bug investigation and fix

# Check status
pnpm wm status                  # Current mode, phase, and progress
pnpm wm can-exit                # Check if stop conditions are met

# Template operations
pnpm wm validate-template templates/task.md    # Validate a template
pnpm wm init-template /tmp/custom.md           # Create new template
pnpm wm init-mode custom-mode                  # Create mode + register it
```

## Commands

| Command | Description |
|---------|-------------|
| `enter <mode>` | Enter a workflow mode (creates phase beads) |
| `status` | Show current mode, phase, and progress |
| `can-exit` | Check stop conditions (used by hooks) |
| `prompt` | Output current template content |
| `validate-template <path>` | Validate a template file |
| `init-template <path>` | Create a new template with boilerplate |
| `init-mode <name>` | Create a new mode (template + modes.yaml entry) |
| `register-mode <path>` | Register existing template as a mode |
| `prime` | Output workflow context reminder |
| `doctor` | Check and fix common issues |

## Available Modes

| Mode | Phases | Use For |
|------|--------|---------|
| `task` | Plan → Implement → Complete | Small tasks (< 1 hour) |
| `planning` | Research → Spec → Review → Breakdown | Feature design |
| `implementation` | Claim → Implement → Verify → Close | Issue-backed work |
| `bugfix` | Investigate → Fix → Verify | Bug fixes |
| `research` | Explore → Synthesize | Exploration & learning |
| `debug` | Investigate → Document | Root cause analysis |
| `freeform` | (none) | Quick questions, no structure |

## Architecture

### Directory Structure

```
packages/workflow-management/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── commands/             # Command implementations
│   │   ├── enter.ts          # Main mode entry logic
│   │   ├── status.ts         # Status display
│   │   ├── can-exit.ts       # Stop condition checking
│   │   ├── prompt.ts         # Template content output
│   │   ├── validate-template.ts
│   │   ├── init-template.ts
│   │   ├── init-mode.ts
│   │   └── register-mode.ts
│   ├── session/
│   │   └── lookup.ts         # Session and path utilities
│   ├── state/
│   │   └── reader.ts         # State file reading
│   └── validation/
│       ├── schemas.ts        # Zod schemas for templates
│       └── phase-validator.ts
├── templates/                # Built-in workflow templates
│   ├── task.md
│   ├── planning-feature.md
│   ├── implementation-feature.md
│   ├── debug.md
│   ├── research.md
│   └── ...
├── modes.yaml                # Mode definitions
└── package.json
```

### Template Structure

Templates use YAML frontmatter to define phases and beads:

```markdown
---
id: my-workflow
name: "My Workflow"
description: "Custom workflow description"
mode: my-workflow
workflow_prefix: "MW"

phases:
  - id: p0
    name: "Setup"
    bead:
      title: "MW: Setup"
      labels: [phase, phase-0]
  - id: p1
    name: "Execute"
    bead:
      title: "MW: Execute"
      labels: [phase, phase-1]
      depends_on: [p0]
---

# My Workflow Mode

## Phase Guide

### P0: Setup
...

### P1: Execute
...
```

### Phase Configuration

Each phase can define:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Phase identifier (p0, p1, p2, etc.) |
| `name` | string | Human-readable phase name |
| `bead.title` | string | Bead title (created when entering mode) |
| `bead.labels` | string[] | Labels applied to the bead |
| `bead.depends_on` | string[] | Phase IDs this depends on |
| `container` | boolean | Whether phase accepts spec content phases |
| `subphase_pattern` | array | Pattern for creating beads per spec phase |

### Subphase Patterns

For implementation modes, use `subphase_pattern` to create multiple beads per spec phase:

```yaml
phases:
  - id: p2
    name: "Implementation"
    container: true
    subphase_pattern:
      - id_suffix: "impl"
        title_template: "GH#{issue}: P{phase} IMPL - {name}"
        todo_template: "P{phase}: IMPL - {name}"
        active_form: "Implementing {name}"
        labels: [phase, impl]
      - id_suffix: "codex"
        title_template: "GH#{issue}: P{phase} CODEX - review {name}"
        todo_template: "P{phase}: CODEX - review {name}"
        active_form: "Codex reviewing {name}"
        labels: [phase, codex, verification]
        depends_on_previous: true
```

## Path Resolution

Templates are resolved in priority order:

1. **Absolute path** - Use as-is if exists
2. **Project custom** - `.claude/workflows/templates/<template>`
3. **Package built-in** - `packages/workflow-management/templates/<template>`

This allows projects to override built-in templates without modifying the package.

## Integration with Beads

When entering a mode, the CLI:

1. Reads the template from `modes.yaml`
2. Parses phase definitions from template frontmatter
3. Creates beads for each phase with dependencies
4. Updates session state with mode info

For implementation modes with `--issue=NNN`:
- Reads spec file from `planning/specs/{issue}-*.md`
- Extracts phases from spec YAML frontmatter
- Applies subphase pattern (IMPL → CODEX → GEMINI per phase)

## Development

```bash
# Build the package
pnpm --filter @baseplane/workflow-management build

# Type check
pnpm --filter @baseplane/workflow-management typecheck

# Test a command
pnpm wm enter task --dry-run
```

## Related

- **Session state**: `.claude/sessions/{session-id}/state.json`
- **Beads tracker**: `bd` CLI in `.beads/`
- **GitHub integration**: `bgh` CLI in `packages/github-cli/`
- **Rules**: `.claude/rules/workflow-infrastructure.md`
