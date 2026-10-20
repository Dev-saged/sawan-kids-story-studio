import { useState, useRef, useEffect } from 'react';
import { Rotate3D, Video, X, Play, Pause, Sparkles, BookOpen, Layers, Image as ImageIcon } from 'lucide-react';
import { Book3DTheme, StoryData } from '../../types';
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

interface Props {
  storyData: StoryData;
  ar: boolean;
  onClose: () => void;
}

export default function Book3DViewer({ storyData, ar, onClose }: Props) {
  const [theme, setTheme] = useState<Book3DTheme>('hardcover');
  const [rotY, setRotY] = useState(25);
  const [rotX, setRotX] = useState(-5);
  const [isAutoRotating, setIsAutoRotating] = useState(true);
  const [isExportingVideo, setIsExportingVideo] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const dragRef = useRef({ isDragging: false, startX: 0, startY: 0, startRotY: 0, startRotX: 0 });
  const animFrameRef = useRef(0);

  // Auto rotation loop
  useEffect(() => {
    if (!isAutoRotating || isExportingVideo) return;
    let lastTime = performance.now();
    const loop = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;
      setRotY((prev) => (prev + dt * 25) % 360);
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isAutoRotating, isExportingVideo]);

  // Mouse/Touch Drag Handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsAutoRotating(false);
    dragRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startRotY: rotY,
      startRotX: rotX,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.isDragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setRotY((dragRef.current.startRotY + dx * 0.7) % 360);
    setRotX(Math.max(-40, Math.min(40, dragRef.current.startRotX - dy * 0.5)));
  };

  const handlePointerUp = () => {
    dragRef.current.isDragging = false;
  };

  const title = storyData.story_info.title;
  const moral = storyData.story_info.moral || storyData.pages[0]?.text?.slice(0, 150) || '';
  const coverImg = storyData.coverImage || storyData.pages[0]?.generatedImage;
  const backImg = storyData.pages[storyData.pages.length - 1]?.generatedImage || coverImg;

  // Render 360° Rotating Video using Canvas & MP4-Muxer
  const handleExport3DVideo = async () => {
    if (isExportingVideo) return;
    setIsExportingVideo(true);
    setExportProgress(0);

    try {
      const W = 720;
      const H = 720;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get 2d context');

      // Load cover and back images
      const loadImg = (src: string | undefined): Promise<HTMLImageElement | null> =>
        new Promise((res) => {
          if (!src) return res(null);
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => res(img);
          img.onerror = () => res(null);
          img.src = src;
        });

      const [loadedCover, loadedBack] = await Promise.all([loadImg(coverImg), loadImg(backImg)]);

      const FPS = 30;
      const DURATION_SEC = 5;
      const TOTAL_FRAMES = FPS * DURATION_SEC;

      const target = new ArrayBufferTarget();
      const muxer = new Muxer({
        target,
        video: {
          codec: 'avc',
          width: W,
          height: H,
        },
        fastStart: 'in-memory',
      });

      // VideoEncoder
      const encoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: (e) => console.error(e),
      });

      encoder.configure({
        codec: 'avc1.42001f',
        width: W,
        height: H,
        bitrate: 2_500_000,
        framerate: FPS,
      });

      // Render frames
      for (let f = 0; f < TOTAL_FRAMES; f++) {
        const progressRatio = f / TOTAL_FRAMES;
        setExportProgress(Math.round(progressRatio * 100));

        const angle = progressRatio * Math.PI * 2; // full 360
        const bookW = 260;
        const bookH = 360;
        const bookDepth = 30;

        // Background gradient
        const bgGrad = ctx.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, W / 1.2);
        bgGrad.addColorStop(0, '#2d1b4e');
        bgGrad.addColorStop(1, '#0e0b1a');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);

        // Ambient golden particles
        ctx.fillStyle = 'rgba(255, 215, 0, 0.4)';
        for (let p = 0; p < 30; p++) {
          const px = ((p * 73 + f * 2) % W);
          const py = ((p * 101 + f * 1.5) % H);
          ctx.beginPath();
          ctx.arc(px, py, (p % 3) + 1, 0, Math.PI * 2);
          ctx.fill();
        }

        // Draw Book in 3D projection
        ctx.save();
        ctx.translate(W / 2, H / 2);

        // 3D rotation transform calculation
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const tiltX = Math.sin(f * 0.05) * 0.1;

        // Drop Shadow
        ctx.save();
        ctx.translate(0, bookH / 2 + 30);
        ctx.scale(1, 0.25);
        ctx.beginPath();
        ctx.arc(0, 0, bookW * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.filter = 'blur(15px)';
        ctx.fill();
        ctx.restore();

        // Draw Front or Back Cover depending on angle
        ctx.save();
        ctx.transform(cos, tiltX * sin, 0, 1, 0, 0);

        if (cos >= 0) {
          // Front Cover
          if (loadedCover) {
            ctx.drawImage(loadedCover, -bookW / 2, -bookH / 2, bookW, bookH);
          } else {
            ctx.fillStyle = '#ffc94a';
            ctx.fillRect(-bookW / 2, -bookH / 2, bookW, bookH);
          }

          // Gold border
          ctx.strokeStyle = '#f4a261';
          ctx.lineWidth = 4;
          ctx.strokeRect(-bookW / 2 + 8, -bookH / 2 + 8, bookW - 16, bookH - 16);

          // Title banner
          ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
          ctx.fillRect(-bookW / 2, bookH / 2 - 80, bookW, 80);

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 18px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(title.slice(0, 24), 0, bookH / 2 - 40);
        } else {
          // Back Cover (Unmirror text horizontally so it renders readable)
          ctx.save();
          ctx.scale(-1, 1);

          if (loadedBack) {
            ctx.drawImage(loadedBack, -bookW / 2, -bookH / 2, bookW, bookH);
          } else {
            ctx.fillStyle = '#1e1b2e';
            ctx.fillRect(-bookW / 2, -bookH / 2, bookW, bookH);
          }

          // Dark overlay for back blurb
          ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
          ctx.fillRect(-bookW / 2 + 12, -bookH / 2 + 12, bookW - 24, bookH - 24);

          ctx.fillStyle = '#ffc94a';
          ctx.font = 'bold 14px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('استوديو ساجد لقصص الأطفال', 0, -bookH / 2 + 50);

          ctx.fillStyle = '#e2e8f0';
          ctx.font = '11px sans-serif';
          ctx.fillText(moral.slice(0, 70), 0, -bookH / 2 + 110);

          ctx.fillStyle = '#ffc94a';
          ctx.font = 'bold 10px sans-serif';
          ctx.fillText('حقوق النشر والتأليف © 2026 — المهندس ساجد العبادلة', 0, bookH / 2 - 25);

          ctx.restore();
        }
        ctx.restore();

        // Spine thickness line
        ctx.save();
        ctx.fillStyle = '#cca43b';
        const spineX = (-bookW / 2) * cos;
        ctx.fillRect(spineX - (bookDepth / 2) * sin, -bookH / 2, Math.abs(bookDepth * sin) + 2, bookH);
        ctx.restore();

        ctx.restore();

        // Watermark / Branding
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('استوديو ساجد لقصص الأطفال — Sajed 3D Storybook | المهندس ساجد العبادلة', W / 2, H - 35);

        // Encode frame
        const videoFrame = new VideoFrame(canvas, { timestamp: (f * 1_000_000) / FPS });
        encoder.encode(videoFrame, { keyFrame: f % 30 === 0 });
        videoFrame.close();
      }

      await encoder.flush();
      muxer.finalize();

      const buffer = target.buffer;
      const blob = new Blob([buffer], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/\s+/g, '_')}_3D_Book.mp4`;
      document.body.appendChild(a);
    } catch (err) {
      console.error('3D Video export error:', err);
    } finally {
      setIsExportingVideo(false);
      setExportProgress(0);
    }
  };

  // تنزيل صورة الغلاف الأمامي عالية الدقة
  const handleDownloadFrontCover = () => {
    if (!coverImg) return;
    const a = document.createElement('a');
    a.href = coverImg;
    a.download = `${title.replace(/\s+/g, '_')}_Front_Cover.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // تنزيل لوحة الأغلفة المجمّعة المكتملة من كل الزوايا (Front, Spine, 3D Angle, Back)
  const handleDownloadMultiAngleSheet = async () => {
    const W = 1920;
    const H = 1080;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loadImg = (src: string | undefined): Promise<HTMLImageElement | null> =>
      new Promise((res) => {
        if (!src) return res(null);
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => res(img);
        img.onerror = () => res(null);
        img.src = src;
      });

    const [loadedCover, loadedBack] = await Promise.all([loadImg(coverImg), loadImg(backImg)]);

    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(0.5, '#1e1b4e');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#ffc94a';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, W / 2, 70);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '18px sans-serif';
    ctx.fillText('استوديو ساجد لقصص الأطفال — طقم الأغلفة الكامل من جميع الزوايا', W / 2, 105);

    ctx.fillStyle = '#1e1b2e';
    ctx.fillRect(100, 160, 480, 680);
    if (loadedCover) {
      ctx.drawImage(loadedCover, 100, 160, 480, 680);
    }
    ctx.strokeStyle = '#ffc94a';
    ctx.lineWidth = 6;
    ctx.strokeRect(100, 160, 480, 680);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('الغلاف الأمامي (Front)', 340, 880);

    const spineGrad = ctx.createLinearGradient(640, 160, 720, 160);
    spineGrad.addColorStop(0, '#b3861e');
    spineGrad.addColorStop(0.5, '#ffc94a');
    spineGrad.addColorStop(1, '#996f13');
    ctx.fillStyle = spineGrad;
    ctx.fillRect(640, 160, 80, 680);

    ctx.save();
    ctx.translate(680, 500);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#1e1b2e';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title.slice(0, 30), 0, 8);
    ctx.restore();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('الكعب (Spine)', 680, 880);

    ctx.fillStyle = '#1e1b2e';
    ctx.fillRect(780, 160, 480, 680);
    if (loadedBack) {
      ctx.drawImage(loadedBack, 780, 160, 480, 680);
    }
    ctx.strokeStyle = '#ffc94a';
    ctx.lineWidth = 6;
    ctx.strokeRect(780, 160, 480, 680);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('الغلاف الخلفي (Back)', 1020, 880);

    ctx.save();
    ctx.translate(1550, 500);
    ctx.transform(0.8, -0.15, 0.2, 0.9, 0, 0);
    if (loadedCover) {
      ctx.drawImage(loadedCover, -180, -260, 360, 520);
    } else {
      ctx.fillStyle = '#ffc94a';
      ctx.fillRect(-180, -260, 360, 520);
    }
    ctx.strokeStyle = '#f4a261';
    ctx.lineWidth = 4;
    ctx.strokeRect(-180, -260, 360, 520);
    ctx.restore();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('منظور 3D المائل (Perspective)', 1550, 880);

    ctx.fillStyle = '#ffc94a';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('حقوق النشر والتأليف محفوظة © استوديو ساجد لقصص الأطفال — Sajed Story Studio', W / 2, 1020);

    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_')}_MultiAngle_CoverSheet.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md" dir={ar ? 'rtl' : 'ltr'}>
      <div className="relative flex flex-col w-full max-w-3xl rounded-3xl border border-dream/30 bg-[#161324] p-6 shadow-2xl text-moonlight sm:p-7 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-lantern/20 text-lantern">
              <Rotate3D size={24} />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-white">
                {ar ? 'معاينة الكتاب ثلاثي الأبعاد (3D Hardcover)' : '3D Hardcover Book Experience'}
              </h3>
              <p className="text-xs text-white/60">
                {ar ? 'اسحب بالماوس أو اللمس لتدوير الكتاب واستكشاف الغلاف الأمامي والخلفي' : 'Drag to rotate the book 360° and inspect covers'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* 3D Stage Area */}
        <div
          className="relative flex h-[380px] w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-[#221c38] to-[#0e0b17] select-none cursor-grab active:cursor-grabbing"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{ perspective: '1100px' }}
        >
          {/* Subtle Ambient Lighting Circle */}
          <div className="absolute h-80 w-80 rounded-full bg-lantern/10 blur-3xl pointer-events-none" />

          {/* 3D Book Container */}
          <div
            className="relative transition-transform ease-out"
            style={{
              width: '240px',
              height: '320px',
              transformStyle: 'preserve-3d',
              transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
              transitionDuration: dragRef.current.isDragging ? '0ms' : '150ms',
            }}
          >
            {/* Front Cover */}
            <div
              className={`absolute inset-0 rounded-r-xl overflow-hidden shadow-2xl backface-hidden bg-dusk ${
                theme === 'hardcover'
                  ? 'border-4 border-amber-400/75 ring-1 ring-amber-200/40'
                  : theme === 'grimoire'
                    ? 'border-4 border-amber-700/80 ring-2 ring-amber-900/60'
                    : 'border border-white/30 rounded-2xl'
              }`}
              style={{
                transform: 'translateZ(14px)',
              }}
            >
              {coverImg ? (
                <img src={coverImg} alt="Cover" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-dream/30">
                  <BookOpen size={48} className="text-lantern" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex flex-col justify-end p-4">
                <span className="text-[10px] uppercase font-bold text-lantern tracking-wider mb-0.5">
                  {ar ? 'استوديو ساجد لقصص الأطفال' : 'Sajed Story Studio'}
                </span>
                <h4
                  className={`text-base sm:text-lg text-white drop-shadow leading-snug text-balance-wrap ${
                    (storyData.coverFontStyle || 'kufi') === 'kufi'
                      ? 'font-cover-kufi text-amber-200'
                      : storyData.coverFontStyle === 'diwani'
                        ? 'font-cover-diwani text-emerald-200'
                        : storyData.coverFontStyle === 'display3d'
                          ? 'font-cover-3d text-amber-300'
                          : 'font-cover-naskh text-white'
                  }`}
                >
                  {title}
                </h4>
              </div>
            </div>

            {/* Book Spine (كعب الكتاب) */}
            <div
              className="absolute top-0 bottom-0 flex items-center justify-center bg-gradient-to-r from-[#b3861e] via-[#ffc94a] to-[#996f13] shadow-md text-ink font-bold text-xs"
              style={{
                width: '28px',
                left: '-14px',
                transform: 'rotateY(-90deg) translateZ(0px)',
              }}
            >
              <span className="[writing-mode:vertical-rl] rotate-180 truncate px-1 text-[11px] tracking-widest font-display">
                {title}
              </span>
            </div>

            {/* Back Cover */}
            <div
              className="absolute inset-0 rounded-l-xl overflow-hidden shadow-2xl border-2 border-lantern/30 bg-[#151221] p-5 flex flex-col justify-between"
              style={{
                transform: 'rotateY(180deg) translateZ(14px)',
              }}
            >
              {backImg && (
                <img src={backImg} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />
              )}
              <div className="relative z-10 space-y-2">
                <div className="flex items-center gap-1.5 text-lantern">
                  <Sparkles size={14} />
                  <span className="font-display text-xs font-bold">{ar ? 'الحكمة والعِبرة' : 'Story Wisdom'}</span>
                </div>
                <p className="text-xs text-white/80 leading-relaxed font-sans line-clamp-4">
                  {moral}
                </p>
              </div>

              <div className="relative z-10 border-t border-white/20 pt-3 flex items-center justify-between text-[10px] text-white/50">
                <span>ISBN 978-SAJED-AI</span>
                <div className="h-6 w-16 bg-white/20 rounded flex items-center justify-center font-mono">
                  |||| ||| ||
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3D Theme Switcher & Cover Downloads Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-white/70">{ar ? 'قالب الغلاف:' : '3D Theme:'}</span>
            {(
              [
                { id: 'hardcover', label: { ar: 'مجلّد فاخر مطعّم بالذهب', en: 'Gold Hardcover' } },
                { id: 'carddeck', label: { ar: 'كارت مودرن', en: 'Minimal Card Deck' } },
                { id: 'grimoire', label: { ar: 'جلد ملكي عتيق', en: 'Antique Grimoire' } },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTheme(t.id)}
                className={`rounded-full px-3 py-1 text-xs font-bold transition active:scale-95 ${
                  theme === t.id ? 'bg-lantern text-ink shadow-sm' : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                {ar ? t.label.ar : t.label.en}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadFrontCover}
              className="inline-flex items-center gap-1.5 rounded-full border border-lantern/50 bg-lantern/15 px-3.5 py-1.5 text-xs font-bold text-lantern transition hover:bg-lantern/25"
            >
              <ImageIcon size={14} />
              <span>{ar ? 'تنزيل الواجهة فقط' : 'Front Cover PNG'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadMultiAngleSheet}
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/50 bg-emerald-500/15 px-3.5 py-1.5 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/25"
            >
              <Layers size={14} />
              <span>{ar ? 'طقم الأغلفة الكامل من كل الزوايا' : 'Full Multi-Angle Cover Sheet'}</span>
            </button>
          </div>
        </div>

        {/* Controls & Video Export */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAutoRotating(!isAutoRotating)}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3.5 py-1.5 text-xs font-semibold hover:bg-white/10 transition"
            >
              {isAutoRotating ? <Pause size={13} /> : <Play size={13} />}
              <span>{isAutoRotating ? (ar ? 'إيقاف التدوير' : 'Pause spin') : (ar ? 'تدوير تلقائي' : 'Auto spin')}</span>
            </button>

            <button
              type="button"
              onClick={() => { setRotY(0); setRotX(0); setIsAutoRotating(false); }}
              className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-medium hover:bg-white/10 transition"
            >
              {ar ? 'الغلاف الأمامي' : 'Front'}
            </button>
            <button
              type="button"
              onClick={() => { setRotY(-90); setRotX(0); setIsAutoRotating(false); }}
              className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-medium hover:bg-white/10 transition"
            >
              {ar ? 'الكعب' : 'Spine'}
            </button>
            <button
              type="button"
              onClick={() => { setRotY(180); setRotX(0); setIsAutoRotating(false); }}
              className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-medium hover:bg-white/10 transition"
            >
              {ar ? 'الغلاف الخلفي' : 'Back'}
            </button>
          </div>

          <button
            type="button"
            disabled={isExportingVideo}
            onClick={handleExport3DVideo}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-lantern px-5 text-xs font-bold text-ink shadow-md transition hover:brightness-105 active:scale-95 disabled:opacity-50"
          >
            {isExportingVideo ? (
              <>
                <Video size={15} className="animate-pulse" />
                <span>{ar ? `جارٍ إنتاج فيديو 3D... ${exportProgress}%` : `Rendering 3D Video... ${exportProgress}%`}</span>
              </>
            ) : (
              <>
                <Video size={15} />
                <span>{ar ? 'تنزيل فيديو 3D للكتاب (MP4)' : 'Download 3D Book Video (MP4)'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
