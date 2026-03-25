import { describe, expect, it } from 'vitest';
import { classifyScanEnqueueFailure } from './scan-enqueue-failure-code';

describe('classifyScanEnqueueFailure', () => {
  it('classifies connection refused as queue unavailable', () => {
    expect(classifyScanEnqueueFailure('connect ECONNREFUSED 127.0.0.1:6379')).toBe('QUEUE_UNAVAILABLE');
  });

  it('classifies redis-related errors as queue unavailable', () => {
    expect(classifyScanEnqueueFailure('Redis connection to host:6379 failed')).toBe('QUEUE_UNAVAILABLE');
    expect(classifyScanEnqueueFailure('Redis down')).toBe('QUEUE_UNAVAILABLE');
  });

  it('classifies OOM style messages as queue rejected', () => {
    expect(classifyScanEnqueueFailure('OOM command not allowed')).toBe('QUEUE_REJECTED');
  });

  it('defaults unknown messages to kickoff failed unknown', () => {
    expect(classifyScanEnqueueFailure('Something weird')).toBe('KICKOFF_FAILED_UNKNOWN');
  });
});
