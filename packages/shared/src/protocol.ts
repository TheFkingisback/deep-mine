/**
 * Binary protocol for high-frequency messages (move, dig, block_update).
 * Uses DataView for efficient encoding/decoding.
 *
 * Format: [opcode: u8][payload...]
 *
 * Opcodes:
 *   0x01 = move       (client): x: f32, y: f32
 *   0x02 = dig        (client): x: i16, y: i16
 *   0x03 = block_update (server): x: i16, y: i16, hp: u8, maxHp: u8
 *   0x04 = block_destroyed (server): x: i16, y: i16
 *   0x05 = other_player_update (server): playerId_len: u8, playerId: utf8, x: f32, y: f32, action: u8
 *
 * All other messages continue using JSON.
 */

export const OP_MOVE = 0x01;
export const OP_DIG = 0x02;
export const OP_BLOCK_UPDATE = 0x03;
export const OP_BLOCK_DESTROYED = 0x04;
export const OP_OTHER_PLAYER_UPDATE = 0x05;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// --- Encoders ---

export function encodeMove(x: number, y: number): ArrayBuffer {
  const buf = new ArrayBuffer(9);
  const view = new DataView(buf);
  view.setUint8(0, OP_MOVE);
  view.setFloat32(1, x, true);
  view.setFloat32(5, y, true);
  return buf;
}

export function encodeDig(x: number, y: number): ArrayBuffer {
  const buf = new ArrayBuffer(5);
  const view = new DataView(buf);
  view.setUint8(0, OP_DIG);
  view.setInt16(1, x, true);
  view.setInt16(3, y, true);
  return buf;
}

export function encodeBlockUpdate(x: number, y: number, hp: number, maxHp: number): ArrayBuffer {
  const buf = new ArrayBuffer(7);
  const view = new DataView(buf);
  view.setUint8(0, OP_BLOCK_UPDATE);
  view.setInt16(1, x, true);
  view.setInt16(3, y, true);
  view.setUint8(5, hp);
  view.setUint8(6, maxHp);
  return buf;
}

export function encodeBlockDestroyed(x: number, y: number): ArrayBuffer {
  const buf = new ArrayBuffer(5);
  const view = new DataView(buf);
  view.setUint8(0, OP_BLOCK_DESTROYED);
  view.setInt16(1, x, true);
  view.setInt16(3, y, true);
  return buf;
}

export function encodeOtherPlayerUpdate(
  playerId: string,
  x: number,
  y: number,
  action: number
): ArrayBuffer {
  const idBytes = encoder.encode(playerId);
  const buf = new ArrayBuffer(2 + idBytes.length + 9);
  const view = new DataView(buf);
  let offset = 0;

  view.setUint8(offset, OP_OTHER_PLAYER_UPDATE); offset += 1;
  view.setUint8(offset, idBytes.length); offset += 1;

  new Uint8Array(buf, offset, idBytes.length).set(idBytes);
  offset += idBytes.length;

  view.setFloat32(offset, x, true); offset += 4;
  view.setFloat32(offset, y, true); offset += 4;
  view.setUint8(offset, action);
  return buf;
}

// --- Decoders ---

export interface DecodedMove {
  type: 'move';
  x: number;
  y: number;
}

export interface DecodedDig {
  type: 'dig';
  x: number;
  y: number;
}

export interface DecodedBlockUpdate {
  type: 'block_update';
  x: number;
  y: number;
  hp: number;
  maxHp: number;
}

export interface DecodedBlockDestroyed {
  type: 'block_destroyed';
  x: number;
  y: number;
}

export interface DecodedOtherPlayerUpdate {
  type: 'other_player_update';
  playerId: string;
  x: number;
  y: number;
  action: number;
}

export type DecodedBinaryMessage =
  | DecodedMove
  | DecodedDig
  | DecodedBlockUpdate
  | DecodedBlockDestroyed
  | DecodedOtherPlayerUpdate;

export function decodeBinary(buf: ArrayBuffer): DecodedBinaryMessage | null {
  const view = new DataView(buf);
  if (buf.byteLength < 1) return null;

  const opcode = view.getUint8(0);

  switch (opcode) {
    case OP_MOVE: {
      if (buf.byteLength < 9) return null;
      return {
        type: 'move',
        x: view.getFloat32(1, true),
        y: view.getFloat32(5, true),
      };
    }
    case OP_DIG: {
      if (buf.byteLength < 5) return null;
      return {
        type: 'dig',
        x: view.getInt16(1, true),
        y: view.getInt16(3, true),
      };
    }
    case OP_BLOCK_UPDATE: {
      if (buf.byteLength < 7) return null;
      return {
        type: 'block_update',
        x: view.getInt16(1, true),
        y: view.getInt16(3, true),
        hp: view.getUint8(5),
        maxHp: view.getUint8(6),
      };
    }
    case OP_BLOCK_DESTROYED: {
      if (buf.byteLength < 5) return null;
      return {
        type: 'block_destroyed',
        x: view.getInt16(1, true),
        y: view.getInt16(3, true),
      };
    }
    case OP_OTHER_PLAYER_UPDATE: {
      if (buf.byteLength < 11) return null;
      const idLen = view.getUint8(1);
      if (buf.byteLength < 2 + idLen + 9) return null;
      const idBytes = new Uint8Array(buf, 2, idLen);
      const playerId = decoder.decode(idBytes);
      const offset = 2 + idLen;
      return {
        type: 'other_player_update',
        playerId,
        x: view.getFloat32(offset, true),
        y: view.getFloat32(offset + 4, true),
        action: view.getUint8(offset + 8),
      };
    }
    default:
      return null;
  }
}

/**
 * Check if a WebSocket message is binary (ArrayBuffer) or JSON (string).
 */
export function isBinaryMessage(data: unknown): data is ArrayBuffer {
  return data instanceof ArrayBuffer;
}
