import { useState } from "react";
import { chapters, volumes } from "../data";
import { npcs } from "../data/npcs";
import { completionPct, isUnlocked, type ProgressMap } from "../lib/progress";
import { BADGES as BADGE_LIST } from "../lib/player";
import type { Chapter } from "../types";
import { sfx } from "../lib/sfx";
import { cn } from "../utils/cn";

function Ring({ pct, color }: { pct: number; color: string }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" className="shrink-0">
      <circle cx="20" cy="20" r={r} fill="rgba(0,0,0,.45)" stroke="rgba(255,255,255,.15)" strokeWidth="5" />
      <circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c - (c * pct) / 100}
        transform="rotate(-90 20 20)"
        style={{ transition: "stroke-dashoffset .5s ease" }}
      />
      <text x="20" y="24" textAnchor="middle" fontSize="11" fill="#fff" fontFamily="'Press Start 2P', monospace">
        {pct}
      </text>
    </svg>
  );
}

function NodeCard({
  ch,
  p,
  unlocked,
  onOpen,
  i,
}: {
  ch: Chapter;
  p?: ProgressMap[number];
  unlocked: boolean;
  onOpen: () => void;
  i: number;
}) {
  const npc = npcs[ch.id];
  const pct = completionPct(p);
  const cleared = !!p?.boss;
  return (
    <button
      type="button"
      onClick={() => {
        if (!unlocked) {
          sfx.wrong();
          return;
        }
        sfx.click();
        onOpen();
      }}
      className={cn(
        "card slide-up w-full p-3 text-left transition-all duration-200 sm:p-4",
        unlocked ? "hover:-translate-y-1 hover:brightness-110" : "cursor-not-allowed",
        !unlocked && "opacity-60 grayscale",
      )}
      style={{
        animationDelay: `${i * 70}ms`,
        background: unlocked
          ? `linear-gradient(135deg, ${ch.hue}22, rgba(17,18,46,.96) 55%)`
          : undefined,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-[3px] border-[#0a0a18] text-2xl"
          style={{ background: `linear-gradient(180deg, ${ch.hue}, ${ch.hue}99)` }}
        >
          {unlocked ? ch.emoji : "🔒"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-px text-[8px]" style={{ color: ch.hue }}>
              {ch.code}
            </span>
            {cleared && (
              <span className="rounded border-2 border-[#0a0a18] bg-[#fbbf24] px-1.5 py-0.5 font-px text-[7px] text-[#0a0a18]">
                ★ CLEARED
              </span>
            )}
          </div>
          <h4 className="mt-1.5 font-tech text-[15px] font-bold leading-tight text-white sm:text-base">
            {ch.title}
          </h4>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-tech text-[11px] text-white/55">
            <span className="flex items-center gap-1">
              <span className="text-sm">{npc.avatar}</span>
              <span className="truncate" style={{ color: npc.color }}>
                {npc.name}
              </span>
            </span>
            <span>🖥️ {ch.terminal.length}</span>
            <span>🧩 {ch.checks.length}</span>
            <span>👾 {ch.questions.length}</span>
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <div className="bar-track h-2.5 flex-1">
              <div className="bar-fill bar-stripes" style={{ width: `${pct}%`, background: ch.hue }} />
            </div>
            {p?.bestScore ? (
              <span className="font-px text-[7px] text-white/45">
                {p.bestScore}/{p.total}
              </span>
            ) : null}
          </div>
        </div>
        <Ring pct={pct} color={ch.hue} />
      </div>
    </button>
  );
}

export function WorldMap({
  progress,
  unlockAll,
  onToggleUnlockAll,
  onEnter,
  level,
  title,
  badges,
}: {
  progress: ProgressMap;
  unlockAll: boolean;
  onToggleUnlockAll: () => void;
  onEnter: (id: number) => void;
  level: number;
  title: string;
  badges: string[];
}) {
  const [detail, setDetail] = useState<Chapter | null>(null);
  const total = chapters.length;
  const cleared = chapters.filter((c) => progress[c.id]?.boss).length;
  const stars = chapters.reduce(
    (s, c) => s + (progress[c.id]?.boss ? 1 : 0) + (progress[c.id]?.bestScore === progress[c.id]?.total ? 1 : 0),
    0,
  );
  const overall = Math.round(chapters.reduce((s, c) => s + completionPct(progress[c.id]), 0) / total);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6">
      {/* ===== HERO ===== */}
      <div className="card relative mb-7 overflow-hidden p-5 sm:p-8">
        <div className="orb h-40 w-40 bg-fuchsia-500" style={{ left: "-2rem", top: "-2rem" }} />
        <div className="orb h-52 w-52 bg-cyan-400" style={{ right: "-3rem", bottom: "-3rem", animationDelay: "1.4s" }} />
        <div className="relative z-10">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full border-2 border-[#0a0a18] bg-[#f472b6] px-2.5 py-1 font-px text-[7px] text-[#0a0a18]">
              IPST 2017
            </span>
            <span className="rounded-full border-2 border-[#0a0a18] bg-[#22d3ee] px-2.5 py-1 font-px text-[7px] text-[#0a0a18]">
              ม.4 – ม.6
            </span>
            <span className="rounded-full border-2 border-[#0a0a18] bg-[#a3e635] px-2.5 py-1 font-px text-[7px] text-[#0a0a18]">
              14 ด่าน
            </span>
          </div>
          <h1 className="font-px text-[22px] leading-[1.5] tracking-tight sm:text-[34px]">
            <span className="text-[#fbbf24] glow-pulse">CHEM</span>
            <span className="text-[#22d3ee]">QUEST</span>
          </h1>
          <p className="mt-2 font-px text-[9px] text-white/50 sm:text-[11px]">
            8-BIT CHEMISTRY ADVENTURE · ผจญภัยเรียนเคมีครบทุกบท
          </p>

          {/* บัตรผู้เล่น */}
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border-[3px] border-[#0a0a18] bg-black/35 p-3">
            <span className="text-3xl">🧑‍🔬</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md border-2 border-[#0a0a18] bg-[#fbbf24] px-1.5 py-0.5 font-px text-[7px] text-[#0a0a18]">
                  LV.{level}
                </span>
                <span className="truncate font-tech text-[13px] font-bold text-white">{title}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {badges.length === 0 ? (
                  <span className="font-tech text-[10px] text-white/35">
                    ยังไม่มีเหรียญตรา — เริ่มเรียนเพื่อเก็บให้ครบ!
                  </span>
                ) : (
                  badges.map((id) => {
                    const b = BADGE_LIST.find((x) => x.id === id);
                    return b ? (
                      <span
                        key={id}
                        title={`${b.name} — ${b.desc}`}
                        className="flex items-center gap-1 rounded-lg border-2 border-white/15 bg-white/8 px-1.5 py-0.5 font-tech text-[10px] text-white/75"
                      >
                        {b.icon} {b.name}
                      </span>
                    ) : null;
                  })
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {[
              { k: "ด่านที่ผ่าน", v: `${cleared}/${total}`, i: "🏁", c: "#a3e635" },
              { k: "ดาวสะสม", v: `${stars} ★`, i: "⭐", c: "#fbbf24" },
              { k: "ความคืบหน้า", v: `${overall}%`, i: "📈", c: "#22d3ee" },
              { k: "NPC ไกด์", v: `${Object.keys(npcs).length}`, i: "🧑‍🏫", c: "#f472b6" },
            ].map((s, i) => (
              <div
                key={s.k}
                className="card-soft pop-in flex items-center gap-2.5 p-2.5"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <span className="text-xl">{s.i}</span>
                <div className="min-w-0">
                  <div className="font-px text-[6px] text-white/45">{s.k}</div>
                  <div className="mt-1 font-px text-[10px] tnum" style={{ color: s.c }}>
                    {s.v}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                sfx.click();
                onEnter(1);
              }}
              className="btn-arcade px-5 py-3 font-px text-[11px]"
              style={{ ["--c" as string]: "#a3e635" }}
            >
              ▶ เริ่มผจญภัย
            </button>
            <button
              type="button"
              onClick={() => {
                sfx.click();
                onToggleUnlockAll();
              }}
              className={cn(
                "btn-ghost px-3 py-2.5 font-px text-[8px]",
                unlockAll && "border-[#a3e635] text-[#a3e635]",
              )}
            >
              {unlockAll ? "🔓 ปลดล็อกทุกด่าน: เปิด" : "🔒 ปลดล็อกทุกด่าน"}
            </button>
          </div>
          <p className="mt-3 font-tech text-[11px] leading-relaxed text-white/45">
            เส้นทาง: <b className="text-[#fbbf24]">เรียนกับ NPC</b> →{" "}
            <b className="text-[#22d3ee]">พัซเซิลทบทวน</b> → <b className="text-[#a3e635]">มินิเกมตะลุยด่าน</b> →{" "}
            <b className="text-[#f472b6]">บอสสอบปลายบท</b>
          </p>
        </div>
      </div>

      {/* ===== WORLDS ===== */}
      {volumes.map((vol) => {
        const list = chapters.filter((c) => c.id >= vol.range[0] && c.id <= vol.range[1]);
        const done = list.filter((c) => progress[c.id]?.boss).length;
        return (
          <section key={vol.name} className="mb-10">
            <div className="mb-5 flex items-center gap-3">
              <div className="h-[3px] flex-1 bg-gradient-to-r from-transparent via-white/25 to-white/25" />
              <div className="card-soft flex items-center gap-2.5 px-3 py-1.5">
                <span className="font-px text-[9px] text-white">{vol.name}</span>
                <span className="font-px text-[8px] text-[#a3e635]">
                  {done}/{list.length}
                </span>
              </div>
              <div className="h-[3px] flex-1 bg-gradient-to-l from-transparent via-white/25 to-white/25" />
            </div>

            <div className="relative">
              <div className="absolute bottom-2 left-[27px] top-2 border-l-4 border-dashed border-white/15 md:left-1/2" />
              {list.map((c, i) => {
                const unlocked = isUnlocked(progress, c.id, unlockAll);
                const p = progress[c.id];
                return (
                  <div
                    key={c.id}
                    className={cn("relative flex items-center py-2.5", i % 2 ? "md:flex-row-reverse" : "")}
                  >
                    <div className="relative z-10 shrink-0 md:absolute md:left-1/2 md:-translate-x-1/2">
                      <div
                        className={cn(
                          "flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-[#0a0a18] text-2xl shadow-[0_6px_0_rgba(0,0,0,.5)]",
                          unlocked ? "floaty" : "",
                        )}
                        style={{
                          background: unlocked
                            ? `radial-gradient(circle at 35% 30%, #ffffffaa, ${c.hue} 60%)`
                            : "#2a2c4a",
                          animationDelay: `${i * 200}ms`,
                        }}
                      >
                        {unlocked ? c.emoji : "🔒"}
                      </div>
                      <div
                        className="absolute -bottom-1.5 -right-1.5 rounded-md border-2 border-[#0a0a18] bg-[#0a0a18] px-1.5 py-0.5 font-px text-[7px]"
                        style={{ color: c.hue }}
                      >
                        {String(c.id).padStart(2, "0")}
                      </div>
                    </div>
                    <div className="ml-4 w-full md:ml-0 md:w-[45%]">
                      <NodeCard
                        ch={c}
                        p={p}
                        i={i}
                        unlocked={unlocked}
                        onOpen={() => setDetail(c)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <p className="text-center font-tech text-[11px] text-white/25">
        เนื้อหาอ้างอิงตามหลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน (ฉบับปรับปรุง พ.ศ. 2560) สาระเคมี
      </p>

      {/* ===== DETAIL MODAL ===== */}
      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-3 backdrop-blur-sm"
          onClick={() => setDetail(null)}
        >
          <div
            className="card pop-in my-auto w-full max-w-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="relative p-4"
              style={{ background: `linear-gradient(135deg, ${detail.hue}, ${detail.hue}55)` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="font-px text-[8px] text-[#0a0a18]">{detail.volume}</span>
                  <h3 className="mt-1.5 font-px text-[13px] text-[#0a0a18]">{detail.title}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setDetail(null)}
                  className="rounded-lg border-2 border-[#0a0a18] bg-white/85 px-2 py-1 font-px text-[8px] text-[#0a0a18]"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-5">
              {(() => {
                const npc = npcs[detail.id];
                return (
                  <div>
                    <div className="flex items-start gap-3">
                      <div
                        className="bob flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-[3px] border-[#0a0a18] text-3xl"
                        style={{ background: `linear-gradient(180deg, ${npc.color}, ${npc.color}66)` }}
                      >
                        {npc.avatar}
                      </div>
                      <div className="bubble flex-1 p-3">
                        <p className="font-tech text-[13px] font-bold leading-snug text-[#141432]">
                          {npc.name}
                        </p>
                        <p className="font-tech text-[11px] text-[#4b4b74]">{npc.title}</p>
                        <p className="mt-1.5 font-tech text-[12px] leading-relaxed text-[#20204a]">
                          {npc.greeting}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5">
                      <div className="font-px text-[8px] text-[#fbbf24]">🎯 จุดที่ต้องจำให้แม่น</div>
                      <ul className="mt-2 space-y-1.5">
                        {npc.focus.map((f) => (
                          <li key={f} className="card-soft flex gap-2 px-2.5 py-2 font-tech text-[12px] text-white/80">
                            <span style={{ color: npc.color }}>▸</span>
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-4 flex items-start gap-2 rounded-xl border-2 border-[#f472b6]/40 bg-[#f472b6]/10 p-3">
                      <span className="text-lg">👾</span>
                      <p className="font-tech text-[12px] leading-relaxed text-white/80">
                        <b className="text-[#f472b6]">บอส:</b> {detail.boss.name} — {detail.boss.title} (HP{" "}
                        {detail.boss.hp})
                        <br />
                        <span className="text-white/55">{npc.bossTip}</span>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        sfx.click();
                        onEnter(detail.id);
                      }}
                      className="btn-arcade mt-5 w-full py-3.5 font-px text-[12px]"
                      style={{ ["--c" as string]: detail.hue }}
                    >
                      ▶ เริ่มบทเรียนกับ {npc.name.split(" ").pop()}
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
