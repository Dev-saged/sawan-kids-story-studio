export function LanternSvg({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M9 3h6M12 2v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M8 6h8l2 4v6l-2 4H8l-2-4v-6l2-4Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M6 10h12M6 16h12M9 20h6M10 22h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="13" r="2" fill="currentColor" />
    </svg>
  );
}

export function DialectBadgeSvg({ code }: { code: string }) {
  return (
    <span className="inline-flex h-5 min-w-[1.6rem] items-center justify-center rounded-md border border-lantern/40 bg-lantern/15 px-1 font-mono text-[10px] font-bold text-lantern">
      {code}
    </span>
  );
}

export function TemplateIconSvg({ name, className = 'w-5 h-5' }: { name: string; className?: string }) {
  switch (name) {
    case 'olive':
    case 'oak':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M12 21V11M12 11C8 11 5 8 5 4c4 0 7 3 7 7ZM12 14c4 0 7-3 7-7-4 0-7 3-7 7Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'jasmine':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <circle cx="12" cy="12" r="2.5" fill="currentColor" />
          <path d="M12 4a3 3 0 0 1 2.5 4.6A3 3 0 0 1 19 12a3 3 0 0 1-4.5 2.6A3 3 0 0 1 12 20a3 3 0 0 1-2.5-4.6A3 3 0 0 1 5 12a3 3 0 0 1 4.5-2.6A3 3 0 0 1 12 4Z" stroke="currentColor" strokeWidth="1.7" />
        </svg>
      );
    case 'felucca':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M12 3v14M12 4l7 10h-7M12 6L7 14h5M4 17h16l-2 3H6l-2-3Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'falcon':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M3 12c4-5 9-7 18-7-3 5-5 10-10 14l-3-4-5-3Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'rocket':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09ZM12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'dolphin':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M3 16c3-6 9-9 16-7 1 2 1 5-1 7-3-1-6 0-9 2l-2 3-1-3-3-2Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'robot':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <rect x="4" y="7" width="16" height="12" rx="3" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 3v4M9 12h.01M15 12h.01M9 16h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'dino':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M14 4h5v4h-3v4h-2v7h-3v-4H8v4H5v-6l-2-2 2-2h4V6a2 2 0 0 1 2-2h3Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'moon':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'bolt':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'chef':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6v-7.13ZM6 17h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'pomegranate':
    case 'citrus':
    case 'mango':
    case 'apple':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M12 6c-3.5 0-6 2.8-6 6.5C6 17 9 20 12 20s6-3 6-7.5C18 8.8 15.5 6 12 6ZM12 6V3m0 3c1.5-2 3.5-2 4.5-1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'tent':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M3.5 21 12 4l8.5 17H3.5Zm8.5-7v7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'compass':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
          <polygon points="15.5 8.5 13.5 13.5 8.5 15.5 10.5 10.5 15.5 8.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      );
    case 'backpack':
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <rect x="5" y="7" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.8" />
          <path d="M9 7V5a3 3 0 0 1 6 0v2M8 14h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
  }
}

export function MagnetSvg({ className = 'w-14 h-14' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 10v14a12 12 0 0 0 24 0V10h-7v14a5 5 0 0 1-10 0V10h-7Z"
        fill="#ef476f"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <rect x="12" y="8" width="7" height="6" fill="#e2e8f0" stroke="currentColor" strokeWidth="2" />
      <rect x="29" y="8" width="7" height="6" fill="#e2e8f0" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function MagnetObjectSvg({ id, className = 'w-8 h-8' }: { id: string; className?: string }) {
  switch (id) {
    case 'nail':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M8 4h8M12 4v14l-1.5 3L9 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'paperclip':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'feather':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5zM16 8 2 22M17.5 15H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'leaf':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'key':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <circle cx="7.5" cy="15.5" r="4.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="m10.7 12.3 9.3-9.3 2 2-2.5 2.5 1.5 1.5-2.5 2.5-1.5-1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'balloon':
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M12 3a6 6 0 0 1 6 6c0 4-3 7-6 8-3-1-6-4-6-8a6 6 0 0 1 6-6Zm0 14v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

export function VolcanoSvg({ erupting = false, className = 'w-24 h-24' }: { erupting?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      {erupting && (
        <g>
          <path d="M32 22c-4-8-12-12-16-6M32 22c4-10 14-12 16-4M32 22V8" stroke="#f0a202" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="22" cy="10" r="3" fill="#ef476f" />
          <circle cx="42" cy="10" r="3" fill="#f0a202" />
          <circle cx="32" cy="6" r="3.5" fill="#ef476f" />
        </g>
      )}
      <path d="M10 54 24 24h16l14 30H10Z" fill="#5c4d7d" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M24 24c2 5 6 4 8 8 2-4 6-3 8-8H24Z" fill="#ef476f" />
    </svg>
  );
}

export function CandySvg({ className = 'w-12 h-12' }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
      <path d="M4 12l6 6-6 6V12ZM32 12l-6 6 6 6V12Z" fill="#f0a202" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="18" cy="18" r="8" fill="#ef476f" stroke="currentColor" strokeWidth="2" />
      <path d="M15 14c2 2 4 6 6 8" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
