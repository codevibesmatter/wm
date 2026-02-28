---
id: doctrine
name: Doctrine Mode
description: Deep interview-style work on docs/theory and docs/primitives — validate, refine, or author from scratch
mode: doctrine

entry:
  # Optional: --layer=theory|primitives (default: ask at entry)
  # Optional: --doc=docs/theory/domains.md (or data.md, dynamics.md, experience.md, governance.md, boundaries.md)
  #           --doc=docs/primitives/view-shell.md (or command-center.md, vibegrid.md)
  # If neither, interactive selection from fixed file list
  optional:
    - target_layer
    - existing_doc

phases:
  # Phase 0: Internal Research (Doc State + Code Alignment)
  # CONTEXT MANAGEMENT: Research is split into 3 sequential batches (max 2 agents each)
  # to prevent context overload. Each batch saves results to doctrine-notes.md before proceeding.
  - id: p0
    name: "Baseline: Internal"
    task_config:
      title: "P0: Internal research — doc state + code alignment (2 agents)"
      labels: [phase, phase-0, research]
    todoActiveForm: "Running internal research agents"
    steps:
      - id: select-target
        title: "Step 0: Select target layer and document"
        instruction: |
          If not provided via --layer and --doc flags:

          ```
          AskUserQuestion(questions=[
            {question: "Which knowledge layer are you working on?",
             header: "Layer",
             options: [
               {label: "Theory", description: "docs/theory/ — principles, constraints, invariants (stack-agnostic)"},
               {label: "Primitives", description: "docs/primitives/ — concept, wireframes, behavior conventions (product-specific)"},
               {label: "Both", description: "Cross-layer work touching both theory and primitives"}
             ], multiSelect: false},
            {question: "Which document?",
             header: "Document",
             options: [
               {label: "Let me pick", description: "Show the fixed file list for the selected layer"},
               {label: "Specific section", description: "I know which section within a doc to work on"}
             ], multiSelect: false}
          ])
          ```

          **Fixed file structure (no new files — content goes into existing categories):**

          Theory (6 files):
          - `docs/theory/domains.md` — What is a module? Bounded contexts, BPM regions, declarations, capabilities.
          - `docs/theory/data.md` — How is data modeled? Entities, archetypes, relationships, lifecycle, schema.
          - `docs/theory/dynamics.md` — How does work move? Lifecycle phases, events, workflows, intelligence.
          - `docs/theory/experience.md` — Where does everything live? Product topology, views, state ownership, collaboration.
          - `docs/theory/governance.md` — How is access enforced and traced?
          - `docs/theory/boundaries.md` — How do systems integrate? Boundary translation, sync, communication.

          Primitives (extensible — one file per primitive):
          - `docs/primitives/view-shell.md` — Three-view wireframes, navigation, config-in-context, cross-view persistence.
          - `docs/primitives/command-center.md` — Unified work queue, inbox aggregation, item types, real-time sync.
          - `docs/primitives/vibegrid.md` — Data grid, column types, view modes, row expansion, bulk actions.

          List the files for the selected layer and let user pick.
          If the user wants to add NEW content, identify which existing file it belongs in.

      - id: spawn-doc-state-agent
        title: "Step 1: SPAWN Doc State agent"
        instruction: |
          ```
          Task(subagent_type="Explore", prompt="
          ANALYZE DOCUMENT STATE

          Target doc: {doc_path}
          Layer: {theory|primitives}
          (If new doc, return 'New document - analyzing related docs in same layer')

          FOR EXISTING DOC:
          1. Read the document completely
          2. List all sections and their content types:
             - Principle statement
             - Concepts (with subsections)
             - Constraints (numbered list)
             - Relationships (cross-references to other docs)
             - Wireframes/diagrams (primitives layer)
          3. Count: sections, constraints, cross-references, wireframes
          4. Identify any TBD markers, incomplete sections, or placeholder content
          5. Check: does every Relationships link target actually exist?

          FOR NEW DOC:
          1. Read the layer README (docs/theory/README.md or docs/primitives/README.md)
          2. Read all existing docs in the layer
          3. Identify where the new topic fits in the reading order
          4. Note which existing docs should cross-reference the new one

          RETURN: Structured markdown with section inventory and gap analysis.
          Keep response under 80 lines — summarize, don't dump raw content.
          ", run_in_background=true)
          ```

      - id: spawn-code-alignment-agent
        title: "Step 2: SPAWN Code Alignment agent"
        instruction: |
          ```
          Task(subagent_type="Explore", prompt="
          VERIFY DOCTRINE AGAINST CODEBASE

          Target doc: {doc_path}
          Layer: {theory|primitives}

          FOR THEORY DOCS:
          For EACH constraint listed in the doc:
          1. Search codebase for violations or confirmations
          2. Check if the constraint is actually enforced
          3. Note any code patterns that assume this constraint but aren't documented
          4. Identify constraints that are aspirational vs actually implemented

          FOR PRIMITIVES DOCS:
          For EACH wireframe or convention:
          1. Find the actual UI implementation
          2. Compare wireframe structure to real component hierarchy
          3. Note discrepancies between documented pattern and implementation
          4. Identify implemented patterns not yet documented

          RETURN:
          | Constraint/Pattern | Doc Says | Code Does | Match? | Notes |
          Keep response under 80 lines — summary table + key observations only.
          ", run_in_background=true)
          ```

      - id: collect-batch-1
        title: "Step 3: Collect batch 1 results and save"
        instruction: |
          Wait for BOTH agents with TaskOutput.

          **Append to doctrine-notes.md:**

          ```markdown
          ## Batch 1: Internal Research

          ### Doc State
          [Paste agent 1 results — keep under 60 lines, summarize if verbose]

          ### Code Alignment
          [Paste agent 2 results — keep under 60 lines, summarize if verbose]
          ```

          ```bash
          Mark task completed via TodoWrite (reason: "Internal: doc state + code alignment saved to notes")
          ```

  # Phase 0.1: Cross-Reference Research (Cross-Doc + Rules)
  - id: p0.1
    name: "Baseline: Cross-References"
    task_config:
      title: "P0.1: Cross-ref research — cross-doc + rules (2 agents)"
      labels: [phase, phase-0-1, research]
      depends_on: [p0]
    todoActiveForm: "Running cross-reference research agents"
    steps:
      - id: spawn-cross-doc-agent
        title: "Step 1: SPAWN Cross-Doc Consistency agent"
        instruction: |
          ```
          Task(subagent_type="Explore", prompt="
          CHECK CROSS-DOCUMENT CONSISTENCY

          Target doc: {doc_path}
          Layer: {theory|primitives}

          1. Read ALL docs in docs/theory/ and docs/primitives/
          2. For every concept mentioned in the target doc:
             - Is it defined consistently across all docs that reference it?
             - Are there contradictions between docs?
             - Are cross-references bidirectional? (A links to B, B links to A?)
          3. Check layer boundaries:
             - Does the target doc contain content too specific for its layer?
               Theory: any file paths, library names, component names → belongs in Rules
               Theory: any wireframes or visual structure → belongs in Primitives
               Primitives: any abstract invariants without visual structure → belongs in Theory
               Primitives: any library names, file paths → belongs in Rules
          4. Check for duplicate content across docs

          RETURN:
          1. Cross-reference integrity table
          2. Layer boundary violations (content that belongs elsewhere)
          3. Contradictions found
          4. Missing cross-references
          Keep response under 80 lines.
          ", run_in_background=true)
          ```

      - id: spawn-rules-crossref-agent
        title: "Step 2: SPAWN Rules Cross-Reference agent"
        instruction: |
          ```
          Task(subagent_type="Explore", model="haiku", prompt="
          CROSS-REFERENCE WITH RULES LAYER

          Target doc: {doc_path}
          Layer: {theory|primitives}

          1. Read all files in .claude/rules/
          2. For each concept in the target doc, check if rules exist that:
             - Implement the principle (theory → rules alignment)
             - Follow the pattern (primitives → rules alignment)
             - Contradict the doctrine (rules vs doctrine mismatch)
          3. Identify rules that reference no theory/primitives doc
             (these may need doctrine to be written)
          4. Identify doctrine that has no corresponding rules
             (these may be aspirational or need rules written)

          RETURN:
          1. Doctrine ↔ Rules alignment table
          2. Rules with no doctrine backing
          3. Doctrine with no rules implementation
          4. Contradictions
          Keep response under 60 lines.
          ", run_in_background=true)
          ```

      - id: collect-batch-2
        title: "Step 3: Collect batch 2 results and save"
        instruction: |
          Wait for BOTH agents with TaskOutput.

          **Append to doctrine-notes.md:**

          ```markdown
          ## Batch 2: Cross-Reference Research

          ### Cross-Doc Consistency
          [Paste agent results — keep under 60 lines]

          ### Rules Cross-Reference
          [Paste agent results — keep under 60 lines]
          ```

          ```bash
          Mark task completed via TodoWrite (reason: "Cross-ref: cross-doc + rules saved to notes")
          ```

  # Phase 0.2: External Research + Aggregate
  - id: p0.2
    name: "Baseline: External & Aggregate"
    task_config:
      title: "P0.2: Web research + aggregate all findings"
      labels: [phase, phase-0-2, research]
      depends_on: [p0.1]
    todoActiveForm: "Running external research"
    steps:
      - id: spawn-web-research-agent
        title: "Step 1: SPAWN Web Research agent"
        instruction: |
          ```
          Task(subagent_type="general-purpose", prompt="
          EXTERNAL RESEARCH: DOMAIN, COMPETITORS, AND BEST PRACTICES

          Target doc topic: {doc_topic}
          Layer: {theory|primitives}
          Domain: {construction management / enterprise SaaS / data-intensive apps}

          Research these dimensions (2-3 WebSearch calls per dimension):

          ## 1. CLEAN ARCHITECTURE & SOFTWARE DESIGN
          - Clean Architecture (Robert C. Martin) — Dependency Rule, Use Cases, Entity layer
          - Hexagonal Architecture (Ports & Adapters) — module boundary alignment
          - Domain-Driven Design (Eric Evans) — Bounded Contexts, Aggregates, Domain Events
          - SOLID principles — constraint model alignment
          Search: 'clean architecture module boundaries best practices 2025 2026'
          Search: 'domain driven design bounded context aggregate patterns'

          ## 2. COMPETITOR & INDUSTRY ANALYSIS
          **Construction Tech:** Procore, Autodesk CC, PlanGrid/Fieldwire
          **Enterprise SaaS:** Salesforce, SAP, Workday
          **Developer Platforms:** Stripe, Shopify, GitHub
          Search: '{domain} software architecture documentation best practices'
          Search: 'construction management software architecture procore'

          ## 3. MAINTAINABILITY & EVOLVABILITY
          - Architecture docs that stay useful (arc42, C4 model)
          - Architecture Decision Records (ADRs)
          - Architecture fitness functions — automated constraint testing
          Search: 'architecture documentation maintainability best practices arc42 c4'

          ## 4. STATE & DATA PATTERNS (if relevant)
          - CQRS / Event Sourcing, offline-first, optimistic UI, real-time sync
          Search: 'CQRS event sourcing state management patterns 2025 2026'

          ## 5. UI/UX PATTERNS (if primitives layer)
          - Enterprise dashboard patterns, data grid best practices, accessibility (WCAG 2.2)
          Search: 'enterprise dashboard UI patterns best practices 2025 2026'

          ---

          RETURN structured findings as:
          ### Clean Architecture Alignment
          | Our Principle | Industry Best Practice | Alignment | Gap |

          ### Competitor Patterns
          | Competitor | Relevant Pattern | What We Can Learn |

          ### Recommendations
          1-5 prioritized recommendations with source URLs.

          Keep total response under 120 lines. Summarize, cite URLs, skip filler.
          ", run_in_background=true)
          ```

      - id: collect-batch-3
        title: "Step 2: Collect web research results and save"
        instruction: |
          Wait for agent with TaskOutput.

          **Append to doctrine-notes.md:**

          ```markdown
          ## Batch 3: External Research
          [Paste agent results — keep under 100 lines, include source URLs]
          ```

      - id: aggregate-baseline
        title: "Step 3: Aggregate into baseline assessment"
        instruction: |
          **Read doctrine-notes.md** to get all three batches of findings.
          Compile into a structured baseline:

          ## Baseline Assessment: {doc_name}

          ### Document State
          - Layer: {theory|primitives}
          - Sections: [count]
          - Constraints/Conventions: [count]
          - Cross-references: [count] (N valid, M broken)
          - Wireframes: [count] (primitives only)

          ### Code Alignment
          | # | Constraint/Pattern | Status | Notes |
          |---|-------------------|--------|-------|
          | 1 | ... | Confirmed/Violated/Aspirational | ... |

          ### Cross-Doc Consistency
          - Contradictions: [count]
          - Missing cross-refs: [count]
          - Layer boundary violations: [count]

          ### Rules Alignment
          - Doctrine with rules: [count]
          - Doctrine without rules: [count]
          - Rules without doctrine: [count]

          ### External Research Highlights
          - Clean Architecture alignment: [summary]
          - Competitor insights: [top 3]
          - Industry patterns we're missing: [list]

          ### Top Issues
          1. [most important finding]
          2. [second finding]
          3. [third finding]

          **SAVE the aggregate to doctrine-notes.md** (append as final section).

          ```bash
          Mark this task completed via TodoWrite (reason: "Baseline: X sections, Y issues, Z external insights")
          ```

  # Phase 1: Document Audit (present findings, get direction)
  - id: p1
    name: Document Audit
    task_config:
      title: "P1: Audit - present findings, identify what to work on"
      labels: [phase, phase-1, audit]
      depends_on: [p0.2]
    todoActiveForm: "Presenting audit findings"
    steps:
      - id: present-audit
        title: "Step 1: Present audit findings"
        instruction: |
          Present the baseline assessment to the user. Organize by severity:

          **Critical (content is wrong or contradicted):**
          - [list]

          **Important (content is incomplete or misplaced):**
          - [list]

          **Minor (polish, missing cross-refs):**
          - [list]

          **Healthy (confirmed and consistent):**
          - [list]

      - id: scope-work
        title: "Step 2: Scope the work for this session"
        instruction: |
          ```
          AskUserQuestion(questions=[
            {question: "What should we focus on this session?",
             header: "Focus",
             options: [
               {label: "Fix critical issues", description: "Address wrong/contradicted content first"},
               {label: "Fill gaps", description: "Add missing concepts, constraints, cross-refs"},
               {label: "Full review", description: "Go section by section through the entire doc"},
               {label: "Specific sections", description: "I'll tell you which sections to work on"}
             ], multiSelect: false}
          ])
          ```

          Based on answer, create a work plan listing which sections to interview.

          **SAVE to doctrine-notes.md:**
          Append scope decisions.

          ```bash
          Mark this task completed via TodoWrite (reason: "Scoped to: [focus area]")
          ```

  # Phase 1.5: Deep Interview (per-section, layer-appropriate questions)
  - id: p1.5
    name: Deep Interview
    task_config:
      title: "P1.5: Interview - exhaustive per-section clarification with external research challenges"
      labels: [phase, phase-1-5, interview]
      depends_on: [p1]
    todoActiveForm: "Deep-interviewing doctrine sections"
    steps:
      - id: interview-sections
        title: "Step 1: Interview sections — ALL categories, layer-appropriate"
        instruction: |
          **Work through each section in scope. Apply ALL relevant interview
          categories. Every section gets at minimum categories A-D. Complex
          sections get E-H as well.**

          **IMPORTANT: Reference web research findings from P0 throughout.
          Challenge each section against what industry best practices say.**

          ---

          ═══════════════════════════════════════════════════════════════
          ## FOR THEORY DOCS
          ═══════════════════════════════════════════════════════════════

          ### Principle Section

          **Category A: Accuracy & Completeness**
          - Is the principle statement still accurate?
          - Is it too narrow? Too broad?
          - Does the "Why This Matters" still resonate?
          - Would a developer who reads only this section understand the core idea?
          - Does the principle have a clear "negative test" — what does violating it look like?

          **Category B: Clean Architecture Alignment**
          - Does this principle align with the Dependency Rule (dependencies point inward)?
          - Does it respect the Stable Dependencies Principle?
          - Would Robert C. Martin agree this is at the right abstraction level?
          - Does it honor the Interface Segregation Principle?
          - From P0 web research: "[present relevant clean architecture finding]"
            → Does our principle need to change based on this?

          **Category C: Domain-Driven Design**
          - Does this principle correctly define Bounded Context boundaries?
          - Are Aggregate boundaries respected?
          - Does it handle Domain Events properly?
          - Is the Ubiquitous Language consistent with the rest of the docs?
          - From P0 web research: "[present relevant DDD finding]"
            → Are we missing a DDD concept here?

          **Category D: Maintainability & Evolvability**
          - Could a new developer understand this without tribal knowledge?
          - Is the principle testable? Could you write a fitness function for it?
          - What happens when this principle needs to change — how many docs/code files break?
          - Does the principle create coupling between modules? Is that intentional?
          - From P0 web research: "[present maintainability insight]"
            → Should we add a testability section?

          ---

          ### Concepts Section (per concept)

          **Category A: Accuracy & Completeness**
          - Is this concept real? Does the codebase actually use it?
          - Are there concepts the code assumes but this doc doesn't name?
          - Is the concept too implementation-specific? (Should be in Rules?)
          - Are the examples/explanations clear?

          **Category B: Clean Architecture Alignment**
          - Is this concept at the right layer of abstraction?
          - Does it have a single reason to change (SRP)?
          - Could this concept exist in a different tech stack?
          - Is there a design pattern (GoF, enterprise) that better captures this?

          **Category C: Domain-Driven Design**
          - Is this a Value Object, Entity, Aggregate, or Service?
          - Does it map cleanly to DDD tactical patterns?
          - Is the naming consistent with the Ubiquitous Language?
          - Would a domain expert (non-developer) recognize this concept?

          **Category D: Maintainability & Evolvability**
          - Is the explanation self-contained or does it require reading 3 other docs first?
          - Are edge cases documented or just the happy path?
          - Would this concept survive the product pivoting to a new vertical?

          **Category E: Competitor Comparison**
          - From P0 web research: How do competitors model this same concept?
          - Are we reinventing something the industry has a standard name for?
          - Are we missing a concept that competitors consider essential?

          ```
          AskUserQuestion(questions=[
            {question: "Concept '{concept_name}': How does it compare to industry patterns?",
             header: "Industry",
             options: [
               {label: "Aligned", description: "Our approach matches industry best practices"},
               {label: "Intentionally different", description: "We differ for good reasons"},
               {label: "Needs alignment", description: "We should adopt the industry pattern"},
               {label: "Novel", description: "We're pioneering something new here"}
             ], multiSelect: false}
          ])
          ```

          ---

          ### Constraints Section (per constraint)

          **Category A: Accuracy & Status**
          ```
          AskUserQuestion(questions=[
            {question: "Constraint: '{constraint_text}' — is this still true?",
             header: "Constraint",
             options: [
               {label: "Confirmed", description: "This is accurate and enforced"},
               {label: "Aspirational", description: "True in theory, not enforced yet"},
               {label: "Needs revision", description: "Partially true, needs rewording"},
               {label: "Remove", description: "No longer applies"}
             ], multiSelect: false}
          ])
          ```

          For aspirational constraints, ask: "Should we mark it aspirational or remove it?"
          For revised constraints, ask: "What should it say instead?"

          **Category B: Enforcement & Testability**
          - Can this constraint be automatically enforced? (lint rule, type system, test)
          - What's the blast radius if someone violates it? (local bug vs system failure)
          - Is there a runtime check or only a code review convention?
          - Could this become an architecture fitness function?
          - From P0 web research: "[present architecture governance finding]"
            → Should we add automated enforcement?

          **Category C: Completeness & Gaps**
          Based on code alignment research, present undocumented invariants:
          "The code enforces [X] but no constraint documents it. Should we add it?"

          Based on web research, present industry constraints we're missing:
          "Industry best practice says [X]. We don't have a constraint for this. Add one?"

          **Category D: Precision & Edge Cases**
          - Is the constraint precise enough to be unambiguous?
          - Are there legitimate exceptions? Should they be documented?
          - Does it conflict with any other constraint in this doc or another?
          - Could two developers read this and reach different conclusions?

          **Category E: Dependency Analysis**
          - What other constraints depend on this one?
          - If we change this constraint, what else breaks?
          - Is this a foundational constraint (many depend on it) or a leaf constraint?

          ---

          ### Relationships Section

          **Category A: Completeness**
          - Are all cross-references valid and bidirectional?
          - Missing links to other docs?
          - Are the relationship descriptions accurate?

          **Category B: Dependency Direction**
          - Do dependencies point in the right direction?
          - Is there circular dependency between docs?
          - Should some relationships be explicit (required reading) vs optional (see also)?

          ---

          ### Overview / Diagrams Section

          **Category A: Clarity**
          - Does the diagram accurately represent the concept?
          - Would a new team member understand it without explanation?
          - Is it at the right level of abstraction (not too detailed, not too abstract)?

          **Category B: Completeness**
          - Are all important flows/relationships shown?
          - Are error/edge flows represented?
          - Does it match the textual description?

          ---

          ═══════════════════════════════════════════════════════════════
          ## FOR PRIMITIVES DOCS
          ═══════════════════════════════════════════════════════════════

          ### Wireframes (per wireframe)

          **Category A: Accuracy**
          ```
          AskUserQuestion(questions=[
            {question: "Does this wireframe match the current product vision?",
             header: "Wireframe",
             options: [
               {label: "Accurate", description: "Matches current design"},
               {label: "Outdated", description: "Product has evolved past this"},
               {label: "Aspirational", description: "Not built yet but correct target"},
               {label: "Needs redesign", description: "Wrong approach entirely"}
             ], multiSelect: false}
          ])
          ```

          For outdated: "What changed? Should we update the wireframe?"
          For redesign: "What should it look like instead?"

          **Category B: Competitor & Industry Patterns**
          - From P0 web research: "Competitor [X] structures their [equivalent] like [Y]."
            → Should we adopt any of these patterns?
          - Does this wireframe follow enterprise UX conventions?
            (Consistent header heights, control bar placement, spacing scale)
          - From P0 web research: "[present relevant UI pattern finding]"
            → Are we missing an interaction pattern that's become standard?

          **Category C: Accessibility & Inclusion**
          - Does this pattern support keyboard navigation?
          - Screen reader flow: what's the reading order?
          - Color contrast: does the pattern work without color?
          - Touch targets: are they minimum 44px?
          - From P0 web research: "[present WCAG 2.2 finding]"
            → Are we missing accessibility requirements?

          **Category D: Responsive & Mobile**
          - How does this pattern adapt to mobile/tablet?
          - What collapses, what stacks, what hides?
          - Touch gesture support?
          - Offline state handling?

          **Category E: Performance & Scale**
          - How does this pattern behave with 10 items? 100? 10,000?
          - Virtualization needs?
          - Loading state: progressive or all-or-nothing?
          - Does the wireframe show the loading skeleton accurately?

          **Category F: Consistency Across Modules**
          - Does this pattern match other module wireframes?
          - If a user learns this pattern in Module A, does it transfer to Module B?
          - Are spacing, sizing, and layout consistent with the design system?

          ---

          ### Conventions/Rules (per convention)

          **Category A: Accuracy & Adoption**
          - Is this convention actually followed in the codebase?
          - Are there exceptions? Should exceptions be documented?
          - Is it too prescriptive? (implementation detail that belongs in Rules?)
          - Missing conventions the team follows informally?

          **Category B: Industry Alignment**
          - From P0 web research: Is this a widely-adopted convention?
          - Are we using non-standard terminology for a standard pattern?
          - Would a developer from [Procore/Salesforce/Stripe] recognize this convention?

          **Category C: Evolvability**
          - Would this convention survive a redesign?
          - Is it coupled to specific component implementations?
          - Could a new framework honor this convention unchanged?

          ---

          ### Data Shapes / Templates

          **Category A: Accuracy**
          - Do these match what the API actually returns?
          - Are required vs optional fields correct?
          - Missing shapes?

          **Category B: API Design Best Practices**
          - From P0 web research: Does this follow API design best practices?
            (JSON:API, REST conventions, GraphQL patterns)
          - Are field names consistent with the Ubiquitous Language?
          - Is pagination, filtering, sorting represented?
          - Error response shapes documented?

          **Category C: Forward Compatibility**
          - Can new fields be added without breaking consumers?
          - Is versioning strategy clear?
          - Are nullable vs required semantics documented?

          ---

          ### Edge States

          **Category A: Completeness**
          - Are all edge states documented? (loading, error, empty, partial, stale)
          - Are the loading/error/empty patterns still current?

          **Category B: Error UX Best Practices**
          - From P0 web research: "[present error handling UX finding]"
          - Does error state provide recovery path?
          - Is error scope minimal (per-card vs full-page)?
          - Are errors user-actionable or just informational?

          **Category C: Offline & Degraded**
          - What happens offline? Cached data? Explicit offline state?
          - Slow network: timeout thresholds? Progressive loading?
          - Partial failure: one data source fails, others succeed?

          ---

          ═══════════════════════════════════════════════════════════════
          ## FOR BOTH LAYERS — CROSS-CUTTING INTERVIEW CATEGORIES
          ═══════════════════════════════════════════════════════════════

          Apply these to EVERY section regardless of layer:

          ### Category X: Onboarding & Cognitive Load

          - Could a new team member understand this section in isolation?
          - Are prerequisites listed? ("Read [X] first")
          - Is jargon defined or linked?
          - How many concepts does a reader need to hold in memory simultaneously?
          - Would a diagram help? Is the current diagram sufficient?

          ```
          AskUserQuestion(questions=[
            {question: "How would a new developer experience this section?",
             header: "Onboarding",
             options: [
               {label: "Self-explanatory", description: "Clear without context"},
               {label: "Needs prereqs", description: "Need to read other docs first"},
               {label: "Needs examples", description: "Too abstract without examples"},
               {label: "Needs rewrite", description: "Confusing even with context"}
             ], multiSelect: false}
          ])
          ```

          ### Category Y: Longevity & Staleness Risk

          - When was this section last validated against reality?
          - What would make this section go stale? (New feature? Refactor? Pivot?)
          - Is there a trigger that should prompt re-review?
          - Should this section have a "last verified" date?

          ### Category Z: Decision Traceability

          - Why was this choice made? Is the rationale documented?
          - Were alternatives considered? Should they be mentioned?
          - Would an Architecture Decision Record (ADR) be appropriate here?
          - If someone disagrees with this, where do they go to challenge it?

          ---

          ## DEPTH JUDGMENT

          **Quick pass (categories A+D only, 2-4 questions):**
          - Content confirmed by code alignment AND web research
          - No contradictions found
          - Standard patterns matching industry consensus

          **Standard pass (categories A-D, 5-8 questions):**
          - Minor discrepancies between doc and code
          - Some alignment questions from web research
          - Section is moderately complex

          **Deep dive (ALL categories A-Z, 10+ questions):**
          - Code contradicts the doc
          - Web research reveals significant gaps vs industry
          - Multiple cross-doc inconsistencies
          - Section is aspirational (not yet implemented)
          - User says "it depends" or "needs revision"
          - Section touches access control, audit, or compliance
          - Competitor analysis reveals we're missing something
          - Clean Architecture alignment questions raised
          - DDD concepts seem misaligned

          **SAVE to doctrine-notes.md after EACH section:**
          Append ALL Q&A including:
          - Which categories were applied
          - Which web research findings were referenced
          - User's responses to each challenge
          - Decisions made (confirmed / revised / added / removed)
          - Rationale for each decision

      - id: close-interview
        title: "Step 2: Close interview phase"
        instruction: |
          ```bash
          Mark this task completed via TodoWrite (reason: "Interviewed N sections across M categories, R revisions identified, W web research challenges applied")
          ```

  # GATE: Interview Approval
  - id: p1.6
    name: Interview Approval Gate
    gate: true
    task_config:
      title: "GATE: Doctrine clarifications approved by user"
      labels: [phase, gate, doctrine-approval]
      depends_on: [p1.5]
    todoActiveForm: "Waiting for doctrine approval"
    steps:
      - id: compile-summary
        title: "Step 1: Compile clarification summary"
        instruction: |
          Create summary of all clarifications organized by change type:

          ## Doctrine Clarification Summary

          **Confirmed (no changes needed):**
          - [constraint/section] — confirmed accurate

          **Revised:**
          - [constraint/section] — old: "..." → new: "..."

          **Added:**
          - [new constraint/concept] — rationale: ...

          **Removed:**
          - [constraint/section] — reason: ...

          **Moved (cross-layer):**
          - [content] — from {layer} to {layer}

          Present to user for approval.

      - id: get-approval
        title: "Step 2: Get user approval"
        instruction: |
          Ask: "Reply 'approve doctrine' to proceed to cross-layer audit"

          WAIT for explicit approval.
          Do NOT proceed until user says "approve".

          After approval:
          ```bash
          Mark this task completed via TodoWrite (reason: "Doctrine clarifications approved")
          ```

  # Phase 2: Cross-Layer Audit
  - id: p2
    name: Cross-Layer Audit
    task_config:
      title: "P2: Cross-Layer - verify content is in the right layer"
      labels: [phase, phase-2, cross-layer]
      depends_on: [p1.6]
    todoActiveForm: "Auditing cross-layer placement"
    steps:
      - id: layer-boundary-check
        title: "Step 1: Check layer boundaries for all changes"
        instruction: |
          For each change approved in the gate:

          **Apply the layer test:**

          | If the content... | It belongs in... |
          |-------------------|-----------------|
          | Is an abstract invariant with no visual structure | Theory |
          | Includes wireframes, data shapes, UI conventions | Primitives |
          | References specific libraries, file paths, component names | Rules |
          | Is a specific module design for implementation | Specs |

          **Theory ↔ Primitives boundary test:**
          - "Would this survive a complete UI redesign?" → Yes = Theory, No = Primitives
          - "Would this survive a stack rewrite (new framework)?" → Yes = Theory or Primitives, No = Rules
          - "Does this describe what it looks like vs what must be true?" → Looks = Primitives, Must-be-true = Theory

          **Present any boundary concerns:**
          ```
          AskUserQuestion(questions=[
            {question: "This content seems like it might belong in {other_layer}. Move it?",
             header: "Layer",
             options: [
               {label: "Keep here", description: "It's in the right place"},
               {label: "Move it", description: "Move to {other_layer}"},
               {label: "Duplicate", description: "Keep a version in both (rare)"}
             ], multiSelect: false}
          ])
          ```

          **SAVE to doctrine-notes.md:**
          Append cross-layer audit decisions.

      - id: update-cross-refs
        title: "Step 2: Plan cross-reference updates"
        instruction: |
          For any content moves or new sections:
          1. List all docs that need their Relationships section updated
          2. List README.md updates needed (docs/theory/README.md or docs/primitives/README.md)
          3. List any .claude/rules/ files that should reference the new/changed doctrine

          ```bash
          Mark this task completed via TodoWrite (reason: "Cross-layer audit complete: N moves, M cross-ref updates needed")
          ```

  # Phase 3: Reconciliation - SPAWN doc-updater agent
  - id: p3
    name: Reconciliation (SPAWN AGENT)
    task_config:
      title: "P3: Reconciliation - SPAWN doc-updater (DO NOT write doc yourself)"
      labels: [phase, phase-3, reconciliation]
      depends_on: [p2]
    todoActiveForm: "SPAWNING doc-updater agent"
    steps:
      - id: read-notes
        title: "Step 1: Read doctrine-notes.md for complete interview context"
        instruction: |
          Read the doctrine-notes.md file for all interview answers:
          ```bash
          cat .claude/sessions/$(cat .claude/current-session-id)/doctrine-notes.md
          ```

          This contains all interview Q&A from P0 through P2.

      - id: spawn-doc-updater
        title: "Step 2: SPAWN doc-updater agent"
        instruction: |
          DO NOT update docs yourself. You are the orchestrator.
          SPAWN a doc-updater agent:

          ```
          Task(subagent_type="spec-writer", prompt="
          ROLE: Doctrine Doc Updater
          MODE: Doctrine - Documentation Only (NO code changes)

          TARGET DOC: {doc_path}
          LAYER: {theory|primitives}
          (If new doc, create at: docs/{layer}/{slug}.md)

          ## Doctrine Interview Notes
          [Paste contents of doctrine-notes.md - this has ALL interview context]

          ---

          YOUR TASK:

          **FOR THEORY DOCS:**
          1. Update/create Principle section (concise, no stack references)
          2. Update/create Why This Matters section
          3. Update/create Concepts section with subsections
          4. Update/create Constraints section (numbered, testable statements)
          5. Update/create Relationships section (links to other theory + primitives docs)
          6. Ensure zero file paths, zero library names, zero component names
          7. Add Overview diagram if the doc benefits from one (ASCII art)

          **FOR PRIMITIVES DOCS:**
          1. Update/create Principle section
          2. Update/create wireframes (ASCII art matching existing conventions)
          3. Update/create conventions/rules tables
          4. Update/create data shape templates
          5. Update/create edge state tables
          6. Update/create Relationships section
          7. Ensure zero library names, zero file paths (but component structure names are OK)

          **FOR BOTH:**
          - Follow existing doc style exactly (see other docs in same directory)
          - Use the layer's README.md Document Map format for any README updates
          - Update cross-references in OTHER docs as specified in interview notes
          - If creating new doc, add it to the layer README's Document Map (docs/theory/README.md or docs/primitives/README.md)

          RETURN: List of all files created or modified
          ")
          ```

          Wait for agent to complete with TaskOutput.

      - id: verify-updates
        title: "Step 3: Verify doc was updated correctly"
        instruction: |
          Quick verification checks:

          **Theory docs:**
          - Has Principle section? (grep for "## Principle")
          - Has Constraints section? (grep for "## Constraints")
          - Has Relationships section? (grep for "## Relationships")
          - Zero file paths? (grep for common path patterns like "src/", "apps/", ".ts")
          - Zero library names? (grep for "React", "MobX", "Kysely", etc.)

          **Primitives docs:**
          - Has wireframes? (grep for box-drawing chars)
          - Has Relationships section?
          - Zero library names?

          **Both:**
          - Layer README updated if new doc?
          - Cross-references added to other docs?

      - id: close-reconciliation
        title: "Step 4: Close reconciliation phase"
        instruction: |
          ```bash
          Mark this task completed via TodoWrite (reason: "Doc updated: X sections modified, Y cross-refs updated")
          ```

  # Phase 4: Commit
  - id: p4
    name: Commit
    task_config:
      title: "P4: Commit - commit changes and push"
      labels: [phase, phase-4, commit]
      depends_on: [p3]
    todoActiveForm: "Committing doctrine changes"
    steps:
      - id: commit-changes
        title: "Step 1: Commit documentation changes"
        instruction: |
          ```bash
          git add docs/theory/ docs/primitives/ .claude/rules/  # Only if rules were updated
          git commit -m "docs: {refine|create|reorganize} {layer} — {doc_name}

          - {summary of changes}
          - {cross-ref updates if any}

          Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
          ```

      - id: push-changes
        title: "Step 2: Push to remote"
        instruction: |
          ```bash
          git push
          ```

      - id: close-final
        title: "Step 3: Close final phase"
        instruction: |
          ```bash
          Mark this task completed via TodoWrite (reason: "Committed: [hash]")
          ```

global_conditions:
  - changes_committed
  - changes_pushed

workflow_id_format: "DC-{session_last_4}-{MMDD}"
---

# Doctrine Mode

## ORCHESTRATOR RULES - READ THIS FIRST

**YOU ARE AN ORCHESTRATOR. YOU COORDINATE WORK. YOU DO NOT DO DEEP WORK.**

### What You DO:
- Tasks are auto-created on mode entry (check with TaskList)
- SPAWN agents via `Task(subagent_type="...", ...)`
- Wait for agents with `TaskOutput`
- Ask user questions with `AskUserQuestion`
- Run CLI commands (`pnpm wm status`, etc.)
- Verify agent results (brief reads to confirm)
- **Append interview notes to doctrine-notes.md** (persists across compaction)

### What You DO NOT:
- Read source code files to understand codebase (spawn Explore)
- Search codebase with Grep/Glob (spawn Explore)
- Write doctrine doc content yourself (spawn spec-writer)
- Implement code changes (documentation only mode)

---

## Context Management

**CRITICAL: Research is split into 3 sequential batches to prevent context overload.**

| Batch | Phase | Agents | Max Context |
|-------|-------|--------|-------------|
| 1 | P0 | doc-state + code-alignment | 2 agents |
| 2 | P0.1 | cross-doc + rules-crossref | 2 agents |
| 3 | P0.2 | web-research | 1 agent |

**Rules:**
- Never spawn more than 2 agents at once
- After each batch, save results to doctrine-notes.md BEFORE proceeding
- Tell agents to keep responses under 80 lines (summarize, don't dump)
- If context is getting large, save to file and move on

---

## Interview Context Persistence

**CRITICAL: Save interview notes to doctrine-notes.md throughout the workflow!**

This file survives context compaction and will be injected on session continuation.

**After P0 (Internal):** Save doc state + code alignment findings.

**After P0.1 (Cross-Ref):** Save cross-doc + rules findings.

**After P0.2 (External):** Save web research + aggregate baseline.

**After P1 (Audit):** Save scope decisions and focus area.

**After each P1.5 section:** Save all Q&A from the section interview.

**After P2 (Cross-Layer):** Save layer boundary decisions and cross-ref plan.

The doctrine-notes.md file is automatically:
- Created when you enter this mode
- Copied to new session on compaction
- Injected into context on continuation

---

## Phase Summary

| # | Phase | Action | Tool/Agent |
|---|-------|--------|------------|
| 0 | baseline: internal | **SPAWN** 2 agents (doc-state + code-alignment) | `Task(Explore)` x 2 |
| 0.1 | baseline: cross-ref | **SPAWN** 2 agents (cross-doc + rules) | `Task(Explore)` x 2 |
| 0.2 | baseline: external | **SPAWN** 1 agent (web research) + aggregate | `Task(general-purpose)` x 1 |
| 1 | audit | Present findings, scope work | AskUserQuestion |
| 1.5 | interview | Per-section clarification (A-Z categories) | AskUserQuestion |
| | approved | **GATE** | (wait for approval) |
| 2 | cross_layer | Verify content in correct layer | AskUserQuestion |
| 3 | reconciliation | **SPAWN** doc-updater | `Task(spec-writer)` |
| 4 | commit | Commit + push | git commands |

---

## The Knowledge Hierarchy

Understanding the four layers is essential for this mode:

| Layer | Location | Contains | Changes When | Layer Test |
|-------|----------|----------|--------------|------------|
| **Theory** | `docs/theory/` | Principles, constraints, invariants | Domain model changes | Survives any stack rewrite |
| **Primitives** | `docs/primitives/` | Wireframes, data shapes, UI conventions | Product design evolves | Survives stack rewrite, not UI redesign |
| **Rules** | `.claude/rules/` | Code shapes, naming, file conventions | Stack or framework changes | Tied to current stack |
| **Instances** | `planning/specs/` | Specific module designs | Per-feature implementation | Single-use |

### Fixed File Structure

**Theory uses a fixed categorical structure. Primitives are extensible (one file per primitive). Never create new Theory files — add content to existing categories.**

Theory (6 files):
| File | Category | Contains |
|------|----------|----------|
| `domains.md` | What is a module? | Bounded contexts, BPM regions, declarations, capabilities |
| `data.md` | How is data modeled? | Entities, archetypes, relationships, lifecycle, schema |
| `dynamics.md` | How does work move? | Lifecycle phases, events, workflows, intelligence |
| `experience.md` | Where does everything live? | Product topology, views, state ownership, collaboration |
| `governance.md` | Who can do what? | Access control, audit, permissions |
| `boundaries.md` | How do systems integrate? | Boundary translation, sync, communication |

Primitives (extensible — one file per primitive):
| File | Category | Contains |
|------|----------|----------|
| `view-shell.md` | View patterns & state | Three-view wireframes, navigation model, state ownership, cross-view persistence |
| `command-center.md` | Unified work queue | Inbox aggregation, item types, real-time sync |
| `vibegrid.md` | Data grid | Column types, view modes, row expansion, bulk actions |

### Boundary Tests

**"Does this belong in Theory?"**
- Would it survive swapping React for Vue, MobX for Redux, Kysely for Drizzle? → Yes = Theory
- Does it reference what things *look like*? → No, move to Primitives
- Does it name a specific file, library, or component? → No, move to Rules

**"Does this belong in Primitives?"**
- Does it show structure, layout, or visual conventions? → Yes = Primitives
- Is it an abstract invariant with no visual element? → No, move to Theory
- Does it name specific CSS classes, component files, or library APIs? → No, move to Rules

---

## Theory Doc Structure

Every theory doc follows this structure:

```markdown
# {Title}

> {One-line summary — what this doc defines}

---

## Principle
{Core idea in 1-2 paragraphs. No stack references.}

## Why This Matters
{Motivation. What goes wrong without this principle.}

## Overview (optional)
{ASCII diagram showing the concept visually}

## Concepts
### {Concept Name}
{Explanation with examples}

## Constraints
1. {Testable statement about what must be true}
2. {Another testable statement}

## Relationships
- [{Related doc}]({path}) — {how they relate}
```

---

## Primitives Doc Structure

Every primitives doc follows this structure:

```markdown
# {Title}

> {One-line summary — what this doc shows}

---

## Principle
{Core idea. May reference theory doc for deeper explanation.}

## {Section with Wireframes}
```
{ASCII wireframe}
```
**Structure rules:**
- {Convention 1}
- {Convention 2}

## {Data Shapes / Templates}
| Field | Description |
|-------|-------------|

## Edge States
| State | Behavior |
|-------|----------|

## Relationships
- [{Related doc}]({path}) — {how they relate}
```

---

## Interview Personas

Channel **multiple expert personas** depending on the interview category:

### Systems Architect (Theory — Categories A, B, E)
A **senior distributed systems architect with 20+ years** who has built
systems at Stripe, AWS, and Netflix scale:
- "Is this constraint necessary and sufficient?"
- "What happens if a developer violates this?"
- "Could a future module break this invariant?"
- "Is this principle emergent from the codebase or aspirational?"
- "Would this survive 100x scale?"
- "What's the blast radius of changing this?"

### Clean Architecture Purist (Theory — Category B)
**Robert C. Martin's disciple** who evaluates every principle against
Clean Architecture, SOLID, and the Dependency Rule:
- "Does this respect the Dependency Rule — do dependencies point inward?"
- "Is this Use Case layer, Entity layer, or Infrastructure layer?"
- "Would Uncle Bob approve of this boundary?"
- "Are you violating the Open-Closed Principle here?"
- "Is this a Policy or a Detail?"

### Domain Expert (Theory — Categories C, Z)
A **DDD practitioner** who thinks in Bounded Contexts, Aggregates,
and Ubiquitous Language:
- "Is this really a Bounded Context or a convenience grouping?"
- "Where's the Aggregate Root? What's the consistency boundary?"
- "Does this Domain Event carry enough context for consumers?"
- "Would the domain expert (your construction PM) use this term?"
- "Is this a Core Domain, Supporting Domain, or Generic Subdomain?"

### Enterprise Product Designer (Primitives — Categories A, C, D, F)
A **senior enterprise UX designer** from Salesforce/Workday who designs
for 10,000+ user organizations:
- "Does this wireframe match real user workflows?"
- "Are these conventions learnable and consistent?"
- "What edge cases does this pattern not cover?"
- "Would a new team member reproduce this from the doc?"
- "How does this work on a 13-inch laptop?"
- "What does the field worker on a tablet see?"
- "How does a screen reader navigate this?"

### Developer Advocate (Both — Categories X, Y)
A **developer relations engineer** who onboards new team members
and writes docs for external contributors:
- "Could I understand this section after 1 week at this company?"
- "Is this doc structure googleable? Can I find what I need?"
- "Are the examples concrete enough to copy?"
- "What question would I have after reading this?"
- "Where would I go if I disagree with this decision?"

### Competitor Analyst (Both — Category E)
A **product strategist** who has dissected Procore, Autodesk CC,
Salesforce, and Stripe's architecture docs:
- "How does [competitor] solve this same problem?"
- "Are we reinventing a wheel that has an industry name?"
- "What's the state of the art in [domain]?"
- "Where are we ahead of competitors? Where are we behind?"
- "What can we steal shamelessly?"

---

## Interview Category Quick Reference

| Category | Name | When | Minimum Questions |
|----------|------|------|-------------------|
| A | Accuracy & Completeness | Always | 3-4 |
| B | Clean Architecture Alignment | Theory; complex patterns | 3-5 |
| C | Domain-Driven Design / Accessibility | Theory: DDD; Primitives: a11y | 3-4 |
| D | Maintainability & Evolvability | Always | 3-4 |
| E | Competitor & Industry Comparison | When web research found gaps | 2-3 |
| F | Consistency Across Modules | Primitives: wireframes & conventions | 2-3 |
| X | Onboarding & Cognitive Load | Always | 2-3 |
| Y | Longevity & Staleness Risk | Complex or aspirational sections | 2-3 |
| Z | Decision Traceability | Controversial or non-obvious choices | 2-3 |

**Minimum per section:** Categories A + D (5-8 questions)
**Standard per section:** A + B + C + D + X (12-18 questions)
**Deep dive per section:** All categories (20-30+ questions)

---

## Commands

```bash
pnpm wm status                              # Check current mode and phase
pnpm wm can-exit                            # Check stop conditions
```
