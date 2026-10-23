export interface VersionInfo {
  version: string;
  buildNumber: number;
  releaseDate: string;
  commitTag: string;
}

export interface VersionComparable {
  version: string;
  buildNumber?: number;
}

export const CURRENT_VERSION: VersionInfo = {
  version: '3.4.0',
  buildNumber: 2111,
  releaseDate: '2026-10-23',
  commitTag: 'v3.4.0-colab-video-and-framing',
};

type BumpType = 'patch' | 'minor' | 'major';

const isBumpType = (val: unknown): val is BumpType =>
  val === 'patch' || val === 'minor' || val === 'major';

/**
 * نظام الإصدارات MAJOR.MINOR.PATCH حيث MINOR و PATCH من 0 إلى 9 فقط (لا يوجد 10 في أي خانة فرعية):
 * - patch > 9 -> minor + 1 و patch = 0
 * - minor > 9 -> major + 1 و minor = 0 و patch = 0
 */
export const incrementVersion = (
  typeOrBase: BumpType | string | Partial<VersionInfo> = 'patch',
  baseOrType?: BumpType | string | Partial<VersionInfo>
): VersionInfo => {
  let type: BumpType = 'patch';
  let baseVersionStr = CURRENT_VERSION.version;
  let baseBuild = CURRENT_VERSION.buildNumber;

  if (isBumpType(typeOrBase)) {
    type = typeOrBase;
    if (typeof baseOrType === 'string') {
      baseVersionStr = baseOrType;
    } else if (baseOrType && typeof baseOrType === 'object') {
      if (baseOrType.version) baseVersionStr = baseOrType.version;
      if (typeof baseOrType.buildNumber === 'number') baseBuild = baseOrType.buildNumber;
    }
  } else {
    if (typeof typeOrBase === 'string') {
      baseVersionStr = typeOrBase;
    } else if (typeOrBase && typeof typeOrBase === 'object') {
      if (typeOrBase.version) baseVersionStr = typeOrBase.version;
      if (typeof typeOrBase.buildNumber === 'number') baseBuild = typeOrBase.buildNumber;
    }
    if (isBumpType(baseOrType)) {
      type = baseOrType;
    }
  }

  const rawParts = baseVersionStr
    .replace(/^v/i, '')
    .trim()
    .split('.')
    .map((n) => parseInt(n, 10) || 0);

  let major = rawParts[0] ?? 0;
  let minor = rawParts[1] ?? 0;
  let patch = rawParts[2] ?? 0;

  if (type === 'patch') {
    patch += 1;
    if (patch > 9) {
      patch = 0;
      minor += 1;
    }
    if (minor > 9) {
      minor = 0;
      major += 1;
    }
  } else if (type === 'minor') {
    minor += 1;
    patch = 0;
    if (minor > 9) {
      minor = 0;
      major += 1;
    }
  } else if (type === 'major') {
    major += 1;
    minor = 0;
    patch = 0;
  }

  const nextVersion = `${major}.${minor}.${patch}`;
  return {
    version: nextVersion,
    buildNumber: baseBuild + 1,
    releaseDate: new Date().toISOString().split('T')[0],
    commitTag: `v${nextVersion}-auto`,
  };
};

/**
 * يقارن إصدارين: يقارن buildNumber أولاً إن توفّر في الطرفين،
 * وإن غاب يقارن الأرقام عددياً جزءاً جزءاً (لا مقارنة نصية).
 */
export const compareVersions = (
  a: string | VersionComparable,
  b: string | VersionComparable,
  buildA?: number,
  buildB?: number
): number => {
  const verA = typeof a === 'string' ? a : a.version;
  const verB = typeof b === 'string' ? b : b.version;
  const bNumA = typeof a === 'object' && typeof a.buildNumber === 'number' ? a.buildNumber : buildA;
  const bNumB = typeof b === 'object' && typeof b.buildNumber === 'number' ? b.buildNumber : buildB;

  if (typeof bNumA === 'number' && typeof bNumB === 'number' && bNumA !== bNumB) {
    return bNumA > bNumB ? 1 : -1;
  }

  const cleanA = String(verA)
    .replace(/^v/i, '')
    .trim()
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  const cleanB = String(verB)
    .replace(/^v/i, '')
    .trim()
    .split('.')
    .map((n) => parseInt(n, 10) || 0);

  const len = Math.max(cleanA.length, cleanB.length, 3);
  for (let i = 0; i < len; i++) {
    const va = cleanA[i] ?? 0;
    const vb = cleanB[i] ?? 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
};
