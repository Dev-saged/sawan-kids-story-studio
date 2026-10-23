import { NarratorVoice, StoryData, VeoMotionMode } from '../types';
import { srcToBlob } from './media';
import { applyHollowWatermarkToBlob } from './watermark';
import { getPageAudio, getStoryMusic, isArabicStory } from './narration';
import { bitrateFor, getFormat, maxQuality, videoSize, VIDEO_QUALITIES, type VideoFormatId, type VideoQualityId } from './videoFormats';

export interface VideoOptions {
  format: VideoFormatId;
  quality: VideoQualityId;
  withMusic: boolean;
  voice: NarratorVoice;
  veoMotionMode?: VeoMotionMode;
  brand: string;
  tagline?: string;
  // مقاطع متحركة مولّدة بالذكاء الاصطناعي لكل صفحة (صوتها مُهمل دائماً؛ الصوت من الراوي فقط)
  clips?: Map<number, Blob[]>;
}

export interface VideoResult {
  quality: VideoQualityId;
  width: number;
  height: number;
  blob: Blob;
  ext: 'mp4' | 'webm';
  musicFailed: boolean;
}

type Progress = (ratio: number, message: string) => void;

const FPS = 30;
const SR = 44100;
const TRANSITION = 0.9;
const COVER_DUR = 4.5;
const END_DUR = 5;
const LANTERN = '#ffc94a';
const DUSK = '#140f28';

// مقطع/مقاطع متحركة لصفحة: تُعرض بالتتابع ثم يثبت آخر إطار إن انتهت قبل الراوي
export interface ClipPlayer {
  items: { el: HTMLVideoElement; url: string; dur: number }[];
  total: number;
  active: HTMLVideoElement | null;
}

const waitEvent = (el: HTMLVideoElement, ok: string, ms: number): Promise<boolean> =>
  new Promise((resolve) => {
    const done = (v: boolean) => {
      clearTimeout(t);
      el.removeEventListener(ok, onOk);
      el.removeEventListener('error', onErr);
      resolve(v);
    };
    const onOk = () => done(true);
    const onErr = () => done(false);
    const t = setTimeout(() => done(false), ms);
    el.addEventListener(ok, onOk);
    el.addEventListener('error', onErr);
  });

export const loadClipPlayer = async (blobs: Blob[]): Promise<ClipPlayer | undefined> => {
  const items: ClipPlayer['items'] = [];
  for (const blob of blobs) {
    const url = URL.createObjectURL(blob);
    const el = document.createElement('video');
    el.muted = true;
    el.playsInline = true;
    el.preload = 'auto';
    el.src = url;
    const ok = await waitEvent(el, 'loadeddata', 15000);
    if (ok && Number.isFinite(el.duration) && el.duration > 0.3 && el.videoWidth > 0) items.push({ el, url, dur: el.duration });
    else URL.revokeObjectURL(url);
  }
  return items.length ? { items, total: items.reduce((a, b) => a + b.dur, 0), active: null } : undefined;
};

// يضع المقطع على الزمن المحلي المطلوب (يتنقل بين المقاطع المتتابعة ويثبت على آخر إطار بعد نهايتها)
export const seekClip = async (player: ClipPlayer, localTime: number): Promise<void> => {
  let local = localTime;
  let target = player.items[player.items.length - 1];
  let at = Math.max(0, target.dur - 0.05);
  if (local < player.total) {
    for (const it of player.items) {
      if (local < it.dur) {
        target = it;
        at = local;
        break;
      }
      local -= it.dur;
    }
  }
  if (Math.abs(target.el.currentTime - at) > 0.001) {
    target.el.currentTime = at;
    await waitEvent(target.el, 'seeked', 2500);
  }
  player.active = target.el;
};

export const disposeClipPlayer = (p?: ClipPlayer) => {
  p?.items.forEach((i) => {
    i.el.removeAttribute('src');
    i.el.load();
    URL.revokeObjectURL(i.url);
  });
};

export interface Segment {
  kind: 'cover' | 'page' | 'end';
  start: number;
  dur: number;
  image: ImageBitmap | null;
  words: string[];
  audio?: AudioBuffer;
  voiceStart: number;
  dir: number;
  clip?: ClipPlayer;
}

const ease = (x: number) => 1 - Math.pow(1 - Math.min(Math.max(x, 0), 1), 3);
const easeInOut = (x: number) => {
  const t = Math.min(Math.max(x, 0), 1);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

// الصورة تُصغَّر لما يحتاجه الإطار وتدعم SVG والصور النقطية بكفاءة
const loadBitmap = async (src: string | undefined, W: number, H: number): Promise<ImageBitmap | null> => {
  if (!src) return null;
  try {
    const rawBlob = await srcToBlob(src);
    const blob = rawBlob.type.includes('svg') ? rawBlob : await applyHollowWatermarkToBlob(rawBlob);
    let full: ImageBitmap;
    if (blob.type.includes('svg') || src.includes('image/svg') || src.startsWith('PHN2') || src.startsWith('PD94')) {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.src = url;
      await img.decode();
      URL.revokeObjectURL(url);
      full = await createImageBitmap(img);
    } else {
      full = await createImageBitmap(blob);
    }
    const need = Math.max(W / full.width, H / full.height) * 1.25;
    if (need >= 0.9) return full;
    const small = await createImageBitmap(full, { resizeWidth: Math.ceil(full.width * need), resizeHeight: Math.ceil(full.height * need), resizeQuality: 'medium' });
    full.close();
    return small;
  } catch {
    return null;
  }
};

const decode = async (ctx: BaseAudioContext, blob: Blob): Promise<AudioBuffer> => ctx.decodeAudioData(await blob.arrayBuffer());

// توقيت الكلمات داخل مقطع الصوت (نفس منطق القارئ)
const timingsFor = (words: string[], duration: number) => {
  const weights = words.map((w) => w.length + 1.5 + (/[.!?؟،,؛;:…]$/.test(w) ? 3 : 0));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const lead = 0.18;
  const span = Math.max(0.5, duration - lead - 0.3);
  let t = lead;
  return weights.map((w) => {
    const d = (w / total) * span;
    const r = { start: t, end: t + d };
    t += d;
    return r;
  });
};

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private particles: { x: number; y: number; r: number; s: number; p: number }[];
  private timings = new Map<Segment, { start: number; end: number }[]>();
  private buffers: CanvasRenderingContext2D[];

  constructor(
    private canvas: HTMLCanvasElement,
    private segments: Segment[],
    private story: StoryData,
    private rtl: boolean,
    private brand: string,
    private design: { w: number; h: number },
    private tagline = '',
    private veoMotionMode: VeoMotionMode = 'cinematic-pack'
  ) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.buffers = [0, 1].map(() => {
      const c = document.createElement('canvas');
      c.width = canvas.width;
      c.height = canvas.height;
      return c.getContext('2d')!;
    });
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    this.particles = Array.from({ length: 46 }, () => ({ x: rnd(), y: rnd(), r: 1 + rnd() * 3.2, s: 0.015 + rnd() * 0.035, p: rnd() * Math.PI * 2 }));
    for (const seg of segments) if (seg.audio) this.timings.set(seg, timingsFor(seg.words, seg.audio.duration));
  }

  // كل الرسم بإحداثيات مساحة التصميم ثم يُكبَّر لدقة الإخراج
  private get W() {
    return this.design.w;
  }
  private get H() {
    return this.design.h;
  }
  private get scale() {
    return this.canvas.width / this.design.w;
  }
  private get portrait() {
    return this.H > this.W;
  }
  private font(size: number, weight = 700, display = false) {
    const fam = this.rtl ? (display ? "'Baloo Bhaijaan 2', 'Cairo'" : "'Cairo', 'Baloo Bhaijaan 2'") : display ? "'Fredoka', 'Nunito'" : "'Nunito', 'Fredoka'";
    return `${weight} ${size}px ${fam}, sans-serif`;
  }

  // صورة بحركة كاميرا Veo 3 مع اختيار المود السينمائي والموشن
  private drawImage(seg: Segment, local: number, extraScale = 1) {
    const { ctx, W, H } = this;
    const live = seg.clip?.active;
    if (live && live.videoWidth > 0) {
      const base = Math.max(W / live.videoWidth, H / live.videoHeight) * extraScale;
      const w = live.videoWidth * base;
      const h = live.videoHeight * base;
      ctx.drawImage(live, (W - w) / 2, (H - h) / 2, w, h);
      return;
    }
    if (!seg.image) {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#2a1f4f');
      g.addColorStop(1, DUSK);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      return;
    }
    const img = seg.image;
    const p = easeInOut(local / (seg.dur + TRANSITION));
    const zoomIn = seg.dir > 0;
    let mode = this.veoMotionMode;
    if (mode === 'auto-composite') {
      const idx = this.segments.indexOf(seg);
      mode = idx % 3 === 0 ? 'cinematic-pack' : idx % 3 === 1 ? 'parallax-script' : 'sweeps-3d';
    }

    if (mode === 'parallax-script') {
      // مود 2: حركة ديناميكية ثنائية الأبعاد ونصف مع تأثير المنظر ثلاثي الأبعاد (2.5D Parallax)
      const scale = (zoomIn ? 1.08 + 0.18 * p : 1.25 - 0.18 * p) * extraScale;
      const base = Math.max(W / img.width, H / img.height);
      const w = img.width * base * scale;
      const h = img.height * base * scale;
      const panX = Math.sin(local * 1.8) * (W * 0.02) + (seg.dir * (p - 0.5) * W * 0.08);
      const panY = Math.cos(local * 1.4) * (H * 0.02) + ((zoomIn ? -1 : 1) * (p - 0.5) * H * 0.05);
      const tilt = Math.sin(local * 2.1) * 0.012;

      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate(tilt);
      ctx.drawImage(img, -w / 2 + panX, -h / 2 + panY, w, h);
      ctx.restore();
    } else if (this.veoMotionMode === 'sweeps-3d') {
      // مود 3: مسح ثلاثي الأبعاد متعدد الزوايا للكاميرا (Multi-Angle 3D Sweeps)
      const sweepAngle = Math.sin(p * Math.PI) * 0.025 * (seg.dir || 1);
      const scale = (1.12 + 0.15 * Math.sin(p * Math.PI)) * extraScale;
      const base = Math.max(W / img.width, H / img.height);
      const w = img.width * base * scale;
      const h = img.height * base * scale;
      const panX = Math.cos(p * Math.PI) * (W * 0.06);
      const panY = Math.sin(p * Math.PI * 0.5) * (H * 0.04);

      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate(sweepAngle);
      ctx.drawImage(img, -w / 2 + panX, -h / 2 + panY, w, h);
      ctx.restore();
    } else {
      // مود 1 (مُستَحسَن): مجموعة كاملة من المؤثرات السينمائية مع تحريك الكاميرا وعمقها
      const scale = (zoomIn ? 1.05 + 0.13 * p : 1.18 - 0.13 * p) * extraScale;
      const base = Math.max(W / img.width, H / img.height);
      const w = img.width * base * scale;
      const h = img.height * base * scale;
      const breath = Math.sin(local * 2.3) * (H * 0.005);
      const sway = Math.sin(local * 1.5) * (W * 0.004);
      const tilt = Math.sin(local * 1.6) * 0.005;
      const panX = seg.dir * (p - 0.5) * W * 0.05 + sway;
      const panY = (zoomIn ? -1 : 1) * (p - 0.5) * H * 0.03 + breath;

      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate(tilt);
      ctx.drawImage(img, -w / 2 + panX, -h / 2 + panY, w, h);
      ctx.restore();
    }
  }

  private overlay(strength: number) {
    const { ctx, W, H } = this;
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, `rgba(8,5,20,${0.55 * strength})`);
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
    const b = ctx.createLinearGradient(0, H * 0.45, 0, H);
    b.addColorStop(0, 'rgba(10,6,24,0)');
    b.addColorStop(1, `rgba(10,6,24,${0.78 * strength})`);
    ctx.fillStyle = b;
    ctx.fillRect(0, H * 0.45, W, H * 0.55);
  }

  private dust(t: number, intensity = 1) {
    const { ctx, W, H } = this;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const pt of this.particles) {
      const y = ((pt.y - t * pt.s) % 1 + 1) % 1;
      const x = pt.x + Math.sin(t * 0.6 + pt.p) * 0.015;
      const a = (0.25 + 0.35 * Math.sin(t * 2 + pt.p * 3) ** 2) * intensity;
      const g = ctx.createRadialGradient(x * W, y * H, 0, x * W, y * H, pt.r * 4);
      g.addColorStop(0, `rgba(255,224,150,${a})`);
      g.addColorStop(1, 'rgba(255,224,150,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x * W - pt.r * 4, y * H - pt.r * 4, pt.r * 8, pt.r * 8);
    }
    ctx.restore();
  }

  private wrap(words: string[], maxWidth: number): string[][] {
    const { ctx } = this;
    const space = ctx.measureText(' ').width;
    const lines: string[][] = [];
    let line: string[] = [];
    let width = 0;
    for (const w of words) {
      const ww = ctx.measureText(w).width;
      if (line.length && width + space + ww > maxWidth) {
        lines.push(line);
        line = [];
        width = 0;
      }
      width += (line.length ? space : 0) + ww;
      line.push(w);
    }
    if (line.length) lines.push(line);
    return lines;
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // شريط الترجمة السينمائي سطر بسطر متوافق مع الصوت مع تظليل الكلمة النشطة
  private caption(seg: Segment, local: number, alpha: number) {
    const { ctx, W, H, portrait } = this;
    const size = portrait ? 38 : 32;
    ctx.font = this.font(size, 700);
    const padX = portrait ? 32 : 44;
    const maxTextW = W - (portrait ? 48 : 100);
    const lines = this.wrap(seg.words, maxTextW - padX * 2);
    if (!lines.length) return;

    const lh = size * 1.55;
    const tm = this.timings.get(seg);
    const vt = local - seg.voiceStart;
    let active = -1;
    if (tm) for (let i = 0; i < tm.length; i++) if (vt >= tm[i].start) active = i;

    let wi = 0;
    const lineStart = lines.map((l) => {
      const s = wi;
      wi += l.length;
      return s;
    });

    // سطر واحد فقط يظهر في كل لحظة بناءً على مكان القراءة
    let currentLineIdx = 0;
    for (let i = 0; i < lines.length; i++) {
      if (active >= lineStart[i]) {
        currentLineIdx = i;
      }
    }
    const currentLine = lines[currentLineIdx] || lines[0];
    const space = ctx.measureText(' ').width;
    const widths = currentLine.map((w) => ctx.measureText(w).width);
    const lineTextWidth = widths.reduce((a, b) => a + b, 0) + space * (currentLine.length - 1);
    const pillW = Math.min(W - 40, Math.max(260, lineTextWidth + padX * 2));
    const pillH = lh + 22;
    const x0 = (W - pillW) / 2;
    const rise = (1 - ease(local / 0.7)) * 20;
    const y0 = H - pillH - (portrait ? 140 : 42) + rise + Math.sin(local * 1.2) * 1.5;

    ctx.save();
    ctx.globalAlpha = alpha;
    this.roundRect(x0, y0, pillW, pillH, 20);
    ctx.fillStyle = 'rgba(14, 9, 32, 0.72)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 201, 74, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.direction = this.rtl ? 'rtl' : 'ltr';

    let x = this.rtl ? W / 2 + lineTextWidth / 2 : W / 2 - lineTextWidth / 2;
    const y = y0 + pillH / 2;

    currentLine.forEach((w, k) => {
      const idx = lineStart[currentLineIdx] + k;
      const ww = widths[k];
      const left = this.rtl ? x - ww : x;
      ctx.save();
      if (idx === active) {
        const pop = 1 + 0.1 * Math.max(0, 1 - (vt - (tm?.[idx]?.start ?? 0)) / 0.25);
        ctx.translate(left + ww / 2, y);
        ctx.scale(pop, pop);
        ctx.translate(-(left + ww / 2), -y);
        ctx.shadowColor = 'rgba(255, 201, 74, 0.9)';
        ctx.shadowBlur = 18;
        ctx.fillStyle = LANTERN;
      } else {
        ctx.fillStyle = idx < active ? '#ffffff' : 'rgba(255, 255, 255, 0.6)';
      }
      ctx.fillText(w, left, y);
      ctx.restore();
      x += this.rtl ? -(ww + space) : ww + space;
    });

    ctx.restore();
  }

  private badge(seg: Segment, index: number, alpha: number) {
    const { ctx, W, portrait } = this;
    const total = this.segments.filter((s) => s.kind === 'page').length;
    ctx.save();
    ctx.globalAlpha = alpha * 0.9;
    ctx.font = this.font(portrait ? 24 : 22, 700);
    const label = `${index} / ${total}`;
    const w = ctx.measureText(label).width + 36;
    const x = this.rtl ? 32 : W - w - 32;
    this.roundRect(x, 30, w, 44, 22);
    ctx.fillStyle = 'rgba(18,12,38,0.55)';
    ctx.fill();
    ctx.fillStyle = LANTERN;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2, 52);
    ctx.font = this.font(portrait ? 22 : 20, 600);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.textAlign = this.rtl ? 'right' : 'left';
    ctx.direction = this.rtl ? 'rtl' : 'ltr';
    ctx.fillText(this.story.story_info.title, this.rtl ? W - 36 : 36, 52, W * 0.6);
    ctx.restore();
    void seg;
  }

  // كلمات تظهر واحدة تلو الأخرى بارتفاع وتوهج
  private animatedTitle(text: string, local: number, cy: number, size: number, delay = 0.35) {
    const { ctx, W } = this;
    ctx.font = this.font(size, 800, true);
    const lines = this.wrap(text.split(/\s+/).filter(Boolean), W * 0.84);
    const lh = size * 1.25;
    let n = 0;
    ctx.save();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.direction = this.rtl ? 'rtl' : 'ltr';
    const space = ctx.measureText(' ').width;
    lines.forEach((line, li) => {
      const widths = line.map((w) => ctx.measureText(w).width);
      const total = widths.reduce((a, b) => a + b, 0) + space * (line.length - 1);
      let x = this.rtl ? W / 2 + total / 2 : W / 2 - total / 2;
      const y = cy + (li - (lines.length - 1) / 2) * lh;
      line.forEach((w, k) => {
        const p = ease((local - delay - n * 0.16) / 0.55);
        n++;
        const left = this.rtl ? x - widths[k] : x;
        ctx.globalAlpha = p;
        ctx.shadowColor = 'rgba(255,190,80,0.9)';
        ctx.shadowBlur = 26 * p;
        ctx.fillStyle = '#fff8e6';
        ctx.fillText(w, left, y + (1 - p) * 26);
        x += this.rtl ? -(widths[k] + space) : widths[k] + space;
      });
    });
    ctx.restore();
  }

  private brandMark(alpha: number, y: number) {
    const { ctx, W, portrait } = this;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = this.font(portrait ? 26 : 22, 700, true);
    ctx.fillStyle = LANTERN;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = this.rtl ? 'rtl' : 'ltr';
    ctx.fillText(this.brand, W / 2, y);
    ctx.restore();
  }

  private drawSegment(seg: Segment, local: number, alpha = 1, mode: 'normal' | 'zoomOut' = 'normal') {
    const { ctx, W, H, portrait } = this;
    const extra = mode === 'zoomOut' ? 1 + 0.12 * ease(local) : 1;
    this.drawImage(seg, local, extra);
    if (seg.kind === 'cover') {
      this.overlay(1.1);
      this.dust(local, 1.2);
      const glow = ease(local / 1.2);
      ctx.save();
      ctx.globalAlpha = 0.35 * glow;
      const g = ctx.createRadialGradient(W / 2, H * 0.72, 0, W / 2, H * 0.72, W * 0.5);
      g.addColorStop(0, 'rgba(255,190,90,0.6)');
      g.addColorStop(1, 'rgba(255,190,90,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      this.animatedTitle(this.story.story_info.title, local, H * (portrait ? 0.7 : 0.68), portrait ? 76 : 70);
      this.brandMark(ease((local - 1.8) / 0.8) * alpha, H - (portrait ? 110 : 52));
    } else if (seg.kind === 'page') {
      this.overlay(0.9);
      this.dust(local + seg.start, 0.7);
      const idx = this.segments.indexOf(seg);
      this.badge(seg, idx, ease(local / 0.8));
      this.caption(seg, local, ease((local - 0.15) / 0.6));
    } else {
      ctx.fillStyle = `rgba(10,6,24,${0.55 + 0.25 * ease(local / 1.5)})`;
      ctx.fillRect(0, 0, W, H);
      this.dust(local, 1.4);
      this.animatedTitle(this.rtl ? 'النهاية' : 'The End', local, H * (this.story.story_info.moral ? 0.4 : 0.48), portrait ? 104 : 96, 0.2);
      const moral = this.story.story_info.moral;
      if (moral) {
        ctx.save();
        const p = ease((local - 1.2) / 0.8);
        ctx.globalAlpha = p;
        ctx.font = this.font(portrait ? 38 : 32, 600);
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.direction = this.rtl ? 'rtl' : 'ltr';
        const lines = this.wrap(moral.split(/\s+/), W * 0.8);
        lines.forEach((l, i) => ctx.fillText(l.join(' '), W / 2, H * 0.56 + i * (portrait ? 56 : 48) + (1 - p) * 16));
        ctx.restore();
      }
      this.brandMark(ease((local - 2) / 0.8), H - (portrait ? 170 : 96));
      if (this.tagline) {
        ctx.save();
        ctx.globalAlpha = ease((local - 2.4) / 0.8) * 0.9;
        ctx.font = this.font(portrait ? 24 : 20, 700);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.direction = this.rtl ? 'rtl' : 'ltr';
        ctx.fillText(this.tagline, W / 2, H - (portrait ? 120 : 56));
        ctx.restore();
      }
    }
  }

  // رسم مشهد في طبقة مستقلة حتى تعمل الشفافية والقص في الانتقالات بدقة
  private layer(n: number, seg: Segment, local: number, mode: 'normal' | 'zoomOut' = 'normal'): HTMLCanvasElement {
    const main = this.ctx;
    const buf = this.buffers[n];
    this.ctx = buf;
    buf.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    buf.globalAlpha = 1;
    buf.fillStyle = DUSK;
    buf.fillRect(0, 0, this.W, this.H);
    this.drawSegment(seg, local, 1, mode);
    this.ctx = main;
    return buf.canvas;
  }

  // يوقف المقاطع المتحركة (مسار التسجيل اللحظي لا يستطيع القفز بين الإطارات)
  disableClips() {
    this.segments.forEach((s) => {
      if (s.clip) s.clip.active = null;
    });
  }

  // يضبط إطار كل مقطع متحرك ظاهر عند الزمن t (التصدير غير اللحظي فقط)؛ يُستدعى قبل frame
  async prepare(t: number): Promise<void> {
    let i = this.segments.findIndex((s) => t < s.start + s.dur);
    if (i < 0) i = this.segments.length - 1;
    const involved = [this.segments[i]];
    if (this.segments[i - 1] && t - this.segments[i].start < TRANSITION) involved.push(this.segments[i - 1]);
    for (const seg of involved) {
      if (seg.clip) await seekClip(seg.clip, Math.max(0, t - seg.start));
    }
  }

  frame(t: number) {
    const { ctx, W, H } = this;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.globalAlpha = 1;
    let i = this.segments.findIndex((s) => t < s.start + s.dur);
    if (i < 0) i = this.segments.length - 1;
    const cur = this.segments[i];
    const local = t - cur.start;
    const prev = this.segments[i - 1];

    if (prev && local < TRANSITION) {
      const p = easeInOut(local / TRANSITION);
      const prevLocal = t - prev.start;
      const kind = i % 4;
      const b = this.layer(1, cur, local);
      if (kind === 3) {
        // تكبير مع تلاشٍ
        const a = this.layer(0, prev, prevLocal, 'zoomOut');
        ctx.drawImage(a, 0, 0, W, H);
        ctx.globalAlpha = p;
        ctx.drawImage(b, 0, 0, W, H);
      } else if (kind === 1) {
        // انزلاق
        const a = this.layer(0, prev, prevLocal);
        const dx = (this.rtl ? -1 : 1) * W * (1 - p);
        ctx.fillStyle = DUSK;
        ctx.fillRect(0, 0, W, H);
        ctx.drawImage(a, -dx * 0.35, 0, W, H);
        ctx.globalAlpha = 0.4 + 0.6 * p;
        ctx.drawImage(b, dx, 0, W, H);
      } else if (kind === 2) {
        // كشف دائري بحافة مضيئة
        const a = this.layer(0, prev, prevLocal);
        const r = Math.hypot(W, H) * 0.5 * p;
        ctx.drawImage(a, 0, 0, W, H);
        ctx.save();
        ctx.beginPath();
        ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(b, 0, 0, W, H);
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = (1 - p) * 0.8;
        ctx.strokeStyle = LANTERN;
        ctx.lineWidth = 6;
        ctx.shadowColor = LANTERN;
        ctx.shadowBlur = 24;
        ctx.beginPath();
        ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else {
        // تلاشٍ متداخل
        const a = this.layer(0, prev, prevLocal);
        ctx.drawImage(a, 0, 0, W, H);
        ctx.globalAlpha = p;
        ctx.drawImage(b, 0, 0, W, H);
      }
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = DUSK;
      ctx.fillRect(0, 0, W, H);
      this.drawSegment(cur, local);
    }

    const total = this.segments[this.segments.length - 1];
    const end = total.start + total.dur;
    const fade = Math.max(ease(1 - t / 0.6), ease((t - (end - 0.8)) / 0.8));
    if (fade > 0) {
      ctx.fillStyle = `rgba(0,0,0,${fade})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
}

// بناء مقطع صوتي احتياطي صامت بمدة القراءة الطبيعية في حال تعذر جلب صوت الراوي أو العمل بدون اتصال
const createFallbackPageAudio = (actx: BaseAudioContext, wordsCount: number): AudioBuffer => {
  const durationSec = Math.min(14, Math.max(3.8, wordsCount * 0.45));
  const length = Math.ceil(durationSec * SR);
  const buf = actx.createBuffer(2, length, SR);
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  const chimeLen = Math.min(length, Math.floor(SR * 0.7));
  for (let i = 0; i < chimeLen; i++) {
    const t = i / SR;
    const env = Math.exp(-t * 6) * Math.min(1, t / 0.015) * 0.06;
    const s = env * (Math.sin(2 * Math.PI * 523.25 * t) + 0.5 * Math.sin(2 * Math.PI * 659.25 * t));
    L[i] = s;
    R[i] = s;
  }
  return buf;
};

const buildSegments = async (story: StoryData, voice: NarratorVoice, actx: BaseAudioContext, size: { w: number; h: number }, onProgress: Progress, signal: AbortSignal, clips?: Map<number, Blob[]>): Promise<Segment[]> => {
  const segs: Segment[] = [];
  const cover = await loadBitmap(story.coverImage || story.pages[0]?.generatedImage, size.w, size.h);
  segs.push({ kind: 'cover', start: 0, dur: COVER_DUR, image: cover, words: [], voiceStart: 0, dir: 1 });
  let t = COVER_DUR;
  let lastImage = cover;
  for (let i = 0; i < story.pages.length; i++) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const page = story.pages[i];
    const words = page.text.split(/\s+/).filter(Boolean);
    onProgress(0.05 + (i / story.pages.length) * 0.4, `${i + 1}/${story.pages.length}`);
    let audio: AudioBuffer;
    try {
      let blob: Blob;
      try {
        blob = await getPageAudio(story.id, page, voice, signal);
      } catch (firstErr) {
        if ((firstErr as Error).name === 'AbortError' || signal.aborted) throw firstErr;
        await new Promise((r) => setTimeout(r, 1500));
        blob = await getPageAudio(story.id, page, voice, signal);
      }
      audio = await decode(actx, blob);
    } catch (err) {
      if ((err as Error).name === 'AbortError' || signal.aborted) throw new DOMException('Aborted', 'AbortError');
      audio = createFallbackPageAudio(actx, words.length);
    }
    const image = (await loadBitmap(page.generatedImage, size.w, size.h)) ?? lastImage;
    lastImage = image;
    const voiceStart = TRANSITION * 0.7;
    const dur = voiceStart + audio.duration + 0.9;
    const clip = clips?.get(page.page)?.length ? await loadClipPlayer(clips.get(page.page)!) : undefined;
    segs.push({ kind: 'page', start: t, dur, image, words, audio, voiceStart, dir: i % 2 ? -1 : 1, clip });
    t += dur;
  }
  segs.push({ kind: 'end', start: t, dur: END_DUR, image: lastImage, words: [], voiceStart: 0, dir: -1 });
  return segs;
};

// توليد موسيقى تصويرية دافئة وهادئة عبر WebAudio كاحتياط موثوق عند غياب موسيقى السيرفر
const createProceduralLullaby = async (durationSec: number, sr = SR): Promise<AudioBuffer> => {
  const off = new OfflineAudioContext(2, Math.ceil(durationSec * sr), sr);
  const notes = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99];
  const melody = [
    { n: 2, t: 0.0, d: 1.2 }, { n: 4, t: 0.8, d: 1.2 }, { n: 5, t: 1.6, d: 1.5 }, { n: 4, t: 2.6, d: 1.0 },
    { n: 3, t: 3.4, d: 1.4 }, { n: 1, t: 4.4, d: 1.2 }, { n: 2, t: 5.2, d: 2.2 },
    { n: 5, t: 7.0, d: 1.2 }, { n: 6, t: 7.8, d: 1.2 }, { n: 7, t: 8.6, d: 1.6 }, { n: 5, t: 9.8, d: 1.2 },
    { n: 4, t: 10.8, d: 1.5 }, { n: 2, t: 12.0, d: 1.2 }, { n: 0, t: 13.0, d: 2.8 },
  ];
  const loopLen = 16.0;
  const loops = Math.ceil(durationSec / loopLen);

  for (let l = 0; l < loops; l++) {
    const baseT = l * loopLen;
    // تناغم خلفي دافئ (Warm Ambient Pad)
    const padChordFreqs = l % 2 === 0 ? [130.81, 164.81, 196.0] : [110.0, 130.81, 174.61];
    for (const f of padChordFreqs) {
      const osc = off.createOscillator();
      const g = off.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, baseT);
      g.gain.setValueAtTime(0, baseT);
      g.gain.linearRampToValueAtTime(0.04, baseT + 1.5);
      g.gain.setValueAtTime(0.04, Math.min(durationSec, baseT + loopLen - 1.5));
      g.gain.linearRampToValueAtTime(0, Math.min(durationSec, baseT + loopLen));
      osc.connect(g).connect(off.destination);
      osc.start(baseT);
      osc.stop(Math.min(durationSec, baseT + loopLen));
    }
    // نغمات صندوق الموسيقى الحالم (Music Box Bell)
    for (const m of melody) {
      const t = baseT + m.t;
      if (t >= durationSec) continue;
      const freq = notes[m.n % notes.length];
      const osc = off.createOscillator();
      const g = off.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      const osc2 = off.createOscillator();
      const g2 = off.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq * 2, t);

      const dur = m.d;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      g2.gain.setValueAtTime(0, t);
      g2.gain.linearRampToValueAtTime(0.04, t + 0.01);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.7);

      osc.connect(g).connect(off.destination);
      osc2.connect(g2).connect(off.destination);
      osc.start(t);
      osc.stop(t + dur);
      osc2.start(t);
      osc2.stop(t + dur);
    }
  }
  return off.startRendering();
};

// خلط الراوي والموسيقى مع خفض الموسيقى تحت الصوت
const mixAudio = async (segs: Segment[], music: AudioBuffer | null): Promise<AudioBuffer> => {
  const end = segs[segs.length - 1].start + segs[segs.length - 1].dur;
  const off = new OfflineAudioContext(2, Math.ceil(end * SR), SR);
  for (const s of segs) {
    if (!s.audio) continue;
    const src = off.createBufferSource();
    src.buffer = s.audio;
    src.connect(off.destination);
    src.start(s.start + s.voiceStart);
  }
  if (music) {
    const src = off.createBufferSource();
    src.buffer = music;
    src.loop = true;
    const g = off.createGain();
    const firstVoice = segs[1] ? segs[1].start + segs[1].voiceStart : COVER_DUR;
    const last = segs[segs.length - 1];
    g.gain.setValueAtTime(0, 0);
    g.gain.linearRampToValueAtTime(0.5, 1.2);
    g.gain.setValueAtTime(0.5, Math.max(1.3, firstVoice - 0.8));
    g.gain.linearRampToValueAtTime(0.13, firstVoice);
    g.gain.setValueAtTime(0.13, last.start);
    g.gain.linearRampToValueAtTime(0.45, last.start + 1);
    g.gain.setValueAtTime(0.45, end - 1.8);
    g.gain.linearRampToValueAtTime(0, end);
    src.connect(g).connect(off.destination);
    src.start(0);
  }
  return off.startRendering();
};

const canEncodeMp4 = async (w: number, h: number, bitrate: number): Promise<string | null> => {
  if (typeof VideoEncoder === 'undefined' || typeof AudioEncoder === 'undefined') return null;
  try {
    const a = await AudioEncoder.isConfigSupported({ codec: 'mp4a.40.2', numberOfChannels: 2, sampleRate: SR, bitrate: 128000 });
    if (!a.supported) return null;
    for (const codec of ['avc1.4d0028', 'avc1.42e028', 'avc1.42001f']) {
      const v = await VideoEncoder.isConfigSupported({ codec, width: w, height: h, bitrate, framerate: FPS });
      if (v.supported) return codec;
    }
  } catch {
    // ignore
  }
  return null;
};

const encodeMp4 = async (renderer: Renderer, canvas: HTMLCanvasElement, audio: AudioBuffer, duration: number, codec: string, bitrate: number, onProgress: Progress, signal: AbortSignal, ar: boolean): Promise<Blob> => {
  const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: canvas.width, height: canvas.height, frameRate: FPS },
    audio: { codec: 'aac', numberOfChannels: 2, sampleRate: SR },
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  });
  let failure: Error | null = null;
  const ve = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: (e) => (failure = e) });
  ve.configure({ codec, width: canvas.width, height: canvas.height, bitrate, framerate: FPS });
  const ae = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: (e) => (failure = e) });
  ae.configure({ codec: 'mp4a.40.2', numberOfChannels: 2, sampleRate: SR, bitrate: 128000 });

  const L = audio.getChannelData(0);
  const R = audio.numberOfChannels > 1 ? audio.getChannelData(1) : L;
  const block = SR;
  for (let s = 0; s < audio.length; s += block) {
    const n = Math.min(block, audio.length - s);
    const data = new Float32Array(n * 2);
    data.set(L.subarray(s, s + n), 0);
    data.set(R.subarray(s, s + n), n);
    const ad = new AudioData({ format: 'f32-planar', sampleRate: SR, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((s / SR) * 1e6), data });
    ae.encode(ad);
    ad.close();
  }

  const frames = Math.ceil(duration * FPS);
  for (let i = 0; i < frames; i++) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    if (failure) throw failure;
    await renderer.prepare(i / FPS);
    renderer.frame(i / FPS);
    const vf = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / FPS), duration: Math.round(1e6 / FPS) });
    ve.encode(vf, { keyFrame: i % (FPS * 2) === 0 });
    vf.close();
    while (ve.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 4));
    if (i % 15 === 0) {
      onProgress(0.55 + (i / frames) * 0.43, ar ? `تصيير ${Math.round((i / frames) * 100)}%` : `Rendering ${Math.round((i / frames) * 100)}%`);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  await ve.flush();
  await ae.flush();
  if (failure) throw failure;
  muxer.finalize();
  return new Blob([muxer.target.buffer], { type: 'video/mp4' });
};

// تسجيل لحظي احتياطي للأجهزة بدون WebCodecs
const recordRealtime = async (renderer: Renderer, canvas: HTMLCanvasElement, audio: AudioBuffer, duration: number, bitrate: number, onProgress: Progress, signal: AbortSignal, ar: boolean): Promise<{ blob: Blob; ext: 'mp4' | 'webm' }> => {
  const mime = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m));
  if (!mime) throw new Error(ar ? 'هذا الجهاز لا يدعم تصدير الفيديو.' : 'This device cannot export video.');
  const actx = new AudioContext({ sampleRate: SR });
  const dest = actx.createMediaStreamDestination();
  const src = actx.createBufferSource();
  src.buffer = audio;
  src.connect(dest);
  const stream = new MediaStream([...canvas.captureStream(FPS).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((r) => (rec.onstop = () => r()));
  renderer.frame(0);
  rec.start(1000);
  const t0 = actx.currentTime + 0.05;
  src.start(t0);
  await new Promise<void>((resolve) => {
    const loop = () => {
      const t = actx.currentTime - t0;
      if (signal.aborted || t >= duration) return resolve();
      renderer.frame(Math.max(0, t));
      onProgress(0.55 + (t / duration) * 0.43, ar ? `تسجيل ${Math.round((t / duration) * 100)}%` : `Recording ${Math.round((t / duration) * 100)}%`);
      requestAnimationFrame(loop);
    };
    loop();
  });
  rec.stop();
  await done;
  src.stop();
  actx.close();
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  return { blob: new Blob(chunks, { type: mime.split(';')[0] }), ext: mime.startsWith('video/mp4') ? 'mp4' : 'webm' };
};

// يبقي الشاشة مضاءة أثناء التصدير حتى لا يتوقف المتصفح
const keepAwake = async (): Promise<{ release: () => void }> => {
  try {
    const lock = await (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request('screen');
    return { release: () => void lock?.release().catch(() => undefined) };
  } catch {
    return { release: () => undefined };
  }
};

export const exportStoryVideo = async (story: StoryData, opts: VideoOptions, onProgress: Progress, signal: AbortSignal): Promise<VideoResult> => {
  const awake = await keepAwake();
  try {
    return await render(story, opts, onProgress, signal);
  } finally {
    awake.release();
  }
};

const render = async (story: StoryData, opts: VideoOptions, onProgress: Progress, signal: AbortSignal): Promise<VideoResult> => {
  const ar = isArabicStory(story);
  // سقف الجودة حسب ذاكرة الجهاز
  const allowed = VIDEO_QUALITIES.findIndex((q) => q.id === maxQuality());
  const wanted = VIDEO_QUALITIES.findIndex((q) => q.id === opts.quality);
  const quality = VIDEO_QUALITIES[Math.min(allowed, wanted)].id;
  const { width: W, height: H } = videoSize(opts.format, quality);
  const design = getFormat(opts.format).design;
  const bitrate = bitrateFor(W, H, FPS);
  onProgress(0.02, ar ? 'نجهّز الخطوط والصور...' : 'Preparing fonts and images...');
  try {
    await Promise.all(
      (ar ? ["800 72px 'Baloo Bhaijaan 2'", "700 36px 'Cairo'", "600 32px 'Cairo'"] : ["800 72px 'Fredoka'", "700 36px 'Nunito'"]).map((f) => document.fonts.load(f))
    );
  } catch {
    // continue
  }

  const decoder = new OfflineAudioContext(2, SR, SR);
  const segs = await buildSegments(story, opts.voice, decoder, { w: W, h: H }, onProgress, signal, opts.clips);

  let music: AudioBuffer | null = null;
  let musicFailed = false;
  if (opts.withMusic) {
    onProgress(0.45, ar ? 'نؤلّف الموسيقى التصويرية للقصة (45%)...' : 'Composing story soundtrack (45%)...');
    try {
      const musicPromise = getStoryMusic(story, signal);
      const timeoutPromise = new Promise<null>((r) => setTimeout(() => r(null), 7000));
      const res = await Promise.race([musicPromise, timeoutPromise]);
      if (res instanceof Blob) {
        onProgress(0.49, ar ? 'معالجة وضبط صوت الموسيقى (49%)...' : 'Processing soundtrack (49%)...');
        music = await decode(decoder, res);
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err;
    }
    // في حال عدم توفر أو تأخر موسيقى السيرفر: يتم التوليد التلقائي لموسيقى هادئة بالـ WebAudio
    if (!music) {
      onProgress(0.49, ar ? 'توليد لحن موسيقي هادئ ومؤثرات صوتية (49%)...' : 'Generating gentle lullaby score & effects (49%)...');
      const totalDur = segs[segs.length - 1].start + segs[segs.length - 1].dur + 2;
      music = await createProceduralLullaby(totalDur, SR);
    }
  }

  onProgress(0.53, ar ? 'مزج أصوات الراوي مع الموسيقى التصويرية (53%)...' : 'Mixing narration with soundtrack (53%)...');
  const mixed = await mixAudio(segs, music);
  const last = segs[segs.length - 1];
  const duration = last.start + last.dur;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const renderer = new Renderer(canvas, segs, story, ar, opts.brand, design, opts.tagline, opts.veoMotionMode);

  const codec = await canEncodeMp4(W, H, bitrate);
  let result: { blob: Blob; ext: 'mp4' | 'webm' };
  if (codec) {
    try {
      result = { blob: await encodeMp4(renderer, canvas, mixed, duration, codec, bitrate, onProgress, signal, ar), ext: 'mp4' };
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err;
      renderer.disableClips();
      result = await recordRealtime(renderer, canvas, mixed, duration, bitrate, onProgress, signal, ar);
    }
  } else {
    renderer.disableClips();
    result = await recordRealtime(renderer, canvas, mixed, duration, bitrate, onProgress, signal, ar);
  }

  segs.forEach((s) => {
    s.image?.close();
    disposeClipPlayer(s.clip);
  });
  onProgress(1, ar ? 'الفيديو جاهز!' : 'Video ready!');
  return { ...result, musicFailed, quality, width: W, height: H };
};
