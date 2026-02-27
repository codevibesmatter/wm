import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as os from 'node:os'
import { hookRegistration, configValidation, staleSessions, layoutConsistency } from './health-checks.js'
import type { ProjectEntry } from './registry.js'

function makeTmpDir(): string {
  const dir = join(
    os.tmpdir(),
    `wm-health-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )
  mkdirSync(dir, { recursive: true })
  return dir
}

function makeProject(tmpDir: string, layout: '.kata' | '.claude' = '.kata'): ProjectEntry {
  return {
    path: tmpDir,
    name: 'test-project',
    kata_layout: layout,
    discovered_from: 'manual',
    added_at: new Date().toISOString(),
  }
}

describe('hookRegistration', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = makeTmpDir()
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('reports error when settings.json is missing', () => {
    const result = hookRegistration.run(makeProject(tmpDir))
    expect(result.status).toBe('error')
    expect(result.message).toContain('settings.json not found')
  })

  it('reports error when hooks section is missing', () => {
    mkdirSync(join(tmpDir, '.claude'), { recursive: true })
    writeFileSync(join(tmpDir, '.claude', 'settings.json'), '{}')

    const result = hookRegistration.run(makeProject(tmpDir))
    expect(result.status).toBe('error')
    expect(result.message).toContain('No hooks')
  })

  it('reports missing required hooks', () => {
    mkdirSync(join(tmpDir, '.claude'), { recursive: true })
    writeFileSync(
      join(tmpDir, '.claude', 'settings.json'),
      JSON.stringify({ hooks: { SessionStart: [{ command: 'test' }] } }),
    )

    const result = hookRegistration.run(makeProject(tmpDir))
    expect(result.status).toBe('error')
    expect(result.message).toContain('Missing hooks')
  })

  it('reports ok when all required hooks are present', () => {
    mkdirSync(join(tmpDir, '.claude'), { recursive: true })
    writeFileSync(
      join(tmpDir, '.claude', 'settings.json'),
      JSON.stringify({
        hooks: {
          SessionStart: [{ command: 'kata hook session-start' }],
          UserPromptSubmit: [{ command: 'kata hook user-prompt' }],
          Stop: [{ command: 'kata hook stop-conditions' }],
        },
      }),
    )

    const result = hookRegistration.run(makeProject(tmpDir))
    expect(result.status).toBe('ok')
  })
})

describe('configValidation', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = makeTmpDir()
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('reports error when kata.yaml is missing', () => {
    const result = configValidation.run(makeProject(tmpDir))
    expect(result.status).toBe('error')
    expect(result.message).toContain('kata.yaml not found')
  })

  it('reports ok for valid kata.yaml', () => {
    mkdirSync(join(tmpDir, '.kata'), { recursive: true })
    writeFileSync(join(tmpDir, '.kata', 'kata.yaml'), 'project:\n  name: test\n')

    const result = configValidation.run(makeProject(tmpDir))
    expect(result.status).toBe('ok')
  })

  it('reports error for invalid YAML', () => {
    mkdirSync(join(tmpDir, '.kata'), { recursive: true })
    writeFileSync(join(tmpDir, '.kata', 'kata.yaml'), '{{invalid yaml')

    const result = configValidation.run(makeProject(tmpDir))
    expect(result.status).toBe('error')
    expect(result.message).toContain('parse error')
  })
})

describe('layoutConsistency', () => {
  it('reports the layout type', () => {
    const project = makeProject('/tmp/test', '.kata')
    const result = layoutConsistency.run(project)
    expect(result.status).toBe('ok')
    expect(result.message).toContain('.kata')
  })
})
