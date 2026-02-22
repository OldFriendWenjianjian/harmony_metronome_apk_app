import { preferences } from '@kit.ArkData';
import { Context } from '@kit.AbilityKit';

const STORE_NAME: string = 'metronome_prefs';

const KEYS = {
  BPM: 'bpm',
  METER_NUMERATOR: 'meter_numerator',
  METER_DENOMINATOR: 'meter_denominator',
  ACCENT_BITMASK: 'accent_bitmask',
  LANGUAGE: 'language',
  FIRST_BEAT_ONLY: 'first_beat_only',
  VOICE_OFFSET_MS: 'voice_offset_ms'
} as const;

const DEFAULTS = {
  bpm: 120,
  meterNumerator: 4,
  meterDenominator: 4,
  accentBitmask: 0x1,
  language: 'en',
  firstBeatOnly: true,
  voiceOffsetMs: 0
};

export interface MetronomeSettings {
  bpm: number;
  meterNumerator: number;
  meterDenominator: number;
  accentBitmask: number;
  language: string;
  firstBeatOnly: boolean;
  voiceOffsetMs: number;
}

export class PreferencesManager {
  private prefs: preferences.Preferences | null = null;

  async init(context: Context): Promise<void> {
    try {
      this.prefs = await preferences.getPreferences(context, STORE_NAME);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      throw new Error(`PreferencesManager.init failed for store '${STORE_NAME}': ${err.message}`,
        { cause: err });
    }
  }

  async load(): Promise<MetronomeSettings> {
    if (!this.prefs) {
      return { ...DEFAULTS };
    }
    try {
      const bpm = await this.prefs.get(KEYS.BPM, DEFAULTS.bpm) as number;
      const meterNumerator = await this.prefs.get(KEYS.METER_NUMERATOR, DEFAULTS.meterNumerator) as number;
      const meterDenominator = await this.prefs.get(KEYS.METER_DENOMINATOR, DEFAULTS.meterDenominator) as number;
      const accentBitmask = await this.prefs.get(KEYS.ACCENT_BITMASK, DEFAULTS.accentBitmask) as number;
      const language = await this.prefs.get(KEYS.LANGUAGE, DEFAULTS.language) as string;
      const firstBeatOnly = await this.prefs.get(KEYS.FIRST_BEAT_ONLY, DEFAULTS.firstBeatOnly) as boolean;
      const voiceOffsetMs = await this.prefs.get(KEYS.VOICE_OFFSET_MS, DEFAULTS.voiceOffsetMs) as number;

      return {
        bpm: clampNumber(bpm, 20, 300, DEFAULTS.bpm),
        meterNumerator: clampNumber(meterNumerator, 1, 12, DEFAULTS.meterNumerator),
        meterDenominator: clampNumber(meterDenominator, 1, 16, DEFAULTS.meterDenominator),
        accentBitmask: typeof accentBitmask === 'number' ? accentBitmask : DEFAULTS.accentBitmask,
        language: typeof language === 'string' && ['en', 'zh', 'ja'].includes(language) ? language : DEFAULTS.language,
        firstBeatOnly: typeof firstBeatOnly === 'boolean' ? firstBeatOnly : DEFAULTS.firstBeatOnly,
        voiceOffsetMs: clampNumber(voiceOffsetMs, -200, 200, DEFAULTS.voiceOffsetMs)
      };
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      throw new Error(`PreferencesManager.load failed: ${err.message}`, { cause: err });
    }
  }

  async save(settings: MetronomeSettings): Promise<void> {
    if (!this.prefs) {
      return;
    }
    try {
      await this.prefs.put(KEYS.BPM, settings.bpm);
      await this.prefs.put(KEYS.METER_NUMERATOR, settings.meterNumerator);
      await this.prefs.put(KEYS.METER_DENOMINATOR, settings.meterDenominator);
      await this.prefs.put(KEYS.ACCENT_BITMASK, settings.accentBitmask);
      await this.prefs.put(KEYS.LANGUAGE, settings.language);
      await this.prefs.put(KEYS.FIRST_BEAT_ONLY, settings.firstBeatOnly);
      await this.prefs.put(KEYS.VOICE_OFFSET_MS, settings.voiceOffsetMs);
      await this.prefs.flush();
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      throw new Error(`PreferencesManager.save failed: ${err.message}`, { cause: err });
    }
  }

  async saveSingle(key: string, value: number | string | boolean): Promise<void> {
    if (!this.prefs) {
      return;
    }
    try {
      await this.prefs.put(key, value);
      await this.prefs.flush();
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      throw new Error(`PreferencesManager.saveSingle failed for key '${key}': ${err.message}`,
        { cause: err });
    }
  }

  getDefaults(): MetronomeSettings {
    return { ...DEFAULTS };
  }
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !isFinite(value)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, value));
}
