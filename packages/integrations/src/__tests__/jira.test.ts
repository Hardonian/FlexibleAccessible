import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createIssue, findRelatedIssues, addComment } from '../jira';
import { JiraClientConfig, CreateIssuePayload } from '../types';

describe('Jira Integration', () => {
  const mockConfig: JiraClientConfig = {
    baseUrl: 'https://test.atlassian.net',
    email: 'test@example.com',
    apiToken: 'test-token',
    projectKey: 'TEST'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe('createIssue', () => {
    const mockPayload: CreateIssuePayload = {
      title: 'Test Issue',
      description: 'This is a test issue',
      details: [{ label: 'URL', value: 'https://example.com' }]
    };

    it('should throw an error if the response is not ok', async () => {
      const mockErrorResponse = {
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue('Bad Request')
      };

      (global.fetch as any).mockResolvedValue(mockErrorResponse);

      await expect(createIssue(mockConfig, mockPayload)).rejects.toThrow(
        'Failed to create Jira issue: 400 - Bad Request'
      );

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should return issue data on success', async () => {
      const mockSuccessResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ id: '10000', key: 'TEST-1' })
      };

      (global.fetch as any).mockResolvedValue(mockSuccessResponse);

      const result = await createIssue(mockConfig, mockPayload);
      expect(result).toEqual({ id: '10000', key: 'TEST-1' });

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const callArgs = vi.mocked(global.fetch).mock.calls[0];
      expect(callArgs[0]).toContain('/rest/api/3/issue');
      expect(callArgs[1]?.method).toBe('POST');
    });
  });

  describe('findRelatedIssues', () => {
    it('should throw an error if the response is not ok', async () => {
      const mockErrorResponse = {
        ok: false,
        status: 500
      };

      (global.fetch as any).mockResolvedValue(mockErrorResponse);

      await expect(findRelatedIssues(mockConfig, 'https://example.com')).rejects.toThrow(
        'Failed to search Jira: 500'
      );
    });

    it('should return issues on success', async () => {
      const mockIssues = [{ id: '10000', key: 'TEST-1' }];
      const mockSuccessResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ issues: mockIssues })
      };

      (global.fetch as any).mockResolvedValue(mockSuccessResponse);

      const result = await findRelatedIssues(mockConfig, 'https://example.com');
      expect(result).toEqual(mockIssues);
    });

    it('should return empty array if issues property is missing', async () => {
      const mockSuccessResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({})
      };

      (global.fetch as any).mockResolvedValue(mockSuccessResponse);

      const result = await findRelatedIssues(mockConfig, 'https://example.com');
      expect(result).toEqual([]);
    });
  });

  describe('addComment', () => {
    it('should throw an error if the response is not ok', async () => {
      const mockErrorResponse = {
        ok: false,
        status: 403
      };

      (global.fetch as any).mockResolvedValue(mockErrorResponse);

      await expect(addComment(mockConfig, 'TEST-1', 'Test comment')).rejects.toThrow(
        'Failed to add comment: 403'
      );
    });

    it('should complete successfully on ok response', async () => {
      const mockSuccessResponse = {
        ok: true
      };

      (global.fetch as any).mockResolvedValue(mockSuccessResponse);

      await expect(addComment(mockConfig, 'TEST-1', 'Test comment')).resolves.not.toThrow();
    });
  });
});
