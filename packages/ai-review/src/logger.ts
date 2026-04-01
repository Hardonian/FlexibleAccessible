interface LogEntry {
  timestamp: string;
  level: "log" | "error" | "warn";
  message: string;
  metadata?: unknown;
}

function formatMessage(level: "log" | "error" | "warn", message: string, metadata?: unknown): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(metadata !== undefined && { metadata }),
  };
}

export const logger = {
  log(message: string, ...args: unknown[]): void {
    if (args.length > 0) {
      console.log(formatMessage("log", message), ...args);
    } else {
      console.log(formatMessage("log", message));
    }
  },

  warn(message: string, ...args: unknown[]): void {
    if (args.length > 0) {
      console.warn(formatMessage("warn", message), ...args);
    } else {
      console.warn(formatMessage("warn", message));
    }
  },

  error(message: string, ...args: unknown[]): void {
    if (args.length > 0) {
      console.error(formatMessage("error", message), ...args);
    } else {
      console.error(formatMessage("error", message));
    }
  },
};
}

export const logger = {
  log(message: string, ...args: unknown[]): void {
    if (args.length > 0) {
      console.log(formatMessage("log", message), ...args);
    } else {
      console.log(formatMessage("log", message));
    }
  },

  error(message: string, ...args: unknown[]): void {
    if (args.length > 0) {
      console.error(formatMessage("error", message), ...args);
    } else {
      console.error(formatMessage("error", message));
    }
  },
};
