# Research: {{RESEARCH_TITLE}}

> **Instructions for Agent:**
> Fill this template during RESEARCH session (claude-research.sh).
> Document findings as you explore - this is a living document.
> Goal: Understand the problem space before planning implementation.
> Output: Enough context to write a proper implementation spec.

---

## 0. Research Context

**GitHub Issue:** #{{ISSUE_NUMBER}} (if applicable)
**Research Question:**
<!-- What are we trying to learn? Be specific. -->

**Why This Research?**
<!-- What decision does this inform? What implementation is blocked? -->

**Time Box:** <!-- e.g., "2 hours max" -->

---

## 1. Background

### 1.1 Current State

**What exists today:**
<!-- Document the current system/approach -->

**Pain points:**
<!-- What's not working? What's the motivation for change? -->

### 1.2 Prior Art

**Previous attempts:**
<!-- Has this been tried before? What happened? -->

**Related work:**
<!-- Similar solutions in codebase or external references -->

---

## 2. Research Questions

### Primary Questions

| # | Question | Status | Answer |
|---|----------|--------|--------|
| 1 | <!-- --> | Open/Answered | <!-- --> |
| 2 | <!-- --> | Open/Answered | <!-- --> |
| 3 | <!-- --> | Open/Answered | <!-- --> |

### Secondary Questions

| # | Question | Status | Answer |
|---|----------|--------|--------|
| 1 | <!-- --> | Open/Answered | <!-- --> |

---

## 3. Exploration Log

### 3.1 Codebase Exploration

_Agent fills this as they search:_

**Search 1:**
```bash
# Command used
grep -r "pattern" path/
```
**Findings:**
<!-- What did we learn? -->

**Search 2:**
```bash
# Command used
```
**Findings:**
<!-- -->

### 3.2 Files Examined

| File | Relevant Lines | What We Learned |
|------|----------------|-----------------|
| <!-- --> | <!-- --> | <!-- --> |

### 3.3 External Research

| Source | URL | Key Takeaways |
|--------|-----|---------------|
| <!-- Docs, articles, etc --> | <!-- --> | <!-- --> |

---

## 4. Observations

### 4.1 Patterns Noticed

| Pattern | Where Observed | Significance |
|---------|----------------|--------------|
| <!-- --> | <!-- --> | <!-- --> |

### 4.2 Trade-offs Identified

| Approach | Pros | Cons |
|----------|------|------|
| <!-- --> | <!-- --> | <!-- --> |

### 4.3 Constraints Discovered

- <!-- Hard constraint 1 -->
- <!-- Hard constraint 2 -->

---

## 5. Summary

### 5.1 Key Findings

1. <!-- Most important finding -->
2. <!-- Second most important -->
3. <!-- Third most important -->

### 5.2 Open Questions

| Question | Why It Matters | Suggested Next Step |
|----------|----------------|---------------------|
| <!-- --> | <!-- --> | <!-- --> |

### 5.3 Recommended Next Steps

<!-- What should happen after this research? -->
<!-- e.g., "Create Epic for X", "More research on Y", "Ready for implementation" -->

---

## 6. Next Steps

### If Proceeding to Implementation

**Template to use:** <!-- full-stack.md / backend-only.md / frontend-only.md / infrastructure.md -->

**Key decisions made:**
| Decision | Choice | Rationale |
|----------|--------|-----------|
| <!-- --> | <!-- --> | <!-- --> |

**Open questions for implementation:**
- [ ] <!-- Questions that can be answered during implementation -->

### If More Research Needed

**Additional research tasks:**
| Task | Time Box | Blocking |
|------|----------|----------|
| <!-- --> | <!-- --> | Yes/No |

---

## 7. Artifacts

### 7.1 Useful Code Snippets

```typescript
// Relevant code found during research
```

### 7.2 Diagrams

```
ASCII diagram or mermaid syntax for architecture
```

### 7.3 References

**Internal:**
- `.claude/rules/relevant-rule.md` - <!-- why relevant -->
- `apps/web/src/path/to/file.ts` - <!-- why relevant -->

**External:**
- [Title](URL) - <!-- why relevant -->

---

## 8. Session Notes

_Chronological notes as research progresses:_

**{{TIMESTAMP}}:**
<!-- What was explored, what was learned -->

**{{TIMESTAMP}}:**
<!-- -->
