import { common } from '@kit.AbilityKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { PreferencesManager, MetronomeSettings } from '../data/PreferencesManager';
import { AudioOutputService } from '../audio/AudioOutputService';
import { BackgroundPlayService } from '../service/BackgroundPlayService';
import { EngineParams, BeatEventInfo } from '../audio/MetronomeEngine';

const TAG: string = '[MetronomeViewModel]';
const DOMAIN: number = 0x0000;

const VALID_DENOMINATORS: number[] = [1, 2, 4, 8, 16];

export type StateChangeCallback = () => void;

/**
 * State management hub for the metronome UI. Holds all observable state,
 * synchronises engine parameters and preferences on every change, and
 * manages the play / stop lifecycle via AudioOutputService and
 * BackgroundPlayService.
 *
 * The page creates an instance, registers a StateChangeCallback, and
 * copies ViewModel properties into @State variables inside that callback.
 */
export class MetronomeViewModel {
  // ── Observable state (read by the page via the change callback) ─────
  bpm: number = 120;
  meterNumerator: number = 4;
  meterDenominator: number = 4;
  accentBitmask: number = 0x1;
  language: string = 'en';
  firstBeatOnly: boolean = true;
  voiceOffsetMs: number = 0;
  isPlaying: boolean = false;
  currentBeatIndex: number = -1;

  // ── Internal services ───────────────────────────────────────────────
  private prefsManager: PreferencesManager = new PreferencesManager();
  private audioService: AudioOutputService = new AudioOutputService();
  private bgService: BackgroundPlayService = new BackgroundPlayService();
  private context: common.UIAbilityContext | null = null;
  private initialized: boolean = false;
  private onStateChange: StateChangeCallback | null = null;

  setOnStateChange(callback: StateChangeCallback): void {
    this.onStateChange = callback;
  }

  // ── Lifecycle ───────────────────────────────────────────────────────

  async init(contextArg: common.UIAbilityContext): Promise<void> {
    if (this.initialized) {
      hilog.warn(DOMAIN, TAG, 'Already initialized, skipping');
      return;
    }
    this.context = contextArg;

    try {
      await this.prefsManager.init(contextArg);
      const settings: MetronomeSettings = await this.prefsManager.load();
      this.applySettings(settings);
      hilog.info(DOMAIN, TAG,
        `Preferences loaded: bpm=${this.bpm}, meter=${this.meterNumerator}/${this.meterDenominator}, ` +
        `lang=${this.language}, firstBeatOnly=${this.firstBeatOnly}, offset=${this.voiceOffsetMs}`);
    } catch (e) {
      hilog.error(DOMAIN, TAG,
        `Failed to load preferences, using defaults: ${e instanceof Error ? e.message : String(e)}`);
      this.applySettings(this.prefsManager.getDefaults());
    }

    try {
      await this.audioService.init(contextArg);
      const engine = this.audioService.getEngine();
      if (engine !== null) {
        engine.updateParams(this.buildEngineParams());
        engine.onBeat((info: BeatEventInfo) => {
          this.currentBeatIndex = info.beatIndex;
          this.notifyStateChange();
        });
      }
      hilog.info(DOMAIN, TAG, 'Audio service initialized');
    } catch (e) {
      hilog.error(DOMAIN, TAG,
        `Audio service init failed — playback will not work: ${e instanceof Error ? e.message : String(e)}`);
    }

    this.initialized = true;
    this.notifyStateChange();
  }

  async destroy(): Promise<void> {
    if (this.isPlaying) {
      await this.stopPlay();
    }
    try {
      await this.audioService.release();
    } catch (e) {
      hilog.error(DOMAIN, TAG, `Audio release failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    this.initialized = false;
    this.context = null;
    hilog.info(DOMAIN, TAG, 'Destroyed');
  }

  // ── Playback control ────────────────────────────────────────────────

  async togglePlay(): Promise<void> {
    try {
      if (this.isPlaying) {
        await this.stopPlay();
      } else {
        await this.startPlay();
      }
    } catch (e) {
      hilog.error(DOMAIN, TAG, `togglePlay failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async startPlay(): Promise<void> {
    if (this.isPlaying || this.context === null) {
      return;
    }

    const engine = this.audioService.getEngine();
    if (engine !== null) {
      engine.updateParams(this.buildEngineParams());
    }

    try {
      await this.bgService.startBackgroundTask(this.context);
    } catch (e) {
      hilog.error(DOMAIN, TAG,
        `Background task start failed (non-fatal): ${e instanceof Error ? e.message : String(e)}`);
    }

    try {
      await this.audioService.start();
      this.isPlaying = true;
      this.currentBeatIndex = -1;
      hilog.info(DOMAIN, TAG, 'Playback started');
    } catch (e) {
      try { await this.bgService.stopBackgroundTask(this.context); } catch (_) { /* best-effort */ }
      const msg = e instanceof Error ? e.message : String(e);
      hilog.error(DOMAIN, TAG, `Audio start failed: ${msg}`);
      throw new Error(`MetronomeViewModel.startPlay: audio start failed: ${msg}`);
    }

    this.notifyStateChange();
  }

  async stopPlay(): Promise<void> {
    if (!this.isPlaying) {
      return;
    }

    try {
      await this.audioService.stop();
    } catch (e) {
      hilog.error(DOMAIN, TAG, `Audio stop failed: ${e instanceof Error ? e.message : String(e)}`);
    }

    if (this.context !== null) {
      try { await this.bgService.stopBackgroundTask(this.context); } catch (e) {
        hilog.error(DOMAIN, TAG, `Background task stop failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    this.isPlaying = false;
    this.currentBeatIndex = -1;
    hilog.info(DOMAIN, TAG, 'Playback stopped');
    this.notifyStateChange();
  }

  // ── Parameter setters (auto-sync engine + persist) ──────────────────

  setBpm(value: number): void {
    const clamped = Math.max(30, Math.min(300, Math.round(value)));
    if (clamped === this.bpm) {
      return;
    }
    this.bpm = clamped;
    this.syncEngineParams();
    this.persistSingle('bpm', this.bpm);
    this.notifyStateChange();
  }

  adjustBpm(delta: number): void {
    this.setBpm(this.bpm + delta);
  }

  setMeterNumerator(value: number): void {
    const clamped = Math.max(1, Math.min(12, Math.round(value)));
    if (clamped === this.meterNumerator) {
      return;
    }
    this.meterNumerator = clamped;
    this.accentBitmask = this.accentBitmask & ((1 << clamped) - 1);
    if (this.accentBitmask === 0) {
      this.accentBitmask = 0x1;
    }
    this.syncEngineParams();
    this.persistSingle('meter_numerator', this.meterNumerator);
    this.persistSingle('accent_bitmask', this.accentBitmask);
    this.notifyStateChange();
  }

  setMeterDenominator(value: number): void {
    if (!VALID_DENOMINATORS.includes(value) || value === this.meterDenominator) {
      return;
    }
    this.meterDenominator = value;
    this.syncEngineParams();
    this.persistSingle('meter_denominator', this.meterDenominator);
    this.notifyStateChange();
  }

  setMeterPreset(num: number, den: number): void {
    const safeNum = Math.max(1, Math.min(12, num));
    const safeDen = VALID_DENOMINATORS.includes(den) ? den : 4;
    if (safeNum === this.meterNumerator && safeDen === this.meterDenominator) {
      return;
    }
    this.meterNumerator = safeNum;
    this.meterDenominator = safeDen;
    this.accentBitmask = 0x1;
    this.syncEngineParams();
    this.persistSingle('meter_numerator', this.meterNumerator);
    this.persistSingle('meter_denominator', this.meterDenominator);
    this.persistSingle('accent_bitmask', this.accentBitmask);
    this.notifyStateChange();
  }

  toggleAccent(beatIndex: number): void {
    if (beatIndex < 0 || beatIndex >= this.meterNumerator) {
      return;
    }
    this.accentBitmask ^= (1 << beatIndex);
    this.syncEngineParams();
    this.persistSingle('accent_bitmask', this.accentBitmask);
    this.notifyStateChange();
  }

  isAccent(beatIndex: number): boolean {
    if (beatIndex < 0 || beatIndex >= this.meterNumerator) {
      return false;
    }
    return ((this.accentBitmask >>> beatIndex) & 1) === 1;
  }

  resetAccentBitmask(): void {
    this.accentBitmask = 0x1;
    this.syncEngineParams();
    this.persistSingle('accent_bitmask', this.accentBitmask);
    this.notifyStateChange();
  }

  setLanguage(lang: string): void {
    if (!['en', 'zh', 'ja'].includes(lang) || lang === this.language) {
      return;
    }
    this.language = lang;
    this.syncEngineParams();
    this.persistSingle('language', this.language);
    this.notifyStateChange();
  }

  setFirstBeatOnly(value: boolean): void {
    if (value === this.firstBeatOnly) {
      return;
    }
    this.firstBeatOnly = value;
    this.syncEngineParams();
    this.persistSingle('first_beat_only', this.firstBeatOnly);
    this.notifyStateChange();
  }

  setVoiceOffsetMs(value: number): void {
    const clamped = Math.max(-200, Math.min(200, Math.round(value)));
    if (clamped === this.voiceOffsetMs) {
      return;
    }
    this.voiceOffsetMs = clamped;
    this.syncEngineParams();
    this.persistSingle('voice_offset_ms', this.voiceOffsetMs);
    this.notifyStateChange();
  }

  nextDenominator(): void {
    const idx = VALID_DENOMINATORS.indexOf(this.meterDenominator);
    if (idx >= 0 && idx < VALID_DENOMINATORS.length - 1) {
      this.setMeterDenominator(VALID_DENOMINATORS[idx + 1]);
    }
  }

  prevDenominator(): void {
    const idx = VALID_DENOMINATORS.indexOf(this.meterDenominator);
    if (idx > 0) {
      this.setMeterDenominator(VALID_DENOMINATORS[idx - 1]);
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────

  private buildEngineParams(): EngineParams {
    return {
      bpm: this.bpm,
      meterNumerator: this.meterNumerator,
      meterDenominator: this.meterDenominator,
      accentBitmask: this.accentBitmask,
      language: this.language,
      firstBeatOnly: this.firstBeatOnly,
      voiceOffsetMs: this.voiceOffsetMs
    };
  }

  private syncEngineParams(): void {
    const engine = this.audioService.getEngine();
    if (engine !== null) {
      engine.updateParams(this.buildEngineParams());
    }
  }

  private notifyStateChange(): void {
    if (this.onStateChange !== null) {
      try {
        this.onStateChange();
      } catch (e) {
        hilog.error(DOMAIN, TAG, `State change callback error: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  private applySettings(s: MetronomeSettings): void {
    this.bpm = s.bpm;
    this.meterNumerator = s.meterNumerator;
    this.meterDenominator = s.meterDenominator;
    this.accentBitmask = s.accentBitmask;
    this.language = s.language;
    this.firstBeatOnly = s.firstBeatOnly;
    this.voiceOffsetMs = s.voiceOffsetMs;
  }

  private persistSingle(key: string, value: number | string | boolean): void {
    this.prefsManager.saveSingle(key, value).catch((e: Object) => {
      hilog.error(DOMAIN, TAG, `persistSingle('${key}') failed: ${String(e)}`);
    });
  }
}
