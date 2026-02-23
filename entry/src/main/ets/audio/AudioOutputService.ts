import { audio } from '@kit.AudioKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { common } from '@kit.AbilityKit';
import { MetronomeEngine } from './MetronomeEngine';
import { VoiceSampleBank } from './VoiceSampleBank';

const TAG: string = '[AudioOutputService]';
const DOMAIN: number = 0x0000;

const TARGET_SAMPLE_RATE: audio.AudioSamplingRate = audio.AudioSamplingRate.SAMPLE_RATE_48000;
const FALLBACK_SAMPLE_RATE: number = 48000;

/**
 * Wraps HarmonyOS AudioRenderer in callback (writeData) mode.
 * Creates a MetronomeEngine and VoiceSampleBank, wires the
 * renderer's write callback to engine.renderAudio(), and manages
 * the start / stop / release lifecycle.
 */
export class AudioOutputService {
  private renderer: audio.AudioRenderer | null = null;
  private engine: MetronomeEngine | null = null;
  private voiceBank: VoiceSampleBank | null = null;
  private playing: boolean = false;
  private streamSampleRate: number = FALLBACK_SAMPLE_RATE;
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

    // Use the configured sample rate directly (48000Hz)
    this.streamSampleRate = FALLBACK_SAMPLE_RATE;
    hilog.info(DOMAIN, TAG, `Stream sample rate: ${this.streamSampleRate}Hz`);

    this.engine = new MetronomeEngine(this.streamSampleRate);

    this.voiceBank = new VoiceSampleBank();
    try {
      const resMgr = context.resourceManager;
      await this.voiceBank.init(resMgr, this.streamSampleRate);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      hilog.error(DOMAIN, TAG, `VoiceSampleBank init failed: ${err.message}`);
      throw new Error(`AudioOutputService.init: VoiceSampleBank init failed: ${err.message}`);
    }

    this.engine.setVoiceSampleBank(this.voiceBank);

    this.registerWriteCallback();
    this.initialized = true;
    hilog.info(DOMAIN, TAG, 'Initialized successfully');
  }

  getEngine(): MetronomeEngine | null {
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
      throw new Error('AudioOutputService.start: renderer not initialized — call init() first');
    }
    if (this.engine === null) {
      throw new Error('AudioOutputService.start: engine not initialized — call init() first');
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

    this.engine = null;
    this.voiceBank = null;
    this.initialized = false;
    this.playing = false;
    hilog.info(DOMAIN, TAG, 'Released');
  }

  isPlaying(): boolean {
    return this.playing;
  }

  // ── Private ────────────────────────────────────────────────────────

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
}
