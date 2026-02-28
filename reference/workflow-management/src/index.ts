#!/usr/bin/env node

/**
 * wm - Workflow Management CLI
 *
 * Type-safe state management for Claude Code workflow sessions.
 */

import { enter } from './commands/enter.js'
import { status } from './commands/status.js'
import { exit } from './commands/exit.js'
import { canExit } from './commands/can-exit.js'
import { prompt } from './commands/prompt.js'
import { init } from './commands/init.js'
import { prime } from './commands/prime.js'
import { validateSpecCommand } from './commands/validate-spec.js'
import { validateTemplateCommand } from './commands/validate-template.js'
import { initTemplateCommand } from './commands/init-template.js'
import { initModeCommand } from './commands/init-mode.js'
import { registerModeCommand } from './commands/register-mode.js'
import { doctor } from './commands/doctor.js'
import { link } from './commands/link.js'
import { suggest } from './commands/suggest.js'

async function main() {
  const args = process.argv.slice(2)
  const command = args[0] || 'help'
  const commandArgs = args.slice(1)

  try {
    switch (command) {
      case 'enter':
        await enter(commandArgs)
        break

      case 'status':
        await status(commandArgs)
        break

      case 'advance':
        // Deprecated: Phase advancement is now done by completing native tasks
        // biome-ignore lint/suspicious/noConsole: intentional CLI output
        console.error('DEPRECATED: wm advance is no longer used.')
        // biome-ignore lint/suspicious/noConsole: intentional CLI output
        console.error(
          'Phase advancement is tracked via native tasks. Use TaskUpdate(taskId="X", status="completed") to advance.',
        )
        process.exitCode = 1
        break

      case 'exit':
        await exit(commandArgs)
        break

      case 'can-exit':
        await canExit(commandArgs)
        break

      case 'prompt':
        await prompt(commandArgs)
        break

      case 'init':
        await init(commandArgs)
        break

      case 'prime':
        await prime(commandArgs)
        break

      case 'validate-spec':
        await validateSpecCommand(commandArgs)
        break

      case 'validate-template':
        await validateTemplateCommand(commandArgs)
        break

      case 'init-template':
        await initTemplateCommand(commandArgs)
        break

      case 'init-mode':
        await initModeCommand(commandArgs)
        break

      case 'register-mode':
        await registerModeCommand(commandArgs)
        break

      case 'doctor':
        await doctor(commandArgs)
        break

      case 'link':
        await link(commandArgs)
        break

      case 'suggest':
        await suggest(commandArgs)
        break

      case 'help':
      case '--help':
      case '-h':
        showHelp()
        break

      default:
        // biome-ignore lint/suspicious/noConsole: intentional for CLI
        console.error(`Unknown command: ${command}`)
        // biome-ignore lint/suspicious/noConsole: intentional for CLI
        console.error('Run: wm help')
        process.exit(1)
    }
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: intentional for CLI
    console.error('Error:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

function showHelp() {
  // biome-ignore lint/suspicious/noConsole: intentional for CLI output
  console.log(`
wm - Workflow Management CLI

Usage:
  wm enter <mode> [--session=SESSION_ID]       Enter a mode (creates native tasks)
  wm enter --template=PATH [--dry-run]         Use custom template for one-off session
  wm enter --template=PATH --tmp               One-off session (tracked, not registered)
  wm status [--json] [--session=SESSION_ID]    Show current mode and phase
  wm link [<issue>]                            Show linked issue (or link new issue)
  wm link --show                               Show currently linked issue
  wm link --clear                              Clear issue linkage
  wm exit [--session=SESSION_ID]               Exit current mode
  wm can-exit [--json] [--session=SESSION_ID]  Check if exit conditions met (native tasks)
  wm prompt [--session=SESSION_ID]             Output current mode prompt
  wm init [--session=SESSION_ID]               Initialize session state
  wm prime                                      Output context injection block
  wm validate-spec --issue=N | path.md         Validate spec phases format
  wm validate-template <path> [--json]         Validate a template file
  wm init-template <path> [options]            Create a new template file
  wm init-mode <name> [options]                Create new mode (template + modes.yaml)
  wm register-mode <template-path> [options]   Register existing template as mode
  wm suggest <message>                          Detect mode from message, output guidance
  wm doctor [--fix] [--json]                    Diagnose and fix session state
  wm help                                       Show this help

Task Tracking:
  Tasks are managed via Claude Code's native task system (~/.claude/tasks/{session}/).
  - wm enter creates native tasks from template (TaskCreate)
  - wm can-exit checks for pending native tasks
  - Use TaskUpdate(taskId="X", status="completed") to complete tasks

Examples:
  wm enter implementation   # Enter mode, creates native tasks
  wm status --json          # Check current state
  TaskList                  # View all tasks
  TaskUpdate                # Complete a task
  wm can-exit               # Check if all tasks completed
  wm exit                   # Complete mode

Custom Templates (one-off sessions):
  wm init-template /tmp/my-workflow.md --phases=4
  wm validate-template /tmp/my-workflow.md
  wm enter --template=/tmp/my-workflow.md             # Track with tasks
  wm enter --template=/tmp/my-workflow.md --dry-run   # Preview only
  wm enter --template=/tmp/my-workflow.md --tmp       # One-off (tracked, not registered)

Permanent Modes (saved in modes.yaml):
  wm init-mode code-review                            # Create new mode + template
  wm init-mode sprint-planning --phases=5             # With custom phase count
  wm register-mode /tmp/my-workflow.md --copy         # Register existing template

Issue Linking:
  wm enter implementation --issue=123         Link issue when entering mode
  wm link 456                                 Link to different issue mid-session
  wm link --show                              Check current linkage
  wm link --clear                             Clear issue linkage

State Management:
  wm init --force                              Reset session state to defaults
  wm exit                                      Mark current mode complete, reset to default

Troubleshooting:
  - Switching issues? Use 'wm link <new-issue>' or 'wm enter <mode> --issue=N'
  - State corrupted? Use 'wm init --force' to hard reset
  - Task issues? Use TaskList to see native tasks

Notes:
  - If --session not provided, uses current session from .claude/current-session-id
  - JSON output is for hooks, human-readable output is default
  - State stored at .claude/sessions/{SESSION_ID}/state.json
  - Native tasks stored at ~/.claude/tasks/{SESSION_ID}/
`)
}

main()

// Export types and utilities for programmatic use
export * from './state/schema.js'
export * from './state/reader.js'
export * from './state/writer.js'
export * from './state/validator.js'
export * from './utils/workflow-id.js'
export * from './utils/timestamp.js'
export * from './config/parser.js'
export * from './config/cache.js'
export * from './session/lookup.js'
export * from './validation/index.js'
