# Wiggum Loop Mode - Autonomous Quality Development

When active, this rule REQUIRES:

## After EVERY code change:
1. Run TypeScript compilation check
2. Run available tests
3. Fix any errors before proceeding

## After EVERY feature addition:
1. Write tests for the feature
2. Run all tests
3. Commit with descriptive message

## Commit Requirements:
- Commit after every working feature
- Commit message format: "feat/fix/test: description"
- Never commit broken code

## Completion:
- Only output <promise>TASK_COMPLETE</promise> when ALL criteria are met
- Self-verify by running tests one final time
- Check for TypeScript errors before declaring complete

## Iteration Tracking:
- Track iteration count
- Report progress every 5 iterations
- Stop at max iterations if not complete
