---
initiative: minimal-bootstrap
type: project
issue_type: feature
status: approved
priority: high
github_issue: 25
created: 2026-02-25
updated: 2026-02-25
phases:
  - id: p1
    name: "Bootstrap command and CLAUDE.md template"
    tasks:
      - "Create src/commands/bootstrap.ts with kata bootstrap [path] command"
      - "Create templates/bootstrap-claude.md with the CLAUDE.md seed content"
      - "Register bootstrap command in src/index.ts help and dispatch"
      - "Update MANAGER_ROOT in src/manager/paths.ts to be configurable"
    test_cases:
      - id: "bootstrap-creates-claudemd"
        description: "kata bootstrap in a temp dir creates CLAUDE.md with kata instructions"
        type: "unit"
      - id: "bootstrap-explicit-path"
        description: "kata bootstrap /tmp/test creates the directory and writes CLAUDE.md there"
        type: "unit"
      - id: "bootstrap-guard"
        description: "kata bootstrap in a dir with existing CLAUDE.md warns and exits (no --force)"
        type: "unit"
      - id: "bootstrap-force"
        description: "kata bootstrap --force overwrites existing CLAUDE.md"
        type: "unit"
      - id: "manager-root-configurable"
        description: "MANAGER_ROOT reads from ~/.config/kata/config.json when present"
        type: "unit"
      - id: "build-typecheck"
        description: "npm run build && npm run typecheck pass after all changes"
        type: "smoke"
  - id: p2
    name: "Tests and verification"
    tasks:
      - "Unit tests for bootstrap command (create, guard, force)"
      - "Unit test for configurable MANAGER_ROOT"
      - "Build + typecheck pass"
    test_cases:
      - id: "full-build"
        description: "npm run build && npm test passes with all new tests"
        type: "smoke"
---

# Minimal Bootstrap — CLAUDE.md-Seeded Manager Project

> GitHub Issue: [#25](https://github.com/codevibesmatter/kata-wm/issues/25)

## Overview

New users need to install kata-wm, run one command, then open Claude Code and just talk. The current flow requires knowing about `kata setup` and `kata enter onboard` upfront. This feature introduces `kata bootstrap` — a command that creates a single CLAUDE.md file, which is enough for Claude to drive the entire setup interactively.

## Feature Behaviors

### B1: Bootstrap Creates CLAUDE.md

**Core:**
- **ID:** bootstrap-creates-claudemd
- **Trigger:** User runs `kata bootstrap` (no arguments, uses cwd)
- **Expected:** Writes a `CLAUDE.md` file in the current directory containing kata instructions. Creates the directory if it doesn't exist. Prints next-steps message to stderr.
- **Verify:** After running, `CLAUDE.md` exists in cwd with content that mentions `kata enter onboard`.

#### UI Layer
N/A — CLI tool.

#### API Layer
```
kata bootstrap [path] [--force]
```

| Flag | Default | Description |
|------|---------|-------------|
| `path` | `.` (cwd) | Target directory for the CLAUDE.md |
| `--force` | false | Overwrite existing CLAUDE.md |

#### Data Layer
Single file written: `<path>/CLAUDE.md`

No `.kata/`, no `wm.yaml`, no hooks, no registry. All created later by the onboard flow inside Claude.

---

### B2: Bootstrap With Explicit Path

**Core:**
- **ID:** bootstrap-explicit-path
- **Trigger:** User runs `kata bootstrap ~/my-project`
- **Expected:** Creates `~/my-project/` directory (if needed) and writes `CLAUDE.md` there.
- **Verify:** `~/my-project/CLAUDE.md` exists with kata instructions.

#### UI Layer
N/A

#### API Layer
Same as B1 with positional path argument.

#### Data Layer
Same as B1.

---

### B3: CLAUDE.md Content Is Sufficient for Onboard

**Core:**
- **ID:** claudemd-drives-onboard
- **Trigger:** Claude Code reads the bootstrapped CLAUDE.md at session start.
- **Expected:** CLAUDE.md contains enough context for Claude to understand kata-wm and run `kata enter onboard` when the user asks to set up. Includes: what kata is, how to run onboard, what modes are, basic CLI reference.
- **Verify:** Agent reading only this CLAUDE.md can successfully run `kata enter onboard` without prior kata knowledge.

#### UI Layer
N/A

#### API Layer
N/A — this is a static file template.

#### Data Layer
Template stored at `templates/bootstrap-claude.md` in the package. Copied verbatim by the bootstrap command.

---

### B4: Guard Against Double Bootstrap

**Core:**
- **ID:** bootstrap-guard
- **Trigger:** User runs `kata bootstrap` in a directory that already has a `CLAUDE.md`.
- **Expected:** Prints warning ("CLAUDE.md already exists, use --force to overwrite") and exits with code 1. Does not modify the existing file.
- **Verify:** Existing CLAUDE.md content is unchanged after the command.

#### UI Layer
N/A

#### API Layer
`--force` flag overrides the guard and replaces the existing CLAUDE.md.

#### Data Layer
No changes unless `--force` is used.

---

### B5: Configurable Manager Root

**Core:**
- **ID:** configurable-manager-root
- **Trigger:** Any code that imports `MANAGER_ROOT` from `src/manager/paths.ts`.
- **Expected:** `MANAGER_ROOT` checks `~/.config/kata/config.json` for a `manager_path` field. If present, uses that path. If absent, falls back to the current `~/.kata/manager/` default. The `kata projects init-manager` command writes this config file when it runs.
- **Verify:** Setting `manager_path` in `~/.config/kata/config.json` changes where the registry is read from.
- **Source:** `src/manager/paths.ts:8`

#### UI Layer
N/A

#### API Layer
N/A — internal change. `kata projects` subcommands automatically use the configured root.

#### Data Layer
New file: `~/.config/kata/config.json`
```json
{
  "manager_path": "/home/user/kata-manager"
}
```

Optional — only written when `kata projects init-manager` is run from a non-default location.

---

## Non-Goals

- No changes to the onboard flow itself — it already works
- No special manager-only modes or hooks
- No auto-discovery at bootstrap time (happens during onboard)
- No git init at bootstrap time (user decides when to version control)
- No npm/package.json scaffolding — this is not a code project

## Open Questions

None — design settled in conversation.

## Implementation Phases

See YAML frontmatter `phases:` above. Each phase should be 1-4 hours of focused work.

## Verification Strategy

### Test Infrastructure
Existing bun:test setup. New tests in `src/commands/bootstrap.test.ts` and `src/manager/paths.test.ts`.

### Build Verification
`npm run build` (tsup). Then `npm test` for the node --test runner, and `bun test src/commands/bootstrap.test.ts src/manager/paths.test.ts` for new unit tests.

## Implementation Hints

### Dependencies
None — uses only Node.js built-ins (fs, path, os).

### Key Imports
| Module | Import | Used For |
|--------|--------|----------|
| `node:fs` | `{ existsSync, mkdirSync, writeFileSync, readFileSync, copyFileSync }` | File operations |
| `node:path` | `{ join, resolve }` | Path construction |
| `../session/lookup.js` | `{ getPackageRoot }` | Finding the template source |

### Code Patterns

Bootstrap command is minimal — no Zod schemas, no YAML parsing, no hook registration:

```typescript
// src/commands/bootstrap.ts
export async function bootstrap(args: string[]): Promise<void> {
  const target = resolve(args[0] || '.')
  const claudeMd = join(target, 'CLAUDE.md')

  if (existsSync(claudeMd) && !force) {
    console.error('CLAUDE.md already exists. Use --force to overwrite.')
    process.exitCode = 1
    return
  }

  mkdirSync(target, { recursive: true })
  copyFileSync(join(getPackageRoot(), 'templates', 'bootstrap-claude.md'), claudeMd)

  console.error(`Created ${claudeMd}`)
  console.error('\nNext steps:')
  console.error(`  cd ${target}`)
  console.error('  claude')
  console.error('  → "Help me set up kata"')
}
```

Configurable manager root reads a simple JSON config:

```typescript
// src/manager/paths.ts
function getManagerRoot(): string {
  const configPath = join(homedir(), '.config', 'kata', 'config.json')
  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'))
      if (config.manager_path) return config.manager_path
    } catch { /* fall through */ }
  }
  return join(homedir(), '.kata', 'manager')
}
export const MANAGER_ROOT = getManagerRoot()
```

### Gotchas
- `kata init` is already taken (session state init) — that's why this is `kata bootstrap`
- CLAUDE.md must not assume the project has a `package.json` or is a git repo
- The template should reference `kata enter onboard` not `kata setup` since we want the interactive agent-driven flow

### Reference Docs
- [Claude Code CLAUDE.md](https://docs.anthropic.com/en/docs/claude-code/memory#claudemd) — how Claude Code loads project instructions
