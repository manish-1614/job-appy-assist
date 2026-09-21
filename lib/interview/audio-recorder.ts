/**
 * Client-side microphone capture and 16kHz Linear PCM stream encoder.
 */

export interface AudioRecorderOptions {
  onAudioChunk: (base64Pcm16: string) => void;
  onSpeechStateChange?: (state: 'speaking' | 'silent') => void;
  onRmsLevel?: (rms: number) => void;
  chunkDurationMs?: number; // default 150ms
}

export class AudioRecorder {
  private options: AudioRecorderOptions;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private isRecording: boolean = false;
  private pcmBuffer: Int16Array[] = [];
  private totalSamplesBuffered: number = 0;
  private targetSampleRate: number = 16000;
  private isSpeaking: boolean = false;
  private silenceTimer: any = null;

  constructor(options: AudioRecorderOptions) {
    this.options = options;
  }

  public async start(): Promise<void> {
    if (this.isRecording) return;

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new AudioContextClass();
    const sourceSampleRate = this.audioContext.sampleRate;

    this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
    // Buffer size 2048 or 4096
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    const chunkSamplesThreshold = Math.floor(
      (this.targetSampleRate * (this.options.chunkDurationMs || 150)) / 1000
    );

    this.processor.onaudioprocess = (e: AudioProcessingEvent) => {
      if (!this.isRecording) return;
      const inputData = e.inputBuffer.getChannelData(0);

      // Compute RMS volume
      let sumSquares = 0;
      for (let i = 0; i < inputData.length; i++) {
        sumSquares += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sumSquares / inputData.length);
      if (this.options.onRmsLevel) {
        this.options.onRmsLevel(rms);
      }

      // Voice activity state
      const speechThreshold = 0.02;
      if (rms > speechThreshold) {
        if (!this.isSpeaking) {
          this.isSpeaking = true;
          this.options.onSpeechStateChange?.('speaking');
        }
        if (this.silenceTimer) {
          clearTimeout(this.silenceTimer);
          this.silenceTimer = null;
        }
      } else if (this.isSpeaking && !this.silenceTimer) {
        this.silenceTimer = setTimeout(() => {
          this.isSpeaking = false;
          this.options.onSpeechStateChange?.('silent');
          this.silenceTimer = null;
        }, 600);
      }

      // Downsample to 16,000 Hz
      const downsampled = this.downsampleBuffer(inputData, sourceSampleRate, this.targetSampleRate);
      this.pcmBuffer.push(downsampled);
      this.totalSamplesBuffered += downsampled.length;

      if (this.totalSamplesBuffered >= chunkSamplesThreshold) {
        this.flushBuffer();
      }
    };

    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
    this.isRecording = true;
  }

  private downsampleBuffer(buffer: Float32Array, inputRate: number, outputRate: number): Int16Array {
    if (outputRate === inputRate) {
      const output = new Int16Array(buffer.length);
      for (let i = 0; i < buffer.length; i++) {
        const s = Math.max(-1, Math.min(1, buffer[i]));
        output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      return output;
    }

    const sampleRateRatio = inputRate / outputRate;
    const newLength = Math.round(buffer.length / sampleRateRatio);
    const result = new Int16Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;

    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
      let accum = 0;
      let count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        accum += buffer[i];
        count++;
      }
      const s = Math.max(-1, Math.min(1, count > 0 ? accum / count : 0));
      result[offsetResult] = s < 0 ? s * 0x8000 : s * 0x7fff;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    return result;
  }

  private flushBuffer(): void {
    if (this.totalSamplesBuffered === 0) return;

    const merged = new Int16Array(this.totalSamplesBuffered);
    let offset = 0;
    for (const chunk of this.pcmBuffer) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    this.pcmBuffer = [];
    this.totalSamplesBuffered = 0;

    // Convert Int16Array to base64
    const uint8View = new Uint8Array(merged.buffer, merged.byteOffset, merged.byteLength);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8View.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, Array.from(uint8View.subarray(i, i + chunkSize)));
    }
    const base64 = btoa(binary);

    this.options.onAudioChunk(base64);
  }

  public stop(): void {
    this.isRecording = false;
    this.flushBuffer();

    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }
}
