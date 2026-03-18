export const init: (sampleRate: number) => number;
export const setVoiceSampleBuffer: (
  language: string,
  beatNumber: number,
  buffer: ArrayBuffer,
  byteOffset: number,
  sampleCount: number
) => number;
export const updateParams: (
  bpm: number,
  meterNumerator: number,
  meterDenominator: number,
  accentBitmask: number,
  language: string,
  firstBeatOnly: boolean,
  voiceOffsetMs: number
) => number;
export const prepare: () => void;
export const reset: () => void;
export const renderAudioBuffer: (buffer: ArrayBuffer, byteOffset: number, frameCount: number) => number;
export const release: () => void;
