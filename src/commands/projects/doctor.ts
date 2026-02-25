import { isManagerInitialized } from '../../manager/paths.js'
import { readIndex, findProject } from '../../manager/registry.js'
import { ALL_HEALTH_CHECKS } from '../../manager/health-checks.js'
import type { ProjectEntry } from '../../manager/registry.js'
import type { HealthResult } from '../../manager/health-checks.js'

interface ProjectReport {
  name: string
  path: string
  checks: Array<{ id: string; status: string; message: string }>
}

/**
 * kata projects doctor [<project>] [--fix] [--json]
 *
 * Run health checks across registered projects.
 */
export async function doctorProjects(args: string[]): Promise<void> {
  const fix = args.includes('--fix')
  const jsonOutput = args.includes('--json')
  const projectQuery = args.find((a) => !a.startsWith('--'))

  if (!isManagerInitialized()) {
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.error('Manager not initialized. Run: kata projects init-manager')
    process.exitCode = 1
    return
  }

  const index = readIndex()

  // Determine which projects to check
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

  if (projects.length === 0) {
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.error('No projects registered. Run: kata projects init-manager')
    process.exitCode = 1
    return
  }

  const reports: ProjectReport[] = []
  let totalWarnings = 0
  let totalErrors = 0

  for (const project of projects) {
    const report: ProjectReport = {
      name: project.alias || project.name,
      path: project.path,
      checks: [],
    }

    if (!jsonOutput) {
      // biome-ignore lint/suspicious/noConsole: CLI output
      console.log(`${report.name} (${report.path})`)
    }

    for (const check of ALL_HEALTH_CHECKS) {
      const result = check.run(project)
      report.checks.push({ id: check.id, status: result.status, message: result.message })

      if (result.status === 'warn') totalWarnings++
      if (result.status === 'error') totalErrors++

      // Apply fix if requested
      if (fix && result.status !== 'ok' && check.fixable && check.fix) {
        try {
          check.fix(project)
          if (!jsonOutput) {
            // biome-ignore lint/suspicious/noConsole: CLI output
            console.log(`  [fixed] ${check.id}: ${result.message}`)
          }
        } catch (e) {
          if (!jsonOutput) {
            // biome-ignore lint/suspicious/noConsole: CLI output
            console.log(`  [fail]  ${check.id}: fix failed — ${e instanceof Error ? e.message : e}`)
          }
        }
        continue
      }

      if (!jsonOutput) {
        const icon =
          result.status === 'ok' ? '[ok]  ' : result.status === 'warn' ? '[warn]' : '[err] '
        // biome-ignore lint/suspicious/noConsole: CLI output
        console.log(`  ${icon} ${check.id}: ${result.message}`)
      }
    }

    if (!jsonOutput) {
      // biome-ignore lint/suspicious/noConsole: CLI output
      console.log('')
    }

    reports.push(report)
  }

  if (jsonOutput) {
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.log(JSON.stringify(reports, null, 2))
  } else {
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.log(
      `Summary: ${projects.length} project(s) checked, ${totalWarnings} warning(s), ${totalErrors} error(s)`,
    )
  }

  if (totalErrors > 0) {
    process.exitCode = 1
  }
}
