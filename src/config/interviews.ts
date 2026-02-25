// Interview config: Zod schemas, parser, and 2-tier merge loader (package → project)
import { existsSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import jsYaml from 'js-yaml'
import { z } from 'zod'
import { getPackageRoot, getProjectInterviewsPath } from '../session/lookup.js'
import { join } from 'node:path'

// ── Zod Schemas ──

export const InterviewOptionSchema = z.object({
  label: z.string().min(1),
  description: z.string().min(1),
})

export const InterviewRoundSchema = z.object({
  header: z.string().min(1),
  question: z.string().min(1),
  options: z.array(InterviewOptionSchema).min(1),
})

export const InterviewCategorySchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  rounds: z.array(InterviewRoundSchema).min(1),
})

export const InterviewConfigSchema = z.object({
  interview_categories: z.record(z.string(), InterviewCategorySchema),
})

// ── Types ──

export type InterviewOption = z.infer<typeof InterviewOptionSchema>
export type InterviewRound = z.infer<typeof InterviewRoundSchema>
export type InterviewCategory = z.infer<typeof InterviewCategorySchema>
export type InterviewConfig = z.infer<typeof InterviewConfigSchema>

// ── Parser ──

async function parseInterviewConfig(configPath: string): Promise<InterviewConfig> {
  const raw = await fs.readFile(configPath, 'utf-8')
  const parsed = jsYaml.load(raw, { schema: jsYaml.CORE_SCHEMA })
  return InterviewConfigSchema.parse(parsed)
}

// ── Merge ──

function mergeInterviewConfig(base: InterviewConfig, overlay: InterviewConfig): InterviewConfig {
  return {
    interview_categories: {
      ...base.interview_categories,
      ...overlay.interview_categories,
    },
  }
}

// ── Singleton Cache ──

let cachedInstance: InterviewConfig | null = null
let cachedKey: string | null = null

/**
 * Load interview config with 2-tier merge: package → project.
 * Package-level batteries/interviews.yaml is always the base.
 * Project-level .kata/interviews.yaml overrides per-category.
 */
export async function loadInterviewConfig(): Promise<InterviewConfig> {
  const packagePath = join(getPackageRoot(), 'batteries', 'interviews.yaml')

  let projectPath: string | null = null
  try {
    const candidate = getProjectInterviewsPath()
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

  let merged = await parseInterviewConfig(packagePath)

  if (projectPath) {
    try {
      const projectConfig = await parseInterviewConfig(projectPath)
      merged = mergeInterviewConfig(merged, projectConfig)
    } catch (err) {
      // biome-ignore lint/suspicious/noConsole: surface config parse errors to user
      console.warn(
        `⚠️  Warning: Failed to parse project interviews.yaml at ${projectPath}: ${err instanceof Error ? err.message : err}`,
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
export function clearInterviewConfigCache(): void {
  cachedInstance = null
  cachedKey = null
}
