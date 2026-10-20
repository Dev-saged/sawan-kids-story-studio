import { useState, useRef, type ChangeEvent } from 'react';
import { Check, Sparkles, Upload, MessageSquare, Plus, Trash2, RefreshCw, ShieldCheck } from 'lucide-react';
import { StoryPage } from '../../types';
import { saveImage } from '../../services/media';

interface Props {
  ar: boolean;
  page: StoryPage;
  pageIndex: number;
  totalPages: number;
  onUpdatePage: (patch: Partial<StoryPage>) => void;
  onAddPage: () => void;
  onDeletePage: () => void;
  onRedrawImage: (customPrompt?: string) => void;
  isRedrawing?: boolean;
}

export default function FullPageEditor({
  ar,
  page,
  pageIndex,
  totalPages,
  onUpdatePage,
  onAddPage,
  onDeletePage,
  onRedrawImage,
  isRedrawing = false,
}: Props) {
  const [editingText, setEditingText] = useState(page.text);
  const [editingNarration, setEditingNarration] = useState(page.narration || page.text);
  const [editingPrompt, setEditingPrompt] = useState(page.image_prompt || '');
  const [bubbleText, setBubbleText] = useState('');
  const [showBubbleInput, setShowBubbleInput] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveText = () => {
    onUpdatePage({
      text: editingText.trim(),
      narration: editingNarration.trim() || editingText.trim(),
    });
    setSavedTick(true);
    setTimeout(() => setSavedTick(false), 2000);
  };

  const handleUploadImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    try {
      const { id, url } = await saveImage(file, 'page', 'custom_upload', page.image_prompt);
      onUpdatePage({
        generatedImage: url,
        imageId: id,
        imageError: false,
      });
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 2000);
    } catch (err) {
      console.error('Failed to upload custom page image:', err);
    }
  };

  const handleAddSpeechBubble = () => {
    if (!bubbleText.trim()) return;
    // Add speech bubble directly into the page text or overlay note
    const updated = `${editingText}\n\n«${bubbleText.trim()}»`;
    setEditingText(updated);
    onUpdatePage({ text: updated });
    setBubbleText('');
    setShowBubbleInput(false);
    setSavedTick(true);
    setTimeout(() => setSavedTick(false), 2000);
  };

  return (
    <div className="space-y-4 rounded-3xl border-2 border-lantern/60 bg-lantern/5 p-5 shadow-md dark:bg-lantern/10" dir={ar ? 'rtl' : 'ltr'}>
      {/* Edit Mode Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-lantern/25 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-lantern text-ink">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h4 className="font-display text-sm font-bold text-ink dark:text-moonlight">
              {ar ? 'وضع الصلاحية الكاملة للتعديل (Full Edit Mode)' : 'Full Page Edit Mode Enabled'}
            </h4>
            <p className="text-[11px] text-ink/70 dark:text-moonlight/70">
              {ar ? `أنت تتحكم بكافة تفاصيل الصفحة رقم ${pageIndex + 1}` : `Editing page ${pageIndex + 1} of ${totalPages}`}
            </p>
          </div>
        </div>

        {savedTick && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <Check size={13} />
            {ar ? 'تم حفظ التعديلات!' : 'Changes saved!'}
          </span>
        )}
      </div>

      {/* Story Text Editor */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-ink/80 dark:text-moonlight/80">
          {ar ? 'نص الصفحة المكتوب للطفل:' : 'Story Page Text:'}
        </label>
        <textarea
          rows={3}
          value={editingText}
          onChange={(e) => setEditingText(e.target.value)}
          onBlur={handleSaveText}
          className="w-full resize-none rounded-2xl border border-dream/30 bg-white/90 p-3 text-sm text-ink outline-none transition focus:border-lantern dark:bg-[#1a1826] dark:text-moonlight leading-relaxed"
          placeholder={ar ? 'اكتب أو عدّل نص هذه الصفحة هنا...' : 'Edit the story text for this page...'}
        />
      </div>

      {/* Narration Text Editor */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-ink/80 dark:text-moonlight/80">
          {ar ? 'النص المنطوق بالصوت (اختياري، يمكنك إضافة تشكيل أو تبسيط):' : 'Spoken Narration Text:'}
        </label>
        <textarea
          rows={2}
          value={editingNarration}
          onChange={(e) => setEditingNarration(e.target.value)}
          onBlur={handleSaveText}
          className="w-full resize-none rounded-2xl border border-dream/20 bg-white/70 p-2.5 text-xs text-ink outline-none transition focus:border-lantern dark:bg-[#1a1826]/80 dark:text-moonlight leading-relaxed font-sans"
          placeholder={ar ? 'النص الذي يقرأه الراوي صوتياً...' : 'Text read by narrator...'}
        />
      </div>

      {/* Illustration Prompt & Regeneration */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-ink/80 dark:text-moonlight/80">
          {ar ? 'وصف المشهد الفني للذكاء الاصطناعي (Image Prompt):' : 'AI Illustration Prompt:'}
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={editingPrompt}
            onChange={(e) => setEditingPrompt(e.target.value)}
            className="flex-1 rounded-xl border border-dream/30 bg-white/90 px-3 py-2 text-xs text-ink outline-none transition focus:border-lantern dark:bg-[#1a1826] dark:text-moonlight"
            placeholder={ar ? 'صف المشهد للرسام...' : 'Describe illustration scene...'}
          />
          <button
            type="button"
            disabled={isRedrawing || !editingPrompt.trim()}
            onClick={() => onRedrawImage(editingPrompt)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-lantern px-3.5 py-2 text-xs font-bold text-ink shadow-xs transition hover:brightness-105 active:scale-95 disabled:opacity-50"
            title={ar ? 'أعد رسم المشهد بالوصف الجديد' : 'Redraw with this prompt'}
          >
            {isRedrawing ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} />}
            <span>{ar ? 'أعد الرسم' : 'Redraw'}</span>
          </button>
        </div>
      </div>

      {/* Additional Page Actions & Tools */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-lantern/20 pt-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Upload Custom Image */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleUploadImage}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-full border border-dream/40 bg-white/80 px-3 py-1.5 font-semibold text-ink transition hover:border-lantern dark:bg-white/10 dark:text-moonlight"
          >
            <Upload size={13} />
            <span>{ar ? 'رفع رسمة من جهازي' : 'Upload image'}</span>
          </button>

          {/* Speech Bubble Button */}
          <button
            type="button"
            onClick={() => setShowBubbleInput(!showBubbleInput)}
            className="inline-flex items-center gap-1.5 rounded-full border border-dream/40 bg-white/80 px-3 py-1.5 font-semibold text-ink transition hover:border-lantern dark:bg-white/10 dark:text-moonlight"
          >
            <MessageSquare size={13} />
            <span>{ar ? 'فقاعة حوار' : 'Speech bubble'}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Add Page Button */}
          <button
            type="button"
            onClick={onAddPage}
            className="inline-flex items-center gap-1 rounded-full bg-dream/15 px-3 py-1.5 font-bold text-ink transition hover:bg-dream/25 dark:text-moonlight"
          >
            <Plus size={14} />
            <span>{ar ? 'صفحة جديدة' : 'Add page'}</span>
          </button>

          {/* Delete Page Button */}
          {totalPages > 1 && (
            <button
              type="button"
              onClick={onDeletePage}
              className="inline-flex items-center gap-1 rounded-full border border-coral/30 bg-coral/10 px-3 py-1.5 font-semibold text-coral transition hover:bg-coral/20"
            >
              <Trash2 size={13} />
              <span>{ar ? 'حذف الصفحة' : 'Delete'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Speech Bubble Mini Form */}
      {showBubbleInput && (
        <div className="flex items-center gap-2 rounded-2xl border border-lantern/30 bg-white/80 p-3 dark:bg-[#1f1d2c]">
          <input
            type="text"
            value={bubbleText}
            onChange={(e) => setBubbleText(e.target.value)}
            placeholder={ar ? 'اكتب ما تقوله الشخصية هنا...' : 'Character speech text...'}
            className="flex-1 rounded-xl border border-dream/30 bg-white px-3 py-1.5 text-xs text-ink outline-none dark:bg-white/10 dark:text-moonlight"
          />
          <button
            type="button"
            onClick={handleAddSpeechBubble}
            disabled={!bubbleText.trim()}
            className="inline-flex items-center gap-1 rounded-xl bg-lantern px-3 py-1.5 text-xs font-bold text-ink disabled:opacity-40"
          >
            <Check size={13} />
            <span>{ar ? 'إدراج' : 'Insert'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
