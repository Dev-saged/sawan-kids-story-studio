import { useState } from 'react';
import { READ_LEARN_ARTICLES } from '../../constants';
import { Language } from '../../types';

interface Props {
  language: Language;
}

export default function ReadLearn({ language }: Props) {
  const ar = language === 'Arabic';
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-4" dir={ar ? 'rtl' : 'ltr'}>
      <div>
        <h2 className="font-display text-xl font-semibold text-ink dark:text-moonlight">
          {ar ? 'اقرأ وتعلم' : 'Read & Learn'}
        </h2>
        <p className="mt-1 text-sm text-ink/60 dark:text-moonlight/60">
          {ar ? 'مفاهيم علمية بسيطة بأسلوب ممتع.' : 'Simple science concepts, told in a fun way.'}
        </p>
      </div>

      <ul className="space-y-3">
        {READ_LEARN_ARTICLES.map((article) => {
          const isOpen = openId === article.id;
          return (
            <li key={article.id} className="page-corner overflow-hidden rounded-2xl border border-dream/20 bg-white/70 dark:bg-white/5">
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : article.id)}
                className="flex w-full items-center gap-3 p-4 text-start"
                aria-expanded={isOpen}
              >
                <span className="text-2xl" aria-hidden>
                  {article.emoji}
                </span>
                <span className="flex-1">
                  <span className="block font-display text-base font-semibold text-ink dark:text-moonlight">
                    {ar ? article.title.ar : article.title.en}
                  </span>
                  <span className="block text-sm text-ink/60 dark:text-moonlight/60">
                    {ar ? article.summary.ar : article.summary.en}
                  </span>
                </span>
              </button>
              {isOpen && (
                <p className="px-4 pb-4 text-sm leading-relaxed text-ink/80 dark:text-moonlight/80">
                  {ar ? article.body.ar : article.body.en}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
