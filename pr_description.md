🧹 [Code Health] Replace console.log with proper logger

🎯 **What:** The code health issue addressed
Replaced all instances of `console.log` and `console.error` with the proper `workerLogger` from `@aros/shared` in `apps/worker/src/index.ts`.

💡 **Why:** How this improves maintainability
This ensures logs are properly structured for the logging system instead of just printing to stdout. This makes debugging and log aggregation much easier.

✅ **Verification:** How you confirmed the change is safe
I ran `npm run verify:core` and `npm run typecheck --workspace=apps/worker` to ensure no functionality is broken and no types are broken.

✨ **Result:** The improvement achieved
Cleaned up the worker logs to use proper structured logging.
