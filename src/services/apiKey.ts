// المفتاح: الذاكرة هي المصدر الفوري. يُحفظ في sessionStorage (هذا التبويب)، وإن اختار المستخدم
// «تذكّر» يُحفظ أيضاً مشفّراً (AES-GCM بمفتاح غير قابل للتصدير داخل IndexedDB منفصلة) ويُسترجع عند الفتح.
const KEY_STORAGE = 'sawan-gemini-key';
const REMEMBER_FLAG = 'sawan-key-remembered';
// أي صيغة مفتاح (AIza… أو AQ.… أو غيرها): نمنع المسافات فقط وجوجل تحكم بالصلاحية
const KEY_PATTERN = /^\S{16,300}$/;

const normalize = (key: string): string => key.trim().replace(/^["'`]+|["'`]+$/g, '');

const readSession = (): string | null => {
  try {
    const key = sessionStorage.getItem(KEY_STORAGE);
    return key && KEY_PATTERN.test(key) ? key : null;
  } catch {
    return null;
  }
};

let memKey: string | null = readSession();

export const getApiKey = (): string | null => memKey;

// المفتاح الحقيقي للزائر فقط (يُستخدم مباشرة من المتصفح نحو Google، ويُرسل للسيرفر لتوليد النص)
export const getUserApiKey = (): string | null =>
  memKey && memKey !== 'server-proxy' && KEY_PATTERN.test(memKey) ? memKey : null;

export const setSharedServerSession = (): void => {
  memKey = 'server-proxy';
  try {
    sessionStorage.setItem(KEY_STORAGE, 'server-proxy');
  } catch {
    // ignore
  }
};

// ===== خزنة مشفّرة =====
const VAULT_DB = 'sawan-vault';
const VAULT_STORE = 'kv';

const openVault = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(VAULT_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(VAULT_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const vaultOp = async <T,>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await openVault();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(VAULT_STORE, mode).objectStore(VAULT_STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
};

const vaultGet = <T,>(k: string) => vaultOp<T | undefined>('readonly', (s) => s.get(k) as IDBRequest<T | undefined>);
const vaultSet = (k: string, v: unknown) => vaultOp('readwrite', (s) => s.put(v, k));
const vaultDel = (k: string) => vaultOp('readwrite', (s) => s.delete(k));

const setFlag = (on: boolean) => {
  try {
    if (on) localStorage.setItem(REMEMBER_FLAG, '1');
    else localStorage.removeItem(REMEMBER_FLAG);
  } catch {
    // ignore
  }
};

export const isKeyRemembered = (): boolean => {
  try {
    return localStorage.getItem(REMEMBER_FLAG) === '1';
  } catch {
    return false;
  }
};

const persistKey = async (value: string): Promise<boolean> => {
  try {
    let wrap = await vaultGet<CryptoKey>('wrap');
    if (!wrap) {
      wrap = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      await vaultSet('wrap', wrap);
    }
    const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, wrap, new TextEncoder().encode(value));
    await vaultSet('key', { iv, data });
    setFlag(true);
    return true;
  } catch {
    return false;
  }
};

const dropKey = async (): Promise<void> => {
  setFlag(false);
  try {
    await vaultDel('key');
    await vaultDel('wrap');
  } catch {
    // ignore
  }
};

// يُستدعى قبل أول عرض: يسترجع المفتاح المحفوظ إن وُجد (لا يُبطئ التشغيل أكثر من مهلة قصيرة)
export const hydrateApiKey = async (): Promise<void> => {
  if (memKey || !isKeyRemembered()) return;
  try {
    await Promise.race([
      (async () => {
        const [blob, wrap] = await Promise.all([vaultGet<{ iv: Uint8Array<ArrayBuffer>; data: ArrayBuffer }>('key'), vaultGet<CryptoKey>('wrap')]);
        if (!blob || !wrap) return;
        const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: blob.iv }, wrap, blob.data);
        const value = new TextDecoder().decode(plain);
        if (KEY_PATTERN.test(value)) memKey = value;
      })(),
      new Promise<void>((resolve) => setTimeout(resolve, 1500)),
    ]);
  } catch {
    // مفتاح تالف أو خزنة غير متاحة: نكمل بلا مفتاح محفوظ
  }
};

export const saveApiKey = async (key: string, remember = false): Promise<void> => {
  memKey = normalize(key);
  try {
    sessionStorage.setItem(KEY_STORAGE, memKey);
  } catch {
    // ignore
  }
  if (remember) await persistKey(memKey);
  else await dropKey();
};

export const clearApiKey = (): void => {
  memKey = null;
  try {
    sessionStorage.removeItem(KEY_STORAGE);
  } catch {
    // ignore
  }
  void dropKey();
};

export const isValidApiKeyFormat = (key: string): boolean => KEY_PATTERN.test(normalize(key));

// شكل المفتاح بدون كشفه: للتشخيص فقط
export const keyShape = (key: string): string => (!key ? 'none' : key === 'MY_GEMINI_API_KEY' ? 'placeholder' : `${key.slice(0, 3)}… (${key.length})`);

// المحرك الاحتياطي المجاني بلا مفتاح (Pollinations): يرسل وصف المشهد فقط، مفعّل افتراضياً ويمكن إيقافه
const WEB_FREE_KEY = 'sawan-web-free';

export const isWebFreeEnabled = (): boolean => {
  try {
    return localStorage.getItem(WEB_FREE_KEY) === '1';
  } catch {
    return false;
  }
};

export const setWebFreeEnabled = (on: boolean): void => {
  try {
    localStorage.setItem(WEB_FREE_KEY, on ? '1' : '0');
  } catch {
    // ignore
  }
};

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
  return key ? keyShape(key) : 'studio';
};
