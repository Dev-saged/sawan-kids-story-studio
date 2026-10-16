import type { ReactNode } from 'react';
import { BRAND, SOCIAL_LINKS, type SocialKey } from '../../config';
import { Language } from '../../types';

// أيقونات SVG مرسومة يدوياً بخط موحّد 1.8
const ICONS: Record<SocialKey, { label: { ar: string; en: string }; glow: string; svg: ReactNode }> = {
  whatsapp: {
    label: { ar: 'واتساب', en: 'WhatsApp' },
    glow: '#25d366',
    svg: (
      <>
        <path d="M4.2 19.8l1.1-3.9A8.4 8.4 0 1 1 8.4 19z" />
        <path d="M9.2 8.6c.2-.5.5-.5.8-.5h.5c.2 0 .4.1.5.4l.7 1.7c.1.2 0 .5-.1.6l-.5.6c-.1.2-.1.4 0 .6.6 1 1.5 1.9 2.6 2.5.2.1.4.1.6-.1l.6-.7c.2-.2.4-.2.6-.1l1.6.8c.3.1.4.3.4.5 0 .6-.3 1.4-1 1.7-.7.4-1.6.4-2.6 0a9.6 9.6 0 0 1-4.6-4.4c-.6-1.2-.6-2.4.3-3.6z" fill="currentColor" stroke="none" />
      </>
    ),
  },
  instagram: {
    label: { ar: 'إنستقرام', en: 'Instagram' },
    glow: '#e1306c',
    svg: (
      <>
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
      </>
    ),
  },
  facebook: {
    label: { ar: 'فيسبوك', en: 'Facebook' },
    glow: '#1877f2',
    svg: <path d="M14 21v-7.6h2.6l.4-3H14V8.6c0-.9.3-1.5 1.6-1.5H17V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.2H8.3v3H11V21" />,
  },
  twitter: {
    label: { ar: 'إكس (تويتر)', en: 'X (Twitter)' },
    glow: '#e7e9ea',
    svg: (
      <>
        <path d="M4 4l6.6 9.1L4.3 20" />
        <path d="M4 4h4.3L20 20h-4.3z" />
        <path d="M19.6 4l-6 6.6" />
      </>
    ),
  },
  github: {
    label: { ar: 'جيت هب', en: 'GitHub' },
    glow: '#a99be0',
    svg: (
      <path d="M9 19c-4.3 1.4-4.3-2.1-6-2.6m12 4.6v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" />
    ),
  },
};

const ORDER: SocialKey[] = ['whatsapp', 'instagram', 'facebook', 'twitter', 'github'];

const hrefFor = (key: SocialKey, value: string) => (key === 'whatsapp' && /^\+?\d+$/.test(value) ? `https://wa.me/${value.replace('+', '')}` : value);

export default function Credits({ language }: { language: Language }) {
  const ar = language === 'Arabic';
  const links = ORDER.filter((k) => SOCIAL_LINKS[k]);

  return (
    <footer dir={ar ? 'rtl' : 'ltr'} className="relative mt-12 overflow-hidden rounded-3xl border border-lantern/25 bg-gradient-to-br from-dusk via-[#2a1f4f] to-dusk p-6 text-center text-moonlight shadow-xl">
      <div aria-hidden className="pointer-events-none absolute -top-16 left-1/2 h-40 w-72 -translate-x-1/2 rounded-full bg-lantern/25 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(169,155,224,0.18),transparent_45%)]" />

      <p className="relative font-display text-[11px] font-semibold tracking-wide text-star/70">{ar ? 'تصميم وتطوير' : 'Designed & developed by'}</p>
      <p className="relative mt-1 bg-gradient-to-l from-star via-lantern to-star bg-clip-text font-display text-2xl font-extrabold text-transparent">
        {ar ? BRAND.author.ar : BRAND.author.en}
      </p>
      <div aria-hidden className="relative mx-auto mt-3 flex w-40 items-center gap-2">
        <span className="h-px flex-1 bg-gradient-to-l from-lantern/70 to-transparent" />
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-lantern" fill="currentColor">
          <path d="M12 2l2.2 6.6H21l-5.5 4 2.1 6.6L12 15.2 6.4 19.2l2.1-6.6L3 8.6h6.8z" />
        </svg>
        <span className="h-px flex-1 bg-gradient-to-r from-lantern/70 to-transparent" />
      </div>

      {links.length > 0 && (
        <>
          <p className="relative mt-4 text-xs text-moonlight/65">{ar ? 'تواصل معي' : 'Get in touch'}</p>
          <ul className="relative mt-3 flex flex-wrap items-center justify-center gap-3">
            {links.map((key) => {
              const icon = ICONS[key];
              return (
                <li key={key}>
                  <a
                    href={hrefFor(key, SOCIAL_LINKS[key])}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={ar ? icon.label.ar : icon.label.en}
                    title={ar ? icon.label.ar : icon.label.en}
                    style={{ ['--glow' as string]: icon.glow }}
                    className="group relative flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-moonlight backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-[var(--glow)] hover:text-[var(--glow)] hover:shadow-[0_8px_24px_-6px_var(--glow)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lantern active:scale-95"
                  >
                    <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      {icon.svg}
                    </svg>
                  </a>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <div className="relative mx-auto mt-6 inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.06] py-2 pe-4 ps-2 shadow-[0_8px_30px_-10px_rgba(206,17,38,0.55)] backdrop-blur">
        <svg viewBox="0 0 36 24" className="h-6 w-9 shrink-0 overflow-hidden rounded-[5px] shadow" aria-hidden>
          <rect width="36" height="8" fill="#000" />
          <rect y="8" width="36" height="8" fill="#fff" />
          <rect y="16" width="36" height="8" fill="#007a3d" />
          <path d="M0 0l15 12L0 24z" fill="#ce1126" />
        </svg>
        <span className="font-display text-sm font-bold text-moonlight">{ar ? BRAND.madeIn.ar : BRAND.madeIn.en}</span>
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 animate-[heartbeat_1.6s_ease-in-out_infinite] text-[#ff4d6d] drop-shadow-[0_0_8px_rgba(255,77,109,0.7)]" fill="currentColor" aria-hidden>
          <path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.7 4.5c2.1 0 3.6 1.2 5.3 3.1 1.7-1.9 3.2-3.1 5.3-3.1 3.7 0 5.8 3.8 4.3 7.2C19.5 16.4 12 21 12 21z" />
        </svg>
      </div>

      <p className="relative mt-5 text-[11px] text-moonlight/45">
        © {new Date().getFullYear()} {ar ? BRAND.fullName.ar : BRAND.fullName.en} — {ar ? 'جميع الحقوق محفوظة' : 'All rights reserved'}
      </p>
    </footer>
  );
}
