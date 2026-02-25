/**
 * kata review — ad-hoc agent review via provider.
 *
 * Usage:
 *   kata review --prompt=code-review                     # Review with default provider
 *   kata review --prompt=spec-review --provider=gemini   # Specific provider
 *   kata review --prompt=code-review --model=claude-haiku-4-5  # Model override
 *   kata review --prompt=code-review --output=reviews/   # Save artifact
 *   kata review --list                                   # List available prompts
 *   kata review --dry-run --prompt=code-review           # Show assembled prompt
 */

import { runAgentStep } from '../providers/step-runner.js'
import { listPrompts } from '../providers/prompt.js'
import { findProjectDir } from '../session/lookup.js'

export async function review(args: string[]): Promise<void> {
  // --list: show available prompt templates
  if (args.includes('--list')) {
    const prompts = listPrompts()
    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.log('Available prompt templates:')
    for (const name of prompts) {
      // biome-ignore lint/suspicious/noConsole: intentional CLI output
      console.log(`  ${name}`)
    }
    return
  }

  // Parse flags
  const promptName = args.find(a => a.startsWith('--prompt='))?.split('=')[1]
  const providerName = args.find(a => a.startsWith('--provider='))?.split('=')[1] ?? 'claude'
  const model = args.find(a => a.startsWith('--model='))?.split('=')[1]
  const output = args.find(a => a.startsWith('--output='))?.split('=')[1]
  const dryRun = args.includes('--dry-run')
  const contextArgs = args.filter(a => a.startsWith('--context=')).map(a => a.split('=')[1])

  if (!promptName) {
    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.error('Usage: kata review --prompt=<name> [--provider=<name>] [--model=<model>]')
    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.error('       kata review --list')
    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.error('')
    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.error('Available prompts:')
    for (const name of listPrompts()) {
      // biome-ignore lint/suspicious/noConsole: intentional CLI output
      console.error(`  ${name}`)
    }
    process.exitCode = 1
    return
  }

  // Default context: git_diff for code-review, spec for spec-review
  const context = contextArgs.length > 0
    ? contextArgs
    : promptName === 'code-review'
      ? ['git_diff']
      : promptName === 'spec-review'
        ? ['spec']
        : promptName === 'transcript-review'
          ? ['transcript', 'template']
          : []

  let cwd: string
  try {
    cwd = findProjectDir()
  } catch {
    cwd = process.cwd()
  }

  if (dryRun) {
    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.log(`Provider: ${providerName}`)
    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.log(`Model: ${model ?? '(default)'}`)
    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.log(`Prompt: ${promptName}`)
    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.log(`Context: ${context.join(', ') || '(none)'}`)
    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.log(`Output: ${output ?? '(stdout only)'}`)
    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.log(`CWD: ${cwd}`)
    return
  }

  // biome-ignore lint/suspicious/noConsole: intentional CLI output
  console.error(`Running ${promptName} review via ${providerName}...`)

  const result = await runAgentStep(
    {
      provider: providerName,
      model,
      prompt: promptName,
      context,
      output,
    },
    { cwd },
  )

  // Output the review
  process.stdout.write(result.output + '\n')

  if (result.score !== undefined) {
    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.error(`Score: ${result.score}/100`)
  }
  if (result.artifactPath) {
    // biome-ignore lint/suspicious/noConsole: intentional CLI output
    console.error(`Saved: ${result.artifactPath}`)
  }
}
