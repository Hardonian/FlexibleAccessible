import { getRedisClient } from "@aros/shared";

export interface QueueStatus {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

/**
 * Diagnostic utility to fetch real-time worker fleet health.
 * Perfection requires high-availability monitoring for the "Money Machine".
 */
export async function getQueueDiagnostics(): Promise<QueueStatus[]> {
  const redis = getRedisClient();
  const queues = ["remediation", "crawler", "audit"];
  
  const stats = await Promise.all(
    queues.map(async (name) => {
      // BullMQ uses these keys
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        redis.llen(`bull:${name}:wait`),
        redis.scard(`bull:${name}:active`),
        redis.get(`bull:${name}:completed_count`).then(c => Number(c || 0)), // Mocking counter for demo
        redis.get(`bull:${name}:failed_count`).then(c => Number(c || 0)),
        redis.zcard(`bull:${name}:delayed`),
      ]);

      return {
        name,
        waiting,
        active,
        completed,
        failed,
        delayed,
      };
    })
  );

  return stats;
}
