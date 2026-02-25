import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as os from 'node:os'
import {
  readIndex,
  writeIndex,
  addProject,
  removeProject,
  findProject,
  ProjectsIndexSchema,
  type ProjectsIndex,
  type ProjectEntry,
} from './registry.js'

function makeTmpDir(): string {
  const dir = join(
    os.tmpdir(),
    `wm-registry-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )
  mkdirSync(dir, { recursive: true })
  return dir
}

function makeEmptyIndex(): ProjectsIndex {
  return {
    version: 1,
    updated_at: new Date().toISOString(),
    projects: [],
  }
}

function makeEntry(overrides: Partial<ProjectEntry> = {}): Omit<ProjectEntry, 'added_at'> {
  return {
    path: '/tmp/test-project',
    name: 'test-project',
    kata_layout: '.kata',
    discovered_from: 'manual',
    ...overrides,
  }
}

describe('addProject', () => {
  it('adds a new project to the index', () => {
    const index = makeEmptyIndex()
    const result = addProject(index, makeEntry())

    expect(result.added).toBe(true)
    expect(result.index.projects).toHaveLength(1)
    expect(result.index.projects[0].path).toBe('/tmp/test-project')
    expect(result.index.projects[0].added_at).toBeDefined()
  })

  it('rejects duplicate paths', () => {
    const index = makeEmptyIndex()
    const first = addProject(index, makeEntry())
    const second = addProject(first.index, makeEntry())

    expect(second.added).toBe(false)
    expect(second.index.projects).toHaveLength(1)
  })

  it('preserves existing entries', () => {
    const index = makeEmptyIndex()
    const first = addProject(index, makeEntry({ path: '/tmp/a', name: 'a' }))
    const second = addProject(first.index, makeEntry({ path: '/tmp/b', name: 'b' }))

    expect(second.added).toBe(true)
    expect(second.index.projects).toHaveLength(2)
  })
})

describe('removeProject', () => {
  it('removes by path', () => {
    const index = makeEmptyIndex()
    const added = addProject(index, makeEntry())
    const result = removeProject(added.index, '/tmp/test-project')

    expect(result.removed).toBe(true)
    expect(result.index.projects).toHaveLength(0)
  })

  it('removes by alias', () => {
    const index = makeEmptyIndex()
    const added = addProject(index, makeEntry({ alias: 'tp' }))
    const result = removeProject(added.index, 'tp')

    expect(result.removed).toBe(true)
    expect(result.index.projects).toHaveLength(0)
  })

  it('removes by name', () => {
    const index = makeEmptyIndex()
    const added = addProject(index, makeEntry({ name: 'my-proj' }))
    const result = removeProject(added.index, 'my-proj')

    expect(result.removed).toBe(true)
  })

  it('returns false for non-existent project', () => {
    const result = removeProject(makeEmptyIndex(), 'nope')
    expect(result.removed).toBe(false)
  })
})

describe('findProject', () => {
  it('finds by path', () => {
    const index = makeEmptyIndex()
    const { index: updated } = addProject(index, makeEntry())
    const found = findProject(updated, '/tmp/test-project')

    expect(found).toBeDefined()
    expect(found!.name).toBe('test-project')
  })

  it('finds by alias', () => {
    const index = makeEmptyIndex()
    const { index: updated } = addProject(index, makeEntry({ alias: 'tp' }))
    const found = findProject(updated, 'tp')

    expect(found).toBeDefined()
  })

  it('returns undefined for no match', () => {
    const found = findProject(makeEmptyIndex(), 'nope')
    expect(found).toBeUndefined()
  })
})

describe('ProjectsIndexSchema', () => {
  it('validates a valid index', () => {
    const data = {
      version: 1,
      updated_at: '2026-01-01T00:00:00Z',
      projects: [
        {
          path: '/tmp/test',
          name: 'test',
          kata_layout: '.kata',
          discovered_from: 'auto',
          added_at: '2026-01-01T00:00:00Z',
        },
      ],
    }

    expect(() => ProjectsIndexSchema.parse(data)).not.toThrow()
  })

  it('rejects invalid version', () => {
    const data = {
      version: 2,
      updated_at: '2026-01-01T00:00:00Z',
      projects: [],
    }

    expect(() => ProjectsIndexSchema.parse(data)).toThrow()
  })
})
