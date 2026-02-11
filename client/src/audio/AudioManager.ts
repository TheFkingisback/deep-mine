import { Howl, Howler } from 'howler';
import { SFX } from './SFX';

/**
 * AudioManager manages all game audio including SFX and background music.
 * Uses Howler.js for music playback and Web Audio API for SFX.
 */
export class AudioManager {
  private static instance: AudioManager;

  private musicTracks: Map<string, Howl> = new Map();
  private currentMusic: Howl | null = null;
  private currentMusicName: string | null = null;

  private musicVolume = 0.5;
  private sfxVolume = 1.0;

  private constructor() {
    // Initialize SFX system
    SFX.init();
  }

  /**
   * Get the singleton instance of AudioManager.
   */
  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  /**
   * Load all audio assets.
   * For now, this creates placeholder silent tracks.
   * In the future, replace with actual music file paths.
   */
  async loadAll(): Promise<void> {
    console.log('🔊 Loading audio assets...');

    // Placeholder tracks (silent for now)
    // In production, replace these with actual music file paths
    const tracks = {
      surface: this.createPlaceholderTrack('surface'),
      dirt_layer: this.createPlaceholderTrack('dirt_layer'),
      deep_layer: this.createPlaceholderTrack('deep_layer'),
      void_layer: this.createPlaceholderTrack('void_layer')
    };

    // Store tracks
    Object.entries(tracks).forEach(([name, howl]) => {
      this.musicTracks.set(name, howl);
    });

    console.log('✅ Audio assets loaded');
  }

  /**
   * Create a placeholder silent track.
   * Replace this with actual file loading in production.
   */
  private createPlaceholderTrack(name: string): Howl {
    // Create a data URL for a silent audio file (1 second of silence)
    const silentDataUrl = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

    return new Howl({
      src: [silentDataUrl],
      loop: true,
      volume: this.musicVolume,
      onload: () => {
        console.log(`📻 Music track loaded: ${name}`);
      },
      onloaderror: (id: number, error: unknown) => {
        console.error(`Failed to load music track ${name}:`, error);
      }
    });
  }

  /**
   * Play a sound effect.
   * @param name - SFX name (see SFX.ts for available sounds)
   * @param volumeOverride - Optional volume override (0.0 - 1.0)
   */
  playSFX(name: string, volumeOverride?: number): void {
    const volume = volumeOverride !== undefined ? volumeOverride : this.sfxVolume;
    SFX.play(name, volume);
  }

  /**
   * Play background music, crossfading from current track.
   * @param trackName - Name of the music track
   * @param fadeDuration - Crossfade duration in milliseconds (default 1000ms)
   */
  playMusic(trackName: string, fadeDuration: number = 1000): void {
    // Don't restart if already playing
    if (this.currentMusicName === trackName && this.currentMusic?.playing()) {
      return;
    }

    const newTrack = this.musicTracks.get(trackName);
    if (!newTrack) {
      console.warn(`Music track not found: ${trackName}`);
      return;
    }

    // Fade out current music
    if (this.currentMusic && this.currentMusic.playing()) {
      this.currentMusic.fade(this.musicVolume, 0, fadeDuration);
      setTimeout(() => {
        this.currentMusic?.stop();
      }, fadeDuration);
    }

    // Fade in new music
    newTrack.volume(0);
    newTrack.play();
    newTrack.fade(0, this.musicVolume, fadeDuration);

    this.currentMusic = newTrack;
    this.currentMusicName = trackName;
  }

  /**
   * Stop all music.
   */
  stopMusic(): void {
    if (this.currentMusic) {
      this.currentMusic.stop();
      this.currentMusic = null;
      this.currentMusicName = null;
    }
  }

  /**
   * Set music volume (0.0 - 1.0).
   */
  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));

    // Update current track volume
    if (this.currentMusic) {
      this.currentMusic.volume(this.musicVolume);
    }

    // Update all tracks default volume
    this.musicTracks.forEach(track => {
      if (track !== this.currentMusic) {
        track.volume(this.musicVolume);
      }
    });
  }

  /**
   * Set SFX volume (0.0 - 1.0).
   */
  setSFXVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
  }

  /**
   * Get current music volume.
   */
  getMusicVolume(): number {
    return this.musicVolume;
  }

  /**
   * Get current SFX volume.
   */
  getSFXVolume(): number {
    return this.sfxVolume;
  }

  /**
   * Stop all audio (music and SFX).
   */
  stopAll(): void {
    this.stopMusic();
    // Note: Can't stop individual SFX since they're one-shot Web Audio nodes
  }

  /**
   * Pause all audio.
   */
  pause(): void {
    if (this.currentMusic) {
      this.currentMusic.pause();
    }
  }

  /**
   * Resume all audio.
   */
  resume(): void {
    if (this.currentMusic) {
      this.currentMusic.play();
    }
  }

  /**
   * Mute all audio.
   */
  mute(): void {
    Howler.mute(true);
  }

  /**
   * Unmute all audio.
   */
  unmute(): void {
    Howler.mute(false);
  }
}

// Export singleton instance
export const audioManager = AudioManager.getInstance();
