import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as os from 'node:os'
import { diffWmYaml, diffModesYaml, diffTemplates } from './config-diff.js'

function makeTmpDir(): string {
  const dir = join(
    os.tmpdir(),
    `wm-diff-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )
  mkdirSync(dir, { recursive: true })
  return dir
}

describe('diffWmYaml', () => {
  it('identifies shared fields with same values', () => {
    const a = { project: { name: 'test' }, wm_version: '1.0' }
    const b = { project: { name: 'test' }, wm_version: '1.0' }

    const diff = diffWmYaml(a, b)
    expect(Object.keys(diff.shared)).toContain('wm_version')
    expect(Object.keys(diff.different)).toHaveLength(0)
  })

  it('identifies different values', () => {
    const a = { spec_path: 'planning/specs' }
    const b = { spec_path: 'docs/specs' }

    const diff = diffWmYaml(a, b)
    expect(diff.different.spec_path).toEqual({ a: 'planning/specs', b: 'docs/specs' })
  })

  it('identifies fields only in one side', () => {
    const a = { spec_path: 'planning/specs', custom_field: true }
    const b = { spec_path: 'planning/specs' }

    const diff = diffWmYaml(a, b)
    expect(diff.only_a.custom_field).toBe(true)
    expect(Object.keys(diff.only_b)).toHaveLength(0)
  })

  it('handles empty objects', () => {
    const diff = diffWmYaml({}, {})
    expect(Object.keys(diff.shared)).toHaveLength(0)
    expect(Object.keys(diff.different)).toHaveLength(0)
  })
})

describe('diffModesYaml', () => {
  it('identifies shared and unique modes', () => {
    const a = { modes: { planning: {}, task: {}, eval: {} } }
    const b = { modes: { planning: {}, task: {}, deploy: {} } }

    const diff = diffModesYaml(a, b)
    expect(diff.only_a).toContain('eval')
    expect(diff.only_b).toContain('deploy')
  })

  it('identifies modes with different config', () => {
    const a = { modes: { task: { name: 'Task', template: 'a.md' } } }
    const b = { modes: { task: { name: 'Task', template: 'b.md' } } }

    const diff = diffModesYaml(a, b)
    expect(diff.different_modes).toContain('task')
  })

  it('handles missing modes key', () => {
    const diff = diffModesYaml({}, {})
    expect(diff.shared_modes).toHaveLength(0)
    expect(diff.only_a).toHaveLength(0)
    expect(diff.only_b).toHaveLength(0)
  })
})

describe('diffTemplates', () => {
  let dirA: string
  let dirB: string

  beforeEach(() => {
    dirA = makeTmpDir()
    dirB = makeTmpDir()
  })

  afterEach(() => {
    rmSync(dirA, { recursive: true, force: true })
    rmSync(dirB, { recursive: true, force: true })
  })

  it('detects identical templates', () => {
    writeFileSync(join(dirA, 'task.md'), '# Task')
    writeFileSync(join(dirB, 'task.md'), '# Task')

    const diff = diffTemplates(dirA, dirB)
    expect(diff).toHaveLength(1)
    expect(diff[0].status).toBe('same')
  })

  it('detects different templates', () => {
    writeFileSync(join(dirA, 'task.md'), '# Task v1')
    writeFileSync(join(dirB, 'task.md'), '# Task v2')

    const diff = diffTemplates(dirA, dirB)
    expect(diff[0].status).toBe('different')
  })

  it('detects templates only in one directory', () => {
    writeFileSync(join(dirA, 'task.md'), '# Task')
    writeFileSync(join(dirA, 'custom.md'), '# Custom')
    writeFileSync(join(dirB, 'task.md'), '# Task')

    const diff = diffTemplates(dirA, dirB)
    const onlyA = diff.filter((t) => t.status === 'only_a')
    expect(onlyA).toHaveLength(1)
    expect(onlyA[0].name).toBe('custom.md')
  })

  it('handles non-existent directories', () => {
    const diff = diffTemplates('/nonexistent-a', '/nonexistent-b')
    expect(diff).toHaveLength(0)
  })
})
