import { WebSocketServer, WebSocket } from 'ws';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { ClientMessage, ConnectedPlayer } from './types.js';
import { MatchManager } from './MatchManager.js';
import { randomBytes } from 'crypto';
import { validateToken } from './gateway/Auth.js';
import * as UserService from './auth/UserService.js';
import { getShovelDamage, canBuyEquipment, getEquipmentPrice, getNextTier, getVestBonusSlots } from '@shared/equipment';
import { rollLootDrop } from '@shared/layers';
import { getItemValue } from '@shared/items';
import { addItem, removeItem } from '@shared/inventory';
import { BlockType, DropItem, EquipmentSlot, EquipmentTier, ItemType } from '@shared/types';
import { INVENTORY_UPGRADE_SLOTS, INVENTORY_UPGRADE_PRICES } from '@shared/constants';
import {
  isValidCoordinate,
  sanitizeDisplayName,
  sanitizeChatMessage,
  sanitizeMatchName,
  isValidMaxPlayers,
  isValidSellItems,
  isValidEquipmentSlot,
  isValidEquipmentTier,
  isValidInt,
} from '@shared/validation';

const PORT = Number(process.env.PORT) || 9001;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);
const isDev = process.env.NODE_ENV !== 'production';

// ─── Security: Rate Limiting ────────────────────────────────────────

const MAX_CONNECTIONS_PER_IP = 10;
const MAX_MESSAGES_PER_SECOND = 30;
const MAX_TOTAL_CONNECTIONS = 5000;
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

const ipConnectionCount = new Map<string, number>();
const playerMessageRate = new Map<string, { count: number; resetTime: number }>();
const playerSeqNumbers = new Map<string, number>(); // H9: replay prevention

function checkSequence(playerId: string, seq: unknown): boolean {
  if (typeof seq !== 'number' || !Number.isInteger(seq) || seq < 0) return false;
  const lastSeq = playerSeqNumbers.get(playerId) ?? -1;
  if (seq <= lastSeq) return false; // Replay or out-of-order
  playerSeqNumbers.set(playerId, seq);
  return true;
}

function checkMessageRate(playerId: string): boolean {
  const now = Date.now();
  let rate = playerMessageRate.get(playerId);
  if (!rate || now > rate.resetTime) {
    rate = { count: 0, resetTime: now + 1000 };
    playerMessageRate.set(playerId, rate);
  }
  rate.count++;
  return rate.count <= MAX_MESSAGES_PER_SECOND;
}

// ─── HTTP + WebSocket Server (M1: health endpoint, C4-C7: security) ─

const httpServer = createServer();

const wss = new WebSocketServer({
  server: httpServer,
  maxPayload: 16 * 1024,
  verifyClient: (info: { req: IncomingMessage; origin: string }, callback: (result: boolean, code?: number, message?: string) => void) => {
    const origin = info.req.headers.origin ?? '';
    if (!isDev && ALLOWED_ORIGINS.length > 0 && !ALLOWED_ORIGINS.includes(origin)) {
      callback(false, 403, 'Origin not allowed');
      return;
    }
    const ip = info.req.socket.remoteAddress ?? 'unknown';
    const currentCount = ipConnectionCount.get(ip) ?? 0;
    if (currentCount >= MAX_CONNECTIONS_PER_IP) {
      callback(false, 429, 'Too many connections');
      return;
    }
    if (wss.clients.size >= MAX_TOTAL_CONNECTIONS) {
      callback(false, 503, 'Server at capacity');
      return;
    }
    callback(true);
  },
});

const players = new Map<string, ConnectedPlayer>();
const matchManager = new MatchManager();

// ─── HTTP helpers ────────────────────────────────────────────────────

function parseJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); if (body.length > 10000) reject(new Error('Body too large')); });
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch { reject(new Error('Invalid JSON')); } });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' });
  res.end(JSON.stringify(data));
}

// ─── HTTP endpoints ──────────────────────────────────────────────────

httpServer.on('request', async (req: IncomingMessage, res: ServerResponse) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
    res.end();
    return;
  }

  if (req.url === '/health') {
    sendJson(res, 200, {
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      connections: wss.clients.size,
      matches: matchManager.getAllMatches().size,
      players: players.size,
      memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/register') {
    try {
      const body = await parseJsonBody(req);
      const result = await UserService.register({
        email: String(body.email ?? ''),
        password: String(body.password ?? ''),
        firstName: String(body.firstName ?? ''),
        lastName: String(body.lastName ?? ''),
        nickname: String(body.nickname ?? ''),
      });
      sendJson(res, result.success ? 200 : 400, result);
    } catch { sendJson(res, 400, { success: false, error: 'Invalid request' }); }
    return;
  }

  if (req.method === 'POST' && req.url === '/api/login') {
    try {
      const body = await parseJsonBody(req);
      const result = await UserService.login(String(body.email ?? ''), String(body.password ?? ''));
      sendJson(res, result.success ? 200 : 401, result);
    } catch { sendJson(res, 400, { success: false, error: 'Invalid request' }); }
    return;
  }

  if (req.method === 'POST' && req.url === '/api/forgot') {
    try {
      const body = await parseJsonBody(req);
      const result = await UserService.forgotPassword(String(body.email ?? ''));
      sendJson(res, 200, result);
    } catch { sendJson(res, 400, { success: false, error: 'Invalid request' }); }
    return;
  }

  if (req.method === 'POST' && req.url === '/api/reset') {
    try {
      const body = await parseJsonBody(req);
      const result = await UserService.resetPassword(String(body.token ?? ''), String(body.password ?? ''));
      sendJson(res, result.success ? 200 : 400, result);
    } catch { sendJson(res, 400, { success: false, error: 'Invalid request' }); }
    return;
  }

  res.writeHead(404);
  res.end();
});

httpServer.listen(PORT, () => {
  console.log(`[Server] Listening on port ${PORT}`);
});

wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
  const ip = req.socket.remoteAddress ?? 'unknown';
  ipConnectionCount.set(ip, (ipConnectionCount.get(ip) ?? 0) + 1);

  const playerId = uuidv4();
  const displayName = `Miner_${playerId.slice(0, 4)}`;
  const player: ConnectedPlayer = {
    id: playerId,
    displayName,
    ws,
    authenticated: false,
    shardId: null,
    lastActivity: Date.now(),
  };

  players.set(playerId, player);

  ws.on('message', (data) => {
    if (!checkMessageRate(playerId)) {
      sendTo(ws, { type: 'error', code: 'RATE_LIMITED', message: 'Too many messages' });
      return;
    }
    try {
      const message = JSON.parse(data.toString()) as ClientMessage;
      player.lastActivity = Date.now();
      handleMessage(player, message);
    } catch {
      sendTo(ws, { type: 'error', code: 'INVALID_MESSAGE', message: 'Could not parse message' });
    }
  });

  ws.on('close', () => {
    const count = ipConnectionCount.get(ip) ?? 1;
    if (count <= 1) ipConnectionCount.delete(ip);
    else ipConnectionCount.set(ip, count - 1);

    const result = matchManager.leaveMatch(playerId);
    if (result) {
      matchManager.broadcastToAllInMatch(result.match.id, {
        type: 'other_player_left',
        playerId,
      });
    }
    players.delete(playerId);
    playerMessageRate.delete(playerId);
    playerSeqNumbers.delete(playerId);
  });

  ws.on('error', () => {});
});

function handleMessage(player: ConnectedPlayer, message: ClientMessage): void {
  if (!message || typeof message.type !== 'string') {
    sendTo(player.ws, { type: 'error', code: 'INVALID_MESSAGE', message: 'Missing message type' });
    return;
  }

  switch (message.type) {
    case 'list_matches': {
      sendTo(player.ws, { type: 'match_list', matches: matchManager.listMatches() });
      break;
    }

    case 'create_match': {
      const matchName = sanitizeMatchName(message.matchName) ?? 'Unnamed Match';
      const match = matchManager.createMatch(matchName);
      const result = matchManager.joinMatch(match.id, player.id, player.displayName, player.ws);
      if (!result) break;
      sendTo(player.ws, {
        type: 'match_joined',
        matchId: match.id, matchName: match.name, seed: match.seed,
        playerId: player.id, displayName: player.displayName,
        spawnX: result.spawnX, spawnY: 1, players: [],
      });
      break;
    }

    case 'join_match': {
      if (typeof message.matchId !== 'string' || message.matchId.length > 20) {
        sendTo(player.ws, { type: 'error', code: 'INVALID_INPUT', message: 'Invalid match ID' });
        break;
      }
      const result = matchManager.joinMatch(message.matchId, player.id, player.displayName, player.ws);
      if (!result) { sendTo(player.ws, { type: 'error', code: 'MATCH_NOT_FOUND', message: 'Match not found or full' }); break; }
      const { match, spawnX } = result;
      const others = [...match.players.values()].filter(p => p.id !== player.id)
        .map(p => ({ playerId: p.id, displayName: p.displayName, x: p.x, y: p.y, gold: p.gold, items: p.items }));
      sendTo(player.ws, {
        type: 'match_joined',
        matchId: match.id, matchName: match.name, seed: match.seed,
        playerId: player.id, displayName: player.displayName,
        spawnX, spawnY: 1, players: others,
      });
      matchManager.broadcastToMatch(match.id, player.id, {
        type: 'other_player_joined', playerId: player.id, displayName: player.displayName, x: spawnX, y: 1,
      });
      break;
    }

    case 'join_quick_play': {
      let match = matchManager.findQuickPlayMatch();
      if (!match) match = matchManager.createMatch('Quick Match');
      const result = matchManager.joinMatch(match.id, player.id, player.displayName, player.ws);
      if (!result) break;
      const others = [...result.match.players.values()].filter(p => p.id !== player.id)
        .map(p => ({ playerId: p.id, displayName: p.displayName, x: p.x, y: p.y, gold: p.gold, items: p.items }));
      sendTo(player.ws, {
        type: 'match_joined',
        matchId: result.match.id, matchName: result.match.name, seed: result.match.seed,
        playerId: player.id, displayName: player.displayName,
        spawnX: result.spawnX, spawnY: 1, players: others,
      });
      matchManager.broadcastToMatch(result.match.id, player.id, {
        type: 'other_player_joined', playerId: player.id, displayName: player.displayName, x: result.spawnX, y: 1,
      });
      break;
    }

    case 'play_solo': {
      const match = matchManager.createMatch(`Solo_${player.displayName}`, 1);
      const result = matchManager.joinMatch(match.id, player.id, player.displayName, player.ws);
      if (!result) break;
      sendTo(player.ws, {
        type: 'match_joined',
        matchId: match.id, matchName: match.name, seed: match.seed,
        playerId: player.id, displayName: player.displayName,
        spawnX: result.spawnX, spawnY: 1, players: [],
      });
      break;
    }

    case 'create_party': {
      const rawMax = message.maxPlayers ?? 8;
      const maxPlayers = isValidMaxPlayers(rawMax) ? rawMax : 8;
      const match = matchManager.createMatch(`Party_${player.displayName}`, maxPlayers);
      const result = matchManager.joinMatch(match.id, player.id, player.displayName, player.ws);
      if (!result) break;
      sendTo(player.ws, {
        type: 'match_joined',
        matchId: match.id, matchName: match.name, seed: match.seed,
        playerId: player.id, displayName: player.displayName,
        spawnX: result.spawnX, spawnY: 1, players: [],
      });
      break;
    }

    case 'join_party': {
      if (typeof message.roomCode !== 'string' || message.roomCode.length > 20) {
        sendTo(player.ws, { type: 'error', code: 'INVALID_INPUT', message: 'Invalid room code' });
        break;
      }
      const result = matchManager.joinMatch(message.roomCode, player.id, player.displayName, player.ws);
      if (!result) { sendTo(player.ws, { type: 'error', code: 'MATCH_NOT_FOUND', message: 'Match not found or full' }); break; }
      const { match, spawnX } = result;
      const others = [...match.players.values()].filter(p => p.id !== player.id)
        .map(p => ({ playerId: p.id, displayName: p.displayName, x: p.x, y: p.y, gold: p.gold, items: p.items }));
      sendTo(player.ws, {
        type: 'match_joined',
        matchId: match.id, matchName: match.name, seed: match.seed,
        playerId: player.id, displayName: player.displayName,
        spawnX, spawnY: 1, players: others,
      });
      matchManager.broadcastToMatch(match.id, player.id, {
        type: 'other_player_joined', playerId: player.id, displayName: player.displayName, x: spawnX, y: 1,
      });
      break;
    }

    case 'move': {
      const match = matchManager.getPlayerMatch(player.id);
      if (!match) break;
      const mp = match.players.get(player.id);
      if (!mp) break;
      // H9: Validate sequence number
      if (!checkSequence(player.id, message.seq)) break;
      // C3: Validate coordinates
      if (!isValidCoordinate(message.x, message.y)) {
        sendTo(player.ws, { type: 'error', code: 'INVALID_COORDS', message: 'Invalid coordinates' });
        break;
      }
      mp.x = message.x;
      mp.y = message.y;
      matchManager.broadcastToMatch(match.id, player.id, {
        type: 'other_player_update',
        playerId: player.id, displayName: player.displayName,
        x: message.x, y: message.y, action: 'walking', equipment: {},
      });
      break;
    }

    case 'dig': {
      const match = matchManager.getPlayerMatch(player.id);
      if (!match) break;
      const mp = match.players.get(player.id);
      if (!mp) break;
      // H9: Validate sequence number
      if (!checkSequence(player.id, message.seq)) break;
      // C3: Validate dig coordinates
      if (!isValidCoordinate(message.x, message.y)) {
        sendTo(player.ws, { type: 'error', code: 'INVALID_COORDS', message: 'Invalid dig coordinates' });
        break;
      }
      // H8: Use player's actual equipment tier for damage
      const shovelTier = (mp.equipment[EquipmentSlot.SHOVEL] || 1) as EquipmentTier;
      const damage = getShovelDamage(shovelTier);
      // H2: Check block type before damaging (for TNT check and loot rolling)
      const block = match.worldManager.getBlock(message.x, message.y);
      if (!block || block.type === BlockType.EMPTY) break;
      const blockType = block.type;
      const result = match.worldManager.damageBlock(message.x, message.y, damage);
      if (result.destroyed) {
        // H2: Server-side loot drop
        let drop: { itemId: string; itemType: ItemType; position: { x: number; y: number } } | null = null;
        if (blockType !== BlockType.TNT) {
          const droppedItemType = rollLootDrop(message.y, Math.random);
          if (droppedItemType) {
            const itemId = randomBytes(8).toString('hex');
            const dropItem: DropItem = {
              id: itemId,
              itemType: droppedItemType,
              position: { x: message.x, y: message.y },
              collectedBy: null,
              spawnedAt: Date.now(),
            };
            match.droppedItems.set(itemId, dropItem);
            drop = { itemId, itemType: droppedItemType, position: { x: message.x, y: message.y } };
          }
        }
        matchManager.broadcastToAllInMatch(match.id, {
          type: 'block_destroyed', x: message.x, y: message.y, actor: player.id, drop,
        });
      }
      matchManager.broadcastToMatch(match.id, player.id, {
        type: 'other_player_update',
        playerId: player.id, displayName: player.displayName,
        x: message.x, y: message.y, action: 'digging', equipment: mp.equipment,
      });
      break;
    }

    case 'auth': {
      if (typeof message.token !== 'string') break;
      const payload = validateToken(message.token);
      if (payload && payload.userId && !payload.isGuest) {
        player.displayName = payload.displayName;
        player.authenticated = true;
        sendTo(player.ws, { type: 'auth_result', success: true, userId: payload.userId, nickname: payload.displayName });
      } else {
        sendTo(player.ws, { type: 'auth_result', success: false, error: 'Invalid token' });
      }
      break;
    }

    case 'set_name': {
      // H1: Strict display name sanitization
      const sanitized = sanitizeDisplayName(message.name);
      if (sanitized) {
        player.displayName = sanitized;
      }
      break;
    }

    case 'chat': {
      // H3: Sanitize chat message (HTML escape + control char removal)
      const chatMsg = sanitizeChatMessage(message.message);
      if (!chatMsg) break;
      const chatMatch = matchManager.getPlayerMatch(player.id);
      if (!chatMatch) break;
      matchManager.broadcastToAllInMatch(chatMatch.id, {
        type: 'chat_message',
        playerId: player.id,
        displayName: player.displayName,
        message: chatMsg,
        timestamp: Date.now(),
      });
      break;
    }

    case 'sell': {
      // H5: Validate sell items array
      if (!isValidSellItems(message.items)) {
        sendTo(player.ws, { type: 'error', code: 'INVALID_INPUT', message: 'Invalid sell data' });
        break;
      }
      const sellMatch = matchManager.getPlayerMatch(player.id);
      if (!sellMatch) break;
      const sellMp = sellMatch.players.get(player.id);
      if (!sellMp) break;
      // H8: Process sell from server-side inventory
      const itemsSold: { itemType: ItemType; quantity: number; unitPrice: number; total: number }[] = [];
      let totalGoldEarned = 0;
      for (const sellItem of message.items) {
        const itemType = sellItem.itemType;
        const removeResult = removeItem(sellMp.inventory, itemType, sellItem.quantity);
        if (removeResult.removed > 0) {
          const unitPrice = getItemValue(itemType);
          const total = removeResult.removed * unitPrice;
          totalGoldEarned += total;
          itemsSold.push({ itemType, quantity: removeResult.removed, unitPrice, total });
        }
      }
      sellMp.gold += totalGoldEarned;
      matchManager.syncPlayerItems(sellMp);
      sendTo(player.ws, {
        type: 'sell_result',
        itemsSold,
        totalGoldEarned,
        newGoldBalance: sellMp.gold,
      });
      break;
    }

    case 'buy_equipment': {
      // H6: Validate equipment slot and tier
      if (!isValidEquipmentSlot(message.slot) || !isValidEquipmentTier(message.tier)) {
        sendTo(player.ws, { type: 'error', code: 'INVALID_INPUT', message: 'Invalid equipment data' });
        break;
      }
      const buyMatch = matchManager.getPlayerMatch(player.id);
      if (!buyMatch) break;
      const buyMp = buyMatch.players.get(player.id);
      if (!buyMp) break;
      // H8: Server-side equipment purchase
      const eqSlot = message.slot as EquipmentSlot;
      const currentTier = (buyMp.equipment[eqSlot] || 1) as EquipmentTier;
      const nextTier = getNextTier(currentTier);
      if (!nextTier) {
        sendTo(player.ws, { type: 'buy_result', success: false, slot: message.slot, goldSpent: 0, newGoldBalance: buyMp.gold, error: 'Already at max tier' });
        break;
      }
      const buyCheck = canBuyEquipment(eqSlot, currentTier, buyMp.gold);
      if (!buyCheck.canBuy) {
        sendTo(player.ws, { type: 'buy_result', success: false, slot: message.slot, goldSpent: 0, newGoldBalance: buyMp.gold, error: buyCheck.reason });
        break;
      }
      const eqPrice = getEquipmentPrice(eqSlot, nextTier);
      buyMp.gold -= eqPrice;
      buyMp.equipment[eqSlot] = nextTier;
      // H8: Expand inventory if vest upgrade adds bonus slots
      if (eqSlot === EquipmentSlot.VEST) {
        const oldBonus = getVestBonusSlots(currentTier);
        const newBonus = getVestBonusSlots(nextTier);
        for (let i = 0; i < newBonus - oldBonus; i++) {
          buyMp.inventory.push(null);
        }
      }
      sendTo(player.ws, { type: 'buy_result', success: true, slot: message.slot, newTier: nextTier, goldSpent: eqPrice, newGoldBalance: buyMp.gold });
      break;
    }

    case 'set_checkpoint': {
      if (!isValidInt(message.depth, 0, 10000)) {
        sendTo(player.ws, { type: 'error', code: 'INVALID_INPUT', message: 'Invalid depth' });
        break;
      }
      break;
    }

    case 'collect_item': {
      // H2: Server-side item collection validation
      const collectMatch = matchManager.getPlayerMatch(player.id);
      if (!collectMatch) break;
      const collectMp = collectMatch.players.get(player.id);
      if (!collectMp) break;
      if (typeof message.itemId !== 'string' || message.itemId.length > 32) {
        sendTo(player.ws, { type: 'collect_result', success: false, itemId: '', error: 'Invalid item ID' });
        break;
      }
      const drop = collectMatch.droppedItems.get(message.itemId);
      if (!drop) {
        sendTo(player.ws, { type: 'collect_result', success: false, itemId: message.itemId, error: 'Item not found' });
        break;
      }
      if (drop.collectedBy !== null) {
        sendTo(player.ws, { type: 'collect_result', success: false, itemId: message.itemId, error: 'Already collected' });
        break;
      }
      const collectResult = addItem(collectMp.inventory, drop.itemType, 1);
      if (!collectResult.success) {
        sendTo(player.ws, { type: 'inventory_full', itemType: drop.itemType });
        sendTo(player.ws, { type: 'collect_result', success: false, itemId: message.itemId, error: 'Inventory full' });
        break;
      }
      drop.collectedBy = player.id;
      matchManager.syncPlayerItems(collectMp);
      sendTo(player.ws, { type: 'collect_result', success: true, itemId: message.itemId, itemType: drop.itemType, quantity: 1 });
      break;
    }

    case 'buy_inventory_upgrade': {
      // H8: Server-side inventory upgrade
      const upgradeMatch = matchManager.getPlayerMatch(player.id);
      if (!upgradeMatch) break;
      const upgradeMp = upgradeMatch.players.get(player.id);
      if (!upgradeMp) break;
      const nextUpgradeLevel = upgradeMp.inventoryUpgradeLevel + 1;
      if (nextUpgradeLevel >= INVENTORY_UPGRADE_PRICES.length) {
        sendTo(player.ws, { type: 'error', code: 'MAX_UPGRADE', message: 'Max inventory level reached' });
        break;
      }
      const upgradePrice = INVENTORY_UPGRADE_PRICES[nextUpgradeLevel];
      if (upgradeMp.gold < upgradePrice) {
        sendTo(player.ws, { type: 'error', code: 'INSUFFICIENT_GOLD', message: `Need ${upgradePrice} gold` });
        break;
      }
      upgradeMp.gold -= upgradePrice;
      upgradeMp.inventoryUpgradeLevel = nextUpgradeLevel;
      const newSlotCount = INVENTORY_UPGRADE_SLOTS[nextUpgradeLevel];
      while (upgradeMp.inventory.length < newSlotCount) {
        upgradeMp.inventory.push(null);
      }
      matchManager.syncPlayerItems(upgradeMp);
      sendTo(player.ws, {
        type: 'player_state_update',
        playerId: player.id, x: upgradeMp.x, y: upgradeMp.y,
        gold: upgradeMp.gold, equipment: upgradeMp.equipment,
        inventory: upgradeMp.items, inventorySlots: upgradeMp.inventory.length,
        maxDepthReached: 0, isStunned: false, stunDurationMs: 0,
      });
      break;
    }

    case 'auth':
    case 'go_surface':
    case 'descend':
      break;

    default:
      sendTo(player.ws, { type: 'error', code: 'UNKNOWN_TYPE', message: 'Unknown message type' });
  }
}

function sendTo(ws: WebSocket, msg: object): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

// Broadcast player info every 2 seconds
setInterval(() => {
  for (const [matchId, match] of matchManager.getAllMatches()) {
    if (match.players.size === 0) continue;
    for (const [, mp] of match.players) {
      matchManager.broadcastToAllInMatch(matchId, {
        type: 'player_info_update',
        playerId: mp.id, displayName: mp.displayName,
        x: mp.x, y: mp.y, gold: mp.gold, items: mp.items,
      });
    }
  }
}, 2000);

// Idle connection cleanup every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [id, player] of players) {
    if (now - player.lastActivity > IDLE_TIMEOUT_MS) {
      player.ws.close(1000, 'Idle timeout');
      players.delete(id);
    }
  }
}, 60000);

// Stale match cleanup every 5 minutes (matches older than 2 hours with no players)
const STALE_MATCH_AGE_MS = 2 * 60 * 60 * 1000;
const DROP_ITEM_TTL_MS = 5 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [matchId, match] of matchManager.getAllMatches()) {
    if (match.players.size === 0 && now - match.createdAt > STALE_MATCH_AGE_MS) {
      match.worldManager.destroy();
      matchManager.getAllMatches().delete(matchId);
      continue;
    }
    // H2: Clean up old dropped items to prevent memory leaks
    if (match.droppedItems.size > 100) {
      const cutoff = now - DROP_ITEM_TTL_MS;
      for (const [id, drop] of match.droppedItems) {
        if (drop.spawnedAt < cutoff) {
          match.droppedItems.delete(id);
        }
      }
    }
  }
}, 5 * 60 * 1000);

// Graceful shutdown
process.on('SIGINT', () => {
  wss.clients.forEach((client) => client.close(1001, 'Server shutting down'));
  wss.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  wss.close(() => process.exit(0));
});
