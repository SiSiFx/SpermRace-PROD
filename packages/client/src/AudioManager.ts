/**
 * Enhanced Audio Manager - Handles all game sounds with dynamic audio feedback
 * Lazy loading for performance with enhanced gameplay integration
 */

export interface AudioConfig {
  enabled?: boolean;
  volume?: number;
  musicVolume?: number;
  sfxVolume?: number;
}

export interface AudioEvent {
  type: 'boost' | 'kill' | 'death' | 'collision' | 'pickup' | 'streak' | 'button' | 'achievement' | 'nearMiss' | 'trailCollision' | 'zoneShrink' | 'playerJoin' | 'tournamentStart';
  volume?: number;
  pitch?: number;
  position?: { x: number; y: number };
  intensity?: number;
}

export class AudioManager {
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private enabled: boolean = true;
  private volume: number = 0.7;
  private musicVolume: number = 0.4;
  private sfxVolume: number = 0.8;
  private audioContext: AudioContext | null = null;
  private positionalAudio: boolean = true;
  private lastSoundTimes: Map<string, number> = new Map();

  constructor(config: AudioConfig = {}) {
    // Check user preference
    const savedEnabled = localStorage.getItem('audio_enabled');
    this.enabled = config.enabled ?? (savedEnabled !== 'false');
    
    const savedVolume = localStorage.getItem('audio_volume');
    this.volume = config.volume ?? (savedVolume ? parseFloat(savedVolume) : 0.7);
    
    const savedSfxVolume = localStorage.getItem('audio_sfx_volume');
    this.sfxVolume = config.sfxVolume ?? (savedSfxVolume ? parseFloat(savedSfxVolume) : 0.8);
    
    const savedMusicVolume = localStorage.getItem('audio_music_volume');
    this.musicVolume = config.musicVolume ?? (savedMusicVolume ? parseFloat(savedMusicVolume) : 0.4);

    // Initialize Web Audio API for advanced features
    this.initWebAudioAPI();
  }

  private initWebAudioAPI() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (err) {
      console.warn('[AudioManager] Web Audio API not supported:', err);
      this.audioContext = null;
    }
  }

  /**
   * Preload a sound file
   */
  load(name: string, path: string) {
    if (this.sounds.has(name)) return;
    
    const audio = new Audio(path);
    audio.preload = 'auto';
    audio.volume = this.volume;
    this.sounds.set(name, audio);
  }

  /**
   * Play a sound effect with enhanced options
   */
  play(name: string, volumeMultiplier: number = 1.0, pitch?: number) {
    if (!this.enabled) return;
    
    const sound = this.sounds.get(name);
    if (!sound) {
      console.warn(`[AudioManager] Sound not loaded: ${name}`);
      return;
    }

    // Rate limiting for frequent sounds
    const now = Date.now();
    const lastPlay = this.lastSoundTimes.get(name) || 0;
    if (now - lastPlay < 50) return; // Max 20 sounds per second per type
    this.lastSoundTimes.set(name, now);

    try {
      // Clone for overlapping sounds
      const clone = sound.cloneNode() as HTMLAudioElement;
      clone.volume = this.volume * this.sfxVolume * volumeMultiplier;
      
      // Apply pitch variation if supported
      if (pitch && this.audioContext) {
        try {
          clone.preservesPitch = true;
          // Note: HTMLAudio pitch changing is limited, but we can simulate with playbackRate
          if (pitch !== 1) {
            clone.playbackRate = Math.max(0.5, Math.min(2.0, pitch));
          }
        } catch (err) {
          // Ignore pitch errors
        }
      }
      
      clone.play().catch(err => {
        // Ignore autoplay errors
        if (err.name !== 'NotAllowedError') {
          console.warn(`[AudioManager] Play error:`, err);
        }
      });

      // Cleanup after play
      clone.addEventListener('ended', () => {
        clone.remove();
      });
    } catch (err) {
      console.warn(`[AudioManager] Error playing ${name}:`, err);
    }
  }

  /**
   * Enhanced sound play with full audio event support
   */
  playEvent(event: AudioEvent) {
    const { type, volume = 1.0, pitch } = event;
    
    // Add intensity-based volume scaling
    let finalVolume = volume;
    if (event.intensity !== undefined) {
      finalVolume *= Math.min(2.0, 0.5 + event.intensity * 1.5);
    }
    
    this.play(type, finalVolume, pitch);
  }

  /**
   * Dynamic sound variation for enhanced gameplay
   */
  playDynamic(type: 'boost' | 'collision' | 'kill' | 'trailCollision', intensity: number = 1.0, position?: { x: number; y: number }) {
    if (!this.enabled) return;
    
    // Pitch variation based on intensity
    const pitchVariation = 0.9 + (Math.random() - 0.5) * 0.2;
    const dynamicPitch = intensity > 1.5 ? pitchVariation * 1.1 : pitchVariation;
    
    // Volume scaling based on intensity and distance
    let volume = Math.min(1.5, 0.7 + intensity * 0.3);
    
    // Positional audio effects
    if (position && this.positionalAudio) {
      // Simulate distance-based volume attenuation
      const distance = Math.sqrt(position.x * position.x + position.y * position.y);
      const maxDistance = 800;
      const attenuation = Math.max(0.1, 1 - (distance / maxDistance));
      volume *= attenuation;
    }
    
    this.play(type, volume, dynamicPitch);
  }

  /**
   * Play background music (loops)
   */
  playMusic(name: string) {
    if (!this.enabled) return;
    
    const music = this.sounds.get(name);
    if (!music) return;

    music.volume = this.musicVolume;
    music.loop = true;
    music.play().catch(() => {});
  }

  /**
   * Stop background music
   */
  stopMusic(name: string) {
    const music = this.sounds.get(name);
    if (music) {
      music.pause();
      music.currentTime = 0;
    }
  }

  /**
   * Set master volume
   */
  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    localStorage.setItem('audio_volume', this.volume.toString());
  }

  /**
   * Set SFX volume specifically
   */
  setSfxVolume(volume: number) {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    localStorage.setItem('audio_sfx_volume', this.sfxVolume.toString());
  }

  /**
   * Set music volume specifically
   */
  setMusicVolume(volume: number) {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    localStorage.setItem('audio_music_volume', this.musicVolume.toString());
  }

  /**
   * Toggle audio on/off
   */
  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('audio_enabled', this.enabled.toString());
    
    if (!this.enabled) {
      // Stop all playing sounds
      this.sounds.forEach(sound => {
        sound.pause();
        sound.currentTime = 0;
      });
    }
  }

  /**
   * Check if audio is enabled
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Preload common game sounds
   */
  preloadGameSounds() {
    // For now, we'll use placeholder sounds or royalty-free ones
    // Users can replace these with better sounds later
    
    // Using data URIs for basic sounds (silent placeholders for now)
    // In production, load from /sounds/ directory
    
    const soundPaths = {
      boost: '/sounds/boost.mp3',
      kill: '/sounds/kill.mp3',
      death: '/sounds/death.mp3',
      collision: '/sounds/collision.mp3',
      pickup: '/sounds/pickup.mp3',
      streak: '/sounds/streak.mp3',
      button: '/sounds/button.mp3',
      achievement: '/sounds/achievement.mp3',
    };

    // Load with fallback to silent
    Object.entries(soundPaths).forEach(([name, path]) => {
      try {
        this.load(name, path);
      } catch (err) {
        console.warn(`[AudioManager] Failed to load ${name}:`, err);
      }
    });
  }
}

export default AudioManager;
