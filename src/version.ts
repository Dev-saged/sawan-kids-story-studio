export interface VersionInfo {
  version: string;
  buildNumber: number;
  releaseDate: string;
  commitTag: string;
}

export const CURRENT_VERSION: VersionInfo = {
  version: '2.8.0',
  buildNumber: 280,
  releaseDate: '2026-10-19',
  commitTag: 'v2.8.0-release',
};

export const incrementVersion = (type: 'patch' | 'minor' | 'major' = 'patch'): VersionInfo => {
  const parts = CURRENT_VERSION.version.split('.').map(Number);
  if (type === 'patch') parts[2]++;
  else if (type === 'minor') {
    parts[1]++;
    parts[2] = 0;
  } else if (type === 'major') {
    parts[0]++;
    parts[1] = 0;
    parts[2] = 0;
  }
  return {
    version: parts.join('.'),
    buildNumber: CURRENT_VERSION.buildNumber + 1,
    releaseDate: new Date().toISOString().split('T')[0],
    commitTag: `v${parts.join('.')}-auto`,
  };
};
