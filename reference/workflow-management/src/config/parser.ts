// Config parser for modes.yaml
import * as fs from 'node:fs/promises'
import { YAML } from 'bun'
import { ModesConfigSchema, type ModesConfig } from '../state/schema.js'

/**
 * Parse and validate modes.yaml configuration file
 * @param configPath - Absolute path to modes.yaml
 * @returns Validated ModesConfig object
 * @throws Error if file not found, YAML invalid, or validation fails
 */
export async function parseModesConfig(configPath: string): Promise<ModesConfig> {
  // Read YAML file
  const raw = await fs.readFile(configPath, 'utf-8')

  // Parse YAML using Bun's native YAML support
  const parsed = YAML.parse(raw)

  // Validate with Zod schema
  return ModesConfigSchema.parse(parsed)
}
