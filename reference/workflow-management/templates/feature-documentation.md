---
id: feature-documentation
name: Feature Documentation Mode
description: Create or refine feature documentation with deep UI and behavior interviews
mode: feature-documentation

entry:
  # Optional: --doc=path/to/feature.md (existing doc to clarify)
  # If not provided, creates new feature doc
  optional:
    - existing_feature_doc

phases:
  # Phase 0: Baseline Research (Parallel Agents)
  - id: p0
    name: Baseline Research
    task_config:
      title: "P0: Baseline - SPAWN 4 parallel agents (doc, code, patterns, domain)"
      labels: [phase, phase-0, research]
    todoActiveForm: "SPAWNING baseline research agents"
    steps:
      - id: spawn-doc-agent
        title: "Step 1: SPAWN Doc State agent"
        instruction: |
          ```
          Task(subagent_type="Explore", prompt="
          ANALYZE FEATURE DOC STATE

          Read this feature doc completely: {feature_doc_path}
          (If new feature, return 'New feature - no existing doc')

          RETURN:
          1. All behaviors listed (B1, B2, B3... with full TEVS)
          2. All UI states documented (S1, S2, S3...)
          3. API endpoints referenced
          4. Data model tables
          5. Any TBD markers or gaps
          6. Status of each behavior (Planned vs Implemented)
          7. Missing Source paths

          Format as structured markdown sections.
          ", run_in_background=true)
          ```

      - id: spawn-code-agent
        title: "Step 2: SPAWN Code State agent"
        instruction: |
          ```
          Task(subagent_type="Explore", prompt="
          ANALYZE CODE IMPLEMENTATION STATE

          Feature doc: {feature_doc_path}
          (If new feature, search for related code based on feature name/domain)

          For EACH behavior with a Source path:
          1. Verify the file exists
          2. Read the referenced code
          3. Check if implementation matches documented behavior
          4. Note any discrepancies

          For behaviors marked TBD:
          1. Search for likely implementations (grep for behavior keywords)
          2. Note if code exists but isn't documented

          RETURN:
          1. Behavior implementation status table (ID | Documented | Actual | Match?)
          2. Undocumented code found
          3. Missing implementations
          4. Discrepancies between doc and code
          ", run_in_background=true)
          ```

      - id: spawn-patterns-agent
        title: "Step 3: SPAWN Patterns agent"
        instruction: |
          ```
          Task(subagent_type="Explore", prompt="
          ANALYZE RELATED PATTERNS

          Feature doc: {feature_doc_path}
          Domain: {domain}

          SEARCH FOR:
          1. .claude/rules/ files for this domain
          2. Similar features in codebase (same domain)
          3. UX conventions from existing implementations
          4. Component patterns used in similar features

          RETURN:
          1. Applicable rules (with key excerpts)
          2. Similar features found (with behavior patterns)
          3. UI/UX conventions to follow
          4. Component patterns to reuse
          ", run_in_background=true)
          ```

      - id: spawn-domain-agent
        title: "Step 4: SPAWN Domain Research agent"
        instruction: |
          ```
          Task(subagent_type="Explore", model="haiku", prompt="
          DOMAIN RESEARCH FOR {domain}

          This is a {vertical} (construction/legal/general) vertical feature.

          SEARCH FOR:
          1. Industry best practices for this feature type
          2. Regulatory/compliance requirements
          3. Accessibility requirements (WCAG)
          4. Enterprise software conventions
          5. Mobile responsiveness patterns

          RETURN:
          1. Domain-specific requirements
          2. Compliance checklist
          3. Accessibility checklist
          4. UX best practices for this feature type
          ", run_in_background=true)
          ```

      - id: wait-for-agents
        title: "Step 5: Wait for all 4 agents"
        instruction: |
          Use TaskOutput to wait for all agents to complete.
          Collect results from each.

      - id: aggregate-baseline
        title: "Step 6: Aggregate into baseline assessment"
        instruction: |
          Compile findings into structured baseline:

          ## Baseline Assessment

          ### Current Doc State
          - Behaviors documented: [count]
          - UI states documented: [count]
          - API endpoints: [count]
          - Completion status: [X% implemented]

          ### Code State Analysis
          | Behavior | Doc Status | Code Status | Match? |
          |----------|------------|-------------|--------|
          | B1: ... | Implemented | Found | ✓ |
          | B2: ... | TBD | Found | ⚠️ Undocumented |
          | B3: ... | Implemented | Not found | ✗ Missing |

          ### Gaps Identified
          1. [gap 1]
          2. [gap 2]

          ### Domain Requirements
          - [requirement 1]
          - [requirement 2]

          **SAVE findings to fd-notes.md:**
          Append baseline summary to the fd-notes.md file in your session directory.
          Include: behavior count, gap count, key findings.

          ```bash
          Mark this task completed via TodoWrite (reason: "Baseline: X behaviors, Y gaps identified")
          ```

  # Phase 1: Feature Overview (NEW - high-level clarification)
  - id: p1
    name: Feature Overview
    task_config:
      title: "P1: Overview - high-level feature clarification"
      labels: [phase, phase-1, overview]
      depends_on: [p0]
    todoActiveForm: "Clarifying feature overview"
    steps:
      - id: present-overview
        title: "Step 1: Present feature overview based on research"
        instruction: |
          **FOR EXISTING FEATURES:**
          Based on baseline research, present current state vs discovered state:

          ```markdown
          ## Feature Overview: {feature_name}

          ### Current Documentation Says:
          - Purpose: [from doc]
          - Primary use case: [from doc]
          - Target users: [from doc]

          ### Research Found:
          - Purpose: [from code/patterns]
          - Primary use case: [from code/patterns]
          - Target users: [from domain research]

          ### Potential Gaps:
          - [discrepancy 1]
          - [discrepancy 2]
          ```

          **FOR NEW FEATURES:**
          Present what research found about similar features and domain patterns.

      - id: elicit-overview-feedback
        title: "Step 2: Elicit user feedback on high-level feature definition"
        instruction: |
          **Use judgment on which questions to ask based on feature complexity.**

          ```
          AskUserQuestion(questions=[
            {question: "What is the primary purpose of this feature?",
             header: "Purpose",
             options: [
               {label: "As documented", description: "Current doc is accurate"},
               {label: "Needs refinement", description: "I'll clarify the purpose"},
               {label: "Wrong entirely", description: "Let me explain the real purpose"}
             ]},
            {question: "Who are the target users for this feature?",
             header: "Users",
             options: [
               {label: "All users", description: "Available to everyone"},
               {label: "Admin only", description: "Administrative feature"},
               {label: "Role-based", description: "Specific roles/permissions"},
               {label: "I'll specify", description: "Custom user segment"}
             ]},
            {question: "What's the success metric for this feature?",
             header: "Success",
             options: [
               {label: "Task completion", description: "User completes a workflow"},
               {label: "Time savings", description: "Faster than alternative"},
               {label: "Data quality", description: "Better/more accurate data"},
               {label: "I'll specify", description: "Custom success metric"}
             ]}
          ])
          ```

      - id: identify-core-behaviors
        title: "Step 3: Identify/confirm core behaviors"
        instruction: |
          Based on overview feedback, present core behaviors:

          **FOR EXISTING FEATURES:**
          - List documented behaviors
          - Note which need clarification
          - Note missing behaviors from research

          **FOR NEW FEATURES:**
          - Propose initial behavior list based on similar features
          - Ask user to confirm/modify

          ```
          AskUserQuestion(questions=[
            {question: "Are these the core behaviors for this feature?",
             header: "Core Behaviors",
             options: [
               {label: "Yes, proceed", description: "These cover the feature"},
               {label: "Add more", description: "Missing some behaviors"},
               {label: "Remove some", description: "Too many listed"},
               {label: "Start over", description: "Wrong approach"}
             ]}
          ])
          ```

          **SAVE to fd-notes.md:**
          Append overview clarification notes to fd-notes.md.
          Include: purpose decisions, target users, success metrics, core behaviors confirmed.

      - id: close-overview
        title: "Step 4: Close overview phase"
        instruction: |
          ```bash
          Mark this task completed via TodoWrite (reason: "Feature overview clarified: [key decisions]")
          ```

  # Phase 1.5: Behavior Interview (combined grouping + interview)
  - id: p1.5
    name: Behavior Interview
    task_config:
      title: "P1.5: Interview - deep behavior clarification (use judgment on depth)"
      labels: [phase, phase-1-5, interview]
      depends_on: [p1]
    todoActiveForm: "Interviewing behaviors (agent decides depth)"
    steps:
      - id: group-behaviors
        title: "Step 1: Group related behaviors"
        instruction: |
          Group behaviors by relatedness:

          **Grouping Criteria:**
          - Same user journey (create → view → edit → delete)
          - Same component (all toolbar behaviors together)
          - Same data entity (all behaviors touching same table)
          - Same UI state transitions

          **Example Groups:**
          - Group A: CRUD operations (B1 create, B2 read, B3 update, B4 delete)
          - Group B: List interactions (B5 sort, B6 filter, B7 search)
          - Group C: Detail view (B8 expand, B9 edit inline, B10 save)

      - id: interview-behaviors
        title: "Step 2: Interview behavior groups (use judgment on depth)"
        instruction: |
          **For EACH behavior group, interview using these categories as needed:**

          Use your judgment on which questions to ask. Not all categories apply to all behaviors.
          Drill deep on complex behaviors, keep simple behaviors brief.

          **Category A: Triggers & Success**
          - Is the trigger accurate?
          - Keyboard shortcuts needed?
          - What confirms success? (toast, inline, navigate)

          **Category B: Errors & Recovery**
          - What errors are possible?
          - Where do errors appear?
          - How does user recover?

          **Category C: Edge Cases**
          - Empty state handling?
          - Scale (1000+ items)?
          - Permission handling?

          **Category D: Loading & Accessibility**
          - Acceptable wait time?
          - Loading indicator type?
          - Screen reader announcements?

          **Category E: Domain-Specific** (if applicable)
          - Construction: Audit trail? Ball-in-court?
          - Legal: Privilege handling? Redaction?

          **Category F: Mobile/Responsive** (if applicable)
          - Different mobile behavior?
          - Touch gestures?

          **AFTER EACH GROUP, save to fd-notes.md:**
          Append all Q&A from this behavior group to fd-notes.md.
          Include: group name, round number, all questions asked and answers received.

      - id: close-behavior-interview
        title: "Step 3: Close behavior interview phase"
        instruction: |
          **Document ALL answers for reconciliation phase.**

          ```bash
          Mark this task completed via TodoWrite (reason: "Interviewed N groups, M behaviors clarified")
          ```

  # GATE: Behavior Clarification Approval
  - id: p1.6
    name: Behavior Clarification Gate
    gate: true
    task_config:
      title: "GATE: Behavior clarifications approved by user"
      labels: [phase, gate, behavior-approval]
      depends_on: [p1.5]
    todoActiveForm: "Waiting for behavior approval"
    steps:
      - id: compile-behavior-summary
        title: "Step 1: Compile behavior clarification summary"
        instruction: |
          Create summary of all behavior clarifications:

          ## Behavior Clarification Summary

          **Group A: [Name]**
          - B1: [trigger change] → [expected change]
          - B2: [new edge case added]

          **Group B: [Name]**
          - B3: [keyboard shortcut added]
          - B4: [error handling clarified]

          **Domain Requirements:**
          - [requirement 1]
          - [requirement 2]

          Present to user for approval.

      - id: get-behavior-approval
        title: "Step 2: Get user approval"
        instruction: |
          Ask: "Reply 'approve behaviors' to proceed to UI states"

          WAIT for explicit approval.
          Do NOT proceed until user says "approve".

          After approval:
          ```bash
          Mark this task completed via TodoWrite (reason: "Behavior clarifications approved")
          ```

  # Phase 2: UI States + Mockups (COMBINED)
  - id: p2
    name: UI States & Mockups
    task_config:
      title: "P2: UI States - interview states AND iterate mockups together"
      labels: [phase, phase-2, ui-states]
      depends_on: [p1.6]
    todoActiveForm: "Interviewing UI states + creating mockups"
    steps:
      - id: identify-components
        title: "Step 1: Identify all UI components"
        instruction: |
          From behaviors, identify all distinct UI components/screens:

          **Component Inventory:**
          | Component | Current States Documented | Missing States? |
          |-----------|--------------------------|-----------------|
          | MainView | S1 default, S2 loading | empty, error |
          | DetailPanel | S3 expanded | collapsed, loading |
          | FormModal | (none) | all states missing |

      - id: interview-and-mockup
        title: "Step 2: For each component - interview state, then mockup, then iterate"
        instruction: |
          **Iterate through each component. For each:**

          **A. Interview states needed:**
          ```
          AskUserQuestion(questions=[
            {question: "For [Component] - what states are needed?",
             header: "States",
             options: [
               {label: "Basic (default, loading, error)", description: "Minimum viable"},
               {label: "Interactive (+ hover, selected)", description: "Rich interactions"},
               {label: "Full (all states)", description: "Complete coverage"},
               {label: "Custom", description: "I'll specify which states"}
             ], multiSelect: false}
          ])
          ```

          **B. For each state, ask details:**
          - Default: What does user see initially?
          - Empty: Illustration + CTA? Simple message?
          - Loading: Skeleton? Spinner? Progress bar?
          - Error: Inline? Toast? Banner?
          - Hover: Highlight? Show actions?
          - Selected: Checkbox? Border? Background?

          **C. Create ASCII mockup immediately:**
          Present mockup right after state interview:
          ```
          ## [Component] - [State] Mockup

          Based on your answers:
          - [answer 1]
          - [answer 2]

          Here's the mockup:
          ```
          [ASCII art]
          ```
          ```

          **D. Iterate on mockup:**
          ```
          AskUserQuestion(questions=[
            {question: "Does this mockup match your vision?",
             header: "Mockup",
             options: [
               {label: "Looks good", description: "Move to next state"},
               {label: "Needs changes", description: "I'll describe changes"},
               {label: "Wrong approach", description: "Different direction needed"}
             ]}
          ])
          ```

          If "Needs changes" - get feedback, update mockup, re-present.
          Repeat until approved, then move to next state/component.

          **SAVE to fd-notes.md after each component:**
          Append UI component decisions to fd-notes.md.
          Include: component name, states documented, mockup iterations, final decisions.

      - id: close-ui-states
        title: "Step 3: Close UI states phase"
        instruction: |
          ```bash
          Mark this task completed via TodoWrite (reason: "N components, M states documented with mockups")
          ```

  # GATE: UI State Approval
  - id: p2.5
    name: UI State Gate
    gate: true
    task_config:
      title: "GATE: UI states and mockups approved by user"
      labels: [phase, gate, ui-state-approval]
      depends_on: [p2]
    todoActiveForm: "Waiting for UI state approval"
    steps:
      - id: compile-ui-summary
        title: "Step 1: Compile UI state summary"
        instruction: |
          Create summary of all UI state decisions:

          ## UI State Summary

          **MainView:**
          - Default: Ready with data
          - Empty: Illustration + CTA
          - Loading: Skeleton
          - Error: Banner

          **DetailPanel:**
          - Default: Collapsed
          - Expanded: Side panel
          - Loading: Spinner in panel

          Present to user for final approval.

      - id: get-ui-approval
        title: "Step 2: Get user approval"
        instruction: |
          Ask: "Reply 'approve UI' to proceed to reconciliation"

          WAIT for explicit approval.
          Do NOT proceed until user says "approve".

          After approval:
          ```bash
          Mark this task completed via TodoWrite (reason: "UI state decisions approved")
          ```

  # Phase 3: Reconciliation - SPAWN doc-updater agent
  - id: p3
    name: Reconciliation (SPAWN AGENT)
    task_config:
      title: "P3: Reconciliation - SPAWN doc-updater (DO NOT write doc yourself)"
      labels: [phase, phase-3, reconciliation]
      depends_on: [p2.5]
    todoActiveForm: "SPAWNING doc-updater agent"
    steps:
      - id: read-fc-notes
        title: "Step 1: Read fd-notes.md for complete interview context"
        instruction: |
          Read the fd-notes.md file for all interview answers:
          ```bash
          cat .claude/sessions/$(cat .claude/current-session-id)/fd-notes.md
          ```

          This contains all interview Q&A from P0 through P2.

      - id: spawn-doc-updater
        title: "Step 2: SPAWN doc-updater agent"
        instruction: |
          ⛔ DO NOT update the doc yourself. You are the orchestrator.
          ✅ SPAWN a doc-updater agent:

          ```
          Task(subagent_type="spec-writer", prompt="
          ROLE: Feature Doc Updater
          MODE: Feature Clarification - Documentation Only (NO code changes)

          FEATURE DOC: {feature_doc_path}
          (If new feature, create at: docs/features/{domain}/{feature}.md)

          ## FC Interview Notes
          [Paste contents of fd-notes.md - this has ALL interview context]

          ## Domain: {domain}
          ## Vertical: {vertical}

          ---

          YOUR TASK:

          1. **Update ALL Behaviors** with clarified TEVS:
             - Refine Trigger descriptions
             - Update Expected with success/failure paths
             - Add edge cases
             - Update Verify steps
             - Keep Source fields as-is (no code changes)
             - Add UI/API/Data references

          2. **Create/Update UI States Section** with ASCII mockups
             (Copy finalized mockups from interview)

          3. **Update API Reference** if needed

          4. **Update Data Model** if needed

          5. **Add Notes Section** (domain, a11y, mobile)

          RETURN: Path to updated feature doc file
          ")
          ```

          Wait for agent to complete with TaskOutput.

      - id: verify-doc-updated
        title: "Step 3: Verify doc was updated"
        instruction: |
          ```bash
          # Check all sections exist
          grep -E "^## (UI States|API Reference|Data Model|Behaviors)" {feature_doc_path}

          # Check for ASCII mockups
          grep -c "┌─" {feature_doc_path}

          # Check behavior count
          grep -c "^### B[0-9]" {feature_doc_path}
          ```

      - id: close-reconciliation
        title: "Step 4: Close reconciliation phase"
        instruction: |
          ```bash
          Mark this task completed via TodoWrite (reason: "Doc updated: X behaviors, Y mockups")
          ```

  # Phase 4: Commit + Gap Tracking (COMBINED)
  - id: p4
    name: Commit & Gap Tracking
    task_config:
      title: "P4: Commit - commit changes and optionally track gaps"
      labels: [phase, phase-4, commit]
      depends_on: [p3]
    todoActiveForm: "Committing changes and tracking gaps"
    steps:
      - id: ask-about-gaps
        title: "Step 1: Ask user about tracking gaps"
        instruction: |
          ```
          AskUserQuestion(questions=[
            {question: "Create tasks for implementation gaps found?",
             header: "Gap Tracking",
             options: [
               {label: "Yes, create tasks", description: "Track gaps for future implementation"},
               {label: "Skip", description: "Documentation only, no tracking"}
             ]}
          ])
          ```

      - id: create-gap-tasks
        title: "Step 2: Create tasks for each gap (if requested)"
        instruction: |
          **IF user wants tracking:**

          For each discrepancy from baseline (doc vs code mismatch):

          ```bash
          # For missing implementations
          pnpm bgh create --title="IMPL: {behavior_name} - implement per clarified doc" \
            --type=chore --labels=implementation,clarification-gap

          # For undocumented code
          pnpm bgh create --title="DOC: {behavior_name} - code exists but undocumented" \
            --type=chore --labels=documentation,clarification-gap
          ```

      - id: commit-changes
        title: "Step 3: Commit documentation changes"
        instruction: |
          ```bash
          git add {feature_doc_path}
          git commit -m "docs: clarify {feature} behaviors and UI states

          - Refined N behaviors based on interview
          - Added M ASCII mockups
          - Documented domain requirements

          Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
          ```

      - id: push-changes
        title: "Step 4: Push to remote"
        instruction: |
          ```bash
          git push
          ```

      - id: close-final
        title: "Step 5: Close final phase"
        instruction: |
          ```bash
          Mark this task completed via TodoWrite (reason: "Committed: [hash], gaps: [N created or skipped]")
          ```

global_conditions:
  - changes_committed
  - changes_pushed

workflow_id_format: "FD-{session_last_4}-{MMDD}"
---

# Feature Documentation Mode

## ⛔ ORCHESTRATOR RULES - READ THIS FIRST

**YOU ARE AN ORCHESTRATOR. YOU COORDINATE WORK. YOU DO NOT DO DEEP WORK.**

### What You DO:
- ✅ Tasks are auto-created on mode entry (check with TaskList)
- ✅ SPAWN agents via `Task(subagent_type="...", ...)`
- ✅ Wait for agents with `TaskOutput`
- ✅ Ask user questions with `AskUserQuestion`
- ✅ Run CLI commands (`pnpm wm status`, `pnpm bgh`, etc.)
- ✅ Verify agent results (brief reads to confirm)
- ✅ **Append interview notes to fd-notes.md** (persists across compaction)

### What You DO NOT:
- ⛔ Read source code files to understand codebase (spawn Explore)
- ⛔ Search codebase with Grep/Glob (spawn Explore)
- ⛔ Write feature doc content yourself (spawn spec-writer)
- ⛔ Create ASCII mockups yourself (include in doc-updater prompt)
- ⛔ Implement code changes (documentation only mode)

---

## Interview Context Persistence

**CRITICAL: Save interview notes to fd-notes.md throughout the workflow!**

This file survives context compaction and will be injected on session continuation.

**After P1 (Feature Overview):** Save purpose, target users, success metrics, core behaviors.

**After each P1.5 group:** Save all Q&A from the behavior interview group.

**After each P2 component:** Save UI states documented, mockup decisions.

The fd-notes.md file is automatically:
- Created when you enter this mode
- Copied to new session on compaction
- Injected into context on continuation

---

## Native Tasks

**Tasks are auto-created when you enter feature-documentation mode via `pnpm wm enter feature-documentation`.**

Native tasks use Claude Code's built-in task system at `~/.claude/tasks/{session-id}/`.

**Check tasks:**
```bash
# Use TaskList tool to see all tasks
# Use TaskGet to get task details
# Use TaskUpdate to mark tasks in_progress or completed
```

---

## Phase Summary

| # | Phase | Action | Tool/Agent |
|---|-------|--------|------------|
| 0 | baseline | **SPAWN** 4 parallel Explore agents | `Task(Explore)` x 4 |
| 1 | overview | High-level feature clarification | AskUserQuestion |
| 1.5 | behavior_interview | Interview (depth by judgment) | AskUserQuestion |
| | behavior_approved | **GATE** | (wait for approval) |
| 2 | ui_states_mockups | Interview states + iterate mockups | AskUserQuestion |
| | ui_approved | **GATE** | (wait for approval) |
| 3 | reconciliation | **SPAWN** doc-updater | `Task(spec-writer)` |
| 4 | commit_gaps | Commit + optional gap tracking | git + bgh commands |

---

## Creating New vs Refining Existing Features

**Existing Feature:**
```bash
pnpm wm enter feature-documentation --doc=docs/features/{domain}/{feature}.md
```
- P0 compares doc vs code
- P1 shows discrepancies, asks what works/needs improvement
- Subsequent phases refine existing behaviors

**New Feature:**
```bash
pnpm wm enter feature-documentation
# Or with domain hint:
pnpm wm enter feature-documentation --domain=vibegrid --feature=export
```
- P0 researches similar features and domain patterns
- P1 asks user to define feature from scratch
- Subsequent phases build out behaviors and UI

---

## Persona: Enterprise Software Master

When interviewing, channel the wisdom of a **senior enterprise software architect with 20+ years experience**:

**For construction domain (GC vertical):**
- Think Procore, Autodesk Construction Cloud, PlanGrid
- Consider field vs office users
- Audit trail for disputes
- Offline-first for job sites
- Ball-in-court workflows

**For legal domain:**
- Think Relativity, Everlaw, Logikcull
- Privilege protection
- Chain of custody
- Redaction workflows
- Hold notifications

**For general enterprise:**
- Think Salesforce, SAP, Workday
- Multi-tenant considerations
- Role-based access
- Bulk operations
- Export/import patterns

---

## Interview Philosophy

### Using Judgment on Depth

**Simple behaviors (1-2 questions):**
- Clear trigger, obvious outcome
- No edge cases
- Standard patterns apply

**Complex behaviors (5+ questions):**
- Multiple user paths
- Error handling critical
- Domain-specific requirements
- Accessibility concerns
- Mobile considerations

**Drill deep when:**
- User says "it depends"
- Behavior involves money/legal
- Multiple user roles interact
- Real-time/offline involved

### Drilling Deep Example

**Surface-level question:**
> "What happens when user clicks Save?"

**Enterprise-master-level drilling:**
> "When user clicks Save..."
> - What if validation fails? Inline errors or toast?
> - What if server times out? Auto-retry or manual?
> - What if another user edited meanwhile? Conflict resolution?
> - What if they're offline? Queue for sync?
> - What keyboard shortcut? Ctrl+S?
> - Screen reader announcement on success?
> - Focus after save - stay on form or go to list?

---

## ASCII Mockup Standards

### Layout Conventions

```
┌─────────────────────────────────────────────────────────────────┐
│ TOOLBAR: [+ Create] [Filter ▼] [Sort ▼]        Search: [_____] │
├─────────────────────────────────────────────────────────────────┤
│ HEADER:  [ ] │ Name        │ Status   │ Owner   │ Actions      │
├─────────────────────────────────────────────────────────────────┤
│ ROW:     [ ] │ Item One    │ [Active] │ John D. │ [Edit] [Del] │
│          [ ] │ Item Two    │ [Draft]  │ Jane S. │ [Edit] [Del] │
│          [x] │ Item Three  │ [Review] │ Bob M.  │ [Edit] [Del] │
├─────────────────────────────────────────────────────────────────┤
│ FOOTER:  Selected: 1 item                    Showing 3 of 47   │
└─────────────────────────────────────────────────────────────────┘
```

### State Variations

**Empty State:**
```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                        📋                                       │
│                  No items yet                                   │
│                                                                 │
│               [+ Create First Item]                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Loading State:**
```
┌─────────────────────────────────────────────────────────────────┐
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
└─────────────────────────────────────────────────────────────────┘
```

**Error State:**
```
┌─────────────────────────────────────────────────────────────────┐
│ ⚠️  Failed to load items                              [Retry]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                   Something went wrong.                         │
│              Please try again or contact support.               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Commands

```bash
pnpm wm status                              # Check current mode and phase
pnpm wm can-exit                            # Check stop conditions
pnpm wm status                               # Check current phase
pnpm wm can-exit                             # Check stop conditions
```
