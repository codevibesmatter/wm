import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

/**
 * Root directory for the kata manager project.
 */
export const MANAGER_ROOT = join(homedir(), '.kata', 'manager')

/**
 * Ensure the manager directory structure exists.
 * Creates ~/.kata/manager/.kata/ with sessions/ and a minimal wm.yaml.
 */
export function ensureManagerDir(): string {
  const kataDir = join(MANAGER_ROOT, '.kata')
  const sessionsDir = join(kataDir, 'sessions')
  const backupsDir = join(MANAGER_ROOT, 'backups')

  mkdirSync(sessionsDir, { recursive: true })
  mkdirSync(backupsDir, { recursive: true })

  // Create minimal wm.yaml if it doesn't exist
  const wmYamlPath = join(kataDir, 'wm.yaml')
  if (!existsSync(wmYamlPath)) {
    writeFileSync(
      wmYamlPath,
      `# kata manager project config\nproject:\n  name: kata-manager\n`,
    )
  }

  return MANAGER_ROOT
}

/**
 * Get the path to the projects index file.
 */
export function getProjectsIndexPath(): string {
  return join(MANAGER_ROOT, '.kata', 'projects-index.json')
}

/**
 * Check if the manager has been initialized.
 */
export function isManagerInitialized(): boolean {
  return existsSync(getProjectsIndexPath())
}
