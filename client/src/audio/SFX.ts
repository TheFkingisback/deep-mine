/**
 * Sound effect definitions for Deep Mine.
 * These use the Web Audio API to generate synthetic sounds.
 */

/**
 * Generate a simple sound effect using Web Audio API.
 */
function generateSound(
  audioContext: AudioContext,
  frequency: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume: number = 0.3,
  fadeOut: boolean = true
): AudioBuffer {
  const sampleRate = audioContext.sampleRate;
  const length = sampleRate * duration;
  const buffer = audioContext.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  // Generate waveform
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    let sample = 0;

    switch (type) {
      case 'sine':
        sample = Math.sin(2 * Math.PI * frequency * t);
        break;
      case 'square':
        sample = Math.sin(2 * Math.PI * frequency * t) > 0 ? 1 : -1;
        break;
      case 'sawtooth':
        sample = 2 * ((frequency * t) % 1) - 1;
        break;
      case 'triangle':
        sample = 2 * Math.abs(2 * ((frequency * t) % 1) - 1) - 1;
        break;
    }

    // Apply envelope (fade out)
    let envelope = 1;
    if (fadeOut) {
      envelope = 1 - (i / length);
    }

    data[i] = sample * volume * envelope;
  }

  return buffer;
}

/**
 * Generate noise (for percussion/texture).
 */
function generateNoise(
  audioContext: AudioContext,
  duration: number,
  volume: number = 0.2
): AudioBuffer {
  const sampleRate = audioContext.sampleRate;
  const length = sampleRate * duration;
  const buffer = audioContext.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < length; i++) {
    const envelope = 1 - (i / length);
    data[i] = (Math.random() * 2 - 1) * volume * envelope;
  }

  return buffer;
}

/**
 * SFX library with all game sounds.
 */
export class SFX {
  private static audioContext: AudioContext;
  private static buffers: Map<string, AudioBuffer> = new Map();

  /**
   * Initialize the audio context and generate all sounds.
   */
  static init(): void {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    // Digging sounds
    this.buffers.set('dig_dirt', generateSound(this.audioContext, 200, 0.1, 'sine', 0.2));
    this.buffers.set('dig_rock', generateSound(this.audioContext, 400, 0.08, 'square', 0.25));
    this.buffers.set('dig_obsidian', generateSound(this.audioContext, 800, 0.12, 'triangle', 0.3));

    // Block break (noise + tone)
    this.buffers.set('block_break', generateNoise(this.audioContext, 0.15, 0.3));

    // Item sounds
    this.buffers.set('item_drop', generateSound(this.audioContext, 1200, 0.1, 'sine', 0.3));
    this.buffers.set('item_collect', generateSound(this.audioContext, 800, 0.15, 'sine', 0.25, false));

    // Rare find (ascending notes)
    this.buffers.set('rare_find', this.generateRareFindSound());

    // TNT
    this.buffers.set('tnt_fuse', generateNoise(this.audioContext, 0.3, 0.15));
    this.buffers.set('tnt_explode', this.generateExplosionSound());

    // Economy
    this.buffers.set('sell_coin', generateSound(this.audioContext, 1500, 0.2, 'sine', 0.35));
    this.buffers.set('buy_equip', this.generatePowerUpSound());

    // Events
    this.buffers.set('cave_in', generateNoise(this.audioContext, 0.5, 0.4));
    this.buffers.set('gas_pocket', generateNoise(this.audioContext, 0.3, 0.2));

    // UI
    this.buffers.set('surface_arrive', generateSound(this.audioContext, 800, 0.3, 'sine', 0.2));
    this.buffers.set('button_click', generateSound(this.audioContext, 600, 0.05, 'sine', 0.2));
    this.buffers.set('error', generateSound(this.audioContext, 150, 0.2, 'square', 0.25));
  }

  /**
   * Play a sound effect by name.
   */
  static play(name: string, volume: number = 1.0): void {
    const buffer = this.buffers.get(name);
    if (!buffer) {
      console.warn(`Sound effect not found: ${name}`);
      return;
    }

    const source = this.audioContext.createBufferSource();
    const gainNode = this.audioContext.createGain();

    source.buffer = buffer;
    gainNode.gain.value = volume;

    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    source.start();
  }

  /**
   * Generate ascending notes for rare find sound.
   */
  private static generateRareFindSound(): AudioBuffer {
    const duration = 0.6;
    const sampleRate = this.audioContext.sampleRate;
    const length = sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    // Three ascending notes
    const notes = [800, 1000, 1200];
    const noteDuration = duration / 3;

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const noteIndex = Math.floor(t / noteDuration);
      const freq = notes[Math.min(noteIndex, notes.length - 1)];

      const envelope = 1 - ((i % (sampleRate * noteDuration)) / (sampleRate * noteDuration));
      data[i] = Math.sin(2 * Math.PI * freq * t) * 0.3 * envelope;
    }

    return buffer;
  }

  /**
   * Generate explosion sound (low boom + noise).
   */
  private static generateExplosionSound(): AudioBuffer {
    const duration = 0.8;
    const sampleRate = this.audioContext.sampleRate;
    const length = sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const envelope = 1 - (i / length);

      // Low boom (descending frequency)
      const freq = 100 - (t * 80);
      const boom = Math.sin(2 * Math.PI * freq * t);

      // Noise texture
      const noise = (Math.random() * 2 - 1) * 0.5;

      data[i] = (boom * 0.6 + noise * 0.4) * envelope * 0.5;
    }

    return buffer;
  }

  /**
   * Generate power-up sound (rising tone + shimmer).
   */
  private static generatePowerUpSound(): AudioBuffer {
    const duration = 0.5;
    const sampleRate = this.audioContext.sampleRate;
    const length = sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const progress = t / duration;

      // Rising frequency
      const freq = 400 + (progress * 800);
      const tone = Math.sin(2 * Math.PI * freq * t);

      // Shimmer (high frequency modulation)
      const shimmer = Math.sin(2 * Math.PI * 10 * t) * 0.3;

      const envelope = 1 - progress;
      data[i] = (tone + shimmer) * envelope * 0.3;
    }

    return buffer;
  }
}
