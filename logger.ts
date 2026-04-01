/**
 * A simple logger that wraps console.log and console.error.
 * This can be expanded in the future to support different logging levels,
 * transports (e.g., file, remote service), and structured logging.
 */
export const logger = {
  log: (...args: any[]) => {
    // In a real application, this could be a call to a more robust
    // logging library like Winston or Pino.
    console.log(...args);
  },
  error: (...args: any[]) => {
    console.error(...args);
  },
};