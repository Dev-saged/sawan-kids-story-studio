import { postJson } from './api';
import { blobToBase64 } from './media';

export interface ImageCheck {
  ok: boolean;
  fix: string;
}

// فحص بالرؤية؛ أي فشل (شبكة، حصة، نموذج) يُعامل كـ "سليمة" كي لا يعطل الرسم
export interface QaContext {
  text?: string;
  style?: string;
  sheet?: boolean;
}

export const checkIllustration = async (blob: Blob, scene: string, signal?: AbortSignal, ctx: QaContext = {}): Promise<ImageCheck> => {
  try {
    const data = await blobToBase64(blob);
    const res = await postJson<ImageCheck>('/api/check-image', { data, mimeType: blob.type || 'image/png', scene, text: ctx.text, style: ctx.style, sheet: ctx.sheet === true }, signal, 1);
    return { ok: res?.ok !== false, fix: String(res?.fix ?? '') };
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    return { ok: true, fix: '' };
  }
};
