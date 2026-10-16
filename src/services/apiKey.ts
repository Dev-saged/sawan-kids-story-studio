// المفتاح يُحفظ في sessionStorage: يبقى لهذا التبويب فقط ويُمسح عند إغلاقه.
const KEY_STORAGE = 'sawan-gemini-key';
const KEY_PATTERN = /^[A-Za-z0-9_-]{30,}$/;

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
  sessionStorage.setItem(KEY_STORAGE, key.trim());
};

export const clearApiKey = (): void => {
  sessionStorage.removeItem(KEY_STORAGE);
};

export const isValidApiKeyFormat = (key: string): boolean => KEY_PATTERN.test(key.trim());
