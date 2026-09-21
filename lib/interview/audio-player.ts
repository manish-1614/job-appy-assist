/**
 * Client-side 24kHz Linear PCM audio player with seamless scheduling and barge-in flushing.
 */

export interface AudioPlayerOptions {
  onRms?: (rms: number) => void;
  onPlaybackStateChange?: (isPlaying: boolean) => void;
}

export class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private nextPlayTime: number = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private options: AudioPlayerOptions;
  private animFrameId: number | null = null;
  private isPlaying: boolean = false;

  constructor(options: AudioPlayerOptions = {}) {
    this.options = options;
  }

  private initAudioContext(): void {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass({ sampleRate: 24000 });
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.connect(this.audioContext.destination);
      this.startRmsLoop();
    }
  }

  public enqueueChunk(pcm24Base64: string): void {
    this.initAudioContext();
    if (!this.audioContext || !this.analyser) return;

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }

    // Decode base64 to Int16Array
    const binary = atob(pcm24Base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const int16 = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);

    // Convert Int16 to Float32 AudioBuffer
    const audioBuffer = this.audioContext.createBuffer(1, int16.length, 24000);
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < int16.length; i++) {
      channelData[i] = int16[i] / 32768.0;
    }

    // Schedule playback seamlessly
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.analyser);

    const currentTime = this.audioContext.currentTime;
    if (this.nextPlayTime < currentTime) {
      this.nextPlayTime = currentTime;
    }

    source.start(this.nextPlayTime);
    this.nextPlayTime += audioBuffer.duration;

    this.activeSources.push(source);
    this.setPlaying(true);

    source.onended = () => {
      const idx = this.activeSources.indexOf(source);
      if (idx !== -1) {
        this.activeSources.splice(idx, 1);
      }
      if (this.activeSources.length === 0) {
        this.setPlaying(false);
      }
    };
  }

  /**
   * Barge-in interruption: stops all scheduled audio immediately.
   */
  public stopAndFlush(): void {
    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch {}
    }
    this.activeSources = [];
    if (this.audioContext) {
      this.nextPlayTime = this.audioContext.currentTime;
    }
    this.setPlaying(false);
  }

  private setPlaying(playing: boolean): void {
    if (this.isPlaying !== playing) {
      this.isPlaying = playing;
      this.options.onPlaybackStateChange?.(playing);
    }
  }

  private startRmsLoop(): void {
    const dataArray = new Uint8Array(this.analyser?.frequencyBinCount || 128);

    const checkRms = () => {
      if (this.analyser && this.isPlaying) {
        this.analyser.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const val = (dataArray[i] - 128) / 128;
          sum += val * val;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        this.options.onRms?.(rms);
      } else {
        this.options.onRms?.(0);
      }
      this.animFrameId = requestAnimationFrame(checkRms);
    };

    this.animFrameId = requestAnimationFrame(checkRms);
  }

  public close(): void {
    this.stopAndFlush();
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }
}
