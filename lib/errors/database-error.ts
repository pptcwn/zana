import "server-only";

type DatabaseErrorLike = {
  code?: unknown;
  details?: unknown;
  hint?: unknown;
  message?: unknown;
};

export class DatabaseError extends Error {
  constructor(
    public readonly operation: string,
    public readonly code: string | undefined,
    message: string
  ) {
    super(`[${operation}]${code ? ` ${code}:` : ""} ${message}`);
    this.name = "DatabaseError";
  }
}

function isDatabaseErrorLike(value: unknown): value is DatabaseErrorLike {
  return typeof value === "object" && value !== null;
}

export function toDatabaseError(error: unknown, operation: string) {
  if (error instanceof Error) return error;

  if (isDatabaseErrorLike(error)) {
    const code = typeof error.code === "string" ? error.code : undefined;
    const message = typeof error.message === "string"
      ? error.message
      : "Database request failed";

    const migrationHint =
      code === "PGRST202" ||
      code === "42703" ||
      message.includes("schema cache") ||
      message.includes("does not exist")
        ? " Apply the pending Supabase migration before running this build."
        : "";

    return new DatabaseError(operation, code, `${message}${migrationHint}`);
  }

  return new DatabaseError(operation, undefined, "Database request failed");
}

export function throwDatabaseError(error: unknown, operation: string): never {
  throw toDatabaseError(error, operation);
}
