export const SUPPORTED_SCHEDULE_CRONS = [
  "@daily",
  "@weekly",
  "@monthly",
] as const;

export type SupportedScheduleCron = (typeof SUPPORTED_SCHEDULE_CRONS)[number];

export function parseSupportedScheduleCron(
  scheduleCron: string | null | undefined,
): SupportedScheduleCron | null {
  if (!scheduleCron) return null;
  if ((SUPPORTED_SCHEDULE_CRONS as readonly string[]).includes(scheduleCron)) {
    return scheduleCron as SupportedScheduleCron;
  }
  return null;
}

export function scheduleCadenceLabel(
  scheduleCron: string | null | undefined,
): string {
  const parsed = parseSupportedScheduleCron(scheduleCron);
  if (!parsed) return "Off";
  switch (parsed) {
    case "@daily":
      return "Daily";
    case "@weekly":
      return "Weekly";
    case "@monthly":
      return "Monthly";
  }
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfUtcWeek(date: Date): Date {
  const dayStart = startOfUtcDay(date);
  const dow = dayStart.getUTCDay();
  return new Date(dayStart.getTime() - dow * 24 * 60 * 60 * 1000);
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function currentScheduleWindow(schedule: SupportedScheduleCron, now: Date): {
  slotStart: Date;
  slotEnd: Date;
} {
  switch (schedule) {
    case "@daily": {
      const slotStart = startOfUtcDay(now);
      return {
        slotStart,
        slotEnd: new Date(slotStart.getTime() + 24 * 60 * 60 * 1000),
      };
    }
    case "@weekly": {
      const slotStart = startOfUtcWeek(now);
      return {
        slotStart,
        slotEnd: new Date(slotStart.getTime() + 7 * 24 * 60 * 60 * 1000),
      };
    }
    case "@monthly": {
      const slotStart = startOfUtcMonth(now);
      return {
        slotStart,
        slotEnd: new Date(Date.UTC(slotStart.getUTCFullYear(), slotStart.getUTCMonth() + 1, 1)),
      };
    }
  }
}

export function nextScheduleRunAt(
  scheduleCron: string | null | undefined,
  now: Date,
): Date | null {
  const parsed = parseSupportedScheduleCron(scheduleCron);
  if (!parsed) return null;
  const { slotEnd } = currentScheduleWindow(parsed, now);
  return slotEnd;
}

export function scheduleBlockedReason(scheduleCron: string | null | undefined): string | null {
  if (!scheduleCron) return null;
  const parsed = parseSupportedScheduleCron(scheduleCron);
  if (parsed) return null;
  return "This cadence string is stored but not currently executable by the worker scheduler.";
}
