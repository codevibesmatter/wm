// wm advance - Advance to next phase
import { getCurrentSessionId, getStateFilePath } from '../session/lookup.js'
import { readState } from '../state/reader.js'
import { writeState } from '../state/writer.js'
import type { SessionState } from '../state/schema.js'

/**
 * Parse command line arguments for advance command
 */
function parseArgs(args: string[]): {
  phase?: string
  session?: string
} {
  const result: { phase?: string; session?: string } = {}

  for (const arg of args) {
    if (arg.startsWith('--session=')) {
      result.session = arg.slice('--session='.length)
    } else if (!arg.startsWith('--')) {
      // First non-flag argument is the phase
      result.phase = arg
    }
  }

  return result
}

/**
 * wm advance <phase> [--session=SESSION_ID]
 * Advance to next phase
 */
export async function advance(args: string[]): Promise<void> {
  const parsed = parseArgs(args)

  if (!parsed.phase) {
    // biome-ignore lint/suspicious/noConsole: intentional CLI error output
    console.error('Usage: wm advance <phase> [--session=SESSION_ID]')
    process.exitCode = 1
    return
  }

  const sessionId = parsed.session || (await getCurrentSessionId())
  const stateFile = await getStateFilePath(sessionId)
  const state = await readState(stateFile)

  if (!state.phases?.includes(parsed.phase)) {
    // biome-ignore lint/suspicious/noConsole: intentional CLI error output
    console.error(`Invalid phase: ${parsed.phase}`)
    // biome-ignore lint/suspicious/noConsole: intentional CLI error output
    console.error(`Valid phases: ${state.phases?.join(', ') || 'none'}`)
    process.exitCode = 1
    return
  }

  const previousPhase = state.currentPhase
  const completedPhases = state.completedPhases || []
  if (previousPhase && !completedPhases.includes(previousPhase)) {
    completedPhases.push(previousPhase)
  }

  const now = new Date().toISOString()

  const updated: SessionState = {
    ...state,
    currentPhase: parsed.phase,
    completedPhases,
    updatedAt: now,
  }

  await writeState(stateFile, updated)

  // biome-ignore lint/suspicious/noConsole: intentional CLI output
  console.log(
    JSON.stringify(
      {
        success: true,
        previousPhase,
        currentPhase: parsed.phase,
        advancedAt: updated.updatedAt,
      },
      null,
      2,
    ),
  )
}
