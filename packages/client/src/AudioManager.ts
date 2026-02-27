/**
 * Audio Manager - Handles all game sounds
 * Lazy loading for performance
 */

export class AudioManager {
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private enabled: boolean = true;
  private volume: number = 0.7;
  private musicVolume: number = 0.4;

  constructor() {
    // Check user preference
    const savedEnabled = localStorage.getItem('audio_enabled');
    this.enabled = savedEnabled !== 'false';
    
    const savedVolume = localStorage.getItem('audio_volume');
    if (savedVolume) this.volume = parseFloat(savedVolume);
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
   * Play a sound effect
   */
  play(name: string, volumeMultiplier: number = 1.0) {
    if (!this.enabled) return;
    
    const sound = this.sounds.get(name);
    if (!sound) {
      console.warn(`[AudioManager] Sound not loaded: ${name}`);
      return;
    }

    try {
      // Clone for overlapping sounds
      const clone = sound.cloneNode() as HTMLAudioElement;
      clone.volume = this.volume * volumeMultiplier;
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
    
    // Update all loaded sounds
    this.sounds.forEach(sound => {
      sound.volume = this.volume;
    });
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
