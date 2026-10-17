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

// ===== المحرك المجاني للصور (Cloudflare Workers AI) =====
const FREE_STORAGE = 'sawan-free-engine';
const ACCOUNT_PATTERN = /^[a-f0-9]{32}$/i;
const TOKEN_PATTERN = /^\S{20,200}$/;

export interface FreeCreds {
  account: string;
  token: string;
}

export const isValidFreeCreds = (account: string, token: string): boolean => ACCOUNT_PATTERN.test(account.trim()) && TOKEN_PATTERN.test(normalize(token));

const readStore = (store: Storage): FreeCreds | null => {
  try {
    const parsed = JSON.parse(store.getItem(FREE_STORAGE) ?? 'null');
    return parsed && isValidFreeCreds(String(parsed.account), String(parsed.token)) ? { account: String(parsed.account), token: String(parsed.token) } : null;
  } catch {
    return null;
  }
};

export const getFreeCreds = (): FreeCreds | null => {
  try {
    return readStore(localStorage) ?? readStore(sessionStorage);
  } catch {
    return null;
  }
};

// remember=true: يبقى على هذا الجهاز؛ وإلا يُمسح بإغلاق التبويب
export const saveFreeCreds = (account: string, token: string, remember: boolean): void => {
  const value = JSON.stringify({ account: account.trim(), token: normalize(token) });
  clearFreeCreds();
  try {
    (remember ? localStorage : sessionStorage).setItem(FREE_STORAGE, value);
  } catch {
    sessionStorage.setItem(FREE_STORAGE, value);
  }
};

export const clearFreeCreds = (): void => {
  for (const store of [() => localStorage, () => sessionStorage]) {
    try {
      store().removeItem(FREE_STORAGE);
    } catch {
      // ignore
    }
  }
};

// شكل المفتاح بدون كشفه: للتشخيص فقط
export const keyHint = (): string => {
  const key = getUserApiKey();
  return key ? `${key.slice(0, 3)}… (${key.length})` : 'studio';
};
