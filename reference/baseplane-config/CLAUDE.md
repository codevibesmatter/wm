# CLAUDE.md

*Monorepo-level guidance for Claude Code*

## Project Overview

**Baseplane** - Full-stack, local-first, edge-native framework for data-intensive web apps.

**Monorepo Stack:**
- Build: pnpm workspaces + Turborepo
- Linting: Biome (replaces ESLint + Prettier)
- Package manager: pnpm

---

## Documentation Layers

Five layers of documentation, each with a distinct purpose and change trigger:

| Layer | Location | Contains | Changes When |
|-------|----------|----------|--------------|
| **Theory** | `docs/theory/` | Principles, constraints, invariants | Domain model changes |
| **Primitives** | `docs/primitives/` | Concept + wireframes + behavior | Product design evolves |
| **Modules** | `docs/modules/` | Per-module declarations | Module scope changes |
| **Specs** | `planning/specs/` | Per-feature requirements | Per-feature implementation |
| **Rules** | `.claude/rules/` | File paths, imports, anti-patterns | Stack or framework changes |

Theory says *what must be true*. Primitives show *what it looks like and how it behaves*. Modules declare *what each domain provides*. Specs say *what to build next*. Rules say *how to build it in code*.

**Layer test:** If it survives a stack rewrite but not a UI redesign → Primitives. If it references a specific library or file path → Rules. If it's an abstract invariant → Theory.

See `docs/primitives/README.md` for the full document map.

## IMPORTANT: Documentation Files

**NEVER create markdown files (*.md) outside the planning workflow system unless explicitly requested by the user.**

This project has a structured planning system:
- Specs go in `planning/specs/` (created via `create-issue.sh`)
- Rules go in `.claude/rules/`
- Primitives go in `docs/primitives/`
- Session notes are managed automatically by hooks

If you need to document something, ask the user first or use the existing workflow:
```bash
pnpm bgh create --type=feature --title="..."
```

---

## Monorepo Structure

```
baseplane/
├── apps/
│   ├── gateway/             # Gateway Worker - routing, auth, rate limiting
│   ├── web/                 # @baseplane/web - React frontend + Hono backend
│   │   ├── src/             # React + Hono on Cloudflare Workers
│   │   └── CLAUDE.md        # Web-app specific guidance (READ THIS)
│   ├── user/                # User Worker - preferences, sessions
│   ├── dataforge/           # DataForge Worker - entity CRUD, schemas
│   ├── chat-agent/          # AI Worker - embeddings, graph, chat
│   ├── integrations/        # Integrations Worker - Procore, connectors
│   ├── workflows/           # Workflows Worker - process automation
│   ├── collab/              # Collab Worker - real-time collaboration
│   ├── ai-services/         # AI Services Worker - embeddings, graph, parseforge
│   ├── gc-vertical/         # GC Vertical Worker - construction vertical (RFI, COI, Bid Mail)
│   └── communications/      # Communications Worker - email, notifications
├── packages/
│   ├── deploy/              # DEPRECATED - moved to baseplane-ai/baseplane-infra
│   └── shared-types/        # @baseplane/shared-types - TypeScript types
├── planning/                # Planning system (initiatives, domains, roadmap)
├── pnpm-workspace.yaml      # Workspace definition
├── turbo.json               # Turborepo build orchestration
├── biome.json               # Linting configuration
└── tsconfig.base.json       # Shared TypeScript config
```

**App-specific guidance:**
- **Web app (main)**: See `.claude/rules/` for React, MobX, database, API patterns

---

## Multi-Worker Architecture

Baseplane uses a capability-based multi-worker architecture for optimal performance:

```
┌─────────────────────────────────────────────────────────────────┐
│                         GATEWAY                                  │
│          Routing, auth, rate limiting (< 1MB)                   │
└─────────────────────────────────────────────────────────────────┘
                    │ Service Bindings
    ┌──────┬────────┼────────┬──────────┬──────────┐
    ▼      ▼        ▼        ▼          ▼          ▼
┌──────┐┌──────┐┌────────┐┌──────┐┌──────────┐┌─────────┐
│ WEB  ││ USER ││DATAFORGE││ CHAT ││INTEGR-   ││WORKFLOWS│
│React ││Prefs ││ Entity ││AGENT ││ ATIONS   ││ Process │
│+Hono ││Auth  ││ CRUD   ││ AI   ││ Procore  ││ Steps   │
└──────┘└──────┘└────────┘└──────┘└──────────┘└─────────┘
    ┌──────┬────────┬──────────┐
    ▼      ▼        ▼          ▼
┌──────┐┌──────┐┌────────┐┌─────────────┐
│COLLAB││AI-SVC││GC-VERT ││COMMUNICATIONS│
│Realtime│Embed ││RFI,COI ││Email,Notify │
│Docs  ││Graph ││Bid Mail││             │
└──────┘└──────┘└────────┘└─────────────┘
```

**11 Workers:**

| Worker | Purpose |
|--------|---------|
| Gateway | Routing, auth, rate limiting |
| Web | React frontend + Hono API backend |
| User | User preferences, sessions |
| DataForge | Entity CRUD, schemas, validation |
| ChatAgent | AI chat, embeddings |
| Integrations | External connector host (Procore and others) |
| Workflows | Process automation, scheduled tasks |
| Collab | Real-time collaboration |
| AI Services | Embeddings, knowledge graph, parseforge |
| GC Vertical | Construction vertical (RFI, COI, Bid Mail, financials) |
| Communications | Email, notifications |

**Local Development (Gateway-First):**
```bash
# From monorepo root - gateway is the entry point
./scripts/dev/setup.sh                 # Full setup with Chrome
# OR
./scripts/dev/setup.sh --no-chrome     # Without Chrome

# Single port serves everything:
# - Gateway routes all requests (auth, rate limiting)
# - React frontend with HMR via gateway proxy
# - All 11 workers via Vite auxiliaryWorkers
# - Service bindings work locally
```

**How it works:** Gateway is the entry point. The `@cloudflare/vite-plugin` in `apps/gateway/vite.config.ts` starts all workers via auxiliaryWorkers config. Gateway proxies frontend requests to the web worker.

---

## New Developer Setup

**First time after cloning:**
```bash
./scripts/setup/new-developer.sh       # One-time setup (installs deps, secrets, hooks)
```

This script handles:
1. Installing pnpm dependencies
2. Decrypting secrets (`.env` file)
3. Creating `.env` symlinks for auxiliary workers
4. Setting up git hooks (pre-commit)
5. Building shared packages

---

## Development Commands

**From monorepo root:**
```bash
./scripts/dev/setup.sh                 # Start dev server + Chrome
./scripts/dev/setup.sh --no-chrome     # Start without Chrome
```

> **Troubleshooting:** If scripts fail, see `scripts/dev/README.md` for prerequisites (tmux, pnpm) and troubleshooting.

**Essential commands (from monorepo root):**
```bash
pnpm typecheck    # Type checking (via turbo)
pnpm lint         # Linting (Biome via turbo)
pnpm check:write  # Run all Biome checks and fix
pnpm test         # Run tests (via turbo)
pnpm build        # Build all packages (via turbo)
```

**Turbo commands:**
```bash
turbo dev                              # All packages
turbo dev --filter=@baseplane/web      # Just web app
turbo build --filter=@baseplane/web    # Build specific package
```

---

## Webhook Dev Tunnel

**Cloudflare Tunnel** routes `webhookdev*.baseplane.ai` to local dev servers so external services (Polar, Nylas, Resend) can deliver webhooks locally.

**Subdomain mapping** (auto-derived from directory name):

| Directory | Webhook URL | Port |
|-----------|-------------|------|
| `baseplane` | `webhookdev.baseplane.ai` | `$DEV_PORT` |
| `baseplane-dev2` | `webhookdev-dev2.baseplane.ai` | `$DEV_PORT` |
| `baseplane-devN` | `webhookdev-devN.baseplane.ai` | `$DEV_PORT` |

**Commands:**
```bash
# First-time setup (requires cloudflared login first)
cloudflared tunnel login                           # Auth with Cloudflare (baseplane.ai zone)
./scripts/dev/webhook-tunnel.sh setup              # Create tunnel + DNS records

# Route all running dev servers simultaneously
./scripts/dev/webhook-tunnel.sh start-all

# Route single server (current worktree)
./scripts/dev/webhook-tunnel.sh start
./scripts/dev/webhook-tunnel.sh start --port 4003  # Specific port
./scripts/dev/webhook-tunnel.sh start --list       # Choose interactively

# Management
./scripts/dev/webhook-tunnel.sh stop
./scripts/dev/webhook-tunnel.sh status             # Show routes + connectivity
./scripts/dev/webhook-tunnel.sh logs
```

`start-all` auto-detects all running dev servers, creates DNS CNAMEs, and generates multi-ingress config. New worktrees are picked up automatically on next `start-all`.

---

## Deployment

Automated via webhook deploy server on dev6. Push to a branch and it deploys automatically.

- Push to `staging` -> Deploy to staging (~1.5 min for all 11 workers)
- Push to `main` -> Deploy to production

> **Note:** The deploy server source code has moved to [`baseplane-ai/baseplane-infra`](https://github.com/baseplane-ai/baseplane-infra).
> For VPS operations (systemd services, tunnel config, TUI), work in `/opt/baseplane-infra` on the deploy server.
> The copy in `packages/deploy/` is deprecated and retained only for backward compatibility until VPS cutover.

**Primary: Webhook Deploy Server (baseplane-infra)**

A self-hosted webhook server receives GitHub push events and runs the full deploy pipeline: pull -> install -> lint -> typecheck -> detect changes -> deploy (parallel) -> health check. Only changed workers are deployed; shared code changes (packages/, pnpm-lock.yaml) trigger deploy-all. Deploy notifications are posted to Slack.

```bash
# On the VPS (in /opt/baseplane-infra):
# TUI dashboard (real-time deploy status)
pnpm --filter @baseplane/deploy tui

# Check deploy status from CLI
pnpm --filter @baseplane/deploy status

# Trigger a manual deploy via the server
pnpm --filter @baseplane/deploy trigger staging
```

**Emergency Fallback: Local Deploy**

```bash
# Deploy via wrangler directly (needs CLOUDFLARE_API_TOKEN in .env)
# This is an emergency fallback for when the deploy server is down.
./scripts/deploy/deploy.sh                      # Deploy all to staging
./scripts/deploy/deploy.sh production           # Deploy all to production
./scripts/deploy/deploy.sh staging --only web   # Deploy specific worker
```

**Vite Workers (web, gateway, user)** use a two-step deploy:
1. `CLOUDFLARE_ENV=staging vite build` -- bakes env config into wrangler.json
2. `wrangler deploy` -- NO `--env` flag (config already baked in)

Non-Vite workers use `wrangler deploy --env staging` directly.

---

## Planning System

**See:** `.claude/skills/planning-mode/SKILL.md` for complete workflow.

**Two-tier system:**
| Tier | Tool | Purpose |
|------|------|---------|
| What | GitHub Issues | External tracking, stakeholder visibility |
| How | Beads | Local task breakdown, dependencies, AI memory |

**Quick Start:**
```bash
# 1. Create Feature (auto-creates spec file)
pnpm bgh create --type=feature --title="Title" --epic=186

# 2. Enter implementation mode (--issue links session automatically)
pnpm wm enter implementation --issue=123

# 3. Work through tasks (tracked via TodoWrite)
pnpm wm status            # Check current mode and phase
pnpm wm can-exit          # Check if exit conditions met

# 5. Codex review (optional quality gate)
pnpm at codex :code --gate

# 6. Complete
gh issue close 123 --comment "Done"
```

**Codex Quality Gates:**
```bash
# Spec review before implementation (no 🔴 reds, max 2 🟡 yellows)
pnpm at codex :spec planning/specs/123-*.md --gate

# Code review after implementation
pnpm at codex :code --gate
```

**Directory:**
```
planning/
├── specs/          # Auto-created spec files for Epics/Features
└── _archive/       # Completed/deprecated work
```

> Domain knowledge (patterns, decisions) is now in `.claude/rules/`. See `core-philosophy.md`.

---

## Git Workflow

**Worktree pattern**: Long-lived branches (NOT create→PR→delete)
- Create worktree once per feature/area
- After PR merge: **rebase from staging** (don't delete worktree)

**Commit format:** `[type]: brief description` (Types: feat, fix, docs, style, refactor, test, chore)

**Creating worktrees:**
```bash
git worktree add -b <branch-name> <path> origin/staging
cd <path>
./scripts/secrets/decrypt-env.sh
```

**Sync branches** (for cross-worktree updates without rebasing):
```bash
./planning/sync.sh                                                # Sync planning docs to planning-sync branch
.claude/skills/session-metadata/scripts/sync-metadata.sh          # Sync session history to sessions-sync branch
```

These dedicated branches allow syncing without pulling all code changes:
- `planning-sync` - Planning docs (`planning/`)
- `sessions-sync` - Session history (`.claude/sessions/`)
- `claude-sync` - Claude Code config (hooks, skills, workflows, rules)

**Note:** Sessions sync runs automatically at session end (via session-end hook). Manual sync only needed if you want to pull updates from other worktrees mid-session.

**Pre-commit hooks** (run once per worktree):
```bash
./scripts/setup/git-hooks.sh
```

This enables pre-commit checks:
1. Biome lint (`pnpm lint:errors`)
2. TypeScript (`pnpm typecheck`)
3. Tests (coming soon)

To skip (not recommended): `git commit --no-verify`

---

## Code Style

**Biome** handles linting and formatting (25x faster than ESLint + Prettier):
```bash
pnpm check:write  # Fix all issues before committing
```

---

## Database & API Testing

**Use the `bpd` CLI** for database queries and API testing. It handles authentication and special character escaping automatically.

```bash
# Database queries
pnpm bpd 'db SELECT * FROM organizations LIMIT 5'
pnpm bpd 'db SELECT COUNT(*) FROM entity_schemas'

# Authenticated API calls (shorthand for test users)
pnpm bpd 'auth ceo | orpc /dataforge/entities/list'
pnpm bpd 'auth admin | orpc /organizations/list'

# Health check
pnpm bpd health
```

**Test user shorthand:** `ceo`, `admin`, `manager`, `member`, `viewer` (all @widecorp.com)

**Full docs:** `pnpm bpd help`

---

## Special Character Escaping

**Claude Code's Bash tool escapes `!` and other special characters.** The `bpd` CLI handles this automatically.

**If you must use raw curl/bash:**

1. **Use heredocs with single-quoted delimiter:**
   ```bash
   curl -X POST "http://localhost:4004/api/auth/sign-in/email" \
     -H "Content-Type: application/json" \
     -d "$(cat <<'EOF'
   {"email":"ceo@widecorp.com","password":"WideCorp2026!CEO"}
   EOF
   )"
   ```

2. **Write to file first, then use file:**
   ```bash
   # Use the Write tool to create a JSON file, then reference it
   curl -d @/tmp/login.json ...
   ```

**For browser automation (`bt`):** Use `pnpm bt` which handles special characters automatically via Playwright's `fill()`.

---

## Naming Conventions
- Files: kebab-case.ts or PascalCase.tsx
- Components: PascalCase
- Functions: camelCase
- Constants: UPPER_SNAKE_CASE
- **Data/API fields: snake_case** - Database columns and API responses use snake_case (`updated_at`, `created_by`). No camelCase conversion layer exists.

---

## Quick Reference by App

| App | Purpose | Location | Dev Command (from app dir) |
|-----|---------|----------|----------------------------|
| Web | Cloudflare fullstack | `apps/web/` | `./scripts/dev/setup.sh` |

**For web app development**, see `.claude/rules/`:
- `mobx-state.md` - MobX patterns
- `database-access.md` - Database connections
- `api-client.md` - API patterns
- `logging.md` - Logging
- `dev-setup.md` - Dev server management
- `component-architecture.md` - Component placement

---

## Modular Rules System

Domain-specific rules are auto-loaded from `.claude/rules/`. Reference with `@.claude/rules/[filename].md`.

**36 rule files organized by domain:**

| Category | Rules |
|----------|-------|
| **Core** | `core-philosophy.md` - Universal abstractions, local-first, edge-native principles (always applied) |
| **DataForge** | `dataforge-relationships.md`, `dataforge-archetypes.md`, `dataforge-options.md`, `computed-fields.md`, `validation-pipeline.md` |
| **API/Backend** | `orpc-api-patterns.md`, `api-client.md`, `middleware-pipeline.md`, `zod-schemas.md` |
| **Frontend** | `mobx-state.md`, `tanstack-router.md`, `tanstack-query.md`, `component-architecture.md`, `form-handling.md`, `layout-structure.md` |
| **Systems** | `vibegrid.md`, `knowledge-graph.md`, `workflow-engine.md`, `realtime-sync.md`, `event-bus.md` |
| **Infrastructure** | `durable-objects.md`, `database-migrations.md`, `logging.md`, `connectors.md` |
| **Auth/Access** | `authentication.md`, `access-control.md`, `approvals.md` |
| **Features** | `feature-flags.md`, `notifications.md`, `file-browser.md` |
| **Testing** | `testing-patterns.md` |

**Usage:** When working in a domain, reference the relevant rule file:
```
@.claude/rules/dataforge-relationships.md
@.claude/rules/vibegrid.md
```

---

## Natural Language Workflows

**Single universal command** powered by skill-based routing:

```bash
# One-time setup
.claude/workflows/setup-cc-wrapper.sh

# Then use everywhere
cc
```

Just describe what you want in natural language - skills auto-activate:

```
Research → Plan → Impl
    │        │       └── Execute approved plan (code)
    │        └── Create spec + Beads breakdown (Feature, Epic, or Milestone)
    └── Explore topics, document findings
```

### Quick Start Examples

| What You Want | Just Say |
|---------------|----------|
| Plan a feature | "I want to plan feature #239" |
| Implement code | "implement issue #423" |
| Research a topic | "research OAuth providers" |
| Create an issue | "create epic for authentication" |
| Review code | "codex review this spec" |
| Search codebase | "find related code for login" |

### How It Works

**Skill detection is automatic:**
1. You describe your intent in natural language
2. UserPromptSubmit hook detects relevant skills
3. Skills are suggested or auto-activated
4. Work proceeds naturally

**Available modes:**
- `planning-mode` - Research, spec creation, Codex review (NO implementation)
- `implementation-mode` - Execute approved plans from Beads tasks
- `research-mode` - Explore topics, document findings
- `management-mode` - Project oversight, team analysis, health monitoring

**Available CLIs and skills:**
- `bgh` (pnpm bgh) - GitHub Issues + Labels, session linking CLI
- `bt` (pnpm bt), `bpd` (pnpm bpd) - Browser automation, API testing CLIs
- `codex-bridge`, `validate-spec` - Quality gates and validation
- `embedding-search`, `episodic-memory` - Semantic search, session recall
- Plus specialized utilities

**See:** `.claude/skills/README.md` for complete skill system documentation.

### Session State System

Sessions can be linked to GitHub issues for context continuity:
- State stored at `.claude/sessions/issue-<num>/state.json`
- Survives context compaction (issue-based, not session-based)
- Stop hook enforces workflow completion
- SessionStart hook restores context after compaction

**Check current state:**
```bash
cat .claude/current-session-id                 # Current session ID
cat .claude/sessions/$SESSION_ID/state.json    # Session state
pnpm wm link --show                            # Show linked issue
```

### Session Types

Session types determine stop conditions and phase tracking:

| Type | Phases | Use For |
|------|--------|---------|
| `planning` | research, spec, review, breakdown | Feature specs |
| `strategic` | vision, features, dependencies, roadmap | Epic planning (3-8 features) |
| `implementation` | claim, implement, verify, close | Execute approved specs |
| `bugfix` | reproduce, investigate, fix, verify | Systematic bug fixes |
| `debug` | reproduce, investigate, document | Investigation only (no fix) |
| `hotfix` | triage, fix, staging, production, postmortem | Production emergencies |
| `dedicated-testing` | setup, baseline, automated, manual, evidence, close | Comprehensive QA |
| `research` | explore, synthesize | Exploration & learning |
| `management` | analyze, recommend | Project health & oversight |
| `orchestrator` | setup, spawn, execute, observe, cleanup | Multi-agent sessions |
| `flow-state` | (none) | Minimal structure |
| `default` | (none) | General sessions |

**Entering mode with issue:**
```bash
pnpm wm enter planning --issue=123
pnpm wm enter implementation --issue=123
pnpm wm enter bugfix --issue=123
```

**Details:** `.claude/workflows/SESSION-TYPES.md` (full reference), `.claude/workflows/stop-conditions.json` (conditions per type)

### Session Length and Complexity

**IMPORTANT:** You have unlimited time and context (1M tokens) for this session.

- **No artificial time limits** - Don't say "this will take too long" or "we should scope this down"
- **No complexity limits** - Handle tasks of any complexity, use full context as needed
- **Focus on quality** - The only measure is meeting user requirements, not time or length
- **Work until complete** - Sessions can run indefinitely until the work is done right
- **Use full context** - You have 1M tokens, use them to do thorough work

**Anti-patterns to avoid:**
- "This might take a while, should we break it down?" (No - just do it)
- "This is getting complex, let's simplify" (No - user sets scope)
- "We've been working on this for a while" (Time doesn't matter)
- "This session is getting long" (Length doesn't matter)

**Your priority:** Quality work that meets user requirements, regardless of time horizon or complexity.

### Legacy Wrappers (Deprecated)

Old wrapper scripts still work but show deprecation notices:
- `claude-plan.sh`, `claude-impl.sh`, `claude-research.sh` → Use `cc` instead

**Migration:** `.claude/workflows/WRAPPERS-DEPRECATED.md`

---

## Skills

Project-specific skills in `.claude/skills/` provide specialized workflows:

| Tool | Purpose | Invocation |
|------|---------|------------|
| `bgh` | GitHub Issues + Labels, session linking | `pnpm bgh` |
| `bpd` | DB queries, API calls, oRPC endpoints | `pnpm bpd` |
| `bt` | Browser automation, screenshots, DOM inspection | `pnpm bt` |
| `codex-bridge` | Spec review and code review via Codex CLI | Skill |
| `implement-initiative` | Execute approved plans step-by-step | Skill |
| `pr-review-assistant` | PR review and feedback | Skill |

CLI tools (`bgh`, `bpd`, `bt`) are available via pnpm. Skills auto-activate based on context.

---

**Version:** 3.10 | **Updated:** 2026-01-03 | **Status:** Active Development (Monorepo)
