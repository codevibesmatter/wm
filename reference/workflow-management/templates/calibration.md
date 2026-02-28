---
id: calibration
name: Calibration Review
description: Multi-signal spec/doc review — 5 signals × 6 layers with taste calls as interactive interview
mode: calibration

entry:
  # Required: --target=planning/specs/1489-*.md (or any doc/spec path)
  # Optional: --scope=full|taste-only|validation-only (default: full)
  # Optional: --layers=0,1,2,3,4,5 (default: all relevant)
  # If no --target, interactive selection
  required:
    - target_path
  optional:
    - scope
    - layer_filter

phases:
  # ─── RESEARCH BATCH 1: Internal Coherence (Signal 2) ───
  # Automated cross-layer alignment checks
  - id: p0
    name: "Signal: Internal Coherence"
    task_config:
      title: "P0: Internal coherence — cross-layer alignment (2 agents)"
      labels: [phase, phase-0, research, signal-coherence]
    todoActiveForm: "Running internal coherence agents"
    steps:
      - id: select-target
        title: "Step 0: Select target and identify layers"
        instruction: |
          If not provided via --target flag:

          ```
          AskUserQuestion(questions=[
            {question: "What are you calibrating?",
             header: "Target",
             options: [
               {label: "A spec", description: "planning/specs/*.md — validate spec against all 6 layers"},
               {label: "A theory doc", description: "docs/theory/*.md — validate theory against primitives, rules, code"},
               {label: "A primitive doc", description: "docs/primitives/*.md — validate primitive against theory, rules, code"},
               {label: "A module doc", description: "docs/modules/**/*.md — validate module against spec, primitives, code"}
             ], multiSelect: false},
            {question: "What scope?",
             header: "Scope",
             options: [
               {label: "Full review (Recommended)", description: "All 5 signals — internal coherence, external, taste, user, temporal"},
               {label: "Taste only", description: "Skip automated checks, go straight to defended position review"},
               {label: "Validation only", description: "Automated coherence + external only, no taste interview"}
             ], multiSelect: false}
          ])
          ```

          **Identify the target's layer:**

          | Path Pattern | Layer | Taste-Eligible? |
          |---|---|---|
          | `docs/theory/*` | 0 - Theory | Yes |
          | `docs/primitives/*` | 1 - Primitives | Yes |
          | `docs/modules/*` | 2 - Modules | Boundary (capabilities=yes, behaviors=no) |
          | `planning/specs/*` | 3 - Specs | No (validation only) |
          | `.claude/rules/*` | 4 - Rules | No (validation only) |
          | `apps/*`, `packages/*` | 5 - Code | No (validation only) |

          **Map the layers that need checking for this target:**

          For a spec (layer 3), check:
          - Layer 0-1: Do theory/primitives support what the spec declares?
          - Layer 2: Does the module doc align with what the spec builds?
          - Layer 4: Do rules support what the spec requires?
          - Layer 5: Does existing code confirm or contradict assumptions?

          For a theory doc (layer 0), check:
          - Layer 1-2: Do primitives and modules faithfully express this theory?
          - Layer 3-4: Do specs and rules comply?
          - Layer 5: Does code actually enforce these principles?

          **SAVE target info to calibration-notes.md:**
          ```markdown
          # Calibration Review: {target_filename}
          **Target:** {target_path}
          **Target Layer:** {layer_number} - {layer_name}
          **Scope:** {full|taste-only|validation-only}
          **Date:** {today}
          ```

      - id: spawn-vertical-alignment-agent
        title: "Step 1: SPAWN Vertical Alignment agent (same-layer + adjacent)"
        instruction: |
          ```
          Task(subagent_type="Explore", prompt="
          VERTICAL ALIGNMENT CHECK

          Target: {target_path}
          Target layer: {layer_number}

          Read the target document completely.

          Then read ALL docs that the target references or should reference:

          FOR SPECS (layer 3):
          1. Read the spec fully
          2. Read docs/theory/*.md — check every principle the spec claims alignment with
          3. Read docs/primitives/*.md — check every primitive the spec claims to follow
          4. Read docs/modules/ for the module this spec builds
          5. Read .claude/rules/ for rules the spec depends on

          FOR THEORY (layer 0):
          1. Read the theory doc fully
          2. Read all docs/primitives/*.md — do primitives express these principles?
          3. Read docs/modules/ for modules that should implement this theory
          4. Read .claude/rules/ for rules that should enforce this theory

          FOR PRIMITIVES (layer 1):
          1. Read the primitive doc fully
          2. Read docs/theory/*.md — does the primitive faithfully express theory?
          3. Read .claude/rules/ — do rules implement this primitive?

          FOR MODULES (layer 2):
          1. Read the module doc fully
          2. Read the parent theory and primitive docs
          3. Read any spec that builds on this module

          FOR EACH cross-layer pair, classify:
          - ALIGNED: Layer N faithfully implements Layer N-1
          - TENSION: Layer N contradicts or drifts from Layer N-1
          - EXTENSION: Layer N adds something Layer N-1 doesn't declare
          - GAP: Layer N-1 declares something Layer N doesn't implement
          - STALE: Layer N references an outdated version of Layer N-1

          RETURN as table:
          | # | Source Layer | Target Layer | Type | Summary | Severity |
          |---|-------------|-------------|------|---------|----------|

          Keep response under 100 lines — summarize, cite specific section names.
          ", run_in_background=true)
          ```

      - id: spawn-horizontal-consistency-agent
        title: "Step 2: SPAWN Horizontal Consistency agent (same-layer peers)"
        instruction: |
          ```
          Task(subagent_type="Explore", prompt="
          HORIZONTAL CONSISTENCY CHECK

          Target: {target_path}
          Target layer: {layer_number}

          Check the target against OTHER docs at the SAME layer:

          FOR SPECS: Compare with sibling specs in planning/specs/
          - Shared terminology consistent?
          - Same primitive names used the same way?
          - Type definitions compatible (e.g., ModuleDefinition shape)?

          FOR THEORY: Compare with other theory docs in docs/theory/
          - Same concept defined differently in two docs?
          - Constraint conflicts across docs?
          - Cross-references bidirectional?

          FOR PRIMITIVES: Compare with other primitive docs in docs/primitives/
          - Wireframe conventions consistent?
          - Edge state lists matching?
          - Component naming aligned?

          FOR RULES: Compare with other rule files in .claude/rules/
          - Same concept, different guidance?
          - Enum values or type definitions mismatched?
          - Import patterns conflicting?

          RETURN as table:
          | # | This Doc Says | Peer Doc Says | Doc | Conflict? | Severity |
          |---|---|---|---|---|---|

          Keep response under 80 lines.
          ", run_in_background=true)
          ```

      - id: collect-coherence
        title: "Step 3: Collect coherence results and save"
        instruction: |
          Wait for BOTH agents with TaskOutput.

          **Append to calibration-notes.md:**

          ```markdown
          ## Signal 2: Internal Coherence

          ### Vertical Alignment (cross-layer)
          [Paste agent 1 results — keep under 80 lines, summarize if verbose]

          ### Horizontal Consistency (same-layer peers)
          [Paste agent 2 results — keep under 60 lines]

          ### Coherence Summary
          - Tensions: [count]
          - Extensions: [count]
          - Gaps: [count]
          - Aligned: [count]
          ```

          ```bash
          Mark task completed via TodoWrite (reason: "Coherence: N tensions, M gaps found")
          ```

  # ─── RESEARCH BATCH 2: External Calibration (Signal 3) + Temporal (Signal 5) ───
  - id: p0.1
    name: "Signals: External + Temporal"
    task_config:
      title: "P0.1: External calibration + temporal validity (2 agents)"
      labels: [phase, phase-0-1, research, signal-external, signal-temporal]
      depends_on: [p0]
    todoActiveForm: "Running external calibration + temporal agents"
    steps:
      - id: spawn-external-calibration-agent
        title: "Step 1: SPAWN External Calibration agent"
        instruction: |
          ```
          Task(subagent_type="general-purpose", prompt="
          EXTERNAL CALIBRATION: Industry Comparison

          Target: {target_path}
          Domain: construction management / enterprise SaaS

          Read the target document. For each major design decision or pattern declared:

          ## 1. Product-Leading Comparisons
          Compare against how these products solve the same problem:
          - Procore (construction vertical)
          - Autodesk Construction Cloud
          - PlanGrid / Fieldwire
          - Notion (modern SaaS patterns)
          - Linear (workflow patterns)
          - Salesforce (enterprise patterns)

          Search: '{target_topic} software architecture best practices 2025 2026'
          Search: 'construction management {target_topic} procore autodesk'

          ## 2. Architecture Comparisons
          - Clean Architecture / Hexagonal alignment
          - DDD patterns (bounded contexts, aggregates)
          - Module composition patterns (ECS, micro-frontends, plugin)

          Search: '{architecture_topic} patterns best practices 2026'

          ## 3. Innovation Classification
          For each deviation from industry norms, classify:

          | Decision | Industry Norm | Our Approach | Classification |
          |---|---|---|---|
          | ... | ... | ... | True Innovation / Reinventing Wheel / Anti-Pattern / Inherited Assumption |

          Classification criteria:
          - TRUE INNOVATION: Evidence of better outcomes for our context
          - REINVENTING WHEEL: No material advantage, maintenance burden
          - ANTI-PATTERN: Known failure modes we haven't addressed
          - INHERITED ASSUMPTION: Never questioned, just momentum

          RETURN structured findings as:
          ### Industry Comparison Table
          | Our Decision | Industry Norm | Gap/Alignment | Source |

          ### Innovation Classifications
          | Decision | Classification | Evidence | Needs Defense? |

          ### Recommendations
          1-5 prioritized with source URLs.

          Keep total response under 120 lines. Cite URLs.
          ", run_in_background=true)
          ```

      - id: spawn-temporal-validity-agent
        title: "Step 2: SPAWN Temporal Validity agent"
        instruction: |
          ```
          Task(subagent_type="Explore", model="haiku", prompt="
          TEMPORAL VALIDITY CHECK

          Target: {target_path}

          1. Read the target document fully.

          2. For each decision or declaration in the document:
             a. Look for date indicators (decided_at, created, last_validated, git blame)
             b. Look for re_evaluate_when conditions
             c. Look for depends_on_external references
             d. Look for hedging language ('might', 'could', 'TBD', 'placeholder')

          3. Cross-reference with recent changes:
             - Run conceptual git log check: has the landscape around this decision changed?
             - Check if any re_evaluate_when conditions might now be met
             - Check if external dependencies have evolved

          4. For each found temporal concern:

          | # | Decision/Section | Age Indicator | Staleness Risk | Re-eval Trigger |
          |---|---|---|---|---|

          Staleness risk levels:
          - FRESH: Recently validated, no landscape changes
          - AGING: Approaching review interval, minor landscape shifts
          - STALE: Past review interval OR re-eval trigger met
          - UNKNOWN: No temporal metadata, age indeterminate

          5. Check for hedging language that indicates unresolved thinking:
             List any 'might', 'could', 'possibly', 'TBD', 'TODO', 'placeholder' phrases.
             These are temporal validity red flags — decisions that were never actually made.

          RETURN: Table + list of hedging phrases found.
          Keep response under 60 lines.
          ", run_in_background=true)
          ```

      - id: collect-external-temporal
        title: "Step 3: Collect results and save"
        instruction: |
          Wait for BOTH agents with TaskOutput.

          **Append to calibration-notes.md:**

          ```markdown
          ## Signal 3: External Calibration

          ### Industry Comparison
          [Paste agent results — keep under 100 lines, include URLs]

          ### Innovation Classifications
          [Table from agent results]

          ---

          ## Signal 5: Temporal Validity

          ### Staleness Assessment
          [Paste agent results — keep under 60 lines]

          ### Hedging Language Found
          [List from agent results]
          ```

          ```bash
          Mark task completed via TodoWrite (reason: "External: N deviations classified. Temporal: M staleness risks")
          ```

  # ─── PHASE 1: Aggregate & Triage ───
  - id: p1
    name: Aggregate & Triage
    task_config:
      title: "P1: Aggregate all signals, separate taste vs validation, present"
      labels: [phase, phase-1, triage]
      depends_on: [p0.1]
    todoActiveForm: "Aggregating multi-signal findings"
    steps:
      - id: aggregate-signals
        title: "Step 1: Build multi-signal tension map"
        instruction: |
          **Read calibration-notes.md** to compile all findings from P0 and P0.1.

          Build a unified tension list. Each tension gets:

          ```
          {
            id: "T-NNN" (taste) or "V-NNN" (validation) or "S-NNN" (staleness),
            signals: [which signals flagged this],
            target_layer: N,
            target_doc: "path",
            type: "tension | gap | extension | deviation | stale",
            summary: "...",
            resolution_type: "taste_call | validation_review | staleness_review",
            severity: "high | medium | low"
          }
          ```

          **Scoring:**
          ```
          score = (layer_weight × 3)
                + (severity × 2)
                + (signal_count × 3)

          layer_weight: Theory=5, Primitives=4, Modules=3, Specs=2, Rules=1
          severity:     high=3, medium=2, low=1
          signal_count: number of distinct signals flagging this item
          ```

          **Separate into three queues:**

          1. **Taste calls** (need human judgment):
             - Tensions at taste-eligible layers (0-2)
             - Innovation classifications needing defense
             - Cross-signal conflicts
             - Maximum 5 per session

          2. **Validation reviews** (auto-drafted, need approval):
             - Gaps at validation layers (3-5)
             - Coherence fixes with obvious resolution
             - Maximum 10 per session

          3. **Staleness reviews** (need re-evaluation):
             - Decisions past review interval
             - Re-eval triggers met
             - Hedging language (unresolved decisions)

      - id: present-triage
        title: "Step 2: Present triage to user"
        instruction: |
          Present the aggregated findings organized by resolution type:

          ```markdown
          ## Calibration Summary: {target}

          **Signals processed:** Internal Coherence, External Calibration, Temporal Validity
          **Findings:** N taste calls, M validation items, K staleness reviews

          ### Taste Calls (need your judgment)
          | # | ID | Signals | Layer | Summary | Score |
          |---|---|---|---|---|---|

          ### Validation Items (auto-drafted fixes)
          | # | ID | Signal | Layer | Summary | Draft Fix |
          |---|---|---|---|---|---|

          ### Staleness Reviews
          | # | ID | Section | Age/Risk | Trigger |
          |---|---|---|---|---|
          ```

          ```
          AskUserQuestion(questions=[
            {question: "How should we proceed with the review?",
             header: "Scope",
             options: [
               {label: "Full review (Recommended)", description: "All taste calls + validation + staleness"},
               {label: "Taste calls only", description: "Just the items needing human judgment"},
               {label: "Specific items", description: "I'll pick which items to address"},
               {label: "Skip to reconciliation", description: "Accept all auto-drafted fixes, skip interview"}
             ], multiSelect: false}
          ])
          ```

          **SAVE to calibration-notes.md:**
          Append triage summary and scope decision.

          ```bash
          Mark task completed via TodoWrite (reason: "Triaged: N taste, M validation, K staleness. Scope: [choice]")
          ```

  # ─── PHASE 1.5: Taste Interview ───
  # The core human-in-the-loop phase. Each taste call becomes an AskUserQuestion.
  - id: p1.5
    name: Taste Interview
    task_config:
      title: "P1.5: Interview — taste calls, validation reviews, staleness as interactive questions"
      labels: [phase, phase-1-5, interview, taste]
      depends_on: [p1]
    todoActiveForm: "Conducting taste interview"
    steps:
      - id: taste-calls
        title: "Step 1: Taste calls — defended position interview"
        instruction: |
          **For each taste call in scope, present as an interactive interview.**
          Work through them one at a time, highest score first.

          ═══════════════════════════════════════════════════════════════
          ## TASTE CALL INTERVIEW PATTERN
          ═══════════════════════════════════════════════════════════════

          For each taste call, present ALL signal context, then ask for resolution.

          ---

          ### Category T: Tension Resolution

          Present the tension with full context from all signals that flagged it:

          **Internal coherence context:**
          "Layer N says X. Layer M says Y. These contradict because Z."

          **External calibration context:**
          "Industry norm is A. We do B. Competitors [list] handle this as C."

          **Temporal context (if applicable):**
          "This decision was made [date]. Since then, [landscape change]."

          ```
          AskUserQuestion(questions=[
            {question: "T-NNN: {tension_summary}. How do you resolve this?",
             header: "Resolve",
             options: [
               {label: "Refine principle", description: "The higher-layer doc needs updating to match reality"},
               {label: "Fix implementation", description: "The lower-layer doc/code drifted — bring it back in line"},
               {label: "Documented exception", description: "Both are correct — this is an intentional divergence"},
               {label: "Need more data", description: "Can't decide yet — add to backlog with re-eval trigger"}
             ], multiSelect: false}
          ])
          ```

          **For "Refine principle" or "Fix implementation":**
          ```
          AskUserQuestion(questions=[
            {question: "What should it say instead?",
             header: "Revision",
             options: [
               {label: "Draft it for me", description: "I'll review your proposed revision"},
               {label: "Let me write it", description: "I'll provide the new wording"},
               {label: "Discuss first", description: "Let's talk through the options"}
             ], multiSelect: false}
          ])
          ```

          **For "Documented exception":**
          ```
          AskUserQuestion(questions=[
            {question: "What's the defense for this exception?",
             header: "Defense",
             options: [
               {label: "I'll explain", description: "I'll provide the rationale"},
               {label: "Domain-specific", description: "Construction domain justifies the deviation"},
               {label: "Tradeoff accepted", description: "We know the cost, it's worth it"},
               {label: "Temporary", description: "Plan to resolve later, document when"}
             ], multiSelect: false}
          ])
          ```

          After user provides rationale, record the defended position:

          ```yaml
          # Record in calibration-notes.md
          decision_id: T-NNN
          summary: "{tension_summary}"
          resolution: "{refine|fix|exception|backlog}"
          defense: "{user's rationale}"
          tradeoffs_accepted: "{what we're giving up}"
          re_evaluate_when:
            - "{condition from user or inferred}"
          cascade_to: [list of docs/layers affected]
          ```

          ---

          ### Category I: Innovation Classification

          For each external deviation classified as needing defense:

          **Present the comparison:**
          "We do X. Industry does Y. This was classified as {classification}."

          ```
          AskUserQuestion(questions=[
            {question: "Innovation check: {decision}. Industry does {norm}. Is our approach...",
             header: "Classify",
             options: [
               {label: "True innovation", description: "We see something others don't — evidence: ..."},
               {label: "Intentional tradeoff", description: "We know it's different, here's why"},
               {label: "Should align", description: "We should adopt the industry pattern"},
               {label: "Inherited assumption", description: "Never questioned — let's evaluate now"}
             ], multiSelect: false}
          ])
          ```

          **For "True innovation" — require evidence:**
          ```
          AskUserQuestion(questions=[
            {question: "What evidence supports this being genuinely better for our context?",
             header: "Evidence",
             options: [
               {label: "Performance data", description: "Measurable improvement"},
               {label: "Domain fit", description: "Construction domain requires this approach"},
               {label: "User preference", description: "Users respond better to our way"},
               {label: "Architecture benefit", description: "Enables capabilities industry approach can't"}
             ], multiSelect: true}
          ])
          ```

          Record with innovation lifecycle position:
          ```yaml
          innovation_id: I-NNN
          decision: "{what we do differently}"
          industry_norm: "{what everyone else does}"
          classification: "{true_innovation|tradeoff|align|inherited}"
          lifecycle_position: "novel|leading|converging|standard|commodity"
          evidence: "{from user}"
          re_evaluate_when:
            - "{condition}"
          ```

          ---

          ### Category S: Staleness Review

          For each staleness item:

          **Present the temporal context:**
          "This decision was made {date}. It's been {age} since last validation.
          Since then: {world_changes}."

          ```
          AskUserQuestion(questions=[
            {question: "S-NNN: {decision} — {age} old. World changes: {changes}. Status?",
             header: "Staleness",
             options: [
               {label: "Still valid", description: "Reset validation timer, no changes needed"},
               {label: "Needs refinement", description: "Core idea holds but wording/scope should adjust"},
               {label: "Obsolete", description: "Landscape shifted enough to reconsider entirely"},
               {label: "Need more data", description: "Can't assess yet — schedule deeper review"}
             ], multiSelect: false}
          ])
          ```

          For "Still valid": reset `last_validated` to today.
          For "Needs refinement": ask what should change, record revision.
          For "Obsolete": escalate to a full taste call (becomes new T-NNN).

          ---

          ### Category V: Validation Review

          For each auto-drafted validation fix:

          Present the draft fix with context:
          "Gap found: {description}. Draft fix: {proposed_change}."

          ```
          AskUserQuestion(questions=[
            {question: "V-NNN: {gap_summary}. Draft fix: {draft}",
             header: "Validate",
             options: [
               {label: "Approve", description: "Apply the draft fix as-is"},
               {label: "Modify", description: "Good direction but needs adjustment"},
               {label: "Reject", description: "Not the right fix, or not a real problem"},
               {label: "Escalate to taste", description: "This is actually a taste call, not validation"}
             ], multiSelect: false}
          ])
          ```

          For "Escalate to taste": promote to T-NNN and run taste interview pattern.

          ---

          ## INTERVIEW EXECUTION RULES

          1. **One tension at a time.** Don't batch questions.
          2. **Highest score first.** Multi-signal items before single-signal.
          3. **Record everything.** Every answer → calibration-notes.md immediately.
          4. **Ask for defense.** "I like it" is not a defense. Push for "because X, accepting Y."
          5. **Track cascades.** Every resolution may create downstream work. Note it.
          6. **Don't lead.** Present the tension. Present the signals. Let the human resolve.
          7. **Reference external data.** Always cite what industry/competitors do.

          **SAVE to calibration-notes.md after EACH item:**
          ```markdown
          ### {T/I/S/V}-NNN: {summary}
          **Signals:** {list}
          **Resolution:** {choice}
          **Defense:** {user's rationale}
          **Cascade:** {affected docs/layers}
          **Re-evaluate when:** {conditions}
          ```

      - id: close-interview
        title: "Step 2: Close interview phase"
        instruction: |
          Summarize interview outcomes:

          ```markdown
          ## Interview Summary
          - Taste calls resolved: N (refine: X, fix: Y, exception: Z, backlog: W)
          - Innovation classifications: N (innovation: X, tradeoff: Y, align: Z)
          - Staleness reviews: N (valid: X, refine: Y, obsolete: Z)
          - Validation reviews: N (approved: X, modified: Y, rejected: Z, escalated: W)
          - Total cascades identified: N docs across M layers
          ```

          ```bash
          Mark task completed via TodoWrite (reason: "Interview: N taste, M innovation, K staleness, L validation resolved")
          ```

  # ─── GATE: Calibration Approval ───
  - id: p1.6
    name: Calibration Approval Gate
    gate: true
    task_config:
      title: "GATE: Calibration decisions approved by user"
      labels: [phase, gate, calibration-approval]
      depends_on: [p1.5]
    todoActiveForm: "Waiting for calibration approval"
    steps:
      - id: compile-decisions
        title: "Step 1: Compile all decisions"
        instruction: |
          Create a decision manifest from calibration-notes.md:

          ```markdown
          ## Calibration Decision Manifest

          ### Changes to Apply

          **Taste Calls (defended positions):**
          | ID | Resolution | Layer | Docs Affected | Cascade Scope |
          |---|---|---|---|---|

          **Validation Fixes:**
          | ID | Fix | Layer | Doc |
          |---|---|---|---|

          **Staleness Resets:**
          | ID | Decision | New Status | Timer Reset |
          |---|---|---|---|

          **Innovation Records:**
          | ID | Decision | Classification | Lifecycle Position |
          |---|---|---|---|

          ### No Action (confirmed aligned)
          | ID | What | Why No Change |
          |---|---|---|

          ### Backlogged (need more data)
          | ID | What | Re-eval Trigger |
          |---|---|---|

          **Total files to modify:** N
          **Cascade depth:** M layers
          ```

          Present to user for approval.

      - id: get-approval
        title: "Step 2: Get user approval"
        instruction: |
          ```
          AskUserQuestion(questions=[
            {question: "Approve these calibration decisions? Review the manifest above.",
             header: "Approve",
             options: [
               {label: "Approve all", description: "Proceed with all changes as listed"},
               {label: "Approve with exceptions", description: "I want to remove some items"},
               {label: "Revise", description: "Go back to interview for specific items"},
               {label: "Abort", description: "Discard all decisions, end session"}
             ], multiSelect: false}
          ])
          ```

          WAIT for explicit approval.
          Do NOT proceed until user approves.

          After approval:
          ```bash
          Mark task completed via TodoWrite (reason: "Calibration decisions approved")
          ```

  # ─── PHASE 2: User Signal Check ───
  # Signal 4 — check if user data exists that supports or contradicts decisions
  - id: p2
    name: "Signal: User Data Integration"
    task_config:
      title: "P2: User signal — check for empirical data supporting/contradicting decisions"
      labels: [phase, phase-2, signal-user]
      depends_on: [p1.6]
    todoActiveForm: "Checking user signals"
    steps:
      - id: check-user-signals
        title: "Step 1: Check for available user signal data"
        instruction: |
          User signal is the NEWEST signal — it may not have data yet. Check what's available:

          ```
          AskUserQuestion(questions=[
            {question: "Do you have user signal data relevant to these decisions?",
             header: "User Data",
             options: [
               {label: "No data yet", description: "Product not in use, or no feedback collected"},
               {label: "Support tickets", description: "I have relevant support patterns to share"},
               {label: "Usage analytics", description: "I have adoption/behavior data"},
               {label: "User feedback", description: "Direct feedback from interviews or surveys"}
             ], multiSelect: true}
          ])
          ```

          **If no data:** Note "Signal 4: No user data available" in calibration-notes.md.
          This is expected early in product development. The calibration engine tracks this gap.

          **If data available:** For each data point:
          - Does it confirm or contradict any taste call made in P1.5?
          - Does it reveal a gap not caught by other signals?
          - Should any approved decision be reconsidered?

          If user signal contradicts an approved taste call, flag it:
          ```
          AskUserQuestion(questions=[
            {question: "User data contradicts taste call {T-NNN}. User says {data}. Revise?",
             header: "Conflict",
             options: [
               {label: "Revise decision", description: "User data overrides — update the defended position"},
               {label: "Taste call stands", description: "I see the data but my judgment holds — update defense"},
               {label: "Need more data", description: "Not enough signal yet — revisit next cycle"}
             ], multiSelect: false}
          ])
          ```

          **SAVE to calibration-notes.md:**
          ```markdown
          ## Signal 4: User Signal
          **Data available:** {yes/no + types}
          **Confirmations:** {list of decisions user data supports}
          **Contradictions:** {list of conflicts and resolutions}
          **New gaps revealed:** {list}
          ```

          ```bash
          Mark task completed via TodoWrite (reason: "User signal: {data_available|no_data}")
          ```

  # ─── PHASE 3: Cascade Planning ───
  - id: p3
    name: Cascade Planning
    task_config:
      title: "P3: Plan cascading changes through all affected layers"
      labels: [phase, phase-3, cascade]
      depends_on: [p2]
    todoActiveForm: "Planning cascading changes"
    steps:
      - id: map-cascades
        title: "Step 1: Map all cascading changes"
        instruction: |
          For each approved decision, trace the cascade through the 6-layer stack:

          ```markdown
          ## Cascade Plan

          ### {T/V/S}-NNN: {decision}

          **Direction:** {downward: decision shapes implementation | upward: implementation challenges decision}

          | Layer | Doc/File | Change Type | Description |
          |---|---|---|---|
          | 0 Theory | docs/theory/X.md | Revise section | "..." |
          | 1 Primitives | docs/primitives/Y.md | Add wireframe | "..." |
          | 2 Modules | docs/modules/Z/MODULE.md | Update capability | "..." |
          | 3 Specs | planning/specs/NNN.md | Update requirement | "..." |
          | 4 Rules | .claude/rules/X.md | Update guidance | "..." |
          | 5 Code | apps/web/src/... | No change (future impl) | "..." |

          **Total files affected:** N
          **New cross-references needed:** M
          ```

          Repeat for each decision.

          **Present cascade scope:**
          ```
          AskUserQuestion(questions=[
            {question: "Cascade affects N files across M layers. Proceed with all changes?",
             header: "Cascade",
             options: [
               {label: "Full cascade (Recommended)", description: "Update all affected files for consistency"},
               {label: "Target doc only", description: "Only update the originally reviewed document"},
               {label: "Custom scope", description: "I'll specify which layers to update"}
             ], multiSelect: false}
          ])
          ```

          **SAVE cascade plan to calibration-notes.md.**

          ```bash
          Mark task completed via TodoWrite (reason: "Cascade plan: N files across M layers")
          ```

  # ─── PHASE 4: Reconciliation ───
  - id: p4
    name: Reconciliation (SPAWN AGENT)
    task_config:
      title: "P4: Reconciliation - SPAWN doc-updater (DO NOT write docs yourself)"
      labels: [phase, phase-4, reconciliation]
      depends_on: [p3]
    todoActiveForm: "SPAWNING reconciliation agent"
    steps:
      - id: read-notes
        title: "Step 1: Read calibration-notes.md for complete context"
        instruction: |
          Read the calibration-notes.md file for all decisions and cascade plan:
          ```bash
          cat .claude/sessions/$(cat .claude/current-session-id)/calibration-notes.md
          ```

          This contains all signal findings, interview Q&A, and cascade plan.

      - id: spawn-reconciliation-agent
        title: "Step 2: SPAWN reconciliation agent"
        instruction: |
          DO NOT update docs yourself. You are the orchestrator.
          SPAWN a reconciliation agent:

          ```
          Task(subagent_type="impl-agent", prompt="
          ROLE: Calibration Reconciliation Agent
          MODE: Documentation + Type Updates Only (NO feature code)

          ## Calibration Notes
          [Paste contents of calibration-notes.md]

          ---

          YOUR TASK:

          Apply all approved changes from the cascade plan.

          **FOR EACH TASTE CALL (defended position):**
          1. Update the target doc with the revised content
          2. Record the defended position in YAML format (as comment or metadata)
          3. Update cross-references in affected docs
          4. If cascade touches theory/primitives: follow their doc structure strictly

          **FOR EACH VALIDATION FIX:**
          1. Apply the approved fix
          2. Update any cross-references

          **FOR EACH STALENESS RESET:**
          1. Update last_validated dates
          2. Update re_evaluate_when conditions if revised

          **FOR EACH INNOVATION RECORD:**
          1. Add classification to relevant doc section
          2. Record lifecycle position

          **RULES:**
          - Follow existing doc style exactly (read other docs in same directory)
          - Theory docs: zero file paths, zero library names, zero component names
          - Primitives docs: zero library names, zero file paths (component structure OK)
          - Update Relationships sections in any doc you modify
          - If creating new cross-references, make them bidirectional
          - Run typecheck if any .ts files were modified

          RETURN: List of all files created or modified with summary of changes.
          ")
          ```

          Wait for agent to complete with TaskOutput.

      - id: verify-reconciliation
        title: "Step 3: Verify changes"
        instruction: |
          Quick verification:

          1. **Layer boundary check** — No theory docs with file paths? No primitives with library names?
          2. **Cross-references** — Bidirectional? Valid targets?
          3. **Defended positions** — Recorded with defense, tradeoffs, re-eval conditions?
          4. **Innovation records** — Classification + lifecycle position + evidence?
          5. **Consistency** — Did the cascade create new tensions? Quick scan.

          If new tensions found, note them for next calibration cycle.

          ```bash
          Mark task completed via TodoWrite (reason: "Reconciliation: X files modified, Y cross-refs updated")
          ```

  # ─── PHASE 5: Commit ───
  - id: p5
    name: Commit
    task_config:
      title: "P5: Commit calibration changes and push"
      labels: [phase, phase-5, commit]
      depends_on: [p4]
    todoActiveForm: "Committing calibration changes"
    steps:
      - id: commit-changes
        title: "Step 1: Commit changes"
        instruction: |
          Stage and commit all documentation changes:

          ```bash
          git add docs/ planning/ .claude/rules/  # Only layers that were actually modified
          git commit -m "docs(calibration): {target} — {N} taste calls, {M} validations

          Signals: internal coherence, external calibration, temporal validity{, user signal}
          Taste: {T-NNN list with one-line summaries}
          Validation: {V-NNN list}
          Staleness: {S-NNN list}
          Innovation: {I-NNN list}
          Cascade: {N} files across {M} layers

          Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
          ```

      - id: push-changes
        title: "Step 2: Push to remote"
        instruction: |
          ```bash
          git push
          ```

      - id: close-final
        title: "Step 3: Close session"
        instruction: |
          ```bash
          Mark task completed via TodoWrite (reason: "Committed: [hash]")
          ```

global_conditions:
  - changes_committed
  - changes_pushed

workflow_id_format: "CA-{session_last_4}-{MMDD}"
---

# Calibration Review Mode

## ORCHESTRATOR RULES - READ THIS FIRST

**YOU ARE AN ORCHESTRATOR. YOU COORDINATE WORK. YOU DO NOT DO DEEP WORK.**

### What You DO:
- Tasks are auto-created on mode entry (check with TaskList)
- SPAWN agents via `Task(subagent_type="...", ...)`
- Wait for agents with `TaskOutput`
- Ask user questions with `AskUserQuestion`
- Run CLI commands (`pnpm wm status`, etc.)
- Verify agent results (brief reads to confirm)
- **Append all findings and decisions to calibration-notes.md** (persists across compaction)

### What You DO NOT:
- Read source code to understand codebase (spawn Explore)
- Search codebase with Grep/Glob (spawn Explore)
- Write documentation content yourself (spawn impl-agent or spec-writer)
- Implement code changes (documentation/type-level changes only)

---

## The Five Signals

This mode processes five input signals against a 6-layer documentation stack:

| Signal | Source | Nature | Phase |
|---|---|---|---|
| **Taste** | Human leadership judgment | Subjective, irreplaceable | P1.5 (interview) |
| **Internal Coherence** | Cross-layer alignment checks | Mechanical, automatable | P0 (agents) |
| **External Calibration** | Industry comparison | LLM + web search | P0.1 (agent) |
| **User Signal** | Adoption, behavior, feedback | Empirical, lagging | P2 (interview) |
| **Temporal Validity** | Decision age, landscape shifts | Time-based | P0.1 (agent) |

**Taste is first among equals.** When signals conflict, a defended taste call resolves it. But taste without other signals checking it is just opinion.

---

## The Six Layers

| Layer | Location | Contains | Taste-Eligible? |
|---|---|---|---|
| 0 Theory | `docs/theory/` | Principles, constraints | Yes |
| 1 Primitives | `docs/primitives/` | Wireframes, conventions | Yes |
| 2 Modules | `docs/modules/` | Module capabilities, behaviors | Boundary |
| 3 Specs | `planning/specs/` | Feature requirements | No |
| 4 Rules | `.claude/rules/` | Code-writing guidance | No |
| 5 Code | `apps/`, `packages/` | Implementation | No |

**Alignment questions at each boundary:**
- 0↔1: "Do primitives faithfully express principles?"
- 1↔2: "Do modules follow primitive shapes?"
- 2↔3: "Do specs implement module capabilities?"
- 3↔4: "Do rules support what specs require?"
- 4↔5: "Does code follow rules?"

---

## Context Management

**CRITICAL: Research is split into sequential batches to prevent context overload.**

| Batch | Phase | Agents | Signals |
|---|---|---|---|
| 1 | P0 | vertical-alignment + horizontal-consistency | Internal Coherence |
| 2 | P0.1 | external-calibration + temporal-validity | External + Temporal |
| 3 | P1.5 | (interactive — no agents) | Taste |
| 4 | P2 | (interactive — no agents) | User Signal |

**Rules:**
- Never spawn more than 2 agents at once
- After each batch, save results to calibration-notes.md BEFORE proceeding
- Tell agents to keep responses under 100 lines (summarize, don't dump)
- If context is getting large, save to file and move on

---

## Interview Context Persistence

**CRITICAL: Save all findings and decisions to calibration-notes.md throughout the workflow!**

This file survives context compaction and will be injected on session continuation.

**After P0 (Coherence):** Save vertical + horizontal alignment findings.
**After P0.1 (External + Temporal):** Save industry comparison + staleness assessment.
**After P1 (Triage):** Save aggregated tension list and scope decision.
**After each P1.5 item:** Save the resolution, defense, and cascade notes.
**After P2 (User Signal):** Save any user data and conflict resolutions.
**After P3 (Cascade):** Save the full cascade plan.

The calibration-notes.md file is automatically:
- Created when you enter this mode
- Copied to new session on compaction
- Injected into context on continuation

---

## Phase Summary

| # | Phase | Action | Signal | Tool |
|---|---|---|---|---|
| 0 | coherence | **SPAWN** 2 agents (vertical + horizontal) | Internal Coherence | `Task(Explore)` x 2 |
| 0.1 | external + temporal | **SPAWN** 2 agents (industry + staleness) | External + Temporal | `Task(general-purpose)` + `Task(Explore)` |
| 1 | triage | Aggregate, score, separate taste vs validation | (all) | Orchestrator |
| 1.5 | interview | Per-item taste calls, innovation, staleness, validation | Taste | `AskUserQuestion` |
| | approved | **GATE** | | (wait for approval) |
| 2 | user signal | Check for empirical data | User Signal | `AskUserQuestion` |
| 3 | cascade | Plan changes through all layers | | Orchestrator |
| 4 | reconciliation | **SPAWN** doc-updater agent | | `Task(impl-agent)` |
| 5 | commit | Commit + push | | git commands |

---

## Interview Categories Quick Reference

| Category | Name | When | Minimum Questions |
|---|---|---|---|
| **T** | Tension Resolution | Cross-layer misalignment at taste layers | 2-4 per tension |
| **I** | Innovation Classification | External deviation needing defense | 2-3 per deviation |
| **S** | Staleness Review | Decision past re-eval interval | 1-2 per item |
| **V** | Validation Review | Auto-drafted fix at validation layers | 1 per item |
| **U** | User Signal Conflict | User data contradicts a decision | 2-3 per conflict |

**Key principle:** Every taste call must produce a **defended position** — not just "I like it" but "I chose X because Y, accepting tradeoff Z, revisit if W."

---

## Defended Position Format

Every taste call resolution produces this record:

```yaml
decision_id: T-NNN
summary: "..."
decided_at: YYYY-MM-DD
decided_by: [human]
resolution: refine | fix | exception | backlog

defense: |
  Why this choice was made, what evidence supports it,
  what alternatives were considered and rejected.

tradeoffs_accepted: |
  What we're giving up. What risks we're carrying.

re_evaluate_when:
  - "Condition that should trigger re-review"
  - "Another trigger condition"

validation_interval: 90d
cascade_to:
  - "docs/theory/X.md"
  - "docs/primitives/Y.md"
```

---

## Innovation Classification

When external calibration reveals a deviation from industry norms:

| Classification | Meaning | Test |
|---|---|---|
| **True Innovation** | We see something others don't | Evidence of better outcomes for our context |
| **Intentional Tradeoff** | Different for good reasons | Known cost, accepted consciously |
| **Should Align** | No reason to differ | Adopt the industry pattern |
| **Inherited Assumption** | Never questioned | No deliberate decision on record |

**Lifecycle tracking:** Novel → Leading → Converging → Standard → Commodity

---

## Relationship to Doctrine Mode

| Aspect | Doctrine Mode | Calibration Mode |
|---|---|---|
| **Target** | Single doc in single layer | Any artifact, checks ALL layers |
| **Signals** | Code alignment + cross-doc | All 5 signals (coherence, external, taste, user, temporal) |
| **Interview style** | Per-section, categories A-Z | Per-tension, signal-driven |
| **Output** | Updated doc | Defended positions + cascade across layers |
| **Best for** | Deep work on one theory/primitive doc | Cross-cutting review of spec, module, or decision |

Use **Doctrine** when going deep on a single doc. Use **Calibration** when reviewing a spec or decision that touches multiple layers.

---

## Commands

```bash
pnpm wm status                              # Check current mode and phase
pnpm wm can-exit                            # Check stop conditions
```
