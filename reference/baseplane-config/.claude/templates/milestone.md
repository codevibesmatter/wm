# Milestone Planning: {{MILESTONE_TITLE}}

> **Instructions for Agent:**
> Fill this template during PLANNING session with `--milestone` flag.
> Milestones group multiple Epics for a release or time period.
> Focus on theme, scope, and epic breakdown.

---

## 0. Milestone Context

**GitHub Milestone:** <!-- Link to GitHub Milestone -->
**Due Date:** <!-- Reference GitHub Milestone due date -->

---

## 1. Research Context

### 1.1 Research Sources

| Research Issue | Title | Key Findings |
|----------------|-------|--------------|
| #<!-- --> | <!-- --> | <!-- 2-3 key points --> |

### 1.2 Themes from Research

| Theme | Research Issues | Description |
|-------|-----------------|-------------|
| <!-- --> | #<!-- -->, #<!-- --> | <!-- --> |

---

## 2. Overview

**Theme/Goal:** <!-- One sentence describing the milestone's purpose -->

**Target Outcome:**
<!-- What will be true when this milestone is complete? -->

---

## 3. Scope

### 3.1 In Scope

- <!-- High-level capability 1 -->
- <!-- High-level capability 2 -->

### 3.2 Out of Scope

- <!-- Explicitly deferred to future milestone -->

---

## 4. Epics Included

| # | Epic Title | Issue | Status | Notes |
|---|------------|-------|--------|-------|
| 1 | <!-- --> | #<!-- --> | Draft/In Progress/Done | <!-- --> |
| 2 | <!-- --> | #<!-- --> | <!-- --> | <!-- --> |

### 4.1 Epic Dependencies

```
Epic 1: Foundation
    └── Epic 2: Core Features (depends on 1)
    └── Epic 3: Integrations (depends on 1)
Epic 4: Documentation (depends on 2, 3)
```

---

## 5. Success Criteria

### 5.1 Milestone Completion

- [ ] All epics completed
- [ ] Release notes written
- [ ] Stakeholders notified

### 5.2 Key Deliverables

| Deliverable | Epic | Verification |
|-------------|------|--------------|
| <!-- --> | #<!-- --> | <!-- How to verify --> |

---

## 6. Task Breakdown

### Create GitHub Milestone

```bash
gh api repos/baseplane-ai/baseplane/milestones \
  --method POST \
  -f title="{{MILESTONE_TITLE}}" \
  -f description="{{DESCRIPTION}}" \
  -f due_on="{{DUE_DATE}}T00:00:00Z"
```

### Create Epic Issues

```bash
# Create Epic issues linked to milestone
.claude/skills/github-planning/scripts/create-issue.sh --type=epic --title="Epic 1" --milestone="{{MILESTONE_TITLE}}"
.claude/skills/github-planning/scripts/create-issue.sh --type=epic --title="Epic 2" --milestone="{{MILESTONE_TITLE}}"
```

### Link Research

```bash
# Add comments linking research to epics
gh issue comment {{RESEARCH_NUM}} --body "This research informed Epic #{{EPIC_NUM}}"
gh issue comment {{EPIC_NUM}} --body "Informed by Research #{{RESEARCH_NUM}}"
```

---

## 7. Notes

- Timeline risks: <!-- -->
- Dependencies on external factors: <!-- -->
