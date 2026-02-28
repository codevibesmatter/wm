// wm doctor - Diagnose and fix session state issues
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { randomUUID } from 'node:crypto'
import { findClaudeProjectDir } from '../session/lookup.js'

interface DiagnosticResult {
  check: string
  status: 'ok' | 'warning' | 'error'
  message: string
  fixable: boolean
}

interface DoctorOutput {
  success: boolean
  diagnostics: DiagnosticResult[]
  fixed?: string[]
  sessionId?: string
}

function parseArgs(args: string[]): { fix: boolean; json: boolean } {
  return {
    fix: args.includes('--fix'),
    json: args.includes('--json'),
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function getLastSessionFromRegistry(
  registryPath: string,
): Promise<{ sessionId: string; timestamp: string } | null> {
  try {
    const content = await fs.readFile(registryPath, 'utf-8')
    const lines = content.trim().split('\n').filter(Boolean)
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i])
        if (entry.event === 'session_started' && entry.sessionId) {
          return { sessionId: entry.sessionId, timestamp: entry.timestamp }
        }
      } catch {
        // Skip malformed lines
      }
    }
    return null
  } catch {
    return null
  }
}

export async function doctor(args: string[]): Promise<void> {
  const parsed = parseArgs(args)
  const diagnostics: DiagnosticResult[] = []
  const fixed: string[] = []

  const claudeDir = findClaudeProjectDir()
  const sessionsDir = path.join(claudeDir, '.claude/sessions')
  const registryPath = path.join(sessionsDir, 'registry.jsonl')
  const currentSessionPath = path.join(claudeDir, '.claude/current-session-id')

  // Check 1: Sessions directory
  if (!(await fileExists(sessionsDir))) {
    diagnostics.push({
      check: 'sessions_dir',
      status: 'error',
      message: 'Sessions directory missing',
      fixable: true,
    })
    if (parsed.fix) {
      await fs.mkdir(sessionsDir, { recursive: true })
      fixed.push('Created sessions directory')
    }
  } else {
    diagnostics.push({
      check: 'sessions_dir',
      status: 'ok',
      message: 'Sessions directory exists',
      fixable: false,
    })
  }

  // Check 2: Registry file
  if (!(await fileExists(registryPath))) {
    diagnostics.push({
      check: 'registry_file',
      status: 'error',
      message: 'Registry file missing',
      fixable: true,
    })
    if (parsed.fix) {
      const newSessionId = randomUUID()
      const entry = {
        event: 'session_started',
        sessionId: newSessionId,
        timestamp: new Date().toISOString(),
      }
      await fs.mkdir(sessionsDir, { recursive: true })
      await fs.writeFile(registryPath, `${JSON.stringify(entry)}\n`)
      fixed.push(`Created registry with session ${newSessionId}`)
    }
  } else {
    diagnostics.push({
      check: 'registry_file',
      status: 'ok',
      message: 'Registry file exists',
      fixable: false,
    })
  }

  // Check 3: Registry has session_started
  const lastSession = await getLastSessionFromRegistry(registryPath)
  if (!lastSession) {
    diagnostics.push({
      check: 'registry_session',
      status: 'error',
      message: 'No session_started event',
      fixable: true,
    })
    if (parsed.fix && !fixed.some((f) => f.includes('Created registry'))) {
      const newSessionId = randomUUID()
      const entry = {
        event: 'session_started',
        sessionId: newSessionId,
        timestamp: new Date().toISOString(),
      }
      await fs.appendFile(registryPath, `${JSON.stringify(entry)}\n`)
      fixed.push(`Added session_started for ${newSessionId}`)
    }
  } else {
    diagnostics.push({
      check: 'registry_session',
      status: 'ok',
      message: `Session: ${lastSession.sessionId}`,
      fixable: false,
    })
  }

  // Check 4: current-session-id file (LEGACY - informational only)
  // This file is deprecated. Modern lookup uses CLAUDE_SESSION_ID env var → registry.jsonl
  if (await fileExists(currentSessionPath)) {
    const currentId = (await fs.readFile(currentSessionPath, 'utf-8')).trim()
    diagnostics.push({
      check: 'current_session_id',
      status: 'ok',
      message: `Legacy file exists: ${currentId} (deprecated, prefer CLAUDE_SESSION_ID env var)`,
      fixable: false,
    })
  } else {
    diagnostics.push({
      check: 'current_session_id',
      status: 'ok',
      message: 'Legacy file not present (correct - use CLAUDE_SESSION_ID env var)',
      fixable: false,
    })
  }

  // Check 5: State file
  const effectiveSession = lastSession?.sessionId
  if (effectiveSession) {
    const stateFile = path.join(sessionsDir, effectiveSession, 'state.json')
    if (!(await fileExists(stateFile))) {
      diagnostics.push({
        check: 'state_file',
        status: 'warning',
        message: `State missing for ${effectiveSession}`,
        fixable: true,
      })
      if (parsed.fix) {
        await fs.mkdir(path.join(sessionsDir, effectiveSession), { recursive: true })
        const defaultState = {
          sessionId: effectiveSession,
          workflowId: '',
          sessionType: 'default',
          currentMode: 'default',
          completedPhases: [],
          phases: [],
          modeHistory: [],
          modeState: {},
          beadsCreated: [],
          editedFiles: [],
          todosWritten: false,
        }
        await fs.writeFile(stateFile, JSON.stringify(defaultState, null, 2))
        fixed.push(`Created state for ${effectiveSession}`)
      }
    } else {
      diagnostics.push({
        check: 'state_file',
        status: 'ok',
        message: 'State file exists',
        fixable: false,
      })
    }
  }

  const errors = diagnostics.filter((d) => d.status === 'error').length
  const warnings = diagnostics.filter((d) => d.status === 'warning').length
  const success = errors === 0

  const output: DoctorOutput = {
    success,
    diagnostics,
    ...(fixed.length > 0 && { fixed }),
    ...(effectiveSession && { sessionId: effectiveSession }),
  }

  if (parsed.json) {
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
  } else {
    process.stdout.write('\n=== Session Doctor ===\n\n')
    for (const d of diagnostics) {
      const icon = d.status === 'ok' ? '\u2713' : d.status === 'warning' ? '\u26A0' : '\u2717'
      process.stdout.write(`${icon} ${d.check}: ${d.message}\n`)
    }
    if (fixed.length > 0) {
      process.stdout.write('\nFixed:\n')
      for (const f of fixed) {
        process.stdout.write(`  - ${f}\n`)
      }
    }
    process.stdout.write('\n')
    if (errors > 0 && !parsed.fix) {
      process.stdout.write(`Found ${errors} error(s). Run with --fix to repair.\n`)
    } else if (warnings > 0 && !parsed.fix) {
      process.stdout.write(`Found ${warnings} warning(s). Run with --fix to repair.\n`)
    } else if (success) {
      process.stdout.write('All checks passed.\n')
    }
  }

  if (!success && !parsed.fix) process.exit(1)
}
