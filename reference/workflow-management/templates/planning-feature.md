---
id: planning-feature
name: Planning Mode - Feature
description: Full feature planning with research, interview, spec writing, and breakdown
mode: planning

phases:
  # Phase 0: Issue Creation (conditional - only if no linked issue)
  - id: p0
    name: Issue Creation
    conditional: "not linked_issue"
    task_config:
      title: "P0: Create GitHub Issue (if not linked)"
      labels: [phase, phase-0, issue]
    todoActiveForm: "Creating GitHub issue"
    steps:
      - id: check-linked-issue
        title: "Check if session is linked to an issue"
        instruction: |
          Check session state for existing issue link:

          ```bash
          cat .claude/sessions/$(cat .claude/current-session-id)/state.json | jq '.issueNumber'
          ```

          **If issueNumber exists and is not null:** Skip this phase entirely.
          **If null or missing:** Continue to create issue.

      - id: gather-issue-details
        title: "Gather issue details from user"
        instruction: |
          AskUserQuestion(questions=[
            {question: "What type of issue is this?", header: "Type", options: [
              {label: "Feature", description: "New functionality or capability"},
              {label: "Task", description: "Implementation work, refactoring"},
              {label: "Bug", description: "Something broken that needs fixing"},
              {label: "Epic", description: "Large initiative with multiple features"}
            ], multiSelect: false},
            {question: "Brief title for this issue?", header: "Title", options: [
              {label: "I'll type it", description: "Enter a custom title"}
            ], multiSelect: false}
          ])

          Note: User will provide title via "Other" option.

      - id: create-github-issue
        title: "Create and link GitHub issue"
        instruction: |
          Create the issue using bgh CLI:

          ```bash
          pnpm bgh create --type={type} --title="{title}"
          ```

          This will output the issue number. Then enter planning mode with issue:

          ```bash
          pnpm wm enter planning --issue={issue_number}
          ```

          Verify the link:
          ```bash
          pnpm wm link --show
          ```

          Then: Mark this task completed via TodoWrite

  # Phase 1: Research - GEMINI CLI
  - id: p1
    name: Research (GEMINI CLI)
    task_config:
      title: "P1: Research - Gemini :explore (fast codebase search)"
      labels: [phase, phase-1, research]
      depends_on: [p0]
    todoActiveForm: "Running Gemini codebase research"
    steps:
      - id: run-gemini-explore
        title: "Run Gemini :explore for deep codebase search"
        instruction: |
          ✅ Run Gemini with :explore template:

          ```bash
          pnpm at gemini :explore "FEATURE_DESCRIPTION"
          ```

          Replace FEATURE_DESCRIPTION with feature name from issue.
          The CLI appends this as context to the template.

          Gemini will return structured findings:
          1. Similar Code (file:line refs)
          2. Rules/Patterns (from .claude/rules/)
          3. Episodic Memory (past sessions)
          4. Primitives Audit (DataForge, Relationships, Workflows)
          5. Gap Analysis (extend vs custom decisions)

          **Expected output:** 5 markdown sections with tables/lists.
          **Time:** ~30 seconds (vs 20-30 min with Explore agents).

          Then: Mark this task completed via TodoWrite

  # Phase 1.5: Interview - Requirements (User Journey, Scope, Edge Cases)
  - id: p1.5
    name: Interview - Requirements
    task_config:
      title: "P1.5: Interview - Requirements (user journey, scope, edge cases)"
      labels: [phase, phase-1-5, clarification]
      depends_on: [p1]
    todoActiveForm: "Interviewing user - requirements"
    instruction: |
      Cover categories A (User Journey), B (Edge Cases), F (Scope).

      **Round 1: User Journey + Scope**

      AskUserQuestion(questions=[
        {question: "What user problem does this solve?", header: "Problem", ...},
        {question: "What's the happy path?", header: "Happy Path", ...},
        {question: "What are you NOT building?", header: "Scope OUT", ...}
      ])

      **Round 2: Edge Cases**

      AskUserQuestion(questions=[
        {question: "What if 0 results?", header: "Empty State", ...},
        {question: "What if 10K results?", header: "Scale", ...},
        {question: "Concurrent edit handling?", header: "Concurrency", ...}
      ])

      Document all answers with rationale.

  # Phase 1.6: Interview - Architecture (Platform, UX, Performance, Technical)
  - id: p1.6
    name: Interview - Architecture
    task_config:
      title: "P1.6: Interview - Architecture (platform, UX, performance, technical)"
      labels: [phase, phase-1-6, clarification]
      depends_on: [p1.5]
    todoActiveForm: "Interviewing user - architecture"
    instruction: |
      Cover categories C (Platform), D (UX), E (Performance), G (Frontend), H (Backend).

      **Round 3: Platform Integration**

      AskUserQuestion(questions=[
        {question: "Who gets notified?", header: "Notifications", ...},
        {question: "Real-time updates needed?", header: "Sync", ...},
        {question: "What permissions required?", header: "Access", ...}
      ])

      **Round 4: UX + Performance**

      AskUserQuestion(questions=[
        {question: "Loading state feedback?", header: "Loading", ...},
        {question: "Error handling approach?", header: "Errors", ...},
        {question: "Expected data volume?", header: "Scale", ...}
      ])

      **Round 5: Technical Decisions**

      AskUserQuestion(questions=[
        {question: "Component location?", header: "Frontend", ...},
        {question: "Which worker owns API?", header: "Backend", ...},
        {question: "Database changes needed?", header: "Schema", ...}
      ])

      Document all answers with rationale.

  # Phase 1.7: Interview - Design & Testing (Testing Strategy, UI Mockups)
  - id: p1.7
    name: Interview - Design & Testing
    task_config:
      title: "P1.7: Interview - Design & Testing (testing strategy, UI mockups)"
      labels: [phase, phase-1-7, clarification]
      depends_on: [p1.6]
    todoActiveForm: "Interviewing user - design & testing"
    instruction: |
      Cover categories I (Testing) and D (UX - Design System + Mockups).

      **Round 6: Testing Strategy**

      **CRITICAL: Testing must be planned BEFORE implementation.**

      AskUserQuestion(questions=[
        {question: "What manual test scenarios verify success?", header: "Happy Path", options: [
          {label: "CRUD operations", description: "Create, read, update, delete flows"},
          {label: "User journey", description: "End-to-end workflow completion"},
          {label: "API responses", description: "Correct data returned"}
        ]},
        {question: "What should we test fails gracefully?", header: "Error Paths", options: [
          {label: "Validation errors", description: "Invalid input handling"},
          {label: "Permission denied", description: "Unauthorized access attempts"},
          {label: "Network failures", description: "Timeout and retry behavior"}
        ]},
        {question: "What edge cases need testing?", header: "Edge Cases", options: [
          {label: "Empty states", description: "Zero results, first-time user"},
          {label: "Boundary values", description: "Max length, limits"},
          {label: "Concurrent access", description: "Multiple users editing"}
        ]},
        {question: "How will we verify in browser?", header: "UI Testing", options: [
          {label: "Screenshot comparison", description: "Visual regression check"},
          {label: "User flow walkthrough", description: "Click through full journey"},
          {label: "Console error check", description: "No JS errors"}
        ]}
      ])

      Document answers - these become the Test Plan section in spec.

      **Round 7: UI Design (Design System + Mockups)**

      **Skip this round for backend-only features.**

      **Step 1: Design System Foundation**

      AskUserQuestion(questions=[
        {question: "Which EXISTING page is most similar?", header: "Reference", options: [
          {label: "/projects/*", description: "Project detail pages with tabs"},
          {label: "/projects/*/rfis", description: "Entity list with VibeGrid"},
          {label: "/dashboard", description: "Dashboard with cards/panels"},
          {label: "/settings/*", description: "Settings form layout"}
        ], multiSelect: false},
        {question: "Which layout component?", header: "Layout", options: [
          {label: "PageLayout", description: "Standard page with header + content"},
          {label: "ContentPanel", description: "Panel within existing page"},
          {label: "SplitView", description: "Side-by-side panels"},
          {label: "Modal/Dialog", description: "Overlay dialog"}
        ], multiSelect: false},
        {question: "Which shared/components/ will you reuse?", header: "Components", options: [
          {label: "VibeGrid + columns", description: "Data table with sorting/filtering"},
          {label: "Form components", description: "Input, Select, DatePicker"},
          {label: "Card + CardHeader", description: "Content cards"},
          {label: "Dialog + DialogContent", description: "Modal dialogs"}
        ], multiSelect: true}
      ])

      **Step 2: Create ASCII mockups (4 states minimum)**

      Required states: Main View, Empty State, Loading State, Error State.
      Additional: Create/Edit Form, Detail View, Selected State, Filter Active.

      Use design system components. NO hardcoded colors.

      **Step 3: Present mockups for user feedback (2-4 iterations per state)**

      Document Design System Summary for spec-writer:
      - Reference Page, Layout Component, Reused Components
      - Approved Mockups (implementation contract)

  # GATE: Requirements Approval
  - id: p1.8
    name: Requirements Approval Gate
    task_config:
      title: "GATE: Requirements approved by user"
      labels: [phase, gate, requirements]
      depends_on: [p1.7]
    gate: true
    todoActiveForm: "Waiting for user approval"
    instruction: |
      Compile requirements summary from all interview phases:

      ## Requirements Summary
      **Problem:** [from interview]
      **Solution Approach:** [key decisions]
      **Scope IN:** [included]
      **Scope OUT:** [excluded]
      **Edge Cases:** [how handled]
      **Platform Integration:** [notifications, sync, access]

      Present to user for approval.
      Ask: "Reply 'approve requirements' to proceed"
      WAIT for explicit approval. Do NOT proceed until user says "approve".

  # Phase 2: Spec Writing - SPAWN AGENT
  - id: p2
    name: Spec Writing (SPAWN AGENT)
    task_config:
      title: "P2: Spec - SPAWN spec-writer agent (DO NOT write spec yourself)"
      labels: [phase, phase-2, spec]
      depends_on: [p1.8]
    todoActiveForm: "SPAWNING spec-writer agent"
    evidence:
      - type: file_exists
        pattern: 'planning/specs/{issue}-*.md'
        message: "Spec file not found. Run spec-writer agent to create planning/specs/{issue}-*.md"
    steps:
      - id: init-template
        title: "Initialize spec template"
        instruction: |
          pnpm bgh init-spec \
            --issue={issue} --template=full-stack --title="{title}"
          Then: Mark this task completed via TodoWrite

      - id: spawn-spec-writer
        title: "SPAWN spec writer agent"
        instruction: |
          ⛔ DO NOT write the spec yourself. You are the orchestrator.
          ✅ SPAWN a spec-writer agent:

          Task(subagent_type="spec-writer", prompt="
            ROLE: Spec Writer Agent
            SPEC FILE: planning/specs/{issue}-*.md
            RESEARCH: [paste aggregated findings from P1]
            REQUIREMENTS: [paste interview answers from P1.5]

            Fill ALL spec sections. No TBD placeholders.
            Verify file paths exist in codebase.
            Return when spec is complete.
          ")

          Wait for agent to complete with TaskOutput.
          Then: Mark this task completed via TodoWrite

      - id: verify-spec-complete
        title: "Verify spec completeness"
        instruction: |
          Read the spec file (this is OK - you're verifying, not researching).
          Check: No TBD/TODO/placeholder text.
          Check: All sections have content.
          Check: File paths reference real files.
          Then: Mark this task completed via TodoWrite

      - id: generate-test-plan
        title: "SPAWN testing planner agent"
        instruction: |
          ⛔ DO NOT generate test plan yourself.
          ✅ SPAWN a testing-planner agent:

          Task(subagent_type="testing-planner", prompt="
            SPEC: planning/specs/{issue}-*.md
            INTERVIEW ANSWERS (Testing Round 6):
            [paste testing interview answers here]

            Generate comprehensive test plan covering:
            1. Unit tests (component logic)
            2. API tests (baseplane-data commands)
            3. Browser tests (chrome-devtools steps)
            4. Edge case tests
            5. Manual verification checklist

            Return structured test plan.
          ")

          Add test plan to spec file as Section 7: Test Plan
          Or create separate: planning/specs/{issue}-test-plan.md

          Then: Mark this task completed via TodoWrite

  # Phase 2.4: Theory & Primitives Impact Assessment + Codex Gate
  #
  # This phase does TWO things:
  # A) Substantive: Cross-reference spec against docs/theory/ and docs/primitives/ to find
  #    concepts, constraints, or wireframes that need creating or updating.
  # B) Compliance: Run Codex primitives audit to verify spec uses platform primitives correctly.
  #
  - id: p2.4
    name: Theory & Primitives Impact (+ CODEX Gate)
    task_config:
      title: "P2.4: Theory & Primitives - impact assessment + Codex compliance (no 🔴 bypasses)"
      labels: [phase, phase-2-4, primitives, theory, gate]
      depends_on: [p2]
    todoActiveForm: "Assessing theory & primitives impact"
    steps:

      # ═══════════════════════════════════════════════════════════════
      # Part A: Substantive Impact Assessment
      #
      # PURPOSE: Every feature spec introduces concepts, patterns, and
      # conventions. Some of these belong only in the spec (one-time
      # implementation detail). Others are reusable knowledge that should
      # flow back into theory (invariants) or primitives (wireframes,
      # conventions). This part identifies which is which.
      #
      # WHY THIS MATTERS: Without this step, theory and primitives docs
      # slowly drift from reality. Each feature adds knowledge that never
      # gets captured. After 20 features, the docs describe a system that
      # no longer exists. This step prevents that drift.
      # ═══════════════════════════════════════════════════════════════

      - id: spawn-impact-agent
        title: "Step 1: SPAWN Theory & Primitives Impact agent"
        instruction: |
          ⛔ DO NOT read theory/primitives docs yourself. SPAWN an agent.
          ✅ SPAWN an Explore agent to cross-reference the spec against doctrine.

          **What this agent does:**
          The agent reads the entire spec, then reads ALL theory docs (6 files)
          and ALL primitives docs (~27 files). For every concept, pattern, and
          convention in the spec, it classifies the relationship to existing
          doctrine as Aligned, Extends, New, or Contradicts.

          **Why Explore agent (not Gemini/Codex):**
          This requires reading 30+ files and cross-referencing specific sections.
          Gemini :explore is optimized for codebase search, not doc-to-doc comparison.
          Codex :primitives only checks compliance, not impact. An Explore agent
          can read everything and produce the structured comparison we need.

          ```
          Task(subagent_type="Explore", prompt="
          THEORY & PRIMITIVES IMPACT ASSESSMENT

          SPEC FILE: planning/specs/{issue}-*.md

          Read the spec completely, then read ALL of:
          - docs/theory/ (6 files: domains.md, data.md, dynamics.md, experience.md, governance.md, boundaries.md)
          - docs/primitives/ (all files in directory — ~27 files)
          - docs/primitives/README.md (document map — shows what each primitive covers)
          - docs/theory/README.md (reading order — shows what each theory doc covers)

          FOR EACH CONCEPT in the spec, classify:

          ## 1. Theory Impact

          Extract every concept, constraint, invariant, and domain rule from the spec.
          For each one, find the closest match in the 6 theory docs and classify:

          | Concept | Closest Theory Doc | Section | Impact | Notes |
          |---------|-------------------|---------|--------|-------|
          | [concept from spec] | [theory doc or 'NONE'] | [section name] | New/Extends/Contradicts/Aligned | [explanation] |

          Impact types:
          - **Aligned** — spec uses concept exactly as theory defines it. No doc update needed.
            Example: spec says 'entities have lifecycle phases' and dynamics.md §Lifecycle already covers this.
          - **Extends** — spec adds a new dimension to an existing theory concept.
            Example: spec introduces a 'draft → review → approved' lifecycle that dynamics.md describes
            generically but doesn't cover this specific pattern. Theory should add it as an example or subsection.
          - **New** — spec introduces a concept that has no home in any theory doc.
            Example: spec describes a 'delegation chain' concept for approvals that isn't in governance.md.
            A new subsection is needed.
          - **Contradicts** — spec assumes something different from what theory states.
            Example: spec says entities can exist without an org context, but domains.md says
            'all entities are org-scoped'. This needs resolution before implementation.

          **What to look for in the spec:**
          - Entity definitions, schemas, archetypes → check against data.md
          - Lifecycle states, transitions, phase rules → check against dynamics.md
          - Module boundaries, capability declarations → check against domains.md
          - UI layouts, view patterns, navigation → check against experience.md
          - Permission models, access rules, audit → check against governance.md
          - Integration patterns, sync, external APIs → check against boundaries.md

          ## 2. Primitives Impact

          Extract every UI pattern, wireframe, data shape, convention, and edge state
          from the spec. For each one, find the closest match in the primitives docs:

          | Pattern | Closest Primitive Doc | Section | Impact | Notes |
          |---------|----------------------|---------|--------|-------|
          | [pattern from spec] | [primitive doc or 'NONE'] | [section name] | New/Extends/Contradicts/Aligned | [explanation] |

          **What to look for in the spec:**
          - Grid/table patterns → check against vibegrid.md
          - Page layouts, sidebars, navigation → check against view-shell.md
          - Work queue, inbox, notification lists → check against command-center.md
          - Form patterns, input conventions → check against live-forms.md
          - Workflow visualizations → check against flow-canvas.md
          - File handling patterns → check against file-browser.md
          - Approval/review UI patterns → check against approvals.md
          - New UI surfaces that don't match ANY existing primitive

          Focus especially on:
          - New wireframes needed (the spec describes a UI pattern not covered by any primitive doc)
          - Extended conventions (the spec adds new rules to an existing primitive — e.g., a new
            VibeGrid column type, a new View Shell layout variant, a new edge state)
          - New data shapes (API response shapes, entity templates that should be documented)
          - Workflow/lifecycle patterns not yet in workflow-engine.md

          ## 3. Layer Boundary Check

          Flag spec content that is written as implementation detail but is actually
          reusable knowledge that should be elevated to theory or primitives:

          - **Abstract invariants buried in the spec** → should be in theory
            Example: 'All approval chains must have at least one approver' is a theory constraint,
            not a feature-specific rule.
          - **Wireframe conventions described only in the spec** → should be in primitives
            Example: 'The detail panel always opens on the right with a 400px width' is a primitives
            convention if it applies beyond this one feature.
          - **Reusable patterns described as one-off** → should be elevated to primitives
            Example: 'Filter bar with saved views' described only for this feature but useful everywhere.
          - **Domain rules that transcend this feature** → should be in theory
            Example: 'Contractors cannot see subcontractor pricing' is governance, not feature-specific.

          ## 4. Summary

          Count and list actionable items only:
          - Theory docs needing updates: [list with doc name + specific section + what to add]
          - Primitives docs needing updates: [list with doc name + specific section + what to add]
          - New primitive docs needed: [list with proposed name + one-line scope]
          - Contradictions to resolve: [list with both sides of the contradiction]
          - Content to elevate from spec: [list with what content and where it should go]
          - Aligned (no action): [count only, no detail needed]

          Keep response under 120 lines. Tables + summary only, no raw content dumps.
          Do NOT include aligned items in detail — just count them.
          ")
          ```

          **Expected output:** 4 structured sections with tables. ~80-120 lines.
          **Expected time:** 1-3 minutes (reads ~33 files).

          **If agent returns mostly 'Aligned':** That's a good sign — the feature is
          well-grounded in existing doctrine. Proceed quickly through Steps 2-3.

          **If agent returns many 'New' or 'Contradicts':** This feature is pushing
          boundaries. Steps 2-4 will take longer. Budget time accordingly.

      - id: present-impact
        title: "Step 2: Present impact assessment to user"
        instruction: |
          Wait for agent with TaskOutput. Read the agent's response carefully.

          **Organize findings by action severity and present to user.**
          Group into 5 categories, ordered from most to least urgent:

          ---

          ## Theory & Primitives Impact Assessment

          ### Contradictions (resolve before implementation)
          These MUST be resolved — the spec and existing doctrine disagree.
          Implementing without resolution creates inconsistency.

          | # | Spec Says | Doctrine Says | Doc | Resolution Options |
          |---|-----------|---------------|-----|-------------------|
          | 1 | [spec claim] | [doctrine claim] | [doc:section] | A) Update doctrine / B) Change spec / C) Both wrong |

          For each contradiction, briefly explain the stakes:
          "If we implement the spec as-is, it violates [constraint] in [doc],
          which [N other features/modules] depend on."

          ### New Content Needed (knowledge gaps)
          The spec introduces concepts or patterns with no home in doctrine.
          These should be documented so future features can build on them.

          | # | What | Target Layer | Target Doc | Proposed Section |
          |---|------|-------------|-----------|-----------------|
          | 1 | [concept/pattern] | Theory/Primitives | [doc name] | [section name] |

          For each item, one sentence on why it's reusable (not feature-specific):
          "This pattern will be used by [other features/modules] and should be
          documented as a [convention/constraint/wireframe]."

          ### Updates Needed (extending existing content)
          Existing doctrine is correct but incomplete — the spec adds new dimensions.

          | # | What | Doc | Section | What to Add |
          |---|------|-----|---------|-------------|
          | 1 | [concept/pattern] | [doc] | [section] | [brief description] |

          ### Content to Elevate (spec → doctrine)
          Knowledge currently trapped in the spec that should be promoted
          to theory or primitives for reuse.

          | # | Spec Content | Should Be In | Why |
          |---|-------------|-------------|-----|
          | 1 | [content] | [doc:section] | [reuse justification] |

          ### Aligned (no action)
          [N] concepts/patterns matched existing doctrine with no changes needed.

          ---

          **Key stats for the user:**
          - Contradictions: N (must resolve)
          - New content: N (knowledge gaps to fill)
          - Extensions: N (existing docs to update)
          - Elevations: N (spec content to promote)
          - Aligned: N (no action)

          **If 0 actionable items:** Say so clearly and recommend skipping to Step 5.
          **If only 1-2 minor extensions:** Recommend "Update now" — it's quick.
          **If contradictions exist:** Flag as blocking — these must be resolved.

      - id: user-decides-impact
        title: "Step 3: User decides what to update"
        instruction: |
          **Present the decision based on what was found.**

          The user needs to decide how to handle each category of impact.
          The right answer depends on the volume and severity of findings.

          ```
          AskUserQuestion(questions=[
            {question: "How should we handle theory/primitives updates?",
             header: "Doc Updates",
             options: [
               {label: "Update now (Recommended)", description: "Draft theory/primitives doc changes in this session"},
               {label: "Defer all", description: "Create doctrine tasks for later — no doc changes now"},
               {label: "Cherry-pick", description: "I'll tell you which updates to do now vs defer"},
               {label: "No updates needed", description: "Skip — impact assessment found nothing actionable"}
             ], multiSelect: false}
          ])
          ```

          **Handle each response:**

          **If "Update now":**
          - All non-contradiction items proceed to Step 4 (doc-updater agent).
          - For contradictions: present each one individually and ask the user
            to pick a resolution (update doctrine / change spec / both):
            ```
            AskUserQuestion(questions=[
              {question: "Contradiction: spec says '{X}', {doc} says '{Y}'. Which is correct?",
               header: "Resolve",
               options: [
                 {label: "Spec is right", description: "Update {doc} to match the spec"},
                 {label: "Doctrine is right", description: "Change the spec to match {doc}"},
                 {label: "Both need revision", description: "I'll explain the correct answer"},
                 {label: "Defer", description: "Don't resolve now — create doctrine task"}
               ], multiSelect: false}
            ])
            ```
          - If user says "Doctrine is right," update the spec now (spawn spec-writer
            to fix the spec section) BEFORE proceeding to Step 4.
          - Record all resolutions for the doc-updater agent prompt.

          **If "Cherry-pick":**
          - Present each actionable item (numbered from Step 2) and ask:
            ```
            AskUserQuestion(questions=[
              {question: "Which updates should we do now?",
               header: "Select",
               options: [
                 {label: "Items 1,3,5", description: "Update these now"},
                 {label: "All extensions", description: "Do all 'extends' items, defer 'new'"},
                 {label: "Contradictions only", description: "Resolve contradictions, defer the rest"},
                 {label: "I'll list them", description: "Let me specify exactly which ones"}
               ], multiSelect: false}
            ])
            ```
          - For selected items: proceed to Step 4.
          - For deferred items: create GitHub issues (one per deferred item):
            ```bash
            pnpm bgh create --type=chore \
              --title="Doctrine: update {doc} § {section} re GH#{issue}" \
              --labels=doctrine,deferred
            ```

          **If "Defer all":**
          - Create one GitHub issue per actionable item:
            ```bash
            pnpm bgh create --type=chore \
              --title="Doctrine: update {doc} § {section} re GH#{issue}" \
              --labels=doctrine,deferred
            ```
          - Log how many issues created.
          - Skip to Step 5 (Codex compliance).
          - **WARNING:** If contradictions exist and user defers them, warn explicitly:
            "There are N contradictions between the spec and doctrine. Implementing
            without resolving them means the feature may violate documented invariants.
            Are you sure you want to defer?" (re-ask with just Defer/Resolve options).

          **If "No updates needed":**
          - Verify there really are 0 actionable items from Step 2.
          - If there ARE actionable items but user says skip: respect the decision
            but note it in the task completion reason.
          - Skip to Step 5 (Codex compliance).

      - id: spawn-doc-updater
        title: "Step 4: SPAWN doc-updater for approved changes (if any)"
        instruction: |
          **Skip this step if user chose "Defer all" or "No updates needed" in Step 3.**

          ⛔ DO NOT update theory/primitives docs yourself. SPAWN an agent.
          ✅ SPAWN a spec-writer agent with ALL context it needs.

          **Before spawning, compile the update brief:**
          Gather from Steps 2-3:
          1. The specific items approved for update (with their category: New/Extends/Elevate)
          2. Contradiction resolutions (what the correct answer is for each)
          3. The target doc and section for each item
          4. The spec sections that contain the source content

          **SPAWN the agent:**

          ```
          Task(subagent_type="spec-writer", prompt="
          ROLE: Theory & Primitives Doc Updater
          MODE: Documentation Only (NO code changes)

          SPEC FILE: planning/specs/{issue}-*.md

          ## Updates Approved by User

          [For EACH approved item, provide ALL of:]
          ### Item N: [brief title]
          - **Category:** New / Extends / Elevate / Contradiction Resolution
          - **Target doc:** [exact file path, e.g., docs/theory/dynamics.md]
          - **Target section:** [exact section name, e.g., '## Lifecycle Phases']
          - **What to write:** [clear description of what content to add or change]
          - **Source in spec:** [which spec section contains the source material]
          - **User's resolution (if contradiction):** [what the user said is correct]

          ## Layer Rules (CRITICAL — violations will be caught in verification)

          THEORY DOCS (docs/theory/):
          - Zero file paths, zero library names, zero component names — NO EXCEPTIONS
          - Content must survive a complete stack rewrite (React→Vue, Kysely→Drizzle)
          - Fixed 6-file structure — NEVER create new theory files, NEVER rename existing ones
          - Add content to existing sections or create new subsections within existing files
          - Every theory doc follows: Principle → Why This Matters → Concepts → Constraints → Relationships
          - Constraints must be testable statements ('X must always Y', 'X never Z')
          - Cross-references use relative links: [Related Doc](../primitives/vibegrid.md)

          PRIMITIVES DOCS (docs/primitives/):
          - Zero library names (no React, MobX, TanStack), zero file paths (no src/, apps/)
          - Component STRUCTURE names are OK (e.g., 'sidebar', 'toolbar', 'grid header')
          - Content must survive a stack rewrite but NOT necessarily a UI redesign
          - CAN create new primitive files if the feature introduces a genuinely new
            reusable UI primitive (rare — most features extend existing primitives)
          - Every primitives doc follows: Principle → Wireframes → Conventions → Data Shapes → Edge States → Relationships
          - Wireframes use box-drawing characters (┌─┐│└─┘), NOT ASCII dashes
          - Update docs/primitives/README.md Document Map if adding a new primitive

          CROSS-REFERENCES (apply to both layers):
          - Every doc that references another must have a bidirectional link
          - Theory → Primitives links go in the Relationships section
          - Primitives → Theory links go in the Relationships section
          - If doc A now references doc B, also update doc B to reference doc A

          ## Existing Doc Conventions

          Before editing ANY doc, read the ENTIRE existing doc first to match:
          - Heading hierarchy (##, ###, ####)
          - List formatting (numbered vs bulleted)
          - Table column conventions
          - Constraint numbering scheme (some docs use sequential, some use categorized)
          - Wireframe style (match existing ASCII art conventions in that doc)

          ## Tasks

          For EACH approved update:
          1. Read the target doc completely (understand existing content and style)
          2. Edit the target doc — add/modify the specific section
          3. Update the Relationships section in the target doc if cross-refs changed
          4. Update Relationships sections in OTHER docs that should now link to the changed content
          5. If adding a new primitive doc:
             a. Create the file following the standard structure
             b. Add it to docs/primitives/README.md Document Map (correct category)
             c. Add cross-references from related primitives

          ## Quality Checks (verify before returning)

          - [ ] No file paths in theory docs (grep for 'src/', 'apps/', '.ts', '.tsx')
          - [ ] No library names in theory docs (grep for 'React', 'MobX', 'Kysely', 'Hono', 'Vite')
          - [ ] No library names in primitives docs (grep for same)
          - [ ] All cross-references point to existing files
          - [ ] New constraints are testable (can be verified true/false)
          - [ ] README updated if new primitive added

          RETURN (structured — not prose):
          - Files modified: [list with file path + section name + change type (added/edited)]
          - Files created: [list with file path + rationale]
          - Cross-references added: [list with 'doc A §section → doc B §section']
          - Quality checks: [pass/fail for each check above]
          ")
          ```

          Wait for agent to complete with TaskOutput.

          **Verify the agent's work (quick checks — don't re-read entire docs):**

          1. **Layer boundary violations:**
             ```bash
             # Theory docs: zero implementation references
             grep -E '(src/|apps/|\.ts$|\.tsx$|React|MobX|Kysely|Hono|Vite|TanStack)' docs/theory/*.md
             # Should return nothing. If it does, note the violations.

             # Primitives docs: zero library names
             grep -E '(React|MobX|Kysely|Hono|Vite|TanStack)' docs/primitives/*.md
             # Should return nothing (or only pre-existing violations).
             ```

          2. **Structural checks:**
             ```bash
             # New primitive has required sections?
             grep -E '^## (Principle|Relationships)' docs/primitives/{new_file}.md

             # README updated?
             grep '{new_primitive_name}' docs/primitives/README.md
             ```

          3. **Cross-reference integrity:**
             ```bash
             # Check that linked files exist (agent should have verified, but double-check)
             # For each cross-reference the agent added, verify the target file exists
             ```

          **If violations found:**
          - Minor (1-2 library name leaks): fix inline with Edit tool — don't re-spawn.
          - Major (wrong layer, missing sections, broken structure): re-spawn with
            specific fix instructions. Don't try to fix structural issues yourself.

      # ═══════════════════════════════════════════════════════════════
      # Part B: Codex Compliance Gate
      #
      # PURPOSE: Verify the SPEC correctly uses platform primitives.
      # This is separate from Part A — Part A checks whether doctrine
      # DOCS need updating; Part B checks whether the SPEC respects
      # the primitives it should be using.
      #
      # Example: Part A might find that the spec introduces a new grid
      # column type that should be added to vibegrid.md. Part B checks
      # whether the spec uses DataForge instead of custom tables.
      # Both are necessary. Neither replaces the other.
      # ═══════════════════════════════════════════════════════════════

      - id: run-primitives-audit
        title: "Step 5: Run Codex primitives compliance check"
        instruction: |
          Run the Codex primitives audit against the spec file.
          This checks whether the spec USES platform primitives correctly —
          it does NOT check whether doctrine docs are up to date (that was Part A).

          ```bash
          pnpm at codex :primitives planning/specs/{issue}-*.md --gate
          ```

          **What Codex checks:**
          - Are the 6 platform primitives used where applicable?
            1. DataForge — entity definitions, schemas (not custom tables)
            2. Relationships — entity connections (not junction tables)
            3. Workflows — multi-step processes (not hardcoded state machines)
            4. Templates — reusable configs (not hardcoded defaults)
            5. CommandBus — frontend operations (not scattered API calls)
            6. EventBus — real-time sync (not polling)
          - Are there custom tables that should use DataForge?
          - Are there hardcoded state machines that should use Workflows?
          - Is `## Primitives Design` section in the spec complete and justified?
          - Red flags: custom routers for CRUD, junction tables, scattered API calls

          **Expected output:** Color-coded report with 🔴 (blocking), 🟡 (concern), 🟢 (pass).

          **Note:** If Part A's doc-updater added new primitives or updated conventions,
          the Codex audit may catch the spec not yet referencing the updated docs.
          That's fine — the fix loop in Steps 7-8 handles this.

      - id: check-primitives-result
        title: "Step 6: Check Codex result and decide next step"
        instruction: |
          Read the Codex output and classify the result:

          **PASSED (no 🔴 bypasses, ≤2 🟡 missed):**
          - Proceed directly to Step 9 (close phase).
          - No fix loop needed.

          **FAILED (has 🔴 or >2 🟡):**
          - Proceed to Step 7 (fix loop).
          - Count the issues: "Codex found N 🔴 and M 🟡 issues."
          - Brief summary of what's wrong before spawning the fixer.

          **Edge case — Codex flags something that Part A already addressed:**
          If the Codex audit flags a primitives concern that was already resolved
          in Part A (e.g., "spec doesn't reference workflow-engine.md" but Part A
          already updated that doc), note this discrepancy. The spec may need a
          cross-reference added, not a design change.

      - id: fix-primitives-loop
        title: "Step 7: Fix Loop - SPAWN spec fixer agent"
        instruction: |
          **Only execute this step if Step 6 result was FAILED.**

          The Codex audit found the spec bypasses platform primitives or has
          incomplete primitives design. Spawn an agent to fix the SPEC (not
          the doctrine docs — those were handled in Part A).

          ```
          Task(subagent_type="spec-writer", prompt="
          FIX PRIMITIVES COMPLIANCE IN SPEC

          The Codex primitives audit failed — the spec bypasses platform primitives
          or has an incomplete Primitives Design section.

          ISSUES TO FIX:
          [Paste the FULL Codex output — all 🔴 and 🟡 items with their descriptions]

          THE SIX PLATFORM PRIMITIVES:
          1. DataForge — entity definitions, schemas, archetypes, validation
             USE instead of: custom database tables, manual CRUD routes, ad-hoc validation
          2. Relationships — entity connections, foreign keys, reference integrity
             USE instead of: junction tables, manual join queries, hardcoded parent-child
          3. Workflows — multi-step processes, state machines, approval chains
             USE instead of: hardcoded status enums, manual state transitions, if/else chains
          4. Templates — reusable configurations, defaults, presets
             USE instead of: hardcoded default values, copy-paste config objects
          5. CommandBus — frontend operation dispatch, optimistic updates
             USE instead of: scattered API calls, manual loading/error state management
          6. EventBus — real-time sync, cache invalidation, cross-module notifications
             USE instead of: polling, manual refetch, prop drilling for updates

          SPEC FILE: planning/specs/{issue}-*.md

          REQUIREMENTS:
          - For each 🔴 issue: Replace the custom approach with the appropriate primitive.
            Show HOW the primitive is used (which archetype, which workflow template, etc.).
          - For each 🟡 issue: Either adopt the primitive OR add an explicit justification
            explaining why the primitive doesn't fit this case. Justifications must be specific
            ('DataForge archetypes don't support X because Y') not vague ('too complex').
          - Update the ## Primitives Design section to reflect all changes.
          - Ensure every primitive usage references the correct docs/primitives/ doc.

          RETURN:
          - 🔴 issues fixed: [list with what changed]
          - 🟡 issues fixed or justified: [list with resolution]
          - Primitives Design section: updated (yes/no)
          ")
          ```

          Wait for agent to complete with TaskOutput.

      - id: rerun-primitives
        title: "Step 8: Re-run Codex primitives audit"
        instruction: |
          After the fixer agent completes, re-run Codex to verify the fixes:

          ```bash
          pnpm at codex :primitives planning/specs/{issue}-*.md --gate
          ```

          **Check result:**
          - **PASSED:** Proceed to Step 9.
          - **Still FAILED:** Return to Step 7 with the NEW Codex output.

          **Repeat Steps 7-8 until:**
          - No 🔴 primitive bypasses remain, AND
          - ≤2 🟡 concerns remain

          **Circuit breaker:** After 3 iterations, if 🔴 items persist:
          - Present remaining issues to user.
          - Ask: "These primitives issues remain after 3 fix attempts. Options:"
            A) Accept with justification (add explicit bypass rationale to spec)
            B) Restructure the feature approach (may require going back to P1.5)
            C) Defer primitives compliance (create tracking issue)

      - id: close-primitives
        title: "Step 9: Close theory & primitives phase"
        instruction: |
          **Compile the full phase summary before closing.**

          Record what happened in both parts:

          **Part A (Impact Assessment):**
          - Theory updates applied: [count + which docs]
          - Primitives updates applied: [count + which docs]
          - Items deferred: [count + issue numbers if created]
          - Contradictions resolved: [count + resolutions]
          - Content elevated from spec: [count]

          **Part B (Codex Compliance):**
          - Codex result: 🔴 [count] 🟡 [count]
          - Fix iterations: [count]
          - Remaining accepted concerns: [count, if any]

          ```bash
          Mark this task completed via TodoWrite (reason: "Impact: T[N] theory P[N] primitives D[N] deferred | Codex: 🔴 0 🟡 X | Iterations: N")
          ```

          **If theory/primitives docs were modified in Part A:**
          These changes will be committed alongside the spec in P5 (Finalize).
          Make sure the modified doc paths are noted for the git add in P5.

  # Phase 2.5: Review Gate - CODEX (with fix loop)
  - id: p2.5
    name: Review Gate (CODEX)
    task_config:
      title: "P2.5: Review - Codex quality gate (no 🔴 blocking issues)"
      labels: [phase, phase-2-5, review, gate]
      depends_on: [p2.4]
    todoActiveForm: "Running Codex review gate"
    steps:
      - id: run-codex-review
        title: "Step 1: Run Codex spec review"
        instruction: |
          ```bash
          pnpm at codex :spec planning/specs/{issue}-*.md
          ```

          Codex checks: structure, completeness, consistency, security

      - id: check-score
        title: "Step 2: Check result"
        instruction: |
          - **PASSED (no 🔴 blocking, ≤2 🟡 concerns):** proceed to Step 5
          - **FAILED (has 🔴 or >2 🟡):** proceed to Step 3 (fix loop)

      - id: fix-loop
        title: "Step 3: Fix Loop - SPAWN spec fixer agent"
        instruction: |
          If Codex review failed, spawn agent to fix:

          ```
          Task(subagent_type="spec-writer", prompt="
          FIX CODEX ISSUES

          Codex review failed with blocking issues or too many concerns.

          ISSUES TO FIX:
          [Paste Codex feedback/issues]

          SPEC FILE: planning/specs/{issue}-*.md

          REQUIREMENTS:
          - Fix ALL issues identified by Codex
          - No TBD/placeholder text
          - Verify file paths exist

          RETURN:
          - Issues fixed
          - Any questions for user
          ")
          ```

      - id: rerun-codex
        title: "Step 4: Re-run Codex"
        instruction: |
          ```bash
          pnpm at codex :spec planning/specs/{issue}-*.md
          ```

          **Repeat Steps 3-4 until no 🔴 blocking issues (and ≤2 🟡 after review #3).**

      - id: close-review
        title: "Step 5: Close review phase"
        instruction: |
          ```bash
          Mark this task completed via TodoWrite (reason: "Codex passed (🔴 0 | 🟡 X)")
          ```

  # Phase 2.6: Spec YAML Validation (structure check before sync)
  - id: p2.6
    name: Spec YAML Validation
    task_config:
      title: "P2.6: Validate spec YAML structure for implementation mode"
      labels: [phase, phase-2-6, validation, gate]
      depends_on: [p2.5]
    todoActiveForm: "Validating spec YAML structure"
    steps:
      - id: run-validate-spec
        title: "Step 1: Run spec validation"
        instruction: |
          Validate spec YAML frontmatter structure:

          ```bash
          pnpm wm validate-spec --issue={issue}
          ```

          This checks:
          - YAML frontmatter exists and is valid
          - `phases:` section exists with proper structure
          - Each phase has `id:`, `name:`, and `tasks:` (NOT `beads:`)
          - Phase IDs are unique
          - `github_issue:` field is present

      - id: check-validation-result
        title: "Step 2: Check result"
        instruction: |
          - **✅ Spec is valid:** Proceed to P3 (Spec Sync)
          - **❌ Spec has errors:** Fix and re-validate

          **Common issues:**
          - Using `beads:` instead of `tasks:` in phases
          - Missing `tasks:` array under phases
          - Duplicate phase IDs
          - Missing YAML frontmatter

      - id: fix-yaml-if-needed
        title: "Step 3: Fix YAML structure (if errors)"
        instruction: |
          If validation failed, SPAWN spec-writer agent to fix:

          ```
          Task(subagent_type="spec-writer", prompt="
          FIX SPEC YAML STRUCTURE

          Validation failed. Fix the YAML frontmatter.

          COMMON FIXES:
          - Replace 'beads:' with 'tasks:' under each phase
          - Ensure tasks is a list of strings (task descriptions)
          - Add missing phase fields (id, name, tasks)

          CORRECT FORMAT:
          phases:
            - id: p1
              name: \"Phase Name\"
              tasks:
                - \"Task description 1\"
                - \"Task description 2\"

          SPEC FILE: planning/specs/{issue}-*.md
          ")
          ```

          Then re-run validation:
          ```bash
          pnpm wm validate-spec --issue={issue}
          ```

      - id: close-validation
        title: "Step 4: Close validation phase"
        instruction: |
          ```bash
          Mark this task completed via TodoWrite (reason: "Spec YAML validated: X phases, Y tasks")
          ```

  # Phase 3: Spec Sync (post-Codex, post-validation)
  - id: p3
    name: Spec Sync
    task_config:
      title: "P3: Spec Sync - push to GitHub, notify"
      labels: [phase, phase-3, spec-sync]
      depends_on: [p2.6]
    todoActiveForm: "Syncing spec to GitHub"
    steps:
      - id: sync-spec
        title: "Sync spec to GitHub"
        instruction: |
          ```bash
          ./planning/sync.sh
          gh issue comment {issue} --body "Spec ready: planning/specs/{issue}-*.md (Codex passed)"
          Mark this task completed via TodoWrite (reason: "Spec synced to GitHub")
          ```

  # Phase 4: Doc Sync
  # Generate/update feature documentation from approved spec
  - id: p4
    name: Doc Sync
    task_config:
      title: "P4: Doc Sync - generate feature docs from spec"
      labels: [phase, phase-4, doc-sync]
      depends_on: [p3]
    todoActiveForm: "Syncing feature documentation"
    steps:
      - id: determine-domain-feature
        title: "Step 1: Determine domain and feature from spec"
        instruction: |
          Extract domain and feature from the planning spec:

          ```bash
          # Get the spec file path
          SPEC_FILE=$(ls planning/specs/{issue}-*.md 2>/dev/null | head -1)

          # Extract from frontmatter if available
          DOMAIN=$(yq -r '.domain // empty' "$SPEC_FILE" 2>/dev/null)

          # If no domain in frontmatter, infer from spec content
          # Look for patterns like "apps/web/src/features/X" or "domain: X"
          if [[ -z "$DOMAIN" ]]; then
            # Common domains: vibegrid, auth, dataforge, gc, files, communications, workflows, layout
            # Infer from file paths mentioned in spec, or ask user
          fi

          # Feature name from issue title (kebab-case)
          FEATURE=$(echo "{issue_title}" | tr '[:upper:]' '[:lower:]' | \
            sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//')
          ```

          **If domain unclear:** Ask user:
          ```
          AskUserQuestion(questions=[
            {question: "What domain does this feature belong to?", header: "Domain", options: [
              {label: "vibegrid", description: "Data grid, tables, Gantt views"},
              {label: "auth", description: "Authentication, access control"},
              {label: "dataforge", description: "Entity schemas, CRUD"},
              {label: "layout", description: "Sidebar, navigation, dashboard"},
              {label: "communications", description: "Email, inbox, notifications"},
              {label: "gc", description: "General contractor domain entities"},
              {label: "files", description: "File browser, uploads, viewer"}
            ], multiSelect: false}
          ])
          ```

      - id: create-feature-doc
        title: "Step 2: Create feature documentation"
        instruction: |
          Create the feature doc by copying TEVS behaviors from spec:

          ```bash
          # Create feature doc directory if needed
          mkdir -p docs/features/$DOMAIN

          # Create feature doc from template
          cp docs/features/_template.md docs/features/$DOMAIN/$FEATURE.md
          ```

          **Manually copy behaviors from spec:**
          1. Open planning spec: `planning/specs/{issue}-*.md`
          2. Copy `## Feature Behaviors` section (all B1, B2, B3... entries)
          3. Paste into `docs/features/$DOMAIN/$FEATURE.md`
          4. Update frontmatter: domain, status, relatedRules
          5. Fill in Source fields with actual code paths (or "TBD" if not yet implemented)

          **Why manual copy:**
          - Spec and feature doc use same TEVS format (direct sync)
          - Human reviews and adjusts as needed
          - Avoids complex auto-extraction that loses context

          **Update index:**
          ```bash
          # Add entry to index if needed
          echo "| $FEATURE | draft | N | [$FEATURE]($DOMAIN/$FEATURE.md) |" >> docs/features/index.md
          ```

      - id: verify-doc-created
        title: "Step 3: Verify doc was created"
        instruction: |
          ```bash
          # Check doc exists (flat structure: {domain}/{feature}.md)
          ls docs/features/$DOMAIN/$FEATURE.md

          # Check index was updated
          grep -q "$FEATURE" docs/features/index.md && echo "Index updated" || echo "Index NOT updated"

          # Optional: Run verification
          # pnpm at verify feature $DOMAIN/$FEATURE
          ```

      - id: close-doc-sync
        title: "Step 4: Close doc sync phase"
        instruction: |
          ```bash
          Mark this task completed via TodoWrite (reason: "Feature docs: docs/features/$DOMAIN/$FEATURE.md")
          ```

          **If doc sync was skipped:**
          ```bash
          Mark this task completed via TodoWrite (reason: "Doc sync skipped (will create feature doc during implementation)")
          ```

  # Phase 5: Finalize (auto - no user approval needed, Codex was the gate)
  - id: p5
    name: Finalize
    task_config:
      title: "P5: Finalize - set status:approved, update GitHub"
      labels: [phase, phase-5, finalize]
      depends_on: [p4]
    todoActiveForm: "Finalizing planning"
    steps:
      - id: update-spec-status
        title: "Update spec status to approved"
        instruction: |
          Codex review passed - spec is ready. Update status:

          ```bash
          SPEC_FILE=$(ls planning/specs/{issue}-*.md 2>/dev/null | head -1)

          # Update status in YAML frontmatter
          sed -i 's/^status:.*/status: approved/' "$SPEC_FILE"

          # Verify the change
          grep "^status:" "$SPEC_FILE"
          ```

          Then commit and push:
          ```bash
          git add "$SPEC_FILE"

          # If P2.4 modified theory/primitives docs, include them in the commit
          git add docs/theory/ docs/primitives/ 2>/dev/null || true

          git commit -m "docs(spec): mark GH#{issue} spec as approved

          Includes theory/primitives doc updates from impact assessment (if any)."
          git push
          ```

      - id: update-github-status
        title: "Update GitHub issue status"
        instruction: |
          Update GitHub issue to indicate spec is approved and ready:

          ```bash
          pnpm bgh set-status {issue} 03-ready
          gh issue comment {issue} --body "✅ Spec approved (Codex passed) - ready for implementation"
          ```

      - id: close-finalize
        title: "Close finalize phase"
        instruction: |
          ```bash
          Mark this task completed via TodoWrite (reason: "Spec approved, GitHub updated")
          ```

          **Planning mode complete!** The spec is now ready for implementation mode.

global_conditions:
  - changes_committed
  - changes_pushed
  - github_updated

workflow_id_format: "PL-{session_last_4}-{MMDD}"
---

# Planning Mode

## ⛔ ORCHESTRATOR RULES - READ THIS FIRST

**YOU ARE AN ORCHESTRATOR. YOU COORDINATE WORK. YOU DO NOT DO DEEP WORK.**

### What You DO:
- ✅ Tasks are auto-created on mode entry (check with TaskList)
- ✅ SPAWN agents via `Task(subagent_type="...", ...)`
- ✅ Wait for agents with `TaskOutput`
- ✅ Ask user questions with `AskUserQuestion`
- ✅ Run CLI commands (`pnpm wm status`, `pnpm bgh`, etc.)
- ✅ Verify agent results (brief reads to confirm)

### What You DO NOT:
- ⛔ Read source code files to understand codebase (spawn Explore)
- ⛔ Search codebase with Grep/Glob (spawn Explore)
- ⛔ Write spec content yourself (spawn spec-writer)
- ⛔ Generate test plans yourself (spawn testing-planner)
- ⛔ Analyze code patterns yourself (spawn Explore)
- ⛔ Review spec thoroughness yourself (spawn review agent)

### Why This Matters:
```
❌ INLINE RESEARCH:                    ✅ AGENT SPAWNING:
   Read(file1.ts)    → 500 tokens        Task(prompt) → 50 tokens
   Read(file2.ts)    → 500 tokens        TaskOutput   → 200 tokens
   Read(file3.ts)    → 500 tokens        (agent reads 20 files internally)
   ...20 files       → 10,000 tokens     TOTAL: 250 tokens
   TOTAL: 10,000 tokens WASTED           Context preserved!
```

### Self-Check Before Each Action:
> "Am I about to Read a .ts/.tsx file to understand code?"
> → YES → STOP → Spawn Explore agent instead

---

## Native Tasks

**Tasks are auto-created when you enter planning mode via `pnpm wm enter planning --issue=NNN`.**

Native tasks use Claude Code's built-in task system at `~/.claude/tasks/{session-id}/`.

**Check tasks:**
```bash
# Use TaskList tool to see all tasks
# Use TaskGet to get task details
# Use TaskUpdate to mark tasks in_progress or completed
```

**Task management commands:**
```bash
pnpm wm status         # Check current mode and phase
pnpm wm can-exit       # Check stop conditions
```

---

## Phase Summary

| # | Phase | Action | Tool/Agent |
|---|-------|--------|------------|
| 0 | issue_creation | Create GH issue (if not linked) | `pnpm bgh create` |
| 1 | research | **GEMINI CLI** | `pnpm at gemini :explore` (30 sec) |
| 1.5 | clarification | Interview (7 rounds, incl. UI mockups) | AskUserQuestion |
| | requirements_approved | **GATE** | (wait for user approval) |
| 2 | spec | **SPAWN** | `spec-writer` + `testing-planner` |
| 2.4 | theory & primitives | Impact assessment + **GATE** (fix loop) | `Task(Explore)` + `Task(spec-writer)` + `pnpm at codex :primitives` |
| 2.5 | review | **GATE** (fix loop) | `pnpm at codex :spec` (no 🔴) |
| 2.6 | validation | **GATE** (YAML structure) | `pnpm wm validate-spec` |
| 3 | spec_sync | Sync to GitHub | `./planning/sync.sh` |
| 4 | doc_sync | Generate feature docs | `scripts/docs/init-feature-doc.sh` |
| 5 | finalize | Auto-finalize → status:approved | `pnpm bgh set-status` |

**Note:** Implementation mode creates Beads from spec tasks (no breakdown phase here).

---

## Anti-Patterns (DO NOT DO)

### ❌ Wrong: Spawning Multiple Explore Agents (Old Pattern)
```
# BAD - slow, 3 agents taking 10-20 min
Task(subagent_type="Explore", prompt="Find similar implementations...")
Task(subagent_type="Explore", prompt="Search rules...")
Task(subagent_type="Explore", prompt="Search episodic memory...")
# Wait 20 minutes for all to complete
```

### ✅ Right: Single Gemini CLI Call (New Pattern)
```
pnpm at gemini :explore "feature description"
# Returns all 5 sections in ~30 seconds
```

### ❌ Wrong: Writing Spec Yourself
```
# BAD - you're writing content
Edit(file="planning/specs/123-*.md", ...)
# 500 lines of spec content...
```

### ✅ Right: Spawn Spec Writer
```
Task(subagent_type="spec-writer", prompt="
  SPEC FILE: planning/specs/123-*.md
  RESEARCH: [findings]
  REQUIREMENTS: [interview answers]
  Fill all sections.
")
```

---

## Commands

```bash
pnpm wm status                              # Check current mode and phase
pnpm wm can-exit                            # Check stop conditions
mode.sh --can-exit                          # Check stop conditions
```
