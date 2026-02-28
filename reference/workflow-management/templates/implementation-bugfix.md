---
id: implementation-bugfix
name: Debug Mode
description: Systematic debugging with context search, hypothesis-driven investigation, then minimal fix
mode: implementation.bugfix
aliases: [debug, bugfix]

phases:
  # Phase 0: Context Search (REQUIRED FIRST)
  - id: p0
    name: Context Search
    task_config:
      title: "P0: Context Search - find past work on this issue"
      labels: [phase, phase-0, context-search]
    steps:
      - id: search-episodic-memory
        title: "Search episodic memory for past sessions"
        instruction: |
          **BEFORE ANYTHING ELSE** - search for past work on this issue.

          ```bash
          # Search for the bug/issue
          .claude/skills/episodic-memory/scripts/em.sh search "issue NNN" "bug description"

          # Search for the affected area
          .claude/skills/episodic-memory/scripts/em.sh search "feature name" "relevant keywords"

          # If you find relevant sessions, READ them:
          .claude/skills/episodic-memory/scripts/em.sh show <path-to-jsonl>
          ```

          **DO NOT skip this step.** Past sessions contain:
          - Previous attempts and what didn't work
          - User corrections and preferences
          - Root cause analysis already done
          - Pattern discoveries

          Document what you found in the issue comment.

      - id: check-linked-issues
        title: "Check linked issues and blockers"
        instruction: |
          Search for related issues:
          ```bash
          gh issue list --state all --search "keyword" --json number,title,state
          pnpm at em search "relevant topic"
          ```

          Check if this bug:
          - Was filed before and closed (regression?)
          - Has related issues (same root cause?)
          - Is blocking other work (priority bump?)

      - id: search-git-history
        title: "Search git history for relevant changes"
        instruction: |
          Find recent changes in the affected area:
          ```bash
          # Recent commits in affected files
          git log --oneline -20 -- path/to/affected/

          # When was this area last modified?
          git log --oneline --since="2 weeks ago" -- path/to/affected/

          # Who touched this recently?
          git log --format='%an: %s' -10 -- path/to/affected/
          ```

          If a recent commit introduced the bug, you've found root cause.

      - id: post-approach
        title: "Post investigation approach to GitHub"
        instruction: |
          **Post your investigation approach to GitHub issue** (required for micro-planning):

          ```bash
          .claude/workflows/scripts/post-approach-comment.sh \
            --context="Past: GH#NNN similar bug, Git: commit XYZ introduced change" \
            --approach="Investigate X component, check Y logic, likely root cause in Z" \
            --duration=5
          ```

          Or manually post to issue with:
          - Context found (past sessions, git history, related issues)
          - Initial hypothesis for root cause
          - Investigation plan

          Then: Mark this task completed via TodoWrite

  # Phase 1: Understand the System
  - id: p1
    name: Understand System
    task_config:
      title: "P1: Understand - how does this feature WORK before fixing"
      labels: [phase, phase-1, understand]
      depends_on: [p0]
    steps:
      - id: read-the-code
        title: "Read the actual code (not just grep)"
        instruction: |
          **STOP. READ THE CODE.**

          Don't grep for snippets. Read the full files:
          ```bash
          # Read the affected file(s) completely
          Read tool: /path/to/affected/file.ts

          # Trace the execution path
          # Start from entry point, follow to error location
          ```

          Understand:
          - [ ] What is this feature supposed to do?
          - [ ] What is the normal execution flow?
          - [ ] Where in that flow does the bug occur?
          - [ ] What data flows through this path?

          **ANTI-PATTERN: Grepping for error messages without reading context.**

      - id: understand-primitives
        title: "Identify which primitives/systems are involved"
        instruction: |
          Every feature uses platform primitives. Identify them:

          | Primitive | How It's Used Here |
          |-----------|-------------------|
          | DataForge | (entities, fields, schemas) |
          | Relationships | (entity connections) |
          | Access Control | (permissions) |
          | Workflows | (multi-step processes) |

          Check the rules for each involved primitive:
          ```bash
          ls .claude/rules/ | grep -i "primitive-name"
          # Read relevant rules
          ```

          **ANTI-PATTERN: Ignoring primitives and writing custom code.**

      - id: document-understanding
        title: "Document your understanding before any fix"
        instruction: |
          Write a brief explanation of how the system works:

          **How it works (normal case):**
          1. [Step 1]
          2. [Step 2]
          3. [Step 3]

          **Where it breaks:**
          - At step N, because [reason]

          **Root cause hypothesis:**
          - [Your hypothesis with evidence]

          If you can't explain how it works, you can't fix it safely.
          Then: Mark this task completed via TodoWrite

  # Phase 2: Reproduce
  - id: p2
    name: Reproduce
    task_config:
      title: "P2: Reproduce - reliable repro steps with evidence"
      labels: [phase, phase-2, reproduce]
      depends_on: [p1]
    steps:
      - id: document-repro-steps
        title: "Document exact reproduction steps"
        instruction: |
          Write steps anyone can follow:

          1. **Environment:** Browser, OS, data state, user role
          2. **Steps:** Exact sequence to trigger bug
          3. **Expected:** What should happen
          4. **Actual:** What happens instead

          gh issue comment NNN --body "## Reproduction Steps
          1. Navigate to...
          2. Click...
          3. Expected: X
          4. Actual: Y"

      - id: capture-evidence
        title: "Capture error evidence"
        instruction: |
          For staging/production bugs - check OTEL logs first:
          ```bash
          pnpm bpo logs -l error --since=1h           # Recent errors
          pnpm bpo logs -w <worker> -l error           # Specific worker errors
          pnpm bpo traces -w <worker> --since=30m      # Request traces
          ```

          For UI bugs - use chrome-devtools:
          ```bash
          cd .claude/skills/chrome-devtools/scripts
          node run.js 'goto /path | screenshot /tmp/bug.png'
          node run.js 'console'  # Capture JS errors
          ```

          For API bugs - use baseplane-data:
          ```bash
          cd .claude/skills/baseplane-data/scripts
          node run.js 'auth ceo | orpc POST /endpoint {...}'
          ```

          Save all evidence.

      - id: confirm-reproducible
        title: "Confirm bug is reproducible on demand"
        instruction: |
          Reproduce the bug 3 times to confirm it's consistent.

          If intermittent:
          - Note frequency (1 in 10? 1 in 100?)
          - Note any patterns (timing, data, sequence)

          Then: Mark this task completed via TodoWrite

  # Phase 3: Fix (Minimal, TDD Required)
  - id: p3
    name: Fix
    task_config:
      title: "P3: Fix - failing test FIRST, then minimal fix"
      labels: [phase, phase-3, fix]
      depends_on: [p2]
    steps:
      - id: check-for-primitives
        title: "Can a primitive solve this?"
        instruction: |
          **STOP before writing custom code.**

          Check if the fix should use a primitive:

          | Bug Type | Check Primitive |
          |----------|-----------------|
          | Data not saving | DataForge entity/field config |
          | Permission denied | Access Control rules |
          | Not updating live | Realtime sync/events |
          | Wrong validation | Validation pipeline |

          If a primitive config change can fix it, do that instead of code.

          **ANTI-PATTERN: Writing custom code when primitive config fixes it.**

      - id: write-failing-test
        title: "Write failing test that exposes bug"
        instruction: |
          **TDD Step 1: RED**

          Write a test that:
          - Reproduces the exact bug scenario
          - Fails with the current broken behavior
          - Will pass when bug is fixed

          ```bash
          pnpm test -- --grep "bug"
          # MUST FAIL (if it passes, test doesn't catch the bug)
          ```

      - id: apply-minimal-fix
        title: "Apply MINIMAL fix"
        instruction: |
          **TDD Step 2: GREEN**

          Rules for minimal fix:
          - [ ] Fix ONLY the root cause
          - [ ] Don't refactor adjacent code
          - [ ] Don't add unrelated features
          - [ ] Don't "improve" things while you're there

          ```bash
          pnpm test -- --grep "bug"
          # MUST PASS now
          ```

          **ANTI-PATTERN: "While I'm here, let me also..."**

      - id: verify-no-regressions
        title: "Verify no regressions"
        instruction: |
          ```bash
          pnpm typecheck    # Must pass
          pnpm test         # Must pass
          pnpm lint         # Must pass
          ```

          Fix any regressions before proceeding.
          Then: Mark this task completed via TodoWrite

  # Phase 4: Verify & Complete
  - id: p4
    name: Verify
    task_config:
      title: "P4: Verify - bug fixed, no regressions, documented"
      labels: [phase, phase-4, verify]
      depends_on: [p3]
    steps:
      - id: verify-bug-fixed
        title: "Verify original bug is fixed"
        instruction: |
          Follow the EXACT repro steps from P1.
          The bug should no longer occur.

          Capture evidence:
          - Screenshot after fix (if UI)
          - API response after fix (if API)

      - id: commit-with-context
        title: "Commit with full context"
        instruction: |
          Commit message must include:
          - What was broken
          - Why it was broken (root cause)
          - What you changed to fix it

          ```bash
          git add -A
          git commit -m "$(cat <<'EOF'
          fix: [brief description]

          Root cause: [why it was broken]
          Fix: [what you changed]
          Fixes #NNN

          🤖 Generated with [Claude Code](https://claude.com/claude-code)
          EOF
          )"
          ```

      - id: push-and-close
        title: "Push and close issue"
        instruction: |
          ```bash
          git push
          gh issue close NNN --comment "Fixed in $(git rev-parse --short HEAD)"
          ```

          Then: Mark this task completed via TodoWrite

global_conditions:
  - changes_committed
  - changes_pushed

workflow_id_format: "BF-{session_last_4}-{MMDD}"
---

# Debug Mode

Systematic debugging: **Search → Understand → Reproduce → Fix → Verify**

## Prerequisite: Micro-Planning

**Micro-planning runs automatically** before bugfix mode (5-10 min).
This posts your approach to the GitHub issue before you start fixing.

If you've already done micro-planning, or this bug came from a planned investigation,
micro-planning is skipped.

## The Core Principle

**You cannot fix what you do not understand.**

Before writing ANY code:
1. Search for past work on this issue (episodic memory, git history)
2. Understand how the system works (read code, trace execution)
3. Reproduce the bug reliably (documented steps, evidence)
4. THEN fix with minimal change

## Phase -1: Context Search (REQUIRED FIRST)

**NEVER skip this phase.**

```bash
# Search episodic memory for past sessions
.claude/skills/episodic-memory/scripts/em.sh search "issue NNN"
.claude/skills/episodic-memory/scripts/em.sh search "affected feature"

# Check git history
git log --oneline -20 -- path/to/affected/

# Check related issues
gh issue list --state all --search "keyword"
```

Past sessions contain:
- Previous attempts and what didn't work
- User corrections and preferences
- Root cause analysis already done
- Pattern discoveries

## Phase 0: Understand the System

**Read the code. All of it.**

Don't grep for error messages. Read the full execution path:
1. Entry point
2. Data flow
3. Error location
4. Exit path

Document your understanding:
- How does it work normally?
- Where does it break?
- Why does it break?

If you can't explain it, you can't safely fix it.

## Phase 1: Reproduce

Reliable reproduction before any fix:
1. Document exact steps
2. Capture evidence (screenshots, logs)
3. Confirm reproducible 3x

## Phase 2: Fix (TDD Required)

1. **Check primitives first** - Can config change fix it?
2. **Write failing test** - Proves you understand the bug
3. **Minimal fix** - Only fix root cause, nothing else
4. **Verify tests pass** - No regressions

## Phase 3: Verify

1. Follow exact repro steps - bug should be gone
2. Capture evidence of fix
3. Commit with full context
4. Push and close issue

## Anti-Patterns (BLOCKED)

| Anti-Pattern | Why It's Wrong | Correct Approach |
|--------------|---------------|------------------|
| Grep for error, edit found line | Don't understand context | Read full file, trace execution |
| Skip episodic memory search | Miss past learnings | Search first, ALWAYS |
| "Quick fix" / "workaround" | Technical debt | Fix root cause |
| "While I'm here, let me also..." | Scope creep | Separate ticket for other work |
| Custom code instead of primitive | Violates architecture | Check primitives first |
| Skip failing test | Can't prove fix works | Write test first (TDD) |

## Debugging Skills

### Staging/Production Logs & Traces (bpo)

**When the bug is on staging or production, check OTEL logs and traces FIRST:**

```bash
pnpm bpo status                            # Stack health
pnpm bpo logs -w gateway -l error          # Gateway errors
pnpm bpo logs -w web -l error --since=1h   # Web worker errors
pnpm bpo logs -q '{service_name=~".+"} |= "500"'  # All 500s
pnpm bpo traces -w gateway --since=30m     # Gateway traces
pnpm bpo traces --id <trace_id>            # Full trace detail
```

**Grafana UI:** `https://grafana.baseplane.ai` for visual exploration.

### Backend (baseplane-data)
```bash
cd .claude/skills/baseplane-data/scripts
node run.js 'auth ceo | orpc POST /endpoint {...}'
node run.js 'db SELECT * FROM table WHERE ...'
```

### Frontend (chrome-devtools)
```bash
cd .claude/skills/chrome-devtools/scripts
node run.js 'goto /path | screenshot /tmp/bug.png'
node run.js 'console'
```

## Stop Condition

Session cannot end until:
- All phase tasks (P-1 through P3) are closed
- Regression test exists for the bug
- Changes committed and pushed
- Issue closed with fix context
