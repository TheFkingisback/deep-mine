import type { PlayerState } from '@shared/types';

const SAVE_KEY = 'deepmine_save';
const SAVE_VERSION = 1;
const SAVE_EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 hours

export interface GameSaveData {
  version: number;
  timestamp: number;
  playerState: PlayerState;
  matchSeed: number;
  matchId: string;
  currentScene: 'mining' | 'surface';
  isOffline: boolean;
}

export class GameSaveManager {
  private saveIntervalId: ReturnType<typeof setInterval> | null = null;
  private unloadHandler: (() => void) | null = null;

  save(data: Omit<GameSaveData, 'version' | 'timestamp'>): void {
    const saveData: GameSaveData = {
      ...data,
      version: SAVE_VERSION,
      timestamp: Date.now(),
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
    } catch {
      // localStorage not available or full
    }
  }

  load(): GameSaveData | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;

      const data = JSON.parse(raw) as GameSaveData;

      if (data.version !== SAVE_VERSION) { this.clear(); return null; }
      if (Date.now() - data.timestamp > SAVE_EXPIRY_MS) { this.clear(); return null; }
      if (!data.playerState || !data.playerState.id) { this.clear(); return null; }

      return data;
    } catch {
      this.clear();
      return null;
    }
  }

  clear(): void {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* noop */ }
  }

  startAutoSave(getState: () => Omit<GameSaveData, 'version' | 'timestamp'>, intervalMs = 30000): void {
    this.stopAutoSave();

    this.saveIntervalId = setInterval(() => {
      this.save(getState());
    }, intervalMs);

    this.unloadHandler = () => { this.save(getState()); };
    window.addEventListener('beforeunload', this.unloadHandler);
  }

  stopAutoSave(): void {
    if (this.saveIntervalId !== null) {
      clearInterval(this.saveIntervalId);
      this.saveIntervalId = null;
    }
    if (this.unloadHandler) {
      window.removeEventListener('beforeunload', this.unloadHandler);
      this.unloadHandler = null;
    }
  }
}
