import { isManagerInitialized } from '../../manager/paths.js'
import { scanClaudeProjects } from '../../manager/discovery.js'
import { readIndex, writeIndex, addProject as addToIndex, refreshProject } from '../../manager/registry.js'
import type { ProjectsIndex } from '../../manager/registry.js'

/**
 * kata projects list [--json] [--refresh]
 *
 * List all registered projects. Optionally refresh metadata.
 */
export async function listProjects(args: string[]): Promise<void> {
  const jsonOutput = args.includes('--json')
  const refresh = args.includes('--refresh')

  if (!isManagerInitialized()) {
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.error('Manager not initialized. Run: kata projects init-manager')
    process.exitCode = 1
    return
  }

  let index = readIndex()

  // Re-scan and refresh if requested
  if (refresh) {
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.error('Refreshing project registry...')

    // Add any newly discovered projects
    const discovered = scanClaudeProjects()
    for (const project of discovered) {
      const result = addToIndex(index, project)
      if (result.added) {
        index = result.index
      }
    }

    // Refresh metadata for all projects
    index = {
      ...index,
      projects: index.projects.map(refreshProject),
    }

    writeIndex(index)
  }

  if (jsonOutput) {
    const output = index.projects.map((p) => ({
      name: p.alias || p.name,
      path: p.path,
      wm_version: p.wm_version || 'unknown',
      last_mode: p.last_session?.mode || '-',
      kata_layout: p.kata_layout,
    }))
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.log(JSON.stringify(output, null, 2))
    return
  }

  // Table output
  if (index.projects.length === 0) {
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.log('No projects registered. Run: kata projects init-manager')
    return
  }

  printTable(index)
}

function printTable(index: ProjectsIndex): void {
  const rows = index.projects.map((p) => ({
    name: p.alias || p.name,
    version: p.wm_version || '-',
    lastMode: p.last_session?.mode || '-',
    layout: p.kata_layout,
    path: p.path,
  }))

  // Calculate column widths
  const nameW = Math.max(4, ...rows.map((r) => r.name.length))
  const verW = Math.max(7, ...rows.map((r) => r.version.length))
  const modeW = Math.max(9, ...rows.map((r) => r.lastMode.length))
  const layoutW = Math.max(6, ...rows.map((r) => r.layout.length))

  const header = [
    'Name'.padEnd(nameW),
    'Version'.padEnd(verW),
    'Last Mode'.padEnd(modeW),
    'Layout'.padEnd(layoutW),
    'Path',
  ].join('  ')

  const separator = '─'.repeat(header.length)

  // biome-ignore lint/suspicious/noConsole: CLI output
  console.log(header)
  // biome-ignore lint/suspicious/noConsole: CLI output
  console.log(separator)

  for (const row of rows) {
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.log(
      [
        row.name.padEnd(nameW),
        row.version.padEnd(verW),
        row.lastMode.padEnd(modeW),
        row.layout.padEnd(layoutW),
        row.path,
      ].join('  '),
    )
  }
}
