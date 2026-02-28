# Feature Planning: {{FEATURE_TITLE}}

> **Instructions for Agent:**
> Fill this template during PLANNING session by exploring the codebase.
> Every field must contain ACTUAL file paths and patterns, not placeholders.
> Run searches, read files, understand conventions before filling.
> This template is for backend-only work (API, services, database). Frontend is N/A.

---

## Research Context (Optional)

> Fill this section if prior research informs this feature.
> Link research issues and summarize key findings relevant to this spec.

### Related Research

| Research Issue | Title | How It Informs This Feature |
|----------------|-------|----------------------------|
| #<!-- --> | <!-- --> | <!-- --> |

### Key Findings Applied

<!-- Summarize 2-3 key research findings that shaped this spec's approach -->

1. **Finding:** <!-- -->
   **Impact on spec:** <!-- -->

2. **Finding:** <!-- -->
   **Impact on spec:** <!-- -->

### Unresolved Questions from Research

| Question | How Addressed in Spec |
|----------|----------------------|
| <!-- --> | <!-- Decided X because Y / Deferred / N/A --> |

---

## 0. Feature Context

**GitHub Issue:** #{{ISSUE_NUMBER}}
**Acceptance Criteria:**
<!-- Copy from GitHub issue or spec -->

**Related Features:**
<!-- Agent: Find related features in codebase. What can we learn from? -->

---

## 1. Backend / API

### 1.1 Similar Feature Analysis
<!-- Agent: Search for similar functionality -->

**Most similar existing feature:**
Path: <!-- e.g., apps/web/src/server/domain/workflows/ -->
Why similar: <!-- e.g., "Also has multi-step workflow with approvals" -->

**Router pattern to follow:**
Path: <!-- e.g., apps/web/src/server/orpc/routers/discovery.ts -->
Key patterns: <!-- e.g., "Uses orgProcedure, calls Durable Objects" -->

### 1.2 New Files

| File Path | Purpose | Based On |
|-----------|---------|----------|
| `apps/web/src/server/orpc/routers/{{domain}}.ts` | API endpoints | <!-- existing router --> |
| `apps/web/src/server/domain/{{domain}}/services/{{Domain}}Service.ts` | Business logic | <!-- existing service --> |

### 1.3 API Endpoints

| Procedure | Type | Procedure Base | Input Schema | Output | Notes |
|-----------|------|----------------|--------------|--------|-------|
| `{{domain}}.list` | query | `orgProcedure` | `{projectId: string}` | `Entity[]` | Uses `withRequestKysely` |
| `{{domain}}.create` | mutation | `orgProcedure` | `CreateInput` | `Entity` | Emits event after |

### 1.4 Validation (Zod Schemas)

**Schema file:** `apps/web/src/server/orpc/schemas/{{domain}}/{{domain}}-schemas.ts`

| Schema | Fields | Validation Rules |
|--------|--------|------------------|
| `create{{Domain}}Schema` | <!-- --> | <!-- --> |
| `update{{Domain}}Schema` | <!-- --> | <!-- --> |

### 1.5 Business Logic

**Service file:** `apps/web/src/server/domain/{{domain}}/services/{{Domain}}Service.ts`

| Method | What it does | Dependencies |
|--------|--------------|--------------|
| <!-- --> | <!-- --> | <!-- --> |

---

## 2. Frontend / UI

**N/A** - This is a backend-only feature. Frontend will be handled separately or is not needed.

---

## 3. Database / DataForge

### 3.1 Entity Design

**Approach:**
<!-- "Use existing DataForge archetype" OR "Create new archetype" OR "Extend existing" -->
<!-- Reference: apps/web/src/server/domain/dataforge/archetypes/ -->

**Archetype file:** `apps/web/src/server/domain/dataforge/archetypes/{{Domain}}Archetype.ts`
**Based on:** <!-- existing archetype if extending, e.g., TaskArchetype.ts -->

### 3.2 Fields

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `id` | `string` | Yes | Generated | Primary key (auto) |
| `organization_id` | `string` | Yes | Context | Tenant scope (auto) |
| `name` | `text` | Yes | - | Display name |
| `status` | `status_set` | Yes | `'draft'` | Use status_set, NOT enum |
| `created_at` | `timestamp` | Yes | Now | Audit (auto) |
| `updated_at` | `timestamp` | Yes | Now | Audit (auto) |

### 3.3 Relationships

<!-- Agent: Use Relationship system from registry.ts, NOT junction tables -->
<!-- Reference fields in archetype become relationships, not table columns -->

| From | To | Relationship Type | Properties |
|------|----|-------------------|------------|
| `{{Entity}}` | `Project` | `belongs_to` | isPrimary: true |
| `{{Entity}}` | `User` | `created_by` | (none) |
| `{{Entity}}` | `User` | `assigned_to` | role, effortPercentage |
| `{{Entity}}` | `OtherEntity` | `relates_to` | semantic, label |

### 3.4 Migration

**Migration needed?** Yes / No
**Migration file:** `apps/web/migrations/XXXX_create_{{domain}}.sql`

```sql
-- Agent: Fill with actual DDL if needed
-- Note: Reference fields become relationships, not columns
```

---

## 4. Security

### 4.1 Authorization

**Access control pattern:** <!-- e.g., "Team-based (ProjectArchetype)" or "Custom (TaskArchetype)" -->
**Reference:** `apps/web/src/server/orpc/procedures.ts` (orgProcedure, adminProcedure)

| Action | Procedure | Permission Check | Scope |
|--------|-----------|------------------|-------|
| List | `orgProcedure` | Org member | Organization |
| Create | `orgProcedure` | Org member | Organization |
| Update | `orgProcedure` | Creator OR admin | Entity |
| Delete | `adminProcedure` | Admin only | Entity |

### 4.2 Input Validation

| Input | Risk | Mitigation |
|-------|------|------------|
| `name` | XSS | Zod string validation, max length |
| `content` | Injection | Parameterized queries via Kysely |

### 4.3 Audit Trail

| Action | Log Level | Data Captured |
|--------|-----------|---------------|
| Create | INFO | `{entityId, userId, organizationId}` |
| Update | INFO | `{entityId, userId, changes}` |
| Delete | WARN | `{entityId, userId, reason}` |

---

## 5. Test Strategy

> **CRITICAL:** This section defines the complete test plan executed during implementation.
> Each test case becomes a task in tasks.yaml. Tests are NOT optional - they gate completion.
>
> **TDD Enforcement:** Implementation sessions have hooks that warn when editing production code
> without test changes. Ensure each implementation task has corresponding test cases here.

### 5.1 Test Environment

| Requirement | Value | Notes |
|-------------|-------|-------|
| Organization | <!-- e.g., DEB Construction --> | <!-- Why this org? --> |
| User/Role | <!-- e.g., admin@widecorp.com --> | <!-- Required permissions --> |
| External Services | <!-- e.g., Procore tokens --> | <!-- How to verify --> |
| Test Data | <!-- e.g., Seed script --> | <!-- --> |

**Environment Readiness Check:**
```bash
# Verify env is ready before testing
./scripts/auth/login-test-user.sh "user@example.com" "password"
curl -s http://localhost:$DEV_PORT/api/health | jq .
```

### 5.2 Test Cases by Category

#### Category 1: {{Primary Feature Area}}

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| 1.1 | <!-- e.g., Create entity --> | <!-- Step-by-step --> | <!-- Success looks like --> | P1 |
| 1.2 | <!-- e.g., List with filters --> | <!-- --> | <!-- --> | P1 |
| 1.3 | <!-- e.g., Update entity --> | <!-- --> | <!-- --> | P1 |

#### Category 2: Error Handling

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| 2.1 | Invalid input rejected | Send malformed data | 400 with errors | P1 |
| 2.2 | Unauthorized blocked | Request without auth | 401/403 | P1 |
| 2.3 | Not found handled | Non-existent ID | 404 | P2 |

#### Category 3: Edge Cases

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| 3.1 | Empty state | No data exists | Appropriate response | P2 |
| 3.2 | Large dataset | 1000+ records | Pagination works | P2 |

### 5.3 API Test Commands

```bash
# List
curl -s http://localhost:$DEV_PORT/api/orpc/{{domain}}/list \
  -H "Cookie: $(cat .auth-cookie)" \
  -H "Content-Type: application/json" \
  -d '{"json":{}}' | jq .

# Create
curl -s http://localhost:$DEV_PORT/api/orpc/{{domain}}/create \
  -H "Cookie: $(cat .auth-cookie)" \
  -H "Content-Type: application/json" \
  -d '{"json":{"name":"Test"}}' | jq .

# Error case
curl -s http://localhost:$DEV_PORT/api/orpc/{{domain}}/create \
  -H "Cookie: $(cat .auth-cookie)" \
  -H "Content-Type: application/json" \
  -d '{"json":{"name":""}}' | jq .  # Expect validation error
```

### 5.4 Automated Tests

| Test File | What It Tests | Test Cases Covered |
|-----------|---------------|-------------------|
| `{{domain}}/{{Domain}}Service.test.ts` | Service logic | 1.1-1.3, 2.1-2.3 |
| `{{domain}}/{{domain}}.integration.test.ts` | API endpoints | Full CRUD flow |

### 5.5 Success Criteria

| Criterion | Test Cases | Verified By | Status |
|-----------|------------|-------------|--------|
| CRUD operations work | 1.1-1.3 | API tests | [ ] |
| Validation prevents bad data | 2.1-2.3 | API tests | [ ] |
| Edge cases handled | 3.1-3.2 | Manual | [ ] |

---

## 6. Task Breakdown

### Tasks Epic

```bash
pnpm wm tasks create --title="GH#{{ISSUE}}: {{FEATURE_TITLE}}" --type=epic --issue={{ISSUE}}
```

### Tasks (with dependencies)

```bash
# Phase 1: Foundation
pnpm wm tasks create --title="GH#{{ISSUE}}: Create {{domain}} archetype/migration" --type=impl --issue={{ISSUE}}
pnpm wm tasks create --title="GH#{{ISSUE}}: Create {{domain}} router and schemas" --type=impl --issue={{ISSUE}}
pnpm wm tasks create --title="GH#{{ISSUE}}: Implement {{Domain}}Service business logic" --type=impl --issue={{ISSUE}}
# Dependencies managed via tasks.yaml structure

# Phase 2: Quality
pnpm wm tasks create --title="GH#{{ISSUE}}: Add unit tests for service" --type=test --issue={{ISSUE}}
pnpm wm tasks create --title="GH#{{ISSUE}}: Add API integration tests" --type=test --issue={{ISSUE}}
pnpm wm tasks create --title="GH#{{ISSUE}}: Security review" --type=verify --issue={{ISSUE}}
# Dependencies managed via tasks.yaml structure

# View tasks
pnpm wm tasks list --issue={{ISSUE}}
```

### Dependency Graph (Expected)

```
     +-----------+
     | Database  |
     +-----+-----+
           |
     +-----+-----+
     |           |
     v           v
+---------+  +---------+
|  Router |  | Service |
+----+----+  +----+----+
     |            |
     +------+-----+
            |
     +------+------+
     v             v
+-----------+  +-----------+
|Integration|  | Security  |
+-----------+  +-----------+
```

---

## 7. Notes

_Agent fills this during planning:_

- Discovered complexity: <!-- e.g., "Needs external service integration" -->
- Open questions: <!-- e.g., "Rate limiting strategy?" -->
- Risks: <!-- e.g., "Large migration, needs downtime" -->
