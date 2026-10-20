import { useState } from 'react';
import { GitBranch, Sparkles, Loader2, ArrowRight } from 'lucide-react';
import { StoryData } from '../../types';

interface Props {
  ar: boolean;
  storyData: StoryData;
  onChooseBranch: (choiceText: string) => Promise<void>;
  disabled?: boolean;
}

export default function InteractiveBranches({ ar, storyData, onChooseBranch, disabled = false }: Props) {
  const [loadingChoice, setLoadingChoice] = useState<string | null>(null);

  // Derive 2 dynamic branches based on the story theme and characters
  const hero = storyData.characters[0]?.name || (ar ? 'البطل' : 'the hero');

  const defaultChoices = ar
    ? [
        {
          id: 'branch_explore',
          title: 'استكشاف المسار السري المجهول',
          desc: `يقرر ${hero} خوض المغامرة واكتشاف السر الكامن وراء الباب القديم.`,
        },
        {
          id: 'branch_friend',
          title: 'طلب مساعدة الأصدقاء والتعاون',
          desc: `يستشير ${hero} أصدقاءه الحكماء ليتعاونوا معاً في حل اللغز بروح الفريق.`,
        },
      ]
    : [
        {
          id: 'branch_explore',
          title: 'Explore the Secret Path',
          desc: `${hero} ventures forward to uncover the mystery behind the ancient gate.`,
        },
        {
          id: 'branch_friend',
          title: 'Team Up with Friends',
          desc: `${hero} calls upon wise animal companions to solve the riddle together.`,
        },
      ];

  const handleSelect = async (choice: (typeof defaultChoices)[0]) => {
    if (loadingChoice || disabled) return;
    setLoadingChoice(choice.id);
    try {
      await onChooseBranch(choice.title);
    } finally {
      setLoadingChoice(null);
    }
  };

  return (
    <div className="space-y-3 rounded-3xl border border-lantern/40 bg-gradient-to-br from-lantern/15 via-white/80 to-lantern/5 p-5 shadow-sm dark:from-lantern/10 dark:via-[#1c1a26] dark:to-dusk" dir={ar ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-2">
        <GitBranch size={18} className="text-lantern shrink-0" />
        <h4 className="font-display text-sm font-bold text-ink dark:text-moonlight">
          {ar ? 'قصة تفاعلية: ماذا يختار البطل الآن؟ (اختر مسار المغامرة)' : 'Interactive Story: What happens next? Choose your path!'}
        </h4>
      </div>
      <p className="text-xs text-ink/70 dark:text-moonlight/70">
        {ar
          ? 'أنت مؤلف القصة! انقر على الخيار المفضل لتوليد فصول جديدة ومغامرات فريدة بناءً على قرارك.'
          : 'You are the author! Tap your choice to generate the next chapters according to your decision.'}
      </p>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 pt-1">
        {defaultChoices.map((choice) => {
          const isCurrentLoading = loadingChoice === choice.id;
          return (
            <button
              key={choice.id}
              type="button"
              disabled={Boolean(loadingChoice) || disabled}
              onClick={() => handleSelect(choice)}
              className="flex flex-col text-start justify-between rounded-2xl border border-dream/30 bg-white/90 p-4 transition-all hover:border-lantern hover:bg-lantern/10 hover:shadow-md active:scale-95 disabled:opacity-50 dark:bg-white/5"
            >
              <div className="space-y-1">
                <span className="font-display text-xs font-bold text-ink dark:text-moonlight flex items-center justify-between">
                  {choice.title}
                  {isCurrentLoading ? <Loader2 size={13} className="animate-spin text-lantern" /> : <Sparkles size={13} className="text-lantern" />}
                </span>
                <p className="text-[11px] text-ink/65 dark:text-moonlight/65 leading-relaxed">
                  {choice.desc}
                </p>
              </div>
              <span className="mt-3 text-[11px] font-bold text-lantern flex items-center gap-1">
                <span>{ar ? 'اختر هذا المسار' : 'Choose this branch'}</span>
                <ArrowRight size={11} className={ar ? 'rotate-180' : ''} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
