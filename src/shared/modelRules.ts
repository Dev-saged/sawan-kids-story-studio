// Shared model rules between Express backend (server.ts) and Client (src/services/imageEngine.ts)

// نماذج لا تقبل imageSize (ترفضه بخطأ 400): تأخذ نسبة الأبعاد فقط
export const NO_SIZE_IMAGE_MODELS: ReadonlySet<string> = new Set([
  'gemini-2.5-flash-image',
  'gemini-3.1-flash-lite-image',
  'gemini-3.1-flash-image',
  'gemini-3.1-flash-image-preview',
]);

// الجملة الوصفية الإيجابية الموحدة لضمان جودة التشريح وعدم تكرار الشخصيات بدلاً من Negative prompt الطويل
export const POSITIVE_ILLUSTRATION_DIRECTIVE =
  "Masterpiece children's book illustration, sharp focus, rich detail, professional composition, consistent character design. Depict each character once with natural, proportionate anatomy and clean hands; keep the scene free of any text, letters, or watermarks.";
