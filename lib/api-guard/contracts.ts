export const API_GUARD_DOCUMENT_KEY = "API_GUARD" as const;

export type ApiGuardState = {
  enabled: boolean;
  mode: "decoy";
  revision: number;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type ApiGuardCommand = "ENABLE" | "DISABLE";

export const DEFAULT_API_GUARD_STATE: ApiGuardState = {
  enabled: false,
  mode: "decoy",
  revision: 0,
  updatedAt: null,
  updatedBy: null,
};

export function normalizeApiGuardState(value: unknown): ApiGuardState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.enabled !== "boolean") return null;
  if (
    typeof record.revision !== "number" ||
    !Number.isSafeInteger(record.revision) ||
    record.revision < 0
  ) {
    return null;
  }

  return {
    enabled: record.enabled,
    mode: "decoy",
    revision: record.revision,
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : null,
    updatedBy: typeof record.updatedBy === "string" ? record.updatedBy : null,
  };
}
