// Dummy implementations for App Router navigation hooks
export const useRouter = () => ({
  push: () => {},
  replace: () => {},
  prefetch: () => {},
  back: () => {},
  forward: () => {},
  refresh: () => {},
});
export const usePathname = () => '/mock-path';
export const useSearchParams = () => new URLSearchParams();