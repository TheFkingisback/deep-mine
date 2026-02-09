import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { BLOCK_SIZE } from '@shared/constants';

interface OtherPlayerData {
  playerId: string;
  displayName: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  action: 'idle' | 'digging' | 'walking' | 'stunned';
  equipment: Record<string, number>;
  container: Container;
  body: Graphics;
  nametag: Text;
  lastUpdate: number;
}

/**
 * Renders other players in the game world with position interpolation,
 * equipment visuals, nametags, and dig animations.
 */
export class OtherPlayerRenderer {
  private worldContainer: Container;
  private players = new Map<string, OtherPlayerData>();
  private lerpSpeed = 0.15;

  constructor(worldContainer: Container) {
    this.worldContainer = worldContainer;
  }

  addPlayer(playerId: string, displayName: string, x: number, y: number): void {
    if (this.players.has(playerId)) return;

    const container = new Container();
    container.x = x * BLOCK_SIZE;
    container.y = y * BLOCK_SIZE;

    // Draw player body
    const body = new Graphics();
    this.drawPlayerBody(body);
    container.addChild(body);

    // Nametag
    const nameStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 10,
      fill: '#FFFFFF',
      dropShadow: { color: '#000000', blur: 2, angle: Math.PI / 4, distance: 1 },
    });
    const nametag = new Text({ text: displayName, style: nameStyle });
    nametag.anchor.set(0.5, 1);
    nametag.x = BLOCK_SIZE / 2;
    nametag.y = -4;
    container.addChild(nametag);

    this.worldContainer.addChild(container);

    this.players.set(playerId, {
      playerId,
      displayName,
      x: x * BLOCK_SIZE,
      y: y * BLOCK_SIZE,
      targetX: x * BLOCK_SIZE,
      targetY: y * BLOCK_SIZE,
      action: 'idle',
      equipment: {},
      container,
      body,
      nametag,
      lastUpdate: Date.now(),
    });
  }

  removePlayer(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player) return;

    this.worldContainer.removeChild(player.container);
    player.container.destroy({ children: true });
    this.players.delete(playerId);
  }

  updatePlayer(
    playerId: string,
    x: number,
    y: number,
    action: 'idle' | 'digging' | 'walking' | 'stunned',
    equipment: Record<string, number>
  ): void {
    const player = this.players.get(playerId);
    if (!player) return;

    player.targetX = x * BLOCK_SIZE;
    player.targetY = y * BLOCK_SIZE;
    player.action = action;
    player.equipment = equipment;
    player.lastUpdate = Date.now();
  }

  update(deltaMs: number): void {
    const now = Date.now();

    for (const [playerId, player] of this.players) {
      // Remove stale players (no update for 10s)
      if (now - player.lastUpdate > 10000) {
        this.removePlayer(playerId);
        continue;
      }

      // Interpolate position
      player.x += (player.targetX - player.x) * this.lerpSpeed;
      player.y += (player.targetY - player.y) * this.lerpSpeed;

      player.container.x = player.x;
      player.container.y = player.y;

      // Action-based visual feedback
      this.updateActionVisuals(player, deltaMs);
    }
  }

  private updateActionVisuals(player: OtherPlayerData, _deltaMs: number): void {
    switch (player.action) {
      case 'digging':
        // Slight shake when digging
        player.container.x += Math.sin(Date.now() * 0.02) * 1.5;
        break;
      case 'stunned':
        // Wobble when stunned
        player.container.rotation = Math.sin(Date.now() * 0.01) * 0.1;
        break;
      default:
        player.container.rotation = 0;
        break;
    }
  }

  private drawPlayerBody(g: Graphics): void {
    // Simple miner body representation
    const w = BLOCK_SIZE - 4;
    const h = BLOCK_SIZE - 2;
    const offsetX = 2;
    const offsetY = 2;

    // Body
    g.rect(offsetX + w * 0.2, offsetY + h * 0.3, w * 0.6, h * 0.5);
    g.fill({ color: 0x2288DD });

    // Head
    g.circle(offsetX + w * 0.5, offsetY + h * 0.2, w * 0.2);
    g.fill({ color: 0xFFCC88 });

    // Helmet
    g.rect(offsetX + w * 0.25, offsetY + h * 0.05, w * 0.5, h * 0.15);
    g.fill({ color: 0xFFDD44 });

    // Legs
    g.rect(offsetX + w * 0.25, offsetY + h * 0.8, w * 0.2, h * 0.18);
    g.fill({ color: 0x443322 });
    g.rect(offsetX + w * 0.55, offsetY + h * 0.8, w * 0.2, h * 0.18);
    g.fill({ color: 0x443322 });
  }

  hasPlayer(playerId: string): boolean {
    return this.players.has(playerId);
  }

  getPlayerCount(): number {
    return this.players.size;
  }

  destroy(): void {
    for (const [id] of this.players) {
      this.removePlayer(id);
    }
    this.players.clear();
  }
}
