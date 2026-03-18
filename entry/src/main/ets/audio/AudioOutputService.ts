import { audio } from '@kit.AudioKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { common } from '@kit.AbilityKit';
import { MetronomeEngine } from './MetronomeEngine';
import { VoiceSampleBank } from './VoiceSampleBank';
import { NativeMetronomeEngine } from './NativeMetronomeEngine';

const TAG: string = '[AudioOutputService]';
const DOMAIN: number = 0x0000;

const TARGET_SAMPLE_RATE: audio.AudioSamplingRate = audio.AudioSamplingRate.SAMPLE_RATE_48000;
const FALLBACK_SAMPLE_RATE: number = 48000;
const SUPPORTED_LANGUAGES: string[] = ['zh', 'en', 'ja'];
const MAX_BEAT_NUMBER: number = 12;
// NAPI 侧现在走 ArrayBuffer + byteOffset 拷贝链路，已经过模拟器起播验证。
const ENABLE_NATIVE_ENGINE: boolean = true;

interface RuntimeMetronomeEngine {
  updateParams: MetronomeEngine['updateParams'];
  prepare: MetronomeEngine['prepare'];
  reset: MetronomeEngine['reset'];
  renderAudio: MetronomeEngine['renderAudio'];
  onBeat: MetronomeEngine['onBeat'];
}

/**
 * Wraps HarmonyOS AudioRenderer in callback (writeData) mode.
 * Creates a metronome engine and VoiceSampleBank, wires the
 * renderer's write callback to engine.renderAudio(), and manages
 * the start / stop / release lifecycle.
 */
export class AudioOutputService {
  private renderer: audio.AudioRenderer | null = null;
  private engine: RuntimeMetronomeEngine | null = null;
  private voiceBank: VoiceSampleBank | null = null;
  private playing: boolean = false;
  private streamSampleRate: number = FALLBACK_SAMPLE_RATE;
  private rendererBufferSizeBytes: number = 0;
  private initialized: boolean = false;

  async init(context: common.UIAbilityContext): Promise<void> {
    if (this.initialized) {
      hilog.warn(DOMAIN, TAG, 'Already initialized, skipping duplicate init');
      return;
    }

    const rendererOptions: audio.AudioRendererOptions = {
      streamInfo: {
        samplingRate: TARGET_SAMPLE_RATE,
        channels: audio.AudioChannel.CHANNEL_1,
        sampleFormat: audio.AudioSampleFormat.SAMPLE_FORMAT_F32LE,
        encodingType: audio.AudioEncodingType.ENCODING_TYPE_RAW
      },
      rendererInfo: {
        usage: audio.StreamUsage.STREAM_USAGE_MUSIC,
        rendererFlags: 0
      }
    };

    try {
      this.renderer = await audio.createAudioRenderer(rendererOptions);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      throw new Error(`AudioOutputService.init: failed to create AudioRenderer: ${err.message}`);
    }

    await this.resolveRendererRuntimeConfig();

    this.voiceBank = new VoiceSampleBank();
    try {
      const resMgr = context.resourceManager;
      await this.voiceBank.init(resMgr, this.streamSampleRate);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      hilog.error(DOMAIN, TAG, `VoiceSampleBank init failed: ${err.message}`);
      throw new Error(`AudioOutputService.init: VoiceSampleBank init failed: ${err.message}`);
    }

    this.engine = this.createEngine();
    this.registerWriteCallback();
    this.initialized = true;
    hilog.info(DOMAIN, TAG, 'Initialized successfully');
  }

  getEngine(): RuntimeMetronomeEngine | null {
    return this.engine;
  }

  getVoiceBank(): VoiceSampleBank | null {
    return this.voiceBank;
  }

  getSampleRate(): number {
    return this.streamSampleRate;
  }

  async start(): Promise<void> {
    if (this.playing) {
      hilog.warn(DOMAIN, TAG, 'Already playing, ignoring start');
      return;
    }
    if (this.renderer === null) {
      throw new Error('AudioOutputService.start: renderer not initialized, call init() first');
    }
    if (this.engine === null) {
      throw new Error('AudioOutputService.start: engine not initialized, call init() first');
    }

    this.engine.reset();
    this.engine.prepare();

    try {
      await this.renderer.start();
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      throw new Error(`AudioOutputService.start: renderer.start() failed: ${err.message}`);
    }

    this.playing = true;
    hilog.info(DOMAIN, TAG, 'Playback started');
  }

  async stop(): Promise<void> {
    if (!this.playing) {
      return;
    }
    if (this.renderer === null) {
      this.playing = false;
      return;
    }

    try {
      await this.renderer.stop();
    } catch (e) {
      hilog.error(DOMAIN, TAG, `renderer.stop() failed: ${String(e)}`);
    }

    if (this.engine !== null) {
      this.engine.reset();
    }

    this.playing = false;
    hilog.info(DOMAIN, TAG, 'Playback stopped');
  }

  async release(): Promise<void> {
    if (this.playing) {
      await this.stop();
    }

    if (this.renderer !== null) {
      try {
        await this.renderer.release();
      } catch (e) {
        hilog.error(DOMAIN, TAG, `renderer.release() failed: ${String(e)}`);
      }
      this.renderer = null;
    }

    if (isNativeEngine(this.engine)) {
      this.engine.release();
    }
    this.engine = null;
    this.voiceBank = null;
    this.initialized = false;
    this.playing = false;
    hilog.info(DOMAIN, TAG, 'Released');
  }

  isPlaying(): boolean {
    return this.playing;
  }

  private registerWriteCallback(): void {
    if (this.renderer === null || this.engine === null) {
      return;
    }

    const engineRef = this.engine;

    try {
      this.renderer.on('writeData', (buffer: ArrayBuffer) => {
        const floatView = new Float32Array(buffer);
        engineRef.renderAudio(floatView, floatView.length);
      });
    } catch (e) {
      hilog.error(DOMAIN, TAG, `Failed to register writeData callback: ${String(e)}`);
    }
  }

  private async resolveRendererRuntimeConfig(): Promise<void> {
    if (this.renderer === null) {
      this.streamSampleRate = FALLBACK_SAMPLE_RATE;
      return;
    }

    try {
      const streamInfo = await this.renderer.getStreamInfo();
      const actualSampleRate = toNumericSampleRate(streamInfo.samplingRate);
      this.streamSampleRate = actualSampleRate > 0 ? actualSampleRate : FALLBACK_SAMPLE_RATE;
    } catch (e) {
      this.streamSampleRate = FALLBACK_SAMPLE_RATE;
      hilog.warn(DOMAIN, TAG, `getStreamInfo() failed, fallback to ${FALLBACK_SAMPLE_RATE}Hz: ${String(e)}`);
    }

    try {
      this.rendererBufferSizeBytes = await this.renderer.getBufferSize();
    } catch (e) {
      this.rendererBufferSizeBytes = 0;
      hilog.warn(DOMAIN, TAG, `getBufferSize() failed: ${String(e)}`);
    }

    const bytesPerFrame = Float32Array.BYTES_PER_ELEMENT;
    const approxBufferFrames = this.rendererBufferSizeBytes > 0
      ? Math.max(0, Math.floor(this.rendererBufferSizeBytes / bytesPerFrame))
      : 0;
    const approxBufferMs = approxBufferFrames > 0
      ? approxBufferFrames * 1000.0 / this.streamSampleRate
      : 0;

    hilog.info(DOMAIN, TAG,
      `Renderer runtime config: sampleRate=${this.streamSampleRate}Hz, ` +
      `bufferSize=${this.rendererBufferSizeBytes}B, approxFrames=${approxBufferFrames}, ` +
      `approxLatency=${approxBufferMs.toFixed(2)}ms`);
  }

  private createEngine(): RuntimeMetronomeEngine {
    if (this.voiceBank === null) {
      throw new Error('AudioOutputService.createEngine: voice bank not initialized');
    }

    if (ENABLE_NATIVE_ENGINE) {
      const nativeEngine = new NativeMetronomeEngine(this.streamSampleRate);
      this.preloadNativeVoiceSamples(nativeEngine);
      hilog.info(DOMAIN, TAG, 'Using native metronome engine');
      return nativeEngine;
    }

    const engine = new MetronomeEngine(this.streamSampleRate);
    engine.setVoiceSampleBank(this.voiceBank);
    hilog.warn(DOMAIN, TAG, 'Native metronome engine disabled, using ArkTS fallback engine');
    return engine;
  }

  private preloadNativeVoiceSamples(engine: NativeMetronomeEngine): void {
    if (this.voiceBank === null) {
      return;
    }

    for (const language of SUPPORTED_LANGUAGES) {
      for (let beat = 1; beat <= MAX_BEAT_NUMBER; beat++) {
        const sample = this.voiceBank.getSample(language, beat);
        if (sample !== null) {
          engine.setVoiceSample(language, beat, sample);
        }
      }
    }
  }
}

function toNumericSampleRate(rate: audio.AudioSamplingRate | number): number {
  const value = Number(rate);
  return Number.isFinite(value) && value > 0 ? value : FALLBACK_SAMPLE_RATE;
}

function isNativeEngine(engine: RuntimeMetronomeEngine | null): engine is NativeMetronomeEngine {
  return engine instanceof NativeMetronomeEngine;
}
