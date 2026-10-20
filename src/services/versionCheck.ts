import { APP_VERSION, SOCIAL_LINKS } from '../config';

// مقارنة نسختين بصيغة SemVer (مثلاً '2.11.0' > '2.10.0' ترجع 1)
export const compareVersions = (a: string, b: string): number => {
  const cleanA = a.replace(/^v/i, '').trim().split('.').map((n) => parseInt(n, 10) || 0);
  const cleanB = b.replace(/^v/i, '').trim().split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(cleanA.length, cleanB.length, 3);
  for (let i = 0; i < len; i++) {
    const va = cleanA[i] ?? 0;
    const vb = cleanB[i] ?? 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
};

export interface UpdateCheckResult {
  hasUpdate: boolean;
  latestVersion: string;
  url?: string;
  releaseUrl?: string;
}

// فحص تحديث صامت عند فتح التطبيق: يقارن APP_VERSION مع آخر إصدار على GitHub أو version.json المنشور
export const checkSilentUpdate = async (): Promise<UpdateCheckResult> => {
  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return { hasUpdate: false, latestVersion: APP_VERSION };
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4500);
    try {
      // 1) فحص /version.json المحلي/الخادم عند نشر نسخة جديدة
      const localRes = await fetch(`/version.json?t=${Date.now()}`, { signal: ctrl.signal, cache: 'no-store' }).catch(() => null);
      if (localRes && localRes.ok) {
        const data = await localRes.json().catch(() => null);
        if (data?.version && compareVersions(String(data.version), APP_VERSION) > 0) {
          return { hasUpdate: true, latestVersion: String(data.version) };
        }
      }

      // 2) فحص مستودع GitHub العام إن توفر في SOCIAL_LINKS
      const ghUrl = SOCIAL_LINKS.github || '';
      const ownerMatch = /github\.com\/([^/]+)(?:\/([^/]+))?/.exec(ghUrl);
      if (ownerMatch) {
        const owner = ownerMatch[1];
        const repo = ownerMatch[2] || 'sajed-kids-story-studio';
        const ghRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
          signal: ctrl.signal,
          headers: { Accept: 'application/vnd.github+json' },
        }).catch(() => null);
        if (ghRes && ghRes.ok) {
          const rel = await ghRes.json().catch(() => null);
          const tag = String(rel?.tag_name || rel?.name || '').replace(/^v/i, '');
          if (tag && /^\d+\.\d+\.\d+/.test(tag) && compareVersions(tag, APP_VERSION) > 0) {
            const releaseUrl = rel?.html_url || ghUrl;
            return { hasUpdate: true, latestVersion: tag, url: releaseUrl, releaseUrl };
          }
        }
      }
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // فحص صامت: لا نزعج المستخدم بأي خطأ شبكة
  }
  return { hasUpdate: false, latestVersion: APP_VERSION };
};

export const checkForAppUpdate = checkSilentUpdate;
