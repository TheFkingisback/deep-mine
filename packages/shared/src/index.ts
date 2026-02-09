/**
 * Deep Mine - Shared Package
 *
 * This barrel file re-exports all modules from the shared package,
 * providing a single entry point for importing game logic, types,
 * and utilities across client and server packages.
 *
 * Usage:
 * ```typescript
 * import { BlockType, generateChunk, addItem } from '@deep-mine/shared';
 * ```
 */

export * from './types';
export * from './constants';
export * from './items';
export * from './equipment';
export * from './layers';
export * from './world-gen';
export * from './inventory';
export * from './economy';
export * from './tnt';
export * from './events';
export * from './messages';
export * from './protocol';
