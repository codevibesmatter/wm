import { existsSync, readFileSync, writeFileSync, mkdirSync, cpSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { isManagerInitialized } from '../../manager/paths.js'
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
 * kata projects sync <source> <target> [--wm-yaml] [--modes] [--templates] [--dry-run]
 *
 * Copy selected config from source to target project.
 */
export async function syncProjects(args: string[]): Promise<void> {
  const dryRun = args.includes('--dry-run')
  const onlyWmYaml = args.includes('--wm-yaml')
  const onlyModes = args.includes('--modes')
  const onlyTemplates = args.includes('--templates')
  const syncAll = !onlyWmYaml && !onlyModes && !onlyTemplates
  const positional = args.filter((a) => !a.startsWith('--'))

  if (!isManagerInitialized()) {
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.error('Manager not initialized. Run: kata projects init-manager')
    process.exitCode = 1
    return
  }

  if (positional.length < 2) {
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.error('Usage: kata projects sync <source> <target> [--wm-yaml] [--modes] [--templates] [--dry-run]')
    process.exitCode = 1
    return
  }

  const index = readIndex()
  const source = findProject(index, positional[0])
  const target = findProject(index, positional[1])

  if (!source) {
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.error(`Source project not found: ${positional[0]}`)
    process.exitCode = 1
    return
  }
  if (!target) {
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.error(`Target project not found: ${positional[1]}`)
    process.exitCode = 1
    return
  }

  const sourceName = source.alias || source.name
  const targetName = target.alias || target.name
  const synced: string[] = []

  // Sync wm.yaml
  if (syncAll || onlyWmYaml) {
    const srcFile = join(getConfigDir(source), 'wm.yaml')
    const dstFile = join(getConfigDir(target), 'wm.yaml')

    if (existsSync(srcFile)) {
      if (dryRun) {
        // biome-ignore lint/suspicious/noConsole: CLI output
        console.error(`[dry-run] Would copy wm.yaml: ${sourceName} → ${targetName}`)
      } else {
        mkdirSync(dirname(dstFile), { recursive: true })
        writeFileSync(dstFile, readFileSync(srcFile))
        synced.push('wm.yaml')
      }
    }
  }

  // Sync modes.yaml
  if (syncAll || onlyModes) {
    const srcFile = join(getConfigDir(source), 'modes.yaml')
    const dstFile = join(getConfigDir(target), 'modes.yaml')

    if (existsSync(srcFile)) {
      if (dryRun) {
        // biome-ignore lint/suspicious/noConsole: CLI output
        console.error(`[dry-run] Would copy modes.yaml: ${sourceName} → ${targetName}`)
      } else {
        mkdirSync(dirname(dstFile), { recursive: true })
        writeFileSync(dstFile, readFileSync(srcFile))
        synced.push('modes.yaml')
      }
    }
  }

  // Sync templates
  if (syncAll || onlyTemplates) {
    const srcDir = getTemplatesDir(source)
    const dstDir = getTemplatesDir(target)

    if (existsSync(srcDir)) {
      if (dryRun) {
        // biome-ignore lint/suspicious/noConsole: CLI output
        console.error(`[dry-run] Would copy templates/: ${sourceName} → ${targetName}`)
      } else {
        mkdirSync(dstDir, { recursive: true })
        cpSync(srcDir, dstDir, { recursive: true })
        synced.push('templates/')
      }
    }
  }

  if (dryRun) {
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.error('Dry run complete. No changes made.')
    return
  }

  // biome-ignore lint/suspicious/noConsole: CLI output
  console.log(
    JSON.stringify(
      {
        action: 'synced',
        source: sourceName,
        target: targetName,
        files: synced,
      },
      null,
      2,
    ),
  )
}
