import { existsSync, mkdirSync, cpSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MANAGER_ROOT, isManagerInitialized } from '../../manager/paths.js'
import { readIndex, findProject } from '../../manager/registry.js'
import type { ProjectEntry } from '../../manager/registry.js'

function getConfigDir(project: ProjectEntry): string {
  return project.kata_layout === '.kata'
    ? join(project.path, '.kata')
    : join(project.path, '.claude', 'workflows')
}

function getTemplatesDir(project: ProjectEntry): string {
  return project.kata_layout === '.kata'
    ? join(project.path, '.kata', 'templates')
    : join(project.path, '.claude', 'workflows', 'templates')
}

/**
 * Create a timestamped backup of a project's config.
 */
function backupProject(project: ProjectEntry): { backupDir: string; files: string[] } {
  const name = project.alias || project.name
  const timestamp = new Date().toISOString().replace(/[:.]/g, '').replace('T', 'T').slice(0, 15) + 'Z'
  const backupDir = join(MANAGER_ROOT, 'backups', name, timestamp)

  mkdirSync(backupDir, { recursive: true })
  const files: string[] = []

  const configDir = getConfigDir(project)

  // Copy wm.yaml
  const wmYamlSrc = join(configDir, 'wm.yaml')
  if (existsSync(wmYamlSrc)) {
    cpSync(wmYamlSrc, join(backupDir, 'wm.yaml'))
    files.push('wm.yaml')
  }

  // Copy modes.yaml
  const modesYamlSrc = join(configDir, 'modes.yaml')
  if (existsSync(modesYamlSrc)) {
    cpSync(modesYamlSrc, join(backupDir, 'modes.yaml'))
    files.push('modes.yaml')
  }

  // Copy templates
  const templatesDir = getTemplatesDir(project)
  if (existsSync(templatesDir)) {
    const destTemplates = join(backupDir, 'templates')
    mkdirSync(destTemplates, { recursive: true })
    cpSync(templatesDir, destTemplates, { recursive: true })
    files.push('templates/')
  }

  return { backupDir, files }
}

/**
 * kata projects backup [<project>] [--list] [--restore=<timestamp>]
 *
 * Create or list config backups.
 */
export async function backupProjects(args: string[]): Promise<void> {
  const listMode = args.includes('--list')
  const restoreArg = args.find((a) => a.startsWith('--restore='))
  const restoreTimestamp = restoreArg?.slice('--restore='.length)
  const projectQuery = args.find((a) => !a.startsWith('--'))

  if (!isManagerInitialized()) {
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.error('Manager not initialized. Run: kata projects init-manager')
    process.exitCode = 1
    return
  }

  const index = readIndex()

  // List backups
  if (listMode) {
    const backupsDir = join(MANAGER_ROOT, 'backups')
    if (!existsSync(backupsDir)) {
      // biome-ignore lint/suspicious/noConsole: CLI output
      console.log('No backups found.')
      return
    }

    const projects = readdirSync(backupsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())

    if (projects.length === 0) {
      // biome-ignore lint/suspicious/noConsole: CLI output
      console.log('No backups found.')
      return
    }

    for (const proj of projects) {
      const timestamps = readdirSync(join(backupsDir, proj.name), { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort()
        .reverse()

      // biome-ignore lint/suspicious/noConsole: CLI output
      console.log(`${proj.name}: ${timestamps.length} backup(s)`)
      for (const ts of timestamps.slice(0, 5)) {
        // biome-ignore lint/suspicious/noConsole: CLI output
        console.log(`  ${ts}`)
      }
      if (timestamps.length > 5) {
        // biome-ignore lint/suspicious/noConsole: CLI output
        console.log(`  ... and ${timestamps.length - 5} more`)
      }
    }
    return
  }

  // Determine projects to back up
  let projects: ProjectEntry[]
  if (projectQuery) {
    const found = findProject(index, projectQuery)
    if (!found) {
      // biome-ignore lint/suspicious/noConsole: CLI output
      console.error(`Project not found: ${projectQuery}`)
      process.exitCode = 1
      return
    }
    projects = [found]
  } else {
    projects = index.projects
  }

  // Restore mode
  if (restoreTimestamp && projects.length === 1) {
    const project = projects[0]
    const name = project.alias || project.name
    const backupDir = join(MANAGER_ROOT, 'backups', name, restoreTimestamp)

    if (!existsSync(backupDir)) {
      // biome-ignore lint/suspicious/noConsole: CLI output
      console.error(`Backup not found: ${backupDir}`)
      process.exitCode = 1
      return
    }

    const configDir = getConfigDir(project)

    // Restore wm.yaml
    const wmSrc = join(backupDir, 'wm.yaml')
    if (existsSync(wmSrc)) {
      cpSync(wmSrc, join(configDir, 'wm.yaml'))
    }

    // Restore modes.yaml
    const modesSrc = join(backupDir, 'modes.yaml')
    if (existsSync(modesSrc)) {
      cpSync(modesSrc, join(configDir, 'modes.yaml'))
    }

    // Restore templates
    const templatesSrc = join(backupDir, 'templates')
    if (existsSync(templatesSrc)) {
      const templatesDir = getTemplatesDir(project)
      mkdirSync(templatesDir, { recursive: true })
      cpSync(templatesSrc, templatesDir, { recursive: true })
    }

    // biome-ignore lint/suspicious/noConsole: CLI output
    console.log(JSON.stringify({ action: 'restored', project: name, timestamp: restoreTimestamp }, null, 2))
    return
  }

  // Create backups
  const results: Array<{ name: string; backupDir: string; files: string[] }> = []

  for (const project of projects) {
    const result = backupProject(project)
    const name = project.alias || project.name
    results.push({ name, ...result })
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.error(`Backed up ${name}: ${result.files.join(', ')}`)
  }

  // biome-ignore lint/suspicious/noConsole: CLI output
  console.log(JSON.stringify(results, null, 2))
}
