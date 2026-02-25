import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as os from 'node:os'
import { decanonPath, isKataEnabled } from './discovery.js'

function makeTmpDir(): string {
  const dir = join(
    os.tmpdir(),
    `wm-discovery-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )
  mkdirSync(dir, { recursive: true })
  return dir
}

describe('decanonPath', () => {
  it('converts simple canonicalized paths', () => {
    // /tmp always exists on Linux
    const result = decanonPath('-tmp')
    expect(result).toBe('/tmp')
  })

  it('returns best guess for non-existent paths', () => {
    const result = decanonPath('-nonexistent-path-abc123')
    expect(result).toStartWith('/')
  })
})

describe('isKataEnabled', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = makeTmpDir()
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('detects .kata layout', () => {
    mkdirSync(join(tmpDir, '.kata'), { recursive: true })
    writeFileSync(join(tmpDir, '.kata', 'wm.yaml'), 'project:\n  name: test\n')

    const result = isKataEnabled(tmpDir)
    expect(result.enabled).toBe(true)
    expect(result.layout).toBe('.kata')
  })

  it('detects .claude/workflows layout', () => {
    mkdirSync(join(tmpDir, '.claude', 'workflows'), { recursive: true })
    writeFileSync(join(tmpDir, '.claude', 'workflows', 'wm.yaml'), 'project:\n  name: test\n')

    const result = isKataEnabled(tmpDir)
    expect(result.enabled).toBe(true)
    expect(result.layout).toBe('.claude')
  })

  it('returns not enabled for empty directory', () => {
    const result = isKataEnabled(tmpDir)
    expect(result.enabled).toBe(false)
  })
})
