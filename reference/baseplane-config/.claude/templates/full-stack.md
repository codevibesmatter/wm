# Feature Planning: {{FEATURE_TITLE}}

> **Instructions for Agent:**
> Fill this template during PLANNING session by exploring the codebase.
> Every field must contain ACTUAL file paths and patterns, not placeholders.
> Run searches, read files, understand conventions before filling.
> Mark sections N/A if not applicable to this feature.

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

## 0.5 BASELINE VERIFICATION (BLOCKING)

> **CRITICAL:** Before ANY implementation, manually verify existing related features work.
> If baseline is broken → STOP → File bug → Fix baseline first.
> See `.claude/rules/incremental-verification.md` for full protocol.

### Pre-Implementation Checks

| Check | How to Verify | Expected Result | Status |
|-------|---------------|-----------------|--------|
| Related API works | curl or test existing endpoint | Returns expected data | [ ] |
| Related UI works | Navigate to similar feature | Renders correctly | [ ] |
| Database accessible | Run test query | Returns data | [ ] |
| No console errors | Open DevTools Console | No errors | [ ] |

**If ANY check fails:**
1. STOP planning
2. File a bug issue for the broken baseline
3. Fix baseline before extending

### Baseline Verification Task (auto-created via wm CLI)
```bash
# This task MUST be first and MUST block all implementation
pnpm wm tasks create --title="GH#{{ISSUE}}: VERIFY baseline works before implementing" --type=verify --issue={{ISSUE}}
```

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

### 2.1 Similar Feature Analysis

**Most similar existing feature:**
Path: <!-- e.g., apps/web/src/features/parseforge/ -->
Why similar: <!-- e.g., "Also has list + detail + editor pattern" -->

**Component patterns to follow:**
- List: <!-- e.g., apps/web/src/features/parseforge/components/SchemaList.tsx -->
- Detail: <!-- e.g., apps/web/src/features/parseforge/components/SchemaDetail.tsx -->
- Form: <!-- e.g., apps/web/src/components/forms/EntityForm.tsx -->

### 2.2 New Files

| File Path | Purpose | Based On |
|-----------|---------|----------|
| `apps/web/src/features/{{domain}}/stores/{{Domain}}Store.ts` | State management | <!-- existing store --> |
| `apps/web/src/features/{{domain}}/components/{{Domain}}List.tsx` | List view | <!-- existing component --> |
| `apps/web/src/features/{{domain}}/components/{{Domain}}Detail.tsx` | Detail view | <!-- --> |

### 2.3 MobX Store Design

**Store file:** `apps/web/src/features/{{domain}}/stores/{{Domain}}Store.ts`
**Root store integration:** `apps/web/src/app/stores/index.tsx` line <!-- number -->

**Key Patterns (from AuthStore.ts, SchemaEditorStore.ts):**
- Call `makeObservable(this)` in constructor
- Use `runInAction` for async callbacks
- Implement `IStore` interface (`init()`, `dispose()`)
- Use `DisposerManager` for cleanup

**Observable State:**
| Field | Type | Initial | Purpose |
|-------|------|---------|---------|
| `items` | `Map<string, Entity>` | `new Map()` | All loaded entities |
| `selectedId` | `string \| null` | `null` | Currently selected |
| `isLoading` | `boolean` | `false` | Loading state |

**Actions:**
| Action | API Call | Optimistic? | Error Handling |
|--------|----------|-------------|----------------|
| `load()` | `api.{{domain}}.list.query()` | No | Toast + retry |
| `create(input)` | `api.{{domain}}.create.mutate()` | Yes | Rollback + toast |
| `update(id, input)` | `api.{{domain}}.update.mutate()` | Yes | Rollback + toast |

**Computed Values:**
| Computed | Derivation | Used By |
|----------|------------|---------|
| `itemsList` | `Array.from(this.items.values())` | List component |
| `selected` | `this.items.get(this.selectedId)` | Detail component |

### 2.4 Component Props & State

| Component | Props | Local State | Store Access |
|-----------|-------|-------------|--------------|
| `{{Domain}}List` | <!-- --> | <!-- --> | `useRootStore().experience.{{domain}}` |
| `{{Domain}}Detail` | `id: string` | <!-- --> | <!-- --> |

### 2.5 Routing

**Route file:** Update `apps/web/src/app/routes/` or add new route file

| Route | Component | Params | Loader |
|-------|-----------|--------|--------|
| `/{{domain}}` | `{{Domain}}List` | - | Load list |
| `/{{domain}}/:id` | `{{Domain}}Detail` | `id` | Load single |

### 2.6 Accessibility & Testing

**data-testid attributes needed:**
| Element | data-testid | Purpose |
|---------|-------------|---------|
| List container | `{{domain}}-list` | E2E: verify list loads |
| Create button | `{{domain}}-create-btn` | E2E: create flow |
| List item | `{{domain}}-item-{id}` | E2E: select item |
| Save button | `{{domain}}-save-btn` | E2E: save flow |

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

> **CRITICAL:** This section defines the complete test plan that will be executed during implementation.
> Each test case becomes a task in tasks.yaml. Tests are NOT optional - they gate feature completion.
> See `.claude/rules/incremental-verification.md` for the verification protocol.
>
> **TDD Enforcement:** Implementation sessions have hooks that warn when editing production code
> without test changes. Ensure each implementation task has corresponding test cases here.

### 5.1 Test Environment

> **Agent:** Document exactly what's needed to test this feature. Be specific.

| Requirement | Value | Notes |
|-------------|-------|-------|
| Organization | <!-- e.g., DEB Construction --> | <!-- Why this org? --> |
| User/Role | <!-- e.g., ceo@widecorp.com (owner) --> | <!-- Required permissions --> |
| External Services | <!-- e.g., Valid Procore OAuth tokens --> | <!-- How to verify ready --> |
| Test Data | <!-- e.g., 10+ tasks with dependencies --> | <!-- Seed script or manual? --> |
| Dev Server | <!-- Port, special config --> | <!-- --> |

**Environment Readiness Check:**
```bash
# Agent: Fill with actual commands to verify env is ready
./scripts/auth/login-test-user.sh "user@example.com" "password"
curl -s http://localhost:$DEV_PORT/api/health | jq .
# Additional env checks...
```

### 5.2 Test Cases by Category

> **Agent:** Create test cases for EACH major feature area. These become VERIFY tasks.
> Pattern: Happy path → Edge cases → Error cases → Performance (if applicable)

#### Category 1: {{Primary Feature Area}}

<!-- e.g., "CRUD Operations", "Discovery", "Sync Pipeline" -->

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| 1.1 | <!-- e.g., Create entity --> | <!-- Step-by-step --> | <!-- What success looks like --> | P1 |
| 1.2 | <!-- e.g., List with pagination --> | <!-- --> | <!-- --> | P1 |
| 1.3 | <!-- e.g., Update with validation --> | <!-- --> | <!-- --> | P1 |
| 1.4 | <!-- e.g., Delete with cascade --> | <!-- --> | <!-- --> | P2 |

#### Category 2: {{Secondary Feature Area}}

<!-- e.g., "Relationships", "Permissions", "Hooks" -->

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| 2.1 | <!-- --> | <!-- --> | <!-- --> | P1 |
| 2.2 | <!-- --> | <!-- --> | <!-- --> | P2 |

#### Category 3: Error Handling

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| 3.1 | Invalid input rejected | Send malformed data | 400 with validation errors | P1 |
| 3.2 | Unauthorized access blocked | Request without auth | 401/403 returned | P1 |
| 3.3 | Not found handled | Request non-existent ID | 404 with clear message | P2 |
| 3.4 | <!-- External service failure --> | <!-- --> | <!-- Graceful degradation --> | P2 |

#### Category 4: Edge Cases

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| 4.1 | Empty state | No data exists | Appropriate empty UI/response | P2 |
| 4.2 | Large dataset | 1000+ records | Pagination works, no timeout | P2 |
| 4.3 | Concurrent updates | Two users edit same record | Conflict handled gracefully | P3 |
| 4.4 | <!-- Domain-specific edge case --> | <!-- --> | <!-- --> | P2 |

#### Category 5: Performance (if applicable)

| # | Test Case | Threshold | How to Measure |
|---|-----------|-----------|----------------|
| 5.1 | List response time | < 500ms | Measure with `time curl ...` |
| 5.2 | Create latency | < 200ms | Chrome DevTools Network |
| 5.3 | Bulk operation | 100 items < 5s | Script with timing |

### 5.3 API Test Commands

> **Agent:** Provide READY-TO-RUN commands for each API endpoint.
> Tester should be able to copy-paste these during implementation.

```bash
# List all
curl -s http://localhost:$DEV_PORT/api/orpc/{{domain}}/list \
  -H "Cookie: $(cat .auth-cookie)" \
  -H "Content-Type: application/json" \
  -d '{"json":{}}' | jq .

# Create
curl -s http://localhost:$DEV_PORT/api/orpc/{{domain}}/create \
  -H "Cookie: $(cat .auth-cookie)" \
  -H "Content-Type: application/json" \
  -d '{"json":{"name":"Test Item","status":"draft"}}' | jq .

# Get by ID
curl -s http://localhost:$DEV_PORT/api/orpc/{{domain}}/get \
  -H "Cookie: $(cat .auth-cookie)" \
  -H "Content-Type: application/json" \
  -d '{"json":{"id":"<ID_HERE>"}}' | jq .

# Update
curl -s http://localhost:$DEV_PORT/api/orpc/{{domain}}/update \
  -H "Cookie: $(cat .auth-cookie)" \
  -H "Content-Type: application/json" \
  -d '{"json":{"id":"<ID_HERE>","data":{"name":"Updated"}}}' | jq .

# Delete
curl -s http://localhost:$DEV_PORT/api/orpc/{{domain}}/delete \
  -H "Cookie: $(cat .auth-cookie)" \
  -H "Content-Type: application/json" \
  -d '{"json":{"id":"<ID_HERE>"}}' | jq .

# Error case: invalid input
curl -s http://localhost:$DEV_PORT/api/orpc/{{domain}}/create \
  -H "Cookie: $(cat .auth-cookie)" \
  -H "Content-Type: application/json" \
  -d '{"json":{"name":""}}' | jq .  # Expect validation error
```

### 5.4 Per-Phase Verification Gates

> Each phase has a verification gate that MUST pass before proceeding.

**Phase 1 Verification (Backend/DB):**
| Check | Command/Steps | Expected | Status |
|-------|---------------|----------|--------|
| API responds | `curl .../api/orpc/{{domain}}/list` | 200 with data | [ ] |
| Data persists | Create via API, query DB directly | Record exists | [ ] |
| Validation works | Send empty name | 400 with error | [ ] |

**Phase 2 Verification (Store):**
| Check | Command/Steps | Expected | Status |
|-------|---------------|----------|--------|
| Store loads | `store.load()`, check `items.size` | > 0 | [ ] |
| Create works | `store.create({...})` | New item in store | [ ] |
| Error handled | Trigger API error | Toast shown, no crash | [ ] |

**Phase 3 Verification (Components):**
| Check | Command/Steps | Expected | Status |
|-------|---------------|----------|--------|
| List renders | Navigate to `/{{domain}}` | Items displayed | [ ] |
| Detail renders | Click item | Detail view shows | [ ] |
| Form submits | Fill form, click save | Item created/updated | [ ] |

### 5.5 Automated Tests

| Test File | What It Tests | Test Cases Covered |
|-----------|---------------|-------------------|
| `{{domain}}/{{Domain}}Service.test.ts` | Service logic | 1.1-1.4, 3.1-3.3 |
| `{{domain}}/{{Domain}}Store.test.ts` | Store actions | 2.1-2.2, error handling |
| `e2e/{{domain}}/crud.spec.ts` | Full flow | 1.1-1.4 end-to-end |
| `e2e/{{domain}}/errors.spec.ts` | Error states | 3.1-3.4 in browser |

### 5.6 Success Criteria

> **All must pass for feature to be complete.** Map to acceptance criteria from issue.

| Criterion | Test Cases | Verified By | Status |
|-----------|------------|-------------|--------|
| Users can create {{entity}} | 1.1 | API + E2E | [ ] |
| Users can view {{entity}} list | 1.2 | E2E | [ ] |
| Users can update {{entity}} | 1.3 | API + E2E | [ ] |
| Validation prevents bad data | 3.1, 3.2 | API tests | [ ] |
| UI handles errors gracefully | 3.3, 3.4 | Manual + E2E | [ ] |
| Performance meets threshold | 5.1, 5.2 | Manual measurement | [ ] |
| <!-- From AC in issue --> | <!-- --> | <!-- --> | [ ] |

### 5.7 Final Demo Checklist

- [ ] **Demo all CRUD operations** to user
- [ ] **Show error handling** (at least one error case)
- [ ] **Verify all success criteria** are checked
- [ ] **Confirm acceptance criteria** from GitHub issue are met
- [ ] **Take screenshot/recording** as evidence

---

## 6. Task Breakdown (TDD-Enforced)

> **CRITICAL: TRUE TDD - Tests BLOCK Implementation**
>
> Each phase follows: `TEST → IMPL → VERIFY`
> - **TEST**: Write failing tests FIRST (blocks IMPL)
> - **IMPL**: Make tests pass (depends on TEST, blocks VERIFY)
> - **VERIFY**: Manual verification (depends on IMPL)
>
> See `.claude/rules/incremental-verification.md` for protocol.
> Stop conditions require: `test_tasks_created` for each success criterion.

### Tasks Epic

```bash
pnpm wm tasks create --title="GH#{{ISSUE}}: {{FEATURE_TITLE}}" --type=epic --issue={{ISSUE}}
```

### Phase 0: Baseline Verification (BLOCKS ALL)

```bash
# ============================================
# PHASE 0: BASELINE - Must pass before ANY work
# ============================================
pnpm wm tasks create --title="GH#{{ISSUE}}: VERIFY baseline - env ready" --type=verify --issue={{ISSUE}}
# Execute: Section 5.1 Environment Readiness Check
# If ANY check fails → STOP → File bug → Fix baseline first
```

### Phase 1: Backend/Database (TDD)

```bash
# ============================================
# PHASE 1: BACKEND + DATABASE (TDD Pattern)
# ============================================

# Step 1: Write tests FIRST (RED phase)
pnpm wm tasks create --title="GH#{{ISSUE}}: TEST Phase 1 - write backend unit tests" --type=test --issue={{ISSUE}}
# Write tests for: API endpoints, service methods, validation
# Tests should FAIL initially (no implementation yet)
# Reference: Section 5.2 Category 1 test cases

# Step 2: Implement to make tests pass (GREEN phase)
pnpm wm tasks create --title="GH#{{ISSUE}}: IMPL archetype/migration" --type=impl --issue={{ISSUE}}
pnpm wm tasks create --title="GH#{{ISSUE}}: IMPL router and service" --type=impl --issue={{ISSUE}}

# Step 3: Verify (tests pass + manual check)
pnpm wm tasks create --title="GH#{{ISSUE}}: VERIFY Phase 1 - backend tests pass" --type=verify --issue={{ISSUE}}
# Run: pnpm test -- {{domain}}
# Execute: Section 5.4 Phase 1 Verification Gate
# All API commands from Section 5.3 must work

# Dependencies managed via tasks.yaml structure
```

### Phase 2: Frontend Store (TDD)

```bash
# ============================================
# PHASE 2: FRONTEND STORE (TDD Pattern)
# ============================================

# Step 1: Write store tests FIRST
pnpm wm tasks create --title="GH#{{ISSUE}}: TEST Phase 2 - write store unit tests" --type=test --issue={{ISSUE}}
# Write tests for: store actions, computed values, error handling
# Reference: Section 5.2 Category 2 test cases

# Step 2: Implement store
pnpm wm tasks create --title="GH#{{ISSUE}}: IMPL {{Domain}}Store" --type=impl --issue={{ISSUE}}

# Step 3: Verify
pnpm wm tasks create --title="GH#{{ISSUE}}: VERIFY Phase 2 - store tests pass" --type=verify --issue={{ISSUE}}
# Run: pnpm test -- {{Domain}}Store
# Execute: Section 5.4 Phase 2 Verification Gate

# Dependencies managed via tasks.yaml structure
```

### Phase 3: Components (TDD)

```bash
# ============================================
# PHASE 3: COMPONENTS (TDD Pattern)
# ============================================

# Step 1: Write component tests FIRST
pnpm wm tasks create --title="GH#{{ISSUE}}: TEST Phase 3 - write component tests" --type=test --issue={{ISSUE}}
# Write tests for: rendering, user interactions, data-testid elements
# Reference: Section 2.6 Accessibility & Testing

# Step 2: Implement components
pnpm wm tasks create --title="GH#{{ISSUE}}: IMPL {{domain}} components" --type=impl --issue={{ISSUE}}

# Step 3: Verify
pnpm wm tasks create --title="GH#{{ISSUE}}: VERIFY Phase 3 - UI renders correctly" --type=verify --issue={{ISSUE}}
# Execute: Section 5.4 Phase 3 Verification Gate
# Manual: Navigate to UI, verify all data-testid elements work

# Dependencies managed via tasks.yaml structure
```

### Phase 4: Error & Edge Cases (TDD)

```bash
# ============================================
# PHASE 4: ERROR HANDLING + EDGE CASES (TDD)
# ============================================

# Error handling tests FIRST
pnpm wm tasks create --title="GH#{{ISSUE}}: TEST error handling - write tests" --type=test --issue={{ISSUE}}
# Reference: Section 5.2 Category 3 (Error Handling)

pnpm wm tasks create --title="GH#{{ISSUE}}: IMPL error handling" --type=impl --issue={{ISSUE}}
pnpm wm tasks create --title="GH#{{ISSUE}}: VERIFY errors handled gracefully" --type=verify --issue={{ISSUE}}

# Edge case tests FIRST
pnpm wm tasks create --title="GH#{{ISSUE}}: TEST edge cases - write tests" --type=test --issue={{ISSUE}}
# Reference: Section 5.2 Category 4 (Edge Cases)

pnpm wm tasks create --title="GH#{{ISSUE}}: IMPL edge case handling" --type=impl --issue={{ISSUE}}
pnpm wm tasks create --title="GH#{{ISSUE}}: VERIFY edge cases handled" --type=verify --issue={{ISSUE}}

# Dependencies managed via tasks.yaml structure
```

### Phase 5: E2E Tests & Performance

```bash
# ============================================
# PHASE 5: E2E + PERFORMANCE
# ============================================

# E2E tests (integration, not TDD - runs after components work)
pnpm wm tasks create --title="GH#{{ISSUE}}: Write E2E tests" --type=test --issue={{ISSUE}}
# Reference: Section 5.5 Automated Tests table

pnpm wm tasks create --title="GH#{{ISSUE}}: VERIFY E2E tests pass" --type=verify --issue={{ISSUE}}

# Performance (if applicable)
pnpm wm tasks create --title="GH#{{ISSUE}}: TEST performance thresholds" --type=test --issue={{ISSUE}}
# Reference: Section 5.2 Category 5 (Performance)

pnpm wm tasks create --title="GH#{{ISSUE}}: VERIFY performance thresholds met" --type=verify --issue={{ISSUE}}

# Dependencies managed via tasks.yaml structure
```

### Success Criteria Verification (Stop Condition Required)

> **REQUIRED BY STOP CONDITIONS:** `test_tasks_created` for each success criterion.
> Create one VERIFY task per success criterion from Section 5.6.

```bash
# ============================================
# SUCCESS CRITERIA TASKS (from Section 5.6)
# ============================================

# Create one task per success criterion row
pnpm wm tasks create --title="GH#{{ISSUE}}: SC: Users can create {{entity}}" --type=verify --issue={{ISSUE}}
pnpm wm tasks create --title="GH#{{ISSUE}}: SC: Users can view {{entity}} list" --type=verify --issue={{ISSUE}}
pnpm wm tasks create --title="GH#{{ISSUE}}: SC: Users can update {{entity}}" --type=verify --issue={{ISSUE}}
pnpm wm tasks create --title="GH#{{ISSUE}}: SC: Validation prevents bad data" --type=verify --issue={{ISSUE}}
pnpm wm tasks create --title="GH#{{ISSUE}}: SC: UI handles errors gracefully" --type=verify --issue={{ISSUE}}

# Add more SC tasks for each row in Section 5.6...

# All success criteria must pass for final
pnpm wm tasks create --title="GH#{{ISSUE}}: VERIFY all success criteria passed" --type=verify --issue={{ISSUE}}

# Dependencies managed via tasks.yaml structure
```

### Final Demo

```bash
# ============================================
# FINAL: DEMO TO USER
# ============================================
pnpm wm tasks create --title="GH#{{ISSUE}}: DEMO to user - feature complete" --type=verify --issue={{ISSUE}}
# Execute: Section 5.7 Final Demo Checklist
# - Demo all CRUD operations
# - Show error handling
# - Confirm all success criteria checked
# - Take screenshot/recording as evidence

# Dependencies managed via tasks.yaml structure
```

### Finalization Phase (Required by Stop Conditions)

> **CRITICAL:** Implementation sessions require this finalization phase.
> Stop conditions enforce: `codex_code_review`, `learning_captured`
> See implementation-mode SKILL.md Steps 6-8.

```bash
# ============================================
# FINALIZATION PHASE: CODE REVIEW + LEARNING
# ============================================

# Step 1: Codex Code Review - BLOCKING
pnpm wm tasks create --title="GH#{{ISSUE}}: Codex code review" --type=review --issue={{ISSUE}}
# Execute: pnpm at codex :code
# If fails: Fix violations, re-run
# BLOCKING: Cannot proceed until Codex review passes

# Step 2: Typecheck + Lint
pnpm wm tasks create --title="GH#{{ISSUE}}: Typecheck and lint pass" --type=verify --issue={{ISSUE}}
# Execute: pnpm typecheck && pnpm lint
# Required for: typecheck_pass stop condition

# Step 3: Commit & Push
pnpm wm tasks create --title="GH#{{ISSUE}}: Commit and push changes" --type=task --issue={{ISSUE}}
# Execute: git add -A && git commit && git push
# Required for: changes_committed, changes_pushed stop conditions

# Step 4: Learning Capture Agent (REQUIRED - stop hook enforced)
pnpm wm tasks create --title="GH#{{ISSUE}}: Spawn @learning-capture agent" --type=task --issue={{ISSUE}}
# SPAWN AGENT (not script):
#   Task(subagent_type="learning-capture", prompt="
#     Analyze session for GH#{{ISSUE}}.
#     1. Read .claude/sessions/issue-{{ISSUE}}/errors.jsonl
#     2. Find user corrections in session
#     3. Update .claude/rules/*.md with patterns found
#     4. Create GitHub issues for improvements
#     5. Run .claude/workflows/scripts/capture-learning.sh
#   ")
# BLOCKING: Session cannot end until learningCaptured=true in state

# Step 5: Update GitHub Issue
pnpm wm tasks create --title="GH#{{ISSUE}}: Update GitHub issue with results" --type=task --issue={{ISSUE}}
# Execute: gh issue comment {{ISSUE}} --body "Implementation complete..."
# Required for: github_updated stop condition

# View task structure
pnpm wm tasks list --issue={{ISSUE}}
```

### Pre-Breakdown Gates (Planning Phase)

> **NOTE:** These gates must pass BEFORE creating the task breakdown above.
> They are part of the planning workflow, not implementation tasks.

| Gate | Command | Threshold | Phase |
|------|---------|-----------|-------|
| Codex Spec Review | `pnpm at codex :spec planning/specs/{{ISSUE}}-*.md` | Score + recommendations | review |
| Thoroughness Check | `.claude/skills/validate-spec/scripts/validate.sh planning/specs/{{ISSUE}}-*.md` | No MUST_CHANGE | review |
| Human Approval | User says "approve" | explicit | review |

**Only create task breakdown after all gates pass.**

### TDD Dependency Graph

```
                    +------------+
                    |  BASELINE  |  ← P0: Env ready?
                    +-----+------+
                          |
                          v
                    +-----------+
                    | TEST P1   |  ← Write backend tests (RED)
                    +-----+-----+
                          |
                          v
              +-----------+-----------+
              |                       |
              v                       v
        +-----------+           +-----------+
        | IMPL DB   |           | IMPL API  |
        +-----+-----+           +-----+-----+
              |                       |
              +-----------+-----------+
                          |
                          v
                    +-----------+
                    | VERIFY P1 |  ← Gate: Tests pass?
                    +-----+-----+
                          |
                          v
                    +-----------+
                    | TEST P2   |  ← Write store tests (RED)
                    +-----+-----+
                          |
                          v
                    +-----------+
                    | IMPL Store|
                    +-----+-----+
                          |
                          v
                    +-----------+
                    | VERIFY P2 |  ← Gate: Store works?
                    +-----+-----+
                          |
                          v
                    +-----------+
                    | TEST P3   |  ← Write component tests (RED)
                    +-----+-----+
                          |
                          v
                    +-----------+
                    |IMPL Comps |
                    +-----+-----+
                          |
                          v
                    +-----------+
                    | VERIFY P3 |  ← Gate: UI works?
                    +-----+-----+
                          |
           +--------------+---------------+
           |              |               |
           v              v               v
     +---------+    +---------+     +---------+
     |TEST Err |    |TEST Edge|     |  E2E    |
     +----+----+    +----+----+     +----+----+
          |              |               |
          v              v               v
     +---------+    +---------+     +---------+
     |IMPL Err |    |IMPL Edge|     |VERIFY E2E|
     +----+----+    +----+----+     +----+----+
          |              |               |
          v              v               |
     +---------+    +---------+          |
     |VERIFY   |    |VERIFY   |          |
     | Errors  |    | Edge    |          |
     +----+----+    +----+----+          |
          |              |               |
          +------+-------+---------------+
                 |
                 v
     +------------------------+
     | SUCCESS CRITERIA (SC)  |
     | SC_1, SC_2, SC_3...    |
     +------------------------+
                 |
                 v
     +------------------------+
     | VERIFY ALL CRITERIA    |
     +------------------------+
                 |
                 v
     +------------------------+
     |       DEMO             |
     +------------------------+
                 |
                 v
     +------------------------+
     | FINALIZATION PHASE     |
     +------------------------+
                 |
      +----------+----------+
      |          |          |
      v          v          v
  +-------+ +-------+ +---------+
  | CODEX | |QUALITY| | COMMIT  |
  | CODE  | |typecheck| | & PUSH|
  | REVIEW| | lint  | |         |
  +---+---+ +---+---+ +----+----+
      |          |          |
      +-----+----+----------+
            |
            v
     +------------------------+
     |  LEARNING CAPTURE      |  ← BLOCKING (stop hook)
     +------------------------+
                 |
                 v
     +------------------------+
     |  UPDATE GITHUB ISSUE   |
     +------------------------+
```

### TDD Enforcement Summary

| Phase | TEST Task | IMPL Task | VERIFY Task | Gate |
|-------|-----------|-----------|-------------|------|
| P1 Backend | Write API tests | Archetype + Router | Run tests, Section 5.4 | Tests pass |
| P2 Store | Write store tests | MobX Store | Run tests, Section 5.4 | Tests pass |
| P3 UI | Write component tests | React Components | Manual + Section 5.4 | UI works |
| P4 Errors | Write error tests | Error handling | Section 5.2 Cat 3 | Errors handled |
| P4 Edge | Write edge tests | Edge case handling | Section 5.2 Cat 4 | Edge cases handled |
| Demo | - | - | Demo to user | All SC pass |
| Finalize | Codex code review (BLOCKING) | Typecheck + lint | Commit & push | ≥70 (BLOCKING), `typecheck_pass` |
| Close | - | @learning-capture agent | Update GitHub | `learning_captured` (BLOCKING), `github_updated` |

# Dependencies managed via tasks.yaml structure, not CLI dependency commands.

---

## 7. Notes

_Agent fills this during planning:_

- Discovered complexity: <!-- e.g., "Needs real-time sync, add WebSocket task" -->
- Open questions: <!-- e.g., "Confirm design with stakeholder" -->
- Risks: <!-- e.g., "Large migration, needs downtime" -->
