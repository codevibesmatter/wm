// Notes file creation for enter command
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

/**
 * Create fd-notes.md file for feature-documentation mode
 * This file persists interview context across compaction
 */
export function createFdNotesFile(
  stateFile: string,
  sessionId: string,
  featureDocPath?: string,
  domain?: string,
): void {
  const sessionDir = dirname(stateFile)
  const notesFile = resolve(sessionDir, 'fd-notes.md')

  // Skip if already exists
  if (existsSync(notesFile)) {
    return
  }

  // Ensure directory exists
  mkdirSync(sessionDir, { recursive: true })

  const now = new Date().toISOString()
  const content = `# Feature Clarification Interview Notes

**Session:** ${sessionId}
**Feature Doc:** ${featureDocPath || '(new feature)'}
**Domain:** ${domain || '(to be determined)'}
**Started:** ${now}

---

## Interview Progress

_Notes will be appended here as interview progresses._
_This file survives context compaction._

---
`

  writeFileSync(notesFile, content, 'utf-8')
  // biome-ignore lint/suspicious/noConsole: intentional CLI output
  console.error(`  Created: fd-notes.md for interview context persistence`)
}

/**
 * Create doctrine-notes.md file for doctrine mode
 * This file persists interview context across compaction
 */
export function createDoctrineNotesFile(
  stateFile: string,
  sessionId: string,
  targetLayer?: string,
  targetDoc?: string,
): void {
  const sessionDir = dirname(stateFile)
  const notesFile = resolve(sessionDir, 'doctrine-notes.md')

  // Skip if already exists
  if (existsSync(notesFile)) {
    return
  }

  // Ensure directory exists
  mkdirSync(sessionDir, { recursive: true })

  const now = new Date().toISOString()
  const content = `# Doctrine Interview Notes

**Session:** ${sessionId}
**Layer:** ${targetLayer || '(to be determined)'}
**Target Doc:** ${targetDoc || '(to be determined)'}
**Started:** ${now}

---

## Interview Progress

_Notes will be appended here as interview progresses._
_This file survives context compaction._

---
`

  writeFileSync(notesFile, content, 'utf-8')
  // biome-ignore lint/suspicious/noConsole: intentional CLI output
  console.error(`  Created: doctrine-notes.md for interview context persistence`)
}
