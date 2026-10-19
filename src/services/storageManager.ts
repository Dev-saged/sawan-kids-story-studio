import { dbAll, dbDelete } from './db';
import { ImageRecord } from './media';

export interface StorageReport {
  usageMB: number;
  quotaMB: number;
  percentUsed: number;
  imageCount: number;
}

export const getStorageReport = async (): Promise<StorageReport> => {
  let usageMB = 0;
  let quotaMB = 0;
  let percentUsed = 0;
  let count = 0;

  try {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      usageMB = Math.round(((estimate.usage || 0) / (1024 * 1024)) * 10) / 10;
      quotaMB = Math.round(((estimate.quota || 0) / (1024 * 1024)) * 10) / 10;
      percentUsed = quotaMB > 0 ? Math.round((usageMB / quotaMB) * 100) : 0;
    }
    const images = await dbAll<ImageRecord>('images');
    count = images.length;
  } catch {
    // fallback
  }

  return { usageMB, quotaMB, percentUsed, imageCount: count };
};

// تفريغ الذاكرة المؤقتة للصور غير المرتبطة بقصص حالية لتوفير المساحة وتسريع التصفح
export const cleanImageCache = async (activeImageIds: Set<string>): Promise<number> => {
  try {
    const images = await dbAll<ImageRecord>('images');
    let removed = 0;
    for (const img of images) {
      if (!activeImageIds.has(img.id)) {
        await dbDelete('images', img.id);
        removed++;
      }
    }
    return removed;
  } catch {
    return 0;
  }
};
