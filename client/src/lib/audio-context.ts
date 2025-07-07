export class AudioManager {
  private audioContext: AudioContext | null = null;
  private ringTone: HTMLAudioElement | null = null;

  constructor() {
    this.initializeAudioContext();
    this.createRingTone();
  }

  private initializeAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
    }
  }

  private createRingTone() {
    // Create a simple ring tone using Web Audio API
    this.ringTone = new Audio();
    this.ringTone.loop = true;
    this.ringTone.volume = 0.5;
    
    // Generate a simple ring tone
    this.generateRingTone();
  }

  private generateRingTone() {
    if (!this.audioContext) return;

    const duration = 2; // seconds
    const sampleRate = this.audioContext.sampleRate;
    const buffer = this.audioContext.createBuffer(1, duration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);

    // Generate a simple ring tone pattern
    for (let i = 0; i < buffer.length; i++) {
      const time = i / sampleRate;
      const frequency = 440; // A4 note
      const envelope = Math.sin(time * Math.PI * 2) * 0.5; // Envelope
      data[i] = Math.sin(frequency * 2 * Math.PI * time) * envelope * 0.3;
    }

    // Convert buffer to blob URL
    const audioBuffer = buffer;
    const offlineContext = new OfflineAudioContext(1, buffer.length, sampleRate);
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start();

    offlineContext.startRendering().then((renderedBuffer) => {
      const audioBlob = this.bufferToWave(renderedBuffer);
      const url = URL.createObjectURL(audioBlob);
      if (this.ringTone) {
        this.ringTone.src = url;
      }
    });
  }

  private bufferToWave(buffer: AudioBuffer): Blob {
    const length = buffer.length;
    const arrayBuffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(arrayBuffer);

    // Write WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, buffer.sampleRate, true);
    view.setUint32(28, buffer.sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * 2, true);

    // Write PCM data
    const data = buffer.getChannelData(0);
    let offset = 44;
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, data[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  playRingTone() {
    if (this.ringTone) {
      this.ringTone.play().catch(error => {
        console.error('Failed to play ring tone:', error);
      });
    }
  }

  stopRingTone() {
    if (this.ringTone) {
      this.ringTone.pause();
      this.ringTone.currentTime = 0;
    }
  }

  resumeAudioContext() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }
}

export const audioManager = new AudioManager();
