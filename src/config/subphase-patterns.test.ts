import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as os from 'node:os'
import jsYaml from 'js-yaml'
import {
  loadSubphasePatterns,
  clearSubphasePatternCache,
  SubphasePatternConfigSchema,
  SubphasePatternDefinitionSchema,
} from './subphase-patterns.js'
import { subphasePatternSchema } from '../validation/schemas.js'

function makeTmpDir(label: string): string {
  const dir = join(
    os.tmpdir(),
    `wm-subphase-test-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )
  mkdirSync(dir, { recursive: true })
  return dir
}

function writeSubphasePatternsYaml(dir: string, config: Record<string, unknown>): string {
  const filePath = join(dir, 'subphase-patterns.yaml')
  writeFileSync(filePath, jsYaml.dump(config))
  return filePath
}

// ── Schema validation ──

describe('subphasePatternSchema (step-level)', () => {
  it('accepts valid step', () => {
    const result = subphasePatternSchema.safeParse({
      id_suffix: 'impl',
      title_template: 'IMPL - {task_summary}',
      todo_template: 'Implement {task_summary}',
      active_form: 'Implementing {phase_name}',
      labels: ['impl'],
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty id_suffix', () => {
    const result = subphasePatternSchema.safeParse({
      id_suffix: '',
      title_template: 'IMPL',
      todo_template: 'Implement',
      active_form: 'Implementing',
    })
    expect(result.success).toBe(false)
  })

  it('defaults labels to empty array', () => {
    const result = subphasePatternSchema.safeParse({
      id_suffix: 'impl',
      title_template: 'IMPL',
      todo_template: 'Implement',
      active_form: 'Implementing',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.labels).toEqual([])
    }
  })

  it('accepts depends_on_previous', () => {
    const result = subphasePatternSchema.safeParse({
      id_suffix: 'verify',
      title_template: 'VERIFY',
      todo_template: 'Verify',
      active_form: 'Verifying',
      depends_on_previous: true,
    })
    expect(result.success).toBe(true)
  })
})

describe('SubphasePatternDefinitionSchema', () => {
  it('accepts valid definition with steps', () => {
    const result = SubphasePatternDefinitionSchema.safeParse({
      description: 'Implement then verify',
      steps: [
        {
          id_suffix: 'impl',
          title_template: 'IMPL',
          todo_template: 'Implement',
          active_form: 'Implementing',
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty steps', () => {
    const result = SubphasePatternDefinitionSchema.safeParse({
      description: 'No steps',
      steps: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing description', () => {
    const result = SubphasePatternDefinitionSchema.safeParse({
      steps: [
        {
          id_suffix: 'impl',
          title_template: 'IMPL',
          todo_template: 'Implement',
          active_form: 'Implementing',
        },
      ],
    })
    expect(result.success).toBe(false)
  })
})

describe('SubphasePatternConfigSchema', () => {
  it('accepts valid config with multiple patterns', () => {
    const result = SubphasePatternConfigSchema.safeParse({
      subphase_patterns: {
        'impl-verify': {
          description: 'Implement then verify',
          steps: [
            {
              id_suffix: 'impl',
              title_template: 'IMPL',
              todo_template: 'Implement',
              active_form: 'Implementing',
            },
            {
              id_suffix: 'verify',
              title_template: 'VERIFY',
              todo_template: 'Verify',
              active_form: 'Verifying',
              depends_on_previous: true,
            },
          ],
        },
        'impl-test-verify': {
          description: 'Implement, test, verify',
          steps: [
            {
              id_suffix: 'impl',
              title_template: 'IMPL',
              todo_template: 'Implement',
              active_form: 'Implementing',
            },
            {
              id_suffix: 'test',
              title_template: 'TEST',
              todo_template: 'Test',
              active_form: 'Testing',
              depends_on_previous: true,
            },
            {
              id_suffix: 'verify',
              title_template: 'VERIFY',
              todo_template: 'Verify',
              active_form: 'Verifying',
              depends_on_previous: true,
            },
          ],
        },
      },
    })
    expect(result.success).toBe(true)
  })

  it('rejects config missing subphase_patterns key', () => {
    const result = SubphasePatternConfigSchema.safeParse({ patterns: {} })
    expect(result.success).toBe(false)
  })
})

// ── 2-tier merge loader ──

describe('loadSubphasePatterns 2-tier merge', () => {
  const origProjectDir = process.env.CLAUDE_PROJECT_DIR
  let tmpDirs: string[] = []

  beforeEach(() => {
    clearSubphasePatternCache()
    tmpDirs = []
  })

  afterEach(() => {
    for (const dir of tmpDirs) {
      rmSync(dir, { recursive: true, force: true })
    }
    if (origProjectDir !== undefined) {
      process.env.CLAUDE_PROJECT_DIR = origProjectDir
    } else {
      delete process.env.CLAUDE_PROJECT_DIR
    }
    clearSubphasePatternCache()
  })

  it('loads package config when no project override exists', async () => {
    const tmpDir = makeTmpDir('no-override')
    tmpDirs.push(tmpDir)
    const projDir = join(tmpDir, 'proj')
    mkdirSync(join(projDir, '.claude'), { recursive: true })
    process.env.CLAUDE_PROJECT_DIR = projDir

    const config = await loadSubphasePatterns()
    expect(config.subphase_patterns['impl-verify']).toBeDefined()
    expect(config.subphase_patterns['impl-verify'].steps).toHaveLength(2)
    expect(config.subphase_patterns['impl-verify'].steps[0].id_suffix).toBe('impl')
    expect(config.subphase_patterns['impl-verify'].steps[1].id_suffix).toBe('verify')
  })

  it('project config overrides a package pattern', async () => {
    const tmpDir = makeTmpDir('project-override')
    tmpDirs.push(tmpDir)

    const projDir = join(tmpDir, 'proj')
    mkdirSync(join(projDir, '.kata'), { recursive: true })
    writeSubphasePatternsYaml(join(projDir, '.kata'), {
      subphase_patterns: {
        'impl-verify': {
          description: 'Custom impl-verify',
          steps: [
            {
              id_suffix: 'implement',
              title_template: 'CUSTOM IMPL - {task_summary}',
              todo_template: 'Custom implement {task_summary}',
              active_form: 'Custom implementing {phase_name}',
              labels: ['custom'],
            },
          ],
        },
      },
    })
    process.env.CLAUDE_PROJECT_DIR = projDir

    const config = await loadSubphasePatterns()
    // Project override wins
    expect(config.subphase_patterns['impl-verify'].description).toBe('Custom impl-verify')
    expect(config.subphase_patterns['impl-verify'].steps).toHaveLength(1)
    expect(config.subphase_patterns['impl-verify'].steps[0].id_suffix).toBe('implement')
  })

  it('project config adds new patterns', async () => {
    const tmpDir = makeTmpDir('project-add')
    tmpDirs.push(tmpDir)

    const projDir = join(tmpDir, 'proj')
    mkdirSync(join(projDir, '.kata'), { recursive: true })
    writeSubphasePatternsYaml(join(projDir, '.kata'), {
      subphase_patterns: {
        'impl-test-verify': {
          description: 'Implement, test, then verify',
          steps: [
            {
              id_suffix: 'impl',
              title_template: 'IMPL',
              todo_template: 'Implement',
              active_form: 'Implementing',
            },
            {
              id_suffix: 'test',
              title_template: 'TEST',
              todo_template: 'Test',
              active_form: 'Testing',
              depends_on_previous: true,
            },
            {
              id_suffix: 'verify',
              title_template: 'VERIFY',
              todo_template: 'Verify',
              active_form: 'Verifying',
              depends_on_previous: true,
            },
          ],
        },
      },
    })
    process.env.CLAUDE_PROJECT_DIR = projDir

    const config = await loadSubphasePatterns()
    // New pattern added
    expect(config.subphase_patterns['impl-test-verify']).toBeDefined()
    expect(config.subphase_patterns['impl-test-verify'].steps).toHaveLength(3)
    // Package patterns still present
    expect(config.subphase_patterns['impl-verify']).toBeDefined()
  })

  it('handles invalid project subphase-patterns.yaml gracefully', async () => {
    const tmpDir = makeTmpDir('invalid-project')
    tmpDirs.push(tmpDir)

    const projDir = join(tmpDir, 'proj')
    mkdirSync(join(projDir, '.kata'), { recursive: true })
    writeFileSync(
      join(projDir, '.kata', 'subphase-patterns.yaml'),
      'this is not valid yaml: [[[{{{',
    )
    process.env.CLAUDE_PROJECT_DIR = projDir

    // Should not throw — falls back to package defaults
    const config = await loadSubphasePatterns()
    expect(config.subphase_patterns['impl-verify']).toBeDefined()
  })

  it('handles schema-invalid project config gracefully', async () => {
    const tmpDir = makeTmpDir('schema-invalid')
    tmpDirs.push(tmpDir)

    const projDir = join(tmpDir, 'proj')
    mkdirSync(join(projDir, '.kata'), { recursive: true })
    writeSubphasePatternsYaml(join(projDir, '.kata'), {
      subphase_patterns: {
        bad: {
          description: 'Bad pattern',
          // missing steps
        },
      },
    })
    process.env.CLAUDE_PROJECT_DIR = projDir

    // Should not throw — falls back to package defaults
    const config = await loadSubphasePatterns()
    expect(config.subphase_patterns['impl-verify']).toBeDefined()
    // Bad pattern should NOT appear
    expect(config.subphase_patterns.bad).toBeUndefined()
  })

  it('cache returns same instance on repeated calls', async () => {
    const tmpDir = makeTmpDir('cache-hit')
    tmpDirs.push(tmpDir)
    const projDir = join(tmpDir, 'proj')
    mkdirSync(join(projDir, '.claude'), { recursive: true })
    process.env.CLAUDE_PROJECT_DIR = projDir

    const first = await loadSubphasePatterns()
    const second = await loadSubphasePatterns()
    expect(first).toBe(second) // same reference
  })

  it('clearSubphasePatternCache forces fresh load', async () => {
    const tmpDir = makeTmpDir('cache-clear')
    tmpDirs.push(tmpDir)
    const projDir = join(tmpDir, 'proj')
    mkdirSync(join(projDir, '.claude'), { recursive: true })
    process.env.CLAUDE_PROJECT_DIR = projDir

    const first = await loadSubphasePatterns()
    clearSubphasePatternCache()
    const second = await loadSubphasePatterns()
    // Same content but different reference
    expect(first).not.toBe(second)
    expect(first.subphase_patterns['impl-verify'].steps[0].id_suffix).toBe(
      second.subphase_patterns['impl-verify'].steps[0].id_suffix,
    )
  })

  it('supports .claude/workflows layout (backwards compat)', async () => {
    const tmpDir = makeTmpDir('old-layout')
    tmpDirs.push(tmpDir)

    const projDir = join(tmpDir, 'proj')
    mkdirSync(join(projDir, '.claude', 'workflows'), { recursive: true })
    writeSubphasePatternsYaml(join(projDir, '.claude', 'workflows'), {
      subphase_patterns: {
        'impl-verify': {
          description: 'Old layout pattern',
          steps: [
            {
              id_suffix: 'impl',
              title_template: 'OLD IMPL',
              todo_template: 'Old implement',
              active_form: 'Old implementing',
            },
          ],
        },
      },
    })
    process.env.CLAUDE_PROJECT_DIR = projDir

    const config = await loadSubphasePatterns()
    expect(config.subphase_patterns['impl-verify'].description).toBe('Old layout pattern')
  })
})
