# Epic Planning: {{EPIC_TITLE}}

> **Instructions for Agent:**
> Fill this template during PLANNING session with `--epic` flag.
> Epics are large initiatives broken into 3-8 Features.
> Focus on scope definition and feature breakdown.

---

## 0. Epic Context

**GitHub Issue:** #{{ISSUE_NUMBER}}
**Parent Milestone:** <!-- GitHub Milestone if applicable -->

---

## 1. Research Context

### 1.1 Research Sources

| Research Issue | Title | Key Findings |
|----------------|-------|--------------|
| #<!-- --> | <!-- --> | <!-- 2-3 key points --> |

### 1.2 Open Questions from Research

| Question | Status | Resolution |
|----------|--------|------------|
| <!-- --> | Open/Resolved | <!-- --> |

---

## 2. Overview

**Vision:** <!-- One sentence describing the goal -->

**Problem Statement:**
<!-- What problem does this epic solve? -->

**Success Metrics:**
<!-- How will we know this succeeded? -->

---

## 3. Scope

### 3.1 In Scope

- <!-- Capability 1 -->
- <!-- Capability 2 -->

### 3.2 Out of Scope

- <!-- Explicitly excluded 1 -->
- <!-- Explicitly excluded 2 -->

### 3.3 Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| <!-- Other epic/feature --> | Blocks/Blocked by | <!-- --> |

---

## 4. Feature Breakdown

### 4.1 Features List

| # | Feature Title | Priority | Complexity | Notes |
|---|---------------|----------|------------|-------|
| 1 | <!-- --> | P1/P2/P3 | S/M/L | <!-- --> |
| 2 | <!-- --> | <!-- --> | <!-- --> | <!-- --> |

### 4.2 Feature Dependencies

```
Feature 1
    └── Feature 2 (depends on 1)
        └── Feature 3 (depends on 2)
Feature 4 (independent)
```

---

## 5. Success Criteria

### 5.1 Acceptance Criteria

- [ ] <!-- Measurable criterion 1 -->
- [ ] <!-- Measurable criterion 2 -->

### 5.2 Definition of Done

- [ ] All features completed and merged
- [ ] Documentation updated
- [ ] No critical bugs

---

## 6. Task Breakdown

### Tasks for Epic

```bash
pnpm wm tasks create --title="GH#{{ISSUE}}: {{EPIC_TITLE}}" --type=epic --issue={{ISSUE}}
```

### Feature Issues

```bash
# Create GitHub Feature issues (use create-issue.sh)
.claude/skills/github-planning/scripts/create-issue.sh --type=feature --title="Feature 1" --epic={{ISSUE}}
.claude/skills/github-planning/scripts/create-issue.sh --type=feature --title="Feature 2" --epic={{ISSUE}}
```

---

## 7. Notes

- Risks: <!-- -->
- Open questions: <!-- -->
