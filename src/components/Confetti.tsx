import { useEffect, useMemo, useState } from "react";

const COLORS = ["#fbbf24", "#f472b6", "#22d3ee", "#a3e635", "#a78bfa", "#fb923c", "#ffffff"];

/** คอนเฟตติฉลอง (แสดงชั่วคราวแล้วหายไปเอง) */
export function Confetti({ count = 60, duration = 1800 }: { count?: number; duration?: number }) {
  const [alive, setAlive] = useState(true);
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        i,
        left: Math.random() * 100,
        delay: Math.random() * 0.4,
        dur: duration / 1000 * (0.65 + Math.random() * 0.6),
        size: 6 + Math.random() * 8,
        color: COLORS[i % COLORS.length],
        rot: Math.random() * 360,
        round: Math.random() < 0.4,
      })),
    [count, duration],
  );

  useEffect(() => {
    const t = setTimeout(() => setAlive(false), duration + 700);
    return () => clearTimeout(t);
  }, [duration]);

  if (!alive) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.i}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * (p.round ? 1 : 1.7),
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
            borderRadius: p.round ? "999px" : "2px",
            transform: `rotate(${p.rot}deg)`,
          }}
        />
      ))}
    </div>
  );
}

/** ป้ายดาว/เลเวลอัพกลางจอ */
export function LevelUpToast({ title, level }: { title: string; level: number }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[61] flex items-center justify-center">
      <div className="banner-in rounded-2xl border-[4px] border-[#0a0a18] bg-gradient-to-b from-[#fbbf24] to-[#f59e0b] px-7 py-5 text-center shadow-[0_10px_0_rgba(0,0,0,.5)]">
        <div className="font-px text-[18px] text-[#0a0a18] sm:text-[26px]">LEVEL UP!</div>
        <div className="mt-2 font-px text-[10px] text-[#0a0a18]">LV.{level}</div>
        <div className="mt-2 font-tech text-[15px] font-bold text-[#0a0a18]">{title}</div>
      </div>
    </div>
  );
}

/** ป้ายเหรียญตราใหม่ */
export function BadgeToast({ icon, name, desc }: { icon: string; name: string; desc: string }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[61] flex items-center justify-center p-4">
      <div className="banner-in flex items-center gap-4 rounded-2xl border-[4px] border-[#0a0a18] bg-gradient-to-b from-[#a78bfa] to-[#7c3aed] px-6 py-5 shadow-[0_10px_0_rgba(0,0,0,.5)]">
        <span className="text-[52px]">{icon}</span>
        <div>
          <div className="font-px text-[10px] text-[#0a0a18]">NEW BADGE!</div>
          <div className="mt-1.5 font-tech text-[17px] font-bold text-white">{name}</div>
          <div className="mt-1 font-tech text-[12px] text-white/75">{desc}</div>
        </div>
      </div>
    </div>
  );
}
