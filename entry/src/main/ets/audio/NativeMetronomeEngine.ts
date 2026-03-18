import metronomeNative from 'libmetronome_native.so';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { BeatCallback, BeatEventInfo, EngineParams } from './MetronomeEngine';

const TAG: string = '[NativeMetronomeEngine]';
const DOMAIN: number = 0x0000;

const DEFAULT_PARAMS: EngineParams = {
  bpm: 120,
  meterNumerator: 4,
  meterDenominator: 4,
  accentBitmask: 0x1,
  language: 'zh',
  firstBeatOnly: true,
  voiceOffsetMs: 0
};

/**
 * 使用 NAPI 承担逐帧混音，ArkTS 仅保留状态同步与回调分发。
 */
export class NativeMetronomeEngine {
  private beatCallback: BeatCallback | null = null;
  private params: EngineParams = { ...DEFAULT_PARAMS };
  private lastRenderErrorCode: number | null = null;

  constructor(sampleRate: number) {
    const result = metronomeNative.init(sampleRate);
    if (result !== 0) {
      throw new Error(`NativeMetronomeEngine.init failed: ${result}`);
    }
  }

  setVoiceSample(language: string, beatNumber: number, samples: Float32Array): void {
    const result = metronomeNative.setVoiceSampleBuffer(
      language,
      beatNumber,
      samples.buffer,
      samples.byteOffset,
      samples.length
    );
    if (result !== 0) {
      throw new Error(`NativeMetronomeEngine.setVoiceSample failed: ${language}/${beatNumber} -> ${result}`);
    }
  }

  updateParams(params: EngineParams): void {
    this.params = {
      bpm: params.bpm,
      meterNumerator: params.meterNumerator,
      meterDenominator: params.meterDenominator,
      accentBitmask: params.accentBitmask,
      language: params.language,
      firstBeatOnly: params.firstBeatOnly,
      voiceOffsetMs: params.voiceOffsetMs
    };

    const result = metronomeNative.updateParams(
      this.params.bpm,
      this.params.meterNumerator,
      this.params.meterDenominator,
      this.params.accentBitmask,
      this.params.language,
      this.params.firstBeatOnly,
      this.params.voiceOffsetMs
    );
    if (result !== 0) {
      throw new Error(`NativeMetronomeEngine.updateParams failed: ${result}`);
    }
  }

  prepare(): void {
    metronomeNative.prepare();
  }

  reset(): void {
    metronomeNative.reset();
  }

  renderAudio(buffer: Float32Array, numFrames: number): void {
    const frameCount = Math.max(0, Math.min(numFrames, buffer.length));
    if (frameCount === 0) {
      return;
    }

    const beatIndex = metronomeNative.renderAudioBuffer(buffer.buffer, buffer.byteOffset, frameCount);
    if (beatIndex < -1) {
      if (this.lastRenderErrorCode !== beatIndex) {
        hilog.error(DOMAIN, TAG, `renderAudioBuffer failed: ${beatIndex}, frameCount=${frameCount}, byteOffset=${buffer.byteOffset}`);
        this.lastRenderErrorCode = beatIndex;
      }
      return;
    }

    this.lastRenderErrorCode = null;
    if (beatIndex >= 0 && this.beatCallback !== null) {
      const info: BeatEventInfo = {
        beatIndex: beatIndex,
        isAccent: ((this.params.accentBitmask >>> beatIndex) & 1) === 1,
        measureComplete: (beatIndex + 1) >= this.params.meterNumerator
      };
      this.beatCallback(info);
    }
  }

  onBeat(callback: BeatCallback): void {
    this.beatCallback = callback;
  }

  release(): void {
    metronomeNative.release();
    this.beatCallback = null;
    this.lastRenderErrorCode = null;
  }
}
