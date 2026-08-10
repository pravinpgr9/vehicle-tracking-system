const UNIT_SECONDS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 60 * 60 * 24,
};

const DURATION_PATTERN = /^(\d+)([smhd])$/;

/**
 * Parses short duration strings like "7d", "24h", "15m", "60s" into seconds.
 * Used for JWT_EXPIRES_IN so jsonwebtoken's `expiresIn` (which wants a
 * number of seconds or its own template-literal string type) gets a plain
 * number instead of fighting that type at every call site.
 */
export function parseDurationToSeconds(value: string): number {
  const match = DURATION_PATTERN.exec(value.trim());
  if (!match) {
    throw new Error(
      `Invalid duration "${value}", expected a pattern like "7d", "24h", "15m", "60s"`,
    );
  }
  const [, amount, unit] = match;
  return Number(amount) * UNIT_SECONDS[unit];
}
