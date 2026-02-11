import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { ClientMessage, ConnectedPlayer } from './types.js';
import { MatchManager } from './MatchManager.js';
import { getShovelDamage } from '@shared/equipment';

const PORT = Number(process.env.PORT) || 9001;

const wss = new WebSocketServer({ port: PORT });
const players = new Map<string, ConnectedPlayer>();
const matchManager = new MatchManager();

console.log(`[Deep Mine Server] Starting on port ${PORT}...`);

wss.on('listening', () => {
  console.log(`[Deep Mine Server] WebSocket server listening on ws://localhost:${PORT}`);
});

wss.on('connection', (ws: WebSocket) => {
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
  console.log(`[Connect] ${displayName} connected (${players.size} total)`);

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString()) as ClientMessage;
      player.lastActivity = Date.now();
      handleMessage(player, message);
    } catch (err) {
      console.error(`[Error] Invalid message from ${playerId}:`, err);
      sendTo(ws, { type: 'error', code: 'INVALID_MESSAGE', message: 'Could not parse message' });
    }
  });

  ws.on('close', () => {
    console.log(`[Disconnect] ${displayName} disconnected (${players.size - 1} remaining)`);
    const result = matchManager.leaveMatch(playerId);
    if (result) {
      matchManager.broadcastToAllInMatch(result.match.id, {
        type: 'other_player_left',
        playerId,
      });
    }
    players.delete(playerId);
  });

  ws.on('error', (err) => {
    console.error(`[Error] Player ${playerId}:`, err.message);
  });
});

function handleMessage(player: ConnectedPlayer, message: ClientMessage): void {
  switch (message.type) {
    case 'list_matches': {
      sendTo(player.ws, { type: 'match_list', matches: matchManager.listMatches() });
      break;
    }

    case 'create_match': {
      const match = matchManager.createMatch(message.matchName);
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
      const match = matchManager.createMatch(`Party_${player.displayName}`, message.maxPlayers ?? 8);
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
      const damage = getShovelDamage(1);
      const result = match.worldManager.damageBlock(message.x, message.y, damage);
      if (result.destroyed) {
        matchManager.broadcastToAllInMatch(match.id, {
          type: 'block_destroyed', x: message.x, y: message.y, actor: player.id, drop: null,
        });
      }
      matchManager.broadcastToMatch(match.id, player.id, {
        type: 'other_player_update',
        playerId: player.id, displayName: player.displayName,
        x: message.x, y: message.y, action: 'digging', equipment: {},
      });
      break;
    }

    case 'set_name': {
      const raw = ((message as unknown as { name: string }).name ?? '').trim();
      player.displayName = raw.slice(0, 16) || player.displayName;
      console.log(`[Name] ${player.id} → ${player.displayName}`);
      break;
    }

    case 'auth':
    case 'collect_item':
    case 'go_surface':
    case 'sell':
    case 'buy_equipment':
    case 'buy_inventory_upgrade':
    case 'set_checkpoint':
    case 'descend':
    case 'chat':
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

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Shutdown] Closing server...');
  wss.clients.forEach((client) => client.close(1001, 'Server shutting down'));
  wss.close(() => { console.log('[Shutdown] Server closed.'); process.exit(0); });
});

process.on('SIGTERM', () => {
  console.log('\n[Shutdown] SIGTERM received, closing...');
  wss.close(() => process.exit(0));
});
