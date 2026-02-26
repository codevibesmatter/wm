/**
 * kata verify-run — spawn a fresh Claude agent to verify recent changes.
 *
 * Usage:
 *   kata verify-run                        # Infer VP from git diff (default)
 *   kata verify-run --issue=N              # Run VP steps from spec for issue N
 *   kata verify-run --plan-file=PATH       # Run VP steps from a standalone plan file
 *   kata verify-run --verbose              # Stream agent output to stderr
 *   kata verify-run --dry-run              # Show prompt without running
 *
 * Three input modes (first match wins):
 *   --issue=N      Finds the spec for issue N and extracts ## Verification Plan
 *   --plan-file=P  Reads VP steps directly from a markdown file (### VPn: format)
 *   (default)      Infers verification scope from git diff + commit messages
 *
 * Called from implementation P3 or task P2 VERIFY phase. Spawns a fresh agent
 * via claudeProvider.run() with full tool access (no implementation bias).
 */

import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { claudeProvider } from '../providers/claude.js'
import { findProjectDir, getVerificationDir } from '../session/lookup.js'
import { findSpecFile } from './enter/spec.js'
import { extractVerificationPlan, parseVpSteps } from './enter/task-factory.js'

interface VerifyRunArgs {
  issueNumber?: number
  planFile?: string
  infer: boolean
  verbose: boolean
  dryRun: boolean
  model?: string
  maxTurns?: number
}

function parseArgs(args: string[]): VerifyRunArgs {
  const result: VerifyRunArgs = { infer: false, verbose: false, dryRun: false }

  for (const arg of args) {
    if (arg.startsWith('--issue=')) {
      result.issueNumber = Number.parseInt(arg.slice('--issue='.length), 10)
    } else if (arg.startsWith('--plan-file=')) {
      result.planFile = arg.slice('--plan-file='.length)
    } else if (arg === '--infer') {
      result.infer = true
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

  // Default to infer mode when no input source specified
  if (!result.issueNumber && !result.planFile) {
    result.infer = true
  }

  return result
}

// --- Prompt builders ---

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

function buildVerifyPromptFromPlanFile(planFile: string, vpContent: string, vpSteps: ReturnType<typeof parseVpSteps>): string {
  const stepList = vpSteps
    .map((s) => `- ${s.id}: ${s.title}`)
    .join('\n')

  const evidenceSlug = planFile.replace(/^.*\//, '').replace(/\.md$/, '')

  return [
    'Execute the Verification Plan from the task verification file.',
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
    `When all VP steps pass, write evidence to .claude/verification-evidence/vp-task-${evidenceSlug}.json with:`,
    '- timestamp (ISO 8601), planFile, steps array (id, description, status, details), allStepsPassed boolean',
    'Then report results summary.',
  ].join('\n')
}

function buildInferPrompt(gitContext: string, evidenceSlug: string): string {
  return [
    'Verify the recent changes in this project.',
    '',
    '## Setup',
    'First, enter verify mode:',
    '```bash',
    'kata enter verify',
    '```',
    '',
    '## What Changed',
    gitContext,
    '',
    '## Your Job',
    'As a **fresh verification agent** with no prior context about these changes,',
    'verify that the work is correct by executing these checks:',
    '',
    '### VP1: Build passes',
    'Run the project build command and confirm zero errors.',
    '',
    '### VP2: Tests pass',
    'Run the project test suite. All tests must pass (zero failures).',
    '',
    '### VP3: Changed files are correct',
    'Read each changed file listed above. Verify:',
    '- Code compiles and follows project conventions',
    '- No obvious bugs, typos, or incomplete implementations',
    '- No commented-out code, TODOs, or placeholder text left behind',
    '- Imports are used and exports are consumed',
    '',
    '### VP4: Changes match commit intent',
    'Compare what the commits claim to do (commit messages) with what actually changed.',
    'Flag any discrepancies — files that changed but aren\'t mentioned, or claims that',
    'aren\'t supported by the diff.',
    '',
    '## Repair Loop',
    'If any VP step fails:',
    '1. Diagnose the failure — read the error, identify root cause in implementation code',
    '2. Fix the implementation (NOT the VP steps — those are the source of truth)',
    '3. Re-run the failed VP step(s)',
    '4. Maximum 3 repair cycles before reporting failure',
    '',
    '## Evidence',
    `When all VP steps pass, write evidence to .claude/verification-evidence/vp-${evidenceSlug}.json with:`,
    '- timestamp (ISO 8601), mode: "infer", steps array (id, description, status, details), allStepsPassed boolean',
    'Then report results summary.',
  ].join('\n')
}

// --- Git context gathering ---

function gatherGitContext(cwd: string): string {
  const run = (cmd: string) => {
    try {
      return execSync(cmd, { cwd, encoding: 'utf-8', timeout: 10_000 }).trim()
    } catch {
      return ''
    }
  }

  const lines: string[] = []

  // Recent commits (last 10 or since divergence from main)
  const commits = run('git log --oneline -10 2>/dev/null')
  if (commits) {
    lines.push('### Recent Commits', '```', commits, '```', '')
  }

  // Diff stat
  const diffStat = run('git diff HEAD~1 --stat 2>/dev/null') || run('git diff --staged --stat 2>/dev/null')
  if (diffStat) {
    lines.push('### Files Changed', '```', diffStat, '```', '')
  }

  // Actual diff (truncated)
  const diff = run('git diff HEAD~1 2>/dev/null') || run('git diff --staged 2>/dev/null')
  if (diff) {
    const truncated = diff.length > 8000 ? `${diff.slice(0, 8000)}\n... (truncated, ${diff.length} chars total)` : diff
    lines.push('### Diff', '```diff', truncated, '```', '')
  }

  // Uncommitted changes
  const status = run('git status --short 2>/dev/null')
  if (status) {
    lines.push('### Uncommitted Changes', '```', status, '```', '')
  }

  if (lines.length === 0) {
    lines.push('No git changes detected. The agent should still run build + tests.')
  }

  return lines.join('\n')
}

// --- Main ---

export async function verifyRun(args: string[]): Promise<void> {
  const parsed = parseArgs(args)

  let prompt: string
  let evidenceSlug: string
  let sourceLabel: string

  let cwd: string
  try {
    cwd = findProjectDir()
  } catch {
    cwd = process.cwd()
  }

  if (parsed.planFile) {
    // --plan-file mode: read VP steps directly from a markdown file
    if (!existsSync(parsed.planFile)) {
      // biome-ignore lint/suspicious/noConsole: intentional CLI output
      console.error(`Plan file not found: ${parsed.planFile}`)
      process.exitCode = 1
      return
    }

    const planContent = readFileSync(parsed.planFile, 'utf-8')
    const vpSteps = parseVpSteps(planContent)
    if (vpSteps.length === 0) {
      // biome-ignore lint/suspicious/noConsole: intentional CLI output
      console.error(`No ### VPn: steps found in plan file (${parsed.planFile})`)
      process.exitCode = 1
      return
    }

    evidenceSlug = `task-${parsed.planFile.replace(/^.*\//, '').replace(/\.md$/, '')}`
    sourceLabel = `plan-file: ${parsed.planFile}, ${vpSteps.length} VP steps`
    prompt = buildVerifyPromptFromPlanFile(parsed.planFile, planContent, vpSteps)

    for (const step of vpSteps) {
      // biome-ignore lint/suspicious/noConsole: intentional CLI output
      console.error(`  ${step.id}: ${step.title}`)
    }
  } else if (parsed.issueNumber) {
    // --issue mode: find spec and extract ## Verification Plan
    const specPath = findSpecFile(parsed.issueNumber)
    if (!specPath) {
      // biome-ignore lint/suspicious/noConsole: intentional CLI output
      console.error(`No spec found for issue #${parsed.issueNumber}`)
      process.exitCode = 1
      return
    }

    const specContent = readFileSync(specPath, 'utf-8')
    const extracted = extractVerificationPlan(specContent)
    if (!extracted) {
      // biome-ignore lint/suspicious/noConsole: intentional CLI output
      console.error(`No ## Verification Plan section found in ${specPath}`)
      process.exitCode = 1
      return
    }

    const vpSteps = parseVpSteps(extracted)
    if (vpSteps.length === 0) {
      // biome-ignore lint/suspicious/noConsole: intentional CLI output
      console.error(`No ### VPn: steps found in Verification Plan (${specPath})`)
      process.exitCode = 1
      return
    }

    evidenceSlug = `${parsed.issueNumber}`
    sourceLabel = `issue #${parsed.issueNumber}, spec: ${specPath}, ${vpSteps.length} VP steps`
    prompt = buildVerifyPrompt(parsed.issueNumber, extracted, vpSteps)

    for (const step of vpSteps) {
      // biome-ignore lint/suspicious/noConsole: intentional CLI output
      console.error(`  ${step.id}: ${step.title}`)
    }
  } else {
    // Infer mode: build verification from git context
    const gitContext = gatherGitContext(cwd)

    // Generate a slug from the current HEAD short hash
    const headShort = (() => {
      try {
        return execSync('git rev-parse --short HEAD', { cwd, encoding: 'utf-8', timeout: 5000 }).trim()
      } catch {
        return `infer-${Date.now()}`
      }
    })()

    evidenceSlug = `infer-${headShort}`
    sourceLabel = `infer mode (HEAD=${headShort})`
    prompt = buildInferPrompt(gitContext, evidenceSlug)
  }

  // biome-ignore lint/suspicious/noConsole: intentional CLI output
  console.error(`verify-run: ${sourceLabel}`)

  if (parsed.dryRun) {
    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.log(prompt)
    return
  }

  // biome-ignore lint/suspicious/noConsole: intentional CLI output
  console.error('Spawning fresh verification agent...')
  // biome-ignore lint/suspicious/noConsole: intentional CLI output
  console.error(`  cwd: ${cwd}`)
  // biome-ignore lint/suspicious/noConsole: intentional CLI output
  console.error(`  model: ${parsed.model ?? '(default)'}`)
  // biome-ignore lint/suspicious/noConsole: intentional CLI output
  console.error(`  maxTurns: ${parsed.maxTurns ?? 50}`)

  const evidencePath = join(getVerificationDir(cwd), `vp-${evidenceSlug}.json`)
  // biome-ignore lint/suspicious/noConsole: intentional CLI output
  console.error(`  evidence: ${evidencePath}`)

  let agentOutput = ''
  let agentError: Error | undefined

  try {
    agentOutput = await claudeProvider.run(prompt, {
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
    agentError = err instanceof Error ? err : new Error(String(err))
    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.error(`verify-run: agent error: ${agentError.message}`)
    // Don't exit yet — the agent may have written evidence before crashing
  }

  // Read the evidence file — this is the source of truth, not agent text output
  if (!existsSync(evidencePath)) {
    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.error(`verify-run: FAILED — no evidence file written at ${evidencePath}`)
    if (agentError) {
      // biome-ignore lint/suspicious/noConsole: intentional CLI output
      console.error('')
      // biome-ignore lint/suspicious/noConsole: intentional CLI output
      console.error('Diagnosis: The verification agent failed to start or crashed before writing evidence.')
      // biome-ignore lint/suspicious/noConsole: intentional CLI output
      console.error(`  Error: ${agentError.message}`)
      if (agentError.message.includes('nesting') || agentError.message.includes('CLAUDECODE') || agentError.message.includes('another Claude Code session')) {
        // biome-ignore lint/suspicious/noConsole: intentional CLI output
        console.error('')
        // biome-ignore lint/suspicious/noConsole: intentional CLI output
        console.error('This looks like an SDK nesting issue. The verify agent cannot spawn')
        // biome-ignore lint/suspicious/noConsole: intentional CLI output
        console.error('inside another Claude Code session without proper env clearing.')
        // biome-ignore lint/suspicious/noConsole: intentional CLI output
        console.error('Try running verify-run directly:')
        // biome-ignore lint/suspicious/noConsole: intentional CLI output
        console.error(`  node <kata-path>/dist/index.js verify-run ${parsed.planFile ? `--plan-file=${parsed.planFile}` : parsed.issueNumber ? `--issue=${parsed.issueNumber}` : '--infer'} --verbose`)
      }
    } else if (!agentOutput || agentOutput.trim().length === 0) {
      // biome-ignore lint/suspicious/noConsole: intentional CLI output
      console.error('')
      // biome-ignore lint/suspicious/noConsole: intentional CLI output
      console.error('Diagnosis: Agent produced no output and no evidence — likely a silent spawn failure.')
      // biome-ignore lint/suspicious/noConsole: intentional CLI output
      console.error('Troubleshooting:')
      // biome-ignore lint/suspicious/noConsole: intentional CLI output
      console.error('  1. Re-run with --verbose to see agent output')
      // biome-ignore lint/suspicious/noConsole: intentional CLI output
      console.error('  2. Try --dry-run to verify the prompt is correct')
      // biome-ignore lint/suspicious/noConsole: intentional CLI output
      console.error('  3. Check that @anthropic-ai/claude-agent-sdk is installed')
      // biome-ignore lint/suspicious/noConsole: intentional CLI output
      console.error(`  4. Try direct invocation: node <kata-path>/dist/index.js verify-run ${parsed.planFile ? `--plan-file=${parsed.planFile}` : parsed.issueNumber ? `--issue=${parsed.issueNumber}` : '--infer'} --verbose`)
    }
    process.exitCode = 1
    return
  }

  try {
    const evidence = JSON.parse(readFileSync(evidencePath, 'utf-8')) as {
      issueNumber?: number
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
