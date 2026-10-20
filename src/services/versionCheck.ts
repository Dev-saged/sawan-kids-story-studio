import { APP_VERSION, CONFIG } from '../config';
import { CURRENT_VERSION, compareVersions, type VersionComparable } from '../version';

export { compareVersions, type VersionComparable };

export interface UpdateCheckResult {
  hasUpdate: boolean;
  latestVersion: string;
  buildNumber?: number;
  releaseDate?: string;
  url?: string;
  releaseUrl?: string;
}

// أ2: فحص التحديث الصامت من raw.githubusercontent.com عبر المالك والمستودع في CONFIG فقط بمهلة 5 ثوانٍ
export const checkSilentUpdate = async (): Promise<UpdateCheckResult> => {
  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return { hasUpdate: false, latestVersion: APP_VERSION };
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    try {
      const remoteUrl = `https://raw.githubusercontent.com/${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}/main/public/version.json`;
      const res = await fetch(remoteUrl, {
        signal: ctrl.signal,
        cache: 'no-store',
      }).catch(() => null);

      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        if (data && typeof data.version === 'string') {
          const remoteInfo: VersionComparable = {
            version: String(data.version).replace(/^v/i, '').trim(),
            buildNumber: typeof data.buildNumber === 'number' ? data.buildNumber : undefined,
          };
          if (compareVersions(remoteInfo, CURRENT_VERSION) > 0) {
            const releaseUrl = `https://github.com/${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}`;
            return {
              hasUpdate: true,
              latestVersion: remoteInfo.version,
              buildNumber: remoteInfo.buildNumber,
              releaseDate: typeof data.releaseDate === 'string' ? data.releaseDate : undefined,
              url: releaseUrl,
              releaseUrl,
            };
          }
        }
      }
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // فشل الشبكة يُتجاهل بصمت تام دون أي خطأ في الكونسول
  }
  return { hasUpdate: false, latestVersion: APP_VERSION };
};

export const checkForAppUpdate = checkSilentUpdate;
