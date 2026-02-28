# Planning Templates

Agent-filled questionnaires that guide structured planning based on actual codebase patterns.

## Purpose

Templates force the agent to:
1. **Verify baseline first** - Confirm existing features work before extending
2. **Research the codebase** before planning
3. **Reference actual patterns** (file paths, not concepts)
4. **Generate verification-gated Beads tasks** with proper dependencies

> **CRITICAL:** All templates now include Phase 0 Baseline Verification and
> per-phase verification gates. See `.claude/rules/incremental-verification.md`.

## Available Templates

### Planning Hierarchy Templates

| Template | Use Case | Invoked Via |
|----------|----------|-------------|
| `milestone.md` | Planning a release/sprint with multiple epics | `cc-plan --milestone "Q1 2025"` |
| `epic.md` | Planning a large initiative (3-8 features) | `cc-plan --epic 190` |

### Feature Templates

| Template | Use Case | Invoked Via |
|----------|----------|-------------|
| `full-stack.md` | Backend + Frontend + DB + Testing | `cc-plan --issue 239` |
| `backend-only.md` | API/service work (no UI) | `cc-plan --issue 239` |
| `frontend-only.md` | UI changes (existing API) | `cc-plan --issue 239` |
| `infrastructure.md` | CI/CD, migrations, tooling | `cc-plan --issue 239` |
| `research.md` | Exploration/spike | `cc-research` |

## How to Use (Agent Workflow)

```
1. Agent receives: "Plan feature #XXX"
                   │
                   ▼
2. Agent selects template based on feature type
                   │
                   ▼
3. Agent explores codebase:
   - grep/glob for similar patterns
   - read existing stores, routers, components
   - understand conventions
                   │
                   ▼
4. Agent fills template with SPECIFICS:
   - Actual file paths from research
   - Actual function/class names
   - References to existing code to follow
                   │
                   ▼
5. Filled template → planning/specs/XXX-*.md
                   │
                   ▼
6. Codex review (quality gate ≥75)
                   │
                   ▼
7. Agent generates Beads tasks from filled spec
                   │
                   ▼
8. bv graph → visualize dependencies before implementation
```

## Template Filling Rules

### DO:
- **Research first** - run grep, glob, read files before filling
- **Use actual paths** - `apps/web/src/server/orpc/routers/discovery.ts`
- **Reference existing code** - "Based on AuthStore.ts lines 45-78"
- **Mark N/A sections** - clearly indicate what doesn't apply

### DON'T:
- Use placeholders like `{{FEATURE_NAME}}`
- Reference concepts without paths - "like the other routers"
- Fill sections speculatively - research or mark N/A
- Skip the research phase

## Template Authoring Guide

### Maintenance Process

Templates reference `.claude/rules/*` as authoritative sources for patterns. When updating:

1. **Check rules first** - If a pattern changes, update the rule file first
2. **Update templates** - Templates should reference rules, not duplicate them
3. **Validate paths** - Periodically verify file paths still exist

### Creating New Templates

1. Identify a recurring planning pattern not covered by existing templates
2. Research the codebase to find canonical examples
3. Structure as a questionnaire with specific fields to fill
4. Include "Similar Feature Analysis" sections
5. Add Beads task breakdown guidance

### Template Structure

```markdown
# Feature Planning: {{FEATURE_TITLE}}

> **Instructions for Agent:**
> Fill this template during PLANNING session by exploring the codebase.
> Every field must contain ACTUAL file paths and patterns, not placeholders.

## 0. Feature Context
<!-- GitHub issue, acceptance criteria, related features -->

## 1-N. Domain-Specific Sections
<!-- Each section has "Similar Feature Analysis" first -->

## N+1. Task Breakdown
<!-- Beads commands to generate tasks with dependencies -->

## Notes
<!-- Session discoveries, open questions, risks -->
```

## Verification-Gated Tasks (CRITICAL)

All templates now enforce this pattern:

```
BASELINE → IMPL_1 → VERIFY_1 → IMPL_2 → VERIFY_2 → FINAL
     ↑                  ↑                  ↑           ↑
   P0 gate          Phase 1 gate      Phase 2 gate   Demo
```

**Why this exists:** GH#215 failure - 2.5 hours of implementation before discovering
the base feature was broken. All features unverifiable.

**Key rules:**
1. **BASELINE is P0** - First task, blocks all implementation
2. **VERIFY tasks have dependencies** - Can't verify before implementation
3. **Phase N+1 depends on Phase N verify** - Can't skip verification
4. **FINAL is demo to user** - Not complete until demonstrated

See `.claude/rules/incremental-verification.md` for full protocol.

## Authoritative Pattern References

Templates should reference these rules for canonical patterns:

| Domain | Rule File |
|--------|-----------|
| MobX State | `.claude/rules/mobx-state.md` |
| oRPC API | `.claude/rules/orpc-api-patterns.md` |
| DataForge | `.claude/rules/dataforge-archetypes.md` |
| Relationships | `.claude/rules/dataforge-relationships.md` |
| Components | `.claude/rules/component-architecture.md` |
| Testing | `.claude/rules/testing-patterns.md` |
| **Verification** | `.claude/rules/incremental-verification.md` |

## Viewing Tasks

Use the wm CLI to view and manage tasks:
```bash
pnpm wm tasks list                    # List all tasks
pnpm wm tasks list --issue=NNN        # Tasks for specific issue
pnpm wm tasks list --status=pending   # Find unblocked work
```
