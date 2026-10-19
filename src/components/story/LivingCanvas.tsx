import { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';

interface Props {
  src: string;
  alt: string;
  ar: boolean;
  className?: string;
}

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  alpha: number;
  alphaSpeed: number;
  hue: number;
}

export default function LivingCanvas({ src, alt, ar, className = '' }: Props) {
  const [isLiving, setIsLiving] = useState(false);
  const [effectType, setEffectType] = useState<'stardust' | 'leaves' | 'breeze'>('stardust');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number>(0);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!isLiving) {
      cancelAnimationFrame(animRef.current);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement?.clientWidth || 600);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 450);

    const particles: Particle[] = Array.from({ length: 45 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 3 + 1.2,
      speedX: (Math.random() - 0.5) * 0.8,
      speedY: (Math.random() - 0.7) * 0.9,
      alpha: Math.random() * 0.7 + 0.2,
      alphaSpeed: (Math.random() * 0.02 + 0.005) * (Math.random() > 0.5 ? 1 : -1),
      hue: effectType === 'stardust' ? 45 + Math.random() * 15 : effectType === 'leaves' ? 30 + Math.random() * 30 : 200,
    }));

    let startTime = performance.now();

    const render = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      ctx.clearRect(0, 0, width, height);

      // Draw subtle light aura
      const auraGrad = ctx.createRadialGradient(
        width / 2 + Math.sin(elapsed * 0.5) * 40,
        height / 2 + Math.cos(elapsed * 0.4) * 30,
        20,
        width / 2,
        height / 2,
        width * 0.6
      );
      auraGrad.addColorStop(0, 'rgba(255, 201, 74, 0.08)');
      auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = auraGrad;
      ctx.fillRect(0, 0, width, height);

      // Animate Particles
      for (const p of particles) {
        p.x += p.speedX;
        p.y += p.speedY;
        p.alpha += p.alphaSpeed;

        if (p.alpha > 0.85 || p.alpha < 0.15) p.alphaSpeed = -p.alphaSpeed;
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 95%, 75%, ${p.alpha})`;
        ctx.shadowColor = `hsla(${p.hue}, 90%, 60%, 0.8)`;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);

    const onResize = () => {
      if (!canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', onResize);
    };
  }, [isLiving, effectType]);

  return (
    <div className={`relative overflow-hidden group select-none ${className}`}>
      {/* Underlying Illustration with Subtle Breathing Motion */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className={`w-full h-full object-cover transition-transform duration-1000 ease-in-out ${
          isLiving ? 'scale-105 animate-[pulse_8s_ease-in-out_infinite]' : ''
        }`}
      />

      {/* Parallax Overlay Canvas */}
      {isLiving && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 pointer-events-none z-10 w-full h-full"
        />
      )}

      {/* Living Animation Badge & Controls */}
      <div className="absolute top-3 end-3 z-20 flex items-center gap-1.5 opacity-90 transition group-hover:opacity-100">
        <button
          type="button"
          onClick={() => setIsLiving(!isLiving)}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold backdrop-blur-md transition shadow-md ${
            isLiving
              ? 'bg-lantern text-ink ring-2 ring-lantern/60'
              : 'bg-black/50 text-white hover:bg-black/70'
          }`}
          title={ar ? 'تفعيل تحريك المشهد السينمائي والتأثيرات' : 'Toggle 2.5D Living Motion'}
        >
          <Sparkles size={13} className={isLiving ? 'animate-spin' : ''} />
          <span>{isLiving ? (ar ? 'مشهد حي نشط' : 'Living 2.5D') : (ar ? 'تحريك المشهد' : 'Animate')}</span>
        </button>

        {isLiving && (
          <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md rounded-full p-1 text-[11px] text-white">
            <button
              type="button"
              onClick={() => setEffectType('stardust')}
              className={`px-2 py-0.5 rounded-full transition ${effectType === 'stardust' ? 'bg-lantern text-ink font-bold' : 'hover:text-lantern'}`}
            >
              {ar ? 'بريق' : 'Glow'}
            </button>
            <button
              type="button"
              onClick={() => setEffectType('leaves')}
              className={`px-2 py-0.5 rounded-full transition ${effectType === 'leaves' ? 'bg-lantern text-ink font-bold' : 'hover:text-lantern'}`}
            >
              {ar ? 'طبيعة' : 'Leaves'}
            </button>
            <button
              type="button"
              onClick={() => setEffectType('breeze')}
              className={`px-2 py-0.5 rounded-full transition ${effectType === 'breeze' ? 'bg-lantern text-ink font-bold' : 'hover:text-lantern'}`}
            >
              {ar ? 'نسيم' : 'Breeze'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
