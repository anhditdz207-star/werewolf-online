const BGM_TRACKS = {
  lobby: '/audio/BGM_Lobby.mp3',
  night: '/audio/BGM_Night.mp3',
  day: '/audio/BGM_Day.mp3',
  voting: '/audio/BGM_Voting.mp3',
  result: '/audio/BGM_Result.mp3',
  villagersWin: '/audio/BGM_VillagersWin.mp3',
  werewolvesWin: '/audio/BGM_WerewolvesWin.mp3',
} as const;

export type BgmKey = keyof typeof BGM_TRACKS;

const SFX_TRACKS = {
  click: '/audio/UI_Click.wav',
  error: '/audio/Error.wav',
  success: '/audio/Success.wav',
  failure: '/audio/Failure.wav',
  notification: '/audio/Notification.wav',
  bell: '/audio/Bell.wav',
  wolfHowl: '/audio/Wolf_Howl.wav',
  whoosh: '/audio/Whoosh.wav',
  countdown: '/audio/Countdown.wav',
  drumHit: '/audio/Drum_Hit.mp3',
  crow: '/audio/crow.mp3',
} as const;

export type SfxKey = keyof typeof SFX_TRACKS;

const MUTE_STORAGE_KEY = 'masoi_audio_muted';
const BGM_VOL_KEY = 'masoi_bgm_volume';
const SFX_VOL_KEY = 'masoi_sfx_volume';
const VIBRATION_KEY = 'masoi_vibration';
const FADE_MS = 500;
const FADE_STEP_MS = 40;
const DEFAULT_BGM_VOLUME = 0.35;
const DEFAULT_SFX_VOLUME = 0.6;

function readStoredVolume(key: string, fallback: number): number {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : fallback;
}

class AudioManager {
  private bgmEl: HTMLAudioElement | null = null;
  private currentBgm: BgmKey | null = null;
  private muted: boolean;
  private bgmVolume: number;
  private sfxVolume: number;
  private vibrationEnabled: boolean;
  private fadeTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.muted = localStorage.getItem(MUTE_STORAGE_KEY) === '1';
    this.bgmVolume = readStoredVolume(BGM_VOL_KEY, DEFAULT_BGM_VOLUME);
    this.sfxVolume = readStoredVolume(SFX_VOL_KEY, DEFAULT_SFX_VOLUME);
    this.vibrationEnabled = localStorage.getItem(VIBRATION_KEY) !== '0';
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    localStorage.setItem(MUTE_STORAGE_KEY, muted ? '1' : '0');
    if (this.bgmEl) this.bgmEl.muted = muted;
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  getBgmVolume(): number {
    return this.bgmVolume;
  }

  setBgmVolume(volume: number): void {
    this.bgmVolume = Math.min(1, Math.max(0, volume));
    localStorage.setItem(BGM_VOL_KEY, String(this.bgmVolume));
    if (this.bgmEl) this.bgmEl.volume = this.bgmVolume;
  }

  getSfxVolume(): number {
    return this.sfxVolume;
  }

  setSfxVolume(volume: number): void {
    this.sfxVolume = Math.min(1, Math.max(0, volume));
    localStorage.setItem(SFX_VOL_KEY, String(this.sfxVolume));
  }

  isVibrationEnabled(): boolean {
    return this.vibrationEnabled;
  }

  setVibrationEnabled(enabled: boolean): void {
    this.vibrationEnabled = enabled;
    localStorage.setItem(VIBRATION_KEY, enabled ? '1' : '0');
  }

  vibrate(pattern: number | number[] = 15): void {
    if (this.vibrationEnabled && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  }

  playBgm(key: BgmKey): void {
    if (this.currentBgm === key) return;
    this.currentBgm = key;

    const nextEl = new Audio(BGM_TRACKS[key]);
    nextEl.loop = true;
    nextEl.muted = this.muted;
    nextEl.volume = 0;
    nextEl.play().catch(() => {
      /* Autoplay can be blocked until the user interacts once — ignored. */
    });

    const prevEl = this.bgmEl;
    this.bgmEl = nextEl;

    if (this.fadeTimer) clearInterval(this.fadeTimer);
    const steps = FADE_MS / FADE_STEP_MS;
    let i = 0;
    this.fadeTimer = setInterval(() => {
      i += 1;
      const t = Math.min(1, i / steps);
      nextEl.volume = this.bgmVolume * t;
      if (prevEl) prevEl.volume = this.bgmVolume * (1 - t);
      if (t >= 1) {
        if (this.fadeTimer) clearInterval(this.fadeTimer);
        if (prevEl) {
          prevEl.pause();
          prevEl.src = '';
        }
      }
    }, FADE_STEP_MS);
  }

  stopBgm(): void {
    if (this.fadeTimer) clearInterval(this.fadeTimer);
    if (this.bgmEl) {
      this.bgmEl.pause();
      this.bgmEl.src = '';
      this.bgmEl = null;
    }
    this.currentBgm = null;
  }

  playSfx(key: SfxKey): void {
    if (this.muted) return;
    const el = new Audio(SFX_TRACKS[key]);
    el.volume = this.sfxVolume;
    el.play().catch(() => {});
  }
}

export const audioManager = new AudioManager();
