/**
 * Minimal structured logger. Emits one JSON object per line so logs stay
 * machine-readable and can carry a correlation id across a request.
 * Never log secrets, tokens, or full patient content (PRD section 18).
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = Record<string, unknown>;

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function minLevel(): LogLevel {
  const configured = process.env.LOG_LEVEL;
  if (configured && configured in LEVEL_ORDER) {
    return configured as LogLevel;
  }
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function emit(level: LogLevel, msg: string, fields?: LogFields) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel()]) return;

  const entry = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...fields,
  };

  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (msg: string, fields?: LogFields) => emit("debug", msg, fields),
  info: (msg: string, fields?: LogFields) => emit("info", msg, fields),
  warn: (msg: string, fields?: LogFields) => emit("warn", msg, fields),
  error: (msg: string, fields?: LogFields) => emit("error", msg, fields),
};
