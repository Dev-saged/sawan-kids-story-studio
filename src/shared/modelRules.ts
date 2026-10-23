export {
  NO_SIZE_IMAGE_MODELS,
  FRAMING_DIRECTIVE,
  POSITIVE_ILLUSTRATION_DIRECTIVE,
  SHARED_ART_STYLE_OPTIONS,
  STORY_TYPE_SPECS,
  buildSharedSystemInstruction,
} from '../../shared/config.ts';
export {
  ART_DIRECTION,
  STYLE_CONSISTENCY_PRESETS,
  artDirectionLine,
  captureAspectFor,
  isWideCapture,
  detectCharacterFruit,
  getStyleLock,
  isNonHumanDescription,
  normalizeStyleConsistencyId,
  resolveAudience,
  resolveStyleConsistencyKeywords,
  stripBrandNames,
  type StyleConsistencyPreset,
} from '../../shared/promptRules.ts';
export * from '../../shared/videoRules.ts';
