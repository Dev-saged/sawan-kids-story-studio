// المفتاح يُحفظ في sessionStorage: يبقى لهذا التبويب فقط ويُمسح عند إغلاقه.
const KEY_STORAGE = 'sawan-gemini-key';
// أي صيغة مفتاح (AIza… أو AQ.… أو غيرها): نمنع المسافات فقط وجوجل تحكم بالصلاحية
const KEY_PATTERN = /^\S{16,300}$/;

const normalize = (key: string): string => key.trim().replace(/^["'`]+|["'`]+$/g, '');

export const getApiKey = (): string | null => {
  try {
    return sessionStorage.getItem(KEY_STORAGE) || 'studio-active';
  } catch {
    return 'studio-active';
  }
};

// المفتاح الحقيقي للزائر فقط (يُرسل للسيرفر ليُستخدم بدل مفتاح البيئة)
export const getUserApiKey = (): string | null => {
  try {
    const key = sessionStorage.getItem(KEY_STORAGE);
    return key && KEY_PATTERN.test(key) ? key : null;
  } catch {
    return null;
  }
};

export const saveApiKey = (key: string): void => {
  sessionStorage.setItem(KEY_STORAGE, normalize(key));
};

export const clearApiKey = (): void => {
  sessionStorage.removeItem(KEY_STORAGE);
};

export const isValidApiKeyFormat = (key: string): boolean => KEY_PATTERN.test(normalize(key));

// شكل المفتاح بدون كشفه: للتشخيص فقط
export const keyHint = (): string => {
  const key = getUserApiKey();
  return key ? `${key.slice(0, 3)}… (${key.length})` : 'studio';
};
