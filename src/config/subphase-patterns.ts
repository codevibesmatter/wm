// Subphase pattern config: Zod schemas, parser, and 2-tier merge loader (package → project)
import { existsSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import jsYaml from 'js-yaml'
import { z } from 'zod'
import { getPackageRoot, getProjectSubphasePatternsPath } from '../session/lookup.js'
import { join } from 'node:path'

// ── Zod Schemas ──

// Re-export the step-level schema from validation (unchanged)
export { subphasePatternSchema } from '../validation/schemas.js'
export type { SubphasePattern } from '../validation/schemas.js'

import { subphasePatternSchema } from '../validation/schemas.js'

export const SubphasePatternDefinitionSchema = z.object({
  description: z.string().min(1),
  steps: z.array(subphasePatternSchema).min(1),
})

export const SubphasePatternConfigSchema = z.object({
  subphase_patterns: z.record(z.string(), SubphasePatternDefinitionSchema),
})

// ── Types ──

export type SubphasePatternDefinition = z.infer<typeof SubphasePatternDefinitionSchema>
export type SubphasePatternConfig = z.infer<typeof SubphasePatternConfigSchema>

// ── Parser ──

async function parseSubphasePatternConfig(configPath: string): Promise<SubphasePatternConfig> {
  const raw = await fs.readFile(configPath, 'utf-8')
  const parsed = jsYaml.load(raw, { schema: jsYaml.CORE_SCHEMA })
  return SubphasePatternConfigSchema.parse(parsed)
}

// ── Merge ──

function mergeSubphasePatternConfig(
  base: SubphasePatternConfig,
  overlay: SubphasePatternConfig,
): SubphasePatternConfig {
  return {
    subphase_patterns: {
      ...base.subphase_patterns,
      ...overlay.subphase_patterns,
    },
  }
}

// ── Singleton Cache ──

let cachedInstance: SubphasePatternConfig | null = null
let cachedKey: string | null = null

/**
 * Load subphase pattern config with 2-tier merge: package → project.
 * Package-level batteries/subphase-patterns.yaml is always the base.
 * Project-level .kata/subphase-patterns.yaml overrides per-pattern.
 */
export async function loadSubphasePatterns(): Promise<SubphasePatternConfig> {
  const packagePath = join(getPackageRoot(), 'batteries', 'subphase-patterns.yaml')

  let projectPath: string | null = null
  try {
    const candidate = getProjectSubphasePatternsPath()
    if (existsSync(candidate)) {
      projectPath = candidate
    }
  } catch {
    // No project dir — package defaults only
  }

  const cacheKey = `${packagePath}:${projectPath ?? ''}`
  if (cachedInstance && cachedKey === cacheKey) {
    return cachedInstance
  }

  let merged = await parseSubphasePatternConfig(packagePath)

  if (projectPath) {
    try {
      const projectConfig = await parseSubphasePatternConfig(projectPath)
      merged = mergeSubphasePatternConfig(merged, projectConfig)
    } catch (err) {
      // biome-ignore lint/suspicious/noConsole: surface config parse errors to user
      console.warn(
        `⚠️  Warning: Failed to parse project subphase-patterns.yaml at ${projectPath}: ${err instanceof Error ? err.message : err}`,
      )
    }
  }

  cachedInstance = merged
  cachedKey = cacheKey
  return cachedInstance
}

/**
 * Clear cached config (useful for testing)
 */
export function clearSubphasePatternCache(): void {
  cachedInstance = null
  cachedKey = null
}
