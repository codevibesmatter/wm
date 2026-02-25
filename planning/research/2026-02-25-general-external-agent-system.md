---
date: 2026-02-25
topic: Generalizing LLM judge into a pluggable external agent system
status: complete
github_issue: null
---

# Research: General External Agent System

## Context

The eval harness has an LLM judge system (`eval/judge.ts`) that feeds transcripts + templates through a provider (Claude/Gemini/Codex) for structured audit. The provider layer (`src/providers/`) is already generic (prompt-in, text-out), but the judge logic is coupled to eval-specific concerns. This research explores how to generalize it into an external agent system pluggable at any workflow step.

## Questions Explored

1. What parts of the judge are eval-specific vs general-purpose?
2. What template/phase extension points could host external agent steps?
3. What config surfaces are available for declaring agent steps?
4. What UX/DX improvements would make this convenient?

## Findings

### Codebase: What's Already General-Purpose

The provider layer is **fully decoupled** from eval and reusable today:

| Component | File | Coupling |
|-----------|------|----------|
| `AgentProvider` interface | `src/providers/types.ts` | None — generic prompt→text |
| Claude provider | `src/providers/claude.ts` | None — uses Agent SDK `query()` |
| Gemini provider | `src/providers/gemini.ts` | None — spawns `gemini` CLI |
| Codex provider | `src/providers/codex.ts` | None — spawns `codex exec` CLI |
| Provider registry | `src/providers/index.ts` | None — `getProvider(name)` factory |
| Prompt helpers | `src/providers/prompt.ts` | None — large-prompt temp file handling |
| Saved prompts | `src/providers/prompts/*.md` | None — named templates loadable by any caller |
| wm.yaml `providers:` | `src/config/wm-config.ts` | None — project-level provider config |

### Codebase: What's Eval-Specific (Needs Generalization)

| Component | File | Eval Coupling |
|-----------|------|---------------|
| `judgeTranscript()` | `eval/judge.ts` | Hardcoded transcript summarization for SDK events |
| `buildJudgePrompt()` | `eval/judge.ts` | Embeds transcript-review.md specifically |
| `summarizeTranscript()` | `eval/judge.ts` | JSONL parsing for Agent SDK message format |
| `JudgeResult` type | `eval/judge.ts` | `agentScore`/`systemScore`/`verdict` fields |
| `saveJudgeArtifact()` | `eval/judge.ts` | Writes to `eval-reviews/` with scenario naming |
| Score extraction | `eval/judge.ts` | Regex for `AGENT_SCORE: N/100` format |
| CLI `--judge` flag | `eval/run.ts` | Only accessible via eval runner |

### Codebase: Template/Phase Extension Points

The step schema (`src/validation/schemas.ts`) is the natural insertion point:

```typescript
// Current step schema
phaseStepSchema = z.object({
  id: z.string(),
  title: z.string(),
  instruction: z.string().optional(),  // free-form markdown
})
```

Steps already:
- Create one native task each via `buildPhaseTasks()`
- Carry `instruction` fields that agents read and execute
- Support dependency chains (blocked tasks can't start)
- Support interviews via `AskUserQuestion()` in instructions
- Support subagent spawning via `Task()` in instructions

### Codebase: Four Config Surfaces

All support 3-tier merging (package -> user -> project):

1. **`modes.yaml`** — mode behavior fields (stop_conditions, issue_handling, etc.)
2. **Template frontmatter** — phase/step structure with instructions
3. **`wm.yaml`** — project config including `providers:` section
4. **`interviews.yaml`** — structured Q&A categories (mergeable per-category)

### Codebase: Existing Provider Spec (#10)

`planning/specs/10-pluggable-llm-judge.md` already describes the provider interface, CLI adapters, prompt system, and wm.yaml integration. The providers are implemented and working for judge use cases.

## Recommendations

### Option A: Template-Native Agent Steps (Recommended)

Add an `agent` field to the step schema so template authors can declaratively invoke external agents at any workflow step:

```yaml
phases:
  - id: p3
    name: "External Review"
    steps:
      - id: code-review
        title: "Code review via Gemini"
        agent:
          provider: gemini              # or "claude", "codex", "${providers.default}"
          model: gemini-2.5-pro         # optional model override
          prompt: code-review           # loads src/providers/prompts/code-review.md
          context:                      # named context sources to assemble
            - git_diff                  # git diff against base branch
            - template                  # the mode template markdown
            - session_notes             # planning-notes.md etc.
            - spec                      # spec file if in implementation mode
          output: reviews/{date}-code-review.md
          gate: true                    # blocks next step until score >= threshold
          threshold: 75
```

| Aspect | Fit |
|--------|-----|
| Data-driven (no hardcoded mode names) | Excellent — follows core design principle |
| Uses existing infrastructure | Excellent — providers, prompts, task factory all exist |
| Template-author accessible | Excellent — YAML only, no code changes |
| Eval judge becomes one specialization | Good — judge.ts refactored to use step runner |

### Option B: Hook-Based Agent Gate

Register a new PreToolUse hook (`kata hook agent-gate`) that intercepts TaskUpdate completion and auto-runs an external agent review before allowing the task to complete.

| Aspect | Fit |
|--------|-----|
| No schema changes needed | Good |
| Harder to configure per-step | Poor — hook config is global, not step-specific |
| Less visible to template authors | Poor |

### Option C: CLI-Only (`kata review`)

Add `kata review` command for ad-hoc agent invocation outside templates.

| Aspect | Fit |
|--------|-----|
| Simple to build | Good |
| No workflow integration | Poor — doesn't compose with phases |
| Good as a complement to Option A | Good |

**Recommendation: Option A (primary) + Option C (complement)**

### Implementation Sketch

#### New Schema Addition

```typescript
// src/validation/schemas.ts
export const agentStepConfigSchema = z.object({
  provider: z.string(),                          // provider name or "${providers.default}"
  model: z.string().optional(),                   // model override
  prompt: z.string(),                             // prompt template name
  context: z.array(z.string()).optional(),        // named context sources
  output: z.string().optional(),                  // output artifact path
  gate: z.boolean().optional(),                   // block next step on failure
  threshold: z.number().min(0).max(100).optional(), // score threshold for gate
})

export const phaseStepSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  instruction: z.string().optional(),
  agent: agentStepConfigSchema.optional(),        // NEW: external agent config
})
```

#### New Step Runner

```typescript
// src/providers/step-runner.ts
export interface StepRunResult {
  output: string          // raw agent output
  score?: number          // extracted score if prompt requires one
  passed: boolean         // true if score >= threshold or no gate
  artifactPath?: string   // where output was saved
  provider: string
  model?: string
}

export async function runAgentStep(
  config: AgentStepConfig,
  context: StepContext,
): Promise<StepRunResult> {
  // 1. Load prompt template from src/providers/prompts/{config.prompt}.md
  // 2. Assemble context from named sources (git_diff, template, notes, spec)
  // 3. Build final prompt: template + assembled context
  // 4. Call getProvider(config.provider).run(prompt, options)
  // 5. Extract score if gate enabled
  // 6. Save artifact to config.output path
  // 7. Return result
}
```

#### Context Sources

| Source Name | What It Provides | Assembly |
|-------------|-----------------|----------|
| `git_diff` | `git diff ${diff_base}...HEAD` | Run git command, embed output |
| `template` | Mode template markdown | Read from session state templatePath |
| `session_notes` | `{mode}-notes.md` content | Read from session dir |
| `spec` | Spec file content | Read from `spec_path` in wm.yaml |
| `transcript` | Summarized session transcript | Reuse existing summarizeTranscript() |
| `file:{path}` | Arbitrary file content | Read and embed |

#### Task Factory Integration

In `buildPhaseTasks()`, detect steps with `agent` config and:
1. Set task description to explain the agent step
2. Add metadata: `{ agentStep: true, agentConfig: {...} }`
3. The agent (or a hook) can check metadata and auto-run the provider

#### UX/DX Improvements

1. **Provider switching**: `provider: "${providers.code_reviewer}"` reads from wm.yaml
2. **Ad-hoc CLI**: `kata review --provider=gemini --prompt=code-review` for one-off use
3. **Gating**: Agent review as blocking gate via threshold in step config
4. **Provenance**: Every artifact includes `{ provider, model, timestamp, prompt_name }`
5. **Multi-provider**: Future — `provider: [claude, gemini]` runs both, shows comparison
6. **Dry run**: `kata review --dry-run` shows assembled prompt without calling provider

## Open Questions

- Should agent steps auto-run when task enters `in_progress`, or should the agent explicitly invoke them? (Auto-run via hook is cleaner but less transparent)
- Should multi-provider comparison be in scope for v1 or deferred?
- How to handle provider failures gracefully — retry? skip? block?
- Should prompt templates support Handlebars-style variables or stay with simple string replacement?

## Next Steps

1. Create spec for the general external agent system (planning mode)
2. Phase 1: Schema addition + step runner + context assembly
3. Phase 2: Task factory integration + hook enforcement
4. Phase 3: CLI convenience (`kata review`) + eval judge refactor to use step runner
