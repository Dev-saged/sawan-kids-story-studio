import type { ArtStyle } from '../../types';

interface StyleThumbProps {
  style: ArtStyle | string;
  className?: string;
}

/**
 * معاينة بصرية مرسومة بـ SVG inline لكل أسلوب فني من الأساليب الـ 18 (بدون أي صور خارجية أو رموز تعبيرية).
 */
export function StyleThumb({ style, className = 'w-12 h-9' }: StyleThumbProps) {
  switch (style as ArtStyle) {
    case 'Watercolor':
      return (
        <svg viewBox="0 0 64 48" fill="none" className={className} aria-hidden="true">
          <rect width="64" height="48" rx="10" fill="#fef3c7" />
          <circle cx="22" cy="22" r="14" fill="#60a5fa" fillOpacity="0.45" />
          <circle cx="38" cy="26" r="13" fill="#f472b6" fillOpacity="0.45" />
          <circle cx="30" cy="16" r="10" fill="#34d399" fillOpacity="0.4" />
          <path d="M12 36c10-6 28-6 40 0" stroke="#1e3a8a" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="3 2" />
        </svg>
      );

    case '3D Pixar Style':
      return (
        <svg viewBox="0 0 64 48" fill="none" className={className} aria-hidden="true">
          <rect width="64" height="48" rx="10" fill="#1e1b4b" />
          <circle cx="32" cy="24" r="14" fill="#f59e0b" />
          <circle cx="27" cy="19" r="5" fill="#fef3c7" fillOpacity="0.65" />
          <circle cx="27" cy="23" r="2.2" fill="#1e1b4b" />
          <circle cx="37" cy="23" r="2.2" fill="#1e1b4b" />
          <path d="M27 30c3 2.5 7 2.5 10 0" stroke="#1e1b4b" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );

    case 'Cute Cartoon':
      return (
        <svg viewBox="0 0 64 48" fill="none" className={className} aria-hidden="true">
          <rect width="64" height="48" rx="10" fill="#fce7f3" />
          <circle cx="32" cy="26" r="13" fill="#fb7185" stroke="#881337" strokeWidth="2" />
          <circle cx="22" cy="15" r="4.5" fill="#fb7185" stroke="#881337" strokeWidth="2" />
          <circle cx="42" cy="15" r="4.5" fill="#fb7185" stroke="#881337" strokeWidth="2" />
          <circle cx="27" cy="24" r="2" fill="#881337" />
          <circle cx="37" cy="24" r="2" fill="#881337" />
          <path d="M28 30c2 2 6 2 8 0" stroke="#881337" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    case 'Hand-drawn Cartoon':
      return (
        <svg viewBox="0 0 64 48" fill="none" className={className} aria-hidden="true">
          <rect width="64" height="48" rx="10" fill="#fffbeb" />
          <path d="M14 36c6-16 14-22 18-22s12 6 18 22" fill="#fcd34d" fillOpacity="0.5" stroke="#78350f" strokeWidth="2" strokeLinecap="round" />
          <circle cx="32" cy="20" r="6" fill="#fde68a" stroke="#78350f" strokeWidth="2" />
          <path d="M10 38h44" stroke="#78350f" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    case 'Pastel Dream':
      return (
        <svg viewBox="0 0 64 48" fill="none" className={className} aria-hidden="true">
          <rect width="64" height="48" rx="10" fill="#ede9fe" />
          <path d="M16 32a10 10 0 0 1 18-6 9 9 0 0 1 14 6H16Z" fill="#ddd6fe" stroke="#7c3aed" strokeWidth="1.6" />
          <circle cx="22" cy="16" r="4" fill="#fbcfe8" />
          <circle cx="44" cy="14" r="3" fill="#fde68a" />
        </svg>
      );

    case 'Doodle Sketch':
      return (
        <svg viewBox="0 0 64 48" fill="none" className={className} aria-hidden="true">
          <rect width="64" height="48" rx="10" fill="#f8fafc" />
          <path d="M16 34 28 14l10 14 10-8" stroke="#334155" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="46" cy="16" r="4" stroke="#f59e0b" strokeWidth="2" strokeDasharray="2 2" />
          <path d="M14 38h36" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 3" />
        </svg>
      );

    case 'Anime':
      return (
        <svg viewBox="0 0 64 48" fill="none" className={className} aria-hidden="true">
          <rect width="64" height="48" rx="10" fill="#e0f2fe" />
          <path d="M12 12 52 36M52 12 12 36" stroke="#38bdf8" strokeWidth="1.2" strokeOpacity="0.4" />
          <ellipse cx="32" cy="24" rx="12" ry="9" fill="#0284c7" stroke="#0c4a6e" strokeWidth="2" />
          <circle cx="29" cy="22" r="3.5" fill="#ffffff" />
          <circle cx="35" cy="26" r="1.8" fill="#bae6fd" />
        </svg>
      );

    case 'Paper Cutout':
      return (
        <svg viewBox="0 0 64 48" fill="none" className={className} aria-hidden="true">
          <rect width="64" height="48" rx="10" fill="#ffedd5" />
          <path d="M8 40c8-12 20-12 28 0s16-8 20 0v8H8v-8Z" fill="#fb923c" />
          <path d="M8 44c10-8 22-8 32 0s14-6 16 0v4H8v-4Z" fill="#ea580c" />
          <circle cx="44" cy="16" r="6" fill="#facc15" />
        </svg>
      );

    case 'Educational Line Cartoon':
      return (
        <svg viewBox="0 0 64 48" fill="none" className={className} aria-hidden="true">
          <rect width="64" height="48" rx="10" fill="#ecfdf5" />
          <rect x="16" y="12" width="32" height="24" rx="4" fill="#ffffff" stroke="#065f46" strokeWidth="2.2" />
          <path d="M22 20h12M22 26h20" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="41" cy="19" r="3" fill="#f59e0b" stroke="#065f46" strokeWidth="1.6" />
        </svg>
      );

    case 'Claymation':
      return (
        <svg viewBox="0 0 64 48" fill="none" className={className} aria-hidden="true">
          <rect width="64" height="48" rx="10" fill="#fef2f2" />
          <ellipse cx="32" cy="27" rx="15" ry="12" fill="#f87171" />
          <ellipse cx="27" cy="22" rx="5" ry="3.5" fill="#fca5a5" />
          <circle cx="27" cy="25" r="2" fill="#450a0a" />
          <circle cx="37" cy="25" r="2" fill="#450a0a" />
        </svg>
      );

    case 'Flat Vector':
      return (
        <svg viewBox="0 0 64 48" fill="none" className={className} aria-hidden="true">
          <rect width="64" height="48" rx="10" fill="#f1f5f9" />
          <polygon points="14,38 28,14 42,38" fill="#14b8a6" />
          <polygon points="28,38 40,20 52,38" fill="#0f766e" />
          <circle cx="20" cy="16" r="5" fill="#f59e0b" />
        </svg>
      );

    case 'Fantasy Fairy Tale':
      return (
        <svg viewBox="0 0 64 48" fill="none" className={className} aria-hidden="true">
          <rect width="64" height="48" rx="10" fill="#2e1065" />
          <path d="M24 38V22l8-10 8 10v16H24Z" fill="#c084fc" stroke="#fde68a" strokeWidth="1.6" />
          <circle cx="16" cy="16" r="2" fill="#fde68a" />
          <circle cx="48" cy="14" r="2.5" fill="#fde68a" />
          <circle cx="32" cy="28" r="3" fill="#fde68a" />
        </svg>
      );

    case 'Bedtime Story':
      return (
        <svg viewBox="0 0 64 48" fill="none" className={className} aria-hidden="true">
          <rect width="64" height="48" rx="10" fill="#172554" />
          <path d="M38 14a11 11 0 1 1-10 16 9 9 0 0 0 10-16Z" fill="#fde047" />
          <circle cx="18" cy="16" r="1.8" fill="#fef08a" />
          <circle cx="48" cy="20" r="1.5" fill="#fef08a" />
          <circle cx="22" cy="32" r="1.2" fill="#fef08a" />
        </svg>
      );

    case 'Classic Storybook':
      return (
        <svg viewBox="0 0 64 48" fill="none" className={className} aria-hidden="true">
          <rect width="64" height="48" rx="10" fill="#fef9c3" />
          <rect x="10" y="8" width="44" height="32" rx="5" stroke="#92400e" strokeWidth="2" fill="#fffbeb" />
          <path d="M32 12v24M16 18h10M16 24h10M38 18h10M38 24h10" stroke="#b45309" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );

    case 'Pixel Art':
      return (
        <svg viewBox="0 0 64 48" fill="none" className={className} aria-hidden="true">
          <rect width="64" height="48" rx="10" fill="#0f172a" />
          <rect x="24" y="12" width="16" height="8" fill="#22c55e" />
          <rect x="20" y="20" width="24" height="8" fill="#4ade80" />
          <rect x="24" y="28" width="6" height="8" fill="#16a34a" />
          <rect x="34" y="28" width="6" height="8" fill="#16a34a" />
          <rect x="25" y="15" width="3" height="3" fill="#0f172a" />
          <rect x="36" y="15" width="3" height="3" fill="#0f172a" />
        </svg>
      );

    case 'Chalk Drawing':
      return (
        <svg viewBox="0 0 64 48" fill="none" className={className} aria-hidden="true">
          <rect width="64" height="48" rx="10" fill="#1e293b" />
          <path d="M16 32c6-12 26-12 32 0" stroke="#f8fafc" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="3 2" />
          <circle cx="32" cy="18" r="5" stroke="#fde047" strokeWidth="2.2" strokeDasharray="3 1.5" />
        </svg>
      );

    case 'Comic Book':
      return (
        <svg viewBox="0 0 64 48" fill="none" className={className} aria-hidden="true">
          <rect width="64" height="48" rx="10" fill="#fef08a" />
          <polygon points="32,8 37,19 49,17 41,26 48,37 35,33 28,42 26,30 14,28 24,20" fill="#ef4444" stroke="#111827" strokeWidth="2" />
        </svg>
      );

    case 'Photorealistic':
    default:
      return (
        <svg viewBox="0 0 64 48" fill="none" className={className} aria-hidden="true">
          <rect width="64" height="48" rx="10" fill="#dbeafe" />
          <circle cx="46" cy="15" r="6" fill="#f59e0b" />
          <path d="M8 40 24 20l14 14 8-8 10 14H8Z" fill="#15803d" />
          <path d="M24 20 18 28h12l-6-8Z" fill="#dcfce7" />
        </svg>
      );
  }
}

export default StyleThumb;
