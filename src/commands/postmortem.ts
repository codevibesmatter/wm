/**
 * kata postmortem — Post-mortem analysis of past workflow sessions.
 *
 * Usage:
 *   kata postmortem                            # list all sessions in project
 *   kata postmortem <session-id|prefix>        # full postmortem for session
 *   kata postmortem --last                     # postmortem for most recent session
 *   kata postmortem --last --judge             # + LLM judge on eval transcript
 *   kata postmortem --last --judge=gemini      # specific judge provider
 *   kata postmortem --project=/path/to/proj   # sessions from another project
 *   kata postmortem --transcript=<path> --judge  # judge a specific transcript
 *   kata postmortem --list-transcripts         # list available eval transcripts
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'
import { homedir } from 'node:os'
import { findProjectDir, getSessionsDir } from '../session/lookup.js'
import { readState } from '../state/reader.js'
import type { SessionState } from '../state/schema.js'
import { runAgentStep } from '../providers/step-runner.js'

// ─── Types ───────────────────────────────────────────────────────────────────

interface SessionEntry {
  id: string
  stateFile: string
  sessionDir: string
  mtimeMs: number
}

interface HookEvent {
  hook: string
  decision: string
  tool?: string
  task?: string
  ts?: string
  reasons?: string[]
  [key: string]: unknown
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SESSION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function scanSessions(projectDir: string): SessionEntry[] {
  const sessionsDir = getSessionsDir(projectDir)
  if (!existsSync(sessionsDir)) return []

  const entries: SessionEntry[] = []
  for (const e of readdirSync(sessionsDir, { withFileTypes: true })) {
    if (!e.isDirectory() || !SESSION_ID_RE.test(e.name)) continue
    const sessionDir = join(sessionsDir, e.name)
    const stateFile = join(sessionDir, 'state.json')
    if (!existsSync(stateFile)) continue
    try {
      const { mtimeMs } = statSync(stateFile)
      entries.push({ id: e.name, stateFile, sessionDir, mtimeMs })
    } catch {
      // skip unreadable dirs
    }
  }
  return entries.sort((a, b) => b.mtimeMs - a.mtimeMs)
}

function readHookLog(sessionDir: string, filename: string): HookEvent[] {
  const logPath = join(sessionDir, filename)
  if (!existsSync(logPath)) return []
  try {
    const raw = readFileSync(logPath, 'utf-8')
    return raw
      .trim()
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line) as HookEvent)
  } catch {
    return []
  }
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

function shortDate(iso: string | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Resolve path to Claude Code's native conversation transcript for a session.
 * CC stores transcripts at: ~/.claude/projects/{escaped-project-path}/{session-id}.jsonl
 * Path escaping: leading '/' dropped, remaining '/' replaced with '-'.
 */
function ccTranscriptPath(projectDir: string, sessionId: string): string {
  const escaped = projectDir.split(sep).join('-')
  return join(homedir(), '.claude', 'projects', escaped, `${sessionId}.jsonl`)
}

/**
 * Summarize a CC native or eval-SDK transcript into compact event lines.
 * Both formats share message.content arrays — only the outer envelope differs.
 */
function summarizeTranscriptFile(transcriptPath: string, maxEvents = 150): string {
  const raw = readFileSync(transcriptPath, 'utf-8')
  const lines = raw.trim().split('\n').filter(Boolean)
  const events: string[] = []

  for (const line of lines) {
    if (events.length >= maxEvents) break
    try {
      const event = JSON.parse(line) as Record<string, unknown>
      const type = event.type as string | undefined
      const msg = event.message as { role?: string; content?: unknown[] } | undefined

      // Resolve content array from either format
      const content: unknown[] | undefined =
        Array.isArray(msg?.content) ? msg!.content :
        Array.isArray(event.content) ? event.content as unknown[] :
        undefined

      if ((type === 'assistant' || msg?.role === 'assistant') && content) {
        for (const block of content) {
          const b = block as Record<string, unknown>
          if (b.type === 'text' && typeof b.text === 'string') {
            events.push(`[assistant] ${b.text.slice(0, 400)}`)
          } else if (b.type === 'tool_use' && typeof b.name === 'string') {
            const input = JSON.stringify(b.input ?? {}).slice(0, 200)
            events.push(`[tool_use] ${b.name}(${input})`)
          }
        }
      } else if ((type === 'user' || msg?.role === 'user') && content) {
        for (const block of content) {
          const b = block as Record<string, unknown>
          if (b.type === 'tool_result') {
            const resultText = typeof b.content === 'string' ? b.content :
              Array.isArray(b.content) ? (b.content[0] as Record<string, unknown>)?.text as string ?? '' : ''
            events.push(`[tool_result] ${resultText.slice(0, 200)}`)
          } else if (b.type === 'text' && typeof b.text === 'string') {
            events.push(`[user] ${b.text.slice(0, 300)}`)
          }
        }
      }
    } catch {
      // skip malformed lines
    }
  }

  return events.join('\n') || '[empty transcript]'
}

function extractScore(text: string, label: string): number {
  // Match both "AGENT_SCORE: X/100" and "**Agent Score: X/100**" formats
  const normalized = label.replace(/_/g, ' ')
  const pattern = new RegExp(`(?:${label}|\\*{0,2}${normalized}\\*{0,2}):\\s*(\\d+)/100`, 'i')
  const match = text.match(pattern)
  return match ? parseInt(match[1], 10) : 0
}

// ─── List Mode ───────────────────────────────────────────────────────────────

async function listSessions(projectDir: string): Promise<void> {
  const sessions = scanSessions(projectDir)

  if (sessions.length === 0) {
    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.log('No sessions found in this project.')
    return
  }

  // biome-ignore lint/suspicious/noConsole: intentional CLI output
  console.log(`Sessions in ${projectDir}\n`)
  // biome-ignore lint/suspicious/noConsole: intentional CLI output
  console.log(
    `${'SESSION'.padEnd(10)} ${'WORKFLOW'.padEnd(18)} ${'MODE'.padEnd(14)} ${'PHASES'.padEnd(14)} UPDATED`,
  )
  // biome-ignore lint/suspicious/noConsole: intentional CLI output
  console.log('─'.repeat(80))

  for (const s of sessions) {
    let state: SessionState | null = null
    try {
      state = await readState(s.stateFile)
    } catch {
      // state unreadable — show partial info
    }
    const shortId = s.id.slice(0, 8)
    const workflowId = (state?.workflowId ?? '—').slice(0, 17)
    const mode = (state?.currentMode ?? '—').slice(0, 13)
    const completedPhases = state?.completedPhases ?? []
    const currentPhase = state?.currentPhase
    const phases =
      completedPhases.length > 0
        ? completedPhases.join(',') + (currentPhase ? `+${currentPhase}` : '')
        : currentPhase ?? '—'
    const updated = shortDate(state?.updatedAt)

    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.log(
      `${shortId.padEnd(10)} ${workflowId.padEnd(18)} ${mode.padEnd(14)} ${phases.slice(0, 13).padEnd(14)} ${updated}`,
    )
  }

  // biome-ignore lint/suspicious/noConsole: intentional CLI output
  console.log(`\n${sessions.length} session(s). Run: kata postmortem <session-id> for details.`)
}

// ─── Detail Mode ─────────────────────────────────────────────────────────────

async function sessionPostmortem(
  sessionId: string,
  projectDir: string,
  opts: { judge?: string; transcript?: string },
): Promise<void> {
  const sessions = scanSessions(projectDir)
  const match = sessions.find(s => s.id === sessionId || s.id.startsWith(sessionId))

  if (!match) {
    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.error(`No session found matching: ${sessionId}`)
    process.exitCode = 1
    return
  }

  let state: SessionState
  try {
    state = await readState(match.stateFile)
  } catch (e) {
    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.error(`Failed to read session state: ${e}`)
    process.exitCode = 1
    return
  }

  const fullId = match.id
  const line = '═'.repeat(70)

  // ─── Header ─────────────────────────────────────────────────────────────
  // biome-ignore lint/suspicious/noConsole: intentional CLI output
  console.log(`\n${line}`)
  // biome-ignore lint/suspicious/noConsole: intentional CLI output
  console.log(`POST-MORTEM: ${state.workflowId ?? fullId}`)
  // biome-ignore lint/suspicious/noConsole: intentional CLI output
  console.log(line)
  // biome-ignore lint/suspicious/noConsole: intentional CLI output
  console.log(`Session:  ${fullId}`)
  // biome-ignore lint/suspicious/noConsole: intentional CLI output
  console.log(`Mode:     ${state.currentMode ?? '—'}`)
  // biome-ignore lint/suspicious/noConsole: intentional CLI output
  console.log(`Phase:    ${state.currentPhase ?? 'none (completed or not started)'}`)

  const completedPhases = state.completedPhases ?? []
  if (completedPhases.length > 0) {
    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.log(`Completed phases: ${completedPhases.join(' → ')}`)
  }
  if (state.issueNumber) {
    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.log(`Issue:    #${state.issueNumber}`)
  }

  const startedAt = state.startedAt
  const updatedAt = state.updatedAt ?? state.workflowCompletedAt
  if (startedAt) {
    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.log(`Started:  ${shortDate(startedAt)}`)
  }
  if (updatedAt) {
    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.log(`Updated:  ${shortDate(updatedAt)}`)
  }
  if (startedAt && updatedAt) {
    const ms = new Date(updatedAt).getTime() - new Date(startedAt).getTime()
    if (ms > 0) {
      // biome-ignore lint/suspicious/noConsole: intentional CLI output
      console.log(`Duration: ${formatDuration(ms)}`)
    }
  }

  // ─── Mode History ───────────────────────────────────────────────────────
  const modeHistory = state.modeHistory ?? []
  if (modeHistory.length > 0) {
    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.log(`\n── MODE HISTORY ${'─'.repeat(54)}`)
    for (const entry of modeHistory) {
      if (typeof entry === 'string') {
        // biome-ignore lint/suspicious/noConsole: intentional CLI output
        console.log(`  ${entry}`)
      } else {
        const e = entry as { mode: string; enteredAt?: string; exitedAt?: string }
        const at = shortDate(e.enteredAt)
        const exited = e.exitedAt ? ` → exited ${shortDate(e.exitedAt)}` : ' (active)'
        // biome-ignore lint/suspicious/noConsole: intentional CLI output
        console.log(`  ${e.mode.padEnd(16)} entered ${at}${exited}`)
      }
    }
  }

  // ─── Hook Summary ───────────────────────────────────────────────────────
  const hookEvents = readHookLog(match.sessionDir, 'hooks.log.jsonl')
  if (hookEvents.length > 0) {
    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.log(`\n── HOOK EVENTS (${hookEvents.length} total) ${'─'.repeat(47 - String(hookEvents.length).length)}`)

    const counts = new Map<string, number>()
    for (const e of hookEvents) {
      const key = `${e.hook}:${e.decision}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }

    for (const [key, count] of [...counts.entries()].sort()) {
      const [hook, decision] = key.split(':')
      const flag = decision === 'deny' || decision === 'block' ? '  ⚠' : ''
      // biome-ignore lint/suspicious/noConsole: intentional CLI output
      console.log(`  ${(hook ?? '').padEnd(22)} ${(decision ?? '').padEnd(10)} ×${count}${flag}`)
    }

    // Highlight mode-gate denials by tool
    const denials = hookEvents.filter(e => e.hook === 'mode-gate' && e.decision === 'deny')
    if (denials.length > 0) {
      const toolCounts = new Map<string, number>()
      for (const d of denials) {
        const tool = d.tool ?? 'unknown'
        toolCounts.set(tool, (toolCounts.get(tool) ?? 0) + 1)
      }
      // biome-ignore lint/suspicious/noConsole: intentional CLI output
      console.log(`\n  Mode-gate denials by tool:`)
      for (const [tool, count] of [...toolCounts.entries()].sort((a, b) => b[1] - a[1])) {
        // biome-ignore lint/suspicious/noConsole: intentional CLI output
        console.log(`    ${tool}: ${count}×`)
      }
    }
  }

  // ─── Stop Conditions ────────────────────────────────────────────────────
  const stopEvents = readHookLog(match.sessionDir, 'stop-hook.log.jsonl')
  if (stopEvents.length > 0) {
    const blocked = stopEvents.filter(e => e.decision === 'block')
    const allowed = stopEvents.filter(e => e.decision !== 'block')
    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.log(
      `\n── STOP CONDITIONS (${stopEvents.length} checks: ${blocked.length} blocked, ${allowed.length} allowed) ${'─'.repeat(Math.max(0, 22 - String(stopEvents.length).length))}`,
    )

    // Show unique block reasons (last block event is most informative)
    const lastBlock = blocked.at(-1)
    if (lastBlock && Array.isArray(lastBlock.reasons)) {
      // biome-ignore lint/suspicious/noConsole: intentional CLI output
      console.log(`  Last block reasons:`)
      for (const r of lastBlock.reasons as string[]) {
        // biome-ignore lint/suspicious/noConsole: intentional CLI output
        console.log(`    — ${r}`)
      }
    }
    if (allowed.length > 0) {
      const lastAllow = allowed.at(-1)
      const ts = lastAllow?.ts ? ` (${shortDate(lastAllow.ts)})` : ''
      // biome-ignore lint/suspicious/noConsole: intentional CLI output
      console.log(`  Last allowed exit${ts}`)
    }
  }

  // ─── Transcript Info ────────────────────────────────────────────────────
  const ccPath = ccTranscriptPath(projectDir, fullId)
  if (existsSync(ccPath)) {
    const size = Math.round(statSync(ccPath).size / 1024)
    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.log(`\n── TRANSCRIPT ${'─'.repeat(56)}`)
    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.log(`  CC transcript: ${ccPath} (${size}KB)`)
  }

  // ─── LLM Judge ──────────────────────────────────────────────────────────
  if (opts.judge !== undefined) {
    await runJudge(fullId, projectDir, state, opts.judge, opts.transcript)
  }

  // biome-ignore lint/suspicious/noConsole: intentional CLI output
  console.log(`\n${line}\n`)
}

async function runJudge(
  sessionId: string,
  projectDir: string,
  state: SessionState,
  provider: string,
  explicitTranscript?: string,
): Promise<void> {
  // biome-ignore lint/suspicious/noConsole: intentional CLI output
  console.log(`\n── LLM JUDGE ${'─'.repeat(57)}`)

  // Resolve transcript: explicit path > CC native transcript > eval-transcripts scan
  let transcriptPath: string | undefined = explicitTranscript
  let transcriptSource = 'explicit'

  if (!transcriptPath && sessionId !== 'standalone') {
    // 1. Native CC transcript (primary — always present for real sessions)
    const ccPath = ccTranscriptPath(projectDir, sessionId)
    if (existsSync(ccPath)) {
      transcriptPath = ccPath
      transcriptSource = 'cc-native'
    }
  }

  if (!transcriptPath) {
    // 2. Scan eval-transcripts/ for a JSONL containing the session ID
    const transcriptDir = join(projectDir, 'eval-transcripts')
    if (existsSync(transcriptDir)) {
      const files = readdirSync(transcriptDir)
        .filter(f => f.endsWith('.jsonl'))
        .sort()
        .reverse()
      for (const f of files) {
        const fPath = join(transcriptDir, f)
        try {
          const firstLine = readFileSync(fPath, 'utf-8').split('\n')[0]
          if (firstLine.includes(sessionId)) {
            transcriptPath = fPath
            transcriptSource = 'eval'
            break
          }
        } catch {
          // skip unreadable files
        }
      }
    }
  }

  if (!transcriptPath) {
    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.log(`  No transcript found.`)
    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.log(`  Specify one: kata postmortem --transcript=<path> --judge`)
    return
  }

  const size = Math.round(statSync(transcriptPath).size / 1024)
  const label = transcriptSource === 'cc-native' ? 'CC native' : transcriptSource === 'eval' ? 'eval harness' : 'explicit'
  // biome-ignore lint/suspicious/noConsole: intentional CLI output
  console.log(`  Transcript: ${transcriptPath.split('/').slice(-1)[0]} (${size}KB, ${label})`)
  // biome-ignore lint/suspicious/noConsole: intentional CLI output
  console.log(`  Provider:   ${provider || 'claude'}`)
  // biome-ignore lint/suspicious/noConsole: intentional CLI output
  console.log(`  Running judge...`)

  // Resolve mode template path
  const modeName = state.currentMode ?? 'task'
  const templatePath = [
    join(projectDir, '.kata', 'templates', `${modeName}.md`),
    join(projectDir, '.claude', 'workflows', 'templates', `${modeName}.md`),
  ].find(p => existsSync(p))

  try {
    // Summarize transcript to avoid E2BIG or context overflow
    const summary = summarizeTranscriptFile(transcriptPath)
    const result = await runAgentStep(
      {
        provider: provider || 'claude',
        prompt: 'transcript-review',
        context: templatePath ? ['template'] : [],
      },
      {
        cwd: projectDir,
        templatePath,
        extraContext: `## Session Transcript (summarized)\n\n\`\`\`\n${summary}\n\`\`\``,
      },
    )

    const agentScore = extractScore(result.output, 'AGENT_SCORE')
    const systemScore = extractScore(result.output, 'SYSTEM_SCORE')
    // Match "VERDICT: PASS", "FAIL (agent)", "[x] PASS", or derive from scores
    const verdictMatch = result.output.match(
      /VERDICT:\s*(PASS|FAIL[_\s]\w+)|\[x\]\s*\*\*(PASS|FAIL[^*]+)\*\*/i
    )
    const rawVerdict = verdictMatch?.[1] ?? verdictMatch?.[2] ?? ''
    const verdict = rawVerdict
      ? rawVerdict.replace(/\s+/g, '_').toUpperCase()
      : agentScore >= 75 && systemScore >= 75 ? 'PASS' : 'FAIL'

    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.log(`\n  Agent score:  ${agentScore}/100`)
    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.log(`  System score: ${systemScore}/100`)
    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.log(`  Verdict:      ${verdict}`)
    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.log(`  Model:        ${result.model ?? '—'}`)

    const review = result.output.replace(/\n/g, '\n  ')
    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.log(`\n  Review:\n  ${review}`)
  } catch (e) {
    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.error(`  Judge error: ${e instanceof Error ? e.message : String(e)}`)
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function postmortem(args: string[]): Promise<void> {
  const projectArg = args.find(a => a.startsWith('--project='))?.split('=').slice(1).join('=')
  const projectDir = projectArg ?? findProjectDir()

  const lastFlag = args.includes('--last')
  const judgeArg = args.find(a => a === '--judge' || a.startsWith('--judge='))
  const judgeProvider = judgeArg
    ? judgeArg.includes('=')
      ? judgeArg.split('=')[1]
      : 'claude'
    : undefined
  const transcriptArg = args.find(a => a.startsWith('--transcript='))?.split('=').slice(1).join('=')

  // --list-transcripts: show available eval transcripts
  if (args.includes('--list-transcripts')) {
    const transcriptDir = join(projectDir, 'eval-transcripts')
    if (!existsSync(transcriptDir)) {
      // biome-ignore lint/suspicious/noConsole: intentional CLI output
      console.log('No eval-transcripts/ directory found.')
      return
    }
    const files = readdirSync(transcriptDir)
      .filter(f => f.endsWith('.jsonl'))
      .sort()
      .reverse()
    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.log(`Eval transcripts in ${transcriptDir}:\n`)
    for (const f of files) {
      const size = Math.round(statSync(join(transcriptDir, f)).size / 1024)
      // biome-ignore lint/suspicious/noConsole: intentional CLI output
      console.log(`  ${f.padEnd(60)} ${size}KB`)
    }
    return
  }

  // --transcript --judge: standalone judge on a specific transcript (no session needed)
  if (transcriptArg && judgeProvider !== undefined) {
    const resolvedPath = transcriptArg.startsWith('/')
      ? transcriptArg
      : join(projectDir, transcriptArg)
    if (!existsSync(resolvedPath)) {
      // biome-ignore lint/suspicious/noConsole: intentional CLI output
      console.error(`Transcript not found: ${resolvedPath}`)
      process.exitCode = 1
      return
    }
    // Run judge standalone — create a minimal synthetic state
    const syntheticState: Partial<SessionState> = { currentMode: 'task' }
    await runJudge('standalone', projectDir, syntheticState as SessionState, judgeProvider, resolvedPath)
    return
  }

  // First non-flag arg is session-id or prefix
  const sessionIdArg = args.find(a => !a.startsWith('--'))

  if (sessionIdArg) {
    await sessionPostmortem(sessionIdArg, projectDir, { judge: judgeProvider, transcript: transcriptArg })
    return
  }

  if (lastFlag) {
    const sessions = scanSessions(projectDir)
    if (sessions.length === 0) {
      // biome-ignore lint/suspicious/noConsole: intentional CLI output
      console.log('No sessions found.')
      return
    }
    await sessionPostmortem(sessions[0].id, projectDir, { judge: judgeProvider, transcript: transcriptArg })
    return
  }

  // Default: list all sessions
  await listSessions(projectDir)
}
