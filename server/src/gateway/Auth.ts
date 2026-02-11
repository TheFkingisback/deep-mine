import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';

// SECURITY: Require JWT_SECRET from environment. Generate random fallback ONLY for dev.
const JWT_SECRET = process.env.JWT_SECRET || (() => {
  const generated = randomBytes(32).toString('hex');
  console.warn('[Auth] WARNING: JWT_SECRET not set. Generated ephemeral secret for development.');
  console.warn('[Auth] Set JWT_SECRET environment variable for production.');
  return generated;
})();
const JWT_EXPIRY = '1h';

const ADJECTIVES = [
  'Brave', 'Swift', 'Bold', 'Lucky', 'Mighty', 'Clever', 'Dark', 'Iron',
  'Golden', 'Crystal', 'Shadow', 'Storm', 'Fire', 'Frost', 'Thunder',
  'Silent', 'Wild', 'Ancient', 'Noble', 'Mystic', 'Rapid', 'Fierce',
];

const NOUNS = [
  'Miner', 'Digger', 'Delver', 'Seeker', 'Finder', 'Breaker', 'Striker',
  'Explorer', 'Tunneler', 'Driller', 'Crusher', 'Smasher', 'Basher',
  'Carver', 'Cutter', 'Chipper', 'Borer', 'Reacher', 'Hauler', 'Toiler',
];

export interface JwtPayload {
  playerId: string;
  displayName: string;
  isGuest: boolean;
  iat?: number;
  exp?: number;
}

export interface GuestAuthResult {
  token: string;
  playerId: string;
  displayName: string;
}

function generateDisplayName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj}${noun}`;
}

/**
 * Create a guest authentication token.
 * Generates a UUID, random display name, and JWT.
 */
export function createGuestAuth(): GuestAuthResult {
  const playerId = uuidv4();
  const displayName = generateDisplayName();

  const payload: JwtPayload = {
    playerId,
    displayName,
    isGuest: true,
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });

  return { token, playerId, displayName };
}

/**
 * Validate a JWT token and return the payload.
 * Returns null if the token is invalid or expired.
 */
export function validateToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Extract token from auth message or HTTP header.
 */
export function extractToken(authString: string): string | null {
  if (authString.startsWith('Bearer ')) {
    return authString.slice(7);
  }
  return authString;
}
