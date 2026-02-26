/**
 * kata verify-run — spawn a fresh Claude agent to execute the spec's Verification Plan.
 *
 * Usage:
 *   kata verify-run --issue=N              # Run all VP steps for issue N
 *   kata verify-run --issue=N --verbose    # Stream agent output to stderr
 *   kata verify-run --issue=N --dry-run    # Show prompt without running
 *
 * Called from implementation P3 VERIFY phase. Spawns a fresh agent via
 * claudeProvider.run() with full tool access (no implementation bias).
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { claudeProvider } from '../providers/claude.js'
import { findProjectDir, getVerificationDir } from '../session/lookup.js'
import { findSpecFile } from './enter/spec.js'
import { extractVerificationPlan, parseVpSteps } from './enter/task-factory.js'

interface VerifyRunArgs {
  issueNumber?: number
  verbose: boolean
  dryRun: boolean
  model?: string
  maxTurns?: number
}

function parseArgs(args: string[]): VerifyRunArgs {
  const result: VerifyRunArgs = { verbose: false, dryRun: false }

  for (const arg of args) {
    if (arg.startsWith('--issue=')) {
      result.issueNumber = Number.parseInt(arg.slice('--issue='.length), 10)
    } else if (arg === '--verbose') {
      result.verbose = true
    } else if (arg === '--dry-run') {
      result.dryRun = true
    } else if (arg.startsWith('--model=')) {
      result.model = arg.slice('--model='.length)
    } else if (arg.startsWith('--max-turns=')) {
      result.maxTurns = Number.parseInt(arg.slice('--max-turns='.length), 10)
    }
  }

  return result
}

function buildVerifyPrompt(issueNumber: number, vpContent: string, vpSteps: ReturnType<typeof parseVpSteps>): string {
  const stepList = vpSteps
    .map((s) => `- ${s.id}: ${s.title}`)
    .join('\n')

  return [
    `Execute the Verification Plan for issue #${issueNumber}.`,
    '',
    '## Setup',
    'First, enter verify mode:',
    '```bash',
    'kata enter verify',
    '```',
    'This gives you the structured verify workflow. Then execute each VP step below.',
    '',
    `## VP Steps to Execute (${vpSteps.length} total)`,
    stepList,
    '',
    '## Full Verification Plan',
    vpContent,
    '',
    '## Repair Loop',
    'If any VP step fails:',
    '1. Diagnose the failure — read the error, identify root cause in implementation code',
    '2. Fix the implementation (NOT the VP steps — those are the source of truth)',
    '3. Re-run the failed VP step(s)',
    '4. Maximum 3 repair cycles before reporting failure',
    '',
    '## Evidence',
    `When all VP steps pass, write evidence to .claude/verification-evidence/vp-${issueNumber}.json with:`,
    '- issueNumber, timestamp (ISO 8601), steps array (id, description, status, details)',
    'Then report results summary.',
  ].join('\n')
}

export async function verifyRun(args: string[]): Promise<void> {
  const parsed = parseArgs(args)

  if (!parsed.issueNumber) {
    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.error('Usage: kata verify-run --issue=N [--verbose] [--dry-run] [--model=MODEL]')
    process.exitCode = 1
    return
  }

  // Find and read spec
  const specPath = findSpecFile(parsed.issueNumber)
  if (!specPath) {
    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.error(`No spec found for issue #${parsed.issueNumber}`)
    process.exitCode = 1
    return
  }

  const specContent = readFileSync(specPath, 'utf-8')
  const vpContent = extractVerificationPlan(specContent)
  if (!vpContent) {
    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.error(`No ## Verification Plan section found in ${specPath}`)
    process.exitCode = 1
    return
  }

  const vpSteps = parseVpSteps(vpContent)
  if (vpSteps.length === 0) {
    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.error(`No ### VPn: steps found in Verification Plan (${specPath})`)
    process.exitCode = 1
    return
  }

  // biome-ignore lint/suspicious/noConsole: intentional CLI output
  console.error(`verify-run: issue #${parsed.issueNumber}, ${vpSteps.length} VP steps`)
  // biome-ignore lint/suspicious/noConsole: intentional CLI output
  console.error(`  Spec: ${specPath}`)
  for (const step of vpSteps) {
    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.error(`  ${step.id}: ${step.title}`)
  }

  const prompt = buildVerifyPrompt(parsed.issueNumber, vpContent, vpSteps)

  if (parsed.dryRun) {
    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.log(prompt)
    return
  }

  let cwd: string
  try {
    cwd = findProjectDir()
  } catch {
    cwd = process.cwd()
  }

  // biome-ignore lint/suspicious/noConsole: intentional CLI output
  console.error('Spawning fresh verification agent...')

  const evidencePath = join(getVerificationDir(cwd), `vp-${parsed.issueNumber}.json`)

  try {
    await claudeProvider.run(prompt, {
      cwd,
      model: parsed.model,
      allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
      maxTurns: parsed.maxTurns ?? 50,
      permissionMode: 'bypassPermissions',
      // Load project settings so hooks fire — mode-gate auto-injects --session=<ID>
      // into kata commands, ensuring the sub-agent operates in its own session.
      settingSources: ['project'],
      timeoutMs: 600_000, // 10 min
      onMessage: parsed.verbose
        ? (msg) => {
            const m = msg as { type?: string; message?: { content?: Array<{ type?: string; text?: string }> } }
            if (m.type === 'assistant' && m.message?.content) {
              for (const block of m.message.content) {
                if (block.type === 'text' && block.text) {
                  process.stderr.write(block.text)
                }
              }
            }
          }
        : undefined,
    })
  } catch (err) {
    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.error(`verify-run: agent error: ${err instanceof Error ? err.message : String(err)}`)
    // Don't exit yet — the agent may have written evidence before crashing
  }

  // Read the evidence file — this is the source of truth, not agent text output
  if (!existsSync(evidencePath)) {
    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.error(`verify-run: FAILED — no evidence file written at ${evidencePath}`)
    process.exitCode = 1
    return
  }

  try {
    const evidence = JSON.parse(readFileSync(evidencePath, 'utf-8')) as {
      issueNumber: number
      steps: Array<{ id: string; description: string; status: string; details?: string }>
      allStepsPassed?: boolean
    }

    const allPassed = evidence.allStepsPassed ?? evidence.steps.every((s) => s.status === 'pass')
    const passCount = evidence.steps.filter((s) => s.status === 'pass').length
    const failCount = evidence.steps.length - passCount

    // Output structured result
    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.log(`VP results: ${passCount} passed, ${failCount} failed out of ${evidence.steps.length} steps`)
    for (const step of evidence.steps) {
      // biome-ignore lint/suspicious/noConsole: intentional CLI output
      console.log(`  ${step.id}: ${step.status.toUpperCase()}${step.details ? ` — ${step.details}` : ''}`)
    }

    if (allPassed) {
      // biome-ignore lint/suspicious/noConsole: intentional CLI output
      console.error('verify-run: Verification PASSED')
    } else {
      // biome-ignore lint/suspicious/noConsole: intentional CLI output
      console.error('verify-run: Verification FAILED')
      process.exitCode = 1
    }
  } catch (err) {
    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.error(`verify-run: failed to read evidence: ${err instanceof Error ? err.message : String(err)}`)
    process.exitCode = 1
  }
}
