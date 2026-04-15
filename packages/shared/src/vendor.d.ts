/**
 * Minimal ambient type stubs for infrastructure packages that are external
 * to @aros/shared (bullmq, ioredis, zod).
 *
 * These stubs satisfy the TypeScript DTS builder during `tsup --dts` on
 * environments (e.g. Vercel) where the real packages are not installed under
 * packages/shared/node_modules.  At runtime Node.js resolves the real
 * packages via the workspace root node_modules.
 *
 * Classes are typed as `any`-constructors so every method/property access
 * on their instances compiles without needing the full upstream type definitions.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

declare module 'bullmq' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Queue: new (name: string, opts?: any) => any;
  type Queue = any;
  export { Queue };
}

declare module 'ioredis' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Redis: new (url: string, opts?: any) => any;
  type Redis = any;
  export { Redis };
}

declare module 'zod' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  export namespace z {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type infer<_T> = any;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const z: any;
  export const ZodError: any;
  export type ZodSchema = any;
}
