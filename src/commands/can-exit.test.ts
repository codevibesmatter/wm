import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { execSync } from 'node:child_process'
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
        '    stop_conditions: [tasks_complete, committed, pushed, verification, tests_pass, feature_tests_added]',
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

  it('skips verification check when code_reviewer is not codex', async () => {
    // Write kata.yaml WITHOUT codex reviewer (include implementation mode for stop_conditions)
    writeFileSync(
      join(tmpDir, '.claude', 'workflows', 'kata.yaml'),
      jsYaml.dump({
        reviews: { code_reviewer: null },
        modes: {
          implementation: { template: 'implementation.md', stop_conditions: ['tasks_complete', 'committed', 'pushed', 'verification', 'tests_pass', 'feature_tests_added'] },
          freeform: { template: 'freeform.md', stop_conditions: [], aliases: ['qa'] },
        },
      }),
    )

    createSessionState({
      sessionType: 'implementation',
      currentMode: 'implementation',
      issueNumber: 999,
    })

    const output = await captureCanExit(['--json', `--session=${process.env.CLAUDE_SESSION_ID}`])
    const result = JSON.parse(output) as { canExit: boolean; reasons: string[] }

    // Should NOT have "Verification not run" in reasons
    const hasVerificationReason = result.reasons.some(
      (r) => r.includes('Verification not run') || r.includes('Verification failed'),
    )
    expect(hasVerificationReason).toBe(false)
  })

  it('checks verification when code_reviewer is codex', async () => {
    writeFileSync(
      join(tmpDir, '.claude', 'workflows', 'kata.yaml'),
      jsYaml.dump({
        reviews: { code_reviewer: 'codex' },
        modes: {
          implementation: { template: 'implementation.md', stop_conditions: ['tasks_complete', 'committed', 'pushed', 'verification', 'tests_pass', 'feature_tests_added'] },
        },
      }),
    )

    createSessionState({
      sessionType: 'implementation',
      currentMode: 'implementation',
      issueNumber: 888,
    })

    const output = await captureCanExit(['--json', `--session=${process.env.CLAUDE_SESSION_ID}`])
    const result = JSON.parse(output) as { canExit: boolean; reasons: string[] }

    // Should have verification-related reason since no evidence file exists
    const hasVerificationReason = result.reasons.some(
      (r) => r.includes('Verification not run') || r.includes('Verification'),
    )
    expect(hasVerificationReason).toBe(true)
  })

  it('checks verification when code_reviewer is gemini', async () => {
    writeFileSync(
      join(tmpDir, '.claude', 'workflows', 'kata.yaml'),
      jsYaml.dump({
        reviews: { code_reviewer: 'gemini' },
        modes: {
          implementation: { template: 'implementation.md', stop_conditions: ['tasks_complete', 'committed', 'pushed', 'verification', 'tests_pass', 'feature_tests_added'] },
        },
      }),
    )

    createSessionState({
      sessionType: 'implementation',
      currentMode: 'implementation',
      issueNumber: 777,
    })

    const output = await captureCanExit(['--json', `--session=${process.env.CLAUDE_SESSION_ID}`])
    const result = JSON.parse(output) as { canExit: boolean; reasons: string[] }

    const hasVerificationReason = result.reasons.some((r) => r.includes('Verification'))
    expect(hasVerificationReason).toBe(true)
  })

  it('skips verification when code_review is explicitly false', async () => {
    writeFileSync(
      join(tmpDir, '.claude', 'workflows', 'kata.yaml'),
      jsYaml.dump({
        reviews: { code_reviewer: 'codex', code_review: false },
        modes: {
          implementation: { template: 'implementation.md', stop_conditions: ['tasks_complete', 'committed', 'pushed', 'verification', 'tests_pass', 'feature_tests_added'] },
        },
      }),
    )

    createSessionState({
      sessionType: 'implementation',
      currentMode: 'implementation',
      issueNumber: 666,
    })

    const output = await captureCanExit(['--json', `--session=${process.env.CLAUDE_SESSION_ID}`])
    const result = JSON.parse(output) as { canExit: boolean; reasons: string[] }

    // code_review: false disables the `verification` stop condition (codex/gemini review)
    // but does NOT disable `verification_plan_executed` — those are independent checks
    const hasCodeReviewReason = result.reasons.some(
      (r) => r.includes('Verification not run') || r.includes('Verification failed') || r.includes('Verification evidence is stale'),
    )
    expect(hasCodeReviewReason).toBe(false)
  })

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

  it('verification passes when evidence file exists with passed: true', async () => {
    writeFileSync(
      join(tmpDir, '.claude', 'workflows', 'kata.yaml'),
      jsYaml.dump({
        reviews: { code_reviewer: 'codex' },
        modes: {
          implementation: { template: 'implementation.md', stop_conditions: ['tasks_complete', 'committed', 'pushed', 'verification', 'tests_pass', 'feature_tests_added'] },
        },
      }),
    )

    createSessionState({
      sessionType: 'implementation',
      currentMode: 'implementation',
      issueNumber: 555,
    })

    // Create passing evidence file
    const evidenceDir = join(tmpDir, '.claude', 'verification-evidence')
    mkdirSync(evidenceDir, { recursive: true })
    writeFileSync(
      join(evidenceDir, '555.json'),
      JSON.stringify({ passed: true, verifiedAt: new Date().toISOString() }),
    )

    const output = await captureCanExit(['--json', `--session=${process.env.CLAUDE_SESSION_ID}`])
    const result = JSON.parse(output) as { canExit: boolean; reasons: string[] }

    // No verification-related reason
    const hasVerificationReason = result.reasons.some((r) => r.includes('Verification'))
    expect(hasVerificationReason).toBe(false)
  })

  it('checkTestsPass: blocks when no phase evidence files exist', async () => {
    writeFileSync(
      join(tmpDir, '.claude', 'workflows', 'kata.yaml'),
      jsYaml.dump({
        reviews: { code_reviewer: null },
        modes: {
          implementation: { template: 'implementation.md', stop_conditions: ['tasks_complete', 'committed', 'pushed', 'verification', 'tests_pass', 'feature_tests_added'] },
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
        reviews: { code_reviewer: null },
        modes: {
          implementation: { template: 'implementation.md', stop_conditions: ['tasks_complete', 'committed', 'pushed', 'verification', 'tests_pass', 'feature_tests_added'] },
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
        reviews: { code_reviewer: null },
        modes: {
          implementation: { template: 'implementation.md', stop_conditions: ['tasks_complete', 'committed', 'pushed', 'verification', 'tests_pass', 'feature_tests_added'] },
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

  it('checkVpEvidence: blocks when no VP evidence files exist', async () => {
    writeFileSync(
      join(tmpDir, '.claude', 'workflows', 'kata.yaml'),
      jsYaml.dump({
        reviews: { code_reviewer: null },
        modes: {
          implementation: { template: 'implementation.md', stop_conditions: ['tasks_complete', 'committed', 'pushed', 'verification', 'tests_pass', 'verification_plan_executed', 'feature_tests_added'] },
        },
      }),
    )

    createSessionState({
      sessionType: 'implementation',
      currentMode: 'implementation',
      issueNumber: 100,
    })

    const output = await captureCanExit(['--json', `--session=${process.env.CLAUDE_SESSION_ID}`])
    const result = JSON.parse(output) as { canExit: boolean; reasons: string[] }

    const blockedByVp = result.reasons.some((r) => r.includes('VP evidence') || r.includes('Verification Plan'))
    expect(blockedByVp).toBe(true)
  })

  it('checkVpEvidence: passes when VP evidence exists with allStepsPassed true', async () => {
    writeFileSync(
      join(tmpDir, '.claude', 'workflows', 'kata.yaml'),
      jsYaml.dump({
        reviews: { code_reviewer: null },
        modes: {
          implementation: { template: 'implementation.md', stop_conditions: ['tasks_complete', 'committed', 'pushed', 'verification', 'tests_pass', 'verification_plan_executed', 'feature_tests_added'] },
        },
      }),
    )

    createSessionState({
      sessionType: 'implementation',
      currentMode: 'implementation',
      issueNumber: 101,
    })

    // Create passing VP evidence file + phase evidence
    const evidenceDir = join(tmpDir, '.claude', 'verification-evidence')
    mkdirSync(evidenceDir, { recursive: true })
    writeFileSync(
      join(evidenceDir, 'vp-p1-101.json'),
      JSON.stringify({
        phaseId: 'p1',
        issueNumber: 101,
        timestamp: new Date().toISOString(),
        allStepsPassed: true,
        steps: [{ id: 'VP1', passed: true }],
      }),
    )
    // Also need phase evidence for tests_pass check
    writeFileSync(
      join(evidenceDir, 'phase-p1-101.json'),
      JSON.stringify({
        phaseId: 'p1',
        issueNumber: 101,
        timestamp: new Date().toISOString(),
        overallPassed: true,
      }),
    )

    const output = await captureCanExit(['--json', `--session=${process.env.CLAUDE_SESSION_ID}`])
    const result = JSON.parse(output) as { canExit: boolean; reasons: string[] }

    const blockedByVp = result.reasons.some((r) => r.includes('VP') || r.includes('Verification Plan'))
    expect(blockedByVp).toBe(false)
  })

  it('checkVpEvidence: blocks when VP evidence has failing steps', async () => {
    writeFileSync(
      join(tmpDir, '.claude', 'workflows', 'kata.yaml'),
      jsYaml.dump({
        reviews: { code_reviewer: null },
        modes: {
          implementation: { template: 'implementation.md', stop_conditions: ['tasks_complete', 'committed', 'pushed', 'verification', 'tests_pass', 'verification_plan_executed', 'feature_tests_added'] },
        },
      }),
    )

    createSessionState({
      sessionType: 'implementation',
      currentMode: 'implementation',
      issueNumber: 102,
    })

    const evidenceDir = join(tmpDir, '.claude', 'verification-evidence')
    mkdirSync(evidenceDir, { recursive: true })
    writeFileSync(
      join(evidenceDir, 'vp-p1-102.json'),
      JSON.stringify({
        phaseId: 'p1',
        issueNumber: 102,
        timestamp: new Date().toISOString(),
        allStepsPassed: false,
        steps: [
          { id: 'VP1', passed: true },
          { id: 'VP2', passed: false },
        ],
      }),
    )

    const output = await captureCanExit(['--json', `--session=${process.env.CLAUDE_SESSION_ID}`])
    const result = JSON.parse(output) as { canExit: boolean; reasons: string[] }

    const blockedByVp = result.reasons.some((r) => r.includes('failing steps'))
    expect(blockedByVp).toBe(true)
  })

  it('checkVerificationEvidence: blocks when evidence timestamp predates latest commit', async () => {
    writeFileSync(
      join(tmpDir, '.claude', 'workflows', 'kata.yaml'),
      jsYaml.dump({
        reviews: { code_reviewer: 'codex' },
        modes: {
          implementation: { template: 'implementation.md', stop_conditions: ['tasks_complete', 'committed', 'pushed', 'verification', 'tests_pass', 'feature_tests_added'] },
        },
      }),
    )

    createSessionState({
      sessionType: 'implementation',
      currentMode: 'implementation',
      issueNumber: 111,
    })

    // Stale evidence — timestamp in the past
    const evidenceDir = join(tmpDir, '.claude', 'verification-evidence')
    mkdirSync(evidenceDir, { recursive: true })
    writeFileSync(
      join(evidenceDir, '111.json'),
      JSON.stringify({
        passed: true,
        verifiedAt: '2020-01-01T00:00:00.000Z',
      }),
    )

    const output = await captureCanExit(['--json', `--session=${process.env.CLAUDE_SESSION_ID}`])
    const result = JSON.parse(output) as { canExit: boolean; reasons: string[] }

    const blockedByStale = result.reasons.some(
      (r) => r.includes('stale') || r.includes('Verification'),
    )
    expect(blockedByStale).toBe(true)
  })
})

describe('non-code commit staleness', () => {
  let tmpDir: string
  const origEnv = process.env.CLAUDE_PROJECT_DIR
  const origSessionId = process.env.CLAUDE_SESSION_ID
  let origCwd: string

  function gitIn(cmd: string): string {
    return execSync(cmd, { cwd: tmpDir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  }

  beforeEach(() => {
    origCwd = process.cwd()
    tmpDir = join(
      os.tmpdir(),
      `wm-canexit-noncode-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    )
    mkdirSync(tmpDir, { recursive: true })
    // chdir so git commands in can-exit.ts run against our test repo
    process.chdir(tmpDir)
    // Init a real git repo for commit timestamp tests
    gitIn('git init')
    gitIn('git config user.email "test@test.com"')
    gitIn('git config user.name "Test"')

    mkdirSync(join(tmpDir, '.claude', 'sessions'), { recursive: true })
    mkdirSync(join(tmpDir, '.claude', 'workflows'), { recursive: true })
    process.env.CLAUDE_PROJECT_DIR = tmpDir
    process.env.CLAUDE_SESSION_ID = '00000000-0000-0000-0000-000000000003'
  })

  afterEach(() => {
    process.chdir(origCwd)
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

  it('non-code-only commit after evidence does NOT invalidate it', async () => {
    writeFileSync(
      join(tmpDir, '.claude', 'workflows', 'kata.yaml'),
      jsYaml.dump({
        reviews: { code_reviewer: 'codex' },
        modes: {
          implementation: { template: 'implementation.md', stop_conditions: ['tasks_complete', 'committed', 'pushed', 'verification', 'tests_pass', 'feature_tests_added'] },
        },
      }),
    )

    createSessionState({
      sessionType: 'implementation',
      currentMode: 'implementation',
      issueNumber: 500,
    })

    // 1. Create a code file and commit it
    writeFileSync(join(tmpDir, 'app.ts'), 'export const x = 1')
    gitIn('git add app.ts')
    gitIn('git commit -m "add code"')

    // 2. Create evidence with timestamp AFTER the code commit
    const evidenceDir = join(tmpDir, '.claude', 'verification-evidence')
    mkdirSync(evidenceDir, { recursive: true })
    const evidenceTs = new Date(Date.now() + 1000).toISOString()
    writeFileSync(
      join(evidenceDir, '500.json'),
      JSON.stringify({ passed: true, verifiedAt: evidenceTs }),
    )

    // 3. Make a non-code-only commit (in .claude/)
    writeFileSync(join(tmpDir, '.claude', 'some-file.json'), '{}')
    gitIn('git add .claude/some-file.json')
    gitIn('git commit -m "commit non-code file"')

    // The non-code commit is now the latest commit overall, but NOT the latest code commit
    const output = await captureCanExit(['--json', `--session=${process.env.CLAUDE_SESSION_ID}`])
    const result = JSON.parse(output) as { canExit: boolean; reasons: string[] }

    const blockedByStale = result.reasons.some(
      (r) => r.includes('stale') || r.includes('Verification evidence is stale'),
    )
    expect(blockedByStale).toBe(false)
  })

  it('code commit after evidence DOES invalidate it', async () => {
    writeFileSync(
      join(tmpDir, '.claude', 'workflows', 'kata.yaml'),
      jsYaml.dump({
        reviews: { code_reviewer: 'codex' },
        modes: {
          implementation: { template: 'implementation.md', stop_conditions: ['tasks_complete', 'committed', 'pushed', 'verification', 'tests_pass', 'feature_tests_added'] },
        },
      }),
    )

    createSessionState({
      sessionType: 'implementation',
      currentMode: 'implementation',
      issueNumber: 501,
    })

    // 1. Initial code commit
    writeFileSync(join(tmpDir, 'app.ts'), 'export const x = 1')
    gitIn('git add app.ts')
    gitIn('git commit -m "add code"')

    // 2. Create evidence with timestamp just after code commit
    const evidenceDir = join(tmpDir, '.claude', 'verification-evidence')
    mkdirSync(evidenceDir, { recursive: true })
    const evidenceTs = new Date(Date.now() + 1000).toISOString()
    writeFileSync(
      join(evidenceDir, '501.json'),
      JSON.stringify({ passed: true, verifiedAt: evidenceTs }),
    )

    // 3. Make a NEW code commit with committer date after evidence
    // Must set GIT_COMMITTER_DATE because %cI reads committer date (--date only sets author date)
    const futureDate = new Date(Date.now() + 5000).toISOString()
    writeFileSync(join(tmpDir, 'app.ts'), 'export const x = 2')
    gitIn('git add app.ts')
    execSync('git commit -m "update code"', {
      cwd: tmpDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, GIT_COMMITTER_DATE: futureDate, GIT_AUTHOR_DATE: futureDate },
    })

    const output = await captureCanExit(['--json', `--session=${process.env.CLAUDE_SESSION_ID}`])
    const result = JSON.parse(output) as { canExit: boolean; reasons: string[] }

    const blockedByStale = result.reasons.some(
      (r) => r.includes('stale') || r.includes('Verification evidence is stale'),
    )
    expect(blockedByStale).toBe(true)
  })
})
