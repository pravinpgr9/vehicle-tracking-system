import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

const TOKEN_BYTES = 32;

/** A high-entropy, opaque secret suitable for a long-lived device token. */
export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString('hex');
}

/**
 * SHA-256, not bcrypt: device tokens are random and long-lived, so slow
 * hashing buys no protection against guessing and would add real latency
 * to every GPS ingestion request.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function verifyToken(token: string, hash: string): boolean {
  const candidate = Buffer.from(hashToken(token));
  const expected = Buffer.from(hash);
  return (
    candidate.length === expected.length && timingSafeEqual(candidate, expected)
  );
}
