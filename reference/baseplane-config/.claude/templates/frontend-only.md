# Feature Planning: {{FEATURE_TITLE}}

> **Instructions for Agent:**
> Fill this template during PLANNING session by exploring the codebase.
> Every field must contain ACTUAL file paths and patterns, not placeholders.
> Run searches, read files, understand conventions before filling.
> This template is for frontend-only work (UI changes using existing APIs).

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

**Existing API Endpoints Used:**
<!-- Agent: List the existing API endpoints this UI will consume -->
| Endpoint | Purpose | Response Type |
|----------|---------|---------------|
| <!-- e.g., api.projects.list --> | <!-- --> | <!-- --> |

---

## 0.5 BASELINE VERIFICATION (BLOCKING)

> **CRITICAL:** Before ANY implementation, manually verify the existing feature works.
> If baseline is broken → STOP → File bug → Fix baseline first.
> See `.claude/rules/incremental-verification.md` for full protocol.

### Pre-Implementation Checks

| Check | How to Verify | Expected Result | Status |
|-------|---------------|-----------------|--------|
| Feature being extended works | Navigate to /path, click X | Y should happen | [ ] |
| Data loads correctly | Open DevTools Network tab | API returns data | [ ] |
| No console errors | Open DevTools Console | No errors | [ ] |
| Related features still work | Test adjacent functionality | Works as expected | [ ] |

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

**N/A** - This is a frontend-only feature using existing APIs.

**Verify API exists:**
```bash
# Agent: Confirm endpoints exist in codebase
grep -r "{{endpoint}}" apps/web/src/server/orpc/routers/
```

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

**N/A** - Using existing data models via API.

---

## 4. Security

**N/A** - Authorization handled by existing API endpoints.

**Verify API security:**
- Confirm endpoints use appropriate procedure (`orgProcedure`, `adminProcedure`)
- Ensure sensitive data is not exposed to unauthorized roles

---

## 5. Testing & Verification Gates

> **CRITICAL:** Each phase has a verification gate. Implementation of Phase N+1
> CANNOT start until Phase N verification passes. See `.claude/rules/incremental-verification.md`.

### 5.1 Per-Phase Verification Gates

**Phase 1 Verification (after Store implementation):**
| Check | How to Verify | Status |
|-------|---------------|--------|
| Store initializes | Add console.log in init(), check browser console | [ ] |
| Data loads | Call store.load(), verify items populate | [ ] |
| No MobX warnings | Check console for MobX strictMode warnings | [ ] |

**Phase 2 Verification (after Component implementation):**
| Check | How to Verify | Status |
|-------|---------------|--------|
| Component renders | Navigate to route, see component | [ ] |
| Data displays | Verify list shows loaded data | [ ] |
| Interactions work | Click buttons, verify actions trigger | [ ] |

**Phase 3 Verification (after Routing):**
| Check | How to Verify | Status |
|-------|---------------|--------|
| Routes accessible | Navigate directly to URL | [ ] |
| Navigation works | Click links, verify transitions | [ ] |
| Deep links work | Share URL, open in new tab | [ ] |

### 5.2 Unit Tests

| Test File | What It Tests | Key Mocks |
|-----------|---------------|-----------|
| `apps/web/src/features/{{domain}}/__tests__/{{Domain}}Store.test.ts` | Store actions | API client |
| `apps/web/src/features/{{domain}}/__tests__/{{Domain}}List.test.tsx` | Component rendering | Store |

**Mock patterns to follow:** Search for `__tests__/mocks.ts` in codebase

### 5.3 E2E Tests

| Test File | Acceptance Criteria | Flow |
|-----------|---------------------|------|
| `apps/web/e2e/{{domain}}/crud.spec.ts` | AC1, AC2 | Create, read, update, delete |
| `apps/web/e2e/{{domain}}/navigation.spec.ts` | AC3 | Route transitions |

### 5.4 Final Manual Verification

- [ ] Verify responsive design (mobile, tablet, desktop)
- [ ] Check accessibility (keyboard navigation, screen reader)
- [ ] Cross-browser testing (Chrome, Firefox, Safari)
- [ ] Demo to user before declaring complete
- [ ] <!-- Specific UI verification, e.g., "Match Figma design" -->

---

## 6. Task Breakdown (Verification-Gated)

> **CRITICAL:** Every implementation phase has a paired VERIFY task.
> Phase N+1 implementation depends on Phase N verification passing.
> See `.claude/rules/incremental-verification.md` for protocol.

### Tasks Epic

```bash
pnpm wm tasks create --title="GH#{{ISSUE}}: {{FEATURE_TITLE}}" --type=epic --issue={{ISSUE}}
```

### Tasks (with verification gates)

```bash
# ============================================
# PHASE 0: BASELINE VERIFICATION (FIRST!)
# ============================================
pnpm wm tasks create --title="GH#{{ISSUE}}: VERIFY baseline works" --type=verify --issue={{ISSUE}}
# Steps: Navigate to existing feature, verify it works, document in close reason

# ============================================
# PHASE 1: STATE MANAGEMENT
# ============================================
pnpm wm tasks create --title="GH#{{ISSUE}}: Implement {{Domain}}Store" --type=impl --issue={{ISSUE}}
# Dependencies managed via tasks.yaml structure

# Phase 1 Verification
pnpm wm tasks create --title="GH#{{ISSUE}}: VERIFY Phase 1 - store works" --type=verify --issue={{ISSUE}}
# Steps: Check console for init, verify data loads, check for MobX warnings

# ============================================
# PHASE 2: COMPONENTS
# ============================================
pnpm wm tasks create --title="GH#{{ISSUE}}: Create {{Domain}}List component" --type=impl --issue={{ISSUE}}
pnpm wm tasks create --title="GH#{{ISSUE}}: Create {{Domain}}Detail component" --type=impl --issue={{ISSUE}}
# Dependencies managed via tasks.yaml structure

# Phase 2 Verification
pnpm wm tasks create --title="GH#{{ISSUE}}: VERIFY Phase 2 - components render" --type=verify --issue={{ISSUE}}
# Steps: Navigate to route, verify rendering, test interactions

# ============================================
# PHASE 3: ROUTING
# ============================================
pnpm wm tasks create --title="GH#{{ISSUE}}: Add routes for {{domain}}" --type=impl --issue={{ISSUE}}
# Dependencies managed via tasks.yaml structure

# Phase 3 Verification
pnpm wm tasks create --title="GH#{{ISSUE}}: VERIFY Phase 3 - routing works" --type=verify --issue={{ISSUE}}
# Steps: Navigate directly to URL, test deep links, verify navigation

# ============================================
# PHASE 4: QUALITY (depends on all verifications)
# ============================================
pnpm wm tasks create --title="GH#{{ISSUE}}: Add unit tests" --type=test --issue={{ISSUE}}
pnpm wm tasks create --title="GH#{{ISSUE}}: Add E2E tests" --type=test --issue={{ISSUE}}
pnpm wm tasks create --title="GH#{{ISSUE}}: VERIFY accessibility" --type=verify --issue={{ISSUE}}
# Dependencies managed via tasks.yaml structure

# Final verification
pnpm wm tasks create --title="GH#{{ISSUE}}: VERIFY complete - demo to user" --type=verify --issue={{ISSUE}}

# View tasks
pnpm wm tasks list --issue={{ISSUE}}
```

### Dependency Graph (Expected)

```
      +------------+
      |  BASELINE  |  ← P0: Must pass before any implementation
      +-----+------+
            |
            v
      +-----------+
      |   Store   |
      +-----+-----+
            |
            v
      +-----------+
      | VERIFY 1  |  ← Gate: Store works?
      +-----+-----+
            |
      +-----+-----+
      |           |
      v           v
+---------+  +----------+
|  List   |  |  Detail  |
+----+----+  +----+-----+
     |            |
     +------+-----+
            |
            v
      +-----------+
      | VERIFY 2  |  ← Gate: Components render?
      +-----+-----+
            |
            v
      +-----------+
      |  Routing  |
      +-----+-----+
            |
            v
      +-----------+
      | VERIFY 3  |  ← Gate: Routes work?
      +-----+-----+
            |
     +------+------+------+
     v             v      v
+---------+  +-------+  +------+
|  Unit   |  |  E2E  |  | A11Y |
+----+----+  +---+---+  +--+---+
     |           |         |
     +-----+-----+---------+
           |
           v
      +-----------+
      |   FINAL   |  ← Demo to user
      +-----------+
```

---

## 7. Notes

_Agent fills this during planning:_

- Discovered complexity: <!-- e.g., "Needs complex form validation" -->
- Open questions: <!-- e.g., "Confirm design with stakeholder" -->
- Risks: <!-- e.g., "API may not return needed data" -->
