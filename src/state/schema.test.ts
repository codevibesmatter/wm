import { describe, it, expect } from 'bun:test'
import { STOP_CONDITION_TYPES, VALID_CATEGORIES, ModeConfigSchema } from './schema.js'

describe('STOP_CONDITION_TYPES', () => {
  it('contains expected conditions', () => {
    expect(STOP_CONDITION_TYPES).toContain('tasks_complete')
    expect(STOP_CONDITION_TYPES).toContain('committed')
    expect(STOP_CONDITION_TYPES).toContain('pushed')
    expect(STOP_CONDITION_TYPES).toContain('verification')
    expect(STOP_CONDITION_TYPES).toContain('tests_pass')
    expect(STOP_CONDITION_TYPES).toContain('feature_tests_added')
  })
})

describe('VALID_CATEGORIES', () => {
  it('contains expected categories', () => {
    expect(VALID_CATEGORIES).toContain('planning')
    expect(VALID_CATEGORIES).toContain('implementation')
    expect(VALID_CATEGORIES).toContain('investigation')
    expect(VALID_CATEGORIES).toContain('management')
    expect(VALID_CATEGORIES).toContain('special')
    expect(VALID_CATEGORIES).toContain('system')
  })

  it('is importable from schema.ts', () => {
    expect(VALID_CATEGORIES.length).toBeGreaterThan(0)
  })
})

describe('ModeConfigSchema stop_conditions validation', () => {
  const validMode = {
    name: 'Test',
    description: 'Test mode',
    template: 'test.md',
    category: 'special',
  }

  it('accepts valid stop conditions', () => {
    const data = {
      ...validMode,
      stop_conditions: ['tasks_complete', 'committed'],
    }

    const result = ModeConfigSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('rejects unknown stop condition strings', () => {
    const data = {
      ...validMode,
      stop_conditions: ['tasks_complete', 'bogus'],
    }

    const result = ModeConfigSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('accepts empty stop_conditions', () => {
    const data = {
      ...validMode,
      stop_conditions: [],
    }

    const result = ModeConfigSchema.safeParse(data)
    expect(result.success).toBe(true)
  })
})

describe('ModeConfigSchema micro_planning removed', () => {
  it('does not include micro_planning in schema shape', () => {
    // ModeConfigSchema is strict (no passthrough), so extra fields would be stripped
    // The important thing is the field is not in the type
    const shape = ModeConfigSchema.shape
    expect('micro_planning' in shape).toBe(false)
  })
})

describe('ModeConfigSchema new fields', () => {
  const validMode = {
    name: 'Test',
    description: 'Test mode',
    template: 'test.md',
    category: 'special',
  }

  it('accepts notes_file_template', () => {
    const data = {
      ...validMode,
      notes_file_template: 'planning/research/{date}-{slug}.md',
    }

    const result = ModeConfigSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('accepts issue_label', () => {
    const data = {
      ...validMode,
      issue_label: 'bug',
    }

    const result = ModeConfigSchema.safeParse(data)
    expect(result.success).toBe(true)
  })
})
