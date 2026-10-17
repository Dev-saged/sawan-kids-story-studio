import { useState } from 'react';
import { Check, Copy, Facebook, MessageCircle, Send, Share2 } from 'lucide-react';
import type { StoryData } from '../../types';
import { canNativeShare, shareStory, type ShareChannel } from '../../services/storyBundle';

interface Props {
  story: StoryData;
  ar: boolean;
}

const CHANNELS: { id: ShareChannel; icon: typeof Share2; ar: string; en: string; tone: string }[] = [
  { id: 'whatsapp', icon: MessageCircle, ar: 'واتساب', en: 'WhatsApp', tone: 'text-emerald-600' },
  { id: 'telegram', icon: Send, ar: 'تيليجرام', en: 'Telegram', tone: 'text-sky-600' },
  { id: 'facebook', icon: Facebook, ar: 'فيسبوك', en: 'Facebook', tone: 'text-blue-600' },
  { id: 'copy', icon: Copy, ar: 'نسخ النص', en: 'Copy text', tone: 'text-dream' },
];

export default function ShareMenu({ story, ar }: Props) {
  const [done, setDone] = useState<ShareChannel | null>(null);
  const [error, setError] = useState<string | null>(null);

  const go = async (channel: ShareChannel) => {
    setError(null);
    try {
      await shareStory(story, channel);
      setDone(channel);
      setTimeout(() => setDone(null), 2200);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const items = canNativeShare() ? [{ id: 'native' as ShareChannel, icon: Share2, ar: 'مشاركة', en: 'Share', tone: 'text-lantern' }, ...CHANNELS] : CHANNELS;

  return (
    <section className="rounded-3xl border border-dream/20 bg-white/60 p-4 dark:bg-white/5" dir={ar ? 'rtl' : 'ltr'} aria-label={ar ? 'مشاركة القصة' : 'Share story'}>
      <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold text-ink dark:text-moonlight">
        <Share2 size={16} aria-hidden />
        {ar ? 'شارك القصة' : 'Share this story'}
      </h3>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {items.map(({ id, icon: Icon, ar: labelAr, en, tone }) => (
          <button
            key={id}
            type="button"
            onClick={() => go(id)}
            className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl border border-dream/25 bg-white/70 px-2 py-2 text-[11px] font-semibold text-ink transition hover:border-lantern active:scale-95 dark:bg-white/10 dark:text-moonlight"
          >
            {done === id ? <Check size={18} className="text-emerald-600" aria-hidden /> : <Icon size={18} className={tone} aria-hidden />}
            <span>{done === id ? (ar ? 'تم' : 'Done') : ar ? labelAr : en}</span>
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-coral">{error}</p>}
    </section>
  );
}
