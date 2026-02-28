---
paths:
  - apps/web/src/server/domain/platform/templates/**/*
  - apps/web/src/server/domain/communications/**/*
  - apps/web/src/server/domain/parseforge/services/TemplateService*
---

# Templates

Unified template system for reusable configurations across the platform.

## Architecture

**Two-Tier System:**
- **Platform Templates** (`org_system_template`) - Public marketplace, system-wide
- **Organization Templates** (`org_{orgId}_template`) - Org-scoped, customizable

**Built on DataForge:** Templates are entities using the "template" archetype with custom fields per category.

## Template Categories

| Category | Purpose | Key Fields |
|----------|---------|------------|
| **extraction** | AI document extraction | `fields[]`, `extractionConfig`, `linkingConfig` |
| **workflow** | Multi-step automation | `steps[]`, `triggers[]`, `inputSchema` |
| **ruleset** | Reusable rule conditions | `rules[]`, `mode` (all/any/first) |
| **document** | Document generation | `template` (Handlebars), `schema`, `format` |
| **email** | Email/notification | `subject`, `body`, `variables[]` |
| **lien-waiver** | Lien waiver forms | `state_specific`, `legally_reviewed` |

## Core Services

| Service | Purpose |
|---------|---------|
| `PlatformTemplateService` | List, search public marketplace templates (read-only) |
| `OrgTemplateService` | Install, create, update org templates |
| `CommunicationsTemplateService` | Email/notification template versioning, preview |

## Key Patterns

| Pattern | Usage |
|---------|-------|
| Library Installation | `orgTemplateService.install({ platformTemplateId })` - Creates copy in org table |
| Version Control | `templateService.publish({ changeNotes })` - Links via `version_chain_id` |
| Template Forking | `createFromTemplate({ sourceTemplateId })` - Maintains source reference |
| Variable Substitution | `templateService.preview({ sampleData })` - Renders `{{variable.path}}` |

## Template Status Lifecycle

```
draft → published → superseded (new version published)
                  → archived (soft deleted)
rollback: superseded → creates new draft version
```

## Anti-Patterns

| Anti-Pattern | Fix |
|--------------|-----|
| Hardcode templates in code | Use template from system with `templateService.get()` |
| Direct update (loses history) | Use `publish()` to create version |
| Create template per org | Create in library, `install()` to orgs |

## Key Files

| File | Purpose |
|------|---------|
| `domain/platform/templates/PlatformTemplateService.ts` | Marketplace access |
| `domain/platform/templates/OrgTemplateService.ts` | Org management |
| `domain/communications/services/CommunicationsTemplateService.ts` | Email/notifications |
| `orpc/routers/platform/templates.ts` | Platform API |
| `orpc/routers/communications/templates.ts` | Communications API |
