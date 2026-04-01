import { z } from "zod";

export enum LogLevel {
  ERROR = "error",
  WARN = "warn",
  INFO = "info",
  DEBUG = "debug",
}

const logSchema = z.object({
  level: z.nativeEnum(LogLevel),
  message: z.string(),
  service: z.string().optional(),
  userId: z.string().optional(),
  organizationId: z.string().optional(),
  requestId: z.string().optional(),
  error: z.unknown().optional(),
  metadata: z.record(z.unknown()).optional(),
  timestamp: z.string().default(() => new Date().toISOString()),
});

export type LogEntry = z.infer<typeof logSchema>;

class Logger {
  private service: string;

  constructor(service: string) {
    this.service = service;
  }

  private log(
    level: LogLevel,
    message: string,
    extra?: Partial<
      Omit<LogEntry, "level" | "message" | "service" | "timestamp">
    >,
  ) {
    const entry: LogEntry = {
      level,
      message,
      service: this.service,
      timestamp: new Date().toISOString(),
      ...extra,
    };

    // In production, this would go to a proper logging service
    // For now, console.log with structured format
    if (process.env.NODE_ENV === "production") {
      console.log(JSON.stringify(entry));
    } else {
      const color = {
        [LogLevel.ERROR]: "\x1b[31m", // red
        [LogLevel.WARN]: "\x1b[33m", // yellow
        [LogLevel.INFO]: "\x1b[36m", // cyan
        [LogLevel.DEBUG]: "\x1b[35m", // magenta
      }[level];

      console.log(
        `${color}[${level.toUpperCase()}] ${this.service}: ${message}\x1b[0m`,
        extra ? JSON.stringify(extra, null, 2) : "",
      );
    }
  }

  error(
    message: string,
    extra?: Partial<
      Omit<LogEntry, "level" | "message" | "service" | "timestamp">
    >,
  ) {
    this.log(LogLevel.ERROR, message, extra);
  }

  warn(
    message: string,
    extra?: Partial<
      Omit<LogEntry, "level" | "message" | "service" | "timestamp">
    >,
  ) {
    this.log(LogLevel.WARN, message, extra);
  }

  info(
    message: string,
    extra?: Partial<
      Omit<LogEntry, "level" | "message" | "service" | "timestamp">
    >,
  ) {
    this.log(LogLevel.INFO, message, extra);
  }

  debug(
    message: string,
    extra?: Partial<
      Omit<LogEntry, "level" | "message" | "service" | "timestamp">
    >,
  ) {
    if (process.env.NODE_ENV !== "production") {
      this.log(LogLevel.DEBUG, message, extra);
    }
  }
}

// Create loggers for different services
export const apiLogger = new Logger("api");
export const authLogger = new Logger("auth");
export const billingLogger = new Logger("billing");
export const scanLogger = new Logger("scan");
export const workerLogger = new Logger("worker");
export const dbLogger = new Logger("db");

// Utility function to create request-scoped logger
export function createRequestLogger(
  requestId: string,
  userId?: string,
  organizationId?: string,
) {
  return {
    error: (message: string, extra?: Record<string, unknown>) =>
      apiLogger.error(message, { requestId, userId, organizationId, ...extra }),
    warn: (message: string, extra?: Record<string, unknown>) =>
      apiLogger.warn(message, { requestId, userId, organizationId, ...extra }),
    info: (message: string, extra?: Record<string, unknown>) =>
      apiLogger.info(message, { requestId, userId, organizationId, ...extra }),
    debug: (message: string, extra?: Record<string, unknown>) =>
      apiLogger.debug(message, { requestId, userId, organizationId, ...extra }),
  };
}
