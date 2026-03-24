import { describe, expect, it, vi, beforeEach } from 'vitest';

const QueueMock = vi.fn().mockImplementation(() => ({
  add: vi.fn(),
  close: vi.fn(),
}));

vi.mock('bullmq', () => ({
  Queue: QueueMock,
}));

vi.mock('@aros/shared', () => ({
  bullmqConnectionOptions: () => ({ url: 'redis://test:6379', maxRetriesPerRequest: null }),
  getSharedScanQueue: vi.fn().mockReturnValue({ add: vi.fn(), close: vi.fn() }),
}));

describe('queue lazy init', () => {
  beforeEach(() => {
    vi.resetModules();
    QueueMock.mockClear();
  });

  it('does not construct BullMQ Queue on module import', async () => {
    expect(QueueMock).not.toHaveBeenCalled();
    await import('./queue');
    expect(QueueMock).not.toHaveBeenCalled();
  });

  it('constructs crawl queue only when getCrawlQueue is called', async () => {
    const { getCrawlQueue } = await import('./queue');
    getCrawlQueue();
    expect(QueueMock).toHaveBeenCalled();
  });
});
