import { NarratorVoice } from '../types';

export interface DialogueSegment {
  speaker: 'narrator' | 'hero' | 'companion' | 'elder';
  voice: NarratorVoice;
  text: string;
}

// يكتشف الحوارات والأقوال داخل النص ويوزعها على أصوات متعددة لتجربة درامية إذاعية
export const parseDramatizedText = (text: string, baseVoice: NarratorVoice = 'Sulafat'): DialogueSegment[] => {
  const segments: DialogueSegment[] = [];
  
  // Regex to split on quotes in Arabic «...» or English "..."
  const quoteRegex = /(?:«([^»]+)»|"([^"]+)")/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = quoteRegex.exec(text)) !== null) {
    const quoteText = match[1] || match[2] || '';
    const beforeText = text.slice(lastIndex, match.index).trim();

    if (beforeText) {
      segments.push({
        speaker: 'narrator',
        voice: baseVoice,
        text: beforeText,
      });
    }

    // Determine character voice based on dialogue context
    let speaker: DialogueSegment['speaker'] = 'hero';
    let voice: NarratorVoice = 'Puck'; // Playful, child-like character voice

    if (/جد|حكيم|دب|عملاق|شجرة عتيقة|grandfather|elder|giant|bear/i.test(beforeText)) {
      speaker = 'elder';
      voice = 'Charon'; // Deep, wise voice
    } else if (/عصفور|فراشة|أم|أخت|زهرة|mother|bird|butterfly|sister/i.test(beforeText)) {
      speaker = 'companion';
      voice = 'Vindemiatrix'; // Gentle, soft voice
    }

    segments.push({
      speaker,
      voice,
      text: quoteText.trim(),
    });

    lastIndex = match.index + match[0].length;
  }

  const remaining = text.slice(lastIndex).trim();
  if (remaining) {
    segments.push({
      speaker: 'narrator',
      voice: baseVoice,
      text: remaining,
    });
  }

  return segments.length ? segments : [{ speaker: 'narrator', voice: baseVoice, text }];
};
