import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, basename } from 'node:path'
import jsYaml from 'js-yaml'
import type { ProjectEntry } from './registry.js'
import { getPackageRoot } from '../session/lookup.js'

export interface HealthResult {
  status: 'ok' | 'warn' | 'error'
  message: string
}

export interface HealthCheck {
  id: string
  severity: 'error' | 'warning' | 'info'
  fixable: boolean
  run(project: ProjectEntry): HealthResult
  fix?(project: ProjectEntry): void
}

/**
 * Get the kata config directory for a project entry.
 */
function getConfigDir(project: ProjectEntry): string {
  return project.kata_layout === '.kata'
    ? join(project.path, '.kata')
    : join(project.path, '.claude', 'workflows')
}

/**
 * Check: template-freshness
 * Compares project templates against package battery templates.
 */
export const templateFreshness: HealthCheck = {
  id: 'template-freshness',
  severity: 'warning',
  fixable: true,

  run(project) {
    const configDir = getConfigDir(project)
    const templatesDir =
      project.kata_layout === '.kata'
        ? join(project.path, '.kata', 'templates')
        : join(project.path, '.claude', 'workflows', 'templates')

    if (!existsSync(templatesDir)) {
      return { status: 'warn', message: 'No templates directory found' }
    }

    const pkgTemplatesDir = join(getPackageRoot(), 'batteries', 'templates')
    if (!existsSync(pkgTemplatesDir)) {
      return { status: 'ok', message: 'No package templates to compare' }
    }

    const outdated: string[] = []

    try {
      const pkgFiles = readdirSync(pkgTemplatesDir).filter((f) => f.endsWith('.md'))
      for (const file of pkgFiles) {
        const projectFile = join(templatesDir, file)
        const pkgFile = join(pkgTemplatesDir, file)

        if (!existsSync(projectFile)) continue

        const projectContent = readFileSync(projectFile, 'utf-8')
        const pkgContent = readFileSync(pkgFile, 'utf-8')

        if (projectContent !== pkgContent) {
          outdated.push(file)
        }
      }
    } catch {
      return { status: 'warn', message: 'Could not read templates' }
    }

    if (outdated.length > 0) {
      return {
        status: 'warn',
        message: `${outdated.length} template(s) outdated: ${outdated.join(', ')}`,
      }
    }

    return { status: 'ok', message: 'all current' }
  },

  fix(project) {
    // Delegate to batteries --update
    const { scaffoldBatteries } = require('../commands/scaffold-batteries.js') as {
      scaffoldBatteries: (root: string, update: boolean) => unknown
    }
    scaffoldBatteries(project.path, true)
  },
}

/**
 * Check: hook-registration
 * Verifies .claude/settings.json has required hook entries.
 */
export const hookRegistration: HealthCheck = {
  id: 'hook-registration',
  severity: 'error',
  fixable: true,

  run(project) {
    const settingsPath = join(project.path, '.claude', 'settings.json')
    if (!existsSync(settingsPath)) {
      return { status: 'error', message: '.claude/settings.json not found' }
    }

    try {
      const settings = JSON.parse(readFileSync(settingsPath, 'utf-8')) as Record<string, unknown>
      const hooks = settings.hooks as Record<string, unknown[]> | undefined

      if (!hooks) {
        return { status: 'error', message: 'No hooks section in settings.json' }
      }

      const requiredEvents = ['SessionStart', 'UserPromptSubmit', 'Stop']
      const missing: string[] = []

      for (const event of requiredEvents) {
        if (!hooks[event] || !Array.isArray(hooks[event]) || hooks[event].length === 0) {
          missing.push(event)
        }
      }

      if (missing.length > 0) {
        return {
          status: 'error',
          message: `Missing hooks: ${missing.join(', ')}`,
        }
      }

      const total = Object.keys(hooks).length
      return { status: 'ok', message: `${total} hook events registered` }
    } catch {
      return { status: 'error', message: 'Cannot parse settings.json' }
    }
  },
}

/**
 * Check: config-validation
 * Validates wm.yaml and modes.yaml parse correctly.
 */
export const configValidation: HealthCheck = {
  id: 'config-validation',
  severity: 'error',
  fixable: false,

  run(project) {
    const configDir = getConfigDir(project)
    const wmYamlPath = join(configDir, 'wm.yaml')

    if (!existsSync(wmYamlPath)) {
      return { status: 'error', message: 'wm.yaml not found' }
    }

    try {
      jsYaml.load(readFileSync(wmYamlPath, 'utf-8'))
    } catch (e) {
      return { status: 'error', message: `wm.yaml parse error: ${e instanceof Error ? e.message : e}` }
    }

    // Check modes.yaml if present
    const modesYamlPath = join(configDir, 'modes.yaml')
    if (existsSync(modesYamlPath)) {
      try {
        jsYaml.load(readFileSync(modesYamlPath, 'utf-8'))
      } catch (e) {
        return { status: 'error', message: `modes.yaml parse error: ${e instanceof Error ? e.message : e}` }
      }
    }

    return { status: 'ok', message: 'config valid' }
  },
}

/**
 * Check: stale-sessions
 * Reports session state files older than 30 days.
 */
export const staleSessions: HealthCheck = {
  id: 'stale-sessions',
  severity: 'info',
  fixable: true,

  run(project) {
    const sessionsDir =
      project.kata_layout === '.kata'
        ? join(project.path, '.kata', 'sessions')
        : join(project.path, '.claude', 'sessions')

    if (!existsSync(sessionsDir)) {
      return { status: 'ok', message: 'no sessions directory' }
    }

    try {
      const entries = readdirSync(sessionsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
      let staleCount = 0

      for (const entry of entries) {
        const statePath = join(sessionsDir, entry.name, 'state.json')
        if (!existsSync(statePath)) continue

        try {
          const raw = JSON.parse(readFileSync(statePath, 'utf-8')) as Record<string, unknown>
          const updated = raw.updatedAt as string | undefined
          if (updated && new Date(updated).getTime() < thirtyDaysAgo) {
            staleCount++
          }
        } catch {
          // Skip unparseable sessions
        }
      }

      if (staleCount > 0) {
        return { status: 'warn', message: `${staleCount} session(s) older than 30 days` }
      }
      return { status: 'ok', message: `${entries.length} session(s), none stale` }
    } catch {
      return { status: 'ok', message: 'cannot read sessions' }
    }
  },
}

/**
 * Check: layout-consistency
 * Reports which layout (.kata or .claude) the project uses.
 */
export const layoutConsistency: HealthCheck = {
  id: 'layout-consistency',
  severity: 'info',
  fixable: false,

  run(project) {
    return { status: 'ok', message: `using ${project.kata_layout} layout` }
  },
}

/**
 * All health checks in order.
 */
export const ALL_HEALTH_CHECKS: HealthCheck[] = [
  templateFreshness,
  hookRegistration,
  configValidation,
  staleSessions,
  layoutConsistency,
]
