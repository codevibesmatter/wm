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

  it('accepts instruction field', () => {
    const result = subphasePatternSchema.safeParse({
      id_suffix: 'verify',
      title_template: 'VERIFY',
      todo_template: 'Verify',
      active_form: 'Verifying',
      instruction: 'Run: kata verify-phase {phase_label} --issue={issue}',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.instruction).toBe('Run: kata verify-phase {phase_label} --issue={issue}')
    }
  })

  it('accepts agent field', () => {
    const result = subphasePatternSchema.safeParse({
      id_suffix: 'review',
      title_template: 'REVIEW',
      todo_template: 'Review',
      active_form: 'Reviewing',
      agent: {
        provider: 'codex',
        prompt: 'code-review',
        context: ['git_diff', 'spec'],
        gate: true,
        threshold: 80,
      },
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.agent?.provider).toBe('codex')
      expect(result.data.agent?.prompt).toBe('code-review')
      expect(result.data.agent?.gate).toBe(true)
      expect(result.data.agent?.threshold).toBe(80)
    }
  })

  it('accepts both instruction and agent together', () => {
    const result = subphasePatternSchema.safeParse({
      id_suffix: 'review',
      title_template: 'REVIEW',
      todo_template: 'Review',
      active_form: 'Reviewing',
      instruction: 'Review {phase_name} implementation',
      agent: {
        provider: 'gemini',
        prompt: 'code-review',
      },
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

// ── buildSpecTasks instruction/agent propagation ──

import { buildSpecTasks } from '../commands/enter/task-factory.js'

const sampleSpecPhases = [
  { id: 'auth', name: 'Authentication', tasks: ['Add login endpoint'] },
]

describe('buildSpecTasks instruction/agent propagation', () => {
  it('propagates instruction with placeholder resolution', () => {
    const pattern = [
      {
        id_suffix: 'impl',
        title_template: 'IMPL - {task_summary}',
        todo_template: 'Implement {task_summary}',
        active_form: 'Implementing {phase_name}',
        labels: [],
      },
      {
        id_suffix: 'verify',
        title_template: 'VERIFY - {phase_name}',
        todo_template: 'Verify {phase_name}',
        active_form: 'Verifying {phase_name}',
        labels: [],
        depends_on_previous: true,
        instruction: 'Run: kata verify-phase {phase_label} --issue={issue}',
      },
    ]

    const tasks = buildSpecTasks(sampleSpecPhases, 42, pattern)
    const verifyTask = tasks.find((t) => t.id === 'p2.1:verify')
    expect(verifyTask).toBeDefined()
    expect(verifyTask!.instruction).toBe('Run: kata verify-phase P2.1 --issue=42')
  })

  it('propagates agent config as kata review command', () => {
    const pattern = [
      {
        id_suffix: 'review',
        title_template: 'REVIEW - {task_summary}',
        todo_template: 'Review {task_summary}',
        active_form: 'Reviewing {phase_name}',
        labels: [],
        agent: {
          provider: 'codex',
          prompt: 'code-review',
          gate: true,
          threshold: 80,
        },
      },
    ]

    const tasks = buildSpecTasks(sampleSpecPhases, 99, pattern)
    expect(tasks).toHaveLength(1)
    expect(tasks[0].instruction).toContain('kata review --prompt=code-review')
    expect(tasks[0].instruction).toContain('--provider=codex')
    expect(tasks[0].instruction).toContain('gate: score >= 80')
  })

  it('combines instruction and agent into single instruction', () => {
    const pattern = [
      {
        id_suffix: 'review',
        title_template: 'REVIEW - {task_summary}',
        todo_template: 'Review {task_summary}',
        active_form: 'Reviewing {phase_name}',
        labels: [],
        instruction: 'Review {phase_name} implementation',
        agent: {
          provider: 'gemini',
          prompt: 'code-review',
        },
      },
    ]

    const tasks = buildSpecTasks(sampleSpecPhases, 1, pattern)
    expect(tasks[0].instruction).toContain('Review Authentication implementation')
    expect(tasks[0].instruction).toContain('kata review --prompt=code-review --provider=gemini')
  })

  it('omits instruction when pattern has neither instruction nor agent', () => {
    const pattern = [
      {
        id_suffix: 'impl',
        title_template: 'IMPL - {task_summary}',
        todo_template: 'Implement {task_summary}',
        active_form: 'Implementing {phase_name}',
        labels: [],
      },
    ]

    const tasks = buildSpecTasks(sampleSpecPhases, 1, pattern)
    expect(tasks[0].instruction).toBeUndefined()
  })
})
