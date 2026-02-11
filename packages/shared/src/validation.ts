/**
 * Shared validation utilities for Deep Mine.
 * Used by both server and client for input validation.
 */

// ─── Constants ──────────────────────────────────────────────────────

export const WORLD_MIN_X = 0;
export const WORLD_MAX_X = 2000;
export const WORLD_MIN_Y = 0;
export const WORLD_MAX_Y = 10000;

export const MAX_DISPLAY_NAME_LENGTH = 16;
export const MIN_DISPLAY_NAME_LENGTH = 1;
export const DISPLAY_NAME_REGEX = /^[a-zA-Z0-9_ \-]+$/;

export const MAX_CHAT_MESSAGE_LENGTH = 200;
export const MAX_SELL_ITEMS = 100;
export const MAX_ITEM_QUANTITY = 999;
export const MAX_PARTY_SIZE = 16;
export const MIN_PARTY_SIZE = 1;

export const VALID_EQUIPMENT_SLOTS = ['shovel', 'helmet', 'vest', 'torch', 'rope'] as const;
export const MIN_EQUIPMENT_TIER = 1;
export const MAX_EQUIPMENT_TIER = 7;

// ─── Validation Functions ───────────────────────────────────────────

/**
 * Validate that a value is a finite integer within the given range.
 */
export function isValidInt(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

/**
 * Validate that a value is a finite number within the given range.
 */
export function isValidNumber(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

/**
 * Validate world coordinates (block position).
 */
export function isValidCoordinate(x: unknown, y: unknown): boolean {
  return isValidInt(x, WORLD_MIN_X, WORLD_MAX_X) && isValidInt(y, WORLD_MIN_Y, WORLD_MAX_Y);
}

/**
 * Sanitize display name: trim, remove invalid chars, enforce length.
 * Returns null if the name is completely invalid.
 */
export function sanitizeDisplayName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const trimmed = name.trim();
  if (trimmed.length < MIN_DISPLAY_NAME_LENGTH) return null;

  // Remove any characters not in whitelist
  const cleaned = trimmed.replace(/[^a-zA-Z0-9_ \-]/g, '');
  if (cleaned.length < MIN_DISPLAY_NAME_LENGTH) return null;

  return cleaned.slice(0, MAX_DISPLAY_NAME_LENGTH);
}

/**
 * Sanitize chat message: remove control characters, enforce length.
 */
export function sanitizeChatMessage(message: unknown): string | null {
  if (typeof message !== 'string') return null;

  // Remove control characters (keep printable ASCII + common Unicode letters)
  let cleaned = message.replace(/[\x00-\x1F\x7F]/g, '');
  // Escape HTML entities to prevent XSS
  cleaned = cleaned
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  cleaned = cleaned.trim();
  if (cleaned.length === 0) return null;

  return cleaned.slice(0, MAX_CHAT_MESSAGE_LENGTH);
}

/**
 * Validate equipment slot string.
 */
export function isValidEquipmentSlot(slot: unknown): boolean {
  return typeof slot === 'string' && (VALID_EQUIPMENT_SLOTS as readonly string[]).includes(slot);
}

/**
 * Validate equipment tier number.
 */
export function isValidEquipmentTier(tier: unknown): boolean {
  return isValidInt(tier, MIN_EQUIPMENT_TIER, MAX_EQUIPMENT_TIER);
}

/**
 * Validate sell items array.
 */
export function isValidSellItems(items: unknown): boolean {
  if (!Array.isArray(items)) return false;
  if (items.length === 0 || items.length > MAX_SELL_ITEMS) return false;

  for (const item of items) {
    if (typeof item !== 'object' || item === null) return false;
    if (typeof (item as Record<string, unknown>).itemType !== 'string') return false;
    if (!isValidInt((item as Record<string, unknown>).quantity, 1, MAX_ITEM_QUANTITY)) return false;
  }
  return true;
}

/**
 * Validate match name string.
 */
export function sanitizeMatchName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > 32) return null;
  // Remove control characters and HTML
  return trimmed.replace(/[\x00-\x1F\x7F<>]/g, '').slice(0, 32);
}

/**
 * Validate max players for party creation.
 */
export function isValidMaxPlayers(maxPlayers: unknown): boolean {
  return isValidInt(maxPlayers, MIN_PARTY_SIZE, MAX_PARTY_SIZE);
}
