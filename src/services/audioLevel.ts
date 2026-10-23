// تسوية مستوى صوت الراوي بين الصفحات: نفس الـRMS تقريباً لكل مقطع كي لا يعلو صوت صفحة ويخفت آخر
export const TARGET_RMS = 0.1;
const MAX_GAIN = 4;
const MIN_GAIN = 0.25;
const PEAK_CEILING = 0.97;

const findData = (v: DataView): { offset: number; length: number; channels: number; bits: number } | null => {
  if (v.byteLength < 44 || v.getUint32(0) !== 0x52494646 || v.getUint32(8) !== 0x57415645) return null;
  let p = 12;
  let channels = 1;
  let bits = 16;
  let format = 1;
  while (p + 8 <= v.byteLength) {
    const id = v.getUint32(p);
    const size = v.getUint32(p + 4, true);
    if (id === 0x666d7420) {
      format = v.getUint16(p + 8, true);
      channels = v.getUint16(p + 10, true);
      bits = v.getUint16(p + 22, true);
    } else if (id === 0x64617461) {
      if (format !== 1 || bits !== 16) return null;
      return { offset: p + 8, length: Math.min(size, v.byteLength - p - 8), channels, bits };
    }
    p += 8 + size + (size % 2);
  }
  return null;
};

export const wavRms = (buf: ArrayBuffer): number | null => {
  const v = new DataView(buf);
  const d = findData(v);
  if (!d) return null;
  const n = Math.floor(d.length / 2);
  if (!n) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const s = v.getInt16(d.offset + i * 2, true) / 32768;
    sum += s * s;
  }
  return Math.sqrt(sum / n);
};

// يعيد نسخة بنفس الترويسة وبعينات مضروبة بمعامل يقارب الـRMS الهدف دون تجاوز القمة
export const normalizeWav = (buf: ArrayBuffer, target = TARGET_RMS): ArrayBuffer => {
  const v0 = new DataView(buf);
  const d = findData(v0);
  if (!d) return buf;
  const n = Math.floor(d.length / 2);
  let sum = 0;
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const s = v0.getInt16(d.offset + i * 2, true) / 32768;
    sum += s * s;
    peak = Math.max(peak, Math.abs(s));
  }
  const rms = Math.sqrt(sum / (n || 1));
  if (rms < 0.002 || peak === 0) return buf;
  let gain = Math.min(MAX_GAIN, Math.max(MIN_GAIN, target / rms));
  gain = Math.min(gain, PEAK_CEILING / peak);
  if (Math.abs(gain - 1) < 0.03) return buf;
  const out = buf.slice(0);
  const v = new DataView(out);
  for (let i = 0; i < n; i++) {
    const s = Math.round(v.getInt16(d.offset + i * 2, true) * gain);
    v.setInt16(d.offset + i * 2, Math.max(-32768, Math.min(32767, s)), true);
  }
  return out;
};

export const normalizeWavBlob = async (blob: Blob): Promise<Blob> => {
  if (!blob.type.includes('wav')) return blob;
  try {
    return new Blob([normalizeWav(await blob.arrayBuffer())], { type: 'audio/wav' });
  } catch {
    return blob;
  }
};
