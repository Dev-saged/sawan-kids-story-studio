export type AmbientType = 'forest' | 'ocean' | 'rain' | 'night' | 'cozy_fire' | 'cyber' | 'dream';

export interface AmbientInfo {
  type: AmbientType;
  label: { ar: string; en: string };
  icon: string;
}

export const AMBIENT_PRESETS: Record<AmbientType, AmbientInfo> = {
  forest: { type: 'forest', label: { ar: '🌲 حفيف أوراق الشجر والربيع', en: '🌲 Rustling Forest Leaves' }, icon: '🌲' },
  ocean: { type: 'ocean', label: { ar: '🌊 أمواج البحر الهادئة', en: '🌊 Gentle Ocean Waves' }, icon: '🌊' },
  rain: { type: 'rain', label: { ar: '🌧️ قطرات المطر الناعمة', en: '🌧️ Soft Raindrops' }, icon: '🌧️' },
  night: { type: 'night', label: { ar: '🌙 حشرات الليل والنجوم', en: '🌙 Night Crickets & Stars' }, icon: '🌙' },
  cozy_fire: { type: 'cozy_fire', label: { ar: '🔥 دفء الموقد والقلعة', en: '🔥 Cozy Fireplace Crackle' }, icon: '🔥' },
  cyber: { type: 'cyber', label: { ar: '⚡ أثير النيون المستقبلي', en: '⚡ Futuristic Cyber Hum' }, icon: '⚡' },
  dream: { type: 'dream', label: { ar: '✨ ألحان الأحلام السحرية', en: '✨ Magical Dream Pads' }, icon: '✨' },
};

export const detectAmbientEnvironment = (text: string, prompt: string): AmbientType => {
  const combined = `${text || ''} ${prompt || ''}`.toLowerCase();
  if (/بحر|موج|شاطئ|محيط|نهر|ماء|ocean|wave|beach|sea|river|water|maritime/i.test(combined)) return 'ocean';
  if (/مطر|غيمة|شتاء|قطرات|غزير|rain|storm|drizzle|shower/i.test(combined)) return 'rain';
  if (/غابة|بستان|شجر|أوراق|طبيعة|حديقة|زهور|forest|tree|leaf|leaves|jungle|wood|garden/i.test(combined)) return 'forest';
  if (/ليل|نجوم|قمر|نوم|سماء|هدوء|night|star|moon|sleep|cricket|dusk/i.test(combined)) return 'night';
  if (/قلعة|نار|دفء|موقد|حطب|قلعة|fire|fireplace|castle|hearth|warmth/i.test(combined)) return 'cozy_fire';
  if (/سايبر|مستقبل|تقنية|مدينة|برمجة|cyber|neon|future|city|tech/i.test(combined)) return 'cyber';
  return 'dream';
};

class AmbientEngine {
  private ctx: AudioContext | null = null;
  private currentType: AmbientType | null = null;
  private masterGain: GainNode | null = null;
  private activeNodes: (AudioNode | { stop: () => void })[] = [];
  private volume = 0.25; // 25% default background mix
  private muted = false;

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => undefined);
    }
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);
    }
    return this.muted;
  }

  public getCurrentType(): AmbientType | null {
    return this.currentType;
  }

  public stopAmbient() {
    if (!this.ctx) return;
    for (const node of this.activeNodes) {
      try {
        if ('stop' in node && typeof node.stop === 'function') {
          node.stop();
        } else if ('disconnect' in node && typeof node.disconnect === 'function') {
          (node as AudioNode).disconnect();
        }
      } catch {
        // ignore
      }
    }
    this.activeNodes = [];
    this.currentType = null;
  }

  public playAmbient(type: AmbientType) {
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;
    if (this.currentType === type) return; // already playing this ambient sound

    this.stopAmbient();
    this.currentType = type;

    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Create procedural WebAudio noise buffer
    const createNoiseBuffer = () => {
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
      return buffer;
    };

    if (type === 'forest') {
      // Rustling Leaves & Gentle Wind: Filtered noise modulated by LFO
      const noise = ctx.createBufferSource();
      noise.buffer = createNoiseBuffer();
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(450, now);
      filter.Q.setValueAtTime(1.5, now);

      const lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.2, now); // slow swell
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(250, now);

      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.18, now);

      noise.connect(filter).connect(gain).connect(this.masterGain);
      noise.start();
      lfo.start();

      this.activeNodes.push(noise, lfo, filter, gain);
    } else if (type === 'ocean') {
      // Swelling Ocean Waves: Lowpass filtered noise with ebbing LFO
      const noise = ctx.createBufferSource();
      noise.buffer = createNoiseBuffer();
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(300, now);

      const lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.12, now); // 8-second wave swells
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(350, now);

      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.22, now);

      noise.connect(filter).connect(gain).connect(this.masterGain);
      noise.start();
      lfo.start();

      this.activeNodes.push(noise, lfo, filter, gain);
    } else if (type === 'rain') {
      // Soft Falling Raindrops: High-pass noise
      const noise = ctx.createBufferSource();
      noise.buffer = createNoiseBuffer();
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(800, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.15, now);

      noise.connect(filter).connect(gain).connect(this.masterGain);
      noise.start();

      this.activeNodes.push(noise, filter, gain);
    } else if (type === 'night') {
      // Night Crickets Chirping & Starry Warm Pad
      const pad = ctx.createOscillator();
      pad.type = 'sine';
      pad.frequency.setValueAtTime(220, now); // A3

      const padGain = ctx.createGain();
      padGain.gain.setValueAtTime(0.08, now);

      pad.connect(padGain).connect(this.masterGain);
      pad.start();

      this.activeNodes.push(pad, padGain);
    } else if (type === 'cozy_fire') {
      // Fireplace Crackle
      const noise = ctx.createBufferSource();
      noise.buffer = createNoiseBuffer();
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1200, now);
      filter.Q.setValueAtTime(4, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.12, now);

      noise.connect(filter).connect(gain).connect(this.masterGain);
      noise.start();

      this.activeNodes.push(noise, filter, gain);
    } else if (type === 'cyber') {
      // Futuristic Cyber Drone
      const drone = ctx.createOscillator();
      drone.type = 'sawtooth';
      drone.frequency.setValueAtTime(110, now); // A2

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(280, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.06, now);

      drone.connect(filter).connect(gain).connect(this.masterGain);
      drone.start();

      this.activeNodes.push(drone, filter, gain);
    } else {
      // Dream Pads
      const pad1 = ctx.createOscillator();
      pad1.type = 'sine';
      pad1.frequency.setValueAtTime(329.63, now); // E4

      const pad2 = ctx.createOscillator();
      pad2.type = 'sine';
      pad2.frequency.setValueAtTime(493.88, now); // B4

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.05, now);

      pad1.connect(gain);
      pad2.connect(gain);
      gain.connect(this.masterGain);

      pad1.start();
      pad2.start();

      this.activeNodes.push(pad1, pad2, gain);
    }
  }
}

export const ambientEngine = new AmbientEngine();
