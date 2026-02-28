# Rename `verify-phase` → `phase-check`

Rename the per-phase process gate command from `kata verify-phase` to `kata phase-check` to avoid confusion with the dedicated Verify mode (`kata verify-run`).

## Files to change

### 1. Rename source file
- `src/commands/verify-phase.ts` → `src/commands/phase-check.ts`
- Update comment header, function name `verifyPhase` → `phaseCheck`, console output strings

### 2. CLI dispatcher (`src/index.ts`)
- Import: `verify-phase.js` → `phase-check.js`, `verifyPhase` → `phaseCheck`
- Switch case: `'verify-phase'` → `'phase-check'`
- Help text: `kata verify-phase` → `kata phase-check`

### 3. Stop condition messages (`src/commands/can-exit.ts`)
- All `verify-phase` strings in `checkTestsPass()` error messages → `phase-check`
- ~5 occurrences in reason strings

### 4. Subphase patterns (`batteries/subphase-patterns.yaml`)
- 3 instruction strings: `kata verify-phase` → `kata phase-check`
- (keep pattern names `impl-test-verify`, `impl-verify` unchanged — those are pattern identifiers, not command references)

### 5. Task factory fallback (`src/commands/enter/task-factory.ts`)
- `VP_FALLBACK_TEXT` constant: `kata verify-phase` → `kata phase-check`

### 6. Session lookup comments (`src/session/lookup.ts`)
- 2 docstring lines: `verify-phase output` → `phase-check output`

### 7. Tests (`src/config/subphase-patterns.test.ts`)
- 5 occurrences: `kata verify-phase` → `kata phase-check` in instruction strings/assertions

### 8. Eval assertions (`eval/assertions.ts`)
- `assertNativeTaskHasInstruction(/verify-phase/)` → `/phase-check/`
- Comment update

### 9. Eval test (`eval/assertions.test.ts`)
- ~5 occurrences: instruction strings + assertion name

### 10. Eval scenarios
- `eval/scenarios/impl-3step-verify.ts` — comments + assertion regex
- `eval/scenarios/impl-task-gen-default.ts` — comment
- `eval/scenarios/impl-task-gen-custom.ts` — comments + instruction string + assertion regex

## NOT changing
- Evidence file prefix (`phase-*-{issue}.json`) — that's a data format, not a command name
- Template names / mode names (`verify.md`, etc.)
- Pattern IDs (`impl-test-verify`, `impl-verify`) — those are identifiers in template configs
- The word "verify" in non-command contexts (e.g., "Verify environment")

## Build & test
- `npm run build && npm test` after all changes
- Quick manual check: `kata phase-check --help` (should show usage)
