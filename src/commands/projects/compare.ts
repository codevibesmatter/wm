import { join } from 'node:path'
import { isManagerInitialized } from '../../manager/paths.js'
import { readIndex, findProject } from '../../manager/registry.js'
import { diffWmYaml, diffModesYaml, diffTemplates, loadYamlFile } from '../../manager/config-diff.js'
import type { ProjectEntry } from '../../manager/registry.js'

/**
 * Get config directory path for a project.
 */
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
 * kata projects compare [<project-a>] [<project-b>] [--json]
 *
 * Compare config between two projects.
 */
export async function compareProjects(args: string[]): Promise<void> {
  const jsonOutput = args.includes('--json')
  const positional = args.filter((a) => !a.startsWith('--'))

  if (!isManagerInitialized()) {
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.error('Manager not initialized. Run: kata projects init-manager')
    process.exitCode = 1
    return
  }

  const index = readIndex()

  if (positional.length < 2) {
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.error('Usage: kata projects compare <project-a> <project-b> [--json]')
    process.exitCode = 1
    return
  }

  const projA = findProject(index, positional[0])
  const projB = findProject(index, positional[1])

  if (!projA) {
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.error(`Project not found: ${positional[0]}`)
    process.exitCode = 1
    return
  }
  if (!projB) {
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.error(`Project not found: ${positional[1]}`)
    process.exitCode = 1
    return
  }

  const nameA = projA.alias || projA.name
  const nameB = projB.alias || projB.name

  // Compare wm.yaml
  const wmA = loadYamlFile(join(getConfigDir(projA), 'wm.yaml'))
  const wmB = loadYamlFile(join(getConfigDir(projB), 'wm.yaml'))
  const wmDiff = wmA && wmB ? diffWmYaml(wmA, wmB) : null

  // Compare modes.yaml
  const modesA = loadYamlFile(join(getConfigDir(projA), 'modes.yaml'))
  const modesB = loadYamlFile(join(getConfigDir(projB), 'modes.yaml'))
  const modesDiff = modesA && modesB ? diffModesYaml(modesA, modesB) : null

  // Compare templates
  const templateDiff = diffTemplates(getTemplatesDir(projA), getTemplatesDir(projB))

  if (jsonOutput) {
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.log(
      JSON.stringify(
        {
          project_a: nameA,
          project_b: nameB,
          wm_yaml: wmDiff,
          modes_yaml: modesDiff,
          templates: templateDiff,
        },
        null,
        2,
      ),
    )
    return
  }

  // Human-readable output
  // biome-ignore lint/suspicious/noConsole: CLI output
  console.log(`Comparing: ${nameA} vs ${nameB}`)
  // biome-ignore lint/suspicious/noConsole: CLI output
  console.log('')

  if (wmDiff) {
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.log('wm.yaml:')
    const diffKeys = Object.keys(wmDiff.different)
    const onlyAKeys = Object.keys(wmDiff.only_a)
    const onlyBKeys = Object.keys(wmDiff.only_b)

    if (diffKeys.length === 0 && onlyAKeys.length === 0 && onlyBKeys.length === 0) {
      // biome-ignore lint/suspicious/noConsole: CLI output
      console.log('  (identical)')
    } else {
      for (const key of diffKeys) {
        // biome-ignore lint/suspicious/noConsole: CLI output
        console.log(`  ${key}:`)
        // biome-ignore lint/suspicious/noConsole: CLI output
        console.log(`    ${nameA}: ${JSON.stringify(wmDiff.different[key].a)}`)
        // biome-ignore lint/suspicious/noConsole: CLI output
        console.log(`    ${nameB}: ${JSON.stringify(wmDiff.different[key].b)}`)
      }
      if (onlyAKeys.length > 0) {
        // biome-ignore lint/suspicious/noConsole: CLI output
        console.log(`  only in ${nameA}: ${onlyAKeys.join(', ')}`)
      }
      if (onlyBKeys.length > 0) {
        // biome-ignore lint/suspicious/noConsole: CLI output
        console.log(`  only in ${nameB}: ${onlyBKeys.join(', ')}`)
      }
    }
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.log('')
  }

  if (modesDiff) {
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.log('modes.yaml:')
    if (modesDiff.only_a.length > 0) {
      // biome-ignore lint/suspicious/noConsole: CLI output
      console.log(`  custom modes in ${nameA} only: ${modesDiff.only_a.join(', ')}`)
    }
    if (modesDiff.only_b.length > 0) {
      // biome-ignore lint/suspicious/noConsole: CLI output
      console.log(`  custom modes in ${nameB} only: ${modesDiff.only_b.join(', ')}`)
    }
    if (modesDiff.different_modes.length > 0) {
      // biome-ignore lint/suspicious/noConsole: CLI output
      console.log(`  modes with differences: ${modesDiff.different_modes.join(', ')}`)
    }
    if (modesDiff.only_a.length === 0 && modesDiff.only_b.length === 0 && modesDiff.different_modes.length === 0) {
      // biome-ignore lint/suspicious/noConsole: CLI output
      console.log('  (identical)')
    }
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.log('')
  }

  if (templateDiff.length > 0) {
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.log('templates:')
    const diff = templateDiff.filter((t) => t.status === 'different')
    const onlyA = templateDiff.filter((t) => t.status === 'only_a')
    const onlyB = templateDiff.filter((t) => t.status === 'only_b')

    if (diff.length > 0) {
      // biome-ignore lint/suspicious/noConsole: CLI output
      console.log(`  differ: ${diff.map((t) => t.name).join(', ')}`)
    }
    if (onlyA.length > 0) {
      // biome-ignore lint/suspicious/noConsole: CLI output
      console.log(`  only in ${nameA}: ${onlyA.map((t) => t.name).join(', ')}`)
    }
    if (onlyB.length > 0) {
      // biome-ignore lint/suspicious/noConsole: CLI output
      console.log(`  only in ${nameB}: ${onlyB.map((t) => t.name).join(', ')}`)
    }
    if (diff.length === 0 && onlyA.length === 0 && onlyB.length === 0) {
      // biome-ignore lint/suspicious/noConsole: CLI output
      console.log('  (identical)')
    }
  }
}
