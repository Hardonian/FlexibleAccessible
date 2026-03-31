// Dummy input file to resolve TypeScript 'No inputs found' for the solution-style root tsconfig.json.
// This is required because the root config references project workspaces but also needs at least one 'file' or 'include' entry.

export const VERIFIED_ENV = {
  status: "ok",
  timestamp: new Date().toISOString(),
};
