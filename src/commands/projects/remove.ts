import { isManagerInitialized } from '../../manager/paths.js'
import { readIndex, writeIndex, removeProject as removeFromIndex } from '../../manager/registry.js'

/**
 * kata projects remove <alias-or-path>
 *
 * Remove a project from the registry.
 */
export async function removeProject(args: string[]): Promise<void> {
  if (!isManagerInitialized()) {
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.error('Manager not initialized. Run: kata projects init-manager')
    process.exitCode = 1
    return
  }

  const query = args.find((a) => !a.startsWith('--'))

  if (!query) {
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.error('Usage: kata projects remove <alias-or-path>')
    process.exitCode = 1
    return
  }

  const index = readIndex()
  const result = removeFromIndex(index, query)

  if (!result.removed) {
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.error(`No project found matching: ${query}`)
    process.exitCode = 1
    return
  }

  writeIndex(result.index)

  // biome-ignore lint/suspicious/noConsole: CLI output
  console.log(
    JSON.stringify({ action: 'removed', query }, null, 2),
  )
}
