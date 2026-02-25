import { MANAGER_ROOT, ensureManagerDir, isManagerInitialized, getProjectsIndexPath } from '../../manager/paths.js'
import { scanClaudeProjects } from '../../manager/discovery.js'
import { readIndex, writeIndex, addProject as addToIndex } from '../../manager/registry.js'

/**
 * kata projects init-manager [--force]
 *
 * Initialize the kata manager at ~/.kata/manager/.
 * Auto-discovers existing kata projects from ~/.claude/projects/.
 */
export async function initManager(args: string[]): Promise<void> {
  const force = args.includes('--force')

  if (isManagerInitialized() && !force) {
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.error('Manager already initialized at:', MANAGER_ROOT)
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.error('Use --force to re-initialize (preserves existing registry entries)')
    process.exitCode = 1
    return
  }

  // Create directory structure
  ensureManagerDir()

  // Load existing index (if --force, preserves entries) or start fresh
  let index = readIndex()

  // Auto-discover kata projects
  // biome-ignore lint/suspicious/noConsole: CLI output
  console.error('Scanning for kata-enabled projects...')
  const discovered = scanClaudeProjects()

  let addedCount = 0
  for (const project of discovered) {
    const result = addToIndex(index, project)
    if (result.added) {
      index = result.index
      addedCount++
      // biome-ignore lint/suspicious/noConsole: CLI output
      console.error(`  Found: ${project.name} (${project.path})`)
    }
  }

  // Write the index
  writeIndex(index)

  // biome-ignore lint/suspicious/noConsole: CLI output
  console.log(
    JSON.stringify(
      {
        manager_path: MANAGER_ROOT,
        projects_discovered: addedCount,
        total_projects: index.projects.length,
      },
      null,
      2,
    ),
  )
}
