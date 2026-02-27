// kata config — display resolved configuration
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { findProjectDir, getPackageRoot, getProjectTemplatesDir } from '../session/lookup.js'
import { loadKataConfig, getKataConfigPath } from '../config/kata-config.js'

/**
 * kata config --show
 *
 * Displays the resolved configuration from kata.yaml.
 * Single file, no merge — provenance is always "project".
 */
export async function config(args: string[]): Promise<void> {
  if (args.includes('--show') || args.length === 0) {
    showConfig()
  } else {
    process.stdout.write('Usage: kata config --show\n')
  }
}

function showConfig(): void {
  const cfg = loadKataConfig()
  const projectRoot = findProjectDir()
  const configPath = getKataConfigPath(projectRoot)

  process.stdout.write('kata config (resolved)\n')
  process.stdout.write('═'.repeat(60) + '\n')
  process.stdout.write(`source: ${configPath}\n\n`)

  // Scalar fields
  process.stdout.write(`spec_path: ${cfg.spec_path}\n`)
  process.stdout.write(`research_path: ${cfg.research_path}\n`)
  process.stdout.write(`session_retention_days: ${cfg.session_retention_days}\n`)

  // Reviews section
  if (cfg.reviews) {
    process.stdout.write('\nreviews:\n')
    process.stdout.write(`  code_review: ${cfg.reviews.code_review ?? '(not set)'}\n`)
    process.stdout.write(`  code_reviewer: ${cfg.reviews.code_reviewer ?? 'null'}\n`)
  }

  // Project section
  if (cfg.project) {
    process.stdout.write('\nproject:\n')
    process.stdout.write(`  name: ${cfg.project.name ?? '(not set)'}\n`)
    process.stdout.write(`  test_command: ${cfg.project.test_command ?? '(not set)'}\n`)
    process.stdout.write(`  build_command: ${cfg.project.build_command ?? '(not set)'}\n`)
  }

  // Modes summary
  process.stdout.write('\n')
  const modeNames = Object.keys(cfg.modes).filter(
    (m) => !cfg.modes[m].deprecated,
  )
  process.stdout.write(`modes: ${modeNames.length} active modes\n`)

  // Template resolution summary
  process.stdout.write('\ntemplates (lookup order: project → package):\n')
  const packageTemplateDir = join(getPackageRoot(), 'batteries', 'templates')
  try {
    const projTmplDir = getProjectTemplatesDir(projectRoot)
    process.stdout.write(`  project:  ${projTmplDir} ${existsSync(projTmplDir) ? '(exists)' : '(not found)'}\n`)
  } catch {
    process.stdout.write('  project:  (no project)\n')
  }
  process.stdout.write(`  package:  ${packageTemplateDir} ${existsSync(packageTemplateDir) ? '(exists)' : '(not found)'}\n`)
}
