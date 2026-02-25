/**
 * LLM-as-judge for eval transcripts.
 *
 * Delegates to `runAgentStep` for provider invocation, env cleaning, and
 * prompt loading. Judge-specific concerns (JSONL transcript summarization,
 * dual-score extraction, verdict logic, scenario-named artifacts) remain here.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runAgentStep } from '../src/providers/step-runner.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── Types ───────────────────────────────────────────────────────────────────

export type Verdict = 'PASS' | 'FAIL_AGENT' | 'FAIL_SYSTEM' | 'FAIL_BOTH'

export interface JudgeResult {
  agentScore: number
  systemScore: number
  verdict: Verdict
  review: string
  provider?: string
  model?: string
}

export interface JudgeOptions {
  transcriptPath: string
  templatePath: string
  enterOutput?: string
  maxTranscriptLines?: number
  /** Provider name (default: 'claude') */
  providerName?: string
  /** Override model for the provider */
  model?: string
}

// ─── Transcript Summarization ───────────────────────────────────────────────

function summarizeTranscript(transcriptPath: string, maxLines: number): string {
  if (!existsSync(transcriptPath)) {
    return '[No transcript file found]'
  }

  const raw = readFileSync(transcriptPath, 'utf-8')
  const lines = raw.trim().split('\n').filter(Boolean)
  const events: string[] = []

  for (const line of lines) {
    try {
      const event = JSON.parse(line)

      if (event.type === 'assistant' && event.message?.content) {
        for (const block of event.message.content) {
          if (block.type === 'text' && block.text) {
            events.push(`[assistant] ${block.text.slice(0, 500)}`)
          } else if (block.type === 'tool_use') {
            const inputStr = JSON.stringify(block.input ?? {}).slice(0, 300)
            events.push(`[tool_call] ${block.name}(${inputStr})`)
          }
        }
      } else if (event.type === 'user' && event.message?.content) {
        for (const block of event.message.content as Array<{ type: string; content?: unknown }>) {
          if (block.type === 'tool_result') {
            const text =
              typeof block.content === 'string'
                ? block.content.slice(0, 200)
                : Array.isArray(block.content)
                  ? (block.content as Array<{ text?: string }>)
                      .map((c) => c.text ?? '')
                      .join('')
                      .slice(0, 200)
                  : ''
            if (text) events.push(`[tool_result] ${text}`)
          }
        }
      }
    } catch {
      // Skip malformed lines
    }

    if (events.length >= maxLines) break
  }

  return events.join('\n')
}

// ─── Context Assembly ───────────────────────────────────────────────────────

function buildJudgeContext(options: JudgeOptions): string {
  const transcript = summarizeTranscript(
    options.transcriptPath,
    options.maxTranscriptLines ?? 500,
  )
  const enterOutput = options.enterOutput ?? '[No enter output captured]'

  return `## Enter Output (what the agent was told on mode entry)

\`\`\`
${enterOutput}
\`\`\`

## Session Transcript

\`\`\`
${transcript}
\`\`\`

Now audit this session against the pipeline. Write your analysis, then end with exactly these three lines:

AGENT_SCORE: {number}/100
SYSTEM_SCORE: {number}/100
VERDICT: {PASS|FAIL_AGENT|FAIL_SYSTEM|FAIL_BOTH}`
}

// ─── Response Parsing (minimal) ──────────────────────────────────────────────

export function extractScore(text: string, label: string): number {
  const match = text.match(new RegExp(`${label}:\\s*(\\d+)/100`))
  return match ? parseInt(match[1], 10) : 0
}

export function extractVerdict(text: string): Verdict {
  const match = text.match(/VERDICT:\s*(PASS|FAIL_AGENT|FAIL_SYSTEM|FAIL_BOTH)/)
  if (match) return match[1] as Verdict

  const agent = extractScore(text, 'AGENT_SCORE')
  const system = extractScore(text, 'SYSTEM_SCORE')
  if (agent >= 75 && system >= 75) return 'PASS'
  if (agent < 75 && system < 75) return 'FAIL_BOTH'
  if (system < 75) return 'FAIL_SYSTEM'
  return 'FAIL_AGENT'
}

// ─── Judge Execution ─────────────────────────────────────────────────────────

export async function judgeTranscript(options: JudgeOptions): Promise<JudgeResult> {
  const providerName = options.providerName ?? 'claude'

  const result = await runAgentStep(
    {
      provider: providerName,
      prompt: 'transcript-review',
      context: ['template'],
      model: options.model,
    },
    {
      cwd: dirname(options.transcriptPath),
      templatePath: options.templatePath,
      extraContext: buildJudgeContext(options),
    },
  )

  return {
    agentScore: extractScore(result.output, 'AGENT_SCORE'),
    systemScore: extractScore(result.output, 'SYSTEM_SCORE'),
    verdict: extractVerdict(result.output),
    review: result.output,
    provider: result.provider,
    model: result.model,
  }
}

// ─── Artifact ────────────────────────────────────────────────────────────────

export function saveJudgeArtifact(
  result: JudgeResult,
  options: JudgeOptions & { scenarioId: string; outputDir?: string },
): string {
  const outputDir = options.outputDir ?? join(__dirname, '..', 'eval-reviews')
  mkdirSync(outputDir, { recursive: true })

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)

  // Review as readable markdown
  const mdPath = join(outputDir, `${options.scenarioId}-${ts}.md`)
  writeFileSync(mdPath, result.review + '\n')

  // Structured summary as JSON (additive — provider/model fields added)
  const jsonPath = join(outputDir, `${options.scenarioId}-${ts}.json`)
  writeFileSync(jsonPath, JSON.stringify({
    scenarioId: options.scenarioId,
    agentScore: result.agentScore,
    systemScore: result.systemScore,
    verdict: result.verdict,
    provider: result.provider,
    model: result.model,
    judgedAt: new Date().toISOString(),
    transcriptPath: options.transcriptPath,
    templatePath: options.templatePath,
    reviewPath: mdPath,
  }, null, 2) + '\n')

  return mdPath
}
