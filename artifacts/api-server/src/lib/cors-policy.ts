export function parseAllowedCorsOrigins(
  value: string | undefined,
): ReadonlySet<string> {
  const origins = new Set<string>();
  for (const entry of (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)) {
    if (entry === "*") {
      throw new Error(
        "CORS_ALLOWED_ORIGINS must list exact HTTP(S) origins, not a wildcard.",
      );
    }
    let parsed: URL;
    try {
      parsed = new URL(entry);
    } catch {
      throw new Error("CORS_ALLOWED_ORIGINS contains an invalid origin.");
    }
    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      parsed.origin !== entry ||
      parsed.username ||
      parsed.password
    ) {
      throw new Error(
        "CORS_ALLOWED_ORIGINS entries must be exact HTTP(S) origins without paths or credentials.",
      );
    }
    origins.add(parsed.origin);
  }
  return origins;
}

export function isAllowedCorsOrigin(
  requestOrigin: string | undefined,
  allowedOrigins: ReadonlySet<string>,
): boolean {
  return Boolean(requestOrigin && allowedOrigins.has(requestOrigin));
}
