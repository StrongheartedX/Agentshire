const LEGACY_TOWN_SESSION_ID = "default";

export function sanitizeTownSessionId(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return LEGACY_TOWN_SESSION_ID;
  return trimmed.replace(/[^a-zA-Z0-9:_-]/g, "-");
}

export function createTownSessionKey(accountId: string, townSessionId: string): string {
  return `town:${accountId}:${sanitizeTownSessionId(townSessionId)}`;
}

export function extractTownSessionId(rawValue: unknown): string | null {
  if (typeof rawValue !== "string") return null;
  const raw = rawValue.trim();
  if (!raw) return null;

  const scopedMatch = /^town:[^:]+:(.+)$/.exec(raw);
  if (scopedMatch?.[1]) {
    return sanitizeTownSessionId(scopedMatch[1]);
  }

  if (/^town-[^:]+$/.test(raw)) {
    return LEGACY_TOWN_SESSION_ID;
  }

  return null;
}

export function resolveTownSessionId(rawValue: unknown): string {
  return extractTownSessionId(rawValue) ?? LEGACY_TOWN_SESSION_ID;
}
