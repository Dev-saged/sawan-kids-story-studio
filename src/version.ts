export interface VersionInfo {
  version: string;
  buildNumber: number;
  releaseDate: string;
  commitTag: string;
}

export const CURRENT_VERSION: VersionInfo = {
  version: '2.10.0',
  buildNumber: 2100,
  releaseDate: '2026-10-20',
  commitTag: 'v2.10.0-studio-expansion',
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
