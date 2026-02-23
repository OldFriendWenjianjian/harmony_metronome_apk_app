import { VoiceSampleBank } from './VoiceSampleBank';

export interface EngineParams {
  bpm: number;
  meterNumerator: number;
  meterDenominator: number;
  accentBitmask: number;
  language: string;
  firstBeatOnly: boolean;
  voiceOffsetMs: number;
}

export interface BeatEventInfo {
  beatIndex: number;
  isAccent: boolean;
  measureComplete: boolean;
}

export type BeatCallback = (info: BeatEventInfo) => void;

const DEFAULT_PARAMS: EngineParams = {
  bpm: 120,
  meterNumerator: 4,
  meterDenominator: 4,
  accentBitmask: 0x1,
  language: 'en',
  firstBeatOnly: true,
  voiceOffsetMs: 0
};

const CLICK_DURATION_SEC: number = 0.03;
const ACCENT_FREQ_HZ: number = 1000;
const ACCENT_AMPLITUDE: number = 0.8;
const NORMAL_FREQ_HZ: number = 800;
const NORMAL_AMPLITUDE: number = 0.5;
// Decay to 1/1000 of original over clickSamples: decayRate = ln(1000) / clickSamples
const DECAY_TARGET: number = Math.log(1000);

/**
 * Frame-level beat scheduling engine. Fills Float32 audio buffers with
 * click waveforms and mixed voice samples. Supports phase-continuous BPM
 * changes and per-beat accent bitmask control.
 *
 * Designed to run inside an AudioRenderer write callback — all state is
 * pre-loaded so renderAudio performs zero I/O.
 */
export class MetronomeEngine {
  private sampleRate: number;

  // Current parameters
  private params: EngineParams = { ...DEFAULT_PARAMS };
  // Snapshot of params used during last render to detect changes
  private lastBpm: number = 0;
  private lastMeterDenominator: number = 0;
  private lastMeterNumerator: number = 0;

  // Pre-computed click waveforms
  private accentClick: Float32Array = new Float32Array(0);
  private normalClick: Float32Array = new Float32Array(0);

  // Beat scheduling state
  private totalFramesRendered: number = 0;
  private nextBeatFrame: number = 0;
  private framesPerBeat: number = 0;
  private currentBeatInMeasure: number = 0;

  // Active click playback
  private activeClickSource: Float32Array | null = null;
  private clickPlaybackPos: number = -1;

  // Voice mixing
  private voiceSampleBank: VoiceSampleBank | null = null;
  private activeVoiceSample: Float32Array | null = null;
  private voicePlaybackPos: number = -1;

  // Pre-allocated voice trigger buffers (reused across renderAudio calls to avoid GC)
  private vtFrames: number[] = [];
  private vtSamples: (Float32Array | null)[] = [];
  private vtCount: number = 0;

  // Beat callback
  private beatCallback: BeatCallback | null = null;

  constructor(sampleRate: number) {
    if (sampleRate <= 0 || !isFinite(sampleRate)) {
      throw new Error(`MetronomeEngine: invalid sampleRate=${sampleRate}, must be positive finite`);
    }
    this.sampleRate = sampleRate;
  }

  setVoiceSampleBank(bank: VoiceSampleBank): void {
    this.voiceSampleBank = bank;
  }

  updateParams(params: EngineParams): void {
    this.params = {
      bpm: clampFinite(params.bpm, 20, 300, DEFAULT_PARAMS.bpm),
      meterNumerator: clampFinite(params.meterNumerator, 1, 12, DEFAULT_PARAMS.meterNumerator),
      meterDenominator: clampFinite(params.meterDenominator, 1, 16, DEFAULT_PARAMS.meterDenominator),
      accentBitmask: typeof params.accentBitmask === 'number' ? params.accentBitmask : DEFAULT_PARAMS.accentBitmask,
      language: params.language ?? DEFAULT_PARAMS.language,
      firstBeatOnly: typeof params.firstBeatOnly === 'boolean' ? params.firstBeatOnly : DEFAULT_PARAMS.firstBeatOnly,
      voiceOffsetMs: clampFinite(params.voiceOffsetMs, -200, 200, DEFAULT_PARAMS.voiceOffsetMs)
    };
  }

  prepare(): void {
    this.generateClickWaveforms();
    this.framesPerBeat = this.calcFramesPerBeat(this.params.bpm, this.params.meterDenominator);
    this.lastBpm = this.params.bpm;
    this.lastMeterDenominator = this.params.meterDenominator;
    this.lastMeterNumerator = this.params.meterNumerator;
  }

  renderAudio(buffer: Float32Array, numFrames: number): void {
    const frames = Math.max(0, Math.min(numFrames, buffer.length));
    if (frames === 0) {
      return;
    }

    this.handleParamChanges();

    this.collectVoiceTriggers(frames);
    let vtIdx = 0;

    for (let i = 0; i < frames; i++) {
      let sample: number = 0.0;
      const globalFrame = this.totalFramesRendered + i;

      // Check for new beat trigger
      if (globalFrame >= this.nextBeatFrame) {
        const beatIdx = this.currentBeatInMeasure;
        const isAccent = ((this.params.accentBitmask >>> beatIdx) & 1) === 1;

        this.activeClickSource = isAccent ? this.accentClick : this.normalClick;
        this.clickPlaybackPos = 0;

        const measureComplete = (beatIdx + 1) >= this.params.meterNumerator;

        if (this.beatCallback !== null) {
          try {
            this.beatCallback({ beatIndex: beatIdx, isAccent, measureComplete });
          } catch (_) {
            // Callback errors must not break the audio thread
          }
        }

        this.currentBeatInMeasure = (beatIdx + 1) % this.params.meterNumerator;
        this.nextBeatFrame += this.framesPerBeat;
      }

      // Mix click
      if (this.clickPlaybackPos >= 0 && this.activeClickSource !== null &&
          this.clickPlaybackPos < this.activeClickSource.length) {
        sample += this.activeClickSource[this.clickPlaybackPos];
        this.clickPlaybackPos++;
      }

      // Check voice trigger at this frame position (using pre-allocated arrays)
      if (vtIdx < this.vtCount && i === this.vtFrames[vtIdx]) {
        const triggerSample = this.vtSamples[vtIdx];
        if (triggerSample !== null) {
          this.activeVoiceSample = triggerSample;
          this.voicePlaybackPos = 0;
        }
        vtIdx++;
      }

      // Mix voice
      if (this.voicePlaybackPos >= 0 && this.activeVoiceSample !== null &&
          this.voicePlaybackPos < this.activeVoiceSample.length) {
        sample += this.activeVoiceSample[this.voicePlaybackPos];
        this.voicePlaybackPos++;
      }

      buffer[i] = Math.max(-1.0, Math.min(1.0, sample));
    }

    this.totalFramesRendered += frames;
  }

  reset(): void {
    this.totalFramesRendered = 0;
    this.nextBeatFrame = 0;
    this.currentBeatInMeasure = 0;
    this.activeClickSource = null;
    this.clickPlaybackPos = -1;
    this.activeVoiceSample = null;
    this.voicePlaybackPos = -1;
    this.lastBpm = 0;
    this.lastMeterDenominator = 0;
    this.lastMeterNumerator = 0;
  }

  onBeat(callback: BeatCallback): void {
    this.beatCallback = callback;
  }

  getCurrentBeat(): number {
    return this.currentBeatInMeasure;
  }

  // ── Private: parameter change detection (phase-continuous) ──────────

  private handleParamChanges(): void {
    let recalcBeat = false;

    if (this.params.bpm !== this.lastBpm || this.params.meterDenominator !== this.lastMeterDenominator) {
      const newFramesPerBeat = this.calcFramesPerBeat(this.params.bpm, this.params.meterDenominator);
      this.framesPerBeat = newFramesPerBeat;
      // Phase-continuous: schedule next beat relative to current position
      this.nextBeatFrame = this.totalFramesRendered + newFramesPerBeat;
      this.lastBpm = this.params.bpm;
      this.lastMeterDenominator = this.params.meterDenominator;
      recalcBeat = true;
    }

    if (this.params.meterNumerator !== this.lastMeterNumerator) {
      if (this.params.meterNumerator > 0) {
        this.currentBeatInMeasure = this.currentBeatInMeasure % this.params.meterNumerator;
      }
      this.lastMeterNumerator = this.params.meterNumerator;
    }

    if (recalcBeat) {
      this.generateClickWaveforms();
    }
  }

  // ── Private: click waveform generation ──────────────────────────────

  private generateClickWaveforms(): void {
    const clickSamples = Math.max(1, Math.floor(this.sampleRate * CLICK_DURATION_SEC));
    const decayRate = DECAY_TARGET / clickSamples;

    this.accentClick = generateSineDecay(ACCENT_FREQ_HZ, ACCENT_AMPLITUDE, clickSamples, decayRate, this.sampleRate);
    this.normalClick = generateSineDecay(NORMAL_FREQ_HZ, NORMAL_AMPLITUDE, clickSamples, decayRate, this.sampleRate);
  }

  // ── Private: voice trigger collection ───────────────────────────────

  /**
   * Scans the current buffer window (and a lookahead region for negative
   * voice offsets) to determine which buffer-local frame indices should
   * start voice playback. Populates the pre-allocated vtFrames/vtSamples
   * arrays to avoid per-call Map allocation and GC pressure.
   *
   * When a new voice triggers, it truncates any previously playing voice.
   */
  private collectVoiceTriggers(numFrames: number): void {
    this.vtCount = 0;

    if (this.voiceSampleBank === null || !this.voiceSampleBank.isReady()) {
      return;
    }

    const offsetFrames = Math.round(this.params.voiceOffsetMs / 1000.0 * this.sampleRate);

    // For negative offset: voice starts BEFORE beat → lookahead to find
    // beats slightly ahead of this buffer window
    const lookaheadFrames = offsetFrames < 0
      ? Math.max(Math.abs(offsetFrames), Math.floor(this.sampleRate * 0.2))
      : 0;

    const scanStart = this.totalFramesRendered;
    const scanEnd = this.totalFramesRendered + numFrames + lookaheadFrames;

    let beatFrame = this.nextBeatFrame;
    let beatInMeasure = this.currentBeatInMeasure;

    if (beatFrame < scanStart && this.framesPerBeat > 0) {
      const stepsNeeded = Math.ceil((scanStart - beatFrame) / this.framesPerBeat);
      beatFrame += stepsNeeded * this.framesPerBeat;
      beatInMeasure = (beatInMeasure + stepsNeeded) % this.params.meterNumerator;
    }

    while (beatFrame < scanEnd && this.framesPerBeat > 0) {
      const shouldPlayVoice = !this.params.firstBeatOnly || beatInMeasure === 0;

      if (shouldPlayVoice) {
        const voiceBeatNumber = beatInMeasure + 1;
        const voiceSample = this.voiceSampleBank.getSample(this.params.language, voiceBeatNumber);

        if (voiceSample !== null) {
          const voiceStartGlobal = beatFrame + offsetFrames;
          const localFrame = voiceStartGlobal - this.totalFramesRendered;

          if (localFrame >= 0 && localFrame < numFrames) {
            const idx = this.vtCount;
            if (idx < this.vtFrames.length) {
              this.vtFrames[idx] = localFrame;
              this.vtSamples[idx] = voiceSample;
            } else {
              this.vtFrames.push(localFrame);
              this.vtSamples.push(voiceSample);
            }
            this.vtCount++;
          }
        }
      }

      beatFrame += this.framesPerBeat;
      beatInMeasure = (beatInMeasure + 1) % this.params.meterNumerator;
    }
  }

  // ── Private: utility ────────────────────────────────────────────────

  private calcFramesPerBeat(bpm: number, meterDenominator: number): number {
    const safeBpm = Math.max(20, Math.min(300, bpm));
    const safeDenom = Math.max(1, Math.min(16, meterDenominator));
    const beatUnit = 4.0 / safeDenom;
    return Math.round(this.sampleRate * 60.0 / safeBpm * beatUnit);
  }
}

// ── Module-level helpers ──────────────────────────────────────────────

function generateSineDecay(
  freqHz: number,
  amplitude: number,
  numSamples: number,
  decayRate: number,
  sampleRate: number
): Float32Array {
  const waveform = new Float32Array(numSamples);
  const angularFreq = 2.0 * Math.PI * freqHz / sampleRate;
  for (let i = 0; i < numSamples; i++) {
    const envelope = amplitude * Math.exp(-decayRate * i);
    waveform[i] = envelope * Math.sin(angularFreq * i);
  }
  return waveform;
}

function clampFinite(value: number, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !isFinite(value)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, value));
}
