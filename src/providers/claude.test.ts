import { describe, it, expect } from 'bun:test'
import type { AgentRunOptions } from './types.js'

/**
 * Unit tests for claudeProvider AgentRunOptions extension.
 *
 * These test the interface shape and default behavior.
 * We can't call claudeProvider.run() in unit tests (requires Agent SDK),
 * so we verify the types and option defaults.
 */

describe('AgentRunOptions', () => {
  it('accepts text-only options (backwards compat)', () => {
    const opts: AgentRunOptions = {
      cwd: '/tmp/test',
    }
    // No new fields required — existing callers work unchanged
    expect(opts.cwd).toBe('/tmp/test')
    expect(opts.allowedTools).toBeUndefined()
    expect(opts.maxTurns).toBeUndefined()
    expect(opts.permissionMode).toBeUndefined()
    expect(opts.settingSources).toBeUndefined()
  })

  it('accepts full-agent options', () => {
    const opts: AgentRunOptions = {
      cwd: '/tmp/test',
      allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
      maxTurns: 50,
      permissionMode: 'bypassPermissions',
      settingSources: ['project'],
      timeoutMs: 600_000,
    }
    expect(opts.allowedTools).toHaveLength(6)
    expect(opts.maxTurns).toBe(50)
    expect(opts.permissionMode).toBe('bypassPermissions')
    expect(opts.settingSources).toEqual(['project'])
  })

  it('accepts onMessage callback', () => {
    const messages: unknown[] = []
    const opts: AgentRunOptions = {
      cwd: '/tmp/test',
      onMessage: (msg) => messages.push(msg),
    }
    opts.onMessage!({ type: 'test' })
    expect(messages).toHaveLength(1)
  })

  it('accepts canUseTool hook', () => {
    const opts: AgentRunOptions = {
      cwd: '/tmp/test',
      canUseTool: (tool) => ({ behavior: 'allow' as const }),
    }
    const result = opts.canUseTool!({ name: 'Bash' })
    expect(result).toEqual({ behavior: 'allow' })
  })

  it('accepts abortController', () => {
    const ac = new AbortController()
    const opts: AgentRunOptions = {
      cwd: '/tmp/test',
      abortController: ac,
    }
    expect(opts.abortController).toBe(ac)
  })
})
