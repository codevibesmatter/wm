# Infrastructure Planning: {{FEATURE_TITLE}}

> **Instructions for Agent:**
> Fill this template during PLANNING session by exploring the codebase.
> Every field must contain ACTUAL file paths and patterns, not placeholders.
> Run searches, read files, understand conventions before filling.
> This template is for infrastructure work: CI/CD, migrations, tooling, dev workflows.

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
**Type:** <!-- CI/CD | Migration | Tooling | Developer Workflow | Monitoring | Other -->
**Acceptance Criteria:**
<!-- Copy from GitHub issue or spec -->

**Related Infrastructure:**
<!-- Agent: Find similar infrastructure in codebase. What patterns exist? -->

---

## 1. Current State Analysis

### 1.1 Existing Infrastructure
<!-- Agent: Document what currently exists -->

**Related files:**
| Path | Purpose | Relevant Lines |
|------|---------|----------------|
| <!-- e.g., .github/workflows/deploy.yml --> | <!-- --> | <!-- --> |

**Current behavior:**
<!-- What happens today? What's the problem? -->

### 1.2 Similar Changes
<!-- Agent: Find examples of similar infrastructure work -->

**Most similar prior change:**
Commit/PR: <!-- e.g., #123 or commit abc1234 -->
What it did: <!-- e.g., "Added staging deploy workflow" -->
Files changed: <!-- List key files -->

---

## 2. Proposed Changes

### 2.1 Files to Modify

| File Path | Change Type | Description |
|-----------|-------------|-------------|
| <!-- --> | Create/Modify/Delete | <!-- --> |

### 2.2 New Files

| File Path | Purpose | Based On |
|-----------|---------|----------|
| <!-- --> | <!-- --> | <!-- existing file if applicable --> |

### 2.3 Configuration Changes

| Config | Current Value | New Value | Impact |
|--------|---------------|-----------|--------|
| <!-- --> | <!-- --> | <!-- --> | <!-- --> |

---

## 3. CI/CD Considerations

### 3.1 Pipeline Impact

**Affected workflows:**
| Workflow | File | Impact |
|----------|------|--------|
| <!-- e.g., Deploy Staging --> | `.github/workflows/deploy-staging.yml` | <!-- --> |

**New workflow steps:**
| Step | Runner | Dependencies | Timeout |
|------|--------|--------------|---------|
| <!-- --> | <!-- ubuntu-latest --> | <!-- --> | <!-- --> |

### 3.2 Environment Variables

| Variable | Where Set | Purpose | Sensitive? |
|----------|-----------|---------|------------|
| <!-- --> | <!-- GitHub Secrets / .env --> | <!-- --> | Yes/No |

### 3.3 Secrets Management

| Secret | Environment | How to Rotate | Last Rotated |
|--------|-------------|---------------|--------------|
| <!-- --> | <!-- staging/prod --> | <!-- --> | <!-- --> |

---

## 4. Database Migration

### 4.1 Migration Details

**Migration needed?** Yes / No

**Migration file:** `apps/web/migrations/XXXX_{{migration_name}}.sql`

**Type:** <!-- Additive (safe) | Destructive (risky) | Data migration -->

```sql
-- UP migration
-- Agent: Fill with actual DDL

-- DOWN migration (if applicable)
```

### 4.2 Rollback Plan

**Rollback approach:**
<!-- How to undo if something goes wrong -->

**Data preservation:**
<!-- What data needs to be backed up first? -->

### 4.3 Migration Execution

**Execution order:**
1. <!-- Step 1 -->
2. <!-- Step 2 -->

**Downtime required?** Yes / No
**Estimated duration:** <!-- -->

---

## 5. Security Considerations

### 5.1 Access Control

| Resource | Who Can Access | How Controlled |
|----------|----------------|----------------|
| <!-- --> | <!-- --> | <!-- --> |

### 5.2 Secrets Exposure Risk

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| <!-- Secrets in logs --> | <!-- --> | <!-- --> |
| <!-- Secrets in error messages --> | <!-- --> | <!-- --> |

### 5.3 Audit Trail

| Action | Logged? | Log Location |
|--------|---------|--------------|
| <!-- --> | Yes/No | <!-- --> |

---

## 6. Testing

### 6.1 Local Testing

**How to test locally:**
```bash
# Agent: Provide actual commands
```

**Test scenarios:**
| Scenario | Expected Result | How to Verify |
|----------|-----------------|---------------|
| <!-- --> | <!-- --> | <!-- --> |

### 6.2 Staging Testing

**Deploy to staging first?** Yes (required for infrastructure changes)

**Staging verification:**
- [ ] <!-- Specific check -->
- [ ] <!-- -->

### 6.3 Rollback Testing

**Rollback tested?** Yes / No
**Rollback procedure:**
```bash
# Agent: Provide rollback commands
```

---

## 7. Documentation Updates

### 7.1 Files to Update

| File | Section | Change |
|------|---------|--------|
| `CLAUDE.md` | <!-- --> | <!-- --> |
| `.claude/rules/*.md` | <!-- --> | <!-- --> |
| `apps/web/README.md` | <!-- --> | <!-- --> |

### 7.2 Runbook Updates

**New runbook needed?** Yes / No
**Runbook location:** <!-- e.g., docs/runbooks/xxx.md -->

---

## 8. Task Breakdown

### Tasks Epic

```bash
pnpm wm tasks create --title="GH#{{ISSUE}}: {{FEATURE_TITLE}}" --type=epic --issue={{ISSUE}}
```

### Tasks (with dependencies)

```bash
# Phase 1: Preparation
pnpm wm tasks create --title="GH#{{ISSUE}}: Analyze current infrastructure" --type=impl --issue={{ISSUE}}
pnpm wm tasks create --title="GH#{{ISSUE}}: Create backups/snapshots" --type=impl --issue={{ISSUE}}
# Dependencies managed via tasks.yaml structure

# Phase 2: Implementation
pnpm wm tasks create --title="GH#{{ISSUE}}: Implement infrastructure changes" --type=impl --issue={{ISSUE}}
pnpm wm tasks create --title="GH#{{ISSUE}}: Update configuration" --type=impl --issue={{ISSUE}}
# Dependencies managed via tasks.yaml structure

# Phase 3: Verification
pnpm wm tasks create --title="GH#{{ISSUE}}: Deploy and verify on staging" --type=verify --issue={{ISSUE}}
pnpm wm tasks create --title="GH#{{ISSUE}}: Test rollback procedure" --type=verify --issue={{ISSUE}}
# Dependencies managed via tasks.yaml structure

# Phase 4: Documentation
pnpm wm tasks create --title="GH#{{ISSUE}}: Update documentation" --type=impl --issue={{ISSUE}}

# View tasks
pnpm wm tasks list --issue={{ISSUE}}
```

### Dependency Graph (Expected)

```
    +-----------+
    | Analysis  |
    +-----+-----+
          |
          v
    +-----------+
    |  Backup   |
    +-----+-----+
          |
          v
    +-----------+
    |   Impl    |
    +-----+-----+
          |
          v
    +-----------+
    |  Config   |
    +-----+-----+
          |
          v
    +-----------+
    |  Staging  |
    +-----+-----+
          |
    +-----+-----+
    v           v
+--------+  +--------+
|Rollback|  |  Docs  |
+--------+  +--------+
```

---

## 9. Risk Assessment

### 9.1 Operational Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| <!-- Service disruption --> | <!-- --> | <!-- --> | <!-- --> |
| <!-- Data loss --> | <!-- --> | <!-- --> | <!-- --> |
| <!-- Config drift --> | <!-- --> | <!-- --> | <!-- --> |

### 9.2 Rollback Triggers

**Rollback if:**
- [ ] <!-- Specific condition -->
- [ ] <!-- -->

---

## 10. Notes

_Agent fills this during planning:_

- Discovered complexity: <!-- e.g., "Needs coordination with external service" -->
- Open questions: <!-- e.g., "Downtime window approval needed?" -->
- Risks: <!-- e.g., "Production data migration - needs careful planning" -->
