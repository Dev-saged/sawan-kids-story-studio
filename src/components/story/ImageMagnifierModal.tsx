import React, { useState, useRef, useEffect } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  X,
  Search,
  Sparkles,
  Palette,
  Move,
} from 'lucide-react';
import { analyzeTextSentimentAndPalette } from '../../services/gemini';

export interface ImageMagnifierModalProps {
  src: string;
  alt?: string;
  ar: boolean;
  title?: string;
  pageText?: string;
  scenePrompt?: string;
  artStyle?: string;
  styleConsistency?: string;
  onClose: () => void;
}

export function ImageMagnifierModal({
  src,
  alt,
  ar,
  title,
  pageText = '',
  scenePrompt = '',
  artStyle,
  styleConsistency,
  onClose,
}: ImageMagnifierModalProps) {
  const [zoom, setZoom] = useState<number>(1.5);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [loupeEnabled, setLoupeEnabled] = useState<boolean>(true);
  const [loupePos, setLoupePos] = useState<{
    xPct: number;
    yPct: number;
    clientX: number;
    clientY: number;
    visible: boolean;
  }>({
    xPct: 50,
    yPct: 50,
    clientX: 0,
    clientY: 0,
    visible: false,
  });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const sentimentInfo = analyzeTextSentimentAndPalette(pageText, scenePrompt);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(4, +(z + 0.5).toFixed(2)));
      if (e.key === '-') setZoom((z) => Math.max(1, +(z - 0.5).toFixed(2)));
      if (e.key === '0') {
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleZoomChange = (nextZoom: number) => {
    const clamped = Math.max(1, Math.min(4, +nextZoom.toFixed(2)));
    setZoom(clamped);
    if (clamped === 1) {
      setPan({ x: 0, y: 0 });
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.25 : -0.25;
    handleZoomChange(zoom + delta);
  };

  const updatePointerLocation = (clientX: number, clientY: number) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const relX = ((clientX - rect.left) / rect.width) * 100;
    const relY = ((clientY - rect.top) / rect.height) * 100;
    const inside = relX >= 0 && relX <= 100 && relY >= 0 && relY <= 100;
    setLoupePos({
      xPct: Math.max(0, Math.min(100, relX)),
      yPct: Math.max(0, Math.min(100, relY)),
      clientX,
      clientY,
      visible: inside,
    });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    updatePointerLocation(e.clientX, e.clientY);
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    updatePointerLocation(e.clientX, e.clientY);
    if (isDragging && zoom > 1) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ar ? 'فحص وتكبير تفاصيل الصورة' : 'Inspect & Zoom Image Details'}
      dir={ar ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Top Controls Bar */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 bg-black/60 px-4 py-3 sm:px-6 z-20"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-lantern/20 border border-lantern/45 px-3 py-1 text-xs font-extrabold text-lantern">
            <Search size={14} />
            <span>{ar ? 'فحص التفاصيل الفائقة (HD Inspector)' : 'HD Detail Inspector'}</span>
          </span>
          {title && (
            <span className="text-xs sm:text-sm font-bold text-white/90 truncate max-w-xs">
              {title}
            </span>
          )}
          {artStyle && (
            <span className="hidden md:inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/85">
              <Sparkles size={11} className="text-lantern" />
              <span>{artStyle}</span>
              {styleConsistency && styleConsistency !== 'auto' ? ` • ${styleConsistency}` : ''}
            </span>
          )}
        </div>

        {/* Zoom & Loupe Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setLoupeEnabled((v) => !v)}
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-xs font-extrabold transition active:scale-95 ${
              loupeEnabled
                ? 'bg-lantern text-ink shadow-sm'
                : 'border border-white/25 bg-white/10 text-white hover:bg-white/20'
            }`}
            title={ar ? 'تفعيل أو إيقاف عدسة التكبير الدائرية' : 'Toggle interactive magnifying loupe lens'}
          >
            <Search size={14} />
            <span>{ar ? 'عدسة التكبير (3.5x)' : 'Loupe Lens (3.5x)'}</span>
          </button>

          <div className="flex items-center gap-1 rounded-full border border-white/20 bg-white/10 p-1">
            <button
              type="button"
              onClick={() => handleZoomChange(zoom - 0.5)}
              disabled={zoom <= 1}
              className="flex h-9 w-9 items-center justify-center rounded-full text-white transition hover:bg-white/20 disabled:opacity-35"
              title={ar ? 'تصغير' : 'Zoom out'}
              aria-label={ar ? 'تصغير' : 'Zoom out'}
            >
              <ZoomOut size={16} />
            </button>
            {[1, 1.5, 2.5, 4].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handleZoomChange(preset)}
                className={`px-2.5 py-1 rounded-full text-xs font-extrabold transition ${
                  Math.abs(zoom - preset) < 0.15
                    ? 'bg-lantern text-ink'
                    : 'text-white/80 hover:bg-white/15'
                }`}
              >
                {preset}x
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleZoomChange(zoom + 0.5)}
              disabled={zoom >= 4}
              className="flex h-9 w-9 items-center justify-center rounded-full text-white transition hover:bg-white/20 disabled:opacity-35"
              title={ar ? 'تكبير' : 'Zoom in'}
              aria-label={ar ? 'تكبير' : 'Zoom in'}
            >
              <ZoomIn size={16} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="inline-flex min-h-11 items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 text-xs font-bold text-white transition hover:bg-white/20"
            title={ar ? 'إعادة الضبط' : 'Reset view'}
          >
            <RotateCcw size={14} />
            <span className="hidden sm:inline">{ar ? 'إعادة ضبط' : 'Reset'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/30 active:scale-95"
            aria-label={ar ? 'إغلاق' : 'Close'}
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main Interactive Viewport */}
      <div
        ref={containerRef}
        className={`relative flex flex-1 items-center justify-center overflow-hidden select-none p-4 ${
          zoom > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-crosshair'
        }`}
        onClick={(e) => e.stopPropagation()}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          setIsDragging(false);
          setLoupePos((p) => ({ ...p, visible: false }));
        }}
      >
        <div
          className="relative flex items-center justify-center transition-transform duration-75 ease-out"
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
          }}
        >
          <img
            ref={imgRef}
            src={src}
            alt={alt || title || 'Story illustration'}
            draggable={false}
            className="max-h-[72vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl"
          />
        </div>

        {/* Interactive 3.5x Magnifying Loupe Lens */}
        {loupeEnabled && loupePos.visible && (
          <div
            className="pointer-events-none fixed z-30 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-lantern shadow-[0_0_30px_rgba(0,0,0,0.85)] ring-4 ring-black/50"
            style={{
              left: `${loupePos.clientX}px`,
              top: `${loupePos.clientY}px`,
              backgroundImage: `url(${src})`,
              backgroundRepeat: 'no-repeat',
              backgroundSize: '380% 380%',
              backgroundPosition: `${loupePos.xPct}% ${loupePos.yPct}%`,
            }}
          >
            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-black/80 px-2 py-0.5 text-[10px] font-extrabold text-lantern whitespace-nowrap">
              3.5x HD
            </div>
          </div>
        )}

        {/* Helper Hint Pill */}
        <div className="pointer-events-none absolute top-3 start-4 z-20 flex items-center gap-1.5 rounded-full bg-black/65 px-3 py-1.5 text-[11px] font-semibold text-white/85 backdrop-blur-xs">
          <Move size={13} className="text-lantern" />
          <span>
            {ar
              ? `التكبير الحالي: ${Math.round(zoom * 100)}% • اسحب لتحريك الصورة أو مرّر المؤشر لفحص ملامح الشخصيات والخلفية`
              : `Zoom: ${Math.round(zoom * 100)}% • Drag to pan or hover with Loupe to inspect character & background details`}
          </span>
        </div>
      </div>

      {/* Bottom Sentiment & Color Palette Analysis Bar */}
      <div
        className="border-t border-white/15 bg-black/80 px-4 py-3 sm:px-6 z-20"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-extrabold text-white">
              <Palette size={14} className="text-lantern" />
              <span
                className="h-3 w-3 rounded-full ring-2 ring-white/50"
                style={{ backgroundColor: sentimentInfo.swatchHex }}
              />
              <span>
                {ar
                  ? `النبرة العاطفية والألوان: ${sentimentInfo.label.ar}`
                  : `Emotional Palette: ${sentimentInfo.label.en}`}
              </span>
            </span>
            <span
              dir="ltr"
              className="rounded-lg bg-white/10 px-2.5 py-1 font-mono text-[11px] text-amber-200"
            >
              {sentimentInfo.paletteDescriptor}
            </span>
          </div>

          {pageText && (
            <p className="line-clamp-1 max-w-xl text-xs text-white/75">
              {pageText}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
