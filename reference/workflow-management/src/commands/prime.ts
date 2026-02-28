// wm prime - Output context injection block
import {
  getCurrentSessionId,
  getModesYamlPath,
  getStateFilePath,
  resolveTemplatePath,
} from '../session/lookup.js'
import { readState, stateExists } from '../state/reader.js'
import { readFullTemplateContent } from '../yaml/index.js'
import { loadModesConfig } from '../config/cache.js'

/**
 * Output mode selection help when no mode is active
 * Reads available modes from modes.yaml dynamically
 */
async function outputModeSelectionHelp(): Promise<void> {
  // Load modes from modes.yaml
  const modesYamlPath = getModesYamlPath()
  const config = await loadModesConfig(modesYamlPath)

  // Build mode list grouped by category
  const modesByCategory: Record<
    string,
    Array<{ name: string; description: string; deprecated?: boolean }>
  > = {}

  for (const [modeName, modeConfig] of Object.entries(config.modes)) {
    if (modeConfig.deprecated) continue // Skip deprecated modes

    const category = modeConfig.category || 'other'
    if (!modesByCategory[category]) {
      modesByCategory[category] = []
    }
    modesByCategory[category].push({
      name: modeName,
      description: modeConfig.description || '',
    })
  }

  // Get all mode names (sorted, non-deprecated)
  const allModes = Object.keys(config.modes)
    .filter((m) => !config.modes[m].deprecated)
    .sort()
    .join(', ')

  // biome-ignore lint/suspicious/noConsole: intentional CLI output
  console.log(`# 🚨 MODE ENTRY IS MANDATORY 🚨

**CRITICAL**: Before doing ANY work, you MUST enter a mode.

## Available Modes

${allModes}

## Quick Reference

| Mode | Description |
|------|-------------|
${Object.entries(config.modes)
  .filter(([_, cfg]) => !cfg.deprecated)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, cfg]) => `| \`${name}\` | ${cfg.description || ''} |`)
  .join('\n')}

## Task Size → Mode Selection

| Task Size | Mode | Issue Required? | Example |
|-----------|------|-----------------|---------|
| **Small** (<1 hr) | \`task\` | No | Add CLI command, small refactor |
| **Medium** (hours) | \`implementation\` | **Yes** | Feature work from approved spec |
| **Large** (days) | \`planning\` first | **Yes** | New features, architecture |
| **Questions** | \`freeform\` | No | "How does X work?" |

## Classify User Intent

| User Says | Intent | Mode |
|-----------|--------|------|
| "add X to CLI", "quick change", "small refactor" | SMALL TASK | \`task\` |
| "implement issue #123", "build feature from spec" | SPEC WORK | \`implementation\` |
| "bug: ...", "fix #456", "broken ..." | BUG FIX | \`bugfix\` |
| "plan ...", "design ...", "spec ..." | PLANNING | \`planning\` |
| "how does ...", "what is ...", "explain ..." | QUESTION | \`freeform\` |
| "research ...", "comprehensive exploration" | RESEARCH | \`research\` |
| "investigate ...", "why is ...", "debug ..." | DEBUG | \`debug\` |
| "review theory", "work on patterns", "doctrine ..." | DOCTRINE | \`doctrine\` |

## Commands

\`\`\`bash
pnpm wm enter <mode>                       # Enter a mode
pnpm wm enter implementation --issue=123   # Issue-backed from spec
pnpm wm link <issue-num>                   # Link session to issue mid-session
pnpm wm status                             # Check current mode and phase
pnpm wm can-exit                           # Check stop conditions
\`\`\`

**NEVER skip mode entry.** Work without a mode loses tracking, context, and guidance.
`)
}

/**
 * wm prime
 * Outputs context injection block (like bt prime, bpd prime)
 *
 * If in a mode with a template, outputs the FULL template content.
 * Otherwise outputs mode selection help.
 */
export async function prime(_args: string[]): Promise<void> {
  try {
    // Try to get current session state
    const sessionId = await getCurrentSessionId()
    const stateFile = await getStateFilePath(sessionId)

    if (await stateExists(stateFile)) {
      const state = await readState(stateFile)

      // If we have a current mode with a template, output the full template content
      if (state.currentMode && state.currentMode !== 'default' && state.template) {
        try {
          const templatePath = resolveTemplatePath(state.template)
          const templateContent = readFullTemplateContent(templatePath)

          if (templateContent) {
            // Output header with mode context
            // biome-ignore lint/suspicious/noConsole: intentional CLI output
            console.log(`# 📋 Active Mode: ${state.currentMode}`)
            if (state.workflowId) {
              // biome-ignore lint/suspicious/noConsole: intentional CLI output
              console.log(`# Workflow: ${state.workflowId}`)
            }
            if (state.issueNumber) {
              // biome-ignore lint/suspicious/noConsole: intentional CLI output
              console.log(`# Issue: #${state.issueNumber}`)
            }
            if (state.currentPhase) {
              // biome-ignore lint/suspicious/noConsole: intentional CLI output
              console.log(`# Current Phase: ${state.currentPhase}`)
            }
            // biome-ignore lint/suspicious/noConsole: intentional CLI output
            console.log('')
            // biome-ignore lint/suspicious/noConsole: intentional CLI output
            console.log('---')
            // biome-ignore lint/suspicious/noConsole: intentional CLI output
            console.log('')
            // Output full template content
            // biome-ignore lint/suspicious/noConsole: intentional CLI output
            console.log(templateContent)
            return
          }
        } catch {
          // Template not found, fall through to mode selection help
        }
      }
    }
  } catch {
    // No session or state issues, fall through to mode selection help
  }

  // No active mode or no template - show mode selection help
  await outputModeSelectionHelp()
}
