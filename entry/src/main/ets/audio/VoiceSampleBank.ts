import { resourceManager } from '@kit.LocalizationKit';
import { hilog } from '@kit.PerformanceAnalysisKit';

const TAG: string = '[VoiceSampleBank]';
const DOMAIN: number = 0x0000;

const SUPPORTED_LANGUAGES: string[] = ['en', 'zh', 'ja'];
const MAX_BEAT_NUMBER: number = 12;
const MIN_BEAT_NUMBER: number = 1;

/**
 * Parses WAV files from rawfile, converts PCM to Float32, resamples to stream
 * sample rate via linear interpolation, and caches decoded samples indexed by
 * language + beat number.
 */
export class VoiceSampleBank {
  private cache: Map<string, Float32Array> = new Map();
  private rawCache: Map<string, RawPcmData> = new Map();
  private streamSampleRate: number = 0;
  private ready: boolean = false;

  async init(resMgr: resourceManager.ResourceManager, streamSampleRate: number): Promise<void> {
    if (streamSampleRate <= 0 || !isFinite(streamSampleRate)) {
      throw new Error(`VoiceSampleBank.init: invalid streamSampleRate=${streamSampleRate}, must be positive finite`);
    }
    this.streamSampleRate = streamSampleRate;
    this.cache.clear();
    this.rawCache.clear();
    this.ready = false;

    for (const lang of SUPPORTED_LANGUAGES) {
      for (let beat = MIN_BEAT_NUMBER; beat <= MAX_BEAT_NUMBER; beat++) {
        const path = `voice/${lang}/${beat}.wav`;
        try {
          const rawBytes: Uint8Array = await resMgr.getRawFileContent(path);
          const rawPcm = parseWav(rawBytes, path);
          const key = cacheKey(lang, beat);
          this.rawCache.set(key, rawPcm);

          const resampled = resampleLinear(rawPcm.samples, rawPcm.sampleRate, this.streamSampleRate);
          this.cache.set(key, resampled);
        } catch (e) {
          const err = e instanceof Error ? e : new Error(String(e));
          hilog.error(DOMAIN, TAG, `Failed to load ${path}: ${err.message}`);
          throw new Error(`VoiceSampleBank.init failed loading '${path}': ${err.message}`);
        }
      }
    }

    this.ready = true;
    hilog.info(DOMAIN, TAG, `Initialized: ${this.cache.size} samples cached at ${this.streamSampleRate}Hz`);
  }

  getSample(language: string, beatNumber: number): Float32Array | null {
    if (!this.ready) {
      return null;
    }
    const beat = Math.max(MIN_BEAT_NUMBER, Math.min(MAX_BEAT_NUMBER, Math.round(beatNumber)));
    const lang = SUPPORTED_LANGUAGES.includes(language) ? language : 'en';
    return this.cache.get(cacheKey(lang, beat)) ?? null;
  }

  async setStreamSampleRate(resMgr: resourceManager.ResourceManager, newRate: number): Promise<void> {
    if (newRate <= 0 || !isFinite(newRate)) {
      throw new Error(`VoiceSampleBank.setStreamSampleRate: invalid rate=${newRate}`);
    }
    if (newRate === this.streamSampleRate && this.ready) {
      return;
    }

    if (this.rawCache.size === 0) {
      await this.init(resMgr, newRate);
      return;
    }

    this.streamSampleRate = newRate;
    this.cache.clear();

    for (const [key, rawPcm] of this.rawCache) {
      try {
        const resampled = resampleLinear(rawPcm.samples, rawPcm.sampleRate, newRate);
        this.cache.set(key, resampled);
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        hilog.error(DOMAIN, TAG, `Resample failed for key '${key}': ${err.message}`);
        throw new Error(`VoiceSampleBank.setStreamSampleRate failed for '${key}': ${err.message}`);
      }
    }

    hilog.info(DOMAIN, TAG, `Resampled ${this.cache.size} samples to ${newRate}Hz`);
  }

  isReady(): boolean {
    return this.ready;
  }
}

interface RawPcmData {
  samples: Float32Array;
  sampleRate: number;
}

function cacheKey(language: string, beatNumber: number): string {
  return `${language}:${beatNumber}`;
}

// ── WAV parser ──────────────────────────────────────────────────────────

function parseWav(data: Uint8Array, sourcePath: string): RawPcmData {
  if (data.length < 44) {
    throw new Error(`WAV too short (${data.length} bytes) in '${sourcePath}'`);
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  const riffTag = readFourCC(data, 0);
  if (riffTag !== 'RIFF') {
    throw new Error(`Missing RIFF header in '${sourcePath}', got '${riffTag}'`);
  }
  const waveTag = readFourCC(data, 8);
  if (waveTag !== 'WAVE') {
    throw new Error(`Missing WAVE tag in '${sourcePath}', got '${waveTag}'`);
  }

  let fmtFound = false;
  let audioFormat: number = 0;
  let numChannels: number = 0;
  let sampleRate: number = 0;
  let bitsPerSample: number = 0;

  let dataOffset: number = -1;
  let dataSize: number = 0;

  let offset = 12;
  while (offset + 8 <= data.length) {
    const chunkId = readFourCC(data, offset);
    const chunkSize = view.getUint32(offset + 4, true);

    if (chunkId === 'fmt ') {
      if (offset + 8 + chunkSize > data.length) {
        throw new Error(`fmt chunk overflows file in '${sourcePath}'`);
      }
      audioFormat = view.getUint16(offset + 8, true);
      numChannels = view.getUint16(offset + 10, true);
      sampleRate = view.getUint32(offset + 12, true);
      bitsPerSample = view.getUint16(offset + 22, true);
      fmtFound = true;
    } else if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataSize = chunkSize;
      if (dataOffset + dataSize > data.length) {
        hilog.warn(DOMAIN, TAG,
          `data chunk size (${dataSize}) exceeds file size in '${sourcePath}', will use available data`);
      }
      break;
    }

    // Advance to next chunk; chunks are word-aligned (pad to even size)
    offset += 8 + chunkSize;
    if (chunkSize % 2 !== 0) {
      offset += 1;
    }
  }

  if (!fmtFound) {
    throw new Error(`No fmt chunk found in '${sourcePath}'`);
  }
  if (dataOffset < 0) {
    throw new Error(`No data chunk found in '${sourcePath}'`);
  }
  if (audioFormat !== 1) {
    throw new Error(`Unsupported audio format ${audioFormat} in '${sourcePath}', only PCM (1) supported`);
  }
  if (numChannels < 1) {
    throw new Error(`Invalid channel count ${numChannels} in '${sourcePath}'`);
  }
  if (sampleRate <= 0) {
    throw new Error(`Invalid sample rate ${sampleRate} in '${sourcePath}'`);
  }
  if (bitsPerSample !== 8 && bitsPerSample !== 16 && bitsPerSample !== 24 && bitsPerSample !== 32) {
    throw new Error(`Unsupported bit depth ${bitsPerSample} in '${sourcePath}'`);
  }

  const availableBytes = Math.min(dataSize, data.length - dataOffset);
  const bytesPerSample = bitsPerSample / 8;
  const bytesPerFrame = bytesPerSample * numChannels;
  const totalFrames = Math.floor(availableBytes / bytesPerFrame);

  if (totalFrames <= 0) {
    throw new Error(`No audio frames in '${sourcePath}' (available=${availableBytes}, bytesPerFrame=${bytesPerFrame})`);
  }

  const monoSamples = new Float32Array(totalFrames);

  for (let frame = 0; frame < totalFrames; frame++) {
    let monoSum: number = 0;
    for (let ch = 0; ch < numChannels; ch++) {
      const sampleOffset = dataOffset + frame * bytesPerFrame + ch * bytesPerSample;
      monoSum += readSampleAsFloat(view, sampleOffset, bitsPerSample);
    }
    monoSamples[frame] = monoSum / numChannels;
  }

  return { samples: monoSamples, sampleRate: sampleRate };
}

function readFourCC(data: Uint8Array, offset: number): string {
  return String.fromCharCode(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
}

function readSampleAsFloat(view: DataView, offset: number, bitsPerSample: number): number {
  switch (bitsPerSample) {
    case 8:
      // 8-bit WAV is unsigned: 0..255 → map to -1..1
      return (view.getUint8(offset) - 128) / 128.0;
    case 16:
      return view.getInt16(offset, true) / 32768.0;
    case 24: {
      // 24-bit little-endian signed
      let val = view.getUint8(offset) | (view.getUint8(offset + 1) << 8) | (view.getUint8(offset + 2) << 16);
      if (val & 0x800000) {
        val |= ~0xFFFFFF; // sign extend
      }
      return val / 8388608.0;
    }
    case 32:
      return view.getInt32(offset, true) / 2147483648.0;
    default:
      return 0;
  }
}

// ── Linear interpolation resampler ──────────────────────────────────────

function resampleLinear(input: Float32Array, sourceSampleRate: number, targetSampleRate: number): Float32Array {
  if (sourceSampleRate === targetSampleRate) {
    return new Float32Array(input);
  }
  if (input.length === 0) {
    return new Float32Array(0);
  }

  const ratio = sourceSampleRate / targetSampleRate;
  const outputLength = Math.max(1, Math.floor(input.length / ratio));
  const output = new Float32Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const srcPos = i * ratio;
    const index = Math.floor(srcPos);
    const frac = srcPos - index;

    const safeIndex = Math.min(index, input.length - 1);
    if (safeIndex + 1 < input.length) {
      output[i] = input[safeIndex] * (1.0 - frac) + input[safeIndex + 1] * frac;
    } else {
      output[i] = input[safeIndex];
    }
  }

  return output;
}
