import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { z } from 'zod'
import jsYaml from 'js-yaml'
import { getProjectsIndexPath } from './paths.js'
import { isKataEnabled } from './discovery.js'

/**
 * Schema for a single project entry in the registry.
 */
export const ProjectEntrySchema = z.object({
  path: z.string(),
  alias: z.string().optional(),
  name: z.string(),
  wm_version: z.string().optional(),
  kata_layout: z.enum(['.kata', '.claude']),
  discovered_from: z.enum(['auto', 'manual']),
  added_at: z.string(),
  last_checked_at: z.string().optional(),
  modes: z.array(z.string()).optional(),
  custom_modes: z.array(z.string()).optional(),
  last_session: z
    .object({
      id: z.string(),
      mode: z.string(),
      timestamp: z.string(),
    })
    .optional(),
})

export type ProjectEntry = z.infer<typeof ProjectEntrySchema>

/**
 * Schema for the projects index file.
 */
export const ProjectsIndexSchema = z.object({
  version: z.literal(1),
  updated_at: z.string(),
  projects: z.array(ProjectEntrySchema),
})

export type ProjectsIndex = z.infer<typeof ProjectsIndexSchema>

/**
 * Read the projects index from disk.
 * Returns a default empty index if the file doesn't exist.
 */
export function readIndex(): ProjectsIndex {
  const indexPath = getProjectsIndexPath()

  if (!existsSync(indexPath)) {
    return {
      version: 1,
      updated_at: new Date().toISOString(),
      projects: [],
    }
  }

  const raw = JSON.parse(readFileSync(indexPath, 'utf-8'))
  return ProjectsIndexSchema.parse(raw)
}

/**
 * Write the projects index to disk.
 */
export function writeIndex(index: ProjectsIndex): void {
  const indexPath = getProjectsIndexPath()
  mkdirSync(dirname(indexPath), { recursive: true })

  const updated: ProjectsIndex = {
    ...index,
    updated_at: new Date().toISOString(),
  }

  writeFileSync(indexPath, JSON.stringify(updated, null, 2) + '\n')
}

/**
 * Add a project to the index.
 * Returns false if the project is already registered (by path).
 */
export function addProject(
  index: ProjectsIndex,
  entry: Omit<ProjectEntry, 'added_at'>,
): { index: ProjectsIndex; added: boolean } {
  const existing = index.projects.find((p) => p.path === entry.path)
  if (existing) {
    return { index, added: false }
  }

  const newEntry: ProjectEntry = {
    ...entry,
    added_at: new Date().toISOString(),
  }

  return {
    index: {
      ...index,
      projects: [...index.projects, newEntry],
    },
    added: true,
  }
}

/**
 * Remove a project from the index by alias or path.
 * Returns the updated index and whether a project was removed.
 */
export function removeProject(
  index: ProjectsIndex,
  aliasOrPath: string,
): { index: ProjectsIndex; removed: boolean } {
  const before = index.projects.length
  const projects = index.projects.filter(
    (p) => p.path !== aliasOrPath && p.alias !== aliasOrPath && p.name !== aliasOrPath,
  )

  return {
    index: { ...index, projects },
    removed: projects.length < before,
  }
}

/**
 * Refresh a project's metadata (layout, version, etc.).
 * Returns the updated entry.
 */
export function refreshProject(entry: ProjectEntry): ProjectEntry {
  const kataCheck = isKataEnabled(entry.path)
  if (!kataCheck.enabled) return entry

  const updated: ProjectEntry = {
    ...entry,
    kata_layout: kataCheck.layout,
    last_checked_at: new Date().toISOString(),
  }

  // Try to read wm_version from the project's wm.yaml
  try {
    const kataDir = kataCheck.layout === '.kata' ? '.kata' : join('.claude', 'workflows')
    const wmYamlPath = join(entry.path, kataDir, 'wm.yaml')
    if (existsSync(wmYamlPath)) {
      const raw = jsYaml.load(readFileSync(wmYamlPath, 'utf-8')) as Record<string, unknown> | null
      if (raw?.wm_version && typeof raw.wm_version === 'string') {
        updated.wm_version = raw.wm_version
      }
    }
  } catch {
    // Config read failure is non-fatal
  }

  return updated
}

/**
 * Find a project by alias, path, or name.
 */
export function findProject(
  index: ProjectsIndex,
  query: string,
): ProjectEntry | undefined {
  return index.projects.find(
    (p) => p.path === query || p.alias === query || p.name === query,
  )
}
