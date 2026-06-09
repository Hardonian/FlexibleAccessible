import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createIssue } from './github';

describe('github integration', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('createIssue', () => {
    it('creates an issue successfully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ html_url: 'https://github.com/test/issue/1' })
      });

      const config = { owner: 'test-owner', repo: 'test-repo', token: 'fake-token' };
      const payload = { title: 'Test Issue', body: 'Test body' };

      const result = await createIssue(config, payload);
      expect(result.html_url).toBe('https://github.com/test/issue/1');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('throws an error when response is not ok', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: vi.fn().mockResolvedValue('Rate limit exceeded')
      });

      const config = { owner: 'test-owner', repo: 'test-repo', token: 'fake-token' };
      const payload = { title: 'Test Issue', body: 'Test body' };

      await expect(createIssue(config, payload)).rejects.toThrow(
        'Failed to create GitHub issue: 403 - Rate limit exceeded'
      );

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/test-owner/test-repo/issues',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer fake-token',
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github+json'
          }),
          body: expect.any(String)
        })
      );
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/test-owner/test-repo/issues',
        expect.objectContaining({
          method: 'POST'
        })
      );
    });
  });
});
