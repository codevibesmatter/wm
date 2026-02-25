import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import jsYaml from 'js-yaml'

export interface ConfigDiff {
  shared: Record<string, unknown>
  different: Record<string, { a: unknown; b: unknown }>
  only_a: Record<string, unknown>
  only_b: Record<string, unknown>
}

export interface ModesDiff {
  shared_modes: string[]
  only_a: string[]
  only_b: string[]
  different_modes: string[]
}

export interface TemplateDiff {
  name: string
  status: 'same' | 'different' | 'only_a' | 'only_b'
}

/**
 * Deep compare two values for equality (JSON-level comparison).
 */
function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Diff two wm.yaml config objects.
 */
export function diffWmYaml(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): ConfigDiff {
  const shared: Record<string, unknown> = {}
  const different: Record<string, { a: unknown; b: unknown }> = {}
  const only_a: Record<string, unknown> = {}
  const only_b: Record<string, unknown> = {}

  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)])

  for (const key of allKeys) {
    const inA = key in a
    const inB = key in b

    if (inA && inB) {
      if (deepEqual(a[key], b[key])) {
        shared[key] = a[key]
      } else {
        different[key] = { a: a[key], b: b[key] }
      }
    } else if (inA) {
      only_a[key] = a[key]
    } else {
      only_b[key] = b[key]
    }
  }

  return { shared, different, only_a, only_b }
}

/**
 * Diff two modes.yaml config objects.
 */
export function diffModesYaml(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): ModesDiff {
  const modesA = Object.keys((a.modes as Record<string, unknown>) || {})
  const modesB = Object.keys((b.modes as Record<string, unknown>) || {})

  const setA = new Set(modesA)
  const setB = new Set(modesB)

  const shared_modes: string[] = []
  const different_modes: string[] = []
  const only_a: string[] = []
  const only_b: string[] = []

  for (const mode of modesA) {
    if (setB.has(mode)) {
      const mA = (a.modes as Record<string, unknown>)[mode]
      const mB = (b.modes as Record<string, unknown>)[mode]
      if (deepEqual(mA, mB)) {
        shared_modes.push(mode)
      } else {
        different_modes.push(mode)
      }
    } else {
      only_a.push(mode)
    }
  }

  for (const mode of modesB) {
    if (!setA.has(mode)) {
      only_b.push(mode)
    }
  }

  return { shared_modes, only_a, only_b, different_modes }
}

/**
 * Diff template directories between two projects.
 */
export function diffTemplates(pathA: string, pathB: string): TemplateDiff[] {
  const results: TemplateDiff[] = []

  const filesA = existsSync(pathA) ? readdirSync(pathA).filter((f) => f.endsWith('.md')) : []
  const filesB = existsSync(pathB) ? readdirSync(pathB).filter((f) => f.endsWith('.md')) : []

  const setB = new Set(filesB)

  for (const file of filesA) {
    if (setB.has(file)) {
      const contentA = readFileSync(join(pathA, file), 'utf-8')
      const contentB = readFileSync(join(pathB, file), 'utf-8')
      results.push({
        name: file,
        status: contentA === contentB ? 'same' : 'different',
      })
    } else {
      results.push({ name: file, status: 'only_a' })
    }
  }

  for (const file of filesB) {
    if (!new Set(filesA).has(file)) {
      results.push({ name: file, status: 'only_b' })
    }
  }

  return results
}

/**
 * Load a YAML file as a raw object.
 */
export function loadYamlFile(filePath: string): Record<string, unknown> | null {
  if (!existsSync(filePath)) return null
  try {
    return (jsYaml.load(readFileSync(filePath, 'utf-8')) as Record<string, unknown>) || null
  } catch {
    return null
  }
}
