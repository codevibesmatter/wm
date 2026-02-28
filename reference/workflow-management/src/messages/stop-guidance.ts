// Stop hook guidance messages
// Centralized here so stop hook doesn't hardcode them

export interface ArtifactMessage {
  type: string
  title: string
  message: string
  fixCommand?: string
}

export interface StopGuidance {
  nextPhase?: {
    beadId: string // Legacy field name, used for task ID
    title: string
    instructions?: string
  }
  /** Pre-formatted next step message (use this instead of rebuilding in shell) */
  nextStepMessage?: string
  artifactMessage?: ArtifactMessage
  templateFile?: string
  escapeHatch: string
}

/**
 * Get artifact-specific blocking message
 */
export function getArtifactMessage(
  artifactType: string,
  context: {
    sessionId?: string
    issueNumber?: number
    workflowId?: string
  },
): ArtifactMessage | undefined {
  const { sessionId = '$SESSION_ID', issueNumber } = context
  const issueNum = issueNumber ?? 'NNN'

  switch (artifactType) {
    case 'research_doc':
      return {
        type: 'research_doc',
        title: 'ARTIFACT MISSING: Research document required',
        message: `Research mode P3 (Synthesize) requires a research document.

Create: planning/research/$(date +%Y-%m-%d)-{topic-slug}.md

Template: planning/templates/research-findings.template.md`,
      }

    case 'implementation_commits':
      return {
        type: 'implementation_commits',
        title: 'ANTI-CHEAT VIOLATION: No commits found',
        message: `You marked tasks as done without actually implementing anything.

REQUIRED before completing tasks:
1. \`pnpm typecheck\` - run and show output
2. \`pnpm test\` - run and show test names passing
3. \`pnpm lint\` - run and show output
4. \`git add . && git commit -m "..."\` - commit your changes

**"Writing code" ≠ "Done". Code is NEVER done until tests pass and changes are committed.**`,
        fixCommand: 'pnpm wm status',
      }

    case 'github_not_finalized':
      return {
        type: 'github_not_finalized',
        title: `BLOCKED: GitHub issue #${issueNum} not finalized`,
        message: `Implementation sessions REQUIRE GitHub finalization before exit.

Run:
\`\`\`bash
pnpm bgh finalize ${issueNum} --status="In Review"
\`\`\`

This updates:
- Project board status to "In Review"
- Posts completion comment (commits, files, stats)
- Sets githubFinalized=true in session state

**Options:**
- \`--status="Done"\` - Set different project status
- \`--close\` - Also close the GitHub issue
- \`--summary="..."\` - Add custom summary to comment`,
        fixCommand: `cat .claude/sessions/${sessionId}/state.json | jq '.githubFinalized'`,
      }

    case 'verification_not_run':
      return {
        type: 'verification_not_run',
        title: `BLOCKED: Verification not run for issue #${issueNum}`,
        message: `Implementation sessions REQUIRE Gemini verification before exit.

### Option 1: Verify Work (Recommended for Implementation)

Verify any work done with flexible task description:

\`\`\`bash
pnpm at verify work "Verify <task>" --spec=planning/specs/${issueNum}-*.md

# Examples:
pnpm at verify work "Verify Database Schema changes" --spec=planning/specs/${issueNum}-*.md
pnpm at verify work "Verify API endpoints work correctly" --issue=${issueNum}
\`\`\`

### Option 2: Verify Phase

Verify a specific implementation phase from spec:

\`\`\`bash
pnpm at verify phase ${issueNum} <phase>

# Examples:
pnpm at verify phase ${issueNum} P2.1
pnpm at verify phase ${issueNum} 1
\`\`\`

### Option 3: Verify Feature (UI-Focused)

Verify all behaviors for a feature doc:

\`\`\`bash
pnpm at verify feature <slug>
\`\`\`

### What Happens

Gemini will:
1. Read the spec/feature doc
2. Use appropriate tools (bt, bpd, typecheck, git)
3. Judge if implementation matches expectations
4. Write evidence to .claude/verification-evidence/${issueNum}.json

**Note:** Claude is blocked from writing to .claude/verification-evidence/.
Only Gemini can create verification evidence.`,
        fixCommand: `cat .claude/verification-evidence/${issueNum}.json | jq '.passed'`,
      }

    case 'verification_failed':
      return {
        type: 'verification_failed',
        title: `BLOCKED: Verification FAILED for issue #${issueNum}`,
        message: `The verification ran but tests did not pass.

Check the evidence file for details:
\`\`\`bash
cat .claude/verification-evidence/${issueNum}.json | jq '.'
\`\`\`

**To fix:**
1. Read the verification evidence to understand what failed
2. Fix the failing behaviors in your implementation
3. Re-run verification:
   \`pnpm at verify work "Verify <what-failed>" --issue=${issueNum}\`
   or
   \`pnpm at verify phase ${issueNum} <phase>\`

Verification will update the evidence file when all tests pass.`,
      }

    default:
      return undefined
  }
}

/**
 * Get the escape hatch message (always the same)
 */
export function getEscapeHatchMessage(): string {
  return `**🚨 ONLY IF GENUINELY BLOCKED:**
If you have a legitimate question that prevents progress (e.g., unclear requirements,
ambiguous spec, need user decision), use \`AskUserQuestion\` to get clarification.
The conversation will pause until user responds, then you can continue.
**DO NOT abuse this to skip conditions.** Only for genuine blockers where you cannot proceed.`
}

/**
 * Get next step guidance message
 */
export function getNextStepMessage(nextTask?: { id: string; title: string }): string {
  if (!nextTask) {
    return ''
  }

  return `**🎯 NEXT STEP (DO NOT SKIP):**
1. DO THE ACTUAL WORK for this task
2. When work is COMPLETE: Mark task completed via TodoWrite

**Current task:** ${nextTask.title}

**⚠️ WARNING: Do NOT bulk-complete tasks just to pass this check.**
Each task must be ACTUALLY COMPLETED with real work.
Tasks should be completed IN ORDER, not all at once.

**📏 Session Length is NOT a Limit**
You have UNLIMITED time and 1M context for this session.
Continue until ALL conditions are met.`
}
