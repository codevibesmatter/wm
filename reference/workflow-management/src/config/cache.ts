// Config cache for modes.yaml
import { parseModesConfig } from './parser.js'
import type { ModesConfig } from '../state/schema.js'

/**
 * Singleton cache for modes.yaml configuration
 * Ensures config is parsed only once per process
 */
let cachedInstance: ModesConfig | null = null
let cachedConfigPath: string | null = null

/**
 * Load and cache modes.yaml config
 * Returns cached instance if already loaded for this path
 */
export async function loadModesConfig(yamlPath: string): Promise<ModesConfig> {
  if (!cachedInstance || cachedConfigPath !== yamlPath) {
    cachedInstance = await parseModesConfig(yamlPath)
    cachedConfigPath = yamlPath
  }
  return cachedInstance
}

/**
 * Resolve mode aliases to canonical mode name
 * @param config - Modes configuration
 * @param mode - Mode name or alias
 * @returns Canonical mode name
 */
export function resolveModeAlias(config: ModesConfig, mode: string): string {
  // Check if already canonical
  if (config.modes[mode]) {
    return mode
  }

  // Check aliases
  for (const [canonical, modeConfig] of Object.entries(config.modes)) {
    if (modeConfig.aliases?.includes(mode)) {
      return canonical
    }
  }

  // Not found - return as-is (caller should validate)
  return mode
}

/**
 * Clear cached config (useful for testing)
 */
export function clearConfigCache(): void {
  cachedInstance = null
  cachedConfigPath = null
}

/**
 * Get cached config without loading
 */
export function getCachedConfig(): ModesConfig | null {
  return cachedInstance
}
