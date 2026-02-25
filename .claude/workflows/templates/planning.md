---
id: planning
name: "Planning Mode"
description: "Feature planning with research, interviews, spec writing, and review"
mode: planning
phases:
  - id: p0
    name: Research
    task_config:
      title: "P0: Research - understand problem space, find similar patterns"
      labels: [phase, phase-0, research]
    steps:
      - id: clarify-scope
        title: "Clarify scope and context"
        instruction: |
          Use AskUserQuestion to clarify what we're planning:

          AskUserQuestion(questions=[
            {
              question: "What are you planning?",
              header: "Feature",
              options: [
                {label: "New feature", description: "Something that doesn't exist yet"},
                {label: "Enhancement", description: "Expanding existing functionality"},
                {label: "Refactor", description: "Code structure change, no behavior change"},
                {label: "Epic", description: "Large initiative spanning multiple features"}
              ],
              multiSelect: false
            },
            {
              question: "Do you have a GitHub issue for this?",
              header: "Issue",
              options: [
                {label: "Yes — link it", description: "I'll provide the issue number"},
                {label: "No — create one", description: "Create a new issue after spec is ready"},
                {label: "No — skip GitHub", description: "Skip GitHub tracking for now"}
              ],
              multiSelect: false
            }
          ])

          Document: type, scope, GitHub issue # if known.
          Then: Mark this task completed via TaskUpdate

      - id: codebase-research
        title: "Research existing patterns"
        instruction: |
          Search the codebase for relevant context:

          Task(subagent_type="Explore", prompt="
            Find code patterns related to {feature_topic}.
            Search: Glob, Grep, Read relevant files.
            Document: file paths, function names, patterns to follow.
            Be thorough — read files IN FULL, not just search results.
          ", run_in_background=true)

          Also read any related spec files:
          ```bash
          ls planning/specs/ | grep -i "{keyword}"
          ```

          Wait for agent: TaskOutput(task_id=..., block=true)
          Compile findings into 3-5 bullet points.
          Then: Mark this task completed via TaskUpdate

  - id: p1
    name: Interview
    task_config:
      title: "P1: Interview - gather requirements, architecture, testing, and design from user"
      labels: [phase, phase-1, interview]
      depends_on: [p0]
    steps:
      - id: requirements
        title: "Interview: Requirements"
        instruction: |
          Gather requirements from the user. Run two AskUserQuestion rounds:

          **Round 1: Problem, happy path, scope**

          AskUserQuestion(questions=[
            {
              question: "What user problem does this solve?",
              header: "Problem",
              options: [
                {label: "User workflow gap", description: "Missing capability in existing flow"},
                {label: "Performance issue", description: "Current approach too slow/unreliable"},
                {label: "New capability", description: "Something users can't do at all today"}
              ],
              multiSelect: false
            },
            {
              question: "What does the ideal success flow look like?",
              header: "Happy Path",
              options: [
                {label: "I'll describe it", description: "Free-form description"}
              ],
              multiSelect: false
            },
            {
              question: "What are you explicitly NOT building?",
              header: "Scope OUT",
              options: [
                {label: "I'll list exclusions", description: "Free-form list"}
              ],
              multiSelect: false
            }
          ])

          **Round 2: Edge cases — empty state, scale, concurrency**

          AskUserQuestion(questions=[
            {
              question: "What happens with zero results or first-time use?",
              header: "Empty State",
              options: [
                {label: "Show placeholder", description: "Empty state with guidance"},
                {label: "Hide section", description: "Don't show until data exists"},
                {label: "N/A", description: "Not applicable to this feature"}
              ],
              multiSelect: false
            },
            {
              question: "Expected data volume? (affects pagination, caching, indexing)",
              header: "Scale",
              options: [
                {label: "Small (<100)", description: "No pagination needed"},
                {label: "Medium (100-10K)", description: "Basic pagination"},
                {label: "Large (10K+)", description: "Virtual scroll, server-side pagination, indexing"}
              ],
              multiSelect: false
            },
            {
              question: "What if multiple users edit simultaneously?",
              header: "Concurrency",
              options: [
                {label: "Last write wins", description: "Simple, no conflict detection"},
                {label: "Optimistic locking", description: "Detect conflicts, prompt user"},
                {label: "N/A", description: "Single-user or read-only feature"}
              ],
              multiSelect: false
            }
          ])

          Document all answers with rationale.
          Then: Mark this task completed via TaskUpdate

      - id: architecture
        title: "Interview: Architecture"
        instruction: |
          Gather architecture decisions from the user:

          AskUserQuestion(questions=[
            {
              question: "What existing systems or APIs does this touch?",
              header: "Integration",
              options: [
                {label: "I'll list them", description: "Free-form list of integration points"}
              ],
              multiSelect: false
            },
            {
              question: "How should errors surface to users?",
              header: "Errors",
              options: [
                {label: "Inline messages", description: "Error text near the action that failed"},
                {label: "Toast/notification", description: "Temporary popup notification"},
                {label: "Error page", description: "Full error state with recovery action"},
                {label: "Silent retry", description: "Auto-retry with fallback"}
              ],
              multiSelect: false
            },
            {
              question: "Any latency or throughput requirements?",
              header: "Performance",
              options: [
                {label: "Standard", description: "No special requirements (<2s page loads)"},
                {label: "Fast", description: "Sub-second response required (autocomplete, search)"},
                {label: "Background OK", description: "Can process async (jobs, queues)"}
              ],
              multiSelect: false
            }
          ])

          Document all answers with rationale.
          Then: Mark this task completed via TaskUpdate

      - id: testing
        title: "Interview: Testing Strategy"
        instruction: |
          Gather testing strategy from the user:

          AskUserQuestion(questions=[
            {
              question: "What scenarios verify the feature works correctly?",
              header: "Happy Path",
              options: [
                {label: "CRUD operations", description: "Create, read, update, delete flows"},
                {label: "User journey", description: "End-to-end workflow completion"},
                {label: "API responses", description: "Correct data returned for valid inputs"}
              ],
              multiSelect: false
            },
            {
              question: "What should fail gracefully?",
              header: "Error Paths",
              options: [
                {label: "Validation errors", description: "Invalid input handling"},
                {label: "Permission denied", description: "Unauthorized access attempts"},
                {label: "Network failures", description: "Timeout and retry behavior"}
              ],
              multiSelect: false
            },
            {
              question: "What kinds of tests should we write?",
              header: "Test Types",
              options: [
                {label: "Unit tests", description: "Isolated function/component tests"},
                {label: "Integration tests", description: "Cross-module or API tests"},
                {label: "E2E tests", description: "Full user flow tests"}
              ],
              multiSelect: false
            }
          ])

          Document all answers — these become the Test Plan section in the spec.
          Then: Mark this task completed via TaskUpdate

      - id: design
        title: "Interview: UI Design (skip if backend-only)"
        instruction: |
          **Skip this step entirely if the feature is backend-only (no UI changes).**
          Mark completed and move on.

          For features with UI, gather design decisions:

          AskUserQuestion(questions=[
            {
              question: "Which existing page or screen is most similar to what you're building?",
              header: "Reference",
              options: [
                {label: "I'll name it", description: "Reference an existing page/screen"},
                {label: "Nothing similar", description: "This is a new pattern"}
              ],
              multiSelect: false
            },
            {
              question: "What layout pattern fits this feature?",
              header: "Layout",
              options: [
                {label: "List/table", description: "Data listing with sorting/filtering"},
                {label: "Detail view", description: "Single-item view with sections"},
                {label: "Form", description: "Input form with validation"},
                {label: "Dashboard", description: "Multiple cards/panels overview"}
              ],
              multiSelect: false
            },
            {
              question: "Which existing components can you reuse?",
              header: "Components",
              options: [
                {label: "I'll list them", description: "Free-form list of reusable components"},
                {label: "All new", description: "No existing components apply"}
              ],
              multiSelect: false
            }
          ])

          Document all answers.
          Then: Mark this task completed via TaskUpdate

      - id: requirements-approval
        title: "Requirements approval"
        instruction: |
          Compile all interview answers into a structured requirements summary:

          ## Requirements Summary
          **Problem:** [from requirements interview]
          **Happy Path:** [from requirements interview]
          **Scope OUT:** [exclusions]
          **Edge Cases:** [empty state, scale, concurrency decisions]
          **Architecture:** [integration points, error handling, performance]
          **Testing Strategy:** [happy path, error paths, test types]
          **UI Design:** [reference page, layout, components] or "Backend-only"

          Present this summary to the user:

          AskUserQuestion(questions=[{
            question: "Do these requirements look correct? Review the summary above.",
            header: "Approve",
            options: [
              {label: "Approved", description: "Requirements are correct, proceed to spec writing"},
              {label: "Revise", description: "I need to change something — tell me what"}
            ],
            multiSelect: false
          }])

          If "Revise": ask what to change, update the summary, re-present.
          If "Approved": proceed to spec writing.
          Then: Mark this task completed via TaskUpdate

  - id: p2
    name: Spec Writing
    task_config:
      title: "P2: Spec - spawn agent to write feature specification"
      labels: [phase, phase-2, spec]
      depends_on: [p1]
    steps:
      - id: create-spec-file
        title: "Create spec file from template"
        instruction: |
          Create a new spec file. Copy from the feature spec template:
          ```bash
          # Check if template exists
          ls planning/specs/_templates/ 2>/dev/null || ls .claude/workflows/spec-templates/ 2>/dev/null
          ```

          Create spec at: `planning/specs/{issue-number}-{slug}.md`

          Use this frontmatter:
          ```yaml
          ---
          initiative: {slug}
          type: project
          issue_type: feature
          status: draft
          priority: medium
          github_issue: {number or null}
          created: {YYYY-MM-DD}
          updated: {YYYY-MM-DD}
          phases: []
          ---
          ```

          Then: Mark this task completed via TaskUpdate

      - id: spawn-spec-writer
        title: "Spawn spec writer agent"
        instruction: |
          **Do NOT write the spec yourself.** Spawn an agent to preserve context.

          Compile ALL context the agent needs into the prompt:
          - Research findings from P0 (bullet points)
          - All interview answers from P1 (requirements, architecture, testing, design)
          - The approved requirements summary

          Task(subagent_type="general-purpose", prompt="
            ROLE: Spec Writer
            SPEC FILE: planning/specs/{spec-file}.md

            RESEARCH FINDINGS:
            [paste P0 research bullet points]

            APPROVED REQUIREMENTS:
            [paste the full requirements summary from P1 approval gate]

            Write the spec body following this structure:

            ## Overview
            1-3 sentences: what problem this solves, for whom, and why now.

            ## Feature Behaviors
            For each behavior:
              ### B{N}: {Behavior Name}
              **Core:**
              - **ID:** {kebab-case-id}
              - **Trigger:** {what causes this}
              - **Expected:** {what should happen}
              - **Verify:** {how to confirm it works}
              **UI Layer:** {what the user sees}
              **API Layer:** {endpoint, input, output}
              **Data Layer:** {schema changes, if any}

            ## Non-Goals
            Explicit list from Scope OUT answers.

            ## Test Plan
            Based on testing interview answers. For each test:
            - Scenario description
            - Type: unit / integration / e2e
            - What it verifies

            ## Implementation Phases
            Break into 2-5 phases with concrete tasks per phase.
            Phases go in YAML frontmatter phases: array.
            Each phase gets test_cases: with 1-3 entries.

            ## Implementation Hints
            1. Key Imports table — exact package subpath exports and named imports
            2. Code Patterns — 2-5 copy-pasteable snippets (init, wiring, key API usage)
            3. Gotchas — subpath export quirks, peer deps, TS config, code generation
            4. Verification Strategy — test infra, build/check command for this project
            5. Reference Doc URLs with descriptions

            To fill Implementation Hints: re-read P0 research, web-search for
            integration guides if external libraries are involved, find canonical
            patterns in the project's existing code.

            REQUIREMENTS:
            - No TBD/TODO/placeholder text
            - File paths must reference real files (verify with Glob/Grep)
            - Every behavior must have all Core fields filled
            - Return when spec is complete
          ", run_in_background=false)

          Read the spec file to verify completeness:
          - No placeholder text remaining
          - All sections have content
          - Behaviors have all required fields

          Then: Mark this task completed via TaskUpdate

      - id: link-github-issue
        title: "Create or link GitHub issue"
        instruction: |
          **If issue exists:** Update the `github_issue:` frontmatter field.
          Mark it as spec-in-progress:
          ```bash
          gh issue edit {N} --remove-label "status:todo" --add-label "status:in-progress" --add-label "needs-spec"
          ```

          **If creating new issue:**
          ```bash
          gh issue create \
            --title "{feature title}" \
            --body "$(cat planning/specs/{spec-file}.md | head -50)" \
            --label "feature" \
            --label "status:in-progress" \
            --label "needs-spec"
          ```
          Note the issue number. Update spec frontmatter `github_issue:` field.
          Update spec filename to include issue number: `{N}-{slug}.md`

          **If skipping:** Leave `github_issue: null`

          Then: Mark this task completed via TaskUpdate

  - id: p3
    name: Review
    task_config:
      title: "P3: Review - check completeness and correctness"
      labels: [phase, phase-3, review]
      depends_on: [p2]
    steps:
      - id: completeness-check
        title: "Check spec completeness"
        instruction: |
          Review spec against this checklist:
          - [ ] All behaviors have ID, Trigger, Expected, Verify
          - [ ] No placeholder text (TODO, TBD, {variable} left unfilled)
          - [ ] File paths in spec actually exist (or will be created)
          - [ ] Implementation phases cover all behaviors
          - [ ] Each phase has at least 1 test_case with type
          - [ ] Non-goals section present
          - [ ] Implementation Hints has: dependencies, key imports, 1+ code pattern
          - [ ] Reference doc URLs present (not just library names)
          - [ ] Verification Strategy specifies build command and test infra
          - [ ] GitHub issue linked (or explicitly skipped)

          Fix any gaps found.
          Then: Mark this task completed via TaskUpdate

      - id: spawn-review-agent
        title: "Spawn spec review agent and fix loop"
        instruction: |
          Mark issue as needing review:
          ```bash
          gh issue edit {N} --remove-label "needs-spec" --add-label "needs-review"
          ```

          Spawn a review agent to give a second opinion:

          Task(subagent_type="general-purpose", prompt="
            Review this spec for completeness and correctness:
            Read: planning/specs/{spec-file}.md

            Check:
            1. Are behaviors clear and testable?
            2. Are phases realistic (not too large or small)?
            3. Missing edge cases?
            4. Ambiguous requirements?
            5. Implementation Hints has: dependencies, key imports, 1+ code pattern?
            6. Reference doc URLs present (not just library names)?
            7. Test Plan covers happy path AND error paths?

            Output: numbered list of issues (or 'LGTM' if clean).
            Classify each issue as BLOCKING (must fix) or SUGGESTION (nice to have).
          ", run_in_background=false)

          **Fix loop:**

          If review found BLOCKING issues:
          1. Spawn a fixer agent with the specific issues to address:

             Task(subagent_type="general-purpose", prompt="
               Fix the following issues in planning/specs/{spec-file}.md:
               [paste BLOCKING issues from review]
               Read the spec, fix each issue, verify no placeholder text remains.
             ", run_in_background=false)

          2. Re-run the completeness checklist (previous step) against the fixed spec.

          3. If issues persist after 2 fix iterations, present remaining issues
             to the user and ask whether to accept as-is or continue fixing.

          For SUGGESTION items: apply judgment — fix easy ones, skip subjective ones.

          Then: Mark this task completed via TaskUpdate

  - id: p4
    name: Finalize
    task_config:
      title: "P4: Finalize - approve spec, commit, push"
      labels: [phase, phase-4, finalize]
      depends_on: [p3]
    steps:
      - id: approve-spec
        title: "Mark spec approved and commit"
        instruction: |
          Update spec frontmatter: `status: approved`
          Update `updated:` field to today's date.

          Commit:
          ```bash
          git add planning/specs/{spec-file}.md
          git commit -m "docs(spec): {feature title} — spec approved"
          git push
          ```

          Mark issue as approved and ready for implementation:
          ```bash
          gh issue edit {N} --remove-label "needs-review" --remove-label "status:in-progress" --add-label "approved" --add-label "status:todo"
          ```

      - id: update-issue
        title: "Update GitHub issue with spec link"
        instruction: |
          If GitHub issue exists:
          ```bash
          gh issue comment {N} --body "Spec approved: planning/specs/{spec-file}.md

          Ready for implementation: \`kata enter implementation\`"
          ```

          Then: Mark this task completed via TaskUpdate

global_conditions:
  - changes_committed
  - changes_pushed
---

# Planning Mode

You are in **planning** mode. Create a feature spec through research, interviews, writing, and review.

## Orchestrator Role

**You coordinate work. You do not do deep work inline.**

Spawn agents for research, spec writing, and review. This preserves your context
window for orchestration — tracking progress, asking the user questions, and
verifying agent outputs.

| Action | Do this | Not this |
|--------|---------|----------|
| Understand codebase | `Task(subagent_type="Explore", ...)` | Read 20 files inline |
| Write spec content | `Task(subagent_type="general-purpose", ...)` | Write 200 lines of spec yourself |
| Review spec | `Task(subagent_type="general-purpose", ...)` | Re-read entire spec to check quality |

**What you DO inline:**
- Ask the user questions (AskUserQuestion)
- Run CLI commands (gh, kata, git)
- Quick verification reads (confirm agent output, check for placeholders)
- Compile context for agent prompts

**Self-check before each action:**
> "Am I about to read source files to understand code?" → Spawn Explore agent instead.
> "Am I about to write spec content?" → Spawn a writer agent instead.

## Phase Flow

```
P0: Research
    ├── Clarify scope + GitHub issue
    └── Codebase research (Explore agent)

P1: Interview
    ├── Requirements (problem, happy path, scope, edge cases)
    ├── Architecture (integration, errors, performance)
    ├── Testing Strategy (happy path, error paths, test types)
    ├── UI Design (skip if backend-only)
    └── Requirements Approval (compile summary, user sign-off)

P2: Spec Writing
    ├── Create spec file from template
    ├── Spawn spec writer agent (with all P0+P1 context)
    ├── Verify spec completeness
    └── Link GitHub issue

P3: Review
    ├── Completeness checklist
    └── Spec review agent + fix loop

P4: Finalize
    ├── Mark approved
    ├── Commit + push
    └── Comment on GitHub issue
```

## Interview Categories

The interview phase uses categories from `batteries/interviews.yaml`.
Projects can customize questions by editing `.kata/interviews.yaml`.

| Category | What it covers |
|----------|---------------|
| Requirements | Problem statement, happy path, scope boundaries, edge cases (empty state, scale, concurrency) |
| Architecture | Integration points, error handling, performance requirements |
| Testing | Happy path scenarios, error paths, test types |
| Design | Reference pages, layout patterns, reusable components (skipped for backend-only) |

## Anti-Patterns

### Inline research (wastes context)
```
# BAD — 10,000 tokens of source code polluting your context
Read(file1.ts)    → 500 tokens
Read(file2.ts)    → 500 tokens
...20 files       → 10,000 tokens

# GOOD — 250 tokens, agent reads 20 files internally
Task(subagent_type="Explore", prompt="Find patterns related to X")
TaskOutput(task_id=..., block=true)  → 200 token summary
```

### Writing spec content yourself
```
# BAD — you're writing 200 lines of spec content
Edit(file="planning/specs/123-feature.md", ...)

# GOOD — agent writes, you verify
Task(subagent_type="general-purpose", prompt="
  SPEC FILE: planning/specs/123-feature.md
  RESEARCH: [findings from P0]
  REQUIREMENTS: [approved answers from P1]
  Fill all sections. No TBD placeholders.
")
```

### One-shot review (no fix loop)
```
# BAD — review finds issues, you just "address" them vaguely
Task(prompt="Review spec") → "5 issues found"
# ... move on

# GOOD — review, fix, re-verify
Task(prompt="Review spec") → "3 BLOCKING, 2 SUGGESTION"
Task(prompt="Fix these 3 blocking issues in spec") → fixed
Re-run completeness checklist → all clear
```

## Stop Conditions

- Spec file exists with `status: approved`
- Changes committed and pushed
- GitHub issue linked or explicitly skipped
