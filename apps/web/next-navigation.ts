// Dummy implementations for App Router navigation hooks
export const useRouter = () => ({
  push: (url: string) => {
    // Dispatch a custom event to the browser window so our test can capture the arguments
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mock-router-push', { detail: url }));
    }
  },
  replace: () => {},
  prefetch: () => {},
  back: () => {},
  forward: () => {},
  refresh: () => {},
});
export const usePathname = () => '/mock-path';
export const useSearchParams = () => new URLSearchParams();