import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as os from 'node:os'
import jsYaml from 'js-yaml'

function makeTmpDir(): string {
  const dir = join(
    os.tmpdir(),
    `wm-canexit-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )
  mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * Helper: capture console.log output from canExit()
 */
async function captureCanExit(args: string[]): Promise<string> {
  const { canExit } = await import('./can-exit.js')
  let captured = ''
  const origLog = console.log
  console.log = (...logArgs: unknown[]) => {
    captured += logArgs.map(String).join(' ')
  }
  try {
    await canExit(args)
  } finally {
    console.log = origLog
  }
  return captured
}

describe('canExit', () => {
  let tmpDir: string
  const origEnv = process.env.CLAUDE_PROJECT_DIR
  const origSessionId = process.env.CLAUDE_SESSION_ID

  beforeEach(() => {
    tmpDir = makeTmpDir()
    mkdirSync(join(tmpDir, '.claude', 'sessions'), { recursive: true })
    mkdirSync(join(tmpDir, '.claude', 'workflows'), { recursive: true })
    // Write baseline kata.yaml so loadKataConfig() finds it (no longer reads wm.yaml/modes.yaml)
    // Include implementation + freeform modes with the stop_conditions used by test scenarios.
    // Individual tests that need specific review config overwrite this file before calling canExit.
    writeFileSync(
      join(tmpDir, '.claude', 'workflows', 'kata.yaml'),
      [
        'spec_path: planning/specs',
        'research_path: planning/research',
        'modes:',
        '  implementation:',
        '    template: implementation.md',
        '    stop_conditions: [tasks_complete, committed, pushed, tests_pass, feature_tests_added]',
        '  freeform:',
        '    template: freeform.md',
        '    stop_conditions: []',
        '    aliases: ["qa"]',
      ].join('\n') + '\n',
    )
    process.env.CLAUDE_PROJECT_DIR = tmpDir
    process.env.CLAUDE_SESSION_ID = '00000000-0000-0000-0000-000000000002'
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
    if (origEnv !== undefined) {
      process.env.CLAUDE_PROJECT_DIR = origEnv
    } else {
      delete process.env.CLAUDE_PROJECT_DIR
    }
    if (origSessionId !== undefined) {
      process.env.CLAUDE_SESSION_ID = origSessionId
    } else {
      delete process.env.CLAUDE_SESSION_ID
    }
    process.exitCode = undefined
  })

  function createSessionState(state: Record<string, unknown>): void {
    const sessionId = process.env.CLAUDE_SESSION_ID!
    const sessionDir = join(tmpDir, '.claude', 'sessions', sessionId)
    mkdirSync(sessionDir, { recursive: true })
    writeFileSync(
      join(sessionDir, 'state.json'),
      JSON.stringify({
        sessionId,
        completedPhases: [],
        phases: [],
        modeHistory: [],
        modeState: {},
        beadsCreated: [],
        editedFiles: [],
        ...state,
      }),
    )
  }

  it('allows exit for freeform session type', async () => {
    createSessionState({
      sessionType: 'freeform',
      currentMode: 'freeform',
    })

    const output = await captureCanExit(['--json', `--session=${process.env.CLAUDE_SESSION_ID}`])
    const result = JSON.parse(output) as { canExit: boolean; reasons: string[] }
    expect(result.canExit).toBe(true)
    expect(result.reasons).toHaveLength(0)
  })

  it('allows exit for qa session type', async () => {
    createSessionState({
      sessionType: 'qa',
      currentMode: 'qa',
    })

    const output = await captureCanExit(['--json', `--session=${process.env.CLAUDE_SESSION_ID}`])
    const result = JSON.parse(output) as { canExit: boolean; reasons: string[] }
    expect(result.canExit).toBe(true)
    expect(result.reasons).toHaveLength(0)
  })

  it('checkTestsPass: blocks when no phase evidence files exist', async () => {
    writeFileSync(
      join(tmpDir, '.claude', 'workflows', 'kata.yaml'),
      jsYaml.dump({
        modes: {
          implementation: { template: 'implementation.md', stop_conditions: ['tasks_complete', 'committed', 'pushed', 'tests_pass', 'feature_tests_added'] },
        },
      }),
    )

    createSessionState({
      sessionType: 'implementation',
      currentMode: 'implementation',
      issueNumber: 444,
    })

    const output = await captureCanExit(['--json', `--session=${process.env.CLAUDE_SESSION_ID}`])
    const result = JSON.parse(output) as { canExit: boolean; reasons: string[] }

    const blockedByVerify = result.reasons.some((r) => r.includes('check-phase has not been run'))
    expect(blockedByVerify).toBe(true)
  })

  it('checkTestsPass: passes when phase evidence file exists with overallPassed true', async () => {
    writeFileSync(
      join(tmpDir, '.claude', 'workflows', 'kata.yaml'),
      jsYaml.dump({
        modes: {
          implementation: { template: 'implementation.md', stop_conditions: ['tasks_complete', 'committed', 'pushed', 'tests_pass', 'feature_tests_added'] },
        },
      }),
    )

    createSessionState({
      sessionType: 'implementation',
      currentMode: 'implementation',
      issueNumber: 333,
    })

    const evidenceDir = join(tmpDir, '.claude', 'verification-evidence')
    mkdirSync(evidenceDir, { recursive: true })
    writeFileSync(
      join(evidenceDir, 'phase-p1-333.json'),
      JSON.stringify({
        phaseId: 'p1',
        issueNumber: 333,
        timestamp: new Date().toISOString(),
        overallPassed: true,
      }),
    )

    const output = await captureCanExit(['--json', `--session=${process.env.CLAUDE_SESSION_ID}`])
    const result = JSON.parse(output) as { canExit: boolean; reasons: string[] }

    const blockedByVerify = result.reasons.some((r) => r.includes('check-phase has not been run'))
    expect(blockedByVerify).toBe(false)
  })

  it('checkTestsPass: blocks when phase evidence overallPassed is false', async () => {
    writeFileSync(
      join(tmpDir, '.claude', 'workflows', 'kata.yaml'),
      jsYaml.dump({
        modes: {
          implementation: { template: 'implementation.md', stop_conditions: ['tasks_complete', 'committed', 'pushed', 'tests_pass', 'feature_tests_added'] },
        },
      }),
    )

    createSessionState({
      sessionType: 'implementation',
      currentMode: 'implementation',
      issueNumber: 222,
    })

    const evidenceDir = join(tmpDir, '.claude', 'verification-evidence')
    mkdirSync(evidenceDir, { recursive: true })
    writeFileSync(
      join(evidenceDir, 'phase-p1-222.json'),
      JSON.stringify({
        phaseId: 'p1',
        issueNumber: 222,
        timestamp: new Date().toISOString(),
        overallPassed: false,
      }),
    )

    const output = await captureCanExit(['--json', `--session=${process.env.CLAUDE_SESSION_ID}`])
    const result = JSON.parse(output) as { canExit: boolean; reasons: string[] }

    const blockedByFailed = result.reasons.some((r) => r.includes('failed check-phase'))
    expect(blockedByFailed).toBe(true)
  })

})
